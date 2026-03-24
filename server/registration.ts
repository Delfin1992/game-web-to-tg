import { randomUUID } from "crypto";
import type { User } from "../shared/schema";
import {
  TELEGRAM_PENDING_PASSWORD_PREFIX,
  TELEGRAM_REGISTERED_PASSWORD_PREFIX,
  REGISTRATION_CITIES,
  REGISTRATION_GENDERS,
  REGISTRATION_INTERVIEW_QUESTIONS,
  REGISTRATION_PERSONALITIES,
  REGISTRATION_SKILL_ORDER,
  buildRegistrationStateSnapshot,
  countRegistrationSkillPoints,
  createEmptyRegistrationSkills,
  getCityById,
  getCityByName,
  getPersonalityById,
  getRegistrationInterviewQuestion,
  isRegistrationNameFilled,
  isValidRegistrationGender,
  isValidRegistrationSkillsAllocation,
  normalizeRegistrationSkillsAllocation,
  REGISTRATION_INITIAL_SKILL_POINTS,
  resolveCity,
  resolveRegistrationStep,
  type GenderId,
  type RegistrationCityStats,
  type RegistrationInterviewAnswerMap,
  type RegistrationInterviewQuestionDefinition,
  type RegistrationSkillName,
  type RegistrationSkillsAllocation,
  type RegistrationTutorialStep,
} from "../shared/registration";
import { applyGameStatePatch } from "./game-engine";
import { storage } from "./storage";

export type RegistrationMeta = {
  currentStep?: string;
  selectedCity?: string;
  selectedPersonality?: string;
  selectedSkills?: RegistrationSkillsAllocation;
  completedAt?: string | null;
  answers?: RegistrationInterviewAnswerMap;
  citySelected?: string;
  aptitudeResolved?: boolean;
  tutorialBlueprintGranted?: boolean;
  tutorialPartsGranted?: boolean;
  firstCraftCompleted?: boolean;
  perfectInterview?: boolean;
  tutorialCompanyId?: string | null;
  introStartedAt?: string | null;
  aptitudeResolvedAt?: string | null;
  craftCompletedAt?: string | null;
  exclusiveRewardGranted?: boolean;
  interviewQuestionIndex?: number;
};

export type RegistrationAnswerSubmission =
  | { questionId: "intro_start"; answerId: "start" }
  | { questionId: "city_selection"; answerId: string }
  | { questionId: string; answerId: string };

export type InterviewResolutionResult = {
  skills: RegistrationSkillsAllocation;
  perfectInterview: boolean;
};

export {
  TELEGRAM_PENDING_PASSWORD_PREFIX,
  TELEGRAM_REGISTERED_PASSWORD_PREFIX,
  REGISTRATION_CITIES,
  REGISTRATION_GENDERS,
  REGISTRATION_PERSONALITIES,
  REGISTRATION_INTERVIEW_QUESTIONS,
  getCityById,
  getPersonalityById,
  getRegistrationInterviewQuestion,
  resolveCity,
  resolveRegistrationStep,
  isRegistrationNameFilled,
};

function parseRegistrationContainer(user: Pick<User, "tutorialState">) {
  try {
    const parsed = JSON.parse(String(user.tutorialState || "{}")) as Record<string, unknown>;
    const flow = (parsed.registrationFlow && typeof parsed.registrationFlow === "object"
      ? parsed.registrationFlow
      : {}) as RegistrationMeta;
    return {
      ...parsed,
      registrationFlow: flow,
    };
  } catch {
    return {
      registrationFlow: {} as RegistrationMeta,
    };
  }
}

export function getRegistrationMeta(user: Pick<User, "tutorialState">): RegistrationMeta {
  return parseRegistrationContainer(user).registrationFlow ?? {};
}

function resolveSelectedCityName(user: Pick<User, "city" | "password">, meta: RegistrationMeta) {
  if (resolveCity(meta.citySelected)?.name) return resolveCity(meta.citySelected)?.name;
  if (resolveCity(meta.selectedCity)?.name) return resolveCity(meta.selectedCity)?.name;
  if (!isPendingRegistration(user) && resolveCity(user.city)?.name) return resolveCity(user.city)?.name;
  return undefined;
}

function hasInterviewSkills(meta: RegistrationMeta) {
  return isValidRegistrationSkillsAllocation(meta.selectedSkills);
}

function isLegacyCompletedUser(
  user: Pick<User, "username" | "city" | "personality" | "gender" | "password">,
) {
  if (isPendingRegistration(user)) return false;
  return isRegistrationNameFilled(user.username)
    && !!resolveCity(user.city)
    && !!getPersonalityById(user.personality)
    && isValidRegistrationGender(user.gender);
}

function normalizeRegistrationMeta(
  user: Pick<User, "username" | "city" | "personality" | "gender" | "password" | "tutorialState">,
): RegistrationMeta {
  const raw = getRegistrationMeta(user);
  const selectedCity = resolveSelectedCityName(user, raw);
  const selectedSkills = hasInterviewSkills(raw)
    ? normalizeRegistrationSkillsAllocation(raw.selectedSkills)
    : createEmptyRegistrationSkills();
  const isCompleted = Boolean(raw.completedAt) || isLegacyCompletedUser(user);
  const introStarted = Boolean(raw.introStartedAt || raw.currentStep === "city_selection" || selectedCity || raw.aptitudeResolved || raw.firstCraftCompleted);
  const aptitudeResolved = Boolean(raw.aptitudeResolved || hasInterviewSkills(raw));
  const firstCraftCompleted = Boolean(raw.firstCraftCompleted || isCompleted);
  const currentStep = resolveRegistrationStep({
    username: user.username,
    city: selectedCity,
    citySelected: selectedCity,
    personality: raw.selectedPersonality ?? (isLegacyCompletedUser(user) ? user.personality : undefined),
    skills: selectedSkills,
    introStarted,
    aptitudeResolved,
    firstCraftCompleted,
    isCompleted,
  });

  return {
    ...raw,
    currentStep,
    selectedCity,
    citySelected: selectedCity,
    selectedPersonality: raw.selectedPersonality ?? (isLegacyCompletedUser(user) ? user.personality ?? undefined : undefined),
    selectedSkills,
    answers: { ...(raw.answers ?? {}) },
    aptitudeResolved,
    tutorialBlueprintGranted: Boolean(raw.tutorialBlueprintGranted || currentStep === "completed"),
    tutorialPartsGranted: Boolean(raw.tutorialPartsGranted || currentStep === "completed"),
    firstCraftCompleted,
    perfectInterview: Boolean(raw.perfectInterview),
    tutorialCompanyId: typeof raw.tutorialCompanyId === "string" && raw.tutorialCompanyId.trim() ? raw.tutorialCompanyId : null,
    introStartedAt: raw.introStartedAt ?? null,
    completedAt: isCompleted ? raw.completedAt ?? new Date(0).toISOString() : null,
    aptitudeResolvedAt: raw.aptitudeResolvedAt ?? null,
    craftCompletedAt: raw.craftCompletedAt ?? null,
    exclusiveRewardGranted: Boolean(raw.exclusiveRewardGranted),
    interviewQuestionIndex: Math.max(0, Math.floor(Number(raw.interviewQuestionIndex || 0))),
  };
}

async function updateRegistrationMeta(user: User, patch: Partial<RegistrationMeta>) {
  const parsed = parseRegistrationContainer(user);
  const nextMeta = {
    ...parsed.registrationFlow,
    ...patch,
  };
  const tutorialState = JSON.stringify({
    ...parsed,
    registrationFlow: nextMeta,
  });

  return await storage.updateUser(user.id, { tutorialState });
}

function validateInterviewAllocation(skills: RegistrationSkillsAllocation) {
  const normalized = normalizeRegistrationSkillsAllocation(skills);
  if (!isValidRegistrationSkillsAllocation(normalized)) {
    const points = countRegistrationSkillPoints(normalized);
    throw new Error(`Распредели все ${REGISTRATION_INITIAL_SKILL_POINTS} очков навыков (сейчас: ${points}).`);
  }
  return normalized;
}

function isPerfectInterview(answers: RegistrationInterviewAnswerMap) {
  return REGISTRATION_INTERVIEW_QUESTIONS.every((question) => {
    const selected = question.options.find((option) => option.id === answers[question.id]);
    return Boolean(selected?.perfect);
  });
}

export function resolveSkillsFromAnswers(answers: Record<string, string>): InterviewResolutionResult {
  const scores = createEmptyRegistrationSkills();

  for (const question of REGISTRATION_INTERVIEW_QUESTIONS) {
    const selected = question.options.find((option) => option.id === answers[question.id]);
    if (!selected) continue;
    for (const skill of REGISTRATION_SKILL_ORDER) {
      scores[skill] += Number(selected.skillWeights[skill] || 0);
    }
  }

  const totalScore = REGISTRATION_SKILL_ORDER.reduce((sum, skill) => sum + scores[skill], 0);
  if (totalScore <= 0) {
    const fallback = createEmptyRegistrationSkills();
    fallback.coding = 2;
    fallback.testing = 2;
    fallback.analytics = 2;
    fallback.attention = 2;
    fallback.design = 1;
    fallback.modeling = 1;
    const skills = validateInterviewAllocation(fallback);
    return {
      skills,
      perfectInterview: isPerfectInterview(answers),
    };
  }

  const exact = REGISTRATION_SKILL_ORDER.map((skill) => ({
    skill,
    raw: (scores[skill] / Math.max(1, totalScore)) * REGISTRATION_INITIAL_SKILL_POINTS,
  }));
  const allocated = createEmptyRegistrationSkills();
  let distributed = 0;
  for (const item of exact) {
    const floored = Math.floor(item.raw);
    allocated[item.skill] = floored;
    distributed += floored;
  }

  const remaining = REGISTRATION_INITIAL_SKILL_POINTS - distributed;
  const rankedRemainders = [...exact]
    .sort((left, right) => {
      const fractionalDiff = (right.raw - Math.floor(right.raw)) - (left.raw - Math.floor(left.raw));
      if (Math.abs(fractionalDiff) > 0.000001) return fractionalDiff;
      return scores[right.skill] - scores[left.skill];
    })
    .slice(0, Math.max(0, remaining));

  for (const item of rankedRemainders) {
    allocated[item.skill] += 1;
  }

  const skills = validateInterviewAllocation(allocated);
  return {
    skills,
    perfectInterview: isPerfectInterview(answers),
  };
}

function getExpectedQuestion(meta: RegistrationMeta): RegistrationInterviewQuestionDefinition | undefined {
  const answeredCount = REGISTRATION_INTERVIEW_QUESTIONS.filter((question) => meta.answers?.[question.id]).length;
  return REGISTRATION_INTERVIEW_QUESTIONS[Math.max(0, answeredCount)];
}

export function getCurrentInterviewQuestion(user: Pick<User, "username" | "city" | "personality" | "gender" | "password" | "tutorialState">) {
  const meta = normalizeRegistrationMeta(user);
  if (meta.currentStep !== "aptitude_test") return null;
  return getExpectedQuestion(meta) ?? null;
}

export function isPendingRegistration(user: Pick<User, "password">) {
  return String(user.password || "").startsWith(TELEGRAM_PENDING_PASSWORD_PREFIX);
}

export function isCompletedRegistration(
  user: Pick<User, "username" | "city" | "personality" | "gender" | "password" | "tutorialState">,
) {
  const meta = normalizeRegistrationMeta(user);
  return Boolean(meta.completedAt) || meta.currentStep === "completed" || isLegacyCompletedUser(user);
}

export function buildPlayerRegistrationState(
  user: Pick<User, "username" | "city" | "personality" | "gender" | "password" | "tutorialState">,
) {
  const meta = normalizeRegistrationMeta(user);
  const isCompleted = isCompletedRegistration(user);
  return buildRegistrationStateSnapshot({
    username: user.username,
    city: meta.selectedCity ?? user.city,
    citySelected: meta.selectedCity ?? user.city,
    personality: meta.selectedPersonality ?? (isLegacyCompletedUser(user) ? user.personality : undefined),
    gender: user.gender,
    skills: meta.selectedSkills ?? createEmptyRegistrationSkills(),
    introStarted: Boolean(meta.introStartedAt || meta.currentStep !== "intro"),
    answers: meta.answers,
    aptitudeResolved: meta.aptitudeResolved,
    tutorialBlueprintGranted: meta.tutorialBlueprintGranted,
    tutorialPartsGranted: meta.tutorialPartsGranted,
    firstCraftCompleted: meta.firstCraftCompleted,
    perfectInterview: meta.perfectInterview,
    isCompleted,
    completedAt: isCompleted ? meta.completedAt : null,
  });
}

export async function buildRegistrationOptions() {
  const [users, companies] = await Promise.all([
    storage.getUsers(),
    storage.getAllCompanies(),
  ]);

  const statsByCityName = new Map<string, RegistrationCityStats>();
  for (const city of REGISTRATION_CITIES) {
    statsByCityName.set(city.name, { playersCount: 0, companiesCount: 0 });
  }

  for (const user of users) {
    const city = getCityByName(user.city);
    if (!city) continue;
    const current = statsByCityName.get(city.name);
    if (current) current.playersCount += 1;
  }

  for (const company of companies) {
    const city = getCityByName(company.city);
    if (!city) continue;
    const current = statsByCityName.get(city.name);
    if (current) current.companiesCount += 1;
  }

  return {
    cities: REGISTRATION_CITIES.map((city) => ({
      ...city,
      stats: statsByCityName.get(city.name) ?? {
        playersCount: 0,
        companiesCount: 0,
      },
    })),
    personalities: REGISTRATION_PERSONALITIES,
    genders: REGISTRATION_GENDERS,
    skillPointsTotal: REGISTRATION_INITIAL_SKILL_POINTS,
    interviewQuestions: REGISTRATION_INTERVIEW_QUESTIONS.map((question) => ({
      id: question.id,
      title: question.title,
      prompt: question.prompt,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        summary: option.summary,
      })),
    })),
  };
}

export function normalizeRegistrationName(value: string) {
  return value.trim();
}

export function normalizeRegistrationGender(value?: string | null): GenderId | undefined {
  if (!value) return undefined;
  return isValidRegistrationGender(value) ? value : undefined;
}

export function resolveRegistrationCityName(input?: string | null) {
  return resolveCity(input)?.name;
}

export function resolveRegistrationPersonalityId(input?: string | null) {
  return getPersonalityById(input)?.id;
}

export async function startRegistrationIntro(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  if (isCompletedRegistration(user)) return user;
  return await updateRegistrationMeta(user, {
    introStartedAt: new Date().toISOString(),
    currentStep: "city_selection",
    completedAt: null,
  });
}

export async function ensureFirstCraftRegistrationAssets(
  userId: string,
  patch: Partial<Pick<RegistrationMeta, "tutorialCompanyId">> = {},
) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const meta = normalizeRegistrationMeta(user);
  return await updateRegistrationMeta(user, {
    ...patch,
    currentStep: "first_craft",
    tutorialBlueprintGranted: true,
    tutorialPartsGranted: true,
    aptitudeResolved: true,
    aptitudeResolvedAt: meta.aptitudeResolvedAt ?? new Date().toISOString(),
  });
}

export async function submitRegistrationAnswer(userId: string, submission: RegistrationAnswerSubmission) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  const meta = normalizeRegistrationMeta(user);
  if (meta.currentStep === "completed") return user;

  if (submission.questionId === "intro_start") {
    if (meta.currentStep !== "intro") {
      throw new Error("Интро уже пройдено");
    }
    return await startRegistrationIntro(userId);
  }

  if (submission.questionId === "city_selection") {
    if (!["city_selection", "intro", "name"].includes(meta.currentStep || "")) {
      throw new Error("Сейчас нельзя выбирать город");
    }
    const cityName = resolveRegistrationCityName(submission.answerId);
    if (!cityName) throw new Error("Город не найден");
    const updated = await storage.updateUser(user.id, { city: cityName });
    return await updateRegistrationMeta(updated, {
      introStartedAt: meta.introStartedAt ?? new Date().toISOString(),
      selectedCity: cityName,
      citySelected: cityName,
      currentStep: "personality",
      completedAt: null,
    });
  }

  if (meta.currentStep !== "aptitude_test") {
    throw new Error("Сейчас этап интервью не активен");
  }

  const expectedQuestion = getExpectedQuestion(meta);
  if (!expectedQuestion) {
    throw new Error("Интервью уже завершено");
  }
  if (submission.questionId !== expectedQuestion.id) {
    throw new Error("Ответ не соответствует текущему вопросу");
  }
  const option = expectedQuestion.options.find((candidate) => candidate.id === submission.answerId);
  if (!option) {
    throw new Error("Вариант ответа не найден");
  }

  const answers = {
    ...(meta.answers ?? {}),
    [submission.questionId]: submission.answerId,
  };
  const answeredAll = REGISTRATION_INTERVIEW_QUESTIONS.every((question) => answers[question.id]);
  if (!answeredAll) {
    return await updateRegistrationMeta(user, {
      answers,
      interviewQuestionIndex: Object.keys(answers).length,
      currentStep: "aptitude_test",
    });
  }

  const resolution = resolveSkillsFromAnswers(answers);
  return await updateRegistrationMeta(user, {
    answers,
    selectedSkills: resolution.skills,
    aptitudeResolved: true,
    aptitudeResolvedAt: new Date().toISOString(),
    perfectInterview: resolution.perfectInterview,
    tutorialBlueprintGranted: true,
    tutorialPartsGranted: true,
    interviewQuestionIndex: REGISTRATION_INTERVIEW_QUESTIONS.length,
    currentStep: "first_craft",
    completedAt: null,
  });
}

export async function saveRegistrationProgress(
  userId: string,
  updates: {
    username?: string;
    cityId?: string;
    city?: string;
    personalityId?: string;
    personality?: string;
    gender?: string;
    skills?: Partial<RegistrationSkillsAllocation>;
  },
) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  const userPatch: Partial<User> = {};
  const metaPatch: Partial<RegistrationMeta> = {};

  if (typeof updates.username === "string") {
    const username = normalizeRegistrationName(updates.username);
    if (!isRegistrationNameFilled(username)) throw new Error("Некорректное имя игрока");
    const existing = await storage.getUserByUsername(username);
    if (existing && existing.id !== user.id) throw new Error("Этот ник уже занят");
    userPatch.username = username;
  }

  const cityName = resolveRegistrationCityName(updates.cityId ?? updates.city);
  if ((updates.cityId || updates.city) && !cityName) throw new Error("Город не найден");
  if (cityName) {
    userPatch.city = cityName;
    metaPatch.selectedCity = cityName;
    metaPatch.citySelected = cityName;
  }

  const personalityId = resolveRegistrationPersonalityId(updates.personalityId ?? updates.personality);
  if ((updates.personalityId || updates.personality) && !personalityId) throw new Error("Характер не найден");
  if (personalityId) {
    userPatch.personality = personalityId;
    metaPatch.selectedPersonality = personalityId;
  }

  const gender = normalizeRegistrationGender(updates.gender);
  if (updates.gender && !gender) throw new Error("Пол не найден");
  if (gender) userPatch.gender = gender;

  if (typeof updates.skills === "object" && updates.skills !== null) {
    metaPatch.selectedSkills = validateInterviewAllocation(normalizeRegistrationSkillsAllocation(updates.skills));
    metaPatch.aptitudeResolved = true;
  }

  const updatedUser = Object.keys(userPatch).length > 0
    ? await storage.updateUser(user.id, userPatch)
    : user;
  const currentMeta = normalizeRegistrationMeta(updatedUser);
  const nextStep = resolveRegistrationStep({
    username: updatedUser.username,
    city: metaPatch.selectedCity ?? currentMeta.selectedCity,
    citySelected: metaPatch.selectedCity ?? currentMeta.selectedCity,
    personality: metaPatch.selectedPersonality ?? currentMeta.selectedPersonality,
    skills: metaPatch.selectedSkills ?? currentMeta.selectedSkills ?? createEmptyRegistrationSkills(),
    introStarted: Boolean(currentMeta.introStartedAt || metaPatch.selectedCity || metaPatch.selectedSkills),
    aptitudeResolved: Boolean(metaPatch.aptitudeResolved ?? currentMeta.aptitudeResolved),
    firstCraftCompleted: Boolean(currentMeta.firstCraftCompleted),
    isCompleted: isCompletedRegistration(updatedUser),
  });

  return await updateRegistrationMeta(updatedUser, {
    ...metaPatch,
    introStartedAt: currentMeta.introStartedAt ?? (metaPatch.selectedCity || metaPatch.selectedSkills ? new Date().toISOString() : null),
    currentStep: nextStep,
    completedAt: currentMeta.completedAt && nextStep === "completed" ? currentMeta.completedAt : null,
  });
}

export async function markRegistrationFirstCraftCompleted(
  userId: string,
  patch: Partial<Pick<RegistrationMeta, "exclusiveRewardGranted" | "tutorialCompanyId">> = {},
) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const meta = normalizeRegistrationMeta(user);
  return await updateRegistrationMeta(user, {
    ...patch,
    currentStep: "completed",
    firstCraftCompleted: true,
    craftCompletedAt: meta.craftCompletedAt ?? new Date().toISOString(),
  });
}

export async function completeRegistration(
  userId: string,
  updates?: {
    username?: string;
    cityId?: string;
    city?: string;
    personalityId?: string;
    personality?: string;
    gender?: string;
    skills?: Partial<RegistrationSkillsAllocation>;
  },
) {
  const savedUser = updates ? await saveRegistrationProgress(userId, updates) : await storage.getUser(userId);
  if (!savedUser) throw new Error("User not found");

  if (isLegacyCompletedUser(savedUser)) {
    return await updateRegistrationMeta(savedUser, {
      currentStep: "completed",
      completedAt: new Date().toISOString(),
      firstCraftCompleted: true,
    });
  }

  const meta = normalizeRegistrationMeta(savedUser);
  const nextStep = resolveRegistrationStep({
    username: savedUser.username,
    city: meta.selectedCity,
    citySelected: meta.selectedCity,
    personality: meta.selectedPersonality,
    skills: meta.selectedSkills ?? createEmptyRegistrationSkills(),
    introStarted: Boolean(meta.introStartedAt),
    aptitudeResolved: meta.aptitudeResolved,
    firstCraftCompleted: meta.firstCraftCompleted,
  });

  if (nextStep !== "completed" && !meta.firstCraftCompleted) {
    throw new Error("Сначала заверши первое производство");
  }
  if (!isValidRegistrationSkillsAllocation(meta.selectedSkills)) {
    throw new Error("Навыки ещё не определены интервью");
  }

  const completedUser = await storage.updateUser(savedUser.id, {
    password: isPendingRegistration(savedUser)
      ? `${TELEGRAM_REGISTERED_PASSWORD_PREFIX}${randomUUID()}`
      : savedUser.password,
  });

  applyGameStatePatch(completedUser.id, {
    skills: normalizeRegistrationSkillsAllocation(meta.selectedSkills),
  });

  return await updateRegistrationMeta(completedUser, {
    currentStep: "completed",
    firstCraftCompleted: true,
    craftCompletedAt: meta.craftCompletedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
}
