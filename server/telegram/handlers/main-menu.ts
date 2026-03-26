import {
  ADMIN_MENU_REPLY_MARKUP,
  BANK_MENU_REPLY_MARKUP,
  buildMainMenuReplyMarkup,
  CITY_MENU_REPLY_MARKUP,
  EXTRAS_MENU_REPLY_MARKUP,
  MAIN_MENU_REPLY_MARKUP,
} from "../keyboards/main";
import { sendMessage } from "../transport";

/**
 * Shared menu senders extracted from the legacy monolith.
 * They keep the exact keyboard behavior while reducing coupling in telegram.ts.
 */
export async function sendWithMainKeyboard(input: {
  token: string;
  chatId: number;
  text: string;
  getUserIdByTelegramId: (telegramId: string) => string | undefined;
  getTutorialSnapshotByUser: (userId: string) => Promise<{ state: { isCompleted: boolean } }>;
  getPlayerHubLocation?: (userId: string) => "home" | "city" | "company";
  getPlayerCompanyContext?: (userId: string) => Promise<{ role?: string | null } | null>;
  buildCompanyReplyMarkup?: (role?: string | null, chatId?: number) => unknown;
}) {
  const {
    token,
    chatId,
    text,
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
    getPlayerHubLocation,
    getPlayerCompanyContext,
    buildCompanyReplyMarkup,
  } = input;
  let replyMarkup = MAIN_MENU_REPLY_MARKUP;
  try {
    const userId = getUserIdByTelegramId(String(chatId));
    if (userId) {
      if (getPlayerHubLocation) {
        const location = getPlayerHubLocation(userId);
        if (location === "city") {
          replyMarkup = CITY_MENU_REPLY_MARKUP;
          await sendMessage(token, chatId, text, { reply_markup: replyMarkup });
          return;
        }
        if (location === "company" && getPlayerCompanyContext && buildCompanyReplyMarkup) {
          const membership = await getPlayerCompanyContext(userId);
          await sendMessage(token, chatId, text, {
            reply_markup: buildCompanyReplyMarkup(membership?.role ?? null, chatId),
          });
          return;
        }
      }
      const tutorialSnapshot = await getTutorialSnapshotByUser(userId);
      replyMarkup = buildMainMenuReplyMarkup(!tutorialSnapshot.state.isCompleted);
    }
  } catch {
    replyMarkup = MAIN_MENU_REPLY_MARKUP;
  }
  await sendMessage(token, chatId, text, { reply_markup: replyMarkup });
}

export async function sendWithExtrasKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: EXTRAS_MENU_REPLY_MARKUP });
}

export async function sendWithCityHubKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: CITY_MENU_REPLY_MARKUP });
}

export async function sendWithAdminKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: ADMIN_MENU_REPLY_MARKUP });
}

export async function sendWithBankKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, { reply_markup: BANK_MENU_REPLY_MARKUP });
}

export async function sendWithCurrentHubKeyboard(input: {
  token: string;
  chatId: number;
  userId: string;
  text: string;
  getPlayerHubLocation: (userId: string) => "home" | "city" | "company";
  getPlayerCompanyContext: (userId: string) => Promise<{ role?: string | null } | null>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendWithMainKeyboard: (input: {
    token: string;
    chatId: number;
    text: string;
    getUserIdByTelegramId: (telegramId: string) => string | undefined;
    getTutorialSnapshotByUser: (userId: string) => Promise<{ state: { isCompleted: boolean } }>;
  }) => Promise<void>;
  getUserIdByTelegramId: (telegramId: string) => string | undefined;
  getTutorialSnapshotByUser: (userId: string) => Promise<{ state: { isCompleted: boolean } }>;
}) {
  const {
    token,
    chatId,
    userId,
    text,
    getPlayerHubLocation,
    getPlayerCompanyContext,
    buildCompanyReplyMarkup,
    sendWithMainKeyboard: sendMain,
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
  } = input;

  const location = getPlayerHubLocation(userId);
  if (location === "city") {
    await sendWithCityHubKeyboard(token, chatId, text);
    return;
  }
  if (location === "company") {
    const membership = await getPlayerCompanyContext(userId);
    await sendMessage(token, chatId, text, {
      reply_markup: buildCompanyReplyMarkup(membership?.role ?? null, chatId),
    });
    return;
  }
  await sendMain({
    token,
    chatId,
    text,
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
  });
}
