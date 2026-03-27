/**
 * Transitional company orchestration module.
 * Heavy domain logic still lives in telegram.ts and existing services, but section senders move here.
 */

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
    blueprintRefs?: string[],
  ) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyBureauSection(input.membership, input.chatId, input.userId);
  await input.sendMessage(input.token, input.chatId, view.text, {
    reply_markup: input.buildCompanyBureauInlineButtons(
      input.membership.role === "owner",
      view.snapshot.active?.status,
      view.miningStatus,
      view.blueprintRefs,
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
    blueprintRefs?: string[],
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
    view.blueprintRefs,
  );
  if (input.messageId) {
    await input.callTelegramApi(input.token, "editMessageText", {
      chat_id: input.chatId,
      message_id: input.messageId,
      text,
      reply_markup: replyMarkup,
    });
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
  formatCompanyDepartmentsSection: (membership: any) => Promise<{ text: string }>;
  buildCompanyReplyMarkup: (role?: string | null, chatId?: number) => unknown;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const view = await input.formatCompanyDepartmentsSection(input.membership);
  await input.sendMessage(input.token, input.chatId, view.text, {
    reply_markup: input.buildCompanyReplyMarkup(input.membership.role, input.chatId),
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
    await input.sendMessage(input.token, input.chatId, "📥 Входящих заявок нет.", {
      reply_markup: input.buildCompanyReplyMarkup(input.membership.role, input.chatId),
    });
    return;
  }

  input.companyRequestsByChatId.set(input.chatId, requests.map((request) => request.id));
  await input.sendMessage(
    input.token,
    input.chatId,
    [
      `📥 ЗАЯВКИ В "${input.membership.company.name}"`,
      "━━━━━━━━━━━━━━",
      ...requests.map((request, index) => `${index + 1}. ${request.username}`),
    ].join("\n"),
    {
      reply_markup: {
        inline_keyboard: [
          ...requests.flatMap((request, index) => ([
            [{ text: `${index + 1}. ${request.username}`, callback_data: "company:requests" }],
            [
              { text: "✅ Одобрить", callback_data: `company:request_accept:${request.id}` },
              { text: "❌ Отклонить", callback_data: `company:request_decline:${request.id}` },
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
