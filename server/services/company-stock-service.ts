import {
  INITIAL_COMPANY_SHARES,
  reconcileCompanyEconomy,
  type CompanyEconomyLike,
  type CompanyEconomyState,
  type CompanyShares,
  type CompanyStockDayState,
  type CompanyStockPriceHistoryEntry,
} from "../../client/src/lib/companySystem";
import { companyBlueprintWarehouseByCompanyId, companyEconomyByCompanyId } from "../telegram/state";
import { storage, registerRuntimeSnapshotProvider } from "../storage";
import { getUserWithGameState } from "../game-engine";

export const COMPANY_IPO_REQUIREMENTS = {
  minCompanyAgeDays: 14,
  minEmployees: 10,
  minTotalSkills: 200,
  minDevelopedGadgets: 3,
  minHackathonParticipation: 1,
  minBalanceGrm: 100000,
} as const;

export const COMPANY_IPO_SHARE_CONFIG = {
  totalShares: 10000,
  freeFloatShares: 2000,
  minPriceGrm: 100,
  maxPriceGrm: 300,
} as const;

export const COMPANY_STOCK_BALANCE_THRESHOLDS = {
  minGrowth: 5000,
  strongGrowth: 20000,
  minDrop: 5000,
  strongDrop: 20000,
} as const;

export const COMPANY_STOCK_DAILY_LIMIT_PERCENT = 15;

export const COMPANY_STOCK_FACTOR_PCT = {
  employeeActivity1: 1,
  employeeActivity5: 2,
  employeeActivity10: 3,
  balanceGrowth: 2,
  strongBalanceGrowth: 1,
  newBlueprint: 3,
  newGadget: 2,
  exclusiveGadget: 4,
  employeeHired: 1,
  hackathon1: 8,
  hackathon2: 5,
  hackathon3: 3,
  weakActivity: -2,
  zeroActivity: -4,
  balanceDrop: -2,
  majorBalanceDrop: -4,
  employeeLeftSingle: -1,
  employeeLeftMultiple: -3,
  noDevelopment: -1,
  badEventResult: -2,
} as const;

type CompanyEconomyRuntimeState = CompanyEconomyState & {
  companyId: string;
  companyName: string;
  city: string;
};

type CompanyIpoMetrics = {
  companyAgeDays: number;
  employeeCount: number;
  totalSkills: number;
  developedGadgets: number;
  hackathonParticipationCount: number;
  balanceGrm: number;
};

export type CompanyIpoChecklistItem = {
  key: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
};

export type CompanyIpoEligibility = {
  allDone: boolean;
  items: CompanyIpoChecklistItem[];
  metrics: CompanyIpoMetrics;
};

type CompanyStockMetrics = {
  activeEmployeeCount: number;
  currentBalance: number;
  currentEmployeeCount: number;
};

type CompanyStockPreview = {
  dayState: CompanyStockDayState;
  deltaPercent: number;
  summary: string[];
};

let lastProcessedDayKey: string | null = null;
let schedulerTimer: NodeJS.Timeout | null = null;

function round2(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getMoscowDayParts(nowMs: number) {
  const shifted = new Date(nowMs + 3 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return { year, month, day };
}

export function getMoscowDayKey(nowMs: number = Date.now()) {
  const { year, month, day } = getMoscowDayParts(nowMs);
  return `${year}-${month}-${day}`;
}

function getMoscowDayStartMs(nowMs: number = Date.now()) {
  const shifted = new Date(nowMs + 3 * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - 3 * 60 * 60 * 1000;
}

function createDefaultStockDayState(date: string, balance: number, employeeCount: number): CompanyStockDayState {
  return {
    date,
    previousBalance: round2(balance),
    currentBalance: round2(balance),
    openingEmployeeCount: Math.max(0, Math.floor(employeeCount)),
    activeEmployeeCount: 0,
    hiredCount: 0,
    leftCount: 0,
    producedGadgetsCount: 0,
    exclusiveProducedCount: 0,
    completedBlueprintsCount: 0,
    hackathonParticipationCount: 0,
    lastHackathonPlace: null,
    badEventResult: false,
    growthFactors: {
      employeeActivity1: false,
      employeeActivity5: false,
      employeeActivity10: false,
      balanceGrowth: false,
      strongBalanceGrowth: false,
      newBlueprint: false,
      newGadget: false,
      exclusiveGadget: false,
      employeeHired: false,
      hackathon1: false,
      hackathon2: false,
      hackathon3: false,
    },
    declineFactors: {
      weakActivity: true,
      zeroActivity: true,
      balanceDrop: true,
      majorBalanceDrop: true,
      employeeLeft: true,
      noDevelopment: true,
      badEventResult: true,
    },
  };
}

function toRuntimeCompanyEconomyState(company: any, economy: CompanyEconomyState): CompanyEconomyRuntimeState {
  return {
    ...economy,
    companyId: String(company.id),
    companyName: String(company.name || ""),
    city: String(company.city || "San Francisco"),
  };
}

function getRuntimeEconomy(companyId: string) {
  return companyEconomyByCompanyId.get(String(companyId)) as CompanyEconomyRuntimeState | undefined;
}

function setRuntimeEconomy(company: any, economy: CompanyEconomyState) {
  const runtime = toRuntimeCompanyEconomyState(company, economy);
  companyEconomyByCompanyId.set(String(company.id), runtime);
  return runtime;
}

export function setCompanyEconomyRuntimeState(company: any, economy: CompanyEconomyState) {
  return setRuntimeEconomy(company, economy);
}

export function ensureCompanyStockDayState<T extends CompanyEconomyLike>(company: T, nowMs: number = Date.now()) {
  const normalized = reconcileCompanyEconomy(company);
  const date = getMoscowDayKey(nowMs);
  if (normalized.shares.stockDayState.date === date) {
    return normalized;
  }
  return reconcileCompanyEconomy({
    ...normalized,
    shares: {
      ...normalized.shares,
      stockDayState: createDefaultStockDayState(date, normalized.capitalGRM, normalized.employeeCount),
    },
  });
}

export async function buildCompanyIpoEligibility(company: any, economy: CompanyEconomyState): Promise<CompanyIpoEligibility> {
  const members = await storage.getCompanyMembers(company.id);
  const earliestJoinedAt = members
    .map((member) => Number(member.createdAt || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right)[0];
  const companyAgeDays = earliestJoinedAt
    ? Math.floor((Date.now() - earliestJoinedAt * 1000) / (24 * 60 * 60 * 1000))
    : COMPANY_IPO_REQUIREMENTS.minCompanyAgeDays;

  let totalSkills = 0;
  for (const member of members) {
    const snapshot = await getUserWithGameState(member.userId);
    const skills = (snapshot?.game as any)?.skills ?? {};
    totalSkills += Number(skills.coding || 0);
    totalSkills += Number(skills.testing || 0);
    totalSkills += Number(skills.design || 0);
    totalSkills += Number(skills.analytics || 0);
    totalSkills += Number(skills.attention || 0);
  }

  const developedGadgets = companyBlueprintWarehouseByCompanyId.get(String(company.id))?.size ?? 0;
  const participationCount = Math.max(
    0,
    Number(economy.shares.stockDayState.hackathonParticipationCount || 0),
  );

  const metrics: CompanyIpoMetrics = {
    companyAgeDays,
    employeeCount: members.length,
    totalSkills,
    developedGadgets,
    hackathonParticipationCount: participationCount,
    balanceGrm: Math.max(0, Number(company.balance ?? economy.capitalGRM ?? 0)),
  };

  const items: CompanyIpoChecklistItem[] = [
    {
      key: "companyAgeDays",
      label: "Компания существует 14+ дней",
      current: metrics.companyAgeDays,
      target: COMPANY_IPO_REQUIREMENTS.minCompanyAgeDays,
      done: metrics.companyAgeDays >= COMPANY_IPO_REQUIREMENTS.minCompanyAgeDays,
    },
    {
      key: "employeeCount",
      label: "Сотрудники",
      current: metrics.employeeCount,
      target: COMPANY_IPO_REQUIREMENTS.minEmployees,
      done: metrics.employeeCount >= COMPANY_IPO_REQUIREMENTS.minEmployees,
    },
    {
      key: "totalSkills",
      label: "Суммарные навыки",
      current: metrics.totalSkills,
      target: COMPANY_IPO_REQUIREMENTS.minTotalSkills,
      done: metrics.totalSkills >= COMPANY_IPO_REQUIREMENTS.minTotalSkills,
    },
    {
      key: "developedGadgets",
      label: "Разработано гаджетов",
      current: metrics.developedGadgets,
      target: COMPANY_IPO_REQUIREMENTS.minDevelopedGadgets,
      done: metrics.developedGadgets >= COMPANY_IPO_REQUIREMENTS.minDevelopedGadgets,
    },
    {
      key: "hackathonParticipation",
      label: "Участие в хакатоне",
      current: metrics.hackathonParticipationCount,
      target: COMPANY_IPO_REQUIREMENTS.minHackathonParticipation,
      done: metrics.hackathonParticipationCount >= COMPANY_IPO_REQUIREMENTS.minHackathonParticipation,
    },
    {
      key: "balanceGrm",
      label: "Баланс компании",
      current: metrics.balanceGrm,
      target: COMPANY_IPO_REQUIREMENTS.minBalanceGrm,
      done: metrics.balanceGrm >= COMPANY_IPO_REQUIREMENTS.minBalanceGrm,
    },
  ];

  return {
    allDone: items.every((item) => item.done),
    items,
    metrics,
  };
}

export function calculateCompanyIpoSharePrice(metrics: CompanyIpoMetrics) {
  const rawPrice =
    50
    + Math.floor(metrics.balanceGrm / 5000)
    + (metrics.employeeCount * 2)
    + (metrics.developedGadgets * 10);
  return clamp(
    Math.round(rawPrice),
    COMPANY_IPO_SHARE_CONFIG.minPriceGrm,
    COMPANY_IPO_SHARE_CONFIG.maxPriceGrm,
  );
}

export function launchCompanyIpo(company: CompanyEconomyState, eligibility: CompanyIpoEligibility, nowMs: number = Date.now()) {
  if (!eligibility.allDone) {
    return { ok: false as const, reason: "Не выполнены требования IPO", company };
  }
  const normalized = ensureCompanyStockDayState(company, nowMs);
  const sharePrice = calculateCompanyIpoSharePrice(eligibility.metrics);
  const updated = reconcileCompanyEconomy({
    ...normalized,
    stage: "public",
    shares: {
      ...normalized.shares,
      totalShares: COMPANY_IPO_SHARE_CONFIG.totalShares,
      freeFloatShares: COMPANY_IPO_SHARE_CONFIG.freeFloatShares,
      sharePriceGRM: sharePrice,
      isIPOAvailable: true,
      isPublic: true,
      ipoLaunchedAt: nowMs,
      lastPriceDeltaPercent: 0,
    },
  });
  return { ok: true as const, company: updated, sharePrice };
}

export function recordCompanyHackathonParticipation(companyId: string, nowMs: number = Date.now()) {
  const current = getRuntimeEconomy(companyId);
  if (!current) return;
  const next = ensureCompanyStockDayState(current, nowMs);
  next.shares.stockDayState.hackathonParticipationCount += 1;
  setRuntimeEconomy({ id: current.companyId, name: current.companyName, city: current.city }, next);
}

export function recordCompanyBlueprintCompleted(companyId: string, nowMs: number = Date.now()) {
  const current = getRuntimeEconomy(companyId);
  if (!current) return;
  const next = ensureCompanyStockDayState(current, nowMs);
  next.shares.stockDayState.completedBlueprintsCount += 1;
  setRuntimeEconomy({ id: current.companyId, name: current.companyName, city: current.city }, next);
}

export function recordCompanyProductionClaim(companyId: string, producedCount: number, exclusiveCount: number, nowMs: number = Date.now()) {
  const current = getRuntimeEconomy(companyId);
  if (!current) return;
  const next = ensureCompanyStockDayState(current, nowMs);
  next.shares.stockDayState.producedGadgetsCount += Math.max(0, Math.floor(producedCount || 0));
  next.shares.stockDayState.exclusiveProducedCount += Math.max(0, Math.floor(exclusiveCount || 0));
  setRuntimeEconomy({ id: current.companyId, name: current.companyName, city: current.city }, next);
}

export function recordCompanyHackathonPlacement(companyId: string, place: number | null, nowMs: number = Date.now()) {
  const current = getRuntimeEconomy(companyId);
  if (!current) return;
  const next = ensureCompanyStockDayState(current, nowMs);
  next.shares.stockDayState.lastHackathonPlace = place && place > 0 ? Math.floor(place) : null;
  next.shares.stockDayState.badEventResult = !place || place > 3;
  setRuntimeEconomy({ id: current.companyId, name: current.companyName, city: current.city }, next);
}

async function buildCompanyStockMetrics(company: any, economy: CompanyEconomyState, nowMs: number): Promise<CompanyStockMetrics> {
  const members = await storage.getCompanyMembers(company.id);
  const sinceSec = Math.floor(getMoscowDayStartMs(nowMs) / 1000);
  let activeEmployeeCount = 0;
  for (const member of members) {
    const user = await storage.getUser(member.userId);
    if (Number(user?.lastActiveAt || 0) >= sinceSec) {
      activeEmployeeCount += 1;
    }
  }
  return {
    activeEmployeeCount,
    currentBalance: Math.max(0, Number(company.balance ?? economy.capitalGRM ?? 0)),
    currentEmployeeCount: members.length,
  };
}

function evaluateStockDayState(
  economy: CompanyEconomyState,
  metrics: CompanyStockMetrics,
  nowMs: number,
): CompanyStockPreview {
  const normalized = ensureCompanyStockDayState(economy, nowMs);
  const dayState = {
    ...normalized.shares.stockDayState,
    currentBalance: round2(metrics.currentBalance),
    activeEmployeeCount: Math.max(0, metrics.activeEmployeeCount),
  };

  const growth = { ...dayState.growthFactors };
  const decline = { ...dayState.declineFactors };

  growth.employeeActivity1 = metrics.activeEmployeeCount >= 1;
  growth.employeeActivity5 = metrics.activeEmployeeCount >= 5;
  growth.employeeActivity10 = metrics.activeEmployeeCount >= 10;
  decline.zeroActivity = metrics.activeEmployeeCount <= 0;
  decline.weakActivity = metrics.activeEmployeeCount > 0 && metrics.activeEmployeeCount < 5;

  const balanceDiff = round2(metrics.currentBalance - dayState.previousBalance);
  growth.balanceGrowth = balanceDiff >= COMPANY_STOCK_BALANCE_THRESHOLDS.minGrowth;
  growth.strongBalanceGrowth = balanceDiff >= COMPANY_STOCK_BALANCE_THRESHOLDS.strongGrowth;
  decline.balanceDrop = balanceDiff <= -COMPANY_STOCK_BALANCE_THRESHOLDS.minDrop;
  decline.majorBalanceDrop = balanceDiff <= -COMPANY_STOCK_BALANCE_THRESHOLDS.strongDrop;

  dayState.hiredCount = Math.max(0, metrics.currentEmployeeCount - dayState.openingEmployeeCount);
  dayState.leftCount = Math.max(0, dayState.openingEmployeeCount - metrics.currentEmployeeCount);
  growth.employeeHired = dayState.hiredCount > 0;
  decline.employeeLeft = dayState.leftCount > 0;

  growth.newBlueprint = dayState.completedBlueprintsCount > 0;
  growth.newGadget = dayState.producedGadgetsCount > 0;
  growth.exclusiveGadget = dayState.exclusiveProducedCount > 0;
  decline.noDevelopment = dayState.completedBlueprintsCount <= 0 && dayState.producedGadgetsCount <= 0 && dayState.exclusiveProducedCount <= 0;
  growth.hackathon1 = dayState.lastHackathonPlace === 1;
  growth.hackathon2 = dayState.lastHackathonPlace === 2;
  growth.hackathon3 = dayState.lastHackathonPlace === 3;
  decline.badEventResult = Boolean(dayState.badEventResult);

  dayState.growthFactors = growth;
  dayState.declineFactors = decline;

  let delta = 0;
  if (growth.employeeActivity1) delta += COMPANY_STOCK_FACTOR_PCT.employeeActivity1;
  if (growth.employeeActivity5) delta += COMPANY_STOCK_FACTOR_PCT.employeeActivity5 - COMPANY_STOCK_FACTOR_PCT.employeeActivity1;
  if (growth.employeeActivity10) delta += COMPANY_STOCK_FACTOR_PCT.employeeActivity10 - COMPANY_STOCK_FACTOR_PCT.employeeActivity5;
  if (growth.balanceGrowth) delta += COMPANY_STOCK_FACTOR_PCT.balanceGrowth;
  if (growth.strongBalanceGrowth) delta += COMPANY_STOCK_FACTOR_PCT.strongBalanceGrowth;
  if (growth.newBlueprint) delta += COMPANY_STOCK_FACTOR_PCT.newBlueprint;
  if (growth.newGadget) delta += COMPANY_STOCK_FACTOR_PCT.newGadget;
  if (growth.exclusiveGadget) delta += COMPANY_STOCK_FACTOR_PCT.exclusiveGadget;
  if (growth.employeeHired) delta += COMPANY_STOCK_FACTOR_PCT.employeeHired;
  if (growth.hackathon1) delta += COMPANY_STOCK_FACTOR_PCT.hackathon1;
  if (growth.hackathon2) delta += COMPANY_STOCK_FACTOR_PCT.hackathon2;
  if (growth.hackathon3) delta += COMPANY_STOCK_FACTOR_PCT.hackathon3;
  if (decline.zeroActivity) delta += COMPANY_STOCK_FACTOR_PCT.zeroActivity;
  else if (decline.weakActivity) delta += COMPANY_STOCK_FACTOR_PCT.weakActivity;
  if (decline.majorBalanceDrop) delta += COMPANY_STOCK_FACTOR_PCT.majorBalanceDrop;
  else if (decline.balanceDrop) delta += COMPANY_STOCK_FACTOR_PCT.balanceDrop;
  if (decline.employeeLeft) {
    delta += dayState.leftCount > 1
      ? COMPANY_STOCK_FACTOR_PCT.employeeLeftMultiple
      : COMPANY_STOCK_FACTOR_PCT.employeeLeftSingle;
  }
  if (decline.noDevelopment) delta += COMPANY_STOCK_FACTOR_PCT.noDevelopment;
  if (decline.badEventResult) delta += COMPANY_STOCK_FACTOR_PCT.badEventResult;

  delta = clamp(delta, -COMPANY_STOCK_DAILY_LIMIT_PERCENT, COMPANY_STOCK_DAILY_LIMIT_PERCENT);

  const summary: string[] = [];
  if (growth.employeeActivity10) summary.push("сильная активность сотрудников");
  else if (growth.employeeActivity5) summary.push("хорошая активность сотрудников");
  else if (growth.employeeActivity1) summary.push("есть активные сотрудники");
  if (growth.balanceGrowth) summary.push("рост баланса");
  if (growth.newBlueprint) summary.push("новый чертёж");
  if (growth.newGadget) summary.push("новый гаджет");
  if (growth.exclusiveGadget) summary.push("эксклюзивный гаджет");
  if (growth.employeeHired) summary.push("найм сотрудников");
  if (growth.hackathon1) summary.push("1 место в хакатоне");
  if (growth.hackathon2) summary.push("2 место в хакатоне");
  if (growth.hackathon3) summary.push("3 место в хакатоне");
  if (decline.zeroActivity) summary.push("нулевая активность");
  else if (decline.weakActivity) summary.push("слабая активность");
  if (decline.majorBalanceDrop) summary.push("сильная просадка баланса");
  else if (decline.balanceDrop) summary.push("падение баланса");
  if (decline.employeeLeft) summary.push("уход сотрудников");
  if (decline.noDevelopment) summary.push("застой в разработке");
  if (decline.badEventResult) summary.push("плохой результат события");

  return { dayState, deltaPercent: round2(delta), summary };
}

export async function buildCompanyStockPreview(company: any, economy: CompanyEconomyState, nowMs: number = Date.now()) {
  const metrics = await buildCompanyStockMetrics(company, economy, nowMs);
  return evaluateStockDayState(economy, metrics, nowMs);
}

export async function finalizeCompanyStockDay(company: any, nowMs: number = Date.now()) {
  const currentRaw = getRuntimeEconomy(company.id) ?? toRuntimeCompanyEconomyState(company, ensureCompanyStockDayState(company as any, nowMs));
  const metrics = await buildCompanyStockMetrics(company, currentRaw, nowMs);
  const preview = evaluateStockDayState(currentRaw, metrics, nowMs);
  const currentPrice = Math.max(0.01, Number(currentRaw.shares.sharePriceGRM || 0));
  const nextPrice = Math.max(1, round2(currentPrice * (1 + preview.deltaPercent / 100)));
  const historyEntry: CompanyStockPriceHistoryEntry = {
    date: preview.dayState.date,
    previousPrice: round2(currentPrice),
    newPrice: round2(nextPrice),
    deltaPercent: preview.deltaPercent,
    summary: preview.summary.slice(0, 6),
  };

  const updated = reconcileCompanyEconomy({
    ...currentRaw,
    shares: {
      ...currentRaw.shares,
      sharePriceGRM: nextPrice,
      lastPriceDeltaPercent: preview.deltaPercent,
      stockPriceHistory: [historyEntry, ...(currentRaw.shares.stockPriceHistory ?? [])].slice(0, 14),
      stockDayState: createDefaultStockDayState(getMoscowDayKey(nowMs), metrics.currentBalance, metrics.currentEmployeeCount),
    },
  });
  const runtime = setRuntimeEconomy(company, updated);
  return { company: runtime, historyEntry, summary: preview.summary, deltaPercent: preview.deltaPercent };
}

export async function startCompanyStockDailyScheduler(options?: {
  onCompanyUpdated?: (payload: {
    company: CompanyEconomyRuntimeState;
    historyEntry: CompanyStockPriceHistoryEntry;
    summary: string[];
  }) => Promise<void> | void;
}) {
  if (schedulerTimer) return;
  const tick = async () => {
    try {
      const nowMs = Date.now();
      const currentDayKey = getMoscowDayKey(nowMs);
      if (!lastProcessedDayKey) {
        lastProcessedDayKey = currentDayKey;
      } else if (lastProcessedDayKey !== currentDayKey) {
        const companies = await storage.getAllCompanies();
        for (const company of companies) {
          const current = getRuntimeEconomy(company.id);
          if (!current?.shares?.isPublic) continue;
          const result = await finalizeCompanyStockDay(company, nowMs);
          await options?.onCompanyUpdated?.({
            company: result.company,
            historyEntry: result.historyEntry,
            summary: result.summary,
          });
        }
        lastProcessedDayKey = currentDayKey;
      }
    } finally {
      schedulerTimer = setTimeout(() => {
        void tick();
      }, 60_000);
    }
  };
  schedulerTimer = setTimeout(() => {
    void tick();
  }, 60_000);
}

export function stopCompanyStockDailyScheduler() {
  if (!schedulerTimer) return;
  clearTimeout(schedulerTimer);
  schedulerTimer = null;
}

export async function getPublicCompanyStockViews(): Promise<Array<{
  companyId: string;
  companyName: string;
  city: string;
  sharePriceGrm: number;
  deltaPercent: number;
}>> {
  const companies = await storage.getAllCompanies();
  return companies
    .map((company) => {
      const economy = getRuntimeEconomy(company.id);
      if (!economy?.shares?.isPublic) return null;
      return {
        companyId: String(company.id),
        companyName: String(company.name),
        city: String(company.city),
        sharePriceGrm: round2(Number(economy.shares.sharePriceGRM || 0)),
        deltaPercent: round2(Number(economy.shares.lastPriceDeltaPercent || 0)),
      };
    })
    .filter((item): item is {
      companyId: string;
      companyName: string;
      city: string;
      sharePriceGrm: number;
      deltaPercent: number;
    } => Boolean(item))
    .sort((left: any, right: any) => right.sharePriceGrm - left.sharePriceGrm);
}

function exportCompanyStockRuntimeSnapshot() {
  return { lastProcessedDayKey };
}

function importCompanyStockRuntimeSnapshot(snapshot: unknown) {
  lastProcessedDayKey = null;
  if (!snapshot || typeof snapshot !== "object") return;
  const data = snapshot as Record<string, unknown>;
  lastProcessedDayKey = typeof data.lastProcessedDayKey === "string" ? data.lastProcessedDayKey : null;
}

function clearCompanyStockRuntimeSnapshot() {
  lastProcessedDayKey = null;
}

registerRuntimeSnapshotProvider("company-stock-runtime", {
  exportSnapshot: exportCompanyStockRuntimeSnapshot,
  importSnapshot: importCompanyStockRuntimeSnapshot,
  clear: clearCompanyStockRuntimeSnapshot,
});
