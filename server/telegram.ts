import type { Server } from "http";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function callTelegramApi(token: string, method: string, body: Record<string, unknown>) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram API ${method} failed (${response.status}): ${text}`);
  }

  const json = await response.json();
  if (!json.ok) {
    throw new Error(`Telegram API ${method} failed: ${json.description || "unknown error"}`);
  }

  return json.result;
}

function buildWelcomeMessage(webAppUrl: string, user?: TelegramUser) {
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "игрок";
  return [
    `Привет, ${displayName}!`,
    "Запускай CyberProtocol как Telegram Mini App:",
    "",
    "• единый аккаунт в Telegram и веб-версии",
    "• общий прогресс между устройствами",
    "• мультиплатформенная игра в одном мире",
  ].join("\n");
}

export function startTelegramBot(httpServer: Server) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("ℹ️ TELEGRAM_BOT_TOKEN не задан — Telegram бот не запущен");
    return;
  }

  const webAppUrl = trimTrailingSlash(process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || "http://localhost:5000");

  let stopped = false;
  let offset = 0;

  const poll = async () => {
    if (stopped) return;

    try {
      const updates: Array<any> = await callTelegramApi(token, "getUpdates", {
        timeout: 25,
        offset,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);

        const message = update.message;
        if (!message?.chat?.id || typeof message.text !== "string") continue;

        const text = message.text.trim();
        const isStart = text.startsWith("/start");
        if (!isStart) continue;

        const payload = text.split(" ")[1] ?? "";
        const startAppUrl = `${webAppUrl}?tgStart=${encodeURIComponent(payload)}`;

        await callTelegramApi(token, "sendMessage", {
          chat_id: message.chat.id,
          text: buildWelcomeMessage(webAppUrl, message.from),
          reply_markup: {
            inline_keyboard: [[{ text: "🚀 Открыть игру", web_app: { url: startAppUrl } }]],
          },
        });
      }
    } catch (error) {
      console.error("⚠️ Telegram polling error:", error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    setImmediate(poll);
  };

  poll();

  const stop = () => {
    stopped = true;
  };

  httpServer.on("close", stop);
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log("✅ Telegram bot polling started");
}
