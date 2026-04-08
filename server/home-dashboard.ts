import { DEPARTMENT_LABELS } from "../client/src/lib/companySystem";
import { getDailyQuestSnapshot } from "./daily-quests/service";
import { listUserNotifications } from "./notifications/service";
import { getPlayerProfessionId } from "./player-meta";
import { canEnterPvp, getPvpAccessMessage } from "./pvp-access";
import { getCompanyStaffingSnapshot } from "./company-staffing";
import { getProfessionById } from "../shared/professions";
import { storage } from "./storage";

type ContractContributionView = {
  userId: string;
  createdAt: number;
};

type ContractStageView = {
  title?: string;
  skillType?: string;
  progress?: number;
  target?: number;
  contributions?: ContractContributionView[];
};

type ContractView = {
  id: string;
  title: string;
  status: string;
  assignedCompanyId?: string | null;
  currentStageIndex?: number;
  stages?: ContractStageView[];
};

type CompanyMembershipView = {
  company: {
    id: string;
    name: string;
    city: string;
  };
  role: string;
};

type BuildHomeDashboardSummaryDeps = {
  getUserWithGameState: (userId: string) => Promise<any | null>;
  getContractsByCity: (city: string) => ContractView[];
  isTutorialCompany?: (company: { id: string; ownerId?: string | null; name?: string | null }) => boolean;
};

export type HomeDashboardSummary = {
  serverTime: number;
  player: {
    id: string;
    name: string;
    level: number;
    professionId: string | null;
    professionName: string | null;
    professionEmoji: string | null;
  };
  today: {
    items: Array<{
      id: string;
      label: string;
      progress: number;
      target: number;
      kind: "contract" | "daily" | "rewards";
      isCompleted: boolean;
    }>;
    rewardsCount: number;
  };
  company: null | {
    companyId: string;
    companyName: string;
    role: string;
    activeContract: null | {
      id: string;
      title: string;
      progressPercent: number;
      currentStageTitle: string | null;
      currentStageSkillLabel: string | null;
      progressValue: number;
      targetValue: number;
      contributedToday: boolean;
      canContribute: boolean;
    };
    departments: Array<{
      key: string;
      label: string;
      efficiency: number;
      percent: number;
      status: "good" | "warn";
    }>;
  };
  pvp: {
    rating: number;
    available: boolean;
    reason: string | null;
  };
  inbox: {
    unreadCount: number;
    claimableCount: number;
  };
  achievements: {
    totalCount: number;
    claimableCount: number;
  };
  quickActions: {
    contractContribution: {
      visible: boolean;
      enabled: boolean;
      contractId: string | null;
      companyId: string | null;
    };
    rewards: {
      visible: boolean;
      enabled: boolean;
    };
    pvp: {
      visible: boolean;
      enabled: boolean;
    };
  };
};

function getMoscowDayStartMs(nowMs: number) {
  const shifted = new Date(nowMs + 3 * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - 3 * 60 * 60 * 1000;
}

function formatSkillTypeLabel(skillType: string | undefined) {
  if (skillType === "coding") return "Кодинг";
  if (skillType === "testing") return "Тестирование";
  if (skillType === "analytics") return "Аналитика";
  if (skillType === "design") return "Дизайн";
  if (skillType === "attention") return "Внимание";
  if (skillType === "drawing") return "Рисование";
  if (skillType === "modeling") return "3D-моделирование";
  return null;
}

function formatContractStageTitle(stage: ContractStageView | null | undefined) {
  if (!stage) return null;
  if (stage.title) return stage.title;
  const skill = formatSkillTypeLabel(stage.skillType);
  return skill ? `Этап: ${skill}` : null;
}

async function resolvePlayerCompanyMembership(
  userId: string,
  isTutorialCompany?: (company: { id: string; ownerId?: string | null; name?: string | null }) => boolean,
): Promise<CompanyMembershipView | null> {
  const companies = await storage.getAllCompanies();
  for (const company of companies) {
    if (isTutorialCompany?.(company)) continue;
    const member = await storage.getMemberByUserId(company.id, userId);
    if (!member) continue;
    return {
      company: {
        id: company.id,
        name: company.name,
        city: company.city,
      },
      role: String(member.role || "member"),
    };
  }
  return null;
}

function getContractTotalProgress(contract: ContractView | null | undefined) {
  const stages = Array.isArray(contract?.stages) ? contract.stages : [];
  const target = stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.target || 0)), 0);
  const progress = stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.progress || 0)), 0);
  const percent = target > 0 ? Math.max(0, Math.min(100, Math.round((progress / target) * 100))) : 0;
  return {
    progress: Number(progress.toFixed(1)),
    target: Number(target.toFixed(1)),
    percent,
  };
}

function getCurrentStage(contract: ContractView | null | undefined) {
  if (!contract || !Array.isArray(contract.stages) || !contract.stages.length) return null;
  const index = Math.max(0, Number(contract.currentStageIndex || 0));
  return contract.stages[index] ?? contract.stages[contract.stages.length - 1] ?? null;
}

function buildTodayItems(input: {
  contract: HomeDashboardSummary["company"] extends infer T ? T extends { activeContract: infer A } ? A : never : never;
  dailyQuests: Awaited<ReturnType<typeof getDailyQuestSnapshot>>["quests"];
  rewardsCount: number;
}) {
  const items: HomeDashboardSummary["today"]["items"] = [];

  if (input.contract) {
    items.push({
      id: "contract_contribution",
      label: "Внести вклад в контракт",
      progress: input.contract.contributedToday ? 1 : 0,
      target: 1,
      kind: "contract",
      isCompleted: input.contract.contributedToday,
    });
  }

  for (const quest of input.dailyQuests.slice(0, 2)) {
    items.push({
      id: quest.id,
      label: quest.title,
      progress: Number(quest.progress || 0),
      target: Number(quest.target || 1),
      kind: "daily",
      isCompleted: Boolean(quest.isCompleted),
    });
  }

  items.push({
    id: "claimable_rewards",
    label: "Награды",
    progress: Math.max(0, Number(input.rewardsCount || 0)),
    target: Math.max(1, Math.max(0, Number(input.rewardsCount || 0))),
    kind: "rewards",
    isCompleted: input.rewardsCount > 0,
  });

  return items;
}

export async function buildHomeDashboardSummary(
  userId: string,
  deps: BuildHomeDashboardSummaryDeps,
): Promise<HomeDashboardSummary> {
  const now = Date.now();
  const snapshot = await deps.getUserWithGameState(userId);
  const user = snapshot?.user ?? (await storage.getUser(userId));
  if (!user) throw new Error("Пользователь не найден");

  const [dailySnapshot, inboxSnapshot, membership] = await Promise.all([
    getDailyQuestSnapshot(userId),
    listUserNotifications(userId),
    resolvePlayerCompanyMembership(userId, deps.isTutorialCompany),
  ]);

  const professionId = getPlayerProfessionId(user);
  const profession = professionId ? getProfessionById(professionId) : null;
  const pvpAccess = canEnterPvp(user);
  const rewardsCount = Math.max(0, Number(inboxSnapshot.claimableCount || 0));

  let companySummary: HomeDashboardSummary["company"] = null;
  if (membership) {
    const staffing = await getCompanyStaffingSnapshot(membership.company.id);
    const activeContract = deps
      .getContractsByCity(membership.company.city)
      .find(
        (item) =>
          item.status === "in_progress" &&
          String(item.assignedCompanyId || "") === membership.company.id,
      ) ?? null;
    const currentStage = getCurrentStage(activeContract);
    const currentStageContributions = Array.isArray(currentStage?.contributions) ? currentStage.contributions : [];
    const todayStartMs = getMoscowDayStartMs(now);
    const contributedToday = currentStageContributions.some(
      (item) => String(item.userId || "") === userId && Number(item.createdAt || 0) >= todayStartMs,
    );
    const totals = getContractTotalProgress(activeContract);

    companySummary = {
      companyId: membership.company.id,
      companyName: membership.company.name,
      role: membership.role,
      activeContract: activeContract ? {
        id: activeContract.id,
        title: activeContract.title,
        progressPercent: totals.percent,
        currentStageTitle: formatContractStageTitle(currentStage),
        currentStageSkillLabel: formatSkillTypeLabel(currentStage?.skillType),
        progressValue: totals.progress,
        targetValue: totals.target,
        contributedToday,
        canContribute: !contributedToday,
      } : null,
      departments: Object.values(staffing.departments).map((department) => ({
        key: department.department,
        label: DEPARTMENT_LABELS[department.department],
        efficiency: Number(department.efficiency || 0),
        percent: Math.max(0, Math.min(100, Math.round(Number(department.efficiency || 0) * 100))),
        status: Number(department.efficiency || 0) >= 0.75 ? "good" : "warn",
      })),
    };
  }

  return {
    serverTime: now,
    player: {
      id: String(user.id),
      name: String(user.username || user.name || "Игрок"),
      level: Math.max(1, Number(user.level || 1)),
      professionId,
      professionName: profession?.name ?? null,
      professionEmoji: profession?.emoji ?? null,
    },
    today: {
      items: buildTodayItems({
        contract: companySummary?.activeContract ?? null,
        dailyQuests: dailySnapshot.quests,
        rewardsCount,
      }),
      rewardsCount,
    },
    company: companySummary,
    pvp: {
      rating: Math.max(0, Number(user.pvpRating || 1000)),
      available: pvpAccess.ok,
      reason: pvpAccess.ok ? null : getPvpAccessMessage(pvpAccess.reason),
    },
    inbox: {
      unreadCount: Math.max(0, Number(inboxSnapshot.unreadCount || 0)),
      claimableCount: rewardsCount,
    },
    achievements: {
      totalCount: 0,
      claimableCount: 0,
    },
    quickActions: {
      contractContribution: {
        visible: Boolean(companySummary?.activeContract),
        enabled: Boolean(companySummary?.activeContract?.canContribute),
        contractId: companySummary?.activeContract?.id ?? null,
        companyId: companySummary?.companyId ?? null,
      },
      rewards: {
        visible: rewardsCount > 0,
        enabled: rewardsCount > 0,
      },
      pvp: {
        visible: pvpAccess.ok,
        enabled: pvpAccess.ok,
      },
    },
  };
}
