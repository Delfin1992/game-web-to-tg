/**
 * PvP command-entry handlers extracted from telegram.ts.
 * Keeps queue, history and keyboard behavior unchanged.
 */
export async function handlePvpMessage(input: {
  command: string;
  token: string;
  chatId: number;
  message: any;
  resolveOrCreateTelegramPlayer: (from: any) => Promise<any>;
  canEnterPvp: (player: any) => { ok: true; professionId: string } | { ok: false; reason: "level" | "no_profession" };
  getPvpAccessMessage: (reason: "level" | "no_profession") => string;
  sendMessage: (token: string, chatId: number, text: string, options?: Record<string, unknown>) => Promise<any>;
  PVP_MENU_REPLY_MARKUP: any;
  formatPvpMenu: (player: any) => Promise<string>;
  buildProfessionSelectText: () => string;
  buildProfessionSelectInlineMarkup: () => any;
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, intent: any) => Promise<boolean>;
  callInternalApi: (method: "POST" | "GET", path: string, body?: Record<string, unknown>) => Promise<any>;
  startPvpQueuePolling: (token: string, chatId: number, userId: string) => void;
  stopPvpQueuePolling: (chatId: number) => void;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  extractErrorMessage: (error: unknown) => string;
}) {
  const {
    command,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    canEnterPvp,
    getPvpAccessMessage,
    sendMessage,
    PVP_MENU_REPLY_MARKUP,
    formatPvpMenu,
    buildProfessionSelectText,
    buildProfessionSelectInlineMarkup,
    ensureExclusiveActionAllowed,
    callInternalApi,
    startPvpQueuePolling,
    stopPvpQueuePolling,
    sendWithCurrentHubKeyboard,
    extractErrorMessage,
  } = input;

  if (command === "/pvp") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const access = canEnterPvp(player);
    if (!access.ok) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, getPvpAccessMessage(access.reason));
      if (access.reason === "no_profession") {
        await sendMessage(token, chatId, buildProfessionSelectText(), {
          reply_markup: buildProfessionSelectInlineMarkup(),
        });
      }
      return true;
    }
    await sendMessage(token, chatId, await formatPvpMenu(player), { reply_markup: PVP_MENU_REPLY_MARKUP });
    return true;
  }

  if (command === "/pvp_find") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const access = canEnterPvp(player);
    if (!access.ok) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, getPvpAccessMessage(access.reason));
      if (access.reason === "no_profession") {
        await sendMessage(token, chatId, buildProfessionSelectText(), {
          reply_markup: buildProfessionSelectInlineMarkup(),
        });
      }
      return true;
    }
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "pvp"))) {
      return true;
    }
    try {
      const join = await callInternalApi("POST", "/api/pvp/queue/join", { userId: player.id }) as any;
      await sendMessage(
        token,
        chatId,
        join?.activeDuel?.awaitingStart
          ? "⚔️ Матч найден. Перед стартом можно выбрать 1 PvP-предмет."
          : "⚔️ Поиск соперника запущен. Когда матч найдётся, в этом чате появится короткая PvP-дуэль по 3 раундам.",
        { reply_markup: PVP_MENU_REPLY_MARKUP },
      );
      startPvpQueuePolling(token, chatId, player.id);
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/pvp_leave") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      await callInternalApi("POST", "/api/pvp/queue/leave", { userId: player.id });
      stopPvpQueuePolling(chatId);
      await sendMessage(token, chatId, "✅ Ты вышел из PvP очереди.", { reply_markup: PVP_MENU_REPLY_MARKUP });
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/pvp_history") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      const rows = await callInternalApi("GET", `/api/pvp/history?userId=${encodeURIComponent(player.id)}&limit=5`) as any[];
      const lines = [
        "🧾 PvP история (последние 5):",
        ...(rows.length
          ? rows.map((row, idx) => {
            const isA = String(row.playerAId) === player.id;
            const opponent = isA ? row.playerBName : row.playerAName;
            const before = isA ? Number(row.playerARatingBefore || 0) : Number(row.playerBRatingBefore || 0);
            const after = isA ? Number(row.playerARatingAfter || 0) : Number(row.playerBRatingAfter || 0);
            const resultText = String(row.winnerUserId || "") === player.id ? "Победа" : "Поражение";
            return `${idx + 1}. ${resultText} vs ${opponent}\n   Рейтинг: ${before} → ${after}`;
          })
          : ["История пока пуста."]),
      ];
      await sendMessage(token, chatId, lines.join("\n"), { reply_markup: PVP_MENU_REPLY_MARKUP });
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}
