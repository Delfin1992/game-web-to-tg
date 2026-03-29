/**
 * Registration-related message/pending-action handling extracted from the legacy router.
 * Returns false when the incoming text does not belong to registration flow.
 */

export async function handleRegistrationPendingAction(input: {
  token: string;
  chatId: number;
  text: string;
  pendingAction: { type: string };
  registrationDraftByChatId: Map<number, any>;
  pendingActionByChatId: Map<number, any>;
  storage: any;
  sendWithMainKeyboard: (token: string, chatId: number, text: string) => Promise<void>;
  sendMessage: (token: string, chatId: number, text: string, extra?: Record<string, unknown>) => Promise<any>;
  normalizeTelegramRegistrationName: (value: string) => string;
  isValidTelegramRegistrationName: (value: string) => boolean;
  resolveCityName: (value: string) => string | null;
  isCityTemporarilyAvailable: (city: string) => boolean;
  cityCapacityMessage: string;
  buildRegistrationCityInlineMarkup: (index: number) => any;
  getDraftCitySlideIndex: (chatId: number) => number;
  sendRegistrationCityPicker: (token: string, chatId: number, index: number) => Promise<void>;
  resolvePersonality: (value: string) => string | null;
  getDraftPersonalitySlideIndex: (chatId: number) => number;
  sendRegistrationPersonalityPicker: (token: string, chatId: number, index: number) => Promise<void>;
  buildPlayerRegistrationState: (user: any) => any;
  saveRegistrationProgress: (userId: string, updates: Record<string, unknown>) => Promise<any>;
  sendTelegramRegistrationStepPrompt: (token: string, chatId: number, step: any) => Promise<void>;
  resolveGender: (value: string) => string | null;
  getDraftGenderSlideIndex: (chatId: number) => number;
  sendRegistrationGenderPicker: (token: string, chatId: number, index: number) => Promise<void>;
  resolveTelegramRegistrationStep: (user: any, chatId: number) => any;
  isTelegramRegistrationCompleted: (user: any) => boolean;
  resolveRegistrationStepFromValues: (values: Record<string, unknown>) => any;
}) {
  const {
    token,
    chatId,
    text,
    pendingAction,
  } = input;

  if (
    pendingAction.type !== "register_username"
    && pendingAction.type !== "register_city"
    && pendingAction.type !== "register_personality"
    && pendingAction.type !== "register_gender"
  ) {
    return false;
  }

  const draft = input.registrationDraftByChatId.get(chatId);
  if (!draft) {
    input.pendingActionByChatId.delete(chatId);
    await input.sendWithMainKeyboard(token, chatId, "Регистрация сброшена. Отправь /start, чтобы начать заново.");
    return true;
  }

  const draftUser = await input.storage.getUser(draft.userId);
  if (!draftUser) {
    input.registrationDraftByChatId.delete(chatId);
    input.pendingActionByChatId.delete(chatId);
    await input.sendWithMainKeyboard(token, chatId, "Профиль не найден. Отправь /start.");
    return true;
  }

  if (pendingAction.type === "register_username") {
    const nickname = input.normalizeTelegramRegistrationName(text);
    if (!input.isValidTelegramRegistrationName(nickname)) {
      await input.sendMessage(
        token,
        chatId,
        "Неверный ник. Впиши 3-10 символов: русские/латинские буквы, цифры, _ или -",
        { reply_markup: { remove_keyboard: true } },
      );
      return true;
    }

    const existing = await input.storage.getUserByUsername(nickname);
    if (existing && existing.id !== draftUser.id) {
      await input.sendMessage(token, chatId, "Этот ник уже занят. Введи другой.");
      return true;
    }

    draft.username = nickname;
  }

  if (pendingAction.type === "register_city") {
    const city = input.resolveCityName(text);
    if (!city) {
      await input.sendRegistrationCityPicker(token, chatId, input.getDraftCitySlideIndex(chatId));
      return true;
    }
    if (!input.isCityTemporarilyAvailable(city)) {
      await input.sendMessage(token, chatId, input.cityCapacityMessage, {
        reply_markup: input.buildRegistrationCityInlineMarkup(input.getDraftCitySlideIndex(chatId)),
      });
      return true;
    }

    draft.city = city;
  }

  if (pendingAction.type === "register_personality") {
    const personality = input.resolvePersonality(text);
    if (!personality) {
      await input.sendRegistrationPersonalityPicker(token, chatId, input.getDraftPersonalitySlideIndex(chatId));
      return true;
    }
    draft.personality = personality;
    input.registrationDraftByChatId.set(chatId, draft);
    if (draft.userId) {
      const refreshed = await input.saveRegistrationProgress(draft.userId, {
        personalityId: personality,
      });
      if (refreshed && input.buildPlayerRegistrationState(refreshed).registrationStep === "aptitude_test") {
        input.pendingActionByChatId.set(chatId, { type: "registration_aptitude" });
        await input.sendTelegramRegistrationStepPrompt(token, chatId, "registration_aptitude");
        return true;
      }
    }
  }

  if (pendingAction.type === "register_gender") {
    const gender = input.resolveGender(text);
    if (!gender) {
      await input.sendRegistrationGenderPicker(token, chatId, input.getDraftGenderSlideIndex(chatId));
      return true;
    }
    draft.gender = gender;
  }

  input.registrationDraftByChatId.set(chatId, draft);
  if (pendingAction.type === "register_username") {
    const refreshed = await input.saveRegistrationProgress(draftUser.id, { username: draft.username });
    await input.sendTelegramRegistrationStepPrompt(
      token,
      chatId,
      input.resolveTelegramRegistrationStep(refreshed, chatId) ?? "registration_city",
    );
    return true;
  }

  if (pendingAction.type === "register_city") {
    const refreshed = await input.saveRegistrationProgress(draftUser.id, { city: draft.city });
    await input.sendTelegramRegistrationStepPrompt(
      token,
      chatId,
      input.resolveTelegramRegistrationStep(refreshed, chatId) ?? "register_username",
    );
    return true;
  }

  const usePersistedFallback = input.isTelegramRegistrationCompleted(draftUser);
  const nextStep = input.resolveRegistrationStepFromValues({
    username: draft.username ?? (usePersistedFallback ? draftUser.username : undefined),
    city: draft.city ?? (usePersistedFallback ? draftUser.city : undefined),
    personality: draft.personality ?? (usePersistedFallback ? draftUser.personality : undefined),
    gender: draft.gender ?? (usePersistedFallback ? draftUser.gender : undefined),
    skills: draft.skills,
  });
  input.pendingActionByChatId.set(chatId, { type: nextStep });
  await input.sendTelegramRegistrationStepPrompt(token, chatId, nextStep);
  return true;
}
