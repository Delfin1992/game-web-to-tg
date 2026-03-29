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
};

export function createPvpTelegramModule(deps: PvpTelegramModuleDeps) {
  return {
    async handleMessage(command: string, token: string, chatId: number, message: any) {
      return deps.handlePvpMessageInput(command, token, chatId, message);
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
        await deps.callInternalApi("POST", "/api/pvp/duel/start", { userId: actor.id });
      }

      const status = await deps.callInternalApi("GET", `/api/pvp/status?userId=${encodeURIComponent(actor.id)}`);
      if (messageId && status?.activeDuel) {
        await deps.callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: deps.formatPvpActiveDuelText(status.activeDuel),
          reply_markup: deps.getPvpInlineMarkup(status.activeDuel),
        });
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
