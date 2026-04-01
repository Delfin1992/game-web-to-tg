/**
 * Transitional tutorial/jobs module.
 * Owns tutorial callback flow and job selection callbacks so dispatcher stays thin.
 */

type TutorialTelegramModuleDeps = {
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  getTutorialSnapshotByUser: (userId: string) => Promise<any>;
  formatTutorialMenuText: (snapshot: any, city?: string | null) => string;
  buildTutorialInlineButtons: (snapshot: any) => any;
  callTelegramApi: (token: string, method: string, body: Record<string, unknown>) => Promise<unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  callInternalApi: (method: "GET" | "POST", path: string, body?: Record<string, unknown>) => Promise<any>;
  sendTutorialMenu: (token: string, chatId: number, userId: string) => Promise<void>;
  sendTutorialCompletionCelebration: (token: string, chatId: number) => Promise<void>;
  handleIncomingMessage: (token: string, webAppUrl: string, message: any) => Promise<void>;
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, intent: any) => Promise<boolean>;
  runJobSelection: (token: string, chatId: number, player: any, ref: string) => Promise<{ ok: boolean; message?: string }>;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  pendingActionByChatId: Map<number, any>;
  sendCityHubSummary: (token: string, chatId: number, userId: string, prefix?: string) => Promise<void>;
};

export function createTutorialTelegramModule(deps: TutorialTelegramModuleDeps) {
  return {
    async handleCallback(input: {
      data: string;
      token: string;
      webAppUrl: string;
      chatId: number;
      messageId?: number;
      query: any;
    }) {
      const { data, token, webAppUrl, chatId, messageId, query } = input;

      if (data.startsWith("tutorial:")) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);

        if (data === "tutorial:refresh") {
          const tutorial = await deps.getTutorialSnapshotByUser(player.id);
          const text = deps.formatTutorialMenuText(tutorial, player.city);
          if (messageId) {
            await deps.callTelegramApi(token, "editMessageText", {
              chat_id: chatId,
              message_id: messageId,
              text,
              reply_markup: deps.buildTutorialInlineButtons(tutorial),
            });
          } else {
            await deps.sendMessage(token, chatId, text);
          }
          return { handled: true as const, callbackText: "Обновлено" };
        }

        if (data === "tutorial:start") {
          await deps.callInternalApi("POST", `/api/tutorial/${player.id}/start`, {});
          await deps.sendTutorialMenu(token, chatId, player.id);
          return { handled: true as const, callbackText: "Обучение запущено" };
        }

        const tutorialCommandMap: Record<string, { command: string; callbackText: string }> = {
          "tutorial:open_jobs": { command: "/jobs", callbackText: "Вакансии" },
          "tutorial:open_study": { command: "/study", callbackText: "Учёба" },
          "tutorial:open_shop_courses": { command: "/shop_courses", callbackText: "Курсы" },
          "tutorial:open_shop_gadgets": { command: "/shop_gadgets", callbackText: "Гаджеты" },
          "tutorial:open_inventory": { command: "/inventory", callbackText: "Инвентарь" },
          "tutorial:open_stocks": { command: "/stocks", callbackText: "Инвестиции" },
        };
        if (tutorialCommandMap[data]) {
          await deps.handleIncomingMessage(token, webAppUrl, {
            chat: { id: chatId },
            from: query.from,
            text: tutorialCommandMap[data].command,
          });
          return { handled: true as const, callbackText: tutorialCommandMap[data].callbackText };
        }

        if (["tutorial:bp_start", "tutorial:bp_check", "tutorial:produce", "tutorial:sell"].includes(data)) {
          await deps.sendMessage(
            token,
            chatId,
            "ℹ️ Блок разработки гаджета убран из обычного /tutorial. Этот сценарий теперь проходит только во время регистрации.",
          );
          await deps.sendTutorialMenu(token, chatId, player.id);
          return { handled: true as const, callbackText: "Блок перенесён" };
        }

        if (data === "tutorial:complete") {
          await deps.callInternalApi("POST", `/api/tutorial/${player.id}/complete`, {});
          await deps.sendTutorialCompletionCelebration(token, chatId);
          await deps.sendTutorialMenu(token, chatId, player.id);
          return { handled: true as const, callbackText: "Завершение" };
        }
      }

      const jobPickMatch = data.match(/^job:pick:(\d+)$/);
      if (jobPickMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        if (!(await deps.ensureExclusiveActionAllowed(token, chatId, player.id, "job"))) {
          return { handled: true as const, callbackText: "Вакансия" };
        }
        const result = await deps.runJobSelection(token, chatId, player, jobPickMatch[1]);
        if (!result.ok) {
          await deps.sendWithCurrentHubKeyboard(
            token,
            chatId,
            player.id,
            `❌ ${result.message}\nОткрой вакансии ещё раз и выбери кнопку повторно.`,
          );
        }
        return { handled: true as const, callbackText: "Вакансия" };
      }

      if (data === "job:back") {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        deps.pendingActionByChatId.delete(chatId);
        await deps.sendCityHubSummary(token, chatId, player.id);
        return { handled: true as const, callbackText: "Назад" };
      }

      return { handled: false as const };
    },
  };
}
