import { WEEKLY_HACKATHON_CONFIG, type HackathonDefenseType, type HackathonSabotageType } from "../../../shared/weekly-hackathon";
import { validateHackathonEligibility } from "../../weekly-hackathon";

const HACKATHON_MANAGER_ERROR = "Только CEO или заместитель могут использовать саботаж и защиту.";

const SABOTAGE_LABELS: Record<HackathonSabotageType, { emoji: string; title: string; effect: string }> = {
  system_overload: { emoji: "⚙️", title: "Перегруз системы", effect: "-15% на 45 сек" },
  dev_block: { emoji: "⛔", title: "Блок разработки", effect: "вклад = 0 на 25 сек" },
  destabilization: { emoji: "🎲", title: "Дестабилизация", effect: "случайно -10%...-30% на 60 сек" },
};

const DEFENSE_LABELS: Record<HackathonDefenseType, { emoji: string; title: string; effect: string }> = {
  stabilization: { emoji: "🛡", title: "Стабилизация", effect: "режет силу саботажа на 50%" },
  instant_rollback: { emoji: "⚡", title: "Мгновенный откат", effect: "полностью снимает саботаж в первые 10 сек" },
  preventive_shield: { emoji: "🧊", title: "Превентивная защита", effect: "30 сек ждёт атаку и режет её на 70%" },
};

function buildHackathonJoinInline(companyId: string) {
  return {
    inline_keyboard: [[{ text: "✅ Участвовать", callback_data: `hackathon:join_team:${companyId}` }]],
  };
}

function buildTargetSelectionMarkup(targets: Array<{ companyId: string; companyName: string }>) {
  return {
    inline_keyboard: [
      ...targets.map((target) => [{ text: target.companyName, callback_data: `sabotage_select_target:${target.companyId}` }]),
      [{ text: "← Назад", callback_data: "hackathon_back" }],
    ],
  };
}

function buildSabotageTypeMarkup(types: HackathonSabotageType[]) {
  return {
    inline_keyboard: [
      ...types.map((type) => [{
        text: `${SABOTAGE_LABELS[type].emoji} ${SABOTAGE_LABELS[type].title}`,
        callback_data: `sabotage_select_type:${type}`,
      }]),
      [{ text: "← Назад", callback_data: "hackathon:sabotage_menu" }],
    ],
  };
}

function buildSabotageConfirmMarkup(targetCompanyId: string, sabotageType: HackathonSabotageType) {
  return {
    inline_keyboard: [
      [{ text: "✅ Запустить", callback_data: `sabotage_confirm:${targetCompanyId}:${sabotageType}` }],
      [{ text: "← Назад", callback_data: `sabotage_select_target:${targetCompanyId}` }],
    ],
  };
}

function buildDefenseMarkup(types: HackathonDefenseType[]) {
  return {
    inline_keyboard: [
      ...types.map((type) => [{
        text: `${DEFENSE_LABELS[type].emoji} ${DEFENSE_LABELS[type].title}`,
        callback_data: `defense_use:${type}`,
      }]),
      [{ text: "← Назад", callback_data: "hackathon_back" }],
    ],
  };
}

function isHackathonRoundActive(state: any) {
  return state?.status === "round1" || state?.status === "round2" || state?.status === "round3";
}

function getHackathonRequirementsLines() {
  return [
    "Для участия в хакатоне требуется:",
    `• состоять в компании не менее ${WEEKLY_HACKATHON_CONFIG.eligibility.minMembershipDays} дней`,
    `• уровень не ниже ${WEEKLY_HACKATHON_CONFIG.eligibility.minLevel}`,
    `• минимум ${WEEKLY_HACKATHON_CONFIG.eligibility.minTotalPvpBattles} PvP боёв`,
    `• минимум ${WEEKLY_HACKATHON_CONFIG.eligibility.minRecentPvpBattles7d} PvP боя за последние 7 дней`,
  ];
}

async function countRecentPvpBattles7d(storage: any, userId: string) {
  const rows = await storage.getPvpDuelHistoryByUser(userId, 200);
  const sinceSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  return rows.filter((row: any) => Number(row.createdAt || 0) >= sinceSec).length;
}

async function resolveMembershipJoinDate(storage: any, userId: string, companyId: string) {
  const member = await storage.getMemberByUserId(companyId, userId);
  return Number(member?.createdAt || 0) || null;
}

async function getHackathonEligibilityForPlayer(storage: any, player: any, membership: any) {
  const membershipCreatedAt = await resolveMembershipJoinDate(storage, player.id, membership.company.id);
  const recentPvpBattles7d = await countRecentPvpBattles7d(storage, player.id);
  return validateHackathonEligibility({
    membershipCreatedAt,
    level: Number(player.level || 1),
    totalPvpBattles: Number(player.pvpMatches || 0),
    recentPvpBattles7d,
  });
}

function formatEligibilityFailureText(reasons: string[]) {
  return [
    "❌ Вы пока не можете участвовать в weekly hackathon.",
    "",
    ...reasons.map((reason) => `• ${reason}`),
    "",
    ...getHackathonRequirementsLines(),
  ].join("\n");
}

async function notifyRegisteredCompanyMembers(input: {
  token: string;
  storage: any;
  getTelegramIdByUserId: (userId: string) => string | null | undefined;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  companyId: string;
  companyName: string;
}) {
  const members = await input.storage.getCompanyMembers(input.companyId);
  const text = [
    "CEO зарегистрировал компанию в хакатоне!",
    `🏢 ${input.companyName}`,
    "",
    `Доступно ${WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany} мест для участия.`,
    "",
    ...getHackathonRequirementsLines(),
  ].join("\n");
  for (const member of members) {
    const telegramId = Number(input.getTelegramIdByUserId(member.userId) || 0);
    if (!telegramId) continue;
    await input.sendMessage(input.token, telegramId, text, {
      reply_markup: buildHackathonJoinInline(input.companyId),
    });
  }
}

async function joinHackathonTeam(input: {
  player: any;
  membership: any;
  storage: any;
  joinPlayerToWeeklyHackathonTeam: (input: { userId: string; username: string; companyId: string }) => any;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  token: string;
  chatId: number;
}) {
  const eligibility = await getHackathonEligibilityForPlayer(input.storage, input.player, input.membership);
  if (!eligibility.ok) {
    await input.sendWithCurrentHubKeyboard(input.token, input.chatId, input.player.id, formatEligibilityFailureText(eligibility.reasons));
    return { joined: false };
  }
  const joined = input.joinPlayerToWeeklyHackathonTeam({
    userId: input.player.id,
    username: String(input.player.username || "Игрок"),
    companyId: input.membership.company.id,
  });
  await input.sendWithCurrentHubKeyboard(
    input.token,
    input.chatId,
    input.player.id,
    [
      "✅ Ты записан в состав weekly hackathon.",
      `Компания: ${input.membership.company.name}`,
      `Участников: ${joined.participantCount}/${WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany}`,
      joined.closed ? "Состав заполнен." : `Свободно мест: ${joined.slotsLeft}`,
    ].join("\n"),
  );
  return { joined: true, result: joined };
}

async function editOrSend(input: {
  token: string;
  chatId: number;
  messageId?: number;
  callTelegramApi: (token: string, method: string, payload?: any) => Promise<any>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  text: string;
  replyMarkup?: any;
}) {
  if (input.messageId) {
    try {
      await input.callTelegramApi(input.token, "editMessageText", {
        chat_id: input.chatId,
        message_id: input.messageId,
        text: input.text,
        ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
      });
      return;
    } catch (error: any) {
      const message = String(error?.description || error?.message || "");
      if (!message.toLowerCase().includes("message is not modified")) {
        await input.sendMessage(input.token, input.chatId, input.text, input.replyMarkup ? { reply_markup: input.replyMarkup } : undefined);
        return;
      }
    }
  }
  await input.sendMessage(input.token, input.chatId, input.text, input.replyMarkup ? { reply_markup: input.replyMarkup } : undefined);
}

async function buildManagerSnapshot(input: {
  userId: string;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  storage: any;
  getWeeklyHackathonState: () => any;
  getWeeklyHackathonSabotageState: (companyId?: string) => any;
  getAvailableHackathonSabotageTypes: (companyId: string) => HackathonSabotageType[];
  getAvailableHackathonDefenseTypes: (companyId: string) => HackathonDefenseType[];
  isCompanyHackathonManagerRole: (role: string, ownerId: string | null | undefined, actorUserId: string) => boolean;
}) {
  const membership = await input.getPlayerCompanyContext(input.userId);
  if (!membership) throw new Error("Ты не состоишь в компании.");
  if (!input.isCompanyHackathonManagerRole(membership.role, membership.company.ownerId, input.userId)) {
    throw new Error(HACKATHON_MANAGER_ERROR);
  }
  const company = await input.storage.getCompany(String(membership.company.id));
  if (!company) throw new Error("Компания не найдена.");
  const state = input.getWeeklyHackathonState();
  const registered = (Array.isArray(state.registeredCompanies) ? state.registeredCompanies : []).find((row: any) => row.companyId === membership.company.id) || null;
  const sabotageState = input.getWeeklyHackathonSabotageState(membership.company.id);
  const targets = (Array.isArray(state.registeredCompanies) ? state.registeredCompanies : [])
    .filter((row: any) => row.companyId !== membership.company.id)
    .map((row: any) => ({
      companyId: String(row.companyId),
      companyName: String(row.companyName || "Компания"),
      score: Number(row.score || 0),
    }));
  return {
    membership,
    company,
    state,
    registered,
    sabotageState,
    targets,
    sabotageTypes: registered ? input.getAvailableHackathonSabotageTypes(String(membership.company.id)) : [],
    defenseTypes: registered ? input.getAvailableHackathonDefenseTypes(String(membership.company.id)) : [],
  };
}

function buildManagerMainText(snapshot: any) {
  const incoming = snapshot.sabotageState?.activeIncoming;
  const defense = snapshot.sabotageState?.activeDefense;
  return [
    "🏁 Хакатон: саботаж и защита",
    "━━━━━━━━━━━━━━",
    `Компания: ${snapshot.membership.company.name}`,
    `Уровень саботажа: ${Number(snapshot.company.sabotageLevel || 0)}/3`,
    `Уровень защиты: ${Number(snapshot.company.defenseLevel || 0)}/3`,
    snapshot.sabotageState?.usedThisRound ? "💣 Саботаж в этом раунде уже использован" : "💣 Саботаж в этом раунде ещё доступен",
    incoming
      ? `⚠️ Активный саботаж: ${SABOTAGE_LABELS[incoming.sabotageType as HackathonSabotageType]?.title || incoming.sabotageType} (${Math.max(0, Math.ceil((Number(incoming.endsAt || 0) - Date.now()) / 1000))} сек)`
      : "⚠️ Активный саботаж: нет",
    defense
      ? `🛡 Защита: ${DEFENSE_LABELS[defense.defenseType as HackathonDefenseType]?.title || defense.defenseType}`
      : "🛡 Защита: нет",
  ].join("\n");
}

export async function handleHackathonMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  formatHackathonMenu: (player: any) => Promise<string>;
  formatGlobalEventsMenu: (player: any) => Promise<string>;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  storage: any;
  registerCompanyForWeeklyHackathon: (input: any) => any;
  joinPlayerToWeeklyHackathonTeam: (input: { userId: string; username: string; companyId: string }) => any;
  getWeeklyHackathonCompanyScore: (companyId: string) => any;
  extractErrorMessage: (error: unknown) => string;
  getTelegramIdByUserId: (userId: string) => string | null | undefined;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const {
    command,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    setCompanyMenuSection,
    sendWithCurrentHubKeyboard,
    formatHackathonMenu,
    formatGlobalEventsMenu,
    getPlayerCompanyContext,
    storage,
    registerCompanyForWeeklyHackathon,
    joinPlayerToWeeklyHackathonTeam,
    getWeeklyHackathonCompanyScore,
    extractErrorMessage,
    getTelegramIdByUserId,
    sendMessage,
  } = input;

  if (command === "/hackathon") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, await formatHackathonMenu(player));
    return true;
  }

  if (command === "/events") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    await sendWithCurrentHubKeyboard(token, chatId, player.id, await formatGlobalEventsMenu(player));
    return true;
  }

  if (command === "/hackathon_join") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Открой раздел «🏢 Компания».");
      return true;
    }
    try {
      const alreadyRegistered = getWeeklyHackathonCompanyScore(membership.company.id);
      let registeredThisCall = false;
      if (!alreadyRegistered) {
        if (membership.role !== "owner") throw new Error("Зарегистрировать компанию в weekly hackathon может только CEO.");
        const company = await storage.getCompany(membership.company.id);
        if (!company) throw new Error("Компания не найдена");
        if (Number(company.balance || 0) < WEEKLY_HACKATHON_CONFIG.registrationCostGrm) {
          throw new Error(`Недостаточно GRM на балансе компании. Нужно ${WEEKLY_HACKATHON_CONFIG.registrationCostGrm}`);
        }
        await storage.updateCompany(company.id, {
          balance: Number(company.balance || 0) - WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
        });
        registerCompanyForWeeklyHackathon({
          companyId: company.id,
          companyName: company.name,
          city: company.city,
          companyLevel: company.level,
          rndLevel: Math.max(0, Math.floor(Number(company.ork || 0) / 100)),
          companyEmoji: company.emoji ?? null,
          startedByUserId: player.id,
          sabotageLevel: Number(company.sabotageLevel || 0),
          defenseLevel: Number(company.defenseLevel || 0),
        });
        registeredThisCall = true;
        await notifyRegisteredCompanyMembers({
          token,
          storage,
          getTelegramIdByUserId,
          sendMessage,
          companyId: company.id,
          companyName: company.name,
        });
      }
      const joinResult = await joinHackathonTeam({
        player,
        membership,
        storage,
        joinPlayerToWeeklyHackathonTeam,
        sendWithCurrentHubKeyboard,
        token,
        chatId,
      });
      if (registeredThisCall && !joinResult.joined) {
        await sendWithCurrentHubKeyboard(token, chatId, player.id, ["✅ Компания зарегистрирована в weekly hackathon.", "Ты пока не добавлен в состав.", "", "Проверь требования к участию выше или через /hackathon."].join("\n"));
      }
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}

export async function handleHackathonCallback(input: {
  data: string;
  token: string;
  chatId: number;
  query: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  getPlayerCompanyContext: (userId: string) => Promise<any>;
  joinPlayerToWeeklyHackathonTeam: (input: { userId: string; username: string; companyId: string }) => any;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  formatHackathonMenu: (player: any) => Promise<string>;
  extractErrorMessage: (error: unknown) => string;
  storage: any;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  callTelegramApi: (token: string, method: string, payload?: any) => Promise<any>;
  getWeeklyHackathonState: () => any;
  getWeeklyHackathonSabotageState: (companyId?: string) => any;
  getRegisteredHackathonCompany: (companyId: string) => any;
  getAvailableHackathonSabotageTypes: (companyId: string) => HackathonSabotageType[];
  getAvailableHackathonDefenseTypes: (companyId: string) => HackathonDefenseType[];
  applyWeeklyHackathonSabotage: (input: any) => any;
  applyWeeklyHackathonDefense: (input: any) => any;
  upgradeWeeklyHackathonSabotageLevel: (companyId: string) => any;
  upgradeWeeklyHackathonDefenseLevel: (companyId: string) => any;
  isCompanyHackathonManagerRole: (role: string, ownerId: string | null | undefined, actorUserId: string) => boolean;
  hackathonSabotageTargetRefsByChatId: Map<number, string[]>;
  hackathonSelectedSabotageTargetByChatId: Map<number, string>;
}) {
  const {
    data,
    token,
    chatId,
    query,
    resolveOrCreateTelegramPlayer,
    getPlayerCompanyContext,
    joinPlayerToWeeklyHackathonTeam,
    sendWithCurrentHubKeyboard,
    formatHackathonMenu,
    extractErrorMessage,
    storage,
    sendMessage,
    callTelegramApi,
    getWeeklyHackathonState,
    getWeeklyHackathonSabotageState,
    getRegisteredHackathonCompany,
    getAvailableHackathonSabotageTypes,
    getAvailableHackathonDefenseTypes,
    applyWeeklyHackathonSabotage,
    applyWeeklyHackathonDefense,
    upgradeWeeklyHackathonSabotageLevel,
    upgradeWeeklyHackathonDefenseLevel,
    isCompanyHackathonManagerRole,
    hackathonSabotageTargetRefsByChatId,
    hackathonSelectedSabotageTargetByChatId,
  } = input;

  const player = await resolveOrCreateTelegramPlayer(query.from);
  const messageId = Number(query?.message?.message_id || 0) || undefined;

  if (data.startsWith("hackathon:join_team:")) {
    const companyId = data.split(":")[2] || "";
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.company.id !== companyId) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "❌ Ты не состоишь в этой компании.");
      return { handled: true as const, callbackText: "Не твоя компания", shouldClearInlineButtons: true };
    }
    try {
      const eligibility = await getHackathonEligibilityForPlayer(storage, player, membership);
      if (!eligibility.ok) {
        await sendWithCurrentHubKeyboard(token, chatId, player.id, formatEligibilityFailureText(eligibility.reasons));
        return { handled: true as const, callbackText: "Нет допуска", shouldClearInlineButtons: true };
      }
      joinPlayerToWeeklyHackathonTeam({
        userId: player.id,
        username: String(player.username || "Игрок"),
        companyId,
      });
      await sendWithCurrentHubKeyboard(token, chatId, player.id, await formatHackathonMenu(player));
      return { handled: true as const, callbackText: "Записан", shouldClearInlineButtons: true };
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
      return { handled: true as const, callbackText: "Ошибка", shouldClearInlineButtons: true };
    }
  }

  if (
    data === "hackathon_main"
    || data === "hackathon_back"
    || data === "hackathon:sabotage_menu"
    || data === "hackathon:defense_menu"
    || data === "hackathon:sabotage_upgrade"
    || data === "hackathon:defense_upgrade"
    || data.startsWith("sabotage_select_target:")
    || data.startsWith("sabotage_select_type:")
    || data.startsWith("sabotage_confirm:")
    || data.startsWith("defense_use:")
    || data.startsWith("hackathon:def_apply:")
  ) {
    try {
      const snapshot = await buildManagerSnapshot({
        userId: player.id,
        getPlayerCompanyContext,
        storage,
        getWeeklyHackathonState,
        getWeeklyHackathonSabotageState,
        getAvailableHackathonSabotageTypes,
        getAvailableHackathonDefenseTypes,
        isCompanyHackathonManagerRole,
      });

      if (data === "hackathon_main" || data === "hackathon_back") {
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text: buildManagerMainText(snapshot),
          replyMarkup: {
            inline_keyboard: [
              [{ text: "💣 Саботаж", callback_data: "hackathon:sabotage_menu" }, { text: "🛡 Защита", callback_data: "hackathon:defense_menu" }],
              [{ text: "⬆️ Саботаж", callback_data: "hackathon:sabotage_upgrade" }, { text: "⬆️ Защита", callback_data: "hackathon:defense_upgrade" }],
            ],
          },
        });
        return { handled: true as const, callbackText: "Открыто", shouldClearInlineButtons: false };
      }

      if (data === "hackathon:sabotage_menu") {
        if (!isHackathonRoundActive(snapshot.state)) throw new Error("Саботаж доступен только во время активного раунда хакатона.");
        if (!snapshot.registered) throw new Error("Компания ещё не зарегистрирована в текущем хакатоне.");
        if (snapshot.sabotageState?.usedThisRound) throw new Error("Саботаж в этом раунде уже использован.");
        if (!snapshot.targets.length) throw new Error("Сейчас нет доступных компаний-целей.");
        if (snapshot.targets.length === 1) {
          const target = snapshot.targets[0];
          hackathonSelectedSabotageTargetByChatId.set(chatId, target.companyId);
          await editOrSend({
            token,
            chatId,
            messageId,
            callTelegramApi,
            sendMessage,
            text: [`💣 Цель: ${target.companyName}`, "", "Выберите тип саботажа:"].join("\n"),
            replyMarkup: buildSabotageTypeMarkup(snapshot.sabotageTypes),
          });
          return { handled: true as const, callbackText: "Тип", shouldClearInlineButtons: false };
        }
        hackathonSabotageTargetRefsByChatId.set(chatId, snapshot.targets.map((target: any) => target.companyId));
        hackathonSelectedSabotageTargetByChatId.delete(chatId);
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text: ["💣 Выберите компанию для саботажа:", "", ...snapshot.targets.map((target: any, index: number) => `${index + 1}. ${target.companyName}`)].join("\n"),
          replyMarkup: buildTargetSelectionMarkup(snapshot.targets),
        });
        return { handled: true as const, callbackText: "Цель", shouldClearInlineButtons: false };
      }

      if (data.startsWith("sabotage_select_target:")) {
        const targetCompanyId = data.split(":")[1] === "select_target" ? data.slice("sabotage_select_target:".length) : "";
        const target = snapshot.targets.find((entry: any) => entry.companyId === targetCompanyId);
        if (!target) throw new Error("Компания-цель не найдена.");
        hackathonSelectedSabotageTargetByChatId.set(chatId, target.companyId);
        if (!snapshot.sabotageTypes.length) throw new Error("У компании пока не открыты типы саботажа.");
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text: [`💣 Цель: ${target.companyName}`, "", "Выберите тип саботажа:"].join("\n"),
          replyMarkup: buildSabotageTypeMarkup(snapshot.sabotageTypes),
        });
        return { handled: true as const, callbackText: "Тип", shouldClearInlineButtons: false };
      }

      if (data.startsWith("sabotage_select_type:")) {
        const sabotageType = data.slice("sabotage_select_type:".length) as HackathonSabotageType;
        const targetCompanyId = hackathonSelectedSabotageTargetByChatId.get(chatId) || "";
        const target = snapshot.targets.find((entry: any) => entry.companyId === targetCompanyId);
        if (!target) throw new Error("Сначала выбери компанию-цель.");
        const label = SABOTAGE_LABELS[sabotageType];
        if (!label) throw new Error("Тип саботажа не найден.");
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text: ["💣 Подтверждение", "", `Цель: ${target.companyName}`, `Тип: ${label.title}`, `Эффект: ${label.effect}`].join("\n"),
          replyMarkup: buildSabotageConfirmMarkup(target.companyId, sabotageType),
        });
        return { handled: true as const, callbackText: "Подтверждение", shouldClearInlineButtons: false };
      }

      if (data.startsWith("sabotage_confirm:")) {
        const [, targetCompanyId, sabotageTypeRaw] = data.split(":");
        const sabotageType = sabotageTypeRaw as HackathonSabotageType;
        const target = snapshot.targets.find((entry: any) => entry.companyId === targetCompanyId);
        if (!target) throw new Error("Компания-цель не найдена.");
        const result = applyWeeklyHackathonSabotage({
          initiatorUserId: player.id,
          attackerCompanyId: String(snapshot.company.id),
          targetCompanyId,
          sabotageType,
        });
        hackathonSelectedSabotageTargetByChatId.delete(chatId);
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text: ["💣 Саботаж успешно запущен!", "", `Цель: ${target.companyName}`, `Тип: ${SABOTAGE_LABELS[sabotageType].title}`, `Эффект: -${Math.round(Number(result.effectiveReduction || 0) * 100)}%`, `⏱ ${Math.max(0, Math.ceil((Number(result.endsAt || 0) - Number(result.startedAt || 0)) / 1000))} секунд`].join("\n"),
        });
        return { handled: true as const, callbackText: "Запущен", shouldClearInlineButtons: true };
      }

      if (data === "hackathon:defense_menu") {
        if (!snapshot.registered) throw new Error("Компания ещё не зарегистрирована в текущем хакатоне.");
        if (!snapshot.defenseTypes.length) throw new Error("У компании пока не открыты защиты.");
        const incoming = snapshot.sabotageState?.activeIncoming;
        if (!incoming) throw new Error("Сейчас нет активного саботажа.");
        if (snapshot.defenseTypes.length === 1) {
          const onlyType = snapshot.defenseTypes[0];
          const result = applyWeeklyHackathonDefense({
            companyId: String(snapshot.company.id),
            defenseType: onlyType,
          });
          const text = result.removed
            ? ["⚡ Успешный откат!", "Саботаж полностью снят."].join("\n")
            : ["🛡 Защита активирована!", DEFENSE_LABELS[onlyType].effect].join("\n");
          await editOrSend({
            token,
            chatId,
            messageId,
            callTelegramApi,
            sendMessage,
            text,
          });
          return { handled: true as const, callbackText: "Защита", shouldClearInlineButtons: true };
        }
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text: ["🛡 Выберите защиту:", "", ...snapshot.defenseTypes.map((type) => `${DEFENSE_LABELS[type].emoji} ${DEFENSE_LABELS[type].title} — ${DEFENSE_LABELS[type].effect}`)].join("\n"),
          replyMarkup: buildDefenseMarkup(snapshot.defenseTypes),
        });
        return { handled: true as const, callbackText: "Защита", shouldClearInlineButtons: false };
      }

      if (data.startsWith("defense_use:") || data.startsWith("hackathon:def_apply:")) {
        const defenseType = (data.startsWith("defense_use:") ? data.slice("defense_use:".length) : data.slice("hackathon:def_apply:".length)) as HackathonDefenseType;
        const result = applyWeeklyHackathonDefense({
          companyId: String(snapshot.company.id),
          defenseType,
        });
        const text = result.removed
          ? ["⚡ Успешный откат!", "Саботаж полностью снят."].join("\n")
          : ["🛡 Защита активирована!", DEFENSE_LABELS[defenseType].effect].join("\n");
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text,
        });
        return { handled: true as const, callbackText: "Защита", shouldClearInlineButtons: true };
      }

      if (data === "hackathon:sabotage_upgrade" || data === "hackathon:defense_upgrade") {
        const company = snapshot.company;
        const isSabotage = data === "hackathon:sabotage_upgrade";
        const currentLevel = Math.max(0, Math.floor(Number(isSabotage ? company.sabotageLevel || 0 : company.defenseLevel || 0)));
        const nextLevel = Math.min(3, currentLevel + 1);
        if (nextLevel === currentLevel) throw new Error(isSabotage ? "Саботаж уже прокачан до максимального уровня." : "Защита уже прокачана до максимального уровня.");
        const cost = Number(isSabotage ? WEEKLY_HACKATHON_CONFIG.sabotageAndDefense.sabotageUpgradeCosts[nextLevel] : WEEKLY_HACKATHON_CONFIG.sabotageAndDefense.defenseUpgradeCosts[nextLevel]);
        if (Number(company.balance || 0) < cost) throw new Error(`Недостаточно GRM. Нужно ${cost}.`);
        await storage.updateCompany(company.id, {
          balance: Number(company.balance || 0) - cost,
          ...(isSabotage ? { sabotageLevel: nextLevel } : { defenseLevel: nextLevel }),
        });
        if (getRegisteredHackathonCompany(String(company.id))) {
          if (isSabotage) upgradeWeeklyHackathonSabotageLevel(String(company.id));
          else upgradeWeeklyHackathonDefenseLevel(String(company.id));
        }
        await editOrSend({
          token,
          chatId,
          messageId,
          callTelegramApi,
          sendMessage,
          text: [isSabotage ? "✅ Саботаж улучшен." : "✅ Защита улучшена.", `Новый уровень: ${nextLevel}/3`, `Списано: ${cost} GRM`].join("\n"),
        });
        return { handled: true as const, callbackText: "Улучшено", shouldClearInlineButtons: true };
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      if (message === HACKATHON_MANAGER_ERROR) {
        return { handled: true as const, callbackText: HACKATHON_MANAGER_ERROR, shouldClearInlineButtons: false };
      }
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${message}`);
      return { handled: true as const, callbackText: "Ошибка", shouldClearInlineButtons: false };
    }
  }

  return { handled: false as const };
}
