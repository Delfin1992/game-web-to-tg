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

function normalizeHousingCallbackId(raw: string) {
  return String(raw || "").trim().replace(/\s+/g, "_").toLowerCase();
}

function resolveHousingFromCallback(deps: HubTelegramModuleDeps, rawHouseId: string) {
  const normalized = normalizeHousingCallbackId(rawHouseId);
  return deps.getHousingById(rawHouseId) || deps.getHousingById(normalized);
}

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
        const refreshedUser = (await deps.storage.getUser(player.id)) ?? player;
        const house = resolveHousingFromCallback(deps, housingViewMatch[1]);
        if (!house) {
          return { handled: true as const, callbackText: "Дом не найден" };
        }
        await deps.replaceHousingCardMessage(token, chatId, messageId, refreshedUser, house);
        return { handled: true as const, callbackText: "Дом", shouldClearInlineButtons: false };
      }

      const housingBuyMatch = data.match(/^housing:buy:(.+)$/);
      if (housingBuyMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        const houseId = normalizeHousingCallbackId(housingBuyMatch[1]);
        const updated = await deps.purchaseHousing(player.id, houseId);
        const house = resolveHousingFromCallback(deps, houseId);
        if (!house) {
          return { handled: true as const, callbackText: "Дом не найден" };
        }
        await deps.replaceHousingCardMessage(token, chatId, messageId, updated, house, "✅ Покупка завершена.");
        return { handled: true as const, callbackText: "Дом куплен", shouldClearInlineButtons: false };
      }

      const housingActivateMatch = data.match(/^housing:activate:(.+)$/);
      if (housingActivateMatch) {
        const player = await deps.resolveOrCreateTelegramPlayer(query.from);
        const houseId = normalizeHousingCallbackId(housingActivateMatch[1]);
        const updated = await deps.setActiveHousing(player.id, houseId);
        const house = resolveHousingFromCallback(deps, houseId);
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
