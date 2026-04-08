import { randomUUID } from "crypto";
import { getProfessionById, type ProfessionSkillName } from "../shared/professions";
import { type CompanyDepartmentKey } from "../shared/company-staffing";
import { getPlayerProfessionId } from "./player-meta";
import { getCompanyStaffingSnapshot } from "./company-staffing";
import { getUserWithGameState } from "./game-engine";
import { registerRuntimeSnapshotProvider, storage } from "./storage";

export type CompanyContributionSkillType = Extract<
  ProfessionSkillName,
  "coding" | "testing" | "analytics" | "design"
>;

export type CompanyContributionSource =
  | "contract"
  | "repair"
  | "hackathon_skill"
  | "hackathon_part"
  | "hackathon_money";

export type CompanyTaskContribution = {
  id: string;
  userId: string;
  username: string;
  companyId: string;
  taskId: string;
  source: CompanyContributionSource;
  skillType: CompanyContributionSkillType;
  value: number;
  professionBonus: number;
  departmentEfficiency: number;
  randomMultiplier: number;
  createdAt: number;
  stageIndex?: number;
};

export type CompanyMemberContributionStats = {
  userId: string;
  username: string;
  skillContribution: number;
  partsContribution: number;
  moneyContribution: number;
  hackathonContribution: number;
  repairedGadgets: number;
  contractTasksCompleted: number;
  repairTasksCompleted: number;
  totalContribution: number;
  updatedAt: number;
};

const companyTaskContributionsByTaskId = new Map<string, CompanyTaskContribution[]>();
const companyMemberStatsByCompanyId = new Map<string, Map<string, CompanyMemberContributionStats>>();

const FOCUS_SKILL_CONTRIBUTION_MULTIPLIER = 1.12;
const SECONDARY_SKILL_CONTRIBUTION_MULTIPLIER = 1.06;
const SUPPORT_SKILL_CONTRIBUTION_MULTIPLIER = 1;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readDepartmentContributionMultiplier(input: {
  assignedDepartment?: CompanyDepartmentKey | null;
  isProfessionMatched?: boolean;
  efficiency?: number;
}) {
  const efficiency = Math.max(0, Number(input.efficiency || 0));
  if (!input.assignedDepartment) return 1;
  if (input.isProfessionMatched) {
    return Number((1 + efficiency * 0.12).toFixed(2));
  }
  return Number((1 + efficiency * 0.05).toFixed(2));
}

function readProfessionContributionMultiplier(
  professionId: string | null | undefined,
  skillType: CompanyContributionSkillType,
) {
  const profession = getProfessionById(professionId ?? undefined);
  if (!profession) return SUPPORT_SKILL_CONTRIBUTION_MULTIPLIER;
  if (profession.focusSkills.includes(skillType)) return FOCUS_SKILL_CONTRIBUTION_MULTIPLIER;
  if (profession.secondarySkills.includes(skillType)) return SECONDARY_SKILL_CONTRIBUTION_MULTIPLIER;
  return SUPPORT_SKILL_CONTRIBUTION_MULTIPLIER;
}

function ensureCompanyStats(companyId: string) {
  const existing = companyMemberStatsByCompanyId.get(companyId);
  if (existing) return existing;
  const next = new Map<string, CompanyMemberContributionStats>();
  companyMemberStatsByCompanyId.set(companyId, next);
  return next;
}

function computeTotalContribution(stat: Pick<
  CompanyMemberContributionStats,
  "skillContribution" | "partsContribution" | "moneyContribution" | "hackathonContribution" | "repairedGadgets" | "contractTasksCompleted" | "repairTasksCompleted"
>) {
  return Number((
    Number(stat.skillContribution || 0)
    + Number(stat.hackathonContribution || 0)
    + Number(stat.moneyContribution || 0) * 0.2
    + Number(stat.partsContribution || 0) * 40
    + Number(stat.repairedGadgets || 0) * 120
    + Number(stat.contractTasksCompleted || 0) * 80
    + Number(stat.repairTasksCompleted || 0) * 60
  ).toFixed(2));
}

function upsertMemberStats(companyId: string, userId: string, username: string) {
  const stats = ensureCompanyStats(companyId);
  const current = stats.get(userId) ?? {
    userId,
    username,
    skillContribution: 0,
    partsContribution: 0,
    moneyContribution: 0,
    hackathonContribution: 0,
    repairedGadgets: 0,
    contractTasksCompleted: 0,
    repairTasksCompleted: 0,
    totalContribution: 0,
    updatedAt: Date.now(),
  };
  const next: CompanyMemberContributionStats = {
    ...current,
    username: username || current.username,
    updatedAt: Date.now(),
  };
  stats.set(userId, next);
  return next;
}

export async function calculateCompanySkillContribution(input: {
  companyId: string;
  userId: string;
  skillType: CompanyContributionSkillType;
}) {
  const snapshot = await getUserWithGameState(input.userId);
  if (!snapshot) {
    throw new Error("Игрок не найден");
  }

  const staffing = await getCompanyStaffingSnapshot(input.companyId);
  const staffingMember = staffing.members.find((member) => String(member.userId) === String(input.userId));
  const professionId = getPlayerProfessionId(snapshot.user);
  const professionBonus = readProfessionContributionMultiplier(professionId, input.skillType);
  const departmentSummary = staffingMember?.assignedDepartment
    ? staffing.departments[staffingMember.assignedDepartment]
    : null;
  const departmentEfficiency = readDepartmentContributionMultiplier({
    assignedDepartment: staffingMember?.assignedDepartment ?? null,
    isProfessionMatched: staffingMember?.isProfessionMatched ?? false,
    efficiency: departmentSummary?.efficiency ?? 0,
  });
  const randomMultiplier = Number((0.9 + Math.random() * 0.2).toFixed(2));
  const skillValue = Math.max(1, Number((snapshot.game as any)?.skills?.[input.skillType] ?? 0));
  const value = Number((skillValue * professionBonus * departmentEfficiency * randomMultiplier).toFixed(2));

  return {
    userId: snapshot.user.id,
    username: String(snapshot.user.username || "Игрок"),
    companyId: input.companyId,
    skillType: input.skillType,
    skillValue,
    professionBonus,
    departmentEfficiency,
    randomMultiplier,
    value,
  };
}

export function recordCompanyTaskContribution(input: {
  companyId: string;
  userId: string;
  username: string;
  taskId: string;
  source: CompanyContributionSource;
  skillType: CompanyContributionSkillType;
  value: number;
  professionBonus: number;
  departmentEfficiency: number;
  randomMultiplier: number;
  stageIndex?: number;
}) {
  const contribution: CompanyTaskContribution = {
    id: randomUUID(),
    companyId: input.companyId,
    userId: input.userId,
    username: input.username,
    taskId: input.taskId,
    source: input.source,
    skillType: input.skillType,
    value: Number(input.value.toFixed(2)),
    professionBonus: Number(input.professionBonus.toFixed(2)),
    departmentEfficiency: Number(input.departmentEfficiency.toFixed(2)),
    randomMultiplier: Number(input.randomMultiplier.toFixed(2)),
    createdAt: Date.now(),
    stageIndex: input.stageIndex,
  };

  const taskContributions = companyTaskContributionsByTaskId.get(input.taskId) ?? [];
  taskContributions.push(contribution);
  companyTaskContributionsByTaskId.set(input.taskId, taskContributions);

  const stats = upsertMemberStats(input.companyId, input.userId, input.username);
  stats.skillContribution = Number((stats.skillContribution + contribution.value).toFixed(2));
  if (input.source.startsWith("hackathon")) {
    stats.hackathonContribution = Number((stats.hackathonContribution + contribution.value).toFixed(2));
  }
  stats.totalContribution = computeTotalContribution(stats);

  return contribution;
}

export function recordCompanyMoneyContribution(input: {
  companyId: string;
  userId: string;
  username: string;
  amount: number;
  source?: CompanyContributionSource;
}) {
  const stats = upsertMemberStats(input.companyId, input.userId, input.username);
  stats.moneyContribution = Number((stats.moneyContribution + Math.max(0, Number(input.amount || 0))).toFixed(2));
  if (input.source === "hackathon_money") {
    stats.hackathonContribution = Number((stats.hackathonContribution + Math.max(0, Number(input.amount || 0))).toFixed(2));
  }
  stats.totalContribution = computeTotalContribution(stats);
  return stats;
}

export function recordCompanyPartsContribution(input: {
  companyId: string;
  userId: string;
  username: string;
  quantity: number;
  source?: CompanyContributionSource;
}) {
  const stats = upsertMemberStats(input.companyId, input.userId, input.username);
  const quantity = Math.max(0, Number(input.quantity || 0));
  stats.partsContribution = Number((stats.partsContribution + quantity).toFixed(2));
  if (input.source === "hackathon_part") {
    stats.hackathonContribution = Number((stats.hackathonContribution + quantity * 40).toFixed(2));
  }
  stats.totalContribution = computeTotalContribution(stats);
  return stats;
}

export function markCompanyRepairCompleted(input: {
  companyId: string;
  userId: string;
  username: string;
}) {
  const stats = upsertMemberStats(input.companyId, input.userId, input.username);
  stats.repairedGadgets += 1;
  stats.repairTasksCompleted += 1;
  stats.totalContribution = computeTotalContribution(stats);
  return stats;
}

export function markCompanyContractCompleted(input: {
  companyId: string;
  userId: string;
  username: string;
}) {
  const stats = upsertMemberStats(input.companyId, input.userId, input.username);
  stats.contractTasksCompleted += 1;
  stats.totalContribution = computeTotalContribution(stats);
  return stats;
}

export function getTaskContributions(taskId: string) {
  return [...(companyTaskContributionsByTaskId.get(taskId) ?? [])]
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getCompanyMemberContributionStats(companyId: string) {
  const stats = companyMemberStatsByCompanyId.get(companyId);
  if (!stats) return [];
  return Array.from(stats.values())
    .sort((a, b) => b.totalContribution - a.totalContribution || a.username.localeCompare(b.username));
}

export async function ensureCompanyMemberStatsSeeded(companyId: string) {
  const members = await storage.getCompanyMembers(companyId);
  for (const member of members) {
    upsertMemberStats(companyId, String(member.userId), String(member.username || "Сотрудник"));
  }
  return getCompanyMemberContributionStats(companyId);
}

function exportCompanyCoopSnapshot() {
  return {
    taskContributions: Array.from(companyTaskContributionsByTaskId.entries()),
    memberStats: Array.from(
      companyMemberStatsByCompanyId.entries(),
      ([companyId, stats]) => [companyId, Array.from(stats.entries())] as const,
    ),
  };
}

function importCompanyCoopSnapshot(snapshot: unknown) {
  companyTaskContributionsByTaskId.clear();
  companyMemberStatsByCompanyId.clear();
  const next = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  if (Array.isArray(next.taskContributions)) {
    for (const entry of next.taskContributions) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const taskId = String(entry[0] || "").trim();
      const items = Array.isArray(entry[1]) ? entry[1] as CompanyTaskContribution[] : [];
      if (!taskId) continue;
      companyTaskContributionsByTaskId.set(taskId, items);
    }
  }
  if (Array.isArray(next.memberStats)) {
    for (const entry of next.memberStats) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const companyId = String(entry[0] || "").trim();
      const rows = Array.isArray(entry[1]) ? entry[1] : [];
      if (!companyId) continue;
      const stats = new Map<string, CompanyMemberContributionStats>();
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 2) continue;
        const userId = String(row[0] || "").trim();
        const stat = row[1];
        if (!userId || !stat || typeof stat !== "object") continue;
        stats.set(userId, stat as CompanyMemberContributionStats);
      }
      companyMemberStatsByCompanyId.set(companyId, stats);
    }
  }
}

function clearCompanyCoopSnapshot() {
  companyTaskContributionsByTaskId.clear();
  companyMemberStatsByCompanyId.clear();
}

registerRuntimeSnapshotProvider("company-coop", {
  exportSnapshot: exportCompanyCoopSnapshot,
  importSnapshot: importCompanyCoopSnapshot,
  clear: clearCompanyCoopSnapshot,
});
