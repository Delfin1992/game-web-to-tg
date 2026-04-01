/**
 * Transitional registration module.
 * Keeps legacy registration behavior while moving onboarding helpers out of telegram.ts.
 */

export function normalizePersonalitySlideIndex(indexRaw: number, total: number) {
  const max = total - 1;
  if (indexRaw < 0) return max;
  if (indexRaw > max) return 0;
  return indexRaw;
}

export function normalizeGenderSlideIndex(indexRaw: number, total: number) {
  const max = total - 1;
  if (indexRaw < 0) return max;
  if (indexRaw > max) return 0;
  return indexRaw;
}

export function normalizeCitySlideIndex(indexRaw: number, total: number) {
  const max = total - 1;
  if (indexRaw < 0) return max;
  if (indexRaw > max) return 0;
  return indexRaw;
}

export function getDraftRegistrationSkills(input: {
  chatId: number;
  registrationDraftByChatId: Map<number, any>;
  skillOrder: string[];
}) {
  const { chatId, registrationDraftByChatId, skillOrder } = input;
  const draft = registrationDraftByChatId.get(chatId);
  const base: Record<string, number> = Object.fromEntries(skillOrder.map((skill) => [skill, 0]));
  for (const skill of skillOrder) {
    base[skill] = Math.max(0, Math.floor(Number(draft?.skills?.[skill] || 0)));
  }
  return base;
}

export function getDraftRegistrationSkillPointsLeft(input: {
  chatId: number;
  registrationDraftByChatId: Map<number, any>;
  skillOrder: string[];
  totalPoints: number;
}) {
  const skills = getDraftRegistrationSkills(input);
  const spent = input.skillOrder.reduce((sum, skill) => sum + Math.max(0, Number(skills[skill] || 0)), 0);
  return Math.max(0, input.totalPoints - spent);
}

export function buildRegistrationSkillsInlineMarkup(input: {
  chatId: number;
  registrationDraftByChatId: Map<number, any>;
  skillOrder: string[];
  skillLabels: Record<string, string>;
  totalPoints: number;
}) {
  const left = getDraftRegistrationSkillPointsLeft(input);
  const rows = input.skillOrder.map((skill) => [
    { text: `вћ– ${input.skillLabels[skill]}`, callback_data: `reg_skills:sub:${skill}` },
    { text: `вћ• ${input.skillLabels[skill]}`, callback_data: `reg_skills:add:${skill}` },
  ]);
  rows.push([{ text: `вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ (${input.totalPoints - left}/${input.totalPoints})`, callback_data: "reg_skills:confirm" }]);
  return { inline_keyboard: rows };
}

export function formatRegistrationSkillsMessage(input: {
  chatId: number;
  registrationDraftByChatId: Map<number, any>;
  skillOrder: string[];
  skillLabels: Record<string, string>;
  totalPoints: number;
}) {
  const skills = getDraftRegistrationSkills(input);
  const left = getDraftRegistrationSkillPointsLeft(input);
  return [
    "5/5. Р Р°СЃРїСЂРµРґРµР»Рё 10 РѕС‡РєРѕРІ РЅР°РІС‹РєРѕРІ:",
    "",
    "Р­С‚Рё РѕС‡РєРё РїСЂРёРіРѕРґСЏС‚СЃСЏ РІ СЂР°Р±РѕС‚Рµ РєРѕРјРїР°РЅРёРё Рё РІ PvP.",
    "",
    ...input.skillOrder.map((skill) => `вЂў ${input.skillLabels[skill]}: ${skills[skill]}`),
    "",
    `РћСЃС‚Р°Р»РѕСЃСЊ РѕС‡РєРѕРІ: ${left}`,
  ].join("\n");
}

export async function sendRegistrationSkillsPicker(input: {
  token: string;
  chatId: number;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  registrationDraftByChatId: Map<number, any>;
  skillOrder: string[];
  skillLabels: Record<string, string>;
  totalPoints: number;
}) {
  await input.sendMessage(
    input.token,
    input.chatId,
    formatRegistrationSkillsMessage(input),
    {
      reply_markup: buildRegistrationSkillsInlineMarkup(input),
    },
  );
}

export async function sendRegistrationPersonalityPicker(input: {
  token: string;
  chatId: number;
  indexRaw: number;
  total: number;
  formatter: (index: number) => Promise<string>;
  buildMarkup: (index: number) => Record<string, unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const index = normalizePersonalitySlideIndex(input.indexRaw, input.total);
  await input.sendMessage(input.token, input.chatId, await input.formatter(index), {
    reply_markup: input.buildMarkup(index),
  });
}

export async function sendRegistrationGenderPicker(input: {
  token: string;
  chatId: number;
  indexRaw: number;
  total: number;
  formatter: (index: number) => string;
  buildMarkup: (index: number) => Record<string, unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const index = normalizeGenderSlideIndex(input.indexRaw, input.total);
  await input.sendMessage(input.token, input.chatId, input.formatter(index), {
    reply_markup: input.buildMarkup(index),
  });
}

export async function sendRegistrationCityPicker(input: {
  token: string;
  chatId: number;
  indexRaw: number;
  total: number;
  formatter: (index: number) => Promise<string>;
  buildMarkup: (index: number) => Record<string, unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const index = normalizeCitySlideIndex(input.indexRaw, input.total);
  await input.sendMessage(input.token, input.chatId, await input.formatter(index), {
    reply_markup: input.buildMarkup(index),
  });
}

export async function sendTelegramRegistrationStepPrompt(input: {
  token: string;
  chatId: number;
  step: string;
  registrationDraftByChatId: Map<number, any>;
  registrationInterviewMessageByChatId: Map<number, number>;
  registrationInterviewFeedbackMessageByChatId: Map<number, number>;
  pendingActionByChatId: Map<number, any>;
  storage: any;
  callTelegramApi: (token: string, method: string, body: Record<string, unknown>) => Promise<unknown>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  getTelegramRegistrationQuestion: (user: any) => any;
  buildPlayerRegistrationState: (user: any) => any;
  registrationInterviewQuestions: any[];
  formatInterviewOptionButtonLabel: (questionId: string, optionId: string) => string;
  formatInterviewSkillHint: (skillWeights?: Record<string, number>) => string;
  tutorialDemoBlueprint: { name: string };
  cityCapacityMessage: string;
  buildRegistrationCityChoiceMarkup: () => Record<string, unknown>;
}) {
  const draft = input.registrationDraftByChatId.get(input.chatId);
  const userId = draft?.userId;
  const user = userId ? await input.storage.getUser(userId) : null;

  if (input.step !== "registration_aptitude") {
    const interviewMessageId = input.registrationInterviewMessageByChatId.get(input.chatId);
    if (interviewMessageId) {
      try {
        await input.callTelegramApi(input.token, "deleteMessage", { chat_id: input.chatId, message_id: interviewMessageId });
      } catch {}
      input.registrationInterviewMessageByChatId.delete(input.chatId);
    }
    const feedbackMessageId = input.registrationInterviewFeedbackMessageByChatId.get(input.chatId);
    if (feedbackMessageId) {
      try {
        await input.callTelegramApi(input.token, "deleteMessage", { chat_id: input.chatId, message_id: feedbackMessageId });
      } catch {}
      input.registrationInterviewFeedbackMessageByChatId.delete(input.chatId);
    }
  }

  if (input.step === "registration_intro") {
    input.pendingActionByChatId.set(input.chatId, { type: "registration_intro" });
    await input.sendMessage(
      input.token,
      input.chatId,
      [
        "рџ§‘вЂЌрџ’» РџСЂРёРІРµС‚. Р”РѕР±СЂРѕ РїРѕР¶Р°Р»РѕРІР°С‚СЊ РІ Gadget Lab.",
        "",
        "РЎРґРµР»Р°РµРј РІСЃС‘ Р±С‹СЃС‚СЂРѕ Рё РїРѕ-С‡РµР»РѕРІРµС‡РµСЃРєРё:",
        "1. Р’С‹Р±РµСЂРµРј РіРѕСЂРѕРґ СЃС‚Р°Р¶РёСЂРѕРІРєРё",
        "2. РџСЂРёРґСѓРјР°РµРј РЅРёРє",
        "3. РћРїСЂРµРґРµР»РёРј С‚РІРѕР№ СЂР°Р±РѕС‡РёР№ СЃС‚РёР»СЊ",
        "4. РџСЂРѕР№РґС‘Рј РєРѕСЂРѕС‚РєРѕРµ РјРёРЅРё-СЃРѕР±РµСЃРµРґРѕРІР°РЅРёРµ",
        "5. РЎРѕР±РµСЂС‘Рј РїРµСЂРІС‹Р№ РїСЂРѕС‚РѕС‚РёРї",
        "",
        "РџРѕСЃР»Рµ СЌС‚РѕРіРѕ РѕС‚РєСЂРѕРµС‚СЃСЏ РІСЃСЏ РёРіСЂР°.",
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [[{ text: "рџљЂ РџРѕРµС…Р°Р»Рё", callback_data: "reg_tutorial:intro:start" }]],
        },
      },
    );
    return;
  }

  if (input.step === "register_username") {
    input.pendingActionByChatId.set(input.chatId, { type: "register_username" });
    await input.sendMessage(
      input.token,
      input.chatId,
      [
        "✍️ Шаг 2/5. Теперь нужен ник.",
        "Его будут видеть другие игроки, так что лучше выбрать что-то короткое и запоминающееся.",
        "",
        "Подойдёт формат:",
        "• от 3 до 10 символов",
        "• буквы, цифры, _ и -",
        "• без пробелов и слеш-команд",
      ].join("\n"),
      { reply_markup: { remove_keyboard: true } },
    );
    return;
  }

  if (input.step === "registration_city") {
    input.pendingActionByChatId.set(input.chatId, { type: "registration_city" });
    await input.sendMessage(
      input.token,
      input.chatId,
      [
        "🌍 Шаг 1/5. Выбери город стажировки.",
        "Это стартовая база персонажа. От города зависят экономика, темп и часть бонусов.",
        input.cityCapacityMessage,
        "",
        "Во время тестов открыт только San Francisco.",
      ].join("\n"),
      { reply_markup: input.buildRegistrationCityChoiceMarkup() },
    );
    return;
  }

  if (input.step === "registration_aptitude") {
    input.pendingActionByChatId.set(input.chatId, { type: "registration_aptitude" });
    if (!user) {
      await input.sendWithMainKeyboard(input.token, input.chatId, "Профиль не найден. Отправь /start.");
      return;
    }
    const question = input.getTelegramRegistrationQuestion(user);
    if (!question) {
      await input.sendMessage(
        input.token,
        input.chatId,
        [
          "✅ Интервью завершено.",
          "Твои стартовые навыки уже распределены по ответам.",
        ].join("\n"),
      );
      return;
    }
    const answerRows = (question.options ?? []).map((option: any) => [{
      text: input.formatInterviewOptionButtonLabel(question.id, option.id),
      callback_data: `reg_tutorial:answer:${question.id}:${option.id}`,
    }]);
    const text = [
      "🧠 Мини-интервью",
      "",
      String(question.prompt || question.text || "Выбери ответ:"),
      "",
      ...(question.options ?? []).map((option: any, index: number) => {
        const hint = input.formatInterviewSkillHint(option.skillWeights);
        return `${index + 1}. ${String(option.label || option.text || option.id)}\n${hint}`;
      }),
    ].join("\n");
    const message = await input.sendMessage(
      input.token,
      input.chatId,
      text,
      { reply_markup: { inline_keyboard: answerRows } },
    );
    if (Number(message?.message_id || 0)) {
      input.registrationInterviewMessageByChatId.set(input.chatId, Number(message.message_id));
    }
    return;
  }

  if (input.step === "registration_first_craft") {
    input.pendingActionByChatId.set(input.chatId, { type: "registration_first_craft" });
    await input.sendMessage(
      input.token,
      input.chatId,
      [
        `🧪 Первый прототип: ${input.tutorialDemoBlueprint.name}`,
        "",
        "Финальный шаг регистрации: запускаем разработку учебного чертежа, а потом собираем первый гаджет.",
        "После этого откроется полноценная игра.",
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📐 Запустить чертёж", callback_data: "reg_tutorial:first_craft:start_blueprint" }],
            [{ text: "⏱ Проверить прогресс", callback_data: "reg_tutorial:bp_check" }],
          ],
        },
      },
    );
    return;
  }
}

type RegistrationTelegramModuleDeps = {
  registrationDraftByChatId: Map<number, any>;
  pendingActionByChatId: Map<number, any>;
  buildPlayerRegistrationState: (user: any) => { registrationStep?: string };
  promptStep: (token: string, chatId: number, step: any) => Promise<void>;
  handlePendingAction: (input: any) => Promise<boolean>;
  handleCallback: (input: any) => Promise<any>;
};

export function createRegistrationTelegramModule(deps: RegistrationTelegramModuleDeps) {
  const registrationPendingStepSet = new Set([
    "registration_intro",
    "register_username",
    "registration_city",
    "registration_aptitude",
    "register_personality",
    "registration_first_craft",
  ]);

  return {
    resolveStep(user: any, chatId: number) {
      const registration = deps.buildPlayerRegistrationState(user);
      const actualStep =
        registration.registrationStep === "intro"
          ? "registration_intro"
          : registration.registrationStep === "name"
            ? "register_username"
            : registration.registrationStep === "city_selection"
              ? "registration_city"
              : registration.registrationStep === "personality"
                ? "register_personality"
                : registration.registrationStep === "aptitude_test"
                  ? "registration_aptitude"
                  : registration.registrationStep === "first_craft"
                    ? "registration_first_craft"
                    : null;

      const pendingAction = deps.pendingActionByChatId.get(chatId);
      if (registrationPendingStepSet.has(String(pendingAction?.type || ""))) {
        if (pendingAction.type === actualStep) {
          return pendingAction.type;
        }
        deps.pendingActionByChatId.delete(chatId);
      }

      return actualStep;
    },

    async beginRegistration(token: string, chatId: number, user: any, startPayload?: string, step: any = "registration_intro") {
      const existingDraft = deps.registrationDraftByChatId.get(chatId);
      const draft = existingDraft && existingDraft.userId === user.id
        ? { ...existingDraft }
        : { userId: user.id };

      if (startPayload) {
        draft.startPayload = startPayload;
      }

      deps.registrationDraftByChatId.set(chatId, draft);
      deps.pendingActionByChatId.set(chatId, { type: step });
      await deps.promptStep(token, chatId, step);
    },

    handlePendingAction: deps.handlePendingAction,
    handleCallback: deps.handleCallback,
  };
}
