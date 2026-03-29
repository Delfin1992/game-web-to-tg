/**
 * Profile and meta/home-adjacent command handler extracted from telegram.ts.
 * Keeps command routing stable while presenting profile/helpful meta screens.
 */
export async function handleProfileMetaMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  playerTravelByUserId: Map<string, any>;
  getTravelRemainingSeconds: (userId: string) => number;
  formatTravelTargetLabel: (target: any) => string;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  getPlayerHubLocation: (userId: string) => any;
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, intent: any) => Promise<boolean>;
  resolveTelegramSnapshot: (from: any) => Promise<any>;
  setPlayerHubLocation: (userId: string, location: any) => void;
  clearPlayerTravel: (userId: string) => void;
  TRAVEL_TO_CITY_MS: number;
  TRAVEL_TO_COMPANY_MS: number;
  formatNotices: (notices: string[]) => string;
  formatPlayerProfile: (snapshot: any) => Promise<string>;
  getProfessionById: (id: string) => any;
  getPlayerProfessionId: (user: any) => string | null;
  PROFESSION_UNLOCK_LEVEL: number;
  buildProfessionSelectText: () => string;
  buildProfessionSelectInlineMarkup: () => any;
  sendMessage: (token: string, chatId: number, text: string, options?: Record<string, unknown>) => Promise<any>;
  rememberTelegramMenu: (userId: string, state: any) => void;
  formatReferralMenu: (player: any) => Promise<string>;
  sendWithExtrasKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  formatReputationMenu: (player: any) => string;
  formatWeeklyQuestMenu: (player: any) => any;
  buildQuestInlineButtons: (canClaim: boolean) => any;
  claimWeeklyQuestReward: (userId: string) => Promise<any>;
  getUserWithGameState: (userId: string) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  extractErrorMessage: (error: unknown) => string;
  sendTutorialMenu: (token: string, chatId: number, userId: string) => Promise<void>;
  isRatingEntityToken: (value?: string) => boolean;
  normalizeRatingEntity: (value?: string) => any;
  formatRatingMenu: (entity: any, sortArg?: any) => Promise<any>;
  buildRatingInlineButtons: (entity: any, sort: any) => any;
}) {
  const {
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    playerTravelByUserId,
    getTravelRemainingSeconds,
    formatTravelTargetLabel,
    sendWithMainKeyboard,
    getPlayerHubLocation,
    ensureExclusiveActionAllowed,
    resolveTelegramSnapshot,
    setPlayerHubLocation,
    clearPlayerTravel,
    TRAVEL_TO_CITY_MS,
    TRAVEL_TO_COMPANY_MS,
    formatNotices,
    formatPlayerProfile,
    getProfessionById,
    getPlayerProfessionId,
    PROFESSION_UNLOCK_LEVEL,
    buildProfessionSelectText,
    buildProfessionSelectInlineMarkup,
    sendMessage,
    rememberTelegramMenu,
    formatReferralMenu,
    sendWithExtrasKeyboard,
    formatReputationMenu,
    formatWeeklyQuestMenu,
    buildQuestInlineButtons,
    claimWeeklyQuestReward,
    getUserWithGameState,
    getCurrencySymbol,
    extractErrorMessage,
    sendTutorialMenu,
    isRatingEntityToken,
    normalizeRatingEntity,
    formatRatingMenu,
    buildRatingInlineButtons,
  } = input;

  if (command === "/profile" || command === "/me" || command === "/status") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
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
      await sendWithMainKeyboard(token, chatId, `🚶 Вы отправились домой. Прибытие через ${travelSec} сек.`);
      const timer = setTimeout(async () => {
        try {
          const state = playerTravelByUserId.get(player.id);
          if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "home") return;
          playerTravelByUserId.delete(player.id);
          setPlayerHubLocation(player.id, "home");
          const snapshot = await resolveTelegramSnapshot(message.from);
          const notices = formatNotices(snapshot.notices);
          const base = await formatPlayerProfile(snapshot);
          await sendWithMainKeyboard(token, state.chatId, `✅ Вы вернулись домой.\n\n${notices ? `${base}\n\n${notices}` : base}`);
        } catch (error) {
          console.error("Travel to home completion error:", error);
        }
      }, travelMs);
      playerTravelByUserId.set(player.id, { target: "home", arrivesAtMs, timer, chatId });
      return true;
    }

    clearPlayerTravel(player.id);
    setPlayerHubLocation(player.id, "home");
    const snapshot = await resolveTelegramSnapshot(message.from);
    const notices = formatNotices(snapshot.notices);
    const base = await formatPlayerProfile(snapshot);
    await sendWithMainKeyboard(token, chatId, notices ? `${base}\n\n${notices}` : base);
    return true;
  }

  if (command === "/profession") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const currentProfession = getProfessionById(getPlayerProfessionId(player) || "");
    if (currentProfession) {
      const skillLabels: Record<string, string> = {
        coding: "Кодинг",
        testing: "Тестирование",
        analytics: "Аналитика",
        design: "Дизайн",
        attention: "Внимание",
        drawing: "Рисование",
        modeling: "3D-моделирование",
      };
      const skillBonusLines = Object.entries(currentProfession.pvpBonuses?.skillMultipliers || {})
        .filter(([, multiplier]) => Number(multiplier || 1) > 1)
        .map(([skill, multiplier]) => `• PvP: ${skillLabels[skill] ?? skill} +${Math.round((Number(multiplier) - 1) * 100)}%`);
      const roundBonusLines = Object.entries(currentProfession.pvpBonuses?.roundMultipliers || {})
        .filter(([, multiplier]) => Number(multiplier || 1) > 1)
        .map(([round, multiplier]) => {
          const roundLabel = round === "concept" ? "Проектирование" : round === "core" ? "Разработка" : "Отладка";
          return `• Раунд «${roundLabel}»: +${Math.round((Number(multiplier) - 1) * 100)}%`;
        });

      await sendWithMainKeyboard(
        token,
        chatId,
        [
          `🎓 Текущая профессия: ${currentProfession.emoji} ${currentProfession.name}`,
          currentProfession.subtitle,
          currentProfession.summary,
          "",
          "Твои бонусы:",
          ...skillBonusLines,
          ...roundBonusLines,
          `• Профильный cap: ${skillLabels[currentProfession.skillCapBonus.skill] ?? currentProfession.skillCapBonus.skill} до +${Math.round((Number(currentProfession.skillCapBonus.multiplier) - 1) * 100)}%`,
        ].join("\n"),
      );
      return true;
    }

    if (player.level < PROFESSION_UNLOCK_LEVEL) {
      await sendWithMainKeyboard(token, chatId, `🎓 Профессия откроется на ${PROFESSION_UNLOCK_LEVEL} уровне.`);
      return true;
    }

    await sendMessage(token, chatId, buildProfessionSelectText(), {
      reply_markup: buildProfessionSelectInlineMarkup(),
    });
    return true;
  }

  if (command === "/ref" || command === "/referral") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    rememberTelegramMenu(player.id, { menu: "extras" });
    await sendWithExtrasKeyboard(token, chatId, await formatReferralMenu(player));
    return true;
  }

  if (command === "/reputation" || command === "/rep") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    await sendMessage(token, chatId, formatReputationMenu(player), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗓 Квесты", callback_data: "quest:refresh" }, { text: "🏆 Рейтинг", callback_data: "quest:rating" }],
        ],
      },
    });
    return true;
  }

  if (command === "/quests" || command === "/quest") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const questView = formatWeeklyQuestMenu(player);
    await sendMessage(token, chatId, questView.text, {
      reply_markup: buildQuestInlineButtons(questView.canClaim),
    });
    return true;
  }

  if (command === "/quest_claim") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      const claimed = await claimWeeklyQuestReward(player.id);
      const snapshot = await getUserWithGameState(player.id);
      const questView = formatWeeklyQuestMenu(claimed.user);
      const lines = [
        "🎃 Награда за недельный квест получена!",
        `+${getCurrencySymbol(claimed.user.city)}${claimed.rewardMoney}, +${claimed.rewardExp} XP, +${claimed.rewardReputation} репутации`,
      ];
      if (snapshot) {
        lines.push("", await formatPlayerProfile(snapshot));
      }
      await sendMessage(token, chatId, lines.join("\n"), {
        reply_markup: buildQuestInlineButtons(questView.canClaim),
      });
    } catch (error) {
      await sendWithMainKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/tutorial" || command === "/onboarding") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      await sendTutorialMenu(token, chatId, player.id);
    } catch (error) {
      await sendWithMainKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/rating" || command === "/top") {
    const firstArg = args[0];
    const entity = isRatingEntityToken(firstArg) ? normalizeRatingEntity(firstArg) : "players";
    const sortArg = isRatingEntityToken(firstArg) ? args[1] : firstArg;
    const ratingMenu = await formatRatingMenu(entity, sortArg);
    await sendMessage(token, chatId, ratingMenu.text, {
      reply_markup: buildRatingInlineButtons(ratingMenu.entity, ratingMenu.sort),
    });
    return true;
  }

  return false;
}
