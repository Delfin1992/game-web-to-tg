import { readFile } from "node:fs/promises";
import { lastInlineMessageByChatId } from "./state";
import { getTelegramRetryAfterSeconds, repairMojibake, sleep } from "./helpers";

function sanitizeTelegramPayload(value: unknown): unknown {
  if (typeof value === "string") return repairMojibake(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeTelegramPayload(item));
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, sanitizeTelegramPayload(item)]);
    return Object.fromEntries(entries);
  }
  return value;
}

export async function callTelegramApi(token: string, method: string, body: Record<string, unknown>) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const sanitizedBody = sanitizeTelegramPayload(body) as Record<string, unknown>;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sanitizedBody),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) {
        const retryAfterSec = getTelegramRetryAfterSeconds(text) ?? 2;
        if (attempt < 2) {
          await sleep((retryAfterSec + 1) * 1000);
          continue;
        }
      }
      throw new Error(`Telegram API ${method} failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    if (!json.ok) {
      const description = String(json.description || "unknown error");
      const retryAfterSec = Number(json.parameters?.retry_after);
      if ((/Too Many Requests/i.test(description) || Number.isFinite(retryAfterSec)) && attempt < 2) {
        await sleep(((Number.isFinite(retryAfterSec) ? retryAfterSec : 2) + 1) * 1000);
        continue;
      }
      throw new Error(`Telegram API ${method} failed: ${description}`);
    }

    return json.result;
  }

  throw new Error(`Telegram API ${method} failed: retry limit exceeded`);
}

async function callTelegramApiMultipart(
  token: string,
  method: string,
  body: Record<string, unknown>,
  fileField: string,
  fileName: string,
  fileBuffer: Buffer,
  fileMimeType = "image/png",
) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const sanitizedBody = sanitizeTelegramPayload(body) as Record<string, unknown>;
  const form = new FormData();

  for (const [key, value] of Object.entries(sanitizedBody)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      form.append(key, String(value));
      continue;
    }
    form.append(key, JSON.stringify(value));
  }

  form.append(fileField, new Blob([fileBuffer], { type: fileMimeType }), fileName);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) {
        const retryAfterSec = getTelegramRetryAfterSeconds(text) ?? 2;
        if (attempt < 2) {
          await sleep((retryAfterSec + 1) * 1000);
          continue;
        }
      }
      throw new Error(`Telegram API ${method} failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    if (!json.ok) {
      const description = String(json.description || "unknown error");
      const retryAfterSec = Number(json.parameters?.retry_after);
      if ((/Too Many Requests/i.test(description) || Number.isFinite(retryAfterSec)) && attempt < 2) {
        await sleep(((Number.isFinite(retryAfterSec) ? retryAfterSec : 2) + 1) * 1000);
        continue;
      }
      throw new Error(`Telegram API ${method} failed: ${description}`);
    }

    return json.result;
  }

  throw new Error(`Telegram API ${method} failed: retry limit exceeded`);
}

function extractInlineRows(extra: Record<string, unknown>) {
  const replyMarkup = extra.reply_markup as { inline_keyboard?: unknown } | undefined;
  const rows = replyMarkup?.inline_keyboard;
  return Array.isArray(rows) ? rows : [];
}

export async function clearLastInlineKeyboard(token: string, chatId: number) {
  const lastMessageId = lastInlineMessageByChatId.get(chatId);
  if (!lastMessageId) return;
  try {
    await callTelegramApi(token, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: lastMessageId,
      reply_markup: { inline_keyboard: [] },
    });
  } catch {
    // ignore cleanup errors
  } finally {
    lastInlineMessageByChatId.delete(chatId);
  }
}

export async function sendMessage(token: string, chatId: number, text: string, extra: Record<string, unknown> = {}) {
  await clearLastInlineKeyboard(token, chatId);
  const result = await callTelegramApi(token, "sendMessage", { chat_id: chatId, text, ...extra }) as { message_id?: number };
  const inlineRows = extractInlineRows(extra);
  if (inlineRows.length > 0 && Number(result?.message_id)) {
    lastInlineMessageByChatId.set(chatId, Number(result.message_id));
  } else {
    lastInlineMessageByChatId.delete(chatId);
  }
  return result;
}

export async function sendPhoto(token: string, chatId: number, photo: string, caption: string, extra: Record<string, unknown> = {}) {
  await clearLastInlineKeyboard(token, chatId);
  const result = await callTelegramApi(token, "sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    ...extra,
  }) as { message_id?: number };
  const inlineRows = extractInlineRows(extra);
  if (inlineRows.length > 0 && Number(result?.message_id)) {
    lastInlineMessageByChatId.set(chatId, Number(result.message_id));
  } else {
    lastInlineMessageByChatId.delete(chatId);
  }
  return result;
}

export async function sendPhotoFile(token: string, chatId: number, filePath: string, caption: string, extra: Record<string, unknown> = {}) {
  await clearLastInlineKeyboard(token, chatId);
  const fileBuffer = await readFile(filePath);
  const result = await callTelegramApiMultipart(
    token,
    "sendPhoto",
    {
      chat_id: chatId,
      caption,
      ...extra,
    },
    "photo",
    filePath.split(/[\\/]/).pop() ?? "photo.png",
    fileBuffer,
  ) as { message_id?: number };
  const inlineRows = extractInlineRows(extra);
  if (inlineRows.length > 0 && Number(result?.message_id)) {
    lastInlineMessageByChatId.set(chatId, Number(result.message_id));
  } else {
    lastInlineMessageByChatId.delete(chatId);
  }
  return result;
}

export async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  await callTelegramApi(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}
