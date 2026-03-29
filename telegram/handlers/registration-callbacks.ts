/**
 * Registration-specific callback handler extracted from the legacy callback router.
 * Returns null when the callback does not belong to registration flow.
 */

export async function handleRegistrationCallback(input: {
  data: string;
  token: string;
  chatId: number;
  messageId?: number;
  callbackId: string;
  query: any;
  webAppUrl: string;
  registrationDraftByChatId: Map<number, any>;
  registrationInterviewMessageByChatId: Map<number, number>;
  registrationInterviewFeedbackMessageByChatId: Map<number, number>;
  registrationTutorialAnimationByChatId: Map<number, any>;
  pendingActionByChatId: Map<number, any>;
  storage: any;
  callInternalApi: (method: "GET" | "POST", path: string, body?: Record<string, unknown>) => Promise<any>;
  callTelegramApi: (token: string, method: string, body: Record<string, unknown>) => Promise<any>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  sendTelegramRegistrationStepPrompt: (token: string, chatId: number, step: any) => Promise<void>;
  handleIncomingMessage: (token: string, webAppUrl: string, message: any) => Promise<void>;
  buildInterviewAnswerFeedback: (user: any, questionId: string, answerId: string) => string;
  formatProjectedRegistrationSkills: (skills?: Record<string, number>) => string;
  formatStats: (stats: Record<string, number>) => string;
  normalizeCitySlideIndex: (index: number) => number;
  normalizePersonalitySlideIndex: (index: number) => number;
  normalizeGenderSlideIndex: (index: number) => number;
  formatRegistrationCitySlide: (index: number) => Promise<string>;
  formatRegistrationPersonalitySlide: (index: number) => Promise<string>;
  formatRegistrationGenderSlide: (index: number) => string;
  buildRegistrationCityInlineMarkup: (index: number) => any;
  buildRegistrationPersonalityInlineMarkup: (index: number) => any;
  buildRegistrationGenderInlineMarkup: (index: number) => any;
  buildPlayerRegistrationState: (user: any) => any;
  registrationInterviewQuestions: any[];
  tutorialDemoBlueprint: { id: string; name: string; timeSeconds: number };
  runRegistrationTutorialProgressAnimation: (input: any) => Promise<void>;
  formatRegistrationTutorialBlueprintProgress: (secondsDone: number, totalSeconds: number) => string;
  formatRegistrationTutorialProduceProgress: (secondsDone: number, totalSeconds: number) => string;
  grantStarterHousing: (userId: string) => Promise<any>;
  resolveTelegramRegistrationStep: (user: any, chatId: number) => any;
  applyReferralFromStartPayload: (player: any, startPayload?: string) => Promise<any>;
  resolveTelegramSnapshot: (user?: any) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  referralNewPlayerReward: number;
  referralInviterReward: number;
  getTelegramIdByUserId: (userId: string) => string | undefined;
  getActiveHousing: (user: any) => any;
  getStarterHousingForCity: (city: string) => any;
  sendHousingCard: (token: string, chatId: number, user: any, house: any, prefix?: string) => Promise<void>;
  notifyReferralInviter: (input: {
    token: string;
    inviterChatId: number;
    inviterCity: string;
    inviterBalance: number;
    invitedUsername: string;
    referralInviterReward: number;
  }) => Promise<void>;
  cityOptions: readonly string[];
  personalityOptions: ReadonlyArray<{ id: string; label: string }>;
  genderOptions: ReadonlyArray<{ id: string; label: string }>;
  saveRegistrationProgress: (userId: string, updates: Record<string, unknown>) => Promise<any>;
}) {
  const {
    data, token, chatId, messageId, query, webAppUrl,
  } = input;

  if (data === "reg_tutorial:intro:start") {
    const draft = input.registrationDraftByChatId.get(chatId);
    if (!draft?.userId) {
      return { handled: true, callbackText: "Профиль не найден" };
    }
    await input.callInternalApi("POST", "/api/registration/submit-answer", {
      userId: draft.userId,
      questionId: "intro_start",
      answerId: "start",
    });
    const user = await input.storage.getUser(draft.userId);
    if (user) {
      await input.sendTelegramRegistrationStepPrompt(token, chatId, "registration_city");
    }
    return { handled: true, callbackText: "Стажировка начата" };
  }

  const tutorialCityPickMatch = data.match(/^reg_tutorial:city:(.+)$/);
  if (tutorialCityPickMatch) {
    const draft = input.registrationDraftByChatId.get(chatId);
    if (!draft?.userId) {
      return { handled: true, callbackText: "Профиль не найден" };
    }
    await input.callInternalApi("POST", "/api/registration/submit-answer", {
      userId: draft.userId,
      questionId: "city_selection",
      answerId: tutorialCityPickMatch[1],
    });
    const user = await input.storage.getUser(draft.userId);
    if (user) {
      await input.sendTelegramRegistrationStepPrompt(token, chatId, "register_username");
    }
    return { handled: true, callbackText: "Город выбран" };
  }

  const tutorialAnswerMatch = data.match(/^reg_tutorial:answer:([^:]+):(.+)$/);
  if (tutorialAnswerMatch) {
    const draft = input.registrationDraftByChatId.get(chatId);
    if (!draft?.userId) {
      return { handled: true, callbackText: "Профиль не найден" };
    }
    const response = await input.callInternalApi("POST", "/api/registration/submit-answer", {
      userId: draft.userId,
      questionId: tutorialAnswerMatch[1],
      answerId: tutorialAnswerMatch[2],
    });
    const nextStep = response?.registration?.registrationStep;
    const refreshedUser = await input.storage.getUser(draft.userId);
    if (messageId) {
      try {
        await input.callTelegramApi(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
      } catch {}
      input.registrationInterviewMessageByChatId.delete(chatId);
    }
    const previousFeedbackMessageId = input.registrationInterviewFeedbackMessageByChatId.get(chatId);
    if (previousFeedbackMessageId) {
      try {
        await input.callTelegramApi(token, "deleteMessage", { chat_id: chatId, message_id: previousFeedbackMessageId });
      } catch {}
      input.registrationInterviewFeedbackMessageByChatId.delete(chatId);
    }
    if (refreshedUser) {
      const feedbackMessage = await input.sendMessage(token, chatId, input.buildInterviewAnswerFeedback(
        refreshedUser,
        tutorialAnswerMatch[1],
        tutorialAnswerMatch[2],
      ));
      if (Number(feedbackMessage?.message_id || 0)) {
        input.registrationInterviewFeedbackMessageByChatId.set(chatId, Number(feedbackMessage.message_id));
      }
    }
    if (nextStep === "first_craft") {
      const finalSkills = response?.registration?.registrationFlow?.selectedSkills ?? response?.registration?.skills ?? {};
      await input.sendWithMainKeyboard(
        token,
        chatId,
        [
          "✅ Интервью завершено.",
          "Твои стартовые навыки распределены по результатам ответов.",
          input.formatProjectedRegistrationSkills(finalSkills),
          response?.registration?.registrationFlow?.perfectInterview ? "🏆 Идеальное интервью. Первый прототип получит эксклюзивную метку." : "",
        ].filter(Boolean).join("\n"),
      );
      await input.sendTelegramRegistrationStepPrompt(token, chatId, "registration_first_craft");
    } else {
      const user = await input.storage.getUser(draft.userId);
      if (user) {
        await input.sendTelegramRegistrationStepPrompt(token, chatId, "registration_aptitude");
      }
    }
    return { handled: true, callbackText: "Ответ принят" };
  }

  if ([
    "reg_tutorial:bp_start",
    "reg_tutorial:first_craft:start_blueprint",
    "reg_tutorial:bp_check",
    "reg_tutorial:produce",
  ].includes(data)) {
    const draft = input.registrationDraftByChatId.get(chatId);
    if (!draft?.userId) return { handled: true, callbackText: "Профиль не найден" };
    const player = await input.storage.getUser(draft.userId);
    if (!player) return { handled: true, callbackText: "Профиль не найден" };
    const company = await input.storage.getTutorialCompanyByOwner(player.id);
    if (!company) {
      await input.sendTelegramRegistrationStepPrompt(token, chatId, "registration_first_craft");
      return { handled: true, callbackText: "Мастерская ещё не готова" };
    }

    if (data === "reg_tutorial:bp_start" || data === "reg_tutorial:first_craft:start_blueprint") {
      const running = input.registrationTutorialAnimationByChatId.get(chatId);
      if (running) {
        return {
          handled: true,
          callbackText: running.phase === "blueprint" ? "Чертёж уже разрабатывается" : "Сейчас идёт сборка гаджета",
        };
      }
      await input.callInternalApi("POST", `/api/companies/${company.id}/blueprints/start`, {
        userId: player.id,
        blueprintId: input.tutorialDemoBlueprint.id,
      });
      await input.runRegistrationTutorialProgressAnimation({
        token,
        chatId,
        phase: "blueprint",
        durationSeconds: input.tutorialDemoBlueprint.timeSeconds,
        formatter: input.formatRegistrationTutorialBlueprintProgress,
        completeReplyMarkup: {
          inline_keyboard: [[{ text: "🏭 Собрать гаджет", callback_data: "reg_tutorial:produce" }]],
        },
      });
      return { handled: true, callbackText: "Чертёж запущен" };
    }

    if (data === "reg_tutorial:bp_check") {
      const snapshot = await input.callInternalApi("GET", `/api/companies/${company.id}/blueprints`);
      if (snapshot.active?.status !== "production_ready") {
        await input.callInternalApi("POST", `/api/companies/${company.id}/blueprints/progress`, {
          userId: player.id,
          hours: 1,
        });
      }
      const refreshed = await input.callInternalApi("GET", `/api/companies/${company.id}/blueprints`);
      const status = refreshed.active?.status;
      await input.sendWithMainKeyboard(
        token,
        chatId,
        status === "production_ready"
          ? "✅ Чертёж готов. Можно запускать первую сборку."
          : "⏳ Чертёж ещё в работе. Подожди пару секунд и проверь снова.",
      );
      return { handled: true, callbackText: "Проверяю" };
    }

    const running = input.registrationTutorialAnimationByChatId.get(chatId);
    if (running) {
      return {
        handled: true,
        callbackText: running.phase === "produce" ? "Сборка уже идёт" : "Сначала дождись готовности чертежа",
      };
    }
    const blueprintSnapshot = await input.callInternalApi("GET", `/api/companies/${company.id}/blueprints`);
    if (blueprintSnapshot.active?.status !== "production_ready") {
      await input.sendMessage(token, chatId, "ℹ️ Чтобы собрать гаджет, сначала нужно разработать чертёж. Нажми «📐 Запустить чертёж» и дождись завершения.");
      return { handled: true, callbackText: "Нужно разработать чертёж" };
    }
    const startedProduction = await input.callInternalApi("POST", `/api/companies/${company.id}/produce`, {
      userId: player.id,
      parts: [],
    });
    await input.runRegistrationTutorialProgressAnimation({
      token,
      chatId,
      phase: "produce",
      durationSeconds: Math.max(1, Number(startedProduction?.durationSeconds || input.tutorialDemoBlueprint.timeSeconds || 5)),
      formatter: input.formatRegistrationTutorialProduceProgress,
    });
    const produced = await input.callInternalApi("POST", `/api/companies/${company.id}/production/claim`, {
      userId: player.id,
    });
    await input.grantStarterHousing(player.id);
    const refreshedUser = await input.storage.getUser(player.id);
    input.pendingActionByChatId.delete(chatId);
    if (refreshedUser && !input.resolveTelegramRegistrationStep(refreshedUser, chatId)) {
      const referralResult = await input.applyReferralFromStartPayload(refreshedUser, draft.startPayload);
      input.registrationDraftByChatId.delete(chatId);
      const snapshot = await input.resolveTelegramSnapshot(query.from);
      if (referralResult?.status === "applied") {
        const inviterTelegramId = input.getTelegramIdByUserId(referralResult.inviter.id);
        const inviterChatId = Number(inviterTelegramId);
        if (Number.isFinite(inviterChatId) && inviterChatId !== chatId) {
          try {
            await input.notifyReferralInviter({
              token,
              inviterChatId,
              inviterCity: referralResult.inviter.city,
              inviterBalance: referralResult.inviter.balance,
              invitedUsername: snapshot.user.username,
              referralInviterReward: input.referralInviterReward,
            });
          } catch (error) {
            console.warn("⚠️ Не удалось отправить уведомление рефереру:", error);
          }
        }
      }
      const referralNotice =
        referralResult?.status === "applied"
          ? `\n🎁 Реферальный бонус: +${input.getCurrencySymbol(snapshot.user.city)}${input.referralNewPlayerReward}`
          : "";
      await input.sendWithMainKeyboard(
        token,
        chatId,
        [
          `✅ Первый прототип собран: ${produced?.name ?? input.tutorialDemoBlueprint.name}`,
          produced?.description ? `🌟 ${produced.description}` : "",
          produced?.inventoryReward
            ? `🎒 Предмет перемещён в инвентарь: ${String((produced.inventoryReward as any).name || "Starter Phone")}`
            : "🎒 Гаджет перемещён в инвентарь.",
          produced?.inventoryReward?.stats
            ? `Бонусы предмета: ${input.formatStats((produced.inventoryReward as any).stats)}`
            : "",
          "Его можно надеть через инвентарь или продать как обычный гаджет.",
          referralNotice.trim(),
          "",
          "Регистрация завершена. Доступ ко всей игре открыт.",
        ].filter(Boolean).join("\n"),
      );
      const starterHouse = refreshedUser ? (input.getActiveHousing(refreshedUser) ?? input.getStarterHousingForCity(refreshedUser.city)) : null;
      if (refreshedUser && starterHouse) {
        await input.sendHousingCard(
          token,
          chatId,
          refreshedUser,
          starterHouse,
          "🏠 После регистрации тебе выдан первый дом. Он уже активен и даёт стартовые бонусы.",
        );
      }
      await input.sendMessage(
        token,
        chatId,
        [
          "🎓 Если захочешь быстрее освоиться, можно пройти стартовый туториал.",
          "Кнопка: «🎓 Обучение»",
          "За полное прохождение выдаются бонусы и полезные стартовые награды.",
        ].join("\n"),
      );
    } else {
      await input.sendTelegramRegistrationStepPrompt(token, chatId, "registration_first_craft");
    }
    return { handled: true, callbackText: "Собираю" };
  }

  const regCityNavMatch = data.match(/^reg_city:nav:(\d+)$/);
  if (regCityNavMatch) {
    const pendingAction = input.pendingActionByChatId.get(chatId);
    if (pendingAction?.type !== "register_city") return { handled: true, callbackText: "Регистрация не активна", shouldClearInlineButtons: false };
    if (!messageId) return { handled: true, callbackText: "Город", shouldClearInlineButtons: false };
    const index = input.normalizeCitySlideIndex(Number(regCityNavMatch[1]));
    await input.callTelegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: await input.formatRegistrationCitySlide(index),
      reply_markup: input.buildRegistrationCityInlineMarkup(index),
    });
    return { handled: true, callbackText: "Город", shouldClearInlineButtons: false };
  }

  if (data === "reg_city:noop") return { handled: true, callbackText: "Город", shouldClearInlineButtons: false };

  const regCityPickMatch = data.match(/^reg_city:pick:(\d+)$/);
  if (regCityPickMatch) {
    const pendingAction = input.pendingActionByChatId.get(chatId);
    if (pendingAction?.type !== "register_city") return { handled: true, callbackText: "Регистрация не активна" };
    const index = input.normalizeCitySlideIndex(Number(regCityPickMatch[1]));
    await input.handleIncomingMessage(token, webAppUrl, {
      chat: { id: chatId },
      from: query.from,
      text: input.cityOptions[index],
    });
    return { handled: true, callbackText: "Город выбран" };
  }

  const regPersonalityNavMatch = data.match(/^reg_personality:nav:(\d+)$/);
  if (regPersonalityNavMatch) {
    const pendingAction = input.pendingActionByChatId.get(chatId);
    if (pendingAction?.type !== "register_personality") return { handled: true, callbackText: "Регистрация не активна", shouldClearInlineButtons: false };
    if (!messageId) return { handled: true, callbackText: "Характер", shouldClearInlineButtons: false };
    const index = input.normalizePersonalitySlideIndex(Number(regPersonalityNavMatch[1]));
    await input.callTelegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: await input.formatRegistrationPersonalitySlide(index),
      reply_markup: input.buildRegistrationPersonalityInlineMarkup(index),
    });
    return { handled: true, callbackText: "Характер", shouldClearInlineButtons: false };
  }

  if (data === "reg_personality:noop") return { handled: true, callbackText: "Характер", shouldClearInlineButtons: false };

  const regPersonalityPickMatch = data.match(/^reg_personality:pick:(\d+)$/);
  if (regPersonalityPickMatch) {
    const pendingAction = input.pendingActionByChatId.get(chatId);
    if (pendingAction?.type !== "register_personality") return { handled: true, callbackText: "Регистрация не активна" };
    const index = input.normalizePersonalitySlideIndex(Number(regPersonalityPickMatch[1]));
    const draft = input.registrationDraftByChatId.get(chatId);
    if (draft?.userId) {
      const user = await input.saveRegistrationProgress(draft.userId, {
        personalityId: input.personalityOptions[index].id,
      });
      if (user && input.buildPlayerRegistrationState(user).registrationStep === "aptitude_test") {
        await input.sendTelegramRegistrationStepPrompt(token, chatId, "registration_aptitude");
        return { handled: true, callbackText: "Характер выбран" };
      }
    }
    await input.handleIncomingMessage(token, webAppUrl, {
      chat: { id: chatId },
      from: query.from,
      text: input.personalityOptions[index].label,
    });
    return { handled: true, callbackText: "Характер выбран" };
  }

  const regGenderNavMatch = data.match(/^reg_gender:nav:(\d+)$/);
  if (regGenderNavMatch) {
    const pendingAction = input.pendingActionByChatId.get(chatId);
    if (pendingAction?.type !== "register_gender") return { handled: true, callbackText: "Регистрация не активна", shouldClearInlineButtons: false };
    if (!messageId) return { handled: true, callbackText: "Пол", shouldClearInlineButtons: false };
    const index = input.normalizeGenderSlideIndex(Number(regGenderNavMatch[1]));
    await input.callTelegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: input.formatRegistrationGenderSlide(index),
      reply_markup: input.buildRegistrationGenderInlineMarkup(index),
    });
    return { handled: true, callbackText: "Пол", shouldClearInlineButtons: false };
  }

  if (data === "reg_gender:noop") return { handled: true, callbackText: "Пол", shouldClearInlineButtons: false };

  const regGenderPickMatch = data.match(/^reg_gender:pick:(\d+)$/);
  if (regGenderPickMatch) {
    const pendingAction = input.pendingActionByChatId.get(chatId);
    if (pendingAction?.type !== "register_gender") return { handled: true, callbackText: "Регистрация не активна" };
    const index = input.normalizeGenderSlideIndex(Number(regGenderPickMatch[1]));
    await input.handleIncomingMessage(token, webAppUrl, {
      chat: { id: chatId },
      from: query.from,
      text: input.genderOptions[index].label,
    });
    return { handled: true, callbackText: "Пол выбран" };
  }

  return null;
}
