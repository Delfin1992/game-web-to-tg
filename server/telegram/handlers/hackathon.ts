/**
 * Weekly hackathon Telegram entrypoints.
 * New format:
 * - CEO registers company
 * - players self-join up to 5 slots
 * - timed rounds run automatically in backend
 * - participation is gated by anti-abuse eligibility checks
 */

import { WEEKLY_HACKATHON_CONFIG } from "../../../shared/weekly-hackathon";
import { validateHackathonEligibility } from "../../weekly-hackathon";

function buildHackathonJoinInline(companyId: string) {
  return {
    inline_keyboard: [[{ text: "✅ Участвовать", callback_data: `hackathon:join_team:${companyId}` }]],
  };
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
    "🏁 CEO зарегистрировал компанию в хакатоне!",
    `🏢 ${input.companyName}`,
    "",
    `Доступно ${WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany} мест для участия.`,
    "Нажми кнопку ниже, чтобы занять слот в составе.",
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
    await input.sendWithCurrentHubKeyboard(
      input.token,
      input.chatId,
      input.player.id,
      formatEligibilityFailureText(eligibility.reasons),
    );
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
        if (membership.role !== "owner") {
          throw new Error("Зарегистрировать компанию в weekly hackathon может только CEO.");
        }
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
        await sendWithCurrentHubKeyboard(
          token,
          chatId,
          player.id,
          [
            "✅ Компания зарегистрирована в weekly hackathon.",
            "Ты пока не добавлен в состав.",
            "",
            "Проверь требования к участию в сообщении выше или через /hackathon.",
          ].join("\n"),
        );
      }
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (
    command === "/hackathon_skill"
    || command === "/hackathon_grm_menu"
    || command === "/hackathon_grm"
    || command === "/hackathon_part"
    || command === "/hackathon_part_apply"
    || command === "/sabotage"
    || command === "/sabotage_security"
    || command === "/sabotage_security_menu"
    || command === "/poach_menu"
    || command === "/sabotage_attack"
    || command === "/poach_accept"
    || command === "/poach_decline"
  ) {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    await sendWithCurrentHubKeyboard(
      token,
      chatId,
      player.id,
      [
        "🏁 Weekly hackathon переведён на новый формат.",
        "",
        "Теперь:",
        "• CEO регистрирует компанию",
        "• игроки сами занимают до 5 мест",
        "• очки копятся автоматически по времени в 3 этапах",
        "• допуск идёт только для активных игроков по условиям участия",
        "",
        "Открой /hackathon или нажми «Участвовать в хакатоне».",
      ].join("\n"),
    );
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
  } = input;
  if (!data.startsWith("hackathon:join_team:")) {
    return { handled: false as const };
  }

  const companyId = data.split(":")[2] || "";
  const player = await resolveOrCreateTelegramPlayer(query.from);
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
