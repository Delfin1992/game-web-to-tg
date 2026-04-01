/**
 * Transitional hub module.
 * Owns navigation/city orchestration and housing callbacks so telegram.ts can stay a dispatcher.
 */

type HubTelegramModuleDeps = {
  handleNavigationMessage: (input: any) => Promise<boolean>;
  handleCityMessage: (input: any) => Promise<boolean>;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  storage: { getUser: (userId: string) => Promise<any | null> };
  getHousingById: (houseId: string) => any | null;
  purchaseHousing: (userId: string, houseId: string) => Promise<any>;
  setActiveHousing: (userId: string, houseId: string) => Promise<any>;
  replaceHousingCardMessage: (
    token: string,
    chatId: number,
    messageId: number | undefined,
    user: any,
    house: any,
    prefix?: string,
  ) => Promise<void>;
};

export function createHubTelegramModule(deps: HubTelegramModuleDeps) {
  return {
    async handleMessage(input: { navigationInput: any; cityInput: any }) {
      if (await deps.handleNavigationMessage(input.navigationInput)) {
        return true;
      }

      if (await deps.handleCityMessage(input.cityInput)) {
        return true;
      }

      return false;
    },

    async handleCallback(input: {
      data: string;
      token: string;
      chatId: number;
      messageId?: number;
      query: any;
    }) {
      const { data, token, chatId, messageId, query } = input;

      const housingViewMatch = data.match(/^housing:view:(.+)$/);
      if (housingViewMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        const refreshedUser = await deps.storage.getUser(player.id);
        const house = deps.getHousingById(housingViewMatch[1]);
        if (!refreshedUser || !house) {
          return { handled: true as const, callbackText: "Дом не найден" };
        }
        await deps.replaceHousingCardMessage(token, chatId, messageId, refreshedUser, house);
        return { handled: true as const, callbackText: "Дом", shouldClearInlineButtons: false };
      }

      const housingBuyMatch = data.match(/^housing:buy:(.+)$/);
      if (housingBuyMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        const updated = await deps.purchaseHousing(player.id, housingBuyMatch[1]);
        const house = deps.getHousingById(housingBuyMatch[1]);
        if (!house) {
          return { handled: true as const, callbackText: "Дом не найден" };
        }
        await deps.replaceHousingCardMessage(token, chatId, messageId, updated, house, "✅ Покупка завершена.");
        return { handled: true as const, callbackText: "Дом куплен", shouldClearInlineButtons: false };
      }

      const housingActivateMatch = data.match(/^housing:activate:(.+)$/);
      if (housingActivateMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        const updated = await deps.setActiveHousing(player.id, housingActivateMatch[1]);
        const house = deps.getHousingById(housingActivateMatch[1]);
        if (!house) {
          return { handled: true as const, callbackText: "Дом не найден" };
        }
        await deps.replaceHousingCardMessage(token, chatId, messageId, updated, house, "🏠 Этот дом теперь активен.");
        return { handled: true as const, callbackText: "Дом активирован", shouldClearInlineButtons: false };
      }

      return { handled: false as const };
    },
  };
}
