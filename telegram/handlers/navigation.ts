/**
 * Top-level navigation and entry commands extracted from telegram.ts.
 * Keeps command texts and side effects unchanged while reducing the size
 * of the legacy message router.
 */
export async function handleNavigationMessage(input: {
  command: string;
  args: string[];
  token: string;
  webAppUrl: string;
  chatId: number;
  message: any;
  player: any;
  pendingActionByChatId: Map<number, any>;
  playerTravelByUserId: Map<string, any>;
  getTravelRemainingSeconds: (userId: string) => number;
  formatTravelTargetLabel: (target: any) => string;
  getPlayerHubLocation: (userId: string) => any;
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, intent: any) => Promise<boolean>;
  TRAVEL_TO_CITY_MS: number;
  TRAVEL_TO_COMPANY_MS: number;
  setPlayerHubLocation: (userId: string, location: any) => void;
  clearPlayerTravel: (userId: string) => void;
  resolveTelegramRegistrationStep: (player: any, chatId: number) => any;
  beginTelegramRegistration: (token: string, chatId: number, player: any, payload?: string, forcedStep?: any) => Promise<void>;
  applyReferralFromStartPayload: (player: any, payload: string) => Promise<any>;
  resolveTelegramSnapshot: (from: any) => Promise<any>;
  formatPlayerProfile: (snapshot: any) => Promise<string>;
  buildWelcomeMessage: (from: any) => string;
  canUseTelegramWebAppButton: (webAppUrl: string) => boolean;
  sendMessage: (token: string, chatId: number, text: string, options?: Record<string, unknown>) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  REFERRAL_NEW_PLAYER_REWARD: number;
  REFERRAL_INVITER_REWARD: number;
  getTelegramIdByUserId: (userId: string) => string | undefined;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  restoreTelegramMenuState: (token: string, chatId: number, player: any, message: any, prefix?: string) => Promise<void>;
  formatNotices: (notices: string[]) => string;
  buildBotModeMessage: (snapshot: any) => Promise<string>;
  sendHomeMenu: (token: string, chatId: number, snapshot: any, userId: string, prefix?: string) => Promise<void>;
  rememberTelegramMenu: (userId: string, state: any) => void;
  sendWithExtrasKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  formatAuctionSection: (userId: string, chatId: number) => Promise<string>;
  buildAuctionInlineMarkup: (userId: string, chatId: number) => Promise<any>;
  resolveCityName: (raw: string) => string | null;
  isCityTemporarilyAvailable: (city: string) => boolean;
  CITY_CAPACITY_MESSAGE: string;
  CITY_REPLY_MARKUP: any;
  storage: {
    updateUser: (userId: string, patch: Record<string, unknown>) => Promise<any>;
  };
}) {
  const {
    command,
    args,
    token,
    webAppUrl,
    chatId,
    message,
    player,
    pendingActionByChatId,
    playerTravelByUserId,
    getTravelRemainingSeconds,
    formatTravelTargetLabel,
    getPlayerHubLocation,
    ensureExclusiveActionAllowed,
    TRAVEL_TO_CITY_MS,
    TRAVEL_TO_COMPANY_MS,
    setPlayerHubLocation,
    clearPlayerTravel,
    resolveTelegramRegistrationStep,
    beginTelegramRegistration,
    applyReferralFromStartPayload,
    resolveTelegramSnapshot,
    formatPlayerProfile,
    buildWelcomeMessage,
    canUseTelegramWebAppButton,
    sendMessage,
    getCurrencySymbol,
    REFERRAL_NEW_PLAYER_REWARD,
    REFERRAL_INVITER_REWARD,
    getTelegramIdByUserId,
    sendWithMainKeyboard,
    restoreTelegramMenuState,
    formatNotices,
    buildBotModeMessage,
    sendHomeMenu,
    rememberTelegramMenu,
    sendWithExtrasKeyboard,
    ensureCityHubAccess,
    formatAuctionSection,
    buildAuctionInlineMarkup,
    resolveCityName,
    isCityTemporarilyAvailable,
    CITY_CAPACITY_MESSAGE,
    CITY_REPLY_MARKUP,
    storage,
  } = input;

  if (command === "/start") {
    const payload = args[0] ?? "";
    const startRegistrationStep = resolveTelegramRegistrationStep(player, chatId);
    if (startRegistrationStep) {
      await beginTelegramRegistration(token, chatId, player, payload, startRegistrationStep);
      return true;
    }
    const referralResult = await applyReferralFromStartPayload(player, payload);
    const snapshot = await resolveTelegramSnapshot(message.from);
    const profileText = await formatPlayerProfile(snapshot);
    const referralNotice =
      referralResult?.status === "applied"
        ? `\n\n🎁 Реферальный бонус начислен: +${getCurrencySymbol(snapshot.user.city)}${REFERRAL_NEW_PLAYER_REWARD}`
        : referralResult?.status === "self"
          ? "\n\n⚠️ Нельзя активировать собственную реферальную ссылку."
          : referralResult?.status === "already"
            ? "\n\nℹ️ Реферальная ссылка уже была активирована ранее."
            : referralResult?.status === "invalid"
              ? "\n\n⚠️ Реферальный код не найден."
              : "";
    const intro = `${buildWelcomeMessage(message.from)}${referralNotice}\n\n${profileText}`;
    if (canUseTelegramWebAppButton(webAppUrl)) {
      const startAppUrl = `${webAppUrl}?tgStart=${encodeURIComponent(payload)}`;
      await sendMessage(token, chatId, intro, {
        reply_markup: { inline_keyboard: [[{ text: "🚀 Открыть игру (Mini App)", web_app: { url: startAppUrl } }]] },
      });
    } else {
      await sendMessage(token, chatId, `${intro}\n\n⚠️ Mini App не настроен: TELEGRAM_WEBAPP_URL должен быть HTTPS.`);
    }

    if (referralResult?.status === "applied") {
      const inviterTelegramId = getTelegramIdByUserId(referralResult.inviter.id);
      const inviterChatId = Number(inviterTelegramId);
      if (Number.isFinite(inviterChatId) && inviterChatId !== chatId) {
        try {
          await sendMessage(
            token,
            inviterChatId,
            [
              "🎉 Новый реферал зашёл в игру по твоей ссылке!",
              `👤 Игрок: ${snapshot.user.username}`,
              `💰 Бонус: +${getCurrencySymbol(referralResult.inviter.city)}${REFERRAL_INVITER_REWARD}`,
              `💼 Текущий баланс: ${getCurrencySymbol(referralResult.inviter.city)}${referralResult.inviter.balance}`,
            ].join("\n"),
          );
        } catch (error) {
          console.warn("⚠️ Не удалось отправить уведомление рефереру:", error);
        }
      }
    }

    await restoreTelegramMenuState(token, chatId, player, message, "Для текстовой версии игры отправь: /starttg");
    return true;
  }

  if (command === "/starttg") {
    const startTgRegistrationStep = resolveTelegramRegistrationStep(player, chatId);
    if (startTgRegistrationStep) {
      await beginTelegramRegistration(token, chatId, player, undefined, startTgRegistrationStep);
      return true;
    }
    pendingActionByChatId.delete(chatId);
    await restoreTelegramMenuState(token, chatId, player, message);
    return true;
  }

  if (command === "/menu") {
    const activeTravel = playerTravelByUserId.get(player.id);
    if (activeTravel) {
      const secondsLeft = getTravelRemainingSeconds(player.id);
      await sendWithMainKeyboard(token, chatId, `🚶 Вы уже в пути в ${formatTravelTargetLabel(activeTravel.target)}. Осталось ~${secondsLeft} сек.`);
      return true;
    }

    const currentLocation = getPlayerHubLocation(player.id);
    if (currentLocation !== "home") {
      if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "travel"))) {
        return true;
      }
      const travelMs = currentLocation === "city" ? TRAVEL_TO_CITY_MS : TRAVEL_TO_COMPANY_MS;
      const travelSec = Math.ceil(travelMs / 1000);
      const arrivesAtMs = Date.now() + travelMs;
      await sendWithMainKeyboard(token, chatId, `🚶 Возвращаемся в главное меню (дом). Прибытие через ${travelSec} сек.`);
      const timer = setTimeout(async () => {
        try {
          const state = playerTravelByUserId.get(player.id);
          if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "home") return;
          playerTravelByUserId.delete(player.id);
          setPlayerHubLocation(player.id, "home");
          const snapshot = await resolveTelegramSnapshot(message.from);
          await sendHomeMenu(token, state.chatId, snapshot, player.id, "✅ Вы вернулись домой.");
        } catch (error) {
          console.error("Travel to home (menu) completion error:", error);
        }
      }, travelMs);
      playerTravelByUserId.set(player.id, { target: "home", arrivesAtMs, timer, chatId });
      return true;
    }

    clearPlayerTravel(player.id);
    setPlayerHubLocation(player.id, "home");
    pendingActionByChatId.delete(chatId);
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHomeMenu(token, chatId, snapshot, player.id);
    return true;
  }

  if (command === "/extras") {
    rememberTelegramMenu(player.id, { menu: "extras" });
    await sendWithExtrasKeyboard(
      token,
      chatId,
      [
        "🧩 Допы",
        "• Рейтинг",
        "• Квесты",
        "• Репутация",
        "• Рефералы",
      ].join("\n"),
    );
    return true;
  }

  if (command === "/auction") {
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    await sendMessage(token, chatId, await formatAuctionSection(player.id, chatId), {
      reply_markup: await buildAuctionInlineMarkup(player.id, chatId),
    });
    return true;
  }

  if (command === "/city") {
    const nextCity = args.join(" ").trim();
    if (!nextCity) {
      pendingActionByChatId.set(chatId, { type: "change_city" });
      await sendMessage(token, chatId, `Выбери город:\n1) Сан-Франциско\n\n${CITY_CAPACITY_MESSAGE}`, { reply_markup: CITY_REPLY_MARKUP });
      return true;
    }
    const resolvedCity = resolveCityName(nextCity);
    if (!resolvedCity) {
      pendingActionByChatId.set(chatId, { type: "change_city" });
      await sendMessage(token, chatId, "Не понял город. Выбери из списка:\n1) Сан-Франциско", { reply_markup: CITY_REPLY_MARKUP });
      return true;
    }
    if (!isCityTemporarilyAvailable(resolvedCity)) {
      pendingActionByChatId.set(chatId, { type: "change_city" });
      await sendMessage(token, chatId, CITY_CAPACITY_MESSAGE, { reply_markup: CITY_REPLY_MARKUP });
      return true;
    }
    await storage.updateUser(player.id, { city: resolvedCity });
    pendingActionByChatId.delete(chatId);
    const snapshot = await resolveTelegramSnapshot(message.from);
    const profileText = await formatPlayerProfile(snapshot);
    const base = `🏙 Город обновлён: ${snapshot.user.city}\n\n${profileText}`;
    const notices = formatNotices(snapshot.notices);
    await sendWithMainKeyboard(token, chatId, notices ? `${base}\n\n${notices}` : base);
    return true;
  }

  return false;
}
