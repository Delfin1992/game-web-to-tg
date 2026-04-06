import type { storage as storageType } from "../storage";

type BuildUserRoutePayloadDeps = {
  storage: typeof storageType;
  getUserWithGameState: (userId: string) => Promise<any | null>;
  getTutorialState: (userId: string) => Promise<any | null>;
  buildPlayerRegistrationState: (user: any) => { registrationStep?: string } & Record<string, unknown>;
  getCurrentInterviewQuestion: (user: any) => any;
  serializeSafeUser: (user: any) => any;
};

export async function buildUserRoutePayload(
  deps: BuildUserRoutePayloadDeps,
  userId: string,
): Promise<any | null> {
  const snapshot = await deps.getUserWithGameState(userId);
  if (!snapshot) {
    return null;
  }

  const { user, game, notices } = snapshot;
  const tutorial = await deps.getTutorialState(user.id);
  const registrationState = deps.buildPlayerRegistrationState(user);
  const tutorialCompany = registrationState.registrationStep === "first_craft"
    ? await deps.storage.getTutorialCompanyByOwner(user.id)
    : null;

  return {
    ...deps.serializeSafeUser(user),
    skills: game.skills,
    inventory: game.inventory,
    workTime: Math.round(game.workTime * 100),
    studyTime: Math.round(game.studyTime * 100),
    gramBalance: game.gramBalance,
    activeBankProduct: game.activeBankProduct,
    activePvpBankBoost: (game as any).activePvpBankBoost ?? null,
    jobDropPity: game.jobDropPity,
    tutorial,
    notices,
    currentInterviewQuestion: deps.getCurrentInterviewQuestion(user),
    tutorialCompany,
  };
}
