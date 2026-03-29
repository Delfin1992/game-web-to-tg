export function createRepairTelegramModule(deps: {
  handleRepairMessage: (input: any) => Promise<boolean>;
  handleRepairCallback: (input: any) => Promise<any>;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  ensureCityHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  ensureCompanyHubAccess: (token: string, chatId: number, player: any, message: any) => Promise<boolean>;
  sendRepairServiceMenu: (...args: any[]) => Promise<any>;
  repairGadgetRefsByChatId: Map<number, string[]>;
  createRepairOrder: (...args: any[]) => any;
  getCurrencySymbol: (city: string) => string;
  formatRepairDuration: (value: number) => string;
  extractErrorMessage: (error: unknown) => string;
  repairOrderRefsByChatId: Map<number, string[]>;
  cancelRepairOrderByPlayer: (...args: any[]) => any;
  getPlayerCompanyContext: (...args: any[]) => any;
  sendWithMainKeyboard: (...args: any[]) => any;
  sendCompanyRepairServiceMenu: (...args: any[]) => any;
  listRepairOrdersForCity: (...args: any[]) => any;
  getRepairOrder: (...args: any[]) => any;
  hasCompanyRepairParts: (...args: any[]) => any;
  acceptRepairOrder: (...args: any[]) => any;
  consumeCompanyRepairParts: (...args: any[]) => any;
  startRepairOrder: (...args: any[]) => any;
  getTelegramIdByUserId: (...args: any[]) => any;
  sendMessage: (...args: any[]) => any;
  failRepairOrder: (...args: any[]) => any;
  formatRepairServiceMenu: (...args: any[]) => any;
  buildRepairServiceInlineMarkup: (...args: any[]) => any;
  callTelegramApi: (...args: any[]) => any;
  sendCityHubSummary: (...args: any[]) => any;
  listRepairableGadgets: (...args: any[]) => any;
  calculateRepairEstimate: (...args: any[]) => any;
  getGadgetConditionStatusLabel: (...args: any[]) => string;
  formatCompanyRepairServiceMenu: (...args: any[]) => any;
  buildCompanyRepairServiceInlineMarkup: (...args: any[]) => any;
  sendCompanyRootMenu: (...args: any[]) => any;
}) {
  return {
    async handleMessage(input: any) {
      return deps.handleRepairMessage(input);
    },

    async handleCallback(input: {
      data: string;
      token: string;
      chatId: number;
      messageId?: number;
      query: any;
    }) {
      const repairCallback = await deps.handleRepairCallback({
        data: input.data,
        token: input.token,
        chatId: input.chatId,
        messageId: input.messageId,
        query: input.query,
        resolveOrCreateTelegramPlayer: deps.resolveOrCreateTelegramPlayer,
        ensureCityHubAccess: deps.ensureCityHubAccess,
        ensureCompanyHubAccess: deps.ensureCompanyHubAccess,
        formatRepairServiceMenu: deps.formatRepairServiceMenu,
        buildRepairServiceInlineMarkup: deps.buildRepairServiceInlineMarkup,
        callTelegramApi: deps.callTelegramApi,
        extractErrorMessage: deps.extractErrorMessage,
        sendMessage: deps.sendMessage,
        sendCityHubSummary: deps.sendCityHubSummary,
        repairGadgetRefsByChatId: deps.repairGadgetRefsByChatId,
        listRepairableGadgets: deps.listRepairableGadgets,
        sendRepairServiceMenu: deps.sendRepairServiceMenu,
        calculateRepairEstimate: deps.calculateRepairEstimate,
        getGadgetConditionStatusLabel: deps.getGadgetConditionStatusLabel,
        getCurrencySymbol: deps.getCurrencySymbol,
        formatRepairDuration: deps.formatRepairDuration,
        createRepairOrder: deps.createRepairOrder,
        cancelRepairOrderByPlayer: deps.cancelRepairOrderByPlayer,
        getPlayerCompanyContext: deps.getPlayerCompanyContext,
        sendWithMainKeyboard: deps.sendWithMainKeyboard,
        formatCompanyRepairServiceMenu: deps.formatCompanyRepairServiceMenu,
        buildCompanyRepairServiceInlineMarkup: deps.buildCompanyRepairServiceInlineMarkup,
        sendCompanyRootMenu: deps.sendCompanyRootMenu,
        getRepairOrder: deps.getRepairOrder,
        sendCompanyRepairServiceMenu: deps.sendCompanyRepairServiceMenu,
        hasCompanyRepairParts: deps.hasCompanyRepairParts,
        acceptRepairOrder: deps.acceptRepairOrder,
        consumeCompanyRepairParts: deps.consumeCompanyRepairParts,
        startRepairOrder: deps.startRepairOrder,
        getTelegramIdByUserId: deps.getTelegramIdByUserId,
        failRepairOrder: deps.failRepairOrder,
      });

      if (!repairCallback?.handled) {
        return { handled: false as const };
      }

      return {
        handled: true as const,
        callbackText: repairCallback.callbackText,
        shouldClearInlineButtons: repairCallback.shouldClearInlineButtons,
      };
    },
  };
}
