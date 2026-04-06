import type {
  TelegramCallbackDispatchContext,
  TelegramCallbackDispatchResult,
  TelegramMessageDispatchContext,
} from "./core";

type TelegramRouterDeps = {
  hubTelegramModule: any;
  tutorialTelegramModule: any;
  inventoryTelegramModule: any;
  economyTelegramModule: any;
  repairTelegramModule: any;
  registrationTelegramModule: any;
  tryHandleTelegramMetaCallback: (input: any) => Promise<TelegramCallbackDispatchResult>;
  tryHandleTelegramFeatureCallback: (input: any) => Promise<TelegramCallbackDispatchResult>;
  buildTelegramFeatureCallbackInput: (...args: any[]) => any;
  tryHandleTelegramUtilityCallback: (input: any) => Promise<TelegramCallbackDispatchResult>;
  handleHackathonCallback: (input: any) => Promise<TelegramCallbackDispatchResult>;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  getPlayerCompanyContext: (userId: string) => Promise<any | null>;
  joinPlayerToWeeklyHackathonTeam: (...args: any[]) => any;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => any;
  formatHackathonMenu: (...args: any[]) => Promise<string> | string;
  extractErrorMessage: (error: unknown) => string;
  storage: any;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => any;
  callTelegramApi: (token: string, method: string, payload?: any) => Promise<any>;
  getWeeklyHackathonState: () => any;
  getWeeklyHackathonSabotageState: (companyId?: string) => any;
  getRegisteredHackathonCompany: (companyId: string) => any;
  getAvailableHackathonSabotageTypes: (companyId: string) => any[];
  getAvailableHackathonDefenseTypes: (companyId: string) => any[];
  applyWeeklyHackathonSabotage: (input: any) => any;
  applyWeeklyHackathonDefense: (input: any) => any;
  upgradeWeeklyHackathonSabotageLevel: (companyId: string) => any;
  upgradeWeeklyHackathonDefenseLevel: (companyId: string) => any;
  isCompanyHackathonManagerRole: (role: string, ownerId: string | null | undefined, actorUserId: string) => boolean;
  hackathonSabotageTargetRefsByChatId: Map<number, string[]>;
  hackathonSelectedSabotageTargetByChatId: Map<number, string>;
  tryHandleTelegramCommerceCallback: (input: any) => Promise<TelegramCallbackDispatchResult>;
  shouldBypassRegistrationFlow: (command: string) => boolean;
  canSelectAdvancedPersonality: (player: any) => boolean;
  maybePromptAdvancedPersonality: (token: string, chatId: number, player: any) => any;
  shouldAutoPromptProfession: (player: any) => boolean;
  shouldBypassProfessionAutoprompt: (command: string) => boolean;
  maybePromptProfession: (token: string, chatId: number, player: any, options: { force: boolean }) => any;
  maybeStartCitySectionTravel: (
    token: string,
    chatId: number,
    player: any,
    message: any,
    command: string,
  ) => Promise<boolean>;
  getPendingExclusiveAction: (chatId: number) => any;
  isReplyNavigationCommand: (command: string) => boolean;
  isCommandCompatibleWithExclusiveAction: (command: string, pendingAction: any) => boolean;
  pendingActionByChatId: Map<number, any>;
  shouldBypassTutorialLocks: (command: string) => boolean;
  getCurrentExclusiveAction: (userId: string, chatId: number) => Promise<string | null>;
  getCurrentPvpLockState: (userId: string) => Promise<"queue" | "duel_preparation" | "duel_active" | null>;
  formatExclusiveActionLabel: (action: any) => string;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  PROFESSION_UNLOCK_LEVEL: number;
  getLatestChangelogEntry: (...args: any[]) => any;
  formatChangelogShortMessage: (...args: any[]) => string;
  getAllChangelogEntries: () => any[];
  formatChangelogListMessage: (entries: any[]) => string;
  formatChangelogRecentMessage: (entries: any[], days?: number) => string;
  getRecentChangelogEntries: (days: number) => any[];
  normalizeChangelogDateInput: (value?: string) => string;
  getChangelogEntryByDate: (date: string) => any;
  formatChangelogDetailedMessage: (entry: any) => string;
  formatChangelogDateLabel: (date: string) => string;
  sendGadgetCatalogPage: (token: string, chatId: number, page: number) => Promise<void>;
  buildTelegramHubMessageInput: (...args: any[]) => any;
  buildTelegramFeatureMessageInput: (...args: any[]) => any;
  hubMessageHandler: (input: any) => Promise<boolean>;
  tryHandleTelegramFeatureMessage: (input: any) => Promise<boolean>;
  handleRepairMessage: (input: any) => Promise<boolean>;
  tryHandleTelegramPlayerSystemsMessage: (
    command: string,
    args: string[],
    token: string,
    chatId: number,
    message: any,
  ) => Promise<boolean>;
  tryHandleTelegramLegacyCommandIslands: (
    command: string,
    args: string[],
    token: string,
    chatId: number,
    message: any,
  ) => Promise<boolean>;
};

function resolveHandledCallbackResult(
  result: TelegramCallbackDispatchResult,
  fallbackText: string,
  defaultClearInlineButtons: boolean,
): TelegramCallbackDispatchResult {
  return {
    handled: true,
    callbackText: result.callbackText ?? fallbackText,
    shouldClearInlineButtons:
      typeof result.shouldClearInlineButtons === "boolean"
        ? result.shouldClearInlineButtons
        : defaultClearInlineButtons,
  };
}

export async function dispatchTelegramCallbackRoute(
  ctx: TelegramCallbackDispatchContext,
  deps: TelegramRouterDeps,
): Promise<TelegramCallbackDispatchResult> {
  const callbackText = "Готово";
  const shouldClearInlineButtons = true;

  const player = ctx.query?.from ? await deps.resolveOrCreateTelegramPlayer(ctx.query.from).catch(() => null) : null;
  if (player) {
    const pvpLockState = await deps.getCurrentPvpLockState(player.id);
    if (pvpLockState === "duel_active" && !ctx.data.startsWith("pvp_tactic:")) {
      return {
        handled: true,
        callbackText: "Сначала закончи PvP-бой",
        shouldClearInlineButtons: false,
      };
    }
  }

  const hubCallback = await deps.hubTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    query: ctx.query,
  });
  if (hubCallback.handled) {
    return resolveHandledCallbackResult(hubCallback, callbackText, shouldClearInlineButtons);
  }

  const metaCallback = await deps.tryHandleTelegramMetaCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (metaCallback.handled) {
    return resolveHandledCallbackResult(metaCallback, callbackText, shouldClearInlineButtons);
  }

  const featureCallback = await deps.tryHandleTelegramFeatureCallback(
    deps.buildTelegramFeatureCallbackInput(
      ctx.data,
      ctx.token,
      ctx.webAppUrl,
      ctx.query,
      ctx.chatId,
      ctx.messageId,
      ctx.callbackId,
    ),
  );
  if (featureCallback.handled) {
    return resolveHandledCallbackResult(featureCallback, callbackText, shouldClearInlineButtons);
  }

  const utilityCallback = await deps.tryHandleTelegramUtilityCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (utilityCallback.handled) {
    return resolveHandledCallbackResult(utilityCallback, callbackText, shouldClearInlineButtons);
  }

  const tutorialCallback = await deps.tutorialTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    query: ctx.query,
  });
  if (tutorialCallback.handled) {
    return resolveHandledCallbackResult(tutorialCallback, callbackText, shouldClearInlineButtons);
  }

  const hackathonCallback = await deps.handleHackathonCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    query: ctx.query,
    resolveOrCreateTelegramPlayer: deps.resolveOrCreateTelegramPlayer,
    getPlayerCompanyContext: deps.getPlayerCompanyContext,
    joinPlayerToWeeklyHackathonTeam: deps.joinPlayerToWeeklyHackathonTeam,
    sendWithCurrentHubKeyboard: deps.sendWithCurrentHubKeyboard,
    formatHackathonMenu: deps.formatHackathonMenu,
    extractErrorMessage: deps.extractErrorMessage,
    storage: deps.storage,
    sendMessage: deps.sendMessage,
    callTelegramApi: deps.callTelegramApi,
    getWeeklyHackathonState: deps.getWeeklyHackathonState,
    getWeeklyHackathonSabotageState: deps.getWeeklyHackathonSabotageState,
    getRegisteredHackathonCompany: deps.getRegisteredHackathonCompany,
    getAvailableHackathonSabotageTypes: deps.getAvailableHackathonSabotageTypes,
    getAvailableHackathonDefenseTypes: deps.getAvailableHackathonDefenseTypes,
    applyWeeklyHackathonSabotage: deps.applyWeeklyHackathonSabotage,
    applyWeeklyHackathonDefense: deps.applyWeeklyHackathonDefense,
    upgradeWeeklyHackathonSabotageLevel: deps.upgradeWeeklyHackathonSabotageLevel,
    upgradeWeeklyHackathonDefenseLevel: deps.upgradeWeeklyHackathonDefenseLevel,
    isCompanyHackathonManagerRole: deps.isCompanyHackathonManagerRole,
    hackathonSabotageTargetRefsByChatId: deps.hackathonSabotageTargetRefsByChatId,
    hackathonSelectedSabotageTargetByChatId: deps.hackathonSelectedSabotageTargetByChatId,
  });
  if (hackathonCallback.handled) {
    return resolveHandledCallbackResult(hackathonCallback, callbackText, shouldClearInlineButtons);
  }

  const inventoryCallback = await deps.inventoryTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (inventoryCallback.handled) {
    return resolveHandledCallbackResult(inventoryCallback, callbackText, shouldClearInlineButtons);
  }

  const economyCallback = await deps.economyTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    query: ctx.query,
  });
  if (economyCallback.handled) {
    return resolveHandledCallbackResult(economyCallback, callbackText, shouldClearInlineButtons);
  }

  const repairCallback = await deps.repairTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    query: ctx.query,
  });
  if (repairCallback.handled) {
    return resolveHandledCallbackResult(repairCallback, callbackText, shouldClearInlineButtons);
  }

  const commerceCallback = await deps.tryHandleTelegramCommerceCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (commerceCallback.handled) {
    return resolveHandledCallbackResult(commerceCallback, callbackText, shouldClearInlineButtons);
  }

  return {
    handled: true,
    callbackText: ctx.data.startsWith("company:") ? "Неизвестная кнопка" : "Действие не поддерживается",
    shouldClearInlineButtons: false,
  };
}

export async function dispatchTelegramCommandRoute(
  ctx: TelegramMessageDispatchContext,
  deps: TelegramRouterDeps,
) {
  const registrationStep = deps.registrationTelegramModule.resolveStep(ctx.player, ctx.chatId);
  if (registrationStep && !deps.shouldBypassRegistrationFlow(ctx.command)) {
    const startPayload = ctx.command === "/start" ? ctx.args[0] ?? "" : undefined;
    await deps.registrationTelegramModule.beginRegistration(ctx.token, ctx.chatId, ctx.player, startPayload, registrationStep);
    return;
  }

  if (deps.canSelectAdvancedPersonality(ctx.player) && !deps.shouldBypassRegistrationFlow(ctx.command)) {
    await deps.maybePromptAdvancedPersonality(ctx.token, ctx.chatId, ctx.player);
    return;
  }

  if (deps.shouldAutoPromptProfession(ctx.player) && !deps.shouldBypassProfessionAutoprompt(ctx.command)) {
    await deps.maybePromptProfession(ctx.token, ctx.chatId, ctx.player, { force: false });
  }

  if (await deps.maybeStartCitySectionTravel(ctx.token, ctx.chatId, ctx.player, ctx.message, ctx.command)) {
    return;
  }

  const pvpLockState = await deps.getCurrentPvpLockState(ctx.player.id);
  if (
    pvpLockState === "duel_active"
    && !["/pvp", "/status", "/me", "/help", "/cancel", "/updates", "/changes"].includes(ctx.command)
  ) {
    await deps.sendWithCurrentHubKeyboard(
      ctx.token,
      ctx.chatId,
      ctx.player.id,
      "⛔ PvP-дуэль уже идёт. Сначала закончи бой и потом переходи к другим действиям.",
    );
    return;
  }

  const pendingExclusiveAction = deps.getPendingExclusiveAction(ctx.chatId);
  if (
    pendingExclusiveAction
    && deps.isReplyNavigationCommand(ctx.command)
    && !deps.isCommandCompatibleWithExclusiveAction(ctx.command, pendingExclusiveAction)
  ) {
    deps.pendingActionByChatId.delete(ctx.chatId);
  }

  if (!deps.shouldBypassTutorialLocks(ctx.command)) {
    const currentExclusiveAction = await deps.getCurrentExclusiveAction(ctx.player.id, ctx.chatId);
    if (currentExclusiveAction && !deps.isCommandCompatibleWithExclusiveAction(ctx.command, currentExclusiveAction)) {
      await deps.sendWithCurrentHubKeyboard(
        ctx.token,
        ctx.chatId,
        ctx.player.id,
        `⛔ Сейчас уже выполняется действие: ${deps.formatExclusiveActionLabel(currentExclusiveAction)}.\nСначала заверши его или отмени текущее действие командой /cancel.`,
      );
      return;
    }
  }

  if (ctx.command === "/updates" || ctx.command === "/changes") {
    const rawArg = String(ctx.args[0] ?? "").trim().toLowerCase();
    if (!rawArg || rawArg === "latest") {
      const entry = deps.getLatestChangelogEntry();
      await deps.sendWithMainKeyboard(
        ctx.token,
        ctx.chatId,
        entry ? deps.formatChangelogShortMessage(entry) : "История обновлений пока пуста.",
      );
      return;
    }

    if (rawArg === "list") {
      await deps.sendWithMainKeyboard(ctx.token, ctx.chatId, deps.formatChangelogListMessage(deps.getAllChangelogEntries()));
      return;
    }

    if (rawArg === "7d") {
      await deps.sendWithMainKeyboard(ctx.token, ctx.chatId, deps.formatChangelogRecentMessage(deps.getRecentChangelogEntries(7), 7));
      return;
    }

    const requestedDate = deps.normalizeChangelogDateInput(ctx.args[0]);
    if (!requestedDate) {
      await deps.sendWithMainKeyboard(
        ctx.token,
        ctx.chatId,
        "Используй /updates, /updates latest, /updates YYYY-MM-DD, /updates list или /updates 7d.",
      );
      return;
    }

    const entry = deps.getChangelogEntryByDate(requestedDate);
    await deps.sendWithMainKeyboard(
      ctx.token,
      ctx.chatId,
      entry
        ? deps.formatChangelogDetailedMessage(entry)
        : `За ${deps.formatChangelogDateLabel(requestedDate)} обновления не найдены.`,
    );
    return;
  }

  if (ctx.command === "/gadgets") {
    await deps.sendGadgetCatalogPage(ctx.token, ctx.chatId, 0);
    return;
  }

  if (await deps.hubMessageHandler(
    deps.buildTelegramHubMessageInput(ctx.command, ctx.args, ctx.token, ctx.webAppUrl, ctx.chatId, ctx.message, ctx.player),
  )) {
    return;
  }

  if (await deps.handleRepairMessage({
    command: ctx.command,
    args: ctx.args,
    token: ctx.token,
    chatId: ctx.chatId,
    message: ctx.message,
  })) {
    return;
  }

  if (await deps.tryHandleTelegramFeatureMessage(
    deps.buildTelegramFeatureMessageInput(ctx.command, ctx.args, ctx.token, ctx.chatId, ctx.message),
  )) {
    return;
  }

  if (await deps.tryHandleTelegramPlayerSystemsMessage(ctx.command, ctx.args, ctx.token, ctx.chatId, ctx.message)) {
    return;
  }

  if (await deps.tryHandleTelegramLegacyCommandIslands(ctx.command, ctx.args, ctx.token, ctx.chatId, ctx.message)) {
    return;
  }
}
