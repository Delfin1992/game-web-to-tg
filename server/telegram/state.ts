/**
 * Runtime Telegram bot state shared across handlers.
 * These maps intentionally preserve the existing in-memory behavior.
 */

export const pendingActionByChatId = new Map<number, any>();
export const companyListByChatId = new Map<number, string[]>();
export const companyRequestsByChatId = new Map<number, string[]>();
export const companyContractRefsByChatId = new Map<number, string[]>();
export const companyContractPartRefsByChatId = new Map<number, string[]>();
export const companyContractSelectedPartRefsByChatId = new Map<number, string[]>();
export const companyContractPartPageByChatId = new Map<number, number>();
export const companyMemberRefsByChatId = new Map<number, string[]>();
export const companyBlueprintRefsByChatId = new Map<number, string[]>();
export const companyPartDepositRefsByChatId = new Map<number, string[]>();
export const companyExclusivePartRefsByChatId = new Map<number, string[]>();
export const companyExclusiveSelectedPartRefsByChatId = new Map<number, string[]>();
export const companyExclusivePartPageByChatId = new Map<number, number>();
export const companyWarehouseGadgetRefsByChatId = new Map<number, string[]>();
export const companyWarehousePartRefsByChatId = new Map<number, string[]>();
export const companyWarehouseFilterByChatId = new Map<number, string>();
export const marketListingRefsByChatId = new Map<number, string[]>();
export const hackathonPartRefsByChatId = new Map<number, string[]>();
export const hackathonSabotageTargetRefsByChatId = new Map<number, string[]>();
export const companyBlueprintProgressMessageByChatId = new Map<number, number>();
export const companyBlueprintProgressTimerByChatId = new Map<number, NodeJS.Timeout>();
export const companyMiningNotifyTimerByChatId = new Map<number, NodeJS.Timeout>();
export const hackathonSkillProgressByChatId = new Map<number, any>();
export const lastInlineMessageByChatId = new Map<number, number>();
export const pvpQueuePollTimerByChatId = new Map<number, NodeJS.Timeout>();
export const pvpDuelProgressMessageByChatId = new Map<number, number>();
export const pvpDuelStageKeyByChatId = new Map<number, string>();
export const companyBlueprintContribByCompanyId = new Map<string, any>();
export const companyEconomyByCompanyId = new Map<string, any>();
export const companyWarehousePartsByCompanyId = new Map<string, any[]>();
export const companyBlueprintWarehouseByCompanyId = new Map<string, Set<string>>();
export const inventoryRefsByChatId = new Map<number, string[]>();
export const shopSellRefsByChatId = new Map<number, string[]>();
export const companyMenuSectionByChatId = new Map<
  number,
  | "root"
  | "work"
  | "service"
  | "warehouse"
  | "bureau"
  | "bureau_exclusive"
  | "management"
  | "management_hr"
  | "management_departments"
  | "hackathon"
  | "hackathon_event"
  | "hackathon_sabotage"
>();
export const lastTelegramMenuByUserId = new Map<string, any>();
export const weeklyQuestStateByUserId = new Map<string, any>();
export const shopBuyRefsByChatId = new Map<number, string[]>();
export const repairGadgetRefsByChatId = new Map<number, string[]>();
export const repairOrderRefsByChatId = new Map<number, string[]>();
export const companyRepairOrderRefsByChatId = new Map<number, string[]>();
export const registrationDraftByChatId = new Map<number, any>();
export const registrationInterviewMessageByChatId = new Map<number, number>();
export const registrationInterviewFeedbackMessageByChatId = new Map<number, number>();
export const registrationTutorialAnimationByChatId = new Map<number, any>();
export const adminAuthByChatId = new Map<number, boolean>();
export const referralCodeByUserId = new Map<string, string>();
export const referralOwnerByCode = new Map<string, string>();
export const referredByUserId = new Map<string, string>();
export const referralChildrenByUserId = new Map<string, Set<string>>();
export const playerLocationByUserId = new Map<string, "home" | "city" | "company">();
export const playerTravelByUserId = new Map<string, any>();
export const companySalaryByCompanyId = new Map<string, Map<string, number>>();
export const companySalaryClaimAtByCompanyId = new Map<string, Map<string, number>>();
