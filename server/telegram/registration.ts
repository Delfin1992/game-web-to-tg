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
    { text: `➖ ${input.skillLabels[skill]}`, callback_data: `reg_skills:sub:${skill}` },
    { text: `➕ ${input.skillLabels[skill]}`, callback_data: `reg_skills:add:${skill}` },
  ]);
  rows.push([{ text: `✅ Подтвердить (${input.totalPoints - left}/${input.totalPoints})`, callback_data: "reg_skills:confirm" }]);
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
    "5/5. Распредели 10 очков навыков:",
    "",
    "Эти очки пригодятся в работе компании и в PvP.",
    "",
    ...input.skillOrder.map((skill) => `• ${input.skillLabels[skill]}: ${skills[skill]}`),
    "",
    `Осталось очков: ${left}`,
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
        "🧑‍💻 Привет. Добро пожаловать в Gadget Lab.",
        "",
        "Сделаем всё быстро и по-человечески:",
        "1. Выберем город стажировки",
        "2. Придумаем ник",
        "3. Определим твой рабочий стиль",
        "4. Пройдём короткое мини-собеседование",
        "5. Соберём первый прототип",
        "",
        "После этого откроется вся игра.",
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🚀 Поехали", callback_data: "reg_tutorial:intro:start" }]],
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
        "🌍 Шаг 1/5. С чего начнём: выбери город стажировки.",
        "Это твоя стартовая база. От города зависят экономика, бонусы и общий ритм старта.",
        input.cityCapacityMessage,
        "",
        "🌉 San Francisco",
        "Амбициозный старт: больше денег и темпа, но и требования выше.",
        "",
        "Во время тестов открыт только этот город.",
        "Выбор важный: бонусы города будут работать постоянно.",
      ].join("\n"),
      { reply_markup: input.buildRegistrationCityChoiceMarkup() },
    );
    return;
  }

  if (input.step === "registration_aptitude") {
    input.pendingActionByChatId.set(input.chatId, { type: "registration_aptitude" });
    if (!user) {
      await input.sendWithMainKeyboard(input.token, input.chatId, "Профиль не найден. Отправь /start ещё раз.");
      return;
    }
    const question = input.getTelegramRegistrationQuestion(user);
    if (!question) {
      await input.sendWithMainKeyboard(input.token, input.chatId, "Интервью уже завершено. Переходим к первому прототипу.");
      return;
    }
    const answers = input.buildPlayerRegistrationState(user).registrationFlow.answers ?? {};
    const answeredCount = input.registrationInterviewQuestions.filter((item) => answers[item.id]).length;
    const sent = await input.sendMessage(
      input.token,
      input.chatId,
      [
        `🧠 Шаг 4/5. ${question.title}`,
        ...(answeredCount === 0
          ? [
            "Сейчас будет короткое мини-собеседование.",
            "От твоих ответов зависит стартовый билд для работы, компании и PvP.",
            "После каждого ответа я сразу покажу, что именно усилилось.",
            "",
            question.prompt,
            "",
          ]
          : [question.prompt, ""]),
        ...question.options.map((option: any, index: number) => `${index + 1}. ${input.formatInterviewOptionButtonLabel(question.id, option.id)} — ${input.formatInterviewSkillHint(option.skillWeights as Record<string, number> | undefined)}`),
        "",
        "Выбери один вариант ответа:",
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: question.options.map((option: any) => [{
            text: input.formatInterviewOptionButtonLabel(question.id, option.id),
            callback_data: `reg_tutorial:answer:${question.id}:${option.id}`,
          }]),
        },
      },
    );
    if (Number(sent?.message_id || 0)) {
      input.registrationInterviewMessageByChatId.set(input.chatId, Number(sent.message_id));
    }
    return;
  }

  if (input.step === "registration_first_craft") {
    input.pendingActionByChatId.set(input.chatId, { type: "registration_first_craft" });
    if (!user) {
      await input.sendWithMainKeyboard(input.token, input.chatId, "Профиль не найден. Отправь /start ещё раз.");
      return;
    }
    const registration = input.buildPlayerRegistrationState(user);
    const tutorialCompany = await input.storage.getTutorialCompanyByOwner(user.id);
    const cityLabel = registration.city ?? user.city;
    await input.sendMessage(
      input.token,
      input.chatId,
      [
        "🛠 Шаг 5/5. Первый рабочий прототип.",
        `📍 Город: ${cityLabel}`,
        `📐 Чертёж выдан: ${input.tutorialDemoBlueprint.name}`,
        "🧩 Детали для тестовой сборки уже зарезервированы и не тронут твою реальную экономику.",
        tutorialCompany ? `🏢 Тестовая мастерская: ${tutorialCompany.name}` : "🏢 Подготовим тестовую мастерскую автоматически.",
        "",
        "Что будет дальше:",
        "1. Запускаешь разработку чертежа",
        "2. Видишь живой прогресс по шкале",
        "3. После готовности собираешь первый гаджет",
        "4. Гаджет автоматически попадёт в твой инвентарь",
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📐 Запустить чертёж", callback_data: "reg_tutorial:first_craft:start_blueprint" }],
          ],
        },
      },
    );
  }
}
