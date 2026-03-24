import type { User } from "../shared/schema";
import { storage } from "./storage";
import {
  EMPTY_TUTORIAL_REWARD,
  TUTORIAL_STEP_CONTENT,
  type TutorialEventType,
  type TutorialReward,
  type TutorialState,
  createDefaultTutorialState,
  parseTutorialStateFromSerialized,
} from "../shared/tutorial";
import { mergeTutorialStateContainer } from "./player-meta";
import {
  TUTORIAL_MEDAL_ITEM_ID,
  createTutorialMedalItem,
  grantInventoryItemToPlayer,
  hasInventoryItemById,
} from "./game-engine";

export interface TutorialProgressResult {
  state: TutorialState;
  reward: TutorialReward;
  advanced: boolean;
  fromStep: number;
  toStep: number;
}

function normalizeReward(reward?: TutorialReward): TutorialReward {
  if (!reward) return { ...EMPTY_TUTORIAL_REWARD };
  return {
    money: Math.max(0, Math.floor(Number(reward.money) || 0)),
    xp: Math.max(0, Math.floor(Number(reward.xp) || 0)),
    reputation: Math.max(0, Math.floor(Number(reward.reputation) || 0)),
  };
}

function isEmptyReward(reward: TutorialReward) {
  return reward.money <= 0 && reward.xp <= 0 && reward.reputation <= 0;
}

function applyExperienceGain(level: number, experience: number, gain: number) {
  let nextLevel = Math.max(1, Math.floor(level || 1));
  let nextExperience = Math.max(0, Math.floor(experience || 0)) + Math.max(0, Math.floor(gain || 0));

  while (nextExperience >= 100) {
    nextLevel += 1;
    nextExperience -= 100;
  }

  return { level: nextLevel, experience: nextExperience };
}

function toResult(
  state: TutorialState,
  fromStep: number,
  advanced: boolean,
  reward: TutorialReward = { ...EMPTY_TUTORIAL_REWARD },
): TutorialProgressResult {
  return {
    state,
    reward,
    advanced,
    fromStep,
    toStep: state.currentStep,
  };
}

async function applyReward(user: User, reward: TutorialReward) {
  const normalized = normalizeReward(reward);
  if (isEmptyReward(normalized)) {
    return { user, reward: normalized };
  }

  const nextExp = applyExperienceGain(user.level, user.experience, normalized.xp);
  const updated = await storage.updateUser(user.id, {
    balance: user.balance + normalized.money,
    level: nextExp.level,
    experience: nextExp.experience,
    reputation: (user.reputation || 0) + normalized.reputation,
  });
  return { user: updated, reward: normalized };
}

async function persistTutorialState(userId: string, state: TutorialState) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  await storage.updateUser(userId, {
    tutorialState: mergeTutorialStateContainer(user.tutorialState, state as unknown as Record<string, unknown>),
  });
}

export async function getTutorialContext(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;
  const state = parseTutorialStateFromSerialized(user.tutorialState);
  return { user, state };
}

export async function getTutorialState(userId: string): Promise<TutorialState | null> {
  const context = await getTutorialContext(userId);
  return context?.state ?? null;
}

export async function startTutorial(userId: string): Promise<TutorialProgressResult> {
  const context = await getTutorialContext(userId);
  if (!context) {
    throw new Error("Пользователь не найден");
  }

  const fromStep = context.state.currentStep;
  if (context.state.isCompleted || context.state.isActive) {
    return toResult(context.state, fromStep, false);
  }

  const nextState: TutorialState = {
    ...createDefaultTutorialState(),
    isActive: true,
    currentStep: 1,
    startedAt: Date.now(),
  };

  await persistTutorialState(context.user.id, nextState);
  return toResult(nextState, fromStep, true);
}

export async function applyTutorialEvent(
  userId: string,
  eventType: TutorialEventType,
): Promise<TutorialProgressResult> {
  const context = await getTutorialContext(userId);
  if (!context) {
    throw new Error("Пользователь не найден");
  }

  const { user, state } = context;
  const fromStep = state.currentStep;
  if (!state.isActive || state.isCompleted) {
    return toResult(state, fromStep, false);
  }

  let advanced = false;
  let reward = { ...EMPTY_TUTORIAL_REWARD };

  if (eventType === "first_job_done" && state.currentStep === 1 && !state.tutorialFlags.firstJobDone) {
    state.tutorialFlags.firstJobDone = true;
    state.currentStep = 2;
    reward = normalizeReward(TUTORIAL_STEP_CONTENT[2]?.reward);
    advanced = true;
  }

  if (eventType === "first_course_item_bought" && state.currentStep === 2 && !state.tutorialFlags.firstCourseItemBought) {
    state.tutorialFlags.firstCourseItemBought = true;
    state.currentStep = 3;
    reward = normalizeReward(TUTORIAL_STEP_CONTENT[3]?.reward);
    advanced = true;
  }

  if (eventType === "first_course_item_used" && state.currentStep === 3 && !state.tutorialFlags.firstCourseItemUsed) {
    state.tutorialFlags.firstCourseItemUsed = true;
    state.currentStep = 4;
    reward = normalizeReward(TUTORIAL_STEP_CONTENT[4]?.reward);
    advanced = true;
  }

  if (eventType === "first_gadget_bought" && state.currentStep === 4 && !state.tutorialFlags.firstGadgetBought) {
    state.tutorialFlags.firstGadgetBought = true;
    state.currentStep = 5;
    reward = normalizeReward(TUTORIAL_STEP_CONTENT[5]?.reward);
    advanced = true;
  }

  if (eventType === "first_gadget_equipped" && state.currentStep === 5 && !state.tutorialFlags.firstGadgetEquipped) {
    state.tutorialFlags.firstGadgetEquipped = true;
    state.currentStep = 6;
    reward = normalizeReward(TUTORIAL_STEP_CONTENT[6]?.reward);
    advanced = true;
  }

  if (eventType === "first_stock_bought" && state.currentStep === 6 && !state.tutorialFlags.firstStockBought) {
    state.tutorialFlags.firstStockBought = true;
    state.currentStep = 7;
    reward = normalizeReward(TUTORIAL_STEP_CONTENT[7]?.reward);
    advanced = true;
  }

  if (eventType === "first_education_started" && !state.tutorialFlags.firstEducationStarted) {
    state.tutorialFlags.firstEducationStarted = true;
  }

  if (eventType === "demo_company_created" && !state.tutorialFlags.demoCompanyCreated) {
    state.tutorialFlags.demoCompanyCreated = true;
  }

  if (eventType === "demo_blueprint_done" && !state.tutorialFlags.demoBlueprintDone) {
    state.tutorialFlags.demoBlueprintDone = true;
  }

  if (eventType === "demo_gadget_produced" && !state.tutorialFlags.demoGadgetProduced) {
    state.tutorialFlags.demoGadgetProduced = true;
  }

  if (eventType === "demo_gadget_sold" && !state.tutorialFlags.demoGadgetSold) {
    state.tutorialFlags.demoGadgetSold = true;
  }

  if (!advanced) {
    await persistTutorialState(user.id, state);
    return toResult(state, fromStep, false);
  }

  await applyReward(user, reward);
  await persistTutorialState(user.id, state);
  return toResult(state, fromStep, true, reward);
}

export async function assignTutorialDemoCompany(
  userId: string,
  demoCompanyId: string,
): Promise<TutorialProgressResult> {
  const context = await getTutorialContext(userId);
  if (!context) {
    throw new Error("Пользователь не найден");
  }

  const { user, state } = context;
  const fromStep = state.currentStep;
  state.demoCompanyId = demoCompanyId;
  state.tutorialFlags.demoCompanyCreated = true;
  await persistTutorialState(user.id, state);
  return toResult(state, fromStep, false);
}

export async function completeTutorial(userId: string): Promise<TutorialProgressResult> {
  const context = await getTutorialContext(userId);
  if (!context) {
    throw new Error("Пользователь не найден");
  }

  const { user, state } = context;
  const fromStep = state.currentStep;

  if (state.isCompleted) {
    return toResult(state, fromStep, false);
  }
  if (!state.isActive) {
    throw new Error("Обучение не запущено");
  }
  if (
    state.currentStep < 7
    || !state.tutorialFlags.firstJobDone
    || !state.tutorialFlags.firstCourseItemBought
    || !state.tutorialFlags.firstCourseItemUsed
    || !state.tutorialFlags.firstGadgetBought
    || !state.tutorialFlags.firstGadgetEquipped
    || !state.tutorialFlags.firstStockBought
  ) {
    throw new Error("Сначала пройди основные шаги обучения.");
  }

  state.currentStep = 8;
  state.isActive = false;
  state.isCompleted = true;
  state.completedAt = Date.now();
  state.demoCompanyId = null;

  const reward = normalizeReward(TUTORIAL_STEP_CONTENT[8]?.reward);
  await applyReward(user, reward);
  if (!(await hasInventoryItemById(user.id, TUTORIAL_MEDAL_ITEM_ID))) {
    await grantInventoryItemToPlayer(user.id, createTutorialMedalItem());
  }
  await persistTutorialState(user.id, state);
  return toResult(state, fromStep, true, reward);
}

export async function clearTutorialDemoCompany(userId: string) {
  const context = await getTutorialContext(userId);
  if (!context) return null;
  const { user, state } = context;
  if (!state.demoCompanyId) return state;
  state.demoCompanyId = null;
  await persistTutorialState(user.id, state);
  return state;
}
