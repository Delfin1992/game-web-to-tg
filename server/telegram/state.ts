/**
 * Runtime Telegram bot state shared across handlers.
 * These maps intentionally preserve the existing in-memory behavior.
 */
import { registerRuntimeSnapshotProvider } from "../storage";

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
export const companyPartSellRefsByChatId = new Map<number, string[]>();
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
export const companyBlueprintGlobalOwnerByBlueprintId = new Map<string, {
  companyId: string;
  companyName: string;
  companyEmoji?: string | null;
}>();
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

function exportNestedNumberMap(map: Map<string, Map<string, number>>) {
  return Array.from(map.entries(), ([outerKey, innerMap]) => [
    outerKey,
    Array.from(innerMap.entries()),
  ] as const);
}

function importNestedNumberMap(
  target: Map<string, Map<string, number>>,
  snapshot: unknown,
) {
  target.clear();
  if (!Array.isArray(snapshot)) return;
  for (const entry of snapshot) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const outerKey = String(entry[0] ?? "").trim();
    if (!outerKey) continue;
    const nestedEntries = Array.isArray(entry[1]) ? entry[1] : [];
    const nestedMap = new Map<string, number>();
    for (const nestedEntry of nestedEntries) {
      if (!Array.isArray(nestedEntry) || nestedEntry.length < 2) continue;
      const nestedKey = String(nestedEntry[0] ?? "").trim();
      const nestedValue = Number(nestedEntry[1]);
      if (!nestedKey || !Number.isFinite(nestedValue)) continue;
      nestedMap.set(nestedKey, nestedValue);
    }
    target.set(outerKey, nestedMap);
  }
}

export function exportCompanyRuntimeStateSnapshot() {
  return {
    companyBlueprintContribByCompanyId: Array.from(companyBlueprintContribByCompanyId.entries()),
    companyEconomyByCompanyId: Array.from(companyEconomyByCompanyId.entries()),
    companyWarehousePartsByCompanyId: Array.from(companyWarehousePartsByCompanyId.entries()),
    companyBlueprintWarehouseByCompanyId: Array.from(
      companyBlueprintWarehouseByCompanyId.entries(),
      ([companyId, blueprintIds]) => [companyId, Array.from(blueprintIds)] as const,
    ),
    companyBlueprintGlobalOwnerByBlueprintId: Array.from(companyBlueprintGlobalOwnerByBlueprintId.entries()),
    companySalaryByCompanyId: exportNestedNumberMap(companySalaryByCompanyId),
    companySalaryClaimAtByCompanyId: exportNestedNumberMap(companySalaryClaimAtByCompanyId),
  };
}

export function importCompanyRuntimeStateSnapshot(snapshot: unknown) {
  companyBlueprintContribByCompanyId.clear();
  companyEconomyByCompanyId.clear();
  companyWarehousePartsByCompanyId.clear();
  companyBlueprintWarehouseByCompanyId.clear();
  companyBlueprintGlobalOwnerByBlueprintId.clear();
  companySalaryByCompanyId.clear();
  companySalaryClaimAtByCompanyId.clear();

  const next = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};

  for (const entry of Array.isArray(next.companyBlueprintContribByCompanyId) ? next.companyBlueprintContribByCompanyId : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const companyId = String(entry[0] ?? "").trim();
    if (!companyId) continue;
    companyBlueprintContribByCompanyId.set(companyId, entry[1]);
  }

  for (const entry of Array.isArray(next.companyEconomyByCompanyId) ? next.companyEconomyByCompanyId : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const companyId = String(entry[0] ?? "").trim();
    if (!companyId) continue;
    companyEconomyByCompanyId.set(companyId, entry[1]);
  }

  for (const entry of Array.isArray(next.companyWarehousePartsByCompanyId) ? next.companyWarehousePartsByCompanyId : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const companyId = String(entry[0] ?? "").trim();
    if (!companyId || !Array.isArray(entry[1])) continue;
    companyWarehousePartsByCompanyId.set(companyId, [...entry[1]]);
  }

  for (const entry of Array.isArray(next.companyBlueprintWarehouseByCompanyId) ? next.companyBlueprintWarehouseByCompanyId : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const companyId = String(entry[0] ?? "").trim();
    if (!companyId || !Array.isArray(entry[1])) continue;
    companyBlueprintWarehouseByCompanyId.set(companyId, new Set(entry[1].map((value) => String(value))));
  }

  for (const entry of Array.isArray(next.companyBlueprintGlobalOwnerByBlueprintId) ? next.companyBlueprintGlobalOwnerByBlueprintId : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const blueprintId = String(entry[0] ?? "").trim();
    const rawOwner = entry[1];
    if (!blueprintId || !rawOwner || typeof rawOwner !== "object") continue;
    const owner = rawOwner as Record<string, unknown>;
    const companyId = String(owner.companyId ?? "").trim();
    const companyName = String(owner.companyName ?? "").trim();
    const companyEmoji = String(owner.companyEmoji ?? "").trim();
    if (!companyId || !companyName) continue;
    companyBlueprintGlobalOwnerByBlueprintId.set(blueprintId, {
      companyId,
      companyName,
      companyEmoji: companyEmoji || null,
    });
  }

  importNestedNumberMap(companySalaryByCompanyId, next.companySalaryByCompanyId);
  importNestedNumberMap(companySalaryClaimAtByCompanyId, next.companySalaryClaimAtByCompanyId);
}

export function clearCompanyRuntimeState() {
  companyBlueprintContribByCompanyId.clear();
  companyEconomyByCompanyId.clear();
  companyWarehousePartsByCompanyId.clear();
  companyBlueprintWarehouseByCompanyId.clear();
  companyBlueprintGlobalOwnerByBlueprintId.clear();
  companySalaryByCompanyId.clear();
  companySalaryClaimAtByCompanyId.clear();
}

registerRuntimeSnapshotProvider("company-telegram-state", {
  exportSnapshot: exportCompanyRuntimeStateSnapshot,
  importSnapshot: importCompanyRuntimeStateSnapshot,
  clear: clearCompanyRuntimeState,
});
