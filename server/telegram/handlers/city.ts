/**
 * City navigation and primary city activities extracted from telegram.ts.
 * Keeps current command texts, travel and pendingAction behavior unchanged.
 */
export async function handleCityMessage(input: {
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
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, intent: any) => Promise<boolean>;
  getPlayerHubLocation: (userId: string) => any;
  forceReturnHome: (token: string, chatId: number, player: any, message: any, reason: string) => Promise<void>;
  getHousingTravelDurationMs: (user: any, baseMs: number) => number;
  TRAVEL_TO_CITY_MS: number;
  setPlayerHubLocation: (userId: string, location: any) => void;
  sendCityHubSummary: (token: string, chatId: number, userId: string, prefix?: string) => Promise<void>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  grantStarterHousing: (userId: string) => Promise<any>;
  getActiveHousing: (user: any) => any;
  getStarterHousingForCity: (city: string) => any;
  rememberTelegramMenu: (userId: string, state: any) => void;
  sendWithCityHubKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  sendHousingCard: (token: string, chatId: number, user: any, house: any, prefix?: string) => Promise<void>;
  formatHousingMenuText: (user: any) => string;
  pendingActionByChatId: Map<number, any>;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  resolveEducationLevel: (raw: string, level: number) => any;
  sendMessage: (token: string, chatId: number, text: string, options?: Record<string, unknown>) => Promise<any>;
  formatEducationCoursesMenu: (player: any, levelKey: any) => string;
  buildEducationCoursesReplyMarkup: (levelKey: any) => any;
  formatEducationLevelsMenu: (player: any) => string;
  buildEducationLevelsReplyMarkup: (level: number) => any;
  resolveTelegramSnapshot: (from: any) => Promise<any>;
  listJobsByCity: (city: string, professionId?: any, level?: number) => any[];
  getPlayerProfessionId: (user: any) => any;
  formatJobsMenu: (snapshot: any) => string;
  buildJobsInlineMarkup: (snapshot: any) => any;
  runJobSelection: (token: string, chatId: number, player: any, ref: string) => Promise<{ ok: true } | { ok: false; message: string }>;
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
    ensureExclusiveActionAllowed,
    getPlayerHubLocation,
    forceReturnHome,
    getHousingTravelDurationMs,
    TRAVEL_TO_CITY_MS,
    setPlayerHubLocation,
    sendCityHubSummary,
    ensureCityHubAccess,
    grantStarterHousing,
    getActiveHousing,
    getStarterHousingForCity,
    rememberTelegramMenu,
    sendWithCityHubKeyboard,
    sendHousingCard,
    formatHousingMenuText,
    pendingActionByChatId,
    sendWithCurrentHubKeyboard,
    resolveEducationLevel,
    sendMessage,
    formatEducationCoursesMenu,
    buildEducationCoursesReplyMarkup,
    formatEducationLevelsMenu,
    buildEducationLevelsReplyMarkup,
    resolveTelegramSnapshot,
    listJobsByCity,
    getPlayerProfessionId,
    formatJobsMenu,
    buildJobsInlineMarkup,
    runJobSelection,
  } = input;

  if (command === "/city_hub") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const activeTravel = playerTravelByUserId.get(player.id);
    if (activeTravel) {
      const secondsLeft = getTravelRemainingSeconds(player.id);
      await sendWithMainKeyboard(token, chatId, `🚶 Вы уже в пути в ${formatTravelTargetLabel(activeTravel.target)}. Осталось ~${secondsLeft} сек.`);
      return true;
    }
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "travel"))) {
      return true;
    }

    const currentLocation = getPlayerHubLocation(player.id);
    if (currentLocation === "company") {
      await forceReturnHome(token, chatId, player, message, "⛔ Из компании нельзя сразу перейти в город.");
      return true;
    }

    if (currentLocation === "home") {
      const travelMs = getHousingTravelDurationMs(player, TRAVEL_TO_CITY_MS);
      const arrivesAtMs = Date.now() + travelMs;
      await sendWithMainKeyboard(token, chatId, `🚶 Вы вышли из дома в город. Прибытие через ${Math.ceil(travelMs / 1000)} сек.`);
      const timer = setTimeout(async () => {
        try {
          const state = playerTravelByUserId.get(player.id);
          if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "city") return;
          playerTravelByUserId.delete(player.id);
          setPlayerHubLocation(player.id, "city");
          await sendCityHubSummary(token, state.chatId, player.id, "✅ Вы прибыли в город.");
        } catch (error) {
          console.error("Travel to city completion error:", error);
        }
      }, travelMs);
      playerTravelByUserId.set(player.id, { target: "city", arrivesAtMs, timer, chatId });
      return true;
    }

    setPlayerHubLocation(player.id, "city");
    await sendCityHubSummary(token, chatId, player.id);
    return true;
  }

  if (command === "/housing") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    const refreshedUser = await grantStarterHousing(player.id);
    const activeHouse = getActiveHousing(refreshedUser) ?? getStarterHousingForCity(refreshedUser.city);
    rememberTelegramMenu(player.id, { menu: "housing" });
    if (!activeHouse) {
      await sendWithCityHubKeyboard(token, chatId, "🏘 Недвижимость в этом городе пока закрыта.");
      return true;
    }
    await sendHousingCard(token, chatId, refreshedUser, activeHouse, formatHousingMenuText(refreshedUser));
    return true;
  }

  if (command === "/study") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "study"))) {
      return true;
    }
    const requestedLevel = args.join(" ").trim();
    if (requestedLevel) {
      const levelKey = resolveEducationLevel(requestedLevel, player.level);
      if (!levelKey) {
        await sendWithCurrentHubKeyboard(token, chatId, player.id, "❌ Этот уровень обучения недоступен.");
        return true;
      }
      pendingActionByChatId.set(chatId, { type: "study_course_select", levelKey });
      rememberTelegramMenu(player.id, { menu: "study_courses", levelKey });
      await sendMessage(token, chatId, formatEducationCoursesMenu(player, levelKey), {
        reply_markup: buildEducationCoursesReplyMarkup(levelKey),
      });
      return true;
    }

    pendingActionByChatId.set(chatId, { type: "study_level_select" });
    rememberTelegramMenu(player.id, { menu: "study_levels" });
    await sendMessage(token, chatId, formatEducationLevelsMenu(player), {
      reply_markup: buildEducationLevelsReplyMarkup(player.level),
    });
    return true;
  }

  if (command === "/jobs") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "job"))) {
      return true;
    }
    const snapshot = await resolveTelegramSnapshot(message.from);
    const jobsCount = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level).length;
    if (jobsCount <= 0) {
      pendingActionByChatId.delete(chatId);
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "В вашем городе нет вакансий.");
      return true;
    }
    pendingActionByChatId.set(chatId, { type: "job_select" });
    rememberTelegramMenu(player.id, { menu: "jobs" });
    await sendMessage(token, chatId, formatJobsMenu(snapshot), { reply_markup: buildJobsInlineMarkup(snapshot) });
    return true;
  }

  if (command === "/job") {
    const ref = args.join(" ").trim();
    if (!ref) {
      const player = await resolveOrCreateTelegramPlayer(message.from);
      const snapshot = await resolveTelegramSnapshot(message.from);
      const jobsCount = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level).length;
      if (jobsCount <= 0) {
        await sendWithCurrentHubKeyboard(token, chatId, player.id, "В вашем городе нет вакансий.");
        return true;
      }
      pendingActionByChatId.set(chatId, { type: "job_select" });
      rememberTelegramMenu(player.id, { menu: "jobs" });
      await sendMessage(token, chatId, formatJobsMenu(snapshot), { reply_markup: buildJobsInlineMarkup(snapshot) });
      return true;
    }
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "job"))) {
      return true;
    }
    const result = await runJobSelection(token, chatId, player, ref);
    if (!result.ok) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${result.message}\nОткрой вакансии ещё раз и выбери подходящую кнопку.`);
    }
    return true;
  }

  return false;
}
