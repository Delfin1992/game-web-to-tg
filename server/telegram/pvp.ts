export {
  getPendingPvpBoosts,
  getPvpBoostCatalog,
  getPvpQueueState,
  purchasePvpBoost,
  queuePlayerForPvp,
} from "../pvp-duel";

type PvpTelegramModuleDeps = {
  handlePvpMessageInput: (command: string, token: string, chatId: number, message: any) => Promise<boolean>;
  resolveActor: (query: any) => Promise<any | null>;
  callInternalApi: (method: "GET" | "POST", path: string, body?: Record<string, unknown>) => Promise<any>;
  formatPvpActiveDuelText: (activeDuel: any) => string;
  getPvpInlineMarkup: (activeDuel?: any) => any;
  callTelegramApi: (token: string, method: string, body: Record<string, unknown>) => Promise<unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  formatPvpResultText: (result: any) => string;
  pvpMenuReplyMarkup: unknown;
  pvpQueuePollTimerByChatId: Map<number, NodeJS.Timeout>;
  pvpDuelProgressMessageByChatId: Map<number, number>;
  pvpDuelStageKeyByChatId: Map<number, string>;
};

export function createPvpTelegramModule(deps: PvpTelegramModuleDeps) {
  function isIgnorableTelegramEditError(error: unknown) {
    const message = String((error as any)?.message || error || "");
    return message.includes("message is not modified") || message.includes("message to edit not found");
  }

  function stopQueuePolling(chatId: number) {
    const timer = deps.pvpQueuePollTimerByChatId.get(chatId);
    if (timer) {
      clearInterval(timer);
      deps.pvpQueuePollTimerByChatId.delete(chatId);
    }
    deps.pvpDuelProgressMessageByChatId.delete(chatId);
    deps.pvpDuelStageKeyByChatId.delete(chatId);
  }

  async function syncDuelMessages(token: string, chatId: number, activeDuel: any) {
    const logText = deps.formatPvpActiveDuelText(activeDuel);
    const extra = { reply_markup: deps.getPvpInlineMarkup(activeDuel) };
    const progressMessageId = deps.pvpDuelProgressMessageByChatId.get(chatId);
    const stageKey = String(activeDuel?.currentStageKey || "unknown");
    const previousStageKey = deps.pvpDuelStageKeyByChatId.get(chatId);
    const shouldCreateNewStageMessage =
      !progressMessageId || (!activeDuel?.awaitingStart && previousStageKey && previousStageKey !== stageKey);

    if (progressMessageId && !shouldCreateNewStageMessage) {
      try {
        await deps.callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: progressMessageId,
          text: logText,
          ...extra,
        });
      } catch (error) {
        if (!isIgnorableTelegramEditError(error)) throw error;
        deps.pvpDuelProgressMessageByChatId.delete(chatId);
        const message = await deps.sendMessage(token, chatId, logText, extra);
        if (Number(message?.message_id)) {
          deps.pvpDuelProgressMessageByChatId.set(chatId, Number(message.message_id));
        }
      }
    } else {
      if (progressMessageId) {
        await deps.callTelegramApi(token, "deleteMessage", {
          chat_id: chatId,
          message_id: progressMessageId,
        }).catch(() => null);
        deps.pvpDuelProgressMessageByChatId.delete(chatId);
      }
      const message = await deps.sendMessage(token, chatId, logText, extra);
      if (Number(message?.message_id)) {
        deps.pvpDuelProgressMessageByChatId.set(chatId, Number(message.message_id));
      }
    }

    if (!activeDuel?.awaitingStart) {
      deps.pvpDuelStageKeyByChatId.set(chatId, stageKey);
    }
  }

  return {
    async handleMessage(command: string, token: string, chatId: number, message: any) {
      return deps.handlePvpMessageInput(command, token, chatId, message);
    },

    stopQueuePolling,

    startQueuePolling(token: string, chatId: number, userId: string) {
      stopQueuePolling(chatId);
      const startedAt = Date.now();
      const timer = setInterval(async () => {
        try {
          await deps.callInternalApi("POST", "/api/pvp/heartbeat", { userId });
          const claim = await deps.callInternalApi("POST", "/api/pvp/result/claim", { userId }) as any;
          if (claim?.result) {
            claim.result.userId = userId;
            claim.result.userName = "Ты";
            const progressMessageId = deps.pvpDuelProgressMessageByChatId.get(chatId);
            if (progressMessageId) {
              await deps.callTelegramApi(token, "deleteMessage", {
                chat_id: chatId,
                message_id: progressMessageId,
              }).catch(() => null);
            }
            deps.pvpDuelProgressMessageByChatId.delete(chatId);
            await deps.sendMessage(token, chatId, deps.formatPvpResultText(claim.result), {
              reply_markup: deps.pvpMenuReplyMarkup,
            });
            stopQueuePolling(chatId);
            return;
          }

          const status = await deps.callInternalApi("GET", `/api/pvp/status?userId=${encodeURIComponent(userId)}`) as any;
          if (status?.activeDuel) {
            await syncDuelMessages(token, chatId, status.activeDuel);
          }
          if (!status?.inQueue) {
            if (!status?.activeDuel) stopQueuePolling(chatId);
            return;
          }
          if (Date.now() - startedAt > 2 * 60 * 1000) {
            await deps.callInternalApi("POST", "/api/pvp/queue/leave", { userId });
            await deps.sendMessage(token, chatId, "⌛ Поиск соперника остановлен (таймаут). Попробуй /pvp_find снова.", {
              reply_markup: deps.pvpMenuReplyMarkup,
            });
            stopQueuePolling(chatId);
          }
        } catch {
          // silent retry
        }
      }, 1000);

      deps.pvpQueuePollTimerByChatId.set(chatId, timer);
    },

    async handleCallback(input: {
      data: string;
      token: string;
      chatId: number;
      messageId?: number;
      query: any;
    }) {
      const { data, token, chatId, messageId, query } = input;
      if (!(data === "pvp_boost:start" || data.startsWith("pvp_boost:buy:") || data.startsWith("pvp_tactic:"))) {
        return { handled: false as const };
      }

      const actor = await deps.resolveActor(query);
      if (!actor) {
        return {
          handled: true as const,
          callbackText: "Профиль не найден",
          shouldClearInlineButtons: true,
        };
      }

      if (data.startsWith("pvp_boost:buy:")) {
        const boostId = data.split(":").pop();
        await deps.callInternalApi("POST", "/api/pvp/boosts/purchase", { userId: actor.id, boostId });
      } else if (data.startsWith("pvp_tactic:")) {
        const [, stageKey, tacticId] = data.split(":");
        await deps.callInternalApi("POST", "/api/pvp/tactics/select", { userId: actor.id, stageKey, tacticId });
      } else {
        try {
          await deps.callInternalApi("POST", "/api/pvp/duel/start", { userId: actor.id });
        } catch (error: any) {
          const message = String(error?.message || "");
          if (message.includes("Активная дуэль не найдена")) {
            const claim = await deps.callInternalApi("POST", "/api/pvp/result/claim", { userId: actor.id }).catch(() => null) as any;
            if (claim?.result) {
              claim.result.userId = actor.id;
              claim.result.userName = "Ты";
              await deps.sendMessage(token, chatId, deps.formatPvpResultText(claim.result), {
                reply_markup: deps.pvpMenuReplyMarkup,
              });
            }
            return {
              handled: true as const,
              callbackText: "Эта дуэль уже завершена",
              shouldClearInlineButtons: true,
            };
          }
          throw error;
        }
      }

      const status = await deps.callInternalApi("GET", `/api/pvp/status?userId=${encodeURIComponent(actor.id)}`);
      if (messageId && status?.activeDuel) {
        try {
          await deps.callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: deps.formatPvpActiveDuelText(status.activeDuel),
            reply_markup: deps.getPvpInlineMarkup(status.activeDuel),
          });
        } catch (error) {
          if (!isIgnorableTelegramEditError(error)) throw error;
          const message = await deps.sendMessage(token, chatId, deps.formatPvpActiveDuelText(status.activeDuel), {
            reply_markup: deps.getPvpInlineMarkup(status.activeDuel),
          });
          if (Number(message?.message_id)) {
            deps.pvpDuelProgressMessageByChatId.set(chatId, Number(message.message_id));
          }
        }
      }

      return {
        handled: true as const,
        callbackText: data === "pvp_boost:start"
          ? "Дуэль стартует"
          : data.startsWith("pvp_boost:buy:")
            ? "PvP-предмет выбран"
            : "Тактика обновлена",
        shouldClearInlineButtons: false,
      };
    },
  };
}
