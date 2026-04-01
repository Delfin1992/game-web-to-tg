export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramMessage = {
  chat?: { id: number };
  text?: string;
  from?: TelegramUser;
};

export type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: TelegramUser;
  message?: {
    chat?: { id: number };
    message_id?: number;
  };
};

export type TelegramMessageDispatchContext = {
  token: string;
  webAppUrl: string;
  message: TelegramMessage;
  chatId: number;
  text: string;
  command: string;
  args: string[];
  player: any;
};

export type TelegramCallbackDispatchContext = {
  token: string;
  webAppUrl: string;
  query: TelegramCallbackQuery;
  chatId: number;
  messageId?: number;
  callbackId: string;
  data: string;
};

export type TelegramCallbackDispatchResult = {
  handled: boolean;
  callbackText?: string;
  shouldClearInlineButtons?: boolean;
};

export { startTelegramBot } from "./bot";
