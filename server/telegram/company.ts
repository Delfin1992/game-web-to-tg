/**
 * Transitional company orchestration module.
 * Heavy domain logic still lives in telegram.ts and existing services, but section senders move here.
 */

function getBlueprintRecipeRequirements(blueprint: any) {
  if (Array.isArray(blueprint?.productionRecipe) && blueprint.productionRecipe.length) {
    return blueprint.productionRecipe.map((item: any) => ({
      partType: String(item.partType || item.type || ""),
      quality: String(item.quality || item.rarity || "Common"),
      quantity: Math.max(1, Number(item.quantity || 1)),
    }));
  }
  return Object.entries(blueprint?.production?.parts ?? {}).map(([partType, quantity]) => ({
    partType: String(partType),
    quality: "Common",
    quantity: Math.max(1, Number(quantity || 1)),
  }));
}

function buildWarehousePartPool(items: any[], normalizePartRarity: (rarity: string) => string) {
  const pool: Array<{ id: string; type: string; rarity: string; quality: string }> = [];
  for (const item of items) {
    const qty = Math.max(1, Number(item?.quantity || 1));
    const rarity = normalizePartRarity(String(item?.quality || item?.rarity || "Common"));
    for (let i = 0; i < qty; i += 1) {
      pool.push({
        id: String(item?.id || ""),
        type: String(item?.partType || item?.type || ""),
        rarity,
        quality: rarity,
      });
    }
  }
  return pool;
}

function formatBlueprintRecipeDetails(blueprint: any, quantity = 1) {
  const requirements = getBlueprintRecipeRequirements(blueprint);
  if (!requirements.length) return ["РќСѓР¶РЅРѕ РЅР° РїСЂРѕРёР·РІРѕРґСЃС‚РІРѕ: Р±Р°Р·РѕРІС‹Рµ РґРµС‚Р°Р»Рё РЅРµ РЅР°СЃС‚СЂРѕРµРЅС‹"];
  return [
    "РќСѓР¶РЅРѕ РЅР° РїСЂРѕРёР·РІРѕРґСЃС‚РІРѕ:",
    ...requirements.map((requirement: { partType: string; quality: string; quantity: number }) => {
      const amount = Math.max(1, Number(requirement.quantity || 1)) * Math.max(1, quantity);
      return `вЂў ${String(requirement.quality || "Common")} ${String(requirement.partType || "")} x${amount}`;
    }),
  ];
}

function formatBlueprintRecipeAvailabilityDetails(
  blueprint: any,
  warehouseParts: any[],
  normalizePartRarity: (rarity: string) => string,
  quantity = 1,
) {
  const requirements = getBlueprintRecipeRequirements(blueprint);
  if (!requirements.length) return ["РќСѓР¶РЅРѕ РЅР° РїСЂРѕРёР·РІРѕРґСЃС‚РІРѕ: Р±Р°Р·РѕРІС‹Рµ РґРµС‚Р°Р»Рё РЅРµ РЅР°СЃС‚СЂРѕРµРЅС‹"];
  return [
    "РќСѓР¶РЅРѕ РЅР° РїСЂРѕРёР·РІРѕРґСЃС‚РІРѕ:",
    ...requirements.map((requirement: { partType: string; quality: string; quantity: number }) => {
      const needed = Math.max(1, Number(requirement.quantity || 1)) * Math.max(1, quantity);
      const available = warehouseParts
        .filter((item: any) =>
          String(item.type || item.partType || "") === requirement.partType
          && normalizePartRarity(String(item.quality || item.rarity || "Common")) === normalizePartRarity(requirement.quality),
        )
        .reduce((sum: number, item: any) => sum + Math.max(1, Number(item.quantity || 1)), 0);
      return `вЂў ${String(requirement.quality || "Common")} ${String(requirement.partType || "")} вЂ” РµСЃС‚СЊ ${available} / РЅР°РґРѕ ${needed}`;
    }),
  ];
}

function resolveCompanyMemberTarget(
  members: any[],
  memberRefs: string[],
  rawRef: string,
) {
  const trimmed = String(rawRef || "").trim();
  if (!trimmed) return null;
  const byIndex = /^\d+$/.test(trimmed)
    ? (
      memberRefs[Math.max(0, Number(trimmed) - 1)]
      ?? members[Math.max(0, Number(trimmed) - 1)]?.userId
      ?? ""
    )
    : "";
  const resolvedUserId = byIndex || trimmed;
  return members.find((member: any) => member.userId === resolvedUserId) ?? null;
}

export async function sendCompanyWorkSection(input: {
  token: string;
  chatId: number;
  membership: any;
  formatCompanyWorkSection: (membership: any, chatId: number) => Promise<{ text: string; contracts?: any[] }>;
  buildCompanyWorkInlineButtons: (contracts: any[], companyId: string) => unknown;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyWorkSection(input.membership, input.chatId);
  await input.sendMessage(input.token, input.chatId, view.text, {
    reply_markup: view.contracts?.length
      ? input.buildCompanyWorkInlineButtons(view.contracts, input.membership.company.id)
      : input.buildCompanyReplyMarkup(input.membership.role, input.chatId),
  });
}

export async function sendCompanyWarehouseSection(input: {
  token: string;
  chatId: number;
  membership: any;
  playerId?: string;
  formatCompanyWarehouseSection: (membership: any, chatId: number) => Promise<{ text: string }>;
  buildCompanyWarehouseInlineMarkup: (chatId: number) => any;
  getUserWithGameState: (userId: string) => Promise<any>;
  pendingActionByChatId: Map<number, any>;
  formatCompanyPartDepositList: (game: any, chatId: number, withQuickCommands?: boolean) => string;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyWarehouseSection(input.membership, input.chatId);
  if (!input.playerId) {
    await input.sendMessage(input.token, input.chatId, view.text, {
      reply_markup: input.buildCompanyWarehouseInlineMarkup(input.chatId),
    });
    return;
  }
  const snapshot = await input.getUserWithGameState(input.playerId);
  if (!snapshot) {
    await input.sendMessage(input.token, input.chatId, view.text, {
      reply_markup: input.buildCompanyWarehouseInlineMarkup(input.chatId),
    });
    return;
  }
  input.pendingActionByChatId.set(input.chatId, { type: "company_part_deposit" });
  await input.sendMessage(
    input.token,
    input.chatId,
    `${view.text}\n\n${input.formatCompanyPartDepositList(snapshot.game, input.chatId, true)}`,
    { reply_markup: input.buildCompanyWarehouseInlineMarkup(input.chatId) },
  );
}

export async function sendCompanyBureauSection(input: {
  token: string;
  chatId: number;
  membership: any;
  userId: string;
  formatCompanyBureauSection: (membership: any, chatId: number, userId: string) => Promise<any>;
  buildCompanyBureauInlineButtons: (
    isOwner: boolean,
    activeStatus?: string,
    miningStatus?: any,
    blueprintButtons?: Array<{ id: string; label: string }>,
  ) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyBureauSection(input.membership, input.chatId, input.userId);
  await input.sendMessage(input.token, input.chatId, view.text, {
    reply_markup: input.buildCompanyBureauInlineButtons(
      input.membership.role === "owner",
      view.snapshot.active?.status,
      view.miningStatus,
      view.blueprintButtons,
    ),
  });
}

export async function sendOrEditCompanyBureauSection(input: {
  token: string;
  chatId: number;
  membership: any;
  userId: string;
  messageId?: number;
  prefix?: string;
  formatCompanyBureauSection: (membership: any, chatId: number, userId: string) => Promise<any>;
  buildCompanyBureauInlineButtons: (
    isOwner: boolean,
    activeStatus?: string,
    miningStatus?: any,
    blueprintButtons?: Array<{ id: string; label: string }>,
  ) => unknown;
  callTelegramApi: (token: string, method: string, body: Record<string, unknown>) => Promise<unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyBureauSection(input.membership, input.chatId, input.userId);
  const text = input.prefix ? `${input.prefix}\n\n${view.text}` : view.text;
  const replyMarkup = input.buildCompanyBureauInlineButtons(
    input.membership.role === "owner",
    view.snapshot.active?.status,
    view.miningStatus,
    view.blueprintButtons,
  );
  if (input.messageId) {
    try {
      await input.callTelegramApi(input.token, "editMessageText", {
        chat_id: input.chatId,
        message_id: input.messageId,
        text,
        reply_markup: replyMarkup,
      });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).toLowerCase();
      if (!message.includes("message is not modified")) {
        throw error;
      }
    }
    return;
  }
  await input.sendMessage(input.token, input.chatId, text, { reply_markup: replyMarkup });
}

export async function sendCompanyManagementSection(input: {
  token: string;
  chatId: number;
  membership: any;
  formatCompanyManagementSection: (membership: any) => Promise<{ text: string; members: Array<{ userId: string }> }>;
  companyMemberRefsByChatId: Map<number, string[]>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyManagementSection(input.membership);
  input.companyMemberRefsByChatId.set(input.chatId, view.members.map((member) => member.userId));
  await input.sendMessage(input.token, input.chatId, view.text, {
    reply_markup: input.buildCompanyReplyMarkup(input.membership.role, input.chatId),
  });
}

export async function sendCompanyEconomySection(input: {
  token: string;
  chatId: number;
  membership: any;
  formatCompanyMenuWithMembership: (membership: any) => Promise<string>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  await input.sendMessage(input.token, input.chatId, await input.formatCompanyMenuWithMembership(input.membership), {
    reply_markup: input.buildCompanyReplyMarkup(input.membership.role, input.chatId),
  });
}

export async function sendCompanyDepartmentsSection(input: {
  token: string;
  chatId: number;
  membership: any;
  formatCompanyDepartmentsSection: (membership: any) => Promise<{ text: string; companyEconomy: any }>;
  buildCompanyDepartmentsInlineButtons: (companyEconomy: any, isOwner: boolean) => unknown;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyDepartmentsSection(input.membership);
  await input.sendMessage(input.token, input.chatId, view.text, {
    reply_markup: input.buildCompanyDepartmentsInlineButtons(
      view.companyEconomy,
      String(input.membership.role || "").toLowerCase() === "owner",
    ),
  });
}

export async function sendCompanyIpoSection(input: {
  token: string;
  chatId: number;
  membership: any;
  formatCompanyIpoSection: (membership: any) => Promise<{ text: string }>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyIpoSection(input.membership);
  await input.sendMessage(input.token, input.chatId, view.text, {
    reply_markup: input.buildCompanyReplyMarkup(input.membership.role, input.chatId),
  });
}

export async function sendCompanyRequestsSection(input: {
  token: string;
  chatId: number;
  membership: any;
  storage: { getJoinRequestsByCompany: (companyId: string) => Promise<Array<{ id: string; username: string }>> };
  companyRequestsByChatId: Map<number, string[]>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const requests = await input.storage.getJoinRequestsByCompany(input.membership.company.id);
  if (!requests.length) {
    await input.sendMessage(input.token, input.chatId, "рџ“Ґ Р’С…РѕРґСЏС‰РёС… Р·Р°СЏРІРѕРє РЅРµС‚.", {
      reply_markup: input.buildCompanyReplyMarkup(input.membership.role, input.chatId),
    });
    return;
  }

  input.companyRequestsByChatId.set(input.chatId, requests.map((request) => request.id));
  await input.sendMessage(
    input.token,
    input.chatId,
    [
      `рџ“Ґ Р—РђРЇР’РљР Р’ "${input.membership.company.name}"`,
      "в”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓ",
      ...requests.map((request, index) => `${index + 1}. ${request.username}`),
    ].join("\n"),
    {
      reply_markup: {
        inline_keyboard: [
          ...requests.flatMap((request, index) => ([
            [{ text: `${index + 1}. ${request.username}`, callback_data: "company:requests" }],
            [
              { text: "вњ… РћРґРѕР±СЂРёС‚СЊ", callback_data: `company:request_accept:${request.id}` },
              { text: "вќЊ РћС‚РєР»РѕРЅРёС‚СЊ", callback_data: `company:request_decline:${request.id}` },
            ],
          ])),
          ...(((input.buildCompanyReplyMarkup(input.membership.role, input.chatId) as any)?.inline_keyboard) ?? []),
        ],
      },
    },
  );
}

export async function sendCompanyRootMenu(input: {
  token: string;
  chatId: number;
  player: any;
  prefix?: string;
  rememberTelegramMenu: (userId: string, state: any) => void;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  getPlayerCompanyContext: (userId: string) => Promise<any | null>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendCompanyProfile: (token: string, chatId: number, membership: any) => Promise<void>;
  storage: { getAllCompanies: () => Promise<any[]> };
  getTopCompanies: (companies: any[]) => any[];
  companyListByChatId: Map<number, string[]>;
  formatCompanyMenuWithoutMembership: (companies: any[], city: string) => string;
}) {
  input.rememberTelegramMenu(input.player.id, { menu: "company", section: "root" });
  input.setCompanyMenuSection(input.chatId, "root");
  const membership = await input.getPlayerCompanyContext(input.player.id);
  if (membership) {
    if (input.prefix) {
      await input.sendMessage(input.token, input.chatId, input.prefix, {
        reply_markup: input.buildCompanyReplyMarkup(membership.role, input.chatId),
      });
    }
    await input.sendCompanyProfile(input.token, input.chatId, membership);
    return;
  }

  const companies = (await input.storage.getAllCompanies()).filter((company) => !company.isTutorial);
  const top = input.getTopCompanies(companies);
  input.companyListByChatId.set(input.chatId, top.map((company) => company.id));
  await input.sendMessage(
    input.token,
    input.chatId,
    [input.prefix, input.formatCompanyMenuWithoutMembership(companies, input.player.city)].filter(Boolean).join("\n\n"),
    { reply_markup: input.buildCompanyReplyMarkup(null, input.chatId) },
  );
}

type CompanyTelegramModuleDeps = {
  handleNavigationMessage: (input: any) => Promise<boolean>;
  handleMembershipMessage: (input: any) => Promise<boolean>;
  handleProcessMessage: (input: any) => Promise<boolean>;
  handleManagementMessage: (input: any) => Promise<boolean>;
  handleDevelopmentMessage: (input: any) => Promise<boolean>;
  resolveOrCreateTelegramPlayer: (user?: any) => Promise<any>;
  getCurrentExclusiveAction: (userId: string, chatId: number) => Promise<string | null>;
  formatExclusiveActionLabel: (action: string) => string;
  sendWithCurrentHubKeyboard: (token: string, chatId: number, userId: string, text: string) => Promise<void>;
  getPlayerCompanyContext: (userId: string) => Promise<any | null>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  canManageCompanyAssets: (role?: string | null) => boolean;
  companyAssetManagerError: string;
  getCompanyCreateCostForPlayer: (city: string) => number;
  pendingActionByChatId: Map<number, any>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  sendCompanyWorkSection: (token: string, chatId: number, membership: any) => Promise<void>;
  sendCompanyWarehouseSection: (token: string, chatId: number, membership: any, playerId?: string) => Promise<void>;
  companyWarehouseFilterByChatId: Map<number, string>;
  sendCompanyManagementSection: (token: string, chatId: number, membership: any) => Promise<void>;
  formatCompanyDepartmentsSection: (membership: any) => Promise<{ text: string }>;
  callTelegramApi: (token: string, method: string, body: Record<string, unknown>) => Promise<unknown>;
  formatNumber: (value: number) => string;
  sendWithMainKeyboardBase?: any;
  formatRate: (value: number) => string;
  getLocalToGRMRate: (city: string) => number;
  formatCompanyIpoSection: (membership: any) => Promise<{ text: string }>;
  formatCompanyStaffingSection: (membership: any, chatId: number) => Promise<string>;
  buildCompanyStaffingInlineMarkup: (chatId: number, role: string | null) => unknown;
  companyMemberRefsByChatId: Map<number, string[]>;
  storage: any;
  buildCompanyDepartmentSelectInlineMarkup: (memberRef: string, role: string | null, chatId: number) => unknown;
  formatCompanyDepartmentChoiceHelp: () => string;
  callInternalApi: (method: "GET" | "POST", path: string, body?: Record<string, unknown>) => Promise<any>;
  extractErrorMessage: (error: unknown) => string;
  formatCompanySalariesSection: (membership: any, chatId: number) => Promise<string>;
  buildCompanySalariesInlineMarkup: (membership: any, chatId: number) => unknown;
  formatCompanyWarehouseExpandPreview: (company: any) => { text: string; canUpgrade: boolean };
  buildCompanyWarehouseExpandInlineButtons: (canUpgrade: boolean) => unknown;
  buildCompanyReplyMarkupFn: (role?: string | null, chatId?: number) => unknown;
  handleIncomingMessage: (token: string, webAppUrl: string, message: any) => Promise<void>;
  ensureCompanyProcessUnlocked: (token: string, chatId: number, userId: string, companyId: string, label: string) => Promise<boolean>;
  getCompanyMiningPlan: (planId: string) => any;
  scheduleCompanyMiningReadyNotification: (token: string, chatId: number, membership: any, userId: string, remainingSeconds: number) => void;
  buildCompanyMiningInlineButtons: (status: any) => unknown;
  getCompanyMiningStatus: (companyId: string, userId: string) => Promise<any>;
  formatMiningPlansMenu: (status: any) => string;
  ensureCompanyWarehouseCanStoreMiningReward: (company: any, rewardQty: number) => Promise<{ ok: boolean; free: number }>;
  claimCompanyMining: (companyId: string, userId: string) => Promise<any>;
  addPartToCompanyWarehouse: (companyId: string, reward: any) => void;
  sendOrEditCompanyBureauSection: (token: string, chatId: number, membership: any, userId: string, messageId?: number, prefix?: string) => Promise<void>;
  getCompanyBlueprintSnapshot: (companyId: string) => Promise<any>;
  updateCompanyBlueprintProgressMessage: (token: string, chatId: number, companyName: string, companyId: string, userId: string) => Promise<void>;
  ensureCompanyEconomyState: (company: any, membersCount: number) => Promise<any>;
  sendCompanyRequestsSection: (token: string, chatId: number, membership: any) => Promise<void>;
  upgradeDepartment: (company: any, departmentKey: any) => any;
  saveCompanyEconomyState: (company: any, economy: any) => Promise<any>;
  sendCompanyDepartmentsSection: (token: string, chatId: number, membership: any) => Promise<void>;
  departmentLabels: Record<string, string>;
  ensureExclusiveActionAllowed: (token: string, chatId: number, userId: string, intent: any) => Promise<boolean>;
  startCompanyBlueprintDevelopment: (token: string, chatId: number, membership: any, player: any, blueprintId: string) => Promise<void>;
  sendCompanyEconomySection: (token: string, chatId: number, membership: any) => Promise<void>;
  getCompanyExclusiveSnapshot: (companyId: string) => Promise<any>;
  companyExclusiveSelectedPartRefsByChatId: Map<number, string[]>;
  companyExclusivePartPageByChatId: Map<number, number>;
  companyExclusivePartRefsByChatId: Map<number, string[]>;
  getCompanyWarehouseParts: (companyId: string) => any[];
  sendCompanyExclusivePartsPicker: (
    token: string,
    chatId: number,
    membership: any,
    userId: string,
    gadgetName: string,
    gadgetCategory: string,
    gadgetBatchAvailable: number,
    messageId?: number,
  ) => Promise<void>;
  EXCLUSIVE_UPGRADE_REQUIRED_PARTS: number;
  EXCLUSIVE_UPGRADE_REQUIRED_GADGETS: number;
  previewCompanyExclusiveUpgrade: (companyId: string, userId: string, gadgetId: string, pickedParts: any[]) => Promise<any>;
  formatDurationShort: (ms: number) => string;
  buildCompanyExclusiveUpgradeConfirmInlineMarkup: () => unknown;
  startCompanyExclusiveDevelopment: (
    token: string,
    chatId: number,
    membership: any,
    userId: string,
    gadgetName: string,
    partRefs: string[],
    gadgetId: string,
  ) => Promise<void>;
  sendCompanyRootMenu: (token: string, chatId: number, player: any) => Promise<void>;
  setCompanyMenuSection: (chatId: number, section: any) => void;
  rememberTelegramMenu: (userId: string, state: any) => void;
  answerCallbackQuery: (token: string, callbackId: string, text?: string) => Promise<void>;
  ALL_PARTS: Record<string, any>;
  getCityContracts: (city: string) => Promise<any[]>;
  clearPendingActionRuntimeState: (chatId: number, pendingAction: any) => void;
  getCompanyWarehousePartUnitRefs: (companyId: string, filterType?: string | null) => Array<{ ref: string }>;
  companyContractSelectedPartRefsByChatId: Map<number, string[]>;
  companyContractPartPageByChatId: Map<number, number>;
  sendCompanyContractPartsPicker: (token: string, chatId: number, membership: any, contract: any, messageId?: number) => Promise<void>;
  completeCompanyContractDelivery: (
    token: string,
    chatId: number,
    membership: any,
    contract: any,
    userId: string,
    options?: { partRefs?: string[] },
  ) => Promise<void>;
  startCompanyContractPartSelection: (token: string, chatId: number, membership: any, userId: string, contract: any) => Promise<void>;
  resolveContractRef: (chatId: number, ref: string, contracts: any[]) => any;
  getCompanyWarehousePartTypeCapacity?: any;
  normalizePartRarity: (rarity: string) => string;
  setCompanyWarehouseParts: (companyId: string, parts: any[]) => void;
  formatProductionOrderRemaining: (order: any) => string;
  resolveCompanyPartSellRefFromChat: (chatId: number, ref: string) => string;
  sellCompanyWarehousePart: (membership: any, partRef: string, qtyRaw?: string, actorUserId?: string) => Promise<any>;
};

export function createCompanyTelegramModule(deps: CompanyTelegramModuleDeps) {
  return {
    async handleMessage(input: {
      command: string;
      args: string[];
      token: string;
      chatId: number;
      message: any;
      navigationInput: any;
      membershipInput: any;
      processInput: any;
      managementInput: any;
      developmentInput: any;
    }) {
      if (await deps.handleNavigationMessage(input.navigationInput)) return true;
      if (await deps.handleMembershipMessage(input.membershipInput)) return true;
      if (await deps.handleProcessMessage(input.processInput)) return true;
      if (await deps.handleManagementMessage(input.managementInput)) return true;
      if (await deps.handleDevelopmentMessage(input.developmentInput)) return true;
      return false;
    },

    async handleCallback(input: {
      data: string;
      token: string;
      chatId: number;
      messageId?: number;
      query: any;
      callbackId: string;
      webAppUrl: string;
    }) {
      const { data, token, chatId, messageId, query, webAppUrl } = input;
      if (!data.startsWith("company:")) {
        return { handled: false as const };
      }

      const player = await deps.resolveOrCreateTelegramPlayer(query.from);
      if (data === "company:create_start") {
        const membership = await deps.getPlayerCompanyContext(player.id);
        if (membership) {
          await deps.sendMessage(token, chatId, "РўС‹ СѓР¶Рµ СЃРѕСЃС‚РѕРёС€СЊ РІ РєРѕРјРїР°РЅРёРё. РСЃРїРѕР»СЊР·СѓР№ /company.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎРѕР·РґР°РЅРёРµ РєРѕРјРїР°РЅРёРё" };
        }
        const companyCreateCost = deps.getCompanyCreateCostForPlayer(player.city);
        deps.pendingActionByChatId.set(chatId, { type: "company_create" });
        await deps.sendMessage(
          token,
          chatId,
          `Р’РІРµРґРё РЅР°Р·РІР°РЅРёРµ РЅРѕРІРѕР№ РєРѕРјРїР°РЅРёРё (3-40 СЃРёРјРІРѕР»РѕРІ).\nРџРѕСЃР»Рµ СЌС‚РѕРіРѕ Р±РѕС‚ РїРѕРїСЂРѕСЃРёС‚ РѕРґРёРЅ СЌРјРѕРґР¶Рё.\nРЎС‚РѕРёРјРѕСЃС‚СЊ: ${deps.getCurrencySymbol(player.city)}${companyCreateCost}`,
          { reply_markup: deps.buildCompanyReplyMarkup(null) },
        );
        return { handled: true as const, callbackText: "РЎРѕР·РґР°РЅРёРµ РєРѕРјРїР°РЅРёРё" };
      }

      const companyJoinMatch = data.match(/^company:join:(.+)$/);
      if (companyJoinMatch) {
        const existingMembership = await deps.getPlayerCompanyContext(player.id);
        if (existingMembership) {
          await deps.sendMessage(token, chatId, "РўС‹ СѓР¶Рµ СЃРѕСЃС‚РѕРёС€СЊ РІ РєРѕРјРїР°РЅРёРё. РЎРЅР°С‡Р°Р»Р° РІС‹Р№РґРё РёР· С‚РµРєСѓС‰РµР№ РєРѕРјРїР°РЅРёРё.", {
            reply_markup: deps.buildCompanyReplyMarkup(existingMembership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р’СЃС‚СѓРїР»РµРЅРёРµ РІ РєРѕРјРїР°РЅРёСЋ" };
        }
        const companies = (await deps.storage.getAllCompanies()).filter((company: any) => !company.isTutorial);
        const selectedCompany = companies.find((company: any) => String(company.id) === String(companyJoinMatch[1])) ?? null;
        if (!selectedCompany) {
          await deps.sendMessage(token, chatId, "РљРѕРјРїР°РЅРёСЏ РЅРµ РЅР°Р№РґРµРЅР°. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» В«рџЏў РљРѕРјРїР°РЅРёСЏВ» Рё РІС‹Р±РµСЂРё РєРѕРјРїР°РЅРёСЋ РёР· СЃРїРёСЃРєР°.", {
            reply_markup: deps.buildCompanyReplyMarkup(null),
          });
          return { handled: true as const, callbackText: "Р’СЃС‚СѓРїР»РµРЅРёРµ РІ РєРѕРјРїР°РЅРёСЋ" };
        }
        const pendingRequests = await deps.storage.getJoinRequestsByUser(player.id);
        const existsPending = pendingRequests.some((request: any) => request.companyId === selectedCompany.id && request.status === "pending");
        if (existsPending) {
          await deps.sendMessage(token, chatId, "Р—Р°СЏРІРєР° СѓР¶Рµ РѕС‚РїСЂР°РІР»РµРЅР° Рё РѕР¶РёРґР°РµС‚ СЂРµС€РµРЅРёСЏ.", {
            reply_markup: deps.buildCompanyReplyMarkup(null),
          });
          return { handled: true as const, callbackText: "Р’СЃС‚СѓРїР»РµРЅРёРµ РІ РєРѕРјРїР°РЅРёСЋ" };
        }
        await deps.storage.createJoinRequest({
          companyId: selectedCompany.id,
          userId: player.id,
          username: player.username,
        });
        await deps.sendMessage(token, chatId, `вњ… Р—Р°СЏРІРєР° РѕС‚РїСЂР°РІР»РµРЅР° РІ РєРѕРјРїР°РЅРёСЋ "${selectedCompany.name}".`, {
          reply_markup: deps.buildCompanyReplyMarkup(null),
        });
        return { handled: true as const, callbackText: "Р’СЃС‚СѓРїР»РµРЅРёРµ РІ РєРѕРјРїР°РЅРёСЋ" };
      }

      const allowInsideExclusive =
        data === "company:warehouse"
        || /^company:warehouse_filter:(all|smartphone|smartwatch|tablet|laptop|asic)$/.test(data);
      const currentExclusiveAction = await deps.getCurrentExclusiveAction(player.id, chatId);
      if (currentExclusiveAction && currentExclusiveAction !== "development" && !allowInsideExclusive) {
        await deps.sendWithCurrentHubKeyboard(
          token,
          chatId,
          player.id,
          `в›” РЎРµР№С‡Р°СЃ СѓР¶Рµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РґРµР№СЃС‚РІРёРµ: ${deps.formatExclusiveActionLabel(currentExclusiveAction)}.\nРЎРЅР°С‡Р°Р»Р° Р·Р°РІРµСЂС€Рё РµРіРѕ РёР»Рё РЅР°Р¶РјРё В«в¬…пёЏ РќР°Р·Р°РґВ».`,
        );
        return { handled: true as const, callbackText: "Р”РµР№СЃС‚РІРёРµ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ" };
      }

      const membership = await deps.getPlayerCompanyContext(player.id);
      if (!membership) {
        await deps.sendWithMainKeyboard(token, chatId, "РўС‹ РЅРµ СЃРѕСЃС‚РѕРёС€СЊ РІ РєРѕРјРїР°РЅРёРё. РСЃРїРѕР»СЊР·СѓР№ /company, С‡С‚РѕР±С‹ РІСЃС‚СѓРїРёС‚СЊ РёР»Рё СЃРѕР·РґР°С‚СЊ РЅРѕРІСѓСЋ.");
        return { handled: true as const, callbackText: "РўС‹ РЅРµ СЃРѕСЃС‚РѕРёС€СЊ РІ РєРѕРјРїР°РЅРёРё" };
      }

      if (data === "company:warehouse") {
        return { handled: true as const, callbackText: "Р Р°Р·РґРµР»: РЎРєР»Р°Рґ" };
      }

      const companyPartSellPickMatch = data.match(/^company:part_sell_pick:(\d+)$/);
      if (companyPartSellPickMatch) {
        if (!deps.canManageCompanyAssets(membership.role)) {
          await deps.sendMessage(token, chatId, deps.companyAssetManagerError, {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РџСЂРѕРґР°Р¶Р° Р·Р°РїС‡Р°СЃС‚РµР№" };
        }
        const partRef = deps.resolveCompanyPartSellRefFromChat(chatId, companyPartSellPickMatch[1]);
        const warehouseParts = deps.getCompanyWarehouseParts(membership.company.id);
        const partItem = warehouseParts.find((item: any) => String(item.id) === String(partRef));
        if (!partItem) {
          await deps.sendMessage(token, chatId, "Р—Р°РїС‡Р°СЃС‚СЊ РЅРµ РЅР°Р№РґРµРЅР° РЅР° СЃРєР»Р°РґРµ РєРѕРјРїР°РЅРёРё.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РџСЂРѕРґР°Р¶Р° Р·Р°РїС‡Р°СЃС‚РµР№" };
        }
        const availableQty = Math.max(1, Number(partItem.quantity) || 1);
        if (availableQty > 1) {
          deps.pendingActionByChatId.set(chatId, { type: "company_part_sell_qty", partRef: String(partItem.id) });
          await deps.sendMessage(
            token,
            chatId,
            `рџ’ё Р’С‹Р±СЂР°РЅРѕ: ${partItem.name}\nРќР° СЃРєР»Р°РґРµ: ${availableQty}\n\nР’РІРµРґРё РєРѕР»РёС‡РµСЃС‚РІРѕ РґР»СЏ РїСЂРѕРґР°Р¶Рё (1-${availableQty}) РёР»Рё all.`,
            { reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId) },
          );
          return { handled: true as const, callbackText: "РџСЂРѕРґР°Р¶Р° Р·Р°РїС‡Р°СЃС‚РµР№" };
        }
        const result = await deps.sellCompanyWarehousePart(membership, String(partItem.id), "1", player.id);
        await deps.sendMessage(
          token,
          chatId,
          result.ok
            ? `вњ… РЎРѕ СЃРєР»Р°РґР° РєРѕРјРїР°РЅРёРё РїСЂРѕРґР°РЅРѕ: ${result.partName} x${result.sellQty}\n+${deps.formatNumber(result.earnedGrm)} GRM\nРљР°РїРёС‚Р°Р» РєРѕРјРїР°РЅРёРё: ${deps.formatNumber(result.companyCapitalGrm)} GRM`
            : `вќЊ ${result.error}`,
          { reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId) },
        );
        await deps.sendCompanyWarehouseSection(token, chatId, membership, player.id);
        return { handled: true as const, callbackText: "РџСЂРѕРґР°Р¶Р° Р·Р°РїС‡Р°СЃС‚РµР№" };
      }

      const warehouseFilterMatch = data.match(/^company:warehouse_filter:(all|smartphone|smartwatch|tablet|laptop|asic)$/);
      if (warehouseFilterMatch) {
        const nextFilter = warehouseFilterMatch[1];
        if (nextFilter === "all") deps.companyWarehouseFilterByChatId.delete(chatId);
        else deps.companyWarehouseFilterByChatId.set(chatId, nextFilter);
        await deps.sendCompanyWarehouseSection(token, chatId, membership, player.id);
        return { handled: true as const, callbackText: "Р¤РёР»СЊС‚СЂ СЃРєР»Р°РґР°" };
      }

      if (data === "company:work") {
        await deps.sendCompanyWorkSection(token, chatId, membership);
        return { handled: true as const, callbackText: "Р Р°Р·РґРµР»: Р Р°Р±РѕС‚Р°", shouldClearInlineButtons: false as const };
      }

      const miningPickMatch = data.match(/^company:mining_pick:(short|medium|long)$/);
      if (miningPickMatch) {
        if (!(await deps.ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Р”РѕР±С‹С‡Р° Р·Р°РїС‡Р°СЃС‚РµР№"))) {
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ СЃРјРµРЅС‹", shouldClearInlineButtons: false as const };
        }
        const plan = deps.getCompanyMiningPlan(miningPickMatch[1]);
        try {
          const started = await deps.callInternalApi("POST", `/api/companies/${membership.company.id}/mining/start`, {
            userId: player.id,
            planId: plan.id,
          });
          if (started.status === "in_progress") {
            deps.scheduleCompanyMiningReadyNotification(token, chatId, membership, player.id, started.remainingSeconds);
          }
          const text = `в›Џ Р—Р°РїСѓС‰РµРЅР° СЃРјРµРЅР°: ${plan.label}\nР’СЂРµРјСЏ: ~${started.remainingSeconds} СЃРµРє.\nРћР¶РёРґР°РµРјР°СЏ РґРѕР±С‹С‡Р°: ${plan.minRewardQty}-${plan.maxRewardQty} Р·Р°РїС‡Р°СЃС‚РµР№`;
          if (messageId) {
            await deps.callTelegramApi(token, "editMessageText", {
              chat_id: chatId,
              message_id: messageId,
              text,
              reply_markup: deps.buildCompanyMiningInlineButtons(started),
            });
          } else {
            await deps.sendMessage(token, chatId, text, {
              reply_markup: deps.buildCompanyMiningInlineButtons(started),
            });
          }
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`, {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ СЃРјРµРЅС‹", shouldClearInlineButtons: false as const };
      }

      if (data === "company:mining_claim") {
        const currentStatus = await deps.getCompanyMiningStatus(membership.company.id, player.id);
        if (currentStatus.status !== "ready_to_claim" || !currentStatus.rewardPreview) {
          await deps.sendOrEditCompanyBureauSection(token, chatId, membership, player.id, messageId, "вЏ± Р”РѕР±С‹С‡Р° РµС‰Рµ РІ РїСЂРѕС†РµСЃСЃРµ.");
          return { handled: true as const, callbackText: "Р—Р°Р±РѕСЂ РґРѕР±С‹С‡Рё", shouldClearInlineButtons: false as const };
        }
        const warehouseCheck = await deps.ensureCompanyWarehouseCanStoreMiningReward(membership.company, currentStatus.rewardPreview.quantity);
        if (!warehouseCheck.ok) {
          await deps.sendOrEditCompanyBureauSection(token, chatId, membership, player.id, messageId, `вљ пёЏ РќР° СЃРєР»Р°РґРµ РЅРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРµСЃС‚Р°. РЎРІРѕР±РѕРґРЅРѕ СЃР»РѕС‚РѕРІ: ${warehouseCheck.free}.`);
          return { handled: true as const, callbackText: "Р—Р°Р±РѕСЂ РґРѕР±С‹С‡Рё", shouldClearInlineButtons: false as const };
        }
        const claimed = await deps.claimCompanyMining(membership.company.id, player.id);
        const reward = claimed.reward;
        deps.addPartToCompanyWarehouse(membership.company.id, reward);
        await deps.sendMessage(
          token,
          chatId,
          [`✅ Добыча завершена: ${reward.partName} x${reward.quantity}`, `Редкость: ${reward.rarity}`, "Деталь перемещена на склад компании."].join("\n"),
          { reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId) },
        );
        return { handled: true as const, callbackText: "Р—Р°Р±РѕСЂ РґРѕР±С‹С‡Рё", shouldClearInlineButtons: false as const };
      }

      if (data === "company:mining_refresh" || data === "company:mining_start") {
        const status = await deps.getCompanyMiningStatus(membership.company.id, player.id);
        const text = deps.formatMiningPlansMenu(status);
        if (messageId) {
          try {
            await deps.callTelegramApi(token, "editMessageText", {
              chat_id: chatId,
              message_id: messageId,
              text,
              reply_markup: deps.buildCompanyMiningInlineButtons(status),
            });
          } catch (error) {
            const message = String(error instanceof Error ? error.message : error).toLowerCase();
            if (!message.includes("message is not modified")) {
              throw error;
            }
          }
        } else {
          await deps.sendMessage(token, chatId, text, {
            reply_markup: deps.buildCompanyMiningInlineButtons(status),
          });
        }
        return { handled: true as const, callbackText: "Р”РѕР±С‹С‡Р°", shouldClearInlineButtons: false as const };
      }

      if (data === "company:bureau") {
        await deps.sendOrEditCompanyBureauSection(token, chatId, membership, player.id, messageId);
        return { handled: true as const, callbackText: "Р Р°Р·РґРµР»: Р‘СЋСЂРѕ", shouldClearInlineButtons: false as const };
      }

      if (data === "company:management") {
        await deps.sendCompanyManagementSection(token, chatId, membership);
        return { handled: true as const, callbackText: "Р Р°Р·РґРµР»: РЈРїСЂР°РІР»РµРЅРёРµ" };
      }

      if (data === "company:departments") {
        const view = await deps.formatCompanyDepartmentsSection(membership);
        if (messageId) {
          await deps.callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: view.text,
          });
        } else {
          await deps.sendMessage(token, chatId, view.text);
        }
        return { handled: true as const, callbackText: "Р Р°Р·РґРµР»: РћС‚РґРµР»С‹" };
      }

      if (data === "company:topup") {
        deps.pendingActionByChatId.set(chatId, { type: "company_topup", companyId: String(membership.company.id) });
        const rate = deps.getLocalToGRMRate(player.city);
        await deps.sendWithMainKeyboard(
          token,
          chatId,
          [
            "рџ’± РџРѕРїРѕР»РЅРµРЅРёРµ РєРѕРјРїР°РЅРёРё РІ GRM",
            `РўРІРѕР№ РєСѓСЂСЃ: 1 Р»РѕРєР°Р»СЊРЅР°СЏ РµРґРёРЅРёС†Р° = ${deps.formatRate(rate)} GRM`,
            `Р‘Р°Р»Р°РЅСЃ РёРіСЂРѕРєР°: ${deps.getCurrencySymbol(player.city)}${player.balance}`,
            "Р’РІРµРґРё СЃСѓРјРјСѓ РІ Р»РѕРєР°Р»СЊРЅРѕР№ РІР°Р»СЋС‚Рµ.",
          ].join("\n"),
        );
        return { handled: true as const, callbackText: "РџРѕРїРѕР»РЅРµРЅРёРµ РєРѕРјРїР°РЅРёРё" };
      }

      if (data === "company:ipo") {
        const view = await deps.formatCompanyIpoSection(membership);
        if (messageId) {
          await deps.callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: view.text,
          });
        } else {
          await deps.sendMessage(token, chatId, view.text);
        }
        return { handled: true as const, callbackText: "Р Р°Р·РґРµР»: IPO" };
      }

      if (data === "company:requests") {
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/company_requests",
        });
        return { handled: true as const, callbackText: "Р—Р°СЏРІРєРё" };
      }

      if (data === "company:salary_claim") {
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/company_salary_claim",
        });
        return { handled: true as const, callbackText: "РџРѕР»СѓС‡РµРЅРёРµ Р·Р°СЂРїР»Р°С‚С‹" };
      }

      if (data === "company:staffing") {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "Р Р°Р·РґРµР» РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "HR" };
        }
        await deps.sendMessage(token, chatId, await deps.formatCompanyStaffingSection(membership, chatId), {
          reply_markup: deps.buildCompanyStaffingInlineMarkup(chatId, membership.role),
        });
        return { handled: true as const, callbackText: "HR" };
      }

      const staffPickMatch = data.match(/^company:staff_pick(?:_ref)?:([^:]+)$/);
      if (staffPickMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "Р Р°Р·РґРµР» РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ СЃРѕС‚СЂСѓРґРЅРёРєР°" };
        }
        const members = await deps.storage.getCompanyMembers(membership.company.id);
        const memberRefs = deps.companyMemberRefsByChatId.get(chatId) ?? [];
        const targetMember = resolveCompanyMemberTarget(members, memberRefs, staffPickMatch[1]);
        if (!targetMember) {
          await deps.sendMessage(token, chatId, "РЎРѕС‚СЂСѓРґРЅРёРє РЅРµ РЅР°Р№РґРµРЅ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ СЃРѕС‚СЂСѓРґРЅРёРєР°" };
        }
        await deps.sendMessage(
          token,
          chatId,
          [`Р’С‹Р±РµСЂРё РѕС‚РґРµР» РґР»СЏ ${targetMember.username}:`, "", deps.formatCompanyDepartmentChoiceHelp()].join("\n"),
          { reply_markup: deps.buildCompanyDepartmentSelectInlineMarkup(String(targetMember.userId), membership.role, chatId) },
        );
        return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ СЃРѕС‚СЂСѓРґРЅРёРєР°" };
      }

      const staffAssignMatch = data.match(/^company:staff_assign(?:_ref)?:([^:]+):(researchAndDevelopment|production|marketing|finance|infrastructure)$/);
      if (staffAssignMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "Р Р°Р·РґРµР» РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "РќР°Р·РЅР°С‡РµРЅРёРµ РІ РѕС‚РґРµР»" };
        }
        const targetMembers = await deps.storage.getCompanyMembers(membership.company.id);
        const memberRefs = deps.companyMemberRefsByChatId.get(chatId) ?? [];
        const targetMember = resolveCompanyMemberTarget(targetMembers, memberRefs, staffAssignMatch[1]);
        if (!targetMember) {
          await deps.sendMessage(token, chatId, "Р РЋР С•РЎвЂљРЎР‚РЎС“Р Т‘Р Р…Р С‘Р С” Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р СњР В°Р В·Р Р…Р В°РЎвЂЎР ВµР Р…Р С‘Р Вµ Р Р† Р С•РЎвЂљР Т‘Р ВµР В»" };
        }
        try {
          await deps.callInternalApi("POST", `/api/companies/${membership.company.id}/staffing/assign`, {
            actorUserId: player.id,
            targetUserId: String(targetMember.userId),
            department: staffAssignMatch[2],
          });
          await deps.sendMessage(token, chatId, "вњ… РЎРѕС‚СЂСѓРґРЅРёРє РЅР°Р·РЅР°С‡РµРЅ РІ РѕС‚РґРµР».");
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`);
        }
        await deps.sendMessage(token, chatId, await deps.formatCompanyStaffingSection(membership, chatId), {
          reply_markup: deps.buildCompanyStaffingInlineMarkup(chatId, membership.role),
        });
        return { handled: true as const, callbackText: "РќР°Р·РЅР°С‡РµРЅРёРµ РІ РѕС‚РґРµР»" };
      }

      if (data === "company:salary_setup") {
        await deps.sendMessage(token, chatId, await deps.formatCompanySalariesSection(membership, chatId), {
          reply_markup: deps.buildCompanySalariesInlineMarkup(membership, chatId),
        });
        return { handled: true as const, callbackText: "Р—Р°СЂРїР»Р°С‚С‹" };
      }

      const salaryPickMatch = data.match(/^company:salary_pick(?:_ref)?:([^:]+)$/);
      if (salaryPickMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "РљРѕРјР°РЅРґР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ Р·Р°СЂРїР»Р°С‚С‹" };
        }
        const members = await deps.storage.getCompanyMembers(membership.company.id);
        const memberRefs = deps.companyMemberRefsByChatId.get(chatId) ?? [];
        const targetMember = resolveCompanyMemberTarget(members, memberRefs, salaryPickMatch[1]);
        if (!targetMember) {
          await deps.sendMessage(token, chatId, "РЎРѕС‚СЂСѓРґРЅРёРє РЅРµ РЅР°Р№РґРµРЅ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ Р·Р°СЂРїР»Р°С‚С‹" };
        }
        deps.pendingActionByChatId.set(chatId, {
          type: "company_set_salary_amount",
          companyId: String(membership.company.id),
          memberUserId: targetMember.userId,
          memberUsername: targetMember.username,
        });
        await deps.sendMessage(
          token,
          chatId,
          `Р’РІРµРґРё Р·Р°СЂРїР»Р°С‚Сѓ РґР»СЏ ${targetMember.username} РІ GRM.\nРўРµРєСѓС‰РµРµ РѕРіСЂР°РЅРёС‡РµРЅРёРµ: 0-5000.`,
          { reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId) },
        );
        return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ Р·Р°СЂРїР»Р°С‚С‹" };
      }

      if (data === "company:warehouse_expand_preview") {
        const preview = deps.formatCompanyWarehouseExpandPreview(membership.company);
        if (messageId) {
          await deps.callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: preview.text,
            reply_markup: deps.buildCompanyWarehouseExpandInlineButtons(preview.canUpgrade),
          });
        } else {
          await deps.sendMessage(token, chatId, preview.text, {
            reply_markup: deps.buildCompanyWarehouseExpandInlineButtons(preview.canUpgrade),
          });
        }
        return { handled: true as const, callbackText: "РџСЂРѕРєР°С‡РєР° СЃРєР»Р°РґР°" };
      }

      if (data === "company:warehouse_expand_confirm") {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "РљРѕРјР°РЅРґР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїСЂРѕРєР°С‡РєРё СЃРєР»Р°РґР°" };
        }
        try {
          await deps.callInternalApi("POST", `/api/company/${membership.company.id}/expand-warehouse`, {});
          const refreshed = await deps.getPlayerCompanyContext(player.id);
          if (refreshed) {
            const previousCapacity = Math.max(0, Number(membership.company.warehouseCapacity) || 50);
            const nextCapacity = Math.max(0, Number(refreshed.company.warehouseCapacity) || previousCapacity);
            await deps.sendMessage(
              token,
              chatId,
              `вњ… РЎРєР»Р°Рґ РєРѕРјРїР°РЅРёРё РѕР±РЅРѕРІР»С‘РЅ: ${previousCapacity} в†’ ${nextCapacity} СЃР»РѕС‚РѕРІ.`,
              { reply_markup: deps.buildCompanyReplyMarkup(refreshed.role, chatId) },
            );
          } else {
            await deps.sendMessage(token, chatId, "вњ… РЎРєР»Р°Рґ РєРѕРјРїР°РЅРёРё РѕР±РЅРѕРІР»С‘РЅ.");
          }
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`);
        }
        return { handled: true as const, callbackText: "РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїСЂРѕРєР°С‡РєРё СЃРєР»Р°РґР°" };
      }

      if (data === "company:bp_join") {
        const snapshot = await deps.getCompanyBlueprintSnapshot(membership.company.id);
        const active = snapshot.active;
        if (!active || active.status !== "in_progress") {
          await deps.sendMessage(token, chatId, "в„№пёЏ РЎРµР№С‡Р°СЃ РЅРµС‚ Р°РєС‚РёРІРЅРѕР№ СЂР°Р·СЂР°Р±РѕС‚РєРё РґР»СЏ РїРѕРґРєР»СЋС‡РµРЅРёСЏ.");
          return { handled: true as const, callbackText: "РЈС‡Р°СЃС‚РёРµ РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ" };
        }
        const joined = await deps.callInternalApi("POST", `/api/companies/${membership.company.id}/blueprints/join`, {
          userId: player.id,
        });
        const updatedActive = joined?.project ?? active;
        await deps.sendMessage(
          token,
          chatId,
          [
            joined?.alreadyJoined
              ? "в„№пёЏ Р’С‹ СѓР¶Рµ СѓС‡Р°СЃС‚РІСѓРµС‚Рµ РІ СЌС‚РѕР№ СЂР°Р·СЂР°Р±РѕС‚РєРµ."
              : "вњ… Р’С‹ РїСЂРёСЃРѕРµРґРёРЅРёР»РёСЃСЊ Рє СЂР°Р·СЂР°Р±РѕС‚РєРµ. Р’Р°С€Рё РЅР°РІС‹РєРё С‚РµРїРµСЂСЊ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РІРєР»Р°РґС‹РІР°СЋС‚СЃСЏ РєР°Р¶РґС‹Рµ 5 СЃРµРєСѓРЅРґ.",
            Array.isArray(updatedActive?.participantNames) && updatedActive.participantNames.length
              ? `рџ‘Ґ РЈС‡Р°СЃС‚РЅРёРєРё: ${updatedActive.participantNames.join(", ")}`
              : "",
          ].filter(Boolean).join("\n"),
        );
        await deps.updateCompanyBlueprintProgressMessage(token, chatId, membership.company.name, membership.company.id, player.id);
        return { handled: true as const, callbackText: "РЈС‡Р°СЃС‚РёРµ РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ" };
      }

      if (data === "company:bp_progress_live") {
        await deps.updateCompanyBlueprintProgressMessage(token, chatId, membership.company.name, membership.company.id, player.id);
        return { handled: true as const, callbackText: "Р–РёРІРѕР№ РїСЂРѕРіСЂРµСЃСЃ" };
      }

      if (data === "company:leave") {
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/company_leave",
        });
        return { handled: true as const, callbackText: "Р’С‹С…РѕРґ РёР· РєРѕРјРїР°РЅРёРё" };
      }

      if (data === "company:delete") {
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/company_delete",
        });
        return { handled: true as const, callbackText: "РЈРґР°Р»РµРЅРёРµ РєРѕРјРїР°РЅРёРё" };
      }

      if (data === "company:bp_progress") {
        await deps.sendMessage(token, chatId, "в›” РЈСЃРєРѕСЂРµРЅРёРµ СЂР°Р·СЂР°Р±РѕС‚РєРё (+24С‡) РѕС‚РєР»СЋС‡РµРЅРѕ.");
        return { handled: true as const, callbackText: "РЈСЃРєРѕСЂРµРЅРёРµ РѕС‚РєР»СЋС‡РµРЅРѕ" };
      }

      const companyBlueprintStartMatch = data.match(/^company:bp_start:(.+)$/);
      if (companyBlueprintStartMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "РљРѕРјР°РЅРґР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "РЎС‚Р°СЂС‚ СЂР°Р·СЂР°Р±РѕС‚РєРё" };
        }
        if (!(await deps.ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
          return { handled: true as const, callbackText: "РЎС‚Р°СЂС‚ СЂР°Р·СЂР°Р±РѕС‚РєРё" };
        }
        if (!(await deps.ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Р Р°Р·СЂР°Р±РѕС‚РєР° Р±Р°Р·РѕРІРѕРіРѕ С‡РµСЂС‚РµР¶Р°"))) {
          return { handled: true as const, callbackText: "РЎС‚Р°СЂС‚ СЂР°Р·СЂР°Р±РѕС‚РєРё" };
        }
        await deps.startCompanyBlueprintDevelopment(token, chatId, membership, player, companyBlueprintStartMatch[1]);
        return { handled: true as const, callbackText: "РЎС‚Р°СЂС‚ СЂР°Р·СЂР°Р±РѕС‚РєРё" };
      }

      if (data === "company:bp_produce") {
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/company_bp_produce",
        });
        return { handled: true as const, callbackText: "РџСЂРѕРёР·РІРѕРґСЃС‚РІРѕ" };
      }

      const exclusivePickMatch = data.match(/^company:exclusive_pick:(.+)$/);
      if (exclusivePickMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "Р Р°Р·РґРµР» РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РіР°РґР¶РµС‚Р°", shouldClearInlineButtons: false as const };
        }
        const snapshot = await deps.getCompanyExclusiveSnapshot(membership.company.id);
        const target = (snapshot.upgradeCandidates ?? []).find((item: any) => String(item.id) === String(exclusivePickMatch[1]));
        if (!target) {
          await deps.sendMessage(token, chatId, "Р“Р°РґР¶РµС‚ РґР»СЏ EX-Р°РїРіСЂРµР№РґР° РЅРµ РЅР°Р№РґРµРЅ. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» Р·Р°РЅРѕРІРѕ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РіР°РґР¶РµС‚Р°", shouldClearInlineButtons: false as const };
        }
        deps.companyExclusiveSelectedPartRefsByChatId.delete(chatId);
        deps.companyExclusivePartPageByChatId.set(chatId, 0);
        deps.pendingActionByChatId.set(chatId, {
          type: "company_exclusive_parts",
          gadgetName: target.name,
          gadgetId: target.id,
          gadgetCategory: target.category,
          gadgetBatchAvailable: Number(target.availableQuantity || 1),
        });
        await deps.sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, target.name, target.category, Number(target.availableQuantity || 1), messageId);
        return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РіР°РґР¶РµС‚Р°", shouldClearInlineButtons: false as const };
      }

      if (data === "company:economy") {
        await deps.sendCompanyEconomySection(token, chatId, membership);
        return { handled: true as const, callbackText: "Р Р°Р·РґРµР»: Р­РєРѕРЅРѕРјРёРєР°" };
      }

      if (data === "company:ipo_run") {
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/company_ipo_run",
        });
        return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє IPO" };
      }

      if (data === "company:bp_confirm_back") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_bp_produce_confirm") {
          await deps.sendMessage(token, chatId, "РћС‚РєСЂРѕР№ В«РџСЂРѕРёР·РІРѕРґСЃС‚РІРѕ РіР°РґР¶РµС‚РѕРІВ» РµС‰С‘ СЂР°Р·.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РР·РјРµРЅРёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ" };
        }
        const blueprintSnapshot = await deps.getCompanyBlueprintSnapshot(membership.company.id);
        const blueprint = blueprintSnapshot.available.find((item: any) => item.id === pendingAction.blueprintId);
        if (!blueprint) {
          deps.pendingActionByChatId.delete(chatId);
          await deps.sendMessage(token, chatId, "Р§РµСЂС‚С‘Р¶ Р±РѕР»СЊС€Рµ РЅРµ РЅР°Р№РґРµРЅ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РР·РјРµРЅРёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ" };
        }
        const warehouseParts = [...deps.getCompanyWarehouseParts(membership.company.id)];
        const requiredParts = getBlueprintRecipeRequirements(blueprint);
        const maxByParts = requiredParts.reduce((limit: number, requirement: { partType: string; quality: string; quantity: number }) => {
          const available = warehouseParts.filter((item: any) =>
            String(item.type || item.partType || "") === requirement.partType
            && deps.normalizePartRarity(String(item.quality || item.rarity || "Common")) === deps.normalizePartRarity(requirement.quality),
          ).reduce((sum: number, item: any) => sum + Math.max(1, Number(item.quantity || 1)), 0);
          return Math.min(limit, Math.floor(available / requirement.quantity));
        }, 10);
        const maxQuantity = Math.max(1, Math.min(10, Number.isFinite(maxByParts) ? maxByParts : 1));
        deps.pendingActionByChatId.set(chatId, {
          type: "company_bp_produce_qty",
          blueprintId: blueprint.id,
          blueprintName: blueprint.name,
          maxQuantity,
        });
        const unitCost = Math.max(0, Number(blueprint.production?.costGram ?? blueprint.productionCostGrm ?? 0));
        const recipeLines = formatBlueprintRecipeAvailabilityDetails(
          blueprint,
          warehouseParts,
          deps.normalizePartRarity,
          1,
        );
        await deps.sendMessage(token, chatId, [
          `рџЏ­ ${blueprint.name}`,
          `Р”РѕСЃС‚СѓРїРЅРѕ РґР»СЏ РїР°СЂС‚РёРё: РґРѕ ${maxQuantity} С€С‚.`,
          unitCost > 0 ? `РЎРµР±РµСЃС‚РѕРёРјРѕСЃС‚СЊ Р·Р° 1 С€С‚: ${deps.formatNumber(unitCost)} GRM` : "",
          ...recipeLines,
          "",
          `Р’РІРµРґРё РєРѕР»РёС‡РµСЃС‚РІРѕ РґР»СЏ Р·Р°РїСѓСЃРєР° РїСЂРѕРёР·РІРѕРґСЃС‚РІР° (1-${maxQuantity}).`,
        ].filter(Boolean).join("\n"), {
          reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
        });
        return { handled: true as const, callbackText: "РР·РјРµРЅРёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ" };
      }

      if (data === "company:bp_confirm_start") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_bp_produce_confirm") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё С‡РµСЂС‚С‘Р¶ Рё РєРѕР»РёС‡РµСЃС‚РІРѕ РїР°СЂС‚РёРё.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє РїР°СЂС‚РёРё" };
        }
        try {
          const blueprintSnapshot = await deps.getCompanyBlueprintSnapshot(membership.company.id);
          const blueprint = blueprintSnapshot.available.find((item: any) => item.id === pendingAction.blueprintId);
          if (!blueprint) {
            deps.pendingActionByChatId.delete(chatId);
            await deps.sendMessage(token, chatId, "вќЊ РђРєС‚РёРІРЅС‹Р№ С‡РµСЂС‚С‘Р¶ Р±РѕР»СЊС€Рµ РЅРµ РЅР°Р№РґРµРЅ.", {
              reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
            });
            return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє РїР°СЂС‚РёРё" };
          }
          const warehouseParts = [...deps.getCompanyWarehouseParts(membership.company.id)];
          const requiredParts = getBlueprintRecipeRequirements(blueprint);
          const pool = buildWarehousePartPool(warehouseParts, deps.normalizePartRarity);
          const selectedParts: Array<{ id: string; type: string; rarity: string; quality: string }> = [];
          for (const requirement of requiredParts) {
            const needed = requirement.quantity * pendingAction.quantity;
            const partType = requirement.partType;
            for (let i = 0; i < needed; i += 1) {
              const idx = pool.findIndex((item) => item.type === requirement.partType && deps.normalizePartRarity(item.quality) === deps.normalizePartRarity(requirement.quality));
              if (idx === -1) throw new Error(`РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РґРµС‚Р°Р»РµР№ С‚РёРїР° ${partType} РґР»СЏ РїР°СЂС‚РёРё x${pendingAction.quantity}`);
              selectedParts.push(pool[idx]);
              pool.splice(idx, 1);
            }
          }
          const result = await deps.callInternalApi("POST", `/api/companies/${membership.company.id}/produce`, {
            userId: player.id,
            parts: selectedParts,
            quantity: pendingAction.quantity,
          });
          deps.pendingActionByChatId.delete(chatId);
          const consumeCounter = new Map<string, number>();
          for (const part of selectedParts) consumeCounter.set(part.id, (consumeCounter.get(part.id) ?? 0) + 1);
          const nextWarehouseParts: any[] = [];
          for (const part of warehouseParts) {
            const toConsume = consumeCounter.get(part.id) ?? 0;
            if (toConsume <= 0) {
              nextWarehouseParts.push(part);
              continue;
            }
            const left = Math.max(0, Math.max(1, part.quantity || 1) - toConsume);
            consumeCounter.set(part.id, Math.max(0, toConsume - Math.max(1, part.quantity || 1)));
            if (left > 0) nextWarehouseParts.push({ ...part, quantity: left });
          }
          deps.setCompanyWarehouseParts(membership.company.id, nextWarehouseParts);
          await deps.sendMessage(
            token,
            chatId,
            [
              `рџЏ­ РџР°СЂС‚РёСЏ Р·Р°РїСѓС‰РµРЅР°: ${pendingAction.blueprintName} x${pendingAction.quantity}`,
              `Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ С‡РµСЂРµР·: ${deps.formatProductionOrderRemaining((result as any).order)}`,
              Number.isFinite(Number((result as any).gramSpent)) ? `РЎРїРёСЃР°РЅРѕ: ${deps.formatNumber(Number((result as any).gramSpent))} GRM` : "",
              Number.isFinite(Number((result as any).companyBalance)) ? `Р‘Р°Р»Р°РЅСЃ РєРѕРјРїР°РЅРёРё: ${deps.formatNumber(Number((result as any).companyBalance))} GRM` : "",
              (result as any).gadgetWear?.summary ? String((result as any).gadgetWear.summary) : "",
              "РљРѕРіРґР° РїР°СЂС‚РёСЏ Р±СѓРґРµС‚ РіРѕС‚РѕРІР°, РѕС‚РєСЂРѕР№ В«РџСЂРѕРёР·РІРѕРґСЃС‚РІРѕ РіР°РґР¶РµС‚РѕРІВ» РµС‰С‘ СЂР°Р·.",
            ].filter(Boolean).join("\n"),
            { reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId) },
          );
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`, {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє РїР°СЂС‚РёРё" };
      }

      const requestAcceptMatch = data.match(/^company:request_accept:(.+)$/);
      if (requestAcceptMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "РљРѕРјР°РЅРґР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "РћРґРѕР±СЂРµРЅРёРµ Р·Р°СЏРІРєРё" };
        }
        const requests = await deps.storage.getJoinRequestsByCompany(membership.company.id);
        const request = requests.find((item: any) => item.id === requestAcceptMatch[1])
          ?? requests.find((item: any) => item.id.startsWith(requestAcceptMatch[1]))
          ?? null;
        if (!request) {
          await deps.sendMessage(token, chatId, "Р—Р°СЏРІРєР° РЅРµ РЅР°Р№РґРµРЅР°. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» Р·Р°СЏРІРѕРє РµС‰С‘ СЂР°Р·.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РћРґРѕР±СЂРµРЅРёРµ Р·Р°СЏРІРєРё" };
        }
        const existingMember = await deps.storage.getMemberByUserId(membership.company.id, request.userId);
        if (!existingMember) {
          const currentMembers = await deps.storage.getCompanyMembers(membership.company.id);
          const companyEconomy = await deps.ensureCompanyEconomyState(membership.company, currentMembers.length);
          if (currentMembers.length >= companyEconomy.employeeLimit) {
            await deps.sendMessage(
              token,
              chatId,
              `вќЊ Р›РёРјРёС‚ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ РґРѕСЃС‚РёРіРЅСѓС‚ (${currentMembers.length}/${companyEconomy.employeeLimit}). РЈР»СѓС‡С€Рё РїСЂРѕС„РёР»СЊРЅС‹Р№ РѕС‚РґРµР» Рё СЂР°СЃС€РёСЂСЊ РєРѕРјРїР°РЅРёСЋ.`,
              { reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId) },
            );
            return { handled: true as const, callbackText: "РћРґРѕР±СЂРµРЅРёРµ Р·Р°СЏРІРєРё" };
          }
          await deps.storage.addCompanyMember({
            companyId: membership.company.id,
            userId: request.userId,
            username: request.username,
            role: "member",
          });
          const updatedMembers = await deps.storage.getCompanyMembers(membership.company.id);
          await deps.ensureCompanyEconomyState(membership.company, updatedMembers.length);
        }
        await deps.storage.updateJoinRequestStatus(request.id, "accepted");
        await deps.sendMessage(token, chatId, `вњ… Р—Р°СЏРІРєР° ${request.username} РѕРґРѕР±СЂРµРЅР°.`, {
          reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
        });
        await deps.sendCompanyRequestsSection(token, chatId, membership);
        return { handled: true as const, callbackText: "РћРґРѕР±СЂРµРЅРёРµ Р·Р°СЏРІРєРё" };
      }

      const requestDeclineMatch = data.match(/^company:request_decline:(.+)$/);
      if (requestDeclineMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "РљРѕРјР°РЅРґР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "РћС‚РєР»РѕРЅРµРЅРёРµ Р·Р°СЏРІРєРё" };
        }
        const requests = await deps.storage.getJoinRequestsByCompany(membership.company.id);
        const request = requests.find((item: any) => item.id === requestDeclineMatch[1])
          ?? requests.find((item: any) => item.id.startsWith(requestDeclineMatch[1]))
          ?? null;
        if (!request) {
          await deps.sendMessage(token, chatId, "Р—Р°СЏРІРєР° РЅРµ РЅР°Р№РґРµРЅР°. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» Р·Р°СЏРІРѕРє РµС‰С‘ СЂР°Р·.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РћС‚РєР»РѕРЅРµРЅРёРµ Р·Р°СЏРІРєРё" };
        }
        await deps.storage.updateJoinRequestStatus(request.id, "rejected");
        await deps.sendMessage(token, chatId, `вњ… Р—Р°СЏРІРєР° ${request.username} РѕС‚РєР»РѕРЅРµРЅР°.`, {
          reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
        });
        await deps.sendCompanyRequestsSection(token, chatId, membership);
        return { handled: true as const, callbackText: "РћС‚РєР»РѕРЅРµРЅРёРµ Р·Р°СЏРІРєРё" };
      }

      const departmentUpgradeMatch = data.match(/^company:dept_upgrade:(researchAndDevelopment|production|marketing|finance|infrastructure)$/);
      if (departmentUpgradeMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "РљРѕРјР°РЅРґР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "РЈР»СѓС‡С€РµРЅРёРµ РѕС‚РґРµР»Р°" };
        }
        const departmentKey = departmentUpgradeMatch[1];
        const companyEconomy = await deps.ensureCompanyEconomyState(membership.company, membership.membersCount);
        const result = deps.upgradeDepartment(companyEconomy, departmentKey);
        if (!result.ok) {
          await deps.sendWithMainKeyboard(token, chatId, `вќЊ ${result.reason ?? "РЈР»СѓС‡С€РµРЅРёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ"}`);
          await deps.sendCompanyDepartmentsSection(token, chatId, membership);
          return { handled: true as const, callbackText: "РЈР»СѓС‡С€РµРЅРёРµ РѕС‚РґРµР»Р°" };
        }
        await deps.saveCompanyEconomyState(membership.company, result.company);
        await deps.sendMessage(
          token,
          chatId,
          `вњ… РћС‚РґРµР» ${deps.departmentLabels[departmentKey]} СѓР»СѓС‡С€РµРЅ РґРѕ СѓСЂРѕРІРЅСЏ ${result.company.departments[departmentKey]} (-${deps.formatNumber(result.spentGRM ?? 0)} GRM)`,
        );
        const refreshed = await deps.getPlayerCompanyContext(player.id);
        if (refreshed) {
          await deps.sendCompanyDepartmentsSection(token, chatId, refreshed);
        }
        return { handled: true as const, callbackText: "РЈР»СѓС‡С€РµРЅРёРµ РѕС‚РґРµР»Р°" };
      }

      const exclusiveToggleMatch = data.match(/^company:exclusive_part_toggle:(\d+)$/);
      if (exclusiveToggleMatch) {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° Р·Р°РїСѓСЃС‚Рё СЂР°Р·СЂР°Р±РѕС‚РєСѓ СЌРєСЃРєР»СЋР·РёРІРЅРѕРіРѕ РіР°РґР¶РµС‚Р° С‡РµСЂРµР· В«РЎС‚Р°СЂС‚В».", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р”РµС‚Р°Р»СЊ", shouldClearInlineButtons: false as const };
        }
        const refs = deps.getCompanyWarehouseParts(membership.company.id).map((item: any) => `${item.id}::${item.rarity}`);
        deps.companyExclusivePartRefsByChatId.set(chatId, refs);
        const selectedRefs = [...(deps.companyExclusiveSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
        const targetRef = refs[Number(exclusiveToggleMatch[1]) - 1];
        if (!targetRef) {
          await deps.answerCallbackQuery(token, input.callbackId, "Р”РµС‚Р°Р»СЊ РЅРµ РЅР°Р№РґРµРЅР°");
          return { handled: true as const, callbackText: "Р”РµС‚Р°Р»СЊ", shouldClearInlineButtons: false as const };
        }
        const existingIndex = selectedRefs.indexOf(targetRef);
        if (existingIndex >= 0) selectedRefs.splice(existingIndex, 1);
        else {
          if (selectedRefs.length >= deps.EXCLUSIVE_UPGRADE_REQUIRED_PARTS) {
            await deps.answerCallbackQuery(token, input.callbackId, `РќСѓР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ ${deps.EXCLUSIVE_UPGRADE_REQUIRED_PARTS} РґРµС‚Р°Р»РµР№`);
            return { handled: true as const, callbackText: "Р”РµС‚Р°Р»СЊ", shouldClearInlineButtons: false as const };
          }
          selectedRefs.push(targetRef);
        }
        deps.companyExclusiveSelectedPartRefsByChatId.set(chatId, selectedRefs);
        await deps.sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, pendingAction.gadgetName, pendingAction.gadgetCategory, pendingAction.gadgetBatchAvailable, messageId);
        return { handled: true as const, callbackText: "Р”РµС‚Р°Р»СЊ", shouldClearInlineButtons: false as const };
      }

      const exclusivePageMatch = data.match(/^company:exclusive_part_page:(stay|\d+)$/);
      if (exclusivePageMatch) {
        if (exclusivePageMatch[1] !== "stay") deps.companyExclusivePartPageByChatId.set(chatId, Math.max(0, Number(exclusivePageMatch[1]) || 0));
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° Р·Р°РїСѓСЃС‚Рё СЂР°Р·СЂР°Р±РѕС‚РєСѓ СЌРєСЃРєР»СЋР·РёРІРЅРѕРіРѕ РіР°РґР¶РµС‚Р° С‡РµСЂРµР· В«РЎС‚Р°СЂС‚В».", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎС‚СЂР°РЅРёС†Р°", shouldClearInlineButtons: false as const };
        }
        await deps.sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, pendingAction.gadgetName, pendingAction.gadgetCategory, pendingAction.gadgetBatchAvailable, messageId);
        return { handled: true as const, callbackText: "РЎС‚СЂР°РЅРёС†Р°", shouldClearInlineButtons: false as const };
      }

      if (data === "company:exclusive_part_reset") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° Р·Р°РїСѓСЃС‚Рё СЂР°Р·СЂР°Р±РѕС‚РєСѓ СЌРєСЃРєР»СЋР·РёРІРЅРѕРіРѕ РіР°РґР¶РµС‚Р° С‡РµСЂРµР· В«РЎС‚Р°СЂС‚В».", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎР±СЂРѕСЃ", shouldClearInlineButtons: false as const };
        }
        deps.companyExclusiveSelectedPartRefsByChatId.set(chatId, []);
        deps.companyExclusivePartPageByChatId.set(chatId, 0);
        await deps.sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, pendingAction.gadgetName, pendingAction.gadgetCategory, pendingAction.gadgetBatchAvailable, messageId);
        return { handled: true as const, callbackText: "РЎР±СЂРѕСЃ", shouldClearInlineButtons: false as const };
      }

      if (data === "company:exclusive_part_back") {
        deps.pendingActionByChatId.delete(chatId);
        deps.companyExclusiveSelectedPartRefsByChatId.delete(chatId);
        deps.companyExclusivePartRefsByChatId.delete(chatId);
        deps.companyExclusivePartPageByChatId.delete(chatId);
        deps.setCompanyMenuSection(chatId, "root");
        deps.rememberTelegramMenu(player.id, { menu: "company", section: "root" });
        await deps.sendCompanyRootMenu(token, chatId, player);
        return { handled: true as const, callbackText: "РќР°Р·Р°Рґ" };
      }

      if (data === "company:exclusive_part_done") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° Р·Р°РїСѓСЃС‚Рё СЂР°Р·СЂР°Р±РѕС‚РєСѓ СЌРєСЃРєР»СЋР·РёРІРЅРѕРіРѕ РіР°РґР¶РµС‚Р° С‡РµСЂРµР· В«РЎС‚Р°СЂС‚В».", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ", shouldClearInlineButtons: false as const };
        }
        const refs = deps.getCompanyWarehouseParts(membership.company.id).map((item: any) => `${item.id}::${item.rarity}`);
        deps.companyExclusivePartRefsByChatId.set(chatId, refs);
        const selectedRefs = [...(deps.companyExclusiveSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
        deps.companyExclusiveSelectedPartRefsByChatId.set(chatId, selectedRefs);
        if (selectedRefs.length !== deps.EXCLUSIVE_UPGRADE_REQUIRED_PARTS) {
          await deps.answerCallbackQuery(token, input.callbackId, `РќСѓР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ ${deps.EXCLUSIVE_UPGRADE_REQUIRED_PARTS} РґРµС‚Р°Р»РµР№`);
          await deps.sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, pendingAction.gadgetName, pendingAction.gadgetCategory, pendingAction.gadgetBatchAvailable, messageId);
          return { handled: true as const, callbackText: "РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ", shouldClearInlineButtons: false as const };
        }
        const pickedParts = deps.getCompanyWarehouseParts(membership.company.id)
          .map((item: any) => ({ ...item, ref: `${item.id}::${item.rarity}` }))
          .filter((item: any) => selectedRefs.includes(item.ref))
          .map((item: any) => ({
            id: item.id,
            rarity: String(item.rarity || "Common"),
            type: String(item.type || deps.ALL_PARTS[item.id]?.type || "processor"),
            name: String(item.name || deps.ALL_PARTS[item.id]?.name || item.id),
          }));
        try {
          const preview = await deps.previewCompanyExclusiveUpgrade(membership.company.id, player.id, String(pendingAction.gadgetId || ""), pickedParts);
          deps.pendingActionByChatId.set(chatId, {
            type: "company_exclusive_confirm",
            gadgetName: pendingAction.gadgetName,
            gadgetId: String(pendingAction.gadgetId || ""),
            partRefs: selectedRefs,
            gadgetCategory: pendingAction.gadgetCategory,
            gadgetBatchAvailable: pendingAction.gadgetBatchAvailable,
          });
          await deps.sendMessage(
            token,
            chatId,
            [
              `рџЊџ EX-Р°РїРіСЂРµР№Рґ: ${pendingAction.gadgetName}`,
              `Р¦РµР»СЊ: EX+${Math.max(1, Number(preview.blueprint?.upgradeLevel || 1))}`,
              `РџР°СЂС‚РёСЏ РіР°РґР¶РµС‚РѕРІ: ${Math.max(1, Number(preview.blueprint?.requiredGadgetCount || deps.EXCLUSIVE_UPGRADE_REQUIRED_GADGETS))}`,
              `РЁР°РЅСЃ СѓСЃРїРµС…Р°: ${Math.round(Number(preview.blueprint?.successChance || 0) * 100)}%`,
              `РЎС‚РѕРёРјРѕСЃС‚СЊ Р·Р°РїСѓСЃРєР°: ${deps.formatNumber(Number(preview.blueprint?.developmentCostGrm || 0))} GRM`,
              `Р’СЂРµРјСЏ Р°РїРіСЂРµР№РґР°: ${deps.formatDurationShort(Number(preview.blueprint?.developmentHoursRequired || 0) * 60 * 60 * 1000)}`,
              preview.companyBalanceAfterStart !== undefined ? `Р‘Р°Р»Р°РЅСЃ РєРѕРјРїР°РЅРёРё РїРѕСЃР»Рµ СЃС‚Р°СЂС‚Р°: ${deps.formatNumber(Number(preview.companyBalanceAfterStart || 0))} GRM` : "",
              "",
              "РџРѕРґС‚РІРµСЂРґРё Р·Р°РїСѓСЃРє РёР»Рё РІРµСЂРЅРёСЃСЊ Рє РїРѕРґР±РѕСЂСѓ РґРµС‚Р°Р»РµР№.",
            ].filter(Boolean).join("\n"),
            { reply_markup: deps.buildCompanyExclusiveUpgradeConfirmInlineMarkup() },
          );
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`, {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return { handled: true as const, callbackText: "РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ", shouldClearInlineButtons: false as const };
      }

      if (data === "company:exclusive_upgrade_back") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_confirm") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё РіР°РґР¶РµС‚ Рё РґРµС‚Р°Р»Рё РґР»СЏ EX-Р°РїРіСЂРµР№РґР°.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Рљ РґРµС‚Р°Р»СЏРј", shouldClearInlineButtons: false as const };
        }
        deps.pendingActionByChatId.set(chatId, {
          type: "company_exclusive_parts",
          gadgetName: pendingAction.gadgetName,
          gadgetId: pendingAction.gadgetId,
          gadgetCategory: pendingAction.gadgetCategory,
          gadgetBatchAvailable: pendingAction.gadgetBatchAvailable,
        });
        deps.companyExclusiveSelectedPartRefsByChatId.set(chatId, [...pendingAction.partRefs]);
        await deps.sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, pendingAction.gadgetName, pendingAction.gadgetCategory, pendingAction.gadgetBatchAvailable, messageId);
        return { handled: true as const, callbackText: "Рљ РґРµС‚Р°Р»СЏРј", shouldClearInlineButtons: false as const };
      }

      if (data === "company:exclusive_upgrade_start") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_confirm") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё РіР°РґР¶РµС‚ Рё РґРµС‚Р°Р»Рё РґР»СЏ EX-Р°РїРіСЂРµР№РґР°.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє EX-Р°РїРіСЂРµР№РґР°", shouldClearInlineButtons: false as const };
        }
        await deps.startCompanyExclusiveDevelopment(token, chatId, membership, player.id, pendingAction.gadgetName, pendingAction.partRefs, pendingAction.gadgetId);
        return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє EX-Р°РїРіСЂРµР№РґР°", shouldClearInlineButtons: false as const };
      }

      if (data === "company:exclusive_confirm_back") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_produce_confirm") {
          await deps.sendMessage(token, chatId, "РћС‚РєСЂРѕР№ В«Р’С‹РїСѓСЃРєВ» РµС‰С‘ СЂР°Р·.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РР·РјРµРЅРёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ" };
        }
        deps.pendingActionByChatId.set(chatId, {
          type: "company_exclusive_produce_qty",
          blueprintId: pendingAction.blueprintId,
          blueprintName: pendingAction.blueprintName,
        });
        await deps.sendMessage(token, chatId, `рџЏ­ ${pendingAction.blueprintName}\nР’РІРµРґРё РєРѕР»РёС‡РµСЃС‚РІРѕ РґР»СЏ РІС‹РїСѓСЃРєР°.`, {
          reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
        });
        return { handled: true as const, callbackText: "РР·РјРµРЅРёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ" };
      }

      if (data === "company:exclusive_confirm_start") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_exclusive_produce_confirm") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё С‡РµСЂС‚С‘Р¶ Рё РєРѕР»РёС‡РµСЃС‚РІРѕ РїР°СЂС‚РёРё.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє СЌРєСЃРєР»СЋР·РёРІРЅРѕР№ РїР°СЂС‚РёРё" };
        }
        try {
          const result = await deps.callInternalApi("POST", `/api/companies/${membership.company.id}/exclusive/produce`, {
            userId: player.id,
            blueprintId: pendingAction.blueprintId,
            quantity: pendingAction.quantity,
          });
          deps.pendingActionByChatId.delete(chatId);
          await deps.sendMessage(
            token,
            chatId,
            [
              `рџЏ­ РџР°СЂС‚РёСЏ Р·Р°РїСѓС‰РµРЅР°: ${pendingAction.blueprintName} x${pendingAction.quantity}`,
              `Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ С‡РµСЂРµР·: ${deps.formatProductionOrderRemaining((result as any).order)}`,
              Number.isFinite(Number((result as any).companyBalance)) ? `Р‘Р°Р»Р°РЅСЃ РєРѕРјРїР°РЅРёРё: ${deps.formatNumber(Number((result as any).companyBalance))} GRM` : "",
              (result as any).gadgetWear?.summary ? String((result as any).gadgetWear.summary) : "",
              "РљРѕРіРґР° РїР°СЂС‚РёСЏ Р±СѓРґРµС‚ РіРѕС‚РѕРІР°, РѕС‚РєСЂРѕР№ В«Р’С‹РїСѓСЃРєВ» РµС‰С‘ СЂР°Р·.",
            ].filter(Boolean).join("\n"),
            { reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId) },
          );
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`, {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return { handled: true as const, callbackText: "Р—Р°РїСѓСЃРє СЌРєСЃРєР»СЋР·РёРІРЅРѕР№ РїР°СЂС‚РёРё" };
      }

      const companyExclusiveProducePickMatch = data.match(/^company:exclusive_produce_pick:(.+)$/);
      if (companyExclusiveProducePickMatch) {
        if (membership.role !== "owner") {
          await deps.sendWithMainKeyboard(token, chatId, "РљРѕРјР°РЅРґР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ CEO РєРѕРјРїР°РЅРёРё.");
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РІС‹РїСѓСЃРєР°" };
        }
        const snapshot = await deps.getCompanyExclusiveSnapshot(membership.company.id);
        const target = (snapshot.catalog ?? []).find((item: any) => item.id === companyExclusiveProducePickMatch[1]);
        if (!target) {
          await deps.sendMessage(token, chatId, "Р§РµСЂС‚С‘Р¶ РЅРµ РЅР°Р№РґРµРЅ. РћС‚РєСЂРѕР№ В«Р’С‹РїСѓСЃРєВ» РµС‰С‘ СЂР°Р·.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РІС‹РїСѓСЃРєР°" };
        }
        deps.pendingActionByChatId.set(chatId, {
          type: "company_exclusive_produce_qty",
          blueprintId: target.id,
          blueprintName: target.name,
        });
        await deps.sendMessage(token, chatId, `рџЏ­ ${target.name}\nР’РІРµРґРё РєРѕР»РёС‡РµСЃС‚РІРѕ РґР»СЏ РІС‹РїСѓСЃРєР° (1-${Math.max(1, target.remainingUnits)}).`, {
          reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
        });
        return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РІС‹РїСѓСЃРєР°" };
      }

      const contractAcceptMatch = data.match(/^company:contract_accept:(\d+)$/);
      if (contractAcceptMatch) {
        await deps.handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: `/company_contract_accept ${contractAcceptMatch[1]}`,
        });
        return { handled: true as const, callbackText: "РџСЂРёРЅСЏС‚РёРµ РєРѕРЅС‚СЂР°РєС‚Р°" };
      }

      const contractPartToggleMatch = data.match(/^company:contract_part_toggle:(\d+)$/);
      if (contractPartToggleMatch) {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_contract_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РѕС‚РєСЂРѕР№ РєРѕРЅС‚СЂР°РєС‚ РєРѕРјРїР°РЅРёРё Рё Р·Р°РїСѓСЃС‚Рё РІС‹Р±РѕСЂ РґРµС‚Р°Р»РµР№.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РґРµС‚Р°Р»Рё", shouldClearInlineButtons: false as const };
        }
        const contracts = await deps.getCityContracts(membership.company.city);
        const contract = contracts.find((item: any) => item.id === pendingAction.contractId);
        if (!contract) {
          deps.clearPendingActionRuntimeState(chatId, pendingAction);
          await deps.sendMessage(token, chatId, "РљРѕРЅС‚СЂР°РєС‚ Р±РѕР»СЊС€Рµ РЅРµ РЅР°Р№РґРµРЅ. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» СЂР°Р±РѕС‚С‹ РєРѕРјРїР°РЅРёРё Р·Р°РЅРѕРІРѕ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РґРµС‚Р°Р»Рё", shouldClearInlineButtons: false as const };
        }
        const refs = deps.getCompanyWarehousePartUnitRefs(membership.company.id, pendingAction.requiredPartType).map((item: any) => item.ref);
        const selectedRefs = [...(deps.companyContractSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
        const targetRef = refs[Number(contractPartToggleMatch[1]) - 1];
        if (!targetRef) {
          await deps.answerCallbackQuery(token, input.callbackId, "Р”РµС‚Р°Р»СЊ РЅРµ РЅР°Р№РґРµРЅР°");
          return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РґРµС‚Р°Р»Рё", shouldClearInlineButtons: false as const };
        }
        const existingIndex = selectedRefs.indexOf(targetRef);
        if (existingIndex >= 0) selectedRefs.splice(existingIndex, 1);
        else {
          if (selectedRefs.length >= pendingAction.requiredQuantity) {
            await deps.answerCallbackQuery(token, input.callbackId, `РњРѕР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ С‚РѕР»СЊРєРѕ ${pendingAction.requiredQuantity}`);
            return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РґРµС‚Р°Р»Рё", shouldClearInlineButtons: false as const };
          }
          selectedRefs.push(targetRef);
        }
        deps.companyContractSelectedPartRefsByChatId.set(chatId, selectedRefs);
        await deps.sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
        return { handled: true as const, callbackText: "Р’С‹Р±РѕСЂ РґРµС‚Р°Р»Рё", shouldClearInlineButtons: false as const };
      }

      const contractPartPageMatch = data.match(/^company:contract_part_page:(stay|\d+)$/);
      if (contractPartPageMatch) {
        if (contractPartPageMatch[1] !== "stay") deps.companyContractPartPageByChatId.set(chatId, Math.max(0, Number(contractPartPageMatch[1]) || 0));
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_contract_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РѕС‚РєСЂРѕР№ РєРѕРЅС‚СЂР°РєС‚ РєРѕРјРїР°РЅРёРё Рё Р·Р°РїСѓСЃС‚Рё РІС‹Р±РѕСЂ РґРµС‚Р°Р»РµР№.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎС‚СЂР°РЅРёС†Р° РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
        }
        const contracts = await deps.getCityContracts(membership.company.city);
        const contract = contracts.find((item: any) => item.id === pendingAction.contractId);
        if (!contract) {
          deps.clearPendingActionRuntimeState(chatId, pendingAction);
          await deps.sendMessage(token, chatId, "РљРѕРЅС‚СЂР°РєС‚ Р±РѕР»СЊС€Рµ РЅРµ РЅР°Р№РґРµРЅ. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» СЂР°Р±РѕС‚С‹ РєРѕРјРїР°РЅРёРё Р·Р°РЅРѕРІРѕ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎС‚СЂР°РЅРёС†Р° РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
        }
        await deps.sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
        return { handled: true as const, callbackText: "РЎС‚СЂР°РЅРёС†Р° РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
      }

      if (data === "company:contract_part_reset") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_contract_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РѕС‚РєСЂРѕР№ РєРѕРЅС‚СЂР°РєС‚ РєРѕРјРїР°РЅРёРё Рё Р·Р°РїСѓСЃС‚Рё РІС‹Р±РѕСЂ РґРµС‚Р°Р»РµР№.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎР±СЂРѕСЃ РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
        }
        const contracts = await deps.getCityContracts(membership.company.city);
        const contract = contracts.find((item: any) => item.id === pendingAction.contractId);
        if (!contract) {
          deps.clearPendingActionRuntimeState(chatId, pendingAction);
          await deps.sendMessage(token, chatId, "РљРѕРЅС‚СЂР°РєС‚ Р±РѕР»СЊС€Рµ РЅРµ РЅР°Р№РґРµРЅ. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» СЂР°Р±РѕС‚С‹ РєРѕРјРїР°РЅРёРё Р·Р°РЅРѕРІРѕ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎР±СЂРѕСЃ РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
        }
        deps.companyContractSelectedPartRefsByChatId.set(chatId, []);
        deps.companyContractPartPageByChatId.set(chatId, 0);
        await deps.sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
        return { handled: true as const, callbackText: "РЎР±СЂРѕСЃ РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
      }

      if (data === "company:contract_part_back") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (pendingAction && pendingAction.type === "company_contract_parts") deps.clearPendingActionRuntimeState(chatId, pendingAction);
        await deps.sendCompanyWorkSection(token, chatId, membership);
        return { handled: true as const, callbackText: "РќР°Р·Р°Рґ Рє РєРѕРЅС‚СЂР°РєС‚Р°Рј" };
      }

      if (data === "company:contract_part_done") {
        const pendingAction = deps.pendingActionByChatId.get(chatId);
        if (!pendingAction || pendingAction.type !== "company_contract_parts") {
          await deps.sendMessage(token, chatId, "РЎРЅР°С‡Р°Р»Р° РѕС‚РєСЂРѕР№ РєРѕРЅС‚СЂР°РєС‚ РєРѕРјРїР°РЅРёРё Рё Р·Р°РїСѓСЃС‚Рё РІС‹Р±РѕСЂ РґРµС‚Р°Р»РµР№.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎРґР°С‡Р° РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
        }
        const contracts = await deps.getCityContracts(membership.company.city);
        const contract = contracts.find((item: any) => item.id === pendingAction.contractId);
        if (!contract) {
          deps.clearPendingActionRuntimeState(chatId, pendingAction);
          await deps.sendMessage(token, chatId, "РљРѕРЅС‚СЂР°РєС‚ Р±РѕР»СЊС€Рµ РЅРµ РЅР°Р№РґРµРЅ. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» СЂР°Р±РѕС‚С‹ РєРѕРјРїР°РЅРёРё Р·Р°РЅРѕРІРѕ.", {
            reply_markup: deps.buildCompanyReplyMarkup(membership.role, chatId),
          });
          return { handled: true as const, callbackText: "РЎРґР°С‡Р° РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
        }
        const refs = deps.getCompanyWarehousePartUnitRefs(membership.company.id, pendingAction.requiredPartType).map((item: any) => item.ref);
        const selectedRefs = [...(deps.companyContractSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
        deps.companyContractSelectedPartRefsByChatId.set(chatId, selectedRefs);
        if (selectedRefs.length !== pendingAction.requiredQuantity) {
          await deps.answerCallbackQuery(token, input.callbackId, `РќСѓР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ ${pendingAction.requiredQuantity} РґРµС‚Р°Р»РµР№`);
          await deps.sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
          return { handled: true as const, callbackText: "РЎРґР°С‡Р° РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
        }
        try {
          await deps.completeCompanyContractDelivery(token, chatId, membership, contract, player.id, { partRefs: selectedRefs });
          deps.clearPendingActionRuntimeState(chatId, pendingAction);
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`);
        }
        await deps.sendCompanyWorkSection(token, chatId, membership);
        return { handled: true as const, callbackText: "РЎРґР°С‡Р° РґРµС‚Р°Р»РµР№", shouldClearInlineButtons: false as const };
      }

      const contractDeliverMatch = data.match(/^company:contract_deliver:(\d+)$/);
      if (contractDeliverMatch) {
        if (!(await deps.ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "РљРѕРЅС‚СЂР°РєС‚С‹ РєРѕРјРїР°РЅРёРё"))) {
          return { handled: true as const, callbackText: "РЎРґР°С‡Р° РєРѕРЅС‚СЂР°РєС‚Р°" };
        }
        const contracts = await deps.getCityContracts(membership.company.city);
        const selected = deps.resolveContractRef(chatId, contractDeliverMatch[1], contracts);
        if (!selected) {
          await deps.sendMessage(token, chatId, "РљРѕРЅС‚СЂР°РєС‚ РЅРµ РЅР°Р№РґРµРЅ. РћС‚РєСЂРѕР№ СЂР°Р·РґРµР» В«Р Р°Р±РѕС‚Р°В» РєРЅРѕРїРєРѕР№ РЅРёР¶Рµ.");
          return { handled: true as const, callbackText: "РЎРґР°С‡Р° РєРѕРЅС‚СЂР°РєС‚Р°" };
        }
        try {
          if (selected.kind === "parts_supply") {
            await deps.startCompanyContractPartSelection(token, chatId, membership, player.id, selected);
          } else {
            await deps.completeCompanyContractDelivery(token, chatId, membership, selected, player.id);
            await deps.sendCompanyWorkSection(token, chatId, membership);
          }
        } catch (error) {
          await deps.sendMessage(token, chatId, `вќЊ ${deps.extractErrorMessage(error)}`);
        }
        return { handled: true as const, callbackText: "РЎРґР°С‡Р° РєРѕРЅС‚СЂР°РєС‚Р°" };
      }

      return { handled: false as const };
    },
  };
}
