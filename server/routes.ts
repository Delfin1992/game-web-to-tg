// server/routes.ts
import type { Express } from "express";
import { type Server } from "http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { insertMessageSchema, insertUserSchema } from "../shared/schema";
import {
  countRegistrationSkillPoints,
  isValidRegistrationSkillsAllocation,
  normalizeRegistrationSkillsAllocation,
  REGISTRATION_INITIAL_SKILL_POINTS,
} from "../shared/registration";
import { GADGET_BLUEPRINTS, getAvailableBlueprints, RARITY_QUALITY_MULTIPLIERS, type BlueprintStatus } from "../shared/gadgets";
import {
  applyGameStatePatch,
  applyGadgetWear,
  createGadgetConditionProfile,
  getUserWithGameState,
  spendGram,
} from "./game-engine";
import { ALL_PARTS } from "../client/src/lib/parts";
import {
  COMPANY_MINING_DEFAULT_PLAN_ID,
  COMPANY_MINING_PLANS,
  getCompanyMiningPlan,
  type CompanyMiningRewardView,
  type CompanyMiningStatus,
  type CompanyMiningPlanId,
} from "../shared/company-mining";
import {
  TELEGRAM_PENDING_PASSWORD_PREFIX,
  buildPlayerRegistrationState,
  buildRegistrationOptions,
  completeRegistration,
  ensureFirstCraftRegistrationAssets,
  getCurrentInterviewQuestion,
  getRegistrationMeta,
  markRegistrationFirstCraftCompleted,
  resolveRegistrationCityName,
  resolveRegistrationPersonalityId,
  saveRegistrationProgress,
  submitRegistrationAnswer,
} from "./registration";
import {
  TUTORIAL_DEMO_BLUEPRINT,
  TUTORIAL_DEMO_COMPANY_NAME,
  TUTORIAL_STEP_CONTENT,
  getTutorialActiveStep,
  getTutorialProgressText,
  type TutorialEventType,
} from "../shared/tutorial";
import {
  applyTutorialEvent,
  assignTutorialDemoCompany,
  clearTutorialDemoCompany,
  completeTutorial,
  getTutorialState,
  startTutorial,
} from "./tutorial";
import { assertFeatureEnabled, getGameSettings, updateGameSettings } from "./game-settings";
import type { GameSettingsPatch } from "../shared/game-settings";
import { BALANCE_CONFIG, getCompanyCreateCostLocal, getMarketFeeRate, resolveCityId } from "../shared/balance-config";
import {
  WEEKLY_HACKATHON_CONFIG,
  HACKATHON_ALLOWED_PART_TYPES,
  type HackathonPartType,
  type HackathonSabotageType,
} from "../shared/weekly-hackathon";
import {
  applyWinnerRewardsToCompanies,
  contributeGrmToWeeklyHackathon,
  contributePartToWeeklyHackathon,
  contributeSkillToWeeklyHackathon,
  endWeeklyHackathon,
  formatWeeklyHackathonTop,
  getWeeklyHackathonCompanyScore,
  getWeeklyHackathonPlayerStats,
  getWeeklyHackathonSabotageState,
  getWeeklyHackathonState,
  launchWeeklyHackathonSabotage,
  resolveHackathonPoachOffer,
  getWinnerBoostForCompany,
  setHackathonCompanySecurityLevel,
  registerCompanyForWeeklyHackathon,
  resetWeeklyHackathon,
  startWeeklyHackathon,
  startWeeklyHackathonScheduler,
} from "./weekly-hackathon";
import {
  PROFESSIONS,
  PROFESSION_UNLOCK_LEVEL,
  getProfessionById,
  isProfessionId,
} from "../shared/professions";
import {
  canSelectProfession,
  getAdvancedPersonalityId,
  getPlayerProfessionId,
  setPlayerProfession,
} from "./player-meta";
import {
  generateEvent,
  getCurrentGlobalEvents,
  getGlobalEventModifier,
  getGlobalEventsHistory,
  refreshGlobalEventsCache,
} from "./game/events/event-engine";
import { startGlobalEventScheduler } from "./game/events/event-scheduler";
import { registerProductionSignal } from "./game/events/event-history";
import { PVP_DUEL_CONFIG } from "../shared/pvp-duel";
import {
  clearPendingPvpBoosts,
  getPendingPvpBoosts,
  getPvpBoostCatalog,
  consumePendingPvpResult,
  getPvpQueueState,
  leavePvpQueue,
  type PvpDuelResult,
  purchasePvpBoost,
  settleCompletedPvpDuels,
  startActivePvpDuelNow,
  queuePlayerForPvp,
  runPvpMatchmaking,
  updatePvpHeartbeat,
} from "./pvp-duel";
import { startPvpTestBotLoop } from "./pvp-test-bot";
import {
  buyStockAsset,
  getStockMarketSnapshot,
  sellStockAsset,
} from "./stock-exchange";
import { getDepartmentEffects, reconcileCompanyEconomy, type CompanyDepartmentEffects, type CompanyEconomyLike } from "../client/src/lib/companySystem";
import { assignCompanyMemberDepartment, clearCompanyStaffing, getCompanyStaffingSnapshot } from "./company-staffing";
import { type CompanyDepartmentKey } from "../shared/company-staffing";
import {
  buildExclusiveBlueprintDefinition,
  EXCLUSIVE_RESEARCH_SKILLS,
  getExclusiveResearchState,
  type ExclusiveBlueprintDefinition,
  type ExclusiveProjectState,
  type ExclusiveResearchMap,
  type ExclusiveSeedPart,
} from "../shared/exclusive-gadgets";
import { getAdminPassword, warnIfAdminPasswordMissing } from "./shared/env";

type CompanyBlueprintState = {
  blueprintId: string;
  status: BlueprintStatus;
  progressHours: number;
  startedAt?: number;
  completedAt?: number;
};

type ProducedGadget = {
  id: string;
  blueprintId: string;
  companyId: string;
  name: string;
  category: string;
  description?: string;
  stats: Record<string, number>;
  quality: number;
  minPrice: number;
  maxPrice: number;
  durability: number;
  maxDurability: number;
  condition: number;
  maxCondition: number;
  isBroken?: boolean;
  reliability?: number;
  producedAt: number;
  isExclusive?: boolean;
  exclusiveBonusType?: "finance" | "xp" | "skills";
  exclusiveBonusValue?: number;
  exclusiveBonusLabel?: string;
};

const companyEmojiSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined"
  ? new Intl.Segmenter("ru", { granularity: "grapheme" })
  : null;

function normalizeCompanyNameInput(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeCompanyEmojiInput(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function isValidCompanyEmojiInput(value: string) {
  if (!value || value.length > 16) return false;
  const graphemes = companyEmojiSegmenter
    ? Array.from(companyEmojiSegmenter.segment(value), (part) => part.segment)
    : Array.from(value);
  if (graphemes.length !== 1) return false;
  return /[\p{Extended_Pictographic}\p{Regional_Indicator}\u200d\uFE0F]/u.test(value);
}

function buildCompanyDisplayName(name: string, emoji: string) {
  return `${emoji} ${name}`.trim();
}

type MarketListing = {
  id: string;
  gadgetId: string;
  companyId: string;
  companyName: string;
  sellerUserId: string;
  saleType: "fixed" | "auction";
  price?: number;
  startingPrice?: number;
  currentBid?: number;
  currentBidderId?: string;
  auctionEndsAt?: number;
  minIncrement?: number;
  status: "active" | "sold" | "expired";
  salePrice?: number;
  createdAt: number;
  sold: boolean;
};

type CityContractStatus = "open" | "in_progress" | "completed";
type CityContractKind = "gadget_delivery" | "parts_supply" | "skill_research";

type CityContract = {
  id: string;
  city: string;
  title: string;
  customer: string;
  kind: CityContractKind;
  category: string;
  requiredQuantity: number;
  minQuality: number;
  requiredPartType?: string;
  requiredSkill?: "coding" | "design" | "analytics" | "testing";
  requiredSkillPoints?: number;
  rewardMoney: number;
  rewardOrk: number;
  expiresAt: number;
  status: CityContractStatus;
  assignedCompanyId?: string;
  completedAt?: number;
};

type CompanyMiningState = {
  companyId: string;
  startedByUserId: string;
  startedAt: number;
  endsAt: number;
  planId: CompanyMiningPlanId;
  reward: CompanyMiningRewardView;
  claimedAt?: number;
};

const companyBlueprints = new Map<string, CompanyBlueprintState>();
const companyGadgets = new Map<string, ProducedGadget[]>();
const exclusiveProjectByCompanyId = new Map<string, ExclusiveProjectState>();
const exclusiveCatalogByCompanyId = new Map<string, ExclusiveBlueprintDefinition[]>();

function createEmptyExclusiveResearchMap(): ExclusiveResearchMap {
  return {
    coding: 0,
    testing: 0,
    analytics: 0,
    design: 0,
    attention: 0,
  };
}

function buildExclusiveResearchContribution(input: {
  members: Array<{
    skills: Record<string, number>;
    professionId: string | null;
    advancedPersonalityId: string | null;
  }>;
  departmentEffects: CompanyDepartmentEffects;
  required: ExclusiveResearchMap;
}) {
  const departmentMultiplier = Math.max(1, Number(input.departmentEffects.blueprintSpeedMultiplier || 1));
  const contribution: ExclusiveResearchMap = {};

  for (const skill of EXCLUSIVE_RESEARCH_SKILLS) {
    const required = Math.max(0, Number(input.required[skill] ?? 0));
    if (required <= 0) continue;
    let totalGain = 0;
    for (const member of input.members) {
      const engineerMultiplier = member.advancedPersonalityId === "engineer" ? 1.12 : 1;
      const professionMultiplier =
        member.professionId === "backend" || member.professionId === "devops"
          ? 1.08
          : member.professionId === "qa"
          ? 1.06
          : member.professionId === "analyst"
          ? 1.05
          : 1;
      const baseSkill = Math.max(0, Number(member.skills[skill] ?? 0));
      const crossSkill =
        skill === "coding"
          ? Math.max(0, Number(member.skills.analytics ?? 0)) * 0.35
          : skill === "testing"
          ? Math.max(0, Number(member.skills.attention ?? 0)) * 0.45
          : skill === "analytics"
          ? Math.max(0, Number(member.skills.coding ?? 0)) * 0.25
          : skill === "design"
          ? Math.max(0, Number(member.skills.drawing ?? 0)) * 0.4
          : Math.max(0, Number(member.skills.testing ?? 0)) * 0.25;
      totalGain += (baseSkill * 3.4 + crossSkill) * engineerMultiplier * professionMultiplier;
    }
    contribution[skill] = Number((totalGain * departmentMultiplier).toFixed(2));
  }

  return contribution;
}
const marketListings: MarketListing[] = [];
const cityContracts = new Map<string, CityContract[]>();
const companyMiningByCompanyId = new Map<string, CompanyMiningState>();

const PASSIVE_INCOME = {
  tier1: { referrals: 1, percentage: 0.5, cap: 100 },
  tier2: { referrals: 5, percentage: 1.0, cap: 300 },
  tier3: { referrals: 10, percentage: 1.5, cap: 600 },
  tier4: { referrals: 25, percentage: 2.0, cap: 1000 },
  tier5: { referrals: 50, percentage: 3.0, cap: 2000 },
} as const;

const userReferralCodes = new Map<string, string>();
const referralCodeToUserId = new Map<string, string>();
const referredByUserId = new Map<string, string>();
const referralChildrenByUserId = new Map<string, Set<string>>();
const referralClaimHistory = new Map<string, Set<string>>();

const telegramIdToUserId = new Map<string, string>();
const userIdToTelegramId = new Map<string, string>();
const deviceRegistrationTimestamps = new Map<string, number[]>();
const ipRegistrationTimestamps = new Map<string, number[]>();

function serializeSafeUser(user: any) {
  const { password, tutorialState, ...safeUser } = user;
  const advancedPersonality = getAdvancedPersonalityId(user);
  const profession = getPlayerProfessionId(user);
  return {
    ...safeUser,
    advancedPersonality,
    advancedPersonalityUnlocked: false,
    needsAdvancedPersonalityChoice: false,
    profession,
    professionProfile: profession ? getProfessionById(profession) ?? null : null,
    professionUnlocked: Number(user.level || 0) >= PROFESSION_UNLOCK_LEVEL,
    needsProfessionChoice: canSelectProfession(user),
    ...buildPlayerRegistrationState(user),
  };
}

export function bindTelegramIdToUser(telegramId: string, userId: string) {
  const prevUserId = telegramIdToUserId.get(telegramId);
  if (prevUserId && prevUserId !== userId) {
    userIdToTelegramId.delete(prevUserId);
  }
  const prevTelegramId = userIdToTelegramId.get(userId);
  if (prevTelegramId && prevTelegramId !== telegramId) {
    telegramIdToUserId.delete(prevTelegramId);
  }
  telegramIdToUserId.set(telegramId, userId);
  userIdToTelegramId.set(userId, telegramId);
}

export function getUserIdByTelegramId(telegramId: string) {
  return telegramIdToUserId.get(telegramId);
}

export function getTelegramIdByUserId(userId: string) {
  return userIdToTelegramId.get(userId);
}

export function unbindTelegramByUserId(userId: string) {
  const telegramId = userIdToTelegramId.get(userId);
  if (telegramId) {
    telegramIdToUserId.delete(telegramId);
  }
  userIdToTelegramId.delete(userId);
}

export function unbindTelegramByTelegramId(telegramId: string) {
  const userId = telegramIdToUserId.get(telegramId);
  telegramIdToUserId.delete(telegramId);
  if (userId) {
    userIdToTelegramId.delete(userId);
  }
}

function resolveAdminPassword(req: any) {
  return String(
    req.headers["x-admin-password"]
    ?? req.body?.adminPassword
    ?? req.query?.adminPassword
    ?? "",
  ).trim();
}

function assertAdminRequest(req: any, res: any) {
  const expected = getAdminPassword();
  if (!expected) {
    warnIfAdminPasswordMissing();
    res.status(503).json({ error: "Admin access disabled" });
    return false;
  }
  const provided = resolveAdminPassword(req);
  if (!provided || provided !== expected) {
    res.status(403).json({ error: "Admin access denied" });
    return false;
  }
  return true;
}

function getUtcDayStamp(nowMs: number = Date.now()) {
  const date = new Date(nowMs);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function applyExperienceGainForLevel(user: any, xpGain: number) {
  let level = Number(user.level || 1);
  let experience = Number(user.experience || 0) + Math.max(0, Math.floor(xpGain));
  while (experience >= 100) {
    level += 1;
    experience -= 100;
  }
  return { level, experience };
}

async function getEffectiveCompanyDepartmentEffects(company: any) {
  const staffing = await getCompanyStaffingSnapshot(String(company.id));
  const economy = reconcileCompanyEconomy({
    ...(company as CompanyEconomyLike),
    employeeCount: staffing.members.length,
  });
  return {
    staffing,
    economy,
    effects: getDepartmentEffects(economy.departments, staffing),
  };
}

function normalizeExclusiveName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
}

function getExclusiveCatalog(companyId: string) {
  return exclusiveCatalogByCompanyId.get(companyId) ?? [];
}

function setExclusiveCatalog(companyId: string, items: ExclusiveBlueprintDefinition[]) {
  exclusiveCatalogByCompanyId.set(companyId, items);
}

function getExclusiveProject(companyId: string) {
  return exclusiveProjectByCompanyId.get(companyId) ?? null;
}

async function buildExclusiveSeedPartsFromInventory(userId: string, partRefs: string[]) {
  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) throw new Error("Игрок не найден");
  const game = snapshot.game as any;
  const inventory = Array.isArray(game.inventory) ? [...game.inventory] : [];
  const seedParts: ExclusiveSeedPart[] = [];

  for (const partRef of partRefs) {
    const index = inventory.findIndex((item: any) => item.type === "part" && String(item.id) === partRef);
    if (index < 0) {
      throw new Error(`Деталь ${partRef} не найдена в инвентаре CEO`);
    }
    const item = inventory[index];
    seedParts.push({
      id: String(item.id),
      rarity: String(item.rarity || "Common") as any,
      type: String(ALL_PARTS[String(item.id)]?.type || item.type) as any,
      name: String(item.name || ALL_PARTS[String(item.id)]?.name || item.id),
    });
    const qty = Math.max(1, Number(item.quantity || 1));
    if (qty <= 1) inventory.splice(index, 1);
    else inventory[index] = { ...item, quantity: qty - 1 };
  }

  applyGameStatePatch(userId, { inventory });
  return { seedParts, snapshot };
}

function getExclusiveSkillRewardSkill(professionId?: string | null) {
  if (professionId === "designer") return "design";
  if (professionId === "qa") return "testing";
  if (professionId === "analyst") return "analytics";
  if (professionId === "devops") return "attention";
  return "coding";
}

function readDuelSkills(snapshot: Awaited<ReturnType<typeof getUserWithGameState>>) {
  const skills = (snapshot?.game as any)?.skills ?? {};
  const analytics = Math.max(0, Number(skills.analytics || 0));
  const design = Math.max(0, Number(skills.design || 0));
  const drawing = Math.max(0, Number(skills.drawing || 0));
  const coding = Math.max(0, Number(skills.coding || 0));
  const modeling = Math.max(0, Number(skills.modeling || 0));
  const testing = Math.max(0, Number(skills.testing || 0));
  const attention = Math.max(0, Number(skills.attention || 0));
  return { analytics, design, drawing, coding, modeling, testing, attention };
}

async function applyDuelResultToPlayers(result: PvpDuelResult | null) {
  if (!result) return;
  const a = await storage.getUser(result.playerAUserId);
  const b = await storage.getUser(result.playerBUserId);
  if (!a || !b) return;

  const isWinnerA = result.winnerUserId === a.id;
  const isWinnerB = result.winnerUserId === b.id;
  const isDraw = result.winnerUserId === null;
  const xpA = isDraw ? Number(result.drawXp || result.loserXp || 0) : isWinnerA ? result.winnerXp : result.loserXp;
  const xpB = isDraw ? Number(result.drawXp || result.loserXp || 0) : isWinnerB ? result.winnerXp : result.loserXp;
  const repA = isDraw ? 0 : isWinnerA ? result.winnerReputation : 0;
  const repB = isDraw ? 0 : isWinnerB ? result.winnerReputation : 0;

  const stamp = getUtcDayStamp(result.createdAtMs);
  const aDailyMatches = a.pvpDailyStamp === stamp ? Number(a.pvpDailyMatches || 0) + 1 : 1;
  const bDailyMatches = b.pvpDailyStamp === stamp ? Number(b.pvpDailyMatches || 0) + 1 : 1;

  const aLevelState = applyExperienceGainForLevel(a, xpA);
  const bLevelState = applyExperienceGainForLevel(b, xpB);
  const snapshotA = await getUserWithGameState(a.id);
  const snapshotB = await getUserWithGameState(b.id);
  const energyCostA = Math.max(0, Number(result.energyCostA || 0));
  const energyCostB = Math.max(0, Number(result.energyCostB || 0));
  if (snapshotA) {
    applyGameStatePatch(a.id, {
      workTime: Math.max(0, Number((Number(snapshotA.game.workTime || 0) - energyCostA).toFixed(4))),
    });
  }
  if (snapshotB) {
    applyGameStatePatch(b.id, {
      workTime: Math.max(0, Number((Number(snapshotB.game.workTime || 0) - energyCostB).toFixed(4))),
    });
  }

  await storage.updateUser(a.id, {
    level: aLevelState.level,
    experience: aLevelState.experience,
    reputation: Number(a.reputation || 0) + repA,
    pvpRating: Math.max(0, Number(result.playerARatingAfter || 0)),
    pvpMatches: Number(a.pvpMatches || 0) + 1,
    pvpWins: Number(a.pvpWins || 0) + (isWinnerA ? 1 : 0),
    pvpLosses: Number(a.pvpLosses || 0) + (isDraw ? 0 : isWinnerA ? 0 : 1),
    pvpDailyStamp: stamp,
    pvpDailyMatches: aDailyMatches,
    lastActiveAt: Math.floor(Date.now() / 1000),
  });

  await storage.updateUser(b.id, {
    level: bLevelState.level,
    experience: bLevelState.experience,
    reputation: Number(b.reputation || 0) + repB,
    pvpRating: Math.max(0, Number(result.playerBRatingAfter || 0)),
    pvpMatches: Number(b.pvpMatches || 0) + 1,
    pvpWins: Number(b.pvpWins || 0) + (isWinnerB ? 1 : 0),
    pvpLosses: Number(b.pvpLosses || 0) + (isDraw ? 0 : isWinnerB ? 0 : 1),
    pvpDailyStamp: stamp,
    pvpDailyMatches: bDailyMatches,
    lastActiveAt: Math.floor(Date.now() / 1000),
  });

  await storage.createPvpDuelLog({
    id: result.id,
    playerAId: result.playerAUserId,
    playerAName: result.playerAName,
    playerARatingBefore: result.playerARatingBefore,
    playerARatingAfter: result.playerARatingAfter,
    playerBId: result.playerBUserId,
    playerBName: result.playerBName,
    playerBRatingBefore: result.playerBRatingBefore,
    playerBRatingAfter: result.playerBRatingAfter,
    winnerUserId: result.winnerUserId,
    rounds: result.rounds,
    createdAt: Math.floor(result.createdAtMs / 1000),
  });
}

async function flushCompletedPvpDuels() {
  const completed = settleCompletedPvpDuels();
  for (const result of completed) {
    await applyDuelResultToPlayers(result);
  }
  return completed;
}


type TelegramAuthUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

function parseTelegramInitData(initDataRaw: string) {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) return null;

  const items: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    items.push(`${key}=${value}`);
  });
  items.sort();

  return {
    hash,
    dataCheckString: items.join("\n"),
    authDate: Number(params.get("auth_date") ?? 0),
    startParam: params.get("start_param") ?? undefined,
    userRaw: params.get("user") ?? undefined,
  };
}

function verifyTelegramInitData(initDataRaw: string, botToken: string) {
  const parsed = parseTelegramInitData(initDataRaw);
  if (!parsed) return { ok: false as const, reason: "hash_missing" };

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(parsed.dataCheckString).digest("hex");

  const expected = Buffer.from(expectedHash, "utf8");
  const actual = Buffer.from(parsed.hash, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false as const, reason: "hash_mismatch" };
  }

  const maxAgeSeconds = 24 * 60 * 60;
  if (!parsed.authDate || Math.floor(Date.now() / 1000) - parsed.authDate > maxAgeSeconds) {
    return { ok: false as const, reason: "auth_expired" };
  }

  return { ok: true as const, parsed };
}

function buildTelegramUsernameCandidates(user: TelegramAuthUser) {
  const candidates: string[] = [];

  if (user.username && user.username.trim().length > 0) {
    const normalized = user.username.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    if (normalized) candidates.push(`tg_${normalized}`.slice(0, 30));
  }

  candidates.push(`tg_${user.id}`);
  return Array.from(new Set(candidates));
}

async function resolveUserByTelegramId(telegramId: string) {
  const mappedUserId = getUserIdByTelegramId(telegramId);
  if (mappedUserId) {
    const mappedUser = await storage.getUser(mappedUserId);
    if (mappedUser) return mappedUser;
  }

  const usernameCandidates = buildTelegramUsernameCandidates({ id: Number(telegramId) });
  for (const candidate of usernameCandidates) {
    const existing = await storage.getUserByUsername(candidate);
    if (existing) {
      bindTelegramIdToUser(telegramId, existing.id);
      return existing;
    }
  }

  return null;
}

async function generateUniqueUsername(base: string) {
  const normalized = base.slice(0, 28);
  if (!(await storage.usernameExists(normalized))) return normalized;

  for (let i = 0; i < 10; i++) {
    const candidate = `${normalized.slice(0, 24)}_${randomBytes(2).toString("hex")}`;
    if (!(await storage.usernameExists(candidate))) return candidate;
  }

  return `${normalized.slice(0, 20)}_${Date.now().toString(36)}`;
}

function cleanupOldTimestamps(items: number[], now = Date.now()) {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  return items.filter((ts) => ts >= dayAgo);
}

function resolvePassiveTier(referralsCount: number) {
  if (referralsCount >= PASSIVE_INCOME.tier5.referrals) return PASSIVE_INCOME.tier5;
  if (referralsCount >= PASSIVE_INCOME.tier4.referrals) return PASSIVE_INCOME.tier4;
  if (referralsCount >= PASSIVE_INCOME.tier3.referrals) return PASSIVE_INCOME.tier3;
  if (referralsCount >= PASSIVE_INCOME.tier2.referrals) return PASSIVE_INCOME.tier2;
  return PASSIVE_INCOME.tier1;
}

function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const sum = entries.reduce((acc, [, value]) => acc + Math.max(0, value), 0);
  if (sum <= 0) return entries[0][0];
  let roll = Math.random() * sum;
  for (const [key, value] of entries) {
    roll -= Math.max(0, value);
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function getMiningRarityWeights(companyLevel: number) {
  const level = Math.max(1, Math.floor(Number(companyLevel) || 1));
  const bonusTier = Math.floor((level - 1) / 2);
  const common = Math.max(40, 70 - bonusTier * 2);
  const rare = 22 + bonusTier * 1.4;
  const epic = 7 + bonusTier * 0.5;
  const legendary = 1 + bonusTier * 0.1;
  return { Common: common, Rare: rare, Epic: epic, Legendary: legendary };
}

function rollCompanyMiningReward(companyLevel: number, planId: CompanyMiningPlanId): CompanyMiningRewardView {
  const plan = getCompanyMiningPlan(planId);
  const rarity = pickWeighted(getMiningRarityWeights(companyLevel));
  const pool = Object.values(ALL_PARTS).filter((part) => part.rarity === rarity);
  const selected = pool.length
    ? pool[Math.floor(Math.random() * pool.length)]
    : Object.values(ALL_PARTS)[0];
  const dynamicRange = Math.max(0, plan.maxRewardQty - plan.minRewardQty);
  const qtyChance = Math.min(0.65, 0.2 + Math.max(0, companyLevel - 1) * 0.05);
  const bonusSteps = Array.from({ length: dynamicRange }).reduce<number>((sum, _, index) => {
    const threshold = Math.max(0.12, qtyChance - index * 0.12);
    return sum + (Math.random() < threshold ? 1 : 0);
  }, 0);
  const quantity = Math.min(plan.maxRewardQty, Math.max(plan.minRewardQty, plan.minRewardQty + bonusSteps));
  return {
    partId: selected.id,
    partName: selected.name,
    partType: selected.type,
    rarity: selected.rarity,
    quantity,
  };
}

function buildMiningStatusView(state: CompanyMiningState | undefined): {
  status: CompanyMiningStatus;
  startedAt: number | null;
  endsAt: number | null;
  remainingSeconds: number;
  planId: CompanyMiningPlanId | null;
  planLabel: string | null;
  minRewardQty: number | null;
  maxRewardQty: number | null;
  rewardPreview: CompanyMiningRewardView | null;
} {
  if (!state) {
    return {
      status: "idle",
      startedAt: null,
      endsAt: null,
      remainingSeconds: 0,
      planId: null,
      planLabel: null,
      minRewardQty: null,
      maxRewardQty: null,
      rewardPreview: null,
    };
  }
  if (state.claimedAt) {
    return {
      status: "idle",
      startedAt: null,
      endsAt: null,
      remainingSeconds: 0,
      planId: null,
      planLabel: null,
      minRewardQty: null,
      maxRewardQty: null,
      rewardPreview: null,
    };
  }
  const plan = getCompanyMiningPlan(state.planId);
  const remainingSeconds = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
  if (remainingSeconds > 0) {
    return {
      status: "in_progress",
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      remainingSeconds,
      planId: state.planId,
      planLabel: plan.label,
      minRewardQty: plan.minRewardQty,
      maxRewardQty: plan.maxRewardQty,
      rewardPreview: null,
    };
  }
  return {
    status: "ready_to_claim",
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    remainingSeconds: 0,
    planId: state.planId,
    planLabel: plan.label,
    minRewardQty: plan.minRewardQty,
    maxRewardQty: plan.maxRewardQty,
    rewardPreview: state.reward,
  };
}

function generateReferralCode(username: string) {
  const normalized = username.replace(/\s+/g, "").toUpperCase().slice(0, 6) || "PLAYER";
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${normalized}-${random}`;
}

const GADGET_CONTRACT_TEMPLATES = [
  { title: "Городская цифровизация", customer: "Мэрия", category: "tablets", qty: 2, quality: 1.2, reward: 2200, ork: 1, ttlHours: 48 },
  { title: "Оснащение колл-центра", customer: "Телеком Корп", category: "smartphones", qty: 3, quality: 1.1, reward: 2600, ork: 1, ttlHours: 48 },
  { title: "Поставка для аналитиков", customer: "Data Group", category: "laptops", qty: 2, quality: 1.4, reward: 3600, ork: 2, ttlHours: 72 },
  { title: "Носимые устройства для фитнеса", customer: "HealthLab", category: "smartwatches", qty: 3, quality: 1.25, reward: 2400, ork: 1, ttlHours: 48 },
  { title: "Майнинговый пилот", customer: "EnergyTech", category: "asic_miners", qty: 1, quality: 1.6, reward: 4200, ork: 2, ttlHours: 72 },
] as const;

const PARTS_CONTRACT_TEMPLATES = [
  { title: "Поставка комплектующих", customer: "Assembly Hub", partType: "processor", qty: 4, reward: 1700, ork: 1, ttlHours: 48 },
  { title: "Сервисный запас", customer: "Repair Center", partType: "battery", qty: 5, reward: 1500, ork: 1, ttlHours: 48 },
  { title: "Склад дисплеев", customer: "Retail Partner", partType: "display", qty: 3, reward: 1600, ork: 1, ttlHours: 48 },
  { title: "Корпуса для сборки", customer: "Factory Line", partType: "case", qty: 6, reward: 1400, ork: 1, ttlHours: 48 },
] as const;

const SKILL_CONTRACT_TEMPLATES = [
  { title: "Аудит UX-концепции", customer: "Design Board", skill: "design" as const, points: 40, reward: 1800, ork: 1, ttlHours: 48 },
  { title: "Техревью архитектуры", customer: "Tech Council", skill: "coding" as const, points: 45, reward: 1900, ork: 1, ttlHours: 48 },
  { title: "Проверка качества", customer: "QA Bureau", skill: "testing" as const, points: 35, reward: 1700, ork: 1, ttlHours: 48 },
  { title: "Аналитический отчёт", customer: "BI Office", skill: "analytics" as const, points: 35, reward: 1750, ork: 1, ttlHours: 48 },
] as const;

function pickRandomDistinct<T>(items: readonly T[], count: number) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)));
}

function buildContractsForCity(city: string): CityContract[] {
  const now = Date.now();
  const cityId = resolveCityId(city);
  const rewardMultiplier = BALANCE_CONFIG.cityContracts.rewardMultiplierByCityId[cityId] ?? 1;
  const rewardByCity = (value: number) => Math.max(1, Math.round(value * rewardMultiplier));
  const gadgetContracts: CityContract[] = pickRandomDistinct(GADGET_CONTRACT_TEMPLATES, 2).map((template) => ({
    id: randomUUID(),
    city,
    title: template.title,
    customer: template.customer,
    kind: "gadget_delivery",
    category: template.category,
    requiredQuantity: template.qty,
    minQuality: template.quality,
    rewardMoney: rewardByCity(template.reward),
    rewardOrk: template.ork,
    expiresAt: now + template.ttlHours * 60 * 60 * 1000,
    status: "open",
  }));
  const partContracts: CityContract[] = pickRandomDistinct(PARTS_CONTRACT_TEMPLATES, 2).map((template) => ({
    id: randomUUID(),
    city,
    title: template.title,
    customer: template.customer,
    kind: "parts_supply",
    category: "parts",
    requiredQuantity: template.qty,
    minQuality: 1,
    requiredPartType: template.partType,
    rewardMoney: rewardByCity(template.reward),
    rewardOrk: template.ork,
    expiresAt: now + template.ttlHours * 60 * 60 * 1000,
    status: "open",
  }));
  const skillContracts: CityContract[] = pickRandomDistinct(SKILL_CONTRACT_TEMPLATES, 2).map((template) => ({
    id: randomUUID(),
    city,
    title: template.title,
    customer: template.customer,
    kind: "skill_research",
    category: "skills",
    requiredQuantity: 1,
    minQuality: 1,
    requiredSkill: template.skill,
    requiredSkillPoints: template.points,
    rewardMoney: rewardByCity(template.reward),
    rewardOrk: template.ork,
    expiresAt: now + template.ttlHours * 60 * 60 * 1000,
    status: "open",
  }));
  return [...gadgetContracts, ...partContracts, ...skillContracts];
}
function getContractsByCity(city: string): CityContract[] {
  const existing = cityContracts.get(city) ?? [];
  const now = Date.now();

  const active = existing.filter((contract) => contract.status === "completed" || contract.expiresAt > now);
  const hasOpenContracts = active.some((contract) => contract.status !== "completed");
  if (!hasOpenContracts) {
    const replenished = buildContractsForCity(city);
    cityContracts.set(city, replenished);
    return replenished;
  }

  cityContracts.set(city, active);
  return active;
}

function removeProducedGadget(companyId: string, gadgetId: string): ProducedGadget | null {
  const produced = companyGadgets.get(companyId) ?? [];
  const index = produced.findIndex((gadget) => gadget.id === gadgetId);
  if (index < 0) return null;
  const [removed] = produced.splice(index, 1);
  companyGadgets.set(companyId, produced);
  return removed;
}

function buildPlayerInventoryGadgetFromProduced(gadget: ProducedGadget) {
  return {
    id: gadget.id,
    name: gadget.name,
    stats: { ...(gadget.stats || {}) },
    rarity: gadget.isExclusive ? "Exclusive" : "Rare",
    quantity: 1,
    type: "gadget" as const,
    durability: gadget.durability,
    maxDurability: gadget.maxDurability,
    condition: gadget.condition,
    maxCondition: gadget.maxCondition,
    isBroken: Boolean(gadget.isBroken),
    reliability: Number(gadget.reliability ?? 1),
    isExclusive: Boolean(gadget.isExclusive),
    exclusiveBonusType: gadget.exclusiveBonusType,
    exclusiveBonusValue: gadget.exclusiveBonusValue,
    exclusiveBonusLabel: gadget.exclusiveBonusLabel,
  };
}

async function transferProducedGadgetToPlayerInventory(userId: string, gadget: ProducedGadget | null) {
  if (!gadget) return null;
  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) return null;
  const inventory = Array.isArray((snapshot.game as any)?.inventory) ? [...((snapshot.game as any).inventory)] : [];
  inventory.unshift(buildPlayerInventoryGadgetFromProduced(gadget));
  applyGameStatePatch(userId, { inventory });
  return gadget;
}

function isLeadershipRole(role: string | null | undefined) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "owner" || normalized === "manager" || normalized === "cto";
}

function isTutorialCompany(company: any) {
  return Boolean(company?.isTutorial);
}

async function getRegistrationFlowState(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;
  return {
    user,
    meta: getRegistrationMeta(user),
    registration: buildPlayerRegistrationState(user),
  };
}

async function ensureRegistrationTutorialCompany(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");

  let company = await storage.getTutorialCompanyByOwner(user.id);
  if (!company) {
    company = await storage.createCompany(
      {
        name: TUTORIAL_DEMO_COMPANY_NAME,
        city: user.city,
        isTutorial: true,
        tutorialOwnerId: user.id,
      },
      user.id,
      user.username,
    );
  }

  if (company.city !== user.city) {
    company = await storage.updateCompany(company.id, { city: user.city });
  }

  await ensureFirstCraftRegistrationAssets(user.id, { tutorialCompanyId: company.id });
  return company;
}

async function isTutorialProductionUnlocked(userId: string) {
  const legacyTutorial = await getTutorialState(userId);
  if (legacyTutorial && legacyTutorial.isActive && !legacyTutorial.isCompleted && legacyTutorial.currentStep >= 4) {
    return { mode: "legacy_tutorial" as const, allowed: true };
  }

  const registration = await getRegistrationFlowState(userId);
  if (registration?.registration.registrationFlow.currentStep === "first_craft") {
    return { mode: "registration" as const, allowed: true };
  }

  if (registration?.registration.registrationFlow.currentStep === "completed") {
    return { mode: "registration_completed" as const, allowed: true };
  }

  return { mode: null, allowed: false };
}

async function resolvePlayerCompanyMembership(userId: string) {
  const companies = await storage.getAllCompanies();
  for (const company of companies) {
    if (isTutorialCompany(company)) continue;
    const member = await storage.getMemberByUserId(company.id, userId);
    if (!member) continue;
    return {
      company,
      role: member.role,
    };
  }
  return null;
}

function canLaunchHackathonSabotageByRole(role: string) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "owner" || normalized === "cto" || normalized === "security_lead";
}

function buildTutorialBlueprintView() {
  return {
    id: TUTORIAL_DEMO_BLUEPRINT.id,
    name: TUTORIAL_DEMO_BLUEPRINT.name,
    category: TUTORIAL_DEMO_BLUEPRINT.category,
    requirements: { coding: 0, design: 0, analytics: 0 },
    time: TUTORIAL_DEMO_BLUEPRINT.timeSeconds / 3600,
    description: "Tutorial blueprint",
    baseStats: { ...TUTORIAL_DEMO_BLUEPRINT.baseStats },
    production: {
      costGram: TUTORIAL_DEMO_BLUEPRINT.costGram,
      parts: {},
    },
    tutorialTimeSeconds: TUTORIAL_DEMO_BLUEPRINT.timeSeconds,
  };
}

function buildTutorialInventoryGadget(producedAt: number, isExclusive: boolean) {
  const condition = createGadgetConditionProfile({
    rarity: isExclusive ? "Rare" : "Common",
    quality: isExclusive ? 1.22 : 1,
    testing: isExclusive ? 3 : 1,
    attention: isExclusive ? 2 : 1,
  });
  return {
    id: `tutorial-starter-phone-${producedAt}`,
    name: isExclusive ? "Starter Phone: Лучший стажер" : "Starter Phone",
    stats: isExclusive
      ? { coding: 2, analytics: 1, attention: 1 }
      : { coding: 1, analytics: 1 },
    rarity: isExclusive ? "Rare" : "Common",
    quantity: 1,
    type: "gadget" as const,
    isEquipped: false,
    ...condition,
  };
}

async function syncTutorialBlueprintState(company: any, state: CompanyBlueprintState | undefined) {
  if (!state || !isTutorialCompany(company) || state.status !== "in_progress") return state;
  const startedAt = Number(state.startedAt || Date.now());
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const elapsedSeconds = Math.min(TUTORIAL_DEMO_BLUEPRINT.timeSeconds, Math.floor(elapsedMs / 1000));
  state.progressHours = elapsedSeconds;

  if (elapsedMs < TUTORIAL_DEMO_BLUEPRINT.timeSeconds * 1000) {
    return state;
  }

  state.status = "production_ready";
  state.completedAt = Date.now();
  const tutorialOwnerId = String(company.tutorialOwnerId || company.ownerId);
  await applyTutorialEvent(tutorialOwnerId, "demo_blueprint_done");

  return state;
}

async function settleExpiredAuctions() {
  const now = Date.now();
  const settings = await getGameSettings();
  for (const listing of marketListings) {
    if (listing.saleType !== "auction" || listing.status !== "active" || !listing.auctionEndsAt) continue;
    if (listing.auctionEndsAt > now) continue;

    if (!listing.currentBid || !listing.currentBidderId) {
      listing.status = "expired";
      continue;
    }

    const buyer = await storage.getUser(listing.currentBidderId);
    const company = await storage.getCompany(listing.companyId);
    if (!buyer || !company || buyer.balance < listing.currentBid) {
      listing.status = "expired";
      continue;
    }

    const sellerCeo = await storage.getUser(company.ownerId);
    const sellerAdvanced = sellerCeo ? getAdvancedPersonalityId(sellerCeo) : null;
    const feeRate = getMarketFeeRate(
      company.city,
      settings.economy.commissionsEnabled && settings.economy.taxesEnabled,
    );
    let netIncome = Math.floor(listing.currentBid * (1 - feeRate));
    if (sellerAdvanced === "strategist") {
      netIncome = Math.max(1, Math.floor(netIncome * 1.08));
    }
    await storage.updateUser(buyer.id, { balance: buyer.balance - listing.currentBid });
    await storage.updateCompany(company.id, { balance: company.balance + netIncome });
    await transferProducedGadgetToPlayerInventory(
      buyer.id,
      removeProducedGadget(listing.companyId, listing.gadgetId),
    );

    listing.status = "sold";
    listing.sold = true;
    listing.salePrice = listing.currentBid;
  }
}

const LEVEL_REQUIREMENTS = BALANCE_CONFIG.company.levelRequirements;

async function applyHackathonRewards() {
  await applyWinnerRewardsToCompanies(async (companyId, addGrm) => {
    const company = await storage.getCompany(companyId);
    if (!company) return;
    await storage.updateCompany(company.id, {
      balance: Number(company.balance || 0) + Math.max(0, Math.floor(addGrm || 0)),
    });
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await refreshGlobalEventsCache(true);
  startGlobalEventScheduler();
  startPvpTestBotLoop();
  startWeeklyHackathonScheduler({
    onAutoEnd: async () => {
      await applyHackathonRewards();
    },
  });

  // вњ… Р Р•Р“РРЎРўР РђР¦РРЇ РџРћР›Р¬Р—РћР’РђРўР•Р›РЇ
  app.post("/api/register", async (req, res) => {
    try {
      const { referralCode, deviceFingerprint, telegramId } = req.body ?? {};
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();

      if (typeof telegramId === "string" && telegramId.trim().length > 0) {
        if (telegramIdToUserId.has(telegramId)) {
          return res.status(409).json({ error: "Этот Telegram аккаунт уже зарегистрирован" });
        }
      }

      if (typeof deviceFingerprint === "string" && deviceFingerprint.trim().length > 0) {
        const existing = cleanupOldTimestamps(deviceRegistrationTimestamps.get(deviceFingerprint) ?? [], now);
        if (existing.length >= 1) {
          return res.status(429).json({ error: "С этого устройства уже создан аккаунт за последние 24 часа" });
        }
        if ((deviceRegistrationTimestamps.get(deviceFingerprint) ?? []).length >= 2) {
          return res.status(429).json({ error: "Превышен лимит аккаунтов для устройства" });
        }
      }

      const ipHistory = cleanupOldTimestamps(ipRegistrationTimestamps.get(ip) ?? [], now);
      if (ipHistory.length >= 3) {
        return res.status(429).json({ error: "Слишком много регистраций с этого IP за сутки" });
      }

      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data" });
      }
      const registrationSkills = normalizeRegistrationSkillsAllocation(req.body?.skills);
      if (!isValidRegistrationSkillsAllocation(registrationSkills)) {
        return res.status(400).json({
          error: `Распредели все ${REGISTRATION_INITIAL_SKILL_POINTS} очков навыков`,
          details: { total: countRegistrationSkillPoints(registrationSkills) },
        });
      }

      const resolvedCity = resolveRegistrationCityName(parsed.data.city);
      const resolvedPersonality = resolveRegistrationPersonalityId(parsed.data.personality);
      if (!resolvedCity || !resolvedPersonality) {
        return res.status(400).json({ error: "Invalid registration data" });
      }

      const exists = await storage.usernameExists(parsed.data.username);
      if (exists) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const user = await storage.createUser({
        ...parsed.data,
        city: resolvedCity,
        personality: resolvedPersonality,
      });
      applyGameStatePatch(user.id, { skills: registrationSkills });

      const code = generateReferralCode(user.username);
      userReferralCodes.set(user.id, code);
      referralCodeToUserId.set(code, user.id);

      if (typeof referralCode === "string" && referralCode.trim().length > 0) {
        const referrerId = referralCodeToUserId.get(referralCode.trim());
        if (referrerId && referrerId !== user.id) {
          referredByUserId.set(user.id, referrerId);
          const children = referralChildrenByUserId.get(referrerId) ?? new Set<string>();
          children.add(user.id);
          referralChildrenByUserId.set(referrerId, children);

          const referrer = await storage.getUser(referrerId);
          if (referrer) {
            await storage.updateUser(referrer.id, { balance: referrer.balance + 200 });
          }
          await storage.updateUser(user.id, { balance: user.balance + 100 });
          user.balance += 100;
        }
      }

      if (typeof telegramId === "string" && telegramId.trim().length > 0) {
        bindTelegramIdToUser(telegramId, user.id);
      }
      if (typeof deviceFingerprint === "string" && deviceFingerprint.trim().length > 0) {
        const history = deviceRegistrationTimestamps.get(deviceFingerprint) ?? [];
        history.push(now);
        deviceRegistrationTimestamps.set(deviceFingerprint, history);
      }
      ipHistory.push(now);
      ipRegistrationTimestamps.set(ip, ipHistory);

      res.status(201).json({ ...serializeSafeUser(user), referralCode: code });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // вњ… РџР РћР’Р•Р РљРђ РќРРљРђ
  app.get("/api/check-username/:username", async (req, res) => {
    const exists = await storage.usernameExists(req.params.username);
    res.json({ exists, available: !exists });
  });

  app.get("/api/registration/options", async (_req, res) => {
    try {
      res.json(await buildRegistrationOptions());
    } catch (error) {
      console.error("Failed to load registration options:", error);
      res.status(500).json({ error: "Failed to load registration options" });
    }
  });

  app.post("/api/registration/submit-answer", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      const questionId = String(req.body?.questionId || "").trim();
      const answerId = String(req.body?.answerId || "").trim();
      if (!userId || !questionId || !answerId) {
        return res.status(400).json({ error: "userId, questionId and answerId are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const updated = await submitRegistrationAnswer(user.id, { questionId: questionId as any, answerId });
      const registrationState = buildPlayerRegistrationState(updated);
      let tutorialCompany = null as Awaited<ReturnType<typeof storage.getCompany>> | null;

      if (registrationState.registrationStep === "first_craft") {
        tutorialCompany = await ensureRegistrationTutorialCompany(updated.id);
      }

      const snapshot = await getUserWithGameState(updated.id);
      if (!snapshot) return res.status(404).json({ error: "User not found" });

      const { user: refreshedUser, game, notices } = snapshot;
      const refreshedRegistration = buildPlayerRegistrationState(refreshedUser);
      res.json({
        ...serializeSafeUser(refreshedUser),
        registration: refreshedRegistration,
        skills: game.skills,
        inventory: game.inventory,
        workTime: Math.round(game.workTime * 100),
        studyTime: Math.round(game.studyTime * 100),
        gramBalance: game.gramBalance,
        activeBankProduct: game.activeBankProduct,
        jobDropPity: game.jobDropPity,
        tutorial: await getTutorialState(refreshedUser.id),
        notices,
        currentInterviewQuestion: getCurrentInterviewQuestion(refreshedUser),
        tutorialCompany,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to submit registration answer" });
    }
  });

  app.get("/api/game-settings", async (_req, res) => {
    try {
      res.json(await getGameSettings());
    } catch (error) {
      console.error("Failed to load game settings:", error);
      res.status(500).json({ error: "Failed to load game settings" });
    }
  });

  app.get("/api/admin/game-settings", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      res.json(await getGameSettings());
    } catch (error) {
      console.error("Failed to load admin game settings:", error);
      res.status(500).json({ error: "Failed to load admin game settings" });
    }
  });

  app.patch("/api/admin/game-settings", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      const patch = (req.body ?? {}) as GameSettingsPatch;
      res.json(await updateGameSettings(patch));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to update game settings" });
    }
  });

  app.post("/api/telegram/auth", async (req, res) => {
    try {
      const initData = typeof req.body?.initData === "string" ? req.body.initData : "";
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      let telegramUser: TelegramAuthUser | null = null;
      let startParam: string | undefined;

      if (initData && botToken) {
        const verified = verifyTelegramInitData(initData, botToken);
        if (!verified.ok) {
          return res.status(401).json({ error: "Invalid Telegram initData", code: verified.reason });
        }

        startParam = verified.parsed.startParam;
        if (verified.parsed.userRaw) {
          telegramUser = JSON.parse(verified.parsed.userRaw) as TelegramAuthUser;
        }
      } else if (req.body?.user && typeof req.body.user.id === "number") {
        telegramUser = req.body.user as TelegramAuthUser;
        startParam = typeof req.body?.startParam === "string" ? req.body.startParam : undefined;
      }

      if (!telegramUser || typeof telegramUser.id !== "number") {
        return res.status(400).json({ error: "Telegram user is required" });
      }

      const telegramId = String(telegramUser.id);
      const existingUser = await resolveUserByTelegramId(telegramId);
      if (existingUser) {
        return res.json({ ...serializeSafeUser(existingUser), isNewUser: false, telegramId });
      }

      const usernameCandidates = buildTelegramUsernameCandidates(telegramUser);

      const stableUsername = usernameCandidates[usernameCandidates.length - 1] ?? `tg_${telegramId}`;
      const username = await generateUniqueUsername(stableUsername);
      const created = await storage.createUser({
        username,
        password: `${TELEGRAM_PENDING_PASSWORD_PREFIX}${randomUUID()}`,
        city: "РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі",
        personality: "",
        gender: "",
      });

      const code = generateReferralCode(created.username);
      userReferralCodes.set(created.id, code);
      referralCodeToUserId.set(code, created.id);
      bindTelegramIdToUser(telegramId, created.id);

      const referralCode = startParam?.startsWith("ref_") ? startParam.slice(4) : undefined;
      if (referralCode) {
        const referrerId = referralCodeToUserId.get(referralCode.trim());
        if (referrerId && referrerId !== created.id) {
          referredByUserId.set(created.id, referrerId);
          const children = referralChildrenByUserId.get(referrerId) ?? new Set<string>();
          children.add(created.id);
          referralChildrenByUserId.set(referrerId, children);

          const referrer = await storage.getUser(referrerId);
          if (referrer) {
            await storage.updateUser(referrer.id, { balance: referrer.balance + 200 });
          }
          await storage.updateUser(created.id, { balance: created.balance + 100 });
          created.balance += 100;
        }
      }

      res.status(201).json({ ...serializeSafeUser(created), isNewUser: true, referralCode: code, telegramId });
    } catch (error) {
      console.error("Telegram auth failed:", error);
      res.status(500).json({ error: "Telegram auth failed" });
    }
  });

  app.get("/api/admin/events/hackathon", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    res.json(getWeeklyHackathonState());
  });

  app.post("/api/admin/events/hackathon/start", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      const snapshot = startWeeklyHackathon(Date.now(), "manual");
      res.json(snapshot);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to start hackathon" });
    }
  });

  app.post("/api/admin/events/hackathon/end", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      const snapshot = endWeeklyHackathon(Date.now());
      await applyHackathonRewards();
      res.json(snapshot);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to end hackathon" });
    }
  });

  app.post("/api/admin/events/hackathon/reset", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      res.json(resetWeeklyHackathon(Date.now()));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to reset hackathon" });
    }
  });

  app.get("/api/events/current", async (_req, res) => {
    try {
      const events = await getCurrentGlobalEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load current global events" });
    }
  });

  app.get("/api/events/history", async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
      const events = await getGlobalEventsHistory(limit);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load global events history" });
    }
  });

  app.post("/api/admin/events/global/start", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      const event = await generateEvent(Date.now());
      if (!event) return res.status(400).json({ error: "No available template due to cooldowns" });
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to generate global event" });
    }
  });

  app.post("/api/telegram/id-auth", async (req, res) => {
    try {
      const rawTelegramId = String(req.body?.telegramId ?? "").trim();
      const telegramId = rawTelegramId.replace(/\D/g, "");
      if (!telegramId) {
        return res.status(400).json({ error: "Укажи корректный Telegram ID" });
      }

      const existingUser = await resolveUserByTelegramId(telegramId);
      if (!existingUser) {
        return res.status(404).json({ error: "Игрок с таким Telegram ID не найден" });
      }

      return res.json({ ...serializeSafeUser(existingUser), isNewUser: false, telegramId });
    } catch (error) {
      console.error("Telegram ID auth failed:", error);
      res.status(500).json({ error: "Telegram ID auth failed" });
    }
  });

  app.get("/api/referrals/:userId", async (req, res) => {
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const referrals = Array.from(referralChildrenByUserId.get(user.id) ?? []);
    const referralUsers = (await Promise.all(referrals.map((id) => storage.getUser(id)))).filter(Boolean) as any[];
    const tier = resolvePassiveTier(referrals.length);
    const estimatedRaw = referralUsers.reduce((sum, refUser) => sum + refUser.balance * (tier.percentage / 100), 0);
    const estimatedTodayIncome = Math.min(tier.cap, Math.floor(estimatedRaw));

    res.json({
      referralCode: userReferralCodes.get(user.id) ?? null,
      referredBy: referredByUserId.get(user.id) ?? null,
      referralsCount: referrals.length,
      tier,
      estimatedTodayIncome,
      passiveIncomeConfig: PASSIVE_INCOME,
      referrals: referralUsers.map((u) => ({ id: u.id, username: u.username, level: u.level, balance: u.balance })),
    });
  });

  app.post("/api/referrals/:userId/claim", async (req, res) => {
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const dayKey = new Date().toISOString().slice(0, 10);
    const claimedDays = referralClaimHistory.get(user.id) ?? new Set<string>();
    if (claimedDays.has(dayKey)) {
      return res.status(400).json({ error: "РџР°СЃСЃРёРІРЅС‹Р№ РґРѕС…РѕРґ СѓР¶Рµ РїРѕР»СѓС‡РµРЅ СЃРµРіРѕРґРЅСЏ" });
    }

    const referrals = Array.from(referralChildrenByUserId.get(user.id) ?? []);
    const referralUsers = (await Promise.all(referrals.map((id) => storage.getUser(id)))).filter(Boolean) as any[];
    if (referralUsers.length === 0) {
      return res.status(400).json({ error: "РќРµС‚ СЂРµС„РµСЂР°Р»РѕРІ РґР»СЏ РЅР°С‡РёСЃР»РµРЅРёСЏ" });
    }

    const tier = resolvePassiveTier(referralUsers.length);
    const rawIncome = referralUsers.reduce((sum, refUser) => sum + refUser.balance * (tier.percentage / 100), 0);
    const payout = Math.min(tier.cap, Math.floor(rawIncome));
    if (payout <= 0) {
      return res.status(400).json({ error: "РќРµС‚ РґРѕСЃС‚СѓРїРЅРѕРіРѕ РїР°СЃСЃРёРІРЅРѕРіРѕ РґРѕС…РѕРґР°" });
    }

    const updated = await storage.updateUser(user.id, { balance: user.balance + payout });
    claimedDays.add(dayKey);
    referralClaimHistory.set(user.id, claimedDays);

    const { password, ...safeUser } = updated;
    res.json({ ok: true, payout, tier, user: safeUser });
  });

  // вњ… РџРћР›РЈР§Р•РќРР• РџРћР›Р¬Р—РћР’РђРўР•Р›РЇ
  app.get("/api/users/:id", async (req, res) => {
    const snapshot = await getUserWithGameState(req.params.id);
    if (!snapshot) return res.status(404).json({ error: "User not found" });

    const { user, game, notices } = snapshot;
    const tutorial = await getTutorialState(user.id);
    const registrationState = buildPlayerRegistrationState(user);
    const tutorialCompany = registrationState.registrationStep === "first_craft"
      ? await storage.getTutorialCompanyByOwner(user.id)
      : null;
    res.json({
      ...serializeSafeUser(user),
      skills: game.skills,
      inventory: game.inventory,
      workTime: Math.round(game.workTime * 100),
      studyTime: Math.round(game.studyTime * 100),
      gramBalance: game.gramBalance,
      activeBankProduct: game.activeBankProduct,
      jobDropPity: game.jobDropPity,
      tutorial,
      notices,
      currentInterviewQuestion: getCurrentInterviewQuestion(user),
      tutorialCompany,
    });
  });

  // вњ… РЎРћРҐР РђРќР•РќРР• РџР РћР“Р Р•РЎРЎРђ РџРћР›Р¬Р—РћР’РђРўР•Р›РЇ
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body ?? {};
      const userPatch: Record<string, unknown> = {};
      if (typeof updates.level === "number") userPatch.level = updates.level;
      if (typeof updates.experience === "number") userPatch.experience = updates.experience;
      if (typeof updates.balance === "number") userPatch.balance = updates.balance;
      if (typeof updates.reputation === "number") userPatch.reputation = updates.reputation;
      if (typeof updates.city === "string") userPatch.city = updates.city;
      if (typeof updates.personality === "string") userPatch.personality = updates.personality;
      if (typeof updates.gender === "string") userPatch.gender = updates.gender;

      await storage.updateUser(req.params.id, userPatch as any);

      applyGameStatePatch(req.params.id, {
        skills: updates.skills,
        inventory: updates.inventory,
        workTime: updates.workTime,
        studyTime: updates.studyTime,
        gramBalance: updates.gramBalance,
        activeBankProduct: updates.activeBankProduct,
      });

      const snapshot = await getUserWithGameState(req.params.id);
      if (!snapshot) return res.status(404).json({ error: "User not found" });

      const { user, game, notices } = snapshot;
      const tutorial = await getTutorialState(user.id);
      const registrationState = buildPlayerRegistrationState(user);
      const tutorialCompany = registrationState.registrationStep === "first_craft"
        ? await storage.getTutorialCompanyByOwner(user.id)
        : null;
      res.json({
        ...serializeSafeUser(user),
        skills: game.skills,
        inventory: game.inventory,
        workTime: Math.round(game.workTime * 100),
        studyTime: Math.round(game.studyTime * 100),
        gramBalance: game.gramBalance,
        activeBankProduct: game.activeBankProduct,
        jobDropPity: game.jobDropPity,
        tutorial,
        notices,
        currentInterviewQuestion: getCurrentInterviewQuestion(user),
        tutorialCompany,
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.patch("/api/users/:id/registration", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const payload = {
        username: typeof req.body?.username === "string" ? req.body.username : undefined,
        cityId: typeof req.body?.cityId === "string" ? req.body.cityId : undefined,
        city: typeof req.body?.city === "string" ? req.body.city : undefined,
        personalityId: typeof req.body?.personalityId === "string" ? req.body.personalityId : undefined,
        personality: typeof req.body?.personality === "string" ? req.body.personality : undefined,
        gender: typeof req.body?.gender === "string" ? req.body.gender : undefined,
        skills: typeof req.body?.skills === "object" && req.body?.skills !== null ? req.body.skills : undefined,
      };

      const updated = req.body?.action === "complete"
        ? await completeRegistration(user.id, payload)
        : await saveRegistrationProgress(user.id, payload);

      const snapshot = await getUserWithGameState(updated.id);
      if (!snapshot) return res.status(404).json({ error: "User not found" });

      const { user: refreshedUser, game, notices } = snapshot;
      const tutorial = await getTutorialState(refreshedUser.id);
      const registrationState = buildPlayerRegistrationState(refreshedUser);
      const tutorialCompany = registrationState.registrationStep === "first_craft"
        ? await storage.getTutorialCompanyByOwner(refreshedUser.id)
        : null;
      res.json({
        ...serializeSafeUser(refreshedUser),
        skills: game.skills,
        inventory: game.inventory,
        workTime: Math.round(game.workTime * 100),
        studyTime: Math.round(game.studyTime * 100),
        gramBalance: game.gramBalance,
        activeBankProduct: game.activeBankProduct,
        jobDropPity: game.jobDropPity,
        tutorial,
        notices,
        currentInterviewQuestion: getCurrentInterviewQuestion(refreshedUser),
        tutorialCompany,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to update registration" });
    }
  });

  app.get("/api/stocks", async (req, res) => {
    try {
      await assertFeatureEnabled("stocks", "Stocks are disabled by admin settings");
      const userId = String(req.query.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      res.json(await getStockMarketSnapshot(userId));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load stock market" });
    }
  });

  app.post("/api/stocks/buy", async (req, res) => {
    try {
      await assertFeatureEnabled("stocks", "Stocks are disabled by admin settings");
      const userId = String(req.body?.userId ?? "").trim();
      const ticker = String(req.body?.ticker ?? "").trim();
      const quantity = Number(req.body?.quantity ?? 0);
      if (!userId || !ticker || !Number.isFinite(quantity)) {
        return res.status(400).json({ error: "userId, ticker and quantity are required" });
      }
      const result = await buyStockAsset(userId, ticker, quantity);
      const tutorial = await applyTutorialEvent(userId, "first_stock_bought").catch(() => null);
      res.json({ ...result, tutorial });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to buy stock" });
    }
  });

  app.post("/api/stocks/sell", async (req, res) => {
    try {
      await assertFeatureEnabled("stocks", "Stocks are disabled by admin settings");
      const userId = String(req.body?.userId ?? "").trim();
      const ticker = String(req.body?.ticker ?? "").trim();
      const quantity = Number(req.body?.quantity ?? 0);
      if (!userId || !ticker || !Number.isFinite(quantity)) {
        return res.status(400).json({ error: "userId, ticker and quantity are required" });
      }
      res.json(await sellStockAsset(userId, ticker, quantity));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to sell stock" });
    }
  });

  app.get("/api/tutorial/:userId", async (req, res) => {
    try {
      await assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const state = await getTutorialState(req.params.userId);
      if (!state) return res.status(404).json({ error: "User not found" });

      const activeStep = getTutorialActiveStep(state);
      res.json({
        state,
        activeStep,
        progressText: getTutorialProgressText(state),
        stepContent: TUTORIAL_STEP_CONTENT[activeStep] ?? TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error) {
      console.error("Failed to load tutorial state:", error);
      res.status(500).json({ error: "Failed to load tutorial state" });
    }
  });

  app.post("/api/tutorial/:userId/start", async (req, res) => {
    try {
      await assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const result = await startTutorial(req.params.userId);
      const activeStep = getTutorialActiveStep(result.state);
      res.json({
        ...result,
        activeStep,
        progressText: getTutorialProgressText(result.state),
        stepContent: TUTORIAL_STEP_CONTENT[activeStep] ?? TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to start tutorial" });
    }
  });

  app.post("/api/tutorial/:userId/event", async (req, res) => {
    try {
      await assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const eventType = String(req.body?.eventType || "") as TutorialEventType;
      const supported: TutorialEventType[] = [
        "first_job_done",
        "first_course_item_bought",
        "first_course_item_used",
        "first_gadget_bought",
        "first_gadget_equipped",
        "first_stock_bought",
        "first_education_started",
        "demo_company_created",
        "demo_blueprint_done",
        "demo_gadget_produced",
        "demo_gadget_sold",
      ];
      if (!supported.includes(eventType)) {
        return res.status(400).json({ error: "Unsupported tutorial event" });
      }

      const result = await applyTutorialEvent(req.params.userId, eventType);
      const activeStep = getTutorialActiveStep(result.state);
      res.json({
        ...result,
        activeStep,
        progressText: getTutorialProgressText(result.state),
        stepContent: TUTORIAL_STEP_CONTENT[activeStep] ?? TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to apply tutorial event" });
    }
  });

  app.post("/api/tutorial/:userId/demo-company", async (req, res) => {
    try {
      await assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      await assertFeatureEnabled("demoCompany", "Demo companies are disabled by admin settings");
      await assertFeatureEnabled("tutorialDemoCompany", "Tutorial demo company is disabled by admin settings");
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const tutorialState = await getTutorialState(user.id);
      if (!tutorialState || !tutorialState.isActive || tutorialState.isCompleted) {
        return res.status(400).json({ error: "Tutorial is not active" });
      }
      if (tutorialState.currentStep < 3) {
        return res.status(400).json({ error: "Demo company unlocks after job and education tutorial steps" });
      }

      let company = await storage.getTutorialCompanyByOwner(user.id);
      if (!company) {
        company = await storage.createCompany(
          {
            name: TUTORIAL_DEMO_COMPANY_NAME,
            city: user.city,
            isTutorial: true,
            tutorialOwnerId: user.id,
          },
          user.id,
          user.username,
        );
      }
      const tutorialCapitalTarget = 30000;
      if (Number(company.balance ?? 0) < tutorialCapitalTarget) {
        company = await storage.updateCompany(company.id, { balance: tutorialCapitalTarget });
      }

      const tutorial = await assignTutorialDemoCompany(user.id, company.id);
      const activeStep = getTutorialActiveStep(tutorial.state);
      res.json({
        company,
        tutorial: {
          ...tutorial,
          activeStep,
          progressText: getTutorialProgressText(tutorial.state),
          stepContent: TUTORIAL_STEP_CONTENT[activeStep] ?? TUTORIAL_STEP_CONTENT[1],
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to create tutorial company" });
    }
  });

  app.post("/api/tutorial/:userId/demo-sell", async (req, res) => {
    try {
      await assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const state = await getTutorialState(req.params.userId);
      if (!state) return res.status(404).json({ error: "User not found" });
      if (!state.demoCompanyId) return res.status(400).json({ error: "Demo company not found" });
      if (!state.isActive || state.isCompleted) {
        return res.status(400).json({ error: "Tutorial is not active" });
      }
      if (state.currentStep < 6) {
        return res.status(400).json({ error: "Selling unlocks after producing tutorial gadget" });
      }

      const company = await storage.getCompany(state.demoCompanyId);
      if (!company || !isTutorialCompany(company)) {
        return res.status(404).json({ error: "Tutorial company not found" });
      }
      if (String(company.tutorialOwnerId || company.ownerId) !== req.params.userId) {
        return res.status(403).json({ error: "Not tutorial owner" });
      }

      const produced = companyGadgets.get(company.id) ?? [];
      const demoGadget = produced.find((item) => item.name === TUTORIAL_DEMO_BLUEPRINT.name) ?? produced[0];
      if (!demoGadget) {
        return res.status(400).json({ error: "No produced demo gadget to sell" });
      }

      const sold = removeProducedGadget(company.id, demoGadget.id);
      const tutorial = await applyTutorialEvent(req.params.userId, "demo_gadget_sold");
      const activeStep = getTutorialActiveStep(tutorial.state);
      res.json({
        soldGadget: sold,
        tutorial: {
          ...tutorial,
          activeStep,
          progressText: getTutorialProgressText(tutorial.state),
          stepContent: TUTORIAL_STEP_CONTENT[activeStep] ?? TUTORIAL_STEP_CONTENT[1],
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to sell tutorial gadget" });
    }
  });

  app.post("/api/tutorial/:userId/complete", async (req, res) => {
    try {
      await assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const before = await getTutorialState(req.params.userId);
      const demoCompanyId = before?.demoCompanyId ?? null;

      const result = await completeTutorial(req.params.userId);

      if (demoCompanyId) {
        const demoCompany = await storage.getCompany(demoCompanyId);
        if (demoCompany && isTutorialCompany(demoCompany)) {
          await storage.deleteCompany(demoCompany.id);
        }
        companyBlueprints.delete(demoCompanyId);
        companyGadgets.delete(demoCompanyId);
      }
      await clearTutorialDemoCompany(req.params.userId);

      const activeStep = getTutorialActiveStep(result.state);
      res.json({
        ...result,
        activeStep,
        progressText: getTutorialProgressText(result.state),
        stepContent: TUTORIAL_STEP_CONTENT[activeStep] ?? TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to complete tutorial" });
    }
  });

  // вњ… Р“Р›РћР‘РђР›Р¬РќР«Р™ Р Р•Р™РўРРќР“ РР“Р РћРљРћР’
  app.get("/api/leaderboard/players", async (req, res) => {
    try {
      await assertFeatureEnabled("leaderboards", "Leaderboards are disabled by admin settings");
      const sort = String(req.query.sort ?? "level");
      const users = await storage.getUsers();

      const sorted = [...users].sort((a, b) => {
        if (sort === "pvp") return Number(b.pvpRating || 1000) - Number(a.pvpRating || 1000);
        if (sort === "reputation") return b.reputation - a.reputation;
        if (sort === "wealth") return b.balance - a.balance;
        return b.level - a.level;
      });

      res.json(sorted.slice(0, 50).map(({ password, ...u }) => u));
    } catch (error) {
      console.error("Failed to load players leaderboard:", error);
      res.status(500).json({ error: "Failed to load players leaderboard" });
    }
  });

  // вњ… Р“Р›РћР‘РђР›Р¬РќР«Р™ Р Р•Р™РўРРќР“ РљРћРњРџРђРќРР™
  app.get("/api/leaderboard/companies", async (req, res) => {
    try {
      await assertFeatureEnabled("leaderboards", "Leaderboards are disabled by admin settings");
      const sort = String(req.query.sort ?? "level");
      const companies = (await storage.getAllCompanies()).filter((company) => !isTutorialCompany(company));

      const sorted = [...companies].sort((a, b) => {
        if (sort === "wealth") return b.balance - a.balance;
        if (sort === "blueprints") return b.ork - a.ork;
        return b.level - a.level;
      });

      res.json(
        sorted.slice(0, 50).map((c) => ({
          ...c,
          developedBlueprints: c.ork,
        }))
      );
    } catch (error) {
      console.error("Failed to load companies leaderboard:", error);
      res.status(500).json({ error: "Failed to load companies leaderboard" });
    }
  });

  app.get("/api/leaderboard/pvp-developers", async (_req, res) => {
    try {
      await assertFeatureEnabled("leaderboards", "Leaderboards are disabled by admin settings");
      const users = await storage.getUsers();
      const sorted = [...users]
        .sort((a, b) => {
          const ratingDiff = Number(b.pvpRating || 1000) - Number(a.pvpRating || 1000);
          if (ratingDiff !== 0) return ratingDiff;
          const winsDiff = Number(b.pvpWins || 0) - Number(a.pvpWins || 0);
          if (winsDiff !== 0) return winsDiff;
          return Number(b.pvpMatches || 0) - Number(a.pvpMatches || 0);
        })
        .slice(0, 50)
        .map(({ password, tutorialState, ...user }) => ({
          ...user,
          pvpRating: Number(user.pvpRating || 1000),
          pvpWins: Number(user.pvpWins || 0),
          pvpLosses: Number(user.pvpLosses || 0),
          pvpMatches: Number(user.pvpMatches || 0),
        }));
      res.json(sorted);
    } catch (error) {
      console.error("Failed to load PvP developers leaderboard:", error);
      res.status(500).json({ error: "Failed to load PvP developers leaderboard" });
    }
  });

  app.post("/api/pvp/heartbeat", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      await storage.updateUser(userId, { lastActiveAt: Math.floor(Date.now() / 1000) });
      updatePvpHeartbeat(userId);
      await flushCompletedPvpDuels();
      runPvpMatchmaking();
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to update heartbeat" });
    }
  });

  app.get("/api/pvp/status", async (req, res) => {
    try {
      const userId = String(req.query.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      await flushCompletedPvpDuels();
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const state = getPvpQueueState(userId);
      const stamp = getUtcDayStamp();
      const dailyMatches = user.pvpDailyStamp === stamp ? Number(user.pvpDailyMatches || 0) : 0;
      res.json({
        inQueue: state.inQueue,
        queueJoinedAtMs: state.queueJoinedAtMs,
        queueWaitSec: state.queueWaitSec,
        queueSize: state.queueSize,
        hasPendingResult: state.hasPendingResult,
        activeDuel: state.activeDuel,
        pendingBoosts: state.pendingBoosts,
        boostCatalog: getPvpBoostCatalog(),
        rating: Number(user.pvpRating || 1000),
        wins: Number(user.pvpWins || 0),
        losses: Number(user.pvpLosses || 0),
        matches: Number(user.pvpMatches || 0),
        dailyLimit: PVP_DUEL_CONFIG.dailyLimit,
        dailyMatches,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load PvP status" });
    }
  });

  app.post("/api/pvp/boosts/purchase", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const boostId = String(req.body?.boostId || "") as any;
      if (!userId || !boostId) return res.status(400).json({ error: "userId and boostId are required" });
      const boost = getPvpBoostCatalog().find((item) => item.id === boostId);
      if (!boost) return res.status(404).json({ error: "Boost not found" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const currentState = getPvpQueueState(user.id);
      if (currentState.activeDuel && !currentState.activeDuel.awaitingStart) {
        return res.status(400).json({ error: "Нельзя покупать PvP boost во время активной дуэли" });
      }
      if (!currentState.activeDuel && currentState.pendingBoosts?.includes(boost.id)) {
        return res.status(400).json({ error: "Этот boost уже куплен для следующей дуэли" });
      }
      const payment = await spendGram(user.id, boost.costGram, `PvP boost: ${boost.name}`);
      const pendingBoosts = purchasePvpBoost(user.id, boost.id);
      res.json({
        ok: true,
        boost,
        pendingBoosts,
        gramBalance: payment.state.gramBalance,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to purchase PvP boost" });
    }
  });

  app.post("/api/pvp/duel/start", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const duel = startActivePvpDuelNow(userId);
      if (!duel) return res.status(404).json({ error: "Активная дуэль не найдена" });
      const state = getPvpQueueState(userId);
      res.json({ ok: true, activeDuel: state.activeDuel });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to start PvP duel" });
    }
  });

  app.post("/api/pvp/queue/join", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const stamp = getUtcDayStamp();
      const dailyMatches = user.pvpDailyStamp === stamp ? Number(user.pvpDailyMatches || 0) : 0;
      if (dailyMatches >= PVP_DUEL_CONFIG.dailyLimit) {
        return res.status(400).json({ error: `Достигнут дневной лимит PvP боёв (${PVP_DUEL_CONFIG.dailyLimit})` });
      }

      const snapshot = await getUserWithGameState(user.id);
      if (!snapshot) return res.status(404).json({ error: "User game state not found" });
      const currentState = getPvpQueueState(user.id);
      if (currentState.activeDuel) {
        return res.status(400).json({ error: "Текущая PvP дуэль ещё не завершена" });
      }
      if (currentState.hasPendingResult) {
        return res.status(400).json({ error: "Сначала забери результат предыдущей PvP дуэли" });
      }
      const membership = await resolvePlayerCompanyMembership(user.id);
      if (membership) {
        const companyContracts = getContractsByCity(membership.company.city);
        const busyByContract = companyContracts.some(
          (contract) => contract.status === "in_progress" && contract.assignedCompanyId === membership.company.id,
        );
        if (busyByContract) {
          return res.status(400).json({ error: "Нельзя входить в PvP во время активного городского контракта компании" });
        }
      }
      const selectedBoosts = getPendingPvpBoosts(user.id);
      const baseEnergyCost = Number(PVP_DUEL_CONFIG.process.baseEnergyCost || 0);
      const energyCost = selectedBoosts.includes("energy_drink")
        ? Number((baseEnergyCost * PVP_DUEL_CONFIG.process.energyDrinkMultiplier).toFixed(4))
        : baseEnergyCost;
      const workTime = Number(snapshot.game.workTime || 0);
      if (workTime < energyCost) {
        return res.status(400).json({ error: `Недостаточно энергии работы. Нужно ${Math.round(energyCost * 100)}%` });
      }
      const skills = readDuelSkills(snapshot);
      const skillSum = skills.analytics + skills.design + skills.drawing + skills.coding + skills.modeling + skills.testing + skills.attention;

      await storage.updateUser(user.id, { lastActiveAt: Math.floor(Date.now() / 1000) });
      queuePlayerForPvp({
        userId: user.id,
        username: user.username,
        level: Number(user.level || 1),
        rating: Number(user.pvpRating || 1000),
        skills,
        skillSum,
      });

      await flushCompletedPvpDuels();
      const result = runPvpMatchmaking();

      const state = getPvpQueueState(user.id);
      res.json({
        ok: true,
        inQueue: state.inQueue,
        queueSize: state.queueSize,
        queueWaitSec: state.queueWaitSec,
        activeDuel: state.activeDuel,
        pendingBoosts: state.pendingBoosts,
        energyCost,
        matched: !!result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to join PvP queue" });
    }
  });

  app.post("/api/pvp/queue/leave", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      leavePvpQueue(userId);
      clearPendingPvpBoosts(userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to leave PvP queue" });
    }
  });

  app.post("/api/pvp/result/claim", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      await flushCompletedPvpDuels();
      const result = consumePendingPvpResult(userId);
      if (!result) return res.json({ ok: true, result: null });

      const perspectiveA = result.playerAUserId === userId;
      const myBefore = perspectiveA ? result.playerARatingBefore : result.playerBRatingBefore;
      const myAfter = perspectiveA ? result.playerARatingAfter : result.playerBRatingAfter;
      const opponentName = perspectiveA ? result.playerBName : result.playerAName;
      const isWinner = result.winnerUserId === userId;
      const gadgetWear = await applyGadgetWear(userId, {
        cause: "pvp",
        severityMultiplier: result.winnerUserId === null ? 1 : isWinner ? 1 : 1.08,
        negativeEventChanceBonus: 0.03,
      });

      res.json({
        ok: true,
        result: {
          id: result.id,
          createdAtMs: result.createdAtMs,
          opponentName,
          rounds: result.rounds,
          winnerUserId: result.winnerUserId,
          isWinner,
          isDraw: result.winnerUserId === null,
          ratingBefore: myBefore,
          ratingAfter: myAfter,
          ratingDelta: myAfter - myBefore,
          xpReward: result.winnerUserId === null ? 0 : isWinner ? result.winnerXp : result.loserXp,
          reputationReward: result.winnerUserId === null ? 0 : isWinner ? result.winnerReputation : 0,
          energyCost: perspectiveA ? Number(result.energyCostA || 0) : Number(result.energyCostB || 0),
          gadgetWear: gadgetWear.report,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to claim PvP result" });
    }
  });

  app.get("/api/pvp/history", async (req, res) => {
    try {
      const userId = String(req.query.userId || "");
      const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const rows = await storage.getPvpDuelHistoryByUser(userId, limit);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load PvP history" });
    }
  });

  // вњ… РЎРћР—Р”РђРќРР• РљРћРњРџРђРќРР
  app.post("/api/company", async (req, res) => {
    let debitedOwner: { id: string; balance: number } | null = null;
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const { ownerId, username, city } = req.body;
      const name = normalizeCompanyNameInput(req.body?.name);
      const emoji = normalizeCompanyEmojiInput(req.body?.emoji);
      console.log("рџЏў Creating company:", { name, emoji, ownerId, username, city });

      if (name.length < 3 || name.length > 40) {
        return res.status(400).json({ error: "Название компании должно быть длиной от 3 до 40 символов." });
      }

      if (!isValidCompanyEmojiInput(emoji)) {
        return res.status(400).json({ error: "Укажи один эмоджи для компании." });
      }

      const owner = await storage.getUser(ownerId);
      if (!owner) return res.status(404).json({ error: "Owner not found" });

      const creationCost = getCompanyCreateCostLocal(owner.city);
      if (owner.balance < creationCost) {
        return res.status(400).json({
          error: `Недостаточно средств для создания компании. Нужно ${creationCost}.`,
          required: creationCost,
        });
      }

      await storage.updateUser(owner.id, { balance: owner.balance - creationCost });
      debitedOwner = { id: owner.id, balance: owner.balance };

      const company = await storage.createCompany(
        { name: buildCompanyDisplayName(name, emoji), city },
        ownerId,
        username,
      );
      console.log("вњ… Company created:", company.id);
      res.json({ ...company, creationCost });
    } catch (error) {
      if (debitedOwner) {
        await storage.updateUser(debitedOwner.id, { balance: debitedOwner.balance });
      }
      console.error("Create company error:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.get("/api/hackathon", async (req, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "";
    const snapshot = getWeeklyHackathonState();
    res.json({
      ...snapshot,
      topCompanies: formatWeeklyHackathonTop(10),
      playerStats: userId && companyId ? getWeeklyHackathonPlayerStats(userId, companyId) : null,
      companyScore: companyId ? getWeeklyHackathonCompanyScore(companyId) : null,
      sabotage: getWeeklyHackathonSabotageState(companyId || undefined),
      config: {
        registrationCostGrm: WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
        contributionLimitPerDay: WEEKLY_HACKATHON_CONFIG.playerDailyContributionLimit,
        playerPartLimit: WEEKLY_HACKATHON_CONFIG.playerPartLimit,
        playerGrmLimit: WEEKLY_HACKATHON_CONFIG.playerGrmLimit,
        grmPackages: WEEKLY_HACKATHON_CONFIG.grmPackages,
      },
    });
  });

  app.post("/api/hackathon/register-company", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const companyId = String(req.body?.companyId || "");
      if (!userId || !companyId) return res.status(400).json({ error: "userId и companyId обязательны" });

      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Компания не найдена" });
      if (company.ownerId !== userId) return res.status(403).json({ error: "Регистрировать компанию может только CEO" });
      if (Number(company.level || 0) < 1) return res.status(400).json({ error: "Компания должна быть минимум 1 уровня" });

      if (Number(company.balance || 0) < WEEKLY_HACKATHON_CONFIG.registrationCostGrm) {
        return res.status(400).json({ error: `Недостаточно GRM на балансе компании. Нужно ${WEEKLY_HACKATHON_CONFIG.registrationCostGrm}` });
      }

      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
      });

      const rndLevel = Math.max(0, Math.floor(Number(company.ork || 0) / 100));
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      const entry = registerCompanyForWeeklyHackathon({
        companyId: company.id,
        companyName: company.name,
        city: company.city,
        companyLevel: company.level,
        rndLevel,
        securityLevel: Math.min(3, 1 + departmentEffects.sabotageSecurityBonus),
      });
      res.json({ ok: true, entry, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось зарегистрировать компанию" });
    }
  });

  app.post("/api/hackathon/contribute/skill", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });

      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "Игрок не найден" });
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(membership.company);
      const game = snapshot.game as any;
      const workTime = Number(game.workTime || 0);
      if (workTime < WEEKLY_HACKATHON_CONFIG.skillEnergyCost) {
        return res.status(400).json({ error: `Недостаточно энергии. Нужно ${Math.round(WEEKLY_HACKATHON_CONFIG.skillEnergyCost * 100)}%` });
      }

      const result = contributeSkillToWeeklyHackathon({
        userId,
        companyId: membership.company.id,
        skills: {
          coding: Number(game.skills?.coding || 0),
          analytics: Number(game.skills?.analytics || 0),
          design: Number(game.skills?.design || 0),
          testing: Number(game.skills?.testing || 0),
        },
        multiplier: departmentEffects.hackathonSkillMultiplier,
      });
      applyGameStatePatch(userId, {
        workTime: Math.max(0, Number((workTime - WEEKLY_HACKATHON_CONFIG.skillEnergyCost).toFixed(4))),
      });
      res.json({ ok: true, ...result, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось внести skill-вклад" });
    }
  });

  app.post("/api/hackathon/contribute/grm", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const amount = Math.floor(Number(req.body?.amount || 0));
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });

      const payment = await spendGram(userId, amount, `Weekly Hackathon вклад ${amount} GRM`);
      const result = contributeGrmToWeeklyHackathon({
        userId,
        companyId: membership.company.id,
        amount,
      });
      res.json({ ok: true, ...result, gramBalance: payment.state.gramBalance, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось внести GRM-вклад" });
    }
  });

  app.post("/api/hackathon/contribute/part", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const partRef = String(req.body?.partRef || "");
      if (!userId || !partRef) return res.status(400).json({ error: "userId и partRef обязательны" });
      const membership = await resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });

      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "Игрок не найден" });
      const game = snapshot.game as any;
      const inventory = Array.isArray(game.inventory) ? [...game.inventory] : [];
      const index = inventory.findIndex((item: any) => item.type === "part" && String(item.id) === partRef);
      if (index < 0) return res.status(400).json({ error: "Деталь не найдена в инвентаре" });

      const inventoryItem = inventory[index];
      const part = ALL_PARTS[String(inventoryItem.id)];
      if (!part) return res.status(400).json({ error: "Справочник детали не найден" });

      const mappedType: HackathonPartType | null =
        part.type === "processor" || part.type === "asic_chip"
          ? "CPU"
          : part.type === "memory"
          ? "Memory"
          : part.type === "camera"
          ? "Camera"
          : part.type === "battery" || part.type === "power"
          ? "Battery"
          : part.type === "controller" || part.type === "motherboard"
          ? "Security chip"
          : null;
      if (!mappedType || !HACKATHON_ALLOWED_PART_TYPES.has(mappedType)) {
        return res.status(400).json({ error: "Эта деталь не подходит для хакатона" });
      }

      const result = contributePartToWeeklyHackathon({
        userId,
        companyId: membership.company.id,
        partType: mappedType,
        rarity: String(inventoryItem.rarity || "Common"),
        quantity: 1,
        multiplier: (await getEffectiveCompanyDepartmentEffects(membership.company)).effects.hackathonPartMultiplier,
      });

      const qty = Math.max(1, Math.floor(Number(inventoryItem.quantity || 1)));
      if (qty <= 1) {
        inventory.splice(index, 1);
      } else {
        inventory[index] = { ...inventoryItem, quantity: qty - 1 };
      }
      applyGameStatePatch(userId, { inventory });
      res.json({ ok: true, ...result, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось внести вклад деталью" });
    }
  });

  app.get("/api/hackathon/sabotage", async (req, res) => {
    try {
      const userId = String(req.query.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      const snapshot = getWeeklyHackathonState();
      const companyId = String(membership.company.id);
      const targets = snapshot.leaderboard.filter((row) => row.companyId !== companyId).map((row) => ({
        companyId: row.companyId,
        companyName: row.companyName,
        city: row.city,
        score: row.score,
        securityLevel: Number((row as any).securityLevel || 1),
      }));

      const sabotageState = getWeeklyHackathonSabotageState(companyId);
      const eventId = String(snapshot.eventId || "");
      const logs = eventId ? await storage.getHackathonSabotageLogsByEvent(eventId, companyId) : [];
      const pendingIncomingPoach = eventId
        ? await storage.getPendingHackathonPoachOffer(userId, eventId)
        : undefined;

      res.json({
        ok: true,
        status: snapshot.status,
        eventId,
        companyId,
        role: membership.role,
        canLaunch: canLaunchHackathonSabotageByRole(membership.role),
        sabotageState,
        config: WEEKLY_HACKATHON_CONFIG.sabotage,
        targets,
        recentLogs: logs.slice(-20).reverse(),
        pendingIncomingPoach: pendingIncomingPoach ?? null,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось загрузить саботаж" });
    }
  });

  app.post("/api/hackathon/sabotage/security-level", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const level = Math.floor(Number(req.body?.level || 1));
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      if (membership.role !== "owner") return res.status(403).json({ error: "Изменять security level может только CEO" });
      if (![1, 2, 3].includes(level)) return res.status(400).json({ error: "securityLevel может быть только 1, 2 или 3" });
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(membership.company);
      const updatedLevel = setHackathonCompanySecurityLevel(String(membership.company.id), Math.min(3, level + departmentEffects.sabotageSecurityBonus));
      res.json({ ok: true, securityLevel: updatedLevel, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось обновить securityLevel" });
    }
  });

  app.post("/api/hackathon/sabotage/launch", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const targetCompanyId = String(req.body?.targetCompanyId || "");
      const sabotageType = String(req.body?.sabotageType || "") as HackathonSabotageType;
      const targetUserId = req.body?.targetUserId ? String(req.body.targetUserId) : undefined;
      if (!userId || !targetCompanyId || !sabotageType) {
        return res.status(400).json({ error: "userId, targetCompanyId и sabotageType обязательны" });
      }

      const membership = await resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      if (!canLaunchHackathonSabotageByRole(membership.role)) {
        return res.status(403).json({ error: "Только CEO / CTO / Security Lead могут запускать саботаж" });
      }

      const attackerCompanyId = String(membership.company.id);
      if (attackerCompanyId === targetCompanyId) {
        return res.status(400).json({ error: "Нельзя атаковать свою компанию" });
      }

      const targetCompany = await storage.getCompany(targetCompanyId);
      if (!targetCompany) return res.status(404).json({ error: "Компания-цель не найдена" });
      const sabotageConfig = WEEKLY_HACKATHON_CONFIG.sabotage.types[sabotageType];
      if (!sabotageConfig) return res.status(400).json({ error: "Неизвестный тип саботажа" });

      if (sabotageType === "talent_poaching") {
        if (!targetUserId) return res.status(400).json({ error: "Для Talent Poaching нужно targetUserId" });
        const targetMember = await storage.getMemberByUserId(targetCompanyId, targetUserId);
        if (!targetMember) return res.status(400).json({ error: "Игрок не состоит в компании-цели" });
      }

      const attackerCompany = membership.company;
      const costGrm = Number(sabotageConfig.costGrm || 0);
      if (Number(attackerCompany.balance || 0) < costGrm) {
        return res.status(400).json({ error: `Недостаточно GRM у компании. Нужно ${costGrm}` });
      }
      await storage.updateCompany(attackerCompanyId, {
        balance: Number(attackerCompany.balance || 0) - costGrm,
      });

      const { effects: targetDepartmentEffects } = await getEffectiveCompanyDepartmentEffects(targetCompany);
      const result = launchWeeklyHackathonSabotage({
        initiatorUserId: userId,
        initiatorRole: membership.role,
        attackerCompanyId,
        targetCompanyId,
        sabotageType,
        targetUserId,
        defenseMultiplier: targetDepartmentEffects.sabotageDefenseMultiplier,
      });

      const created = await storage.createHackathonSabotageLog({
        eventId: result.eventId,
        attackerCompanyId: result.attackerCompanyId,
        attackerCompanyName: result.attackerCompanyName,
        targetCompanyId: result.targetCompanyId,
        targetCompanyName: result.targetCompanyName,
        initiatorUserId: result.initiatorUserId,
        targetUserId: result.targetUserId,
        sabotageType: result.sabotageType,
        status: result.status,
        success: typeof result.success === "boolean" ? result.success : null,
        detected: result.detected,
        scoreDeltaAttacker: result.scoreDeltaAttacker,
        scoreDeltaTarget: result.scoreDeltaTarget,
        details: JSON.stringify(result.details || {}),
        createdAt: Math.floor(Date.now() / 1000),
        resolvedAt: result.status === "resolved" ? Math.floor(Date.now() / 1000) : null,
      });

      res.json({
        ok: true,
        sabotage: result,
        log: created,
        companyBalance: Number(attackerCompany.balance || 0) - costGrm,
        state: getWeeklyHackathonState(),
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось запустить саботаж" });
    }
  });

  app.post("/api/hackathon/sabotage/poach/respond", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const offerId = String(req.body?.offerId || "");
      const accept = Boolean(req.body?.accept);
      if (!userId || !offerId) return res.status(400).json({ error: "userId и offerId обязательны" });
      const result = resolveHackathonPoachOffer({ offerId, userId, accept });
      await storage.updateHackathonSabotageLog(offerId, {
        status: accept ? "accepted" : "declined",
        success: accept,
        scoreDeltaTarget: result.targetScoreDelta,
        resolvedAt: Math.floor(Date.now() / 1000),
      });
      res.json({ ok: true, result, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось обработать Talent Poaching" });
    }
  });

  // вњ… РџРћР›РЈР§Р•РќРР• Р’РЎР•РҐ РљРћРњРџРђРќРР™
  app.get("/api/companies", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const companies = (await storage.getAllCompanies()).filter((company) => !isTutorialCompany(company));
      res.json(companies);
    } catch (error) {
      console.error("Get all companies error:", error);
      res.status(500).json({ error: "Failed to get companies" });
    }
  });

  // вњ… РџРћР›РЈР§Р•РќРР• РљРћРњРџРђРќРР™ РџРћ Р“РћР РћР”РЈ
  app.get("/api/companies/city/:city", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const companies = (await storage.getCompaniesByCity(req.params.city)).filter((company) => !isTutorialCompany(company));
      res.json(companies);
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Failed to get companies" });
    }
  });

  // вњ… РџРћР›РЈР§Р•РќРР• РљРћРњРџРђРќРР РџРћ ID
  app.get("/api/companies/:id", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to get company" });
    }
  });

  app.get("/api/companies/:id/staffing", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const { staffing, effects } = await getEffectiveCompanyDepartmentEffects(company);
      res.json({ staffing, effects });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to get staffing" });
    }
  });

  app.post("/api/companies/:id/staffing/assign", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });

      const actorUserId = String(req.body?.actorUserId || "");
      const targetUserId = String(req.body?.targetUserId || "");
      const department = String(req.body?.department || "") as CompanyDepartmentKey;
      if (!actorUserId || !targetUserId || !department) {
        return res.status(400).json({ error: "actorUserId, targetUserId и department обязательны" });
      }
      if (company.ownerId !== actorUserId) {
        return res.status(403).json({ error: "Назначать сотрудников по отделам может только CEO" });
      }
      if (!["researchAndDevelopment", "production", "marketing", "finance", "infrastructure"].includes(department)) {
        return res.status(400).json({ error: "Неизвестный отдел" });
      }

      const staffing = await assignCompanyMemberDepartment(company.id, targetUserId, department);
      const economy = reconcileCompanyEconomy({
        ...(company as CompanyEconomyLike),
        employeeCount: staffing.members.length,
      });
      const effects = getDepartmentEffects(economy.departments, staffing);
      res.json({ ok: true, staffing, effects });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to assign department" });
    }
  });

  app.post("/api/companies/:id/join", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const { userId, username } = req.body;
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (isTutorialCompany(company)) {
        return res.status(400).json({ error: "Tutorial company is private and cannot accept join requests" });
      }
      const request = await storage.createJoinRequest({
        companyId: req.params.id,
        userId,
        username,
      });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to create join request" });
    }
  });

  app.get("/api/companies/:id/requests", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (isTutorialCompany(company)) {
        return res.status(400).json({ error: "Tutorial company does not have join requests" });
      }
      const requests = await storage.getJoinRequestsByCompany(req.params.id);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to get join requests" });
    }
  });

  app.post("/api/companies/requests/:id/respond", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const { status, companyId, userId, username } = req.body;
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (isTutorialCompany(company)) {
        return res.status(400).json({ error: "Tutorial company does not support recruiting" });
      }
      await storage.updateJoinRequestStatus(req.params.id, status);

      if (status === "accepted") {
        await storage.addCompanyMember({
          companyId,
          userId,
          username,
          role: "member",
        });
      }

      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to respond to request" });
    }
  });

  app.post("/api/companies/:id/leave", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (isTutorialCompany(company)) {
        return res.status(400).json({ error: "Tutorial company cannot be managed via regular leave flow" });
      }
      const { userId } = req.body;
      await storage.removeCompanyMember(req.params.id, userId);
      const remainingMembers = await storage.getCompanyMembers(req.params.id);
      if (remainingMembers.length === 0) {
        clearCompanyStaffing(req.params.id);
      }
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to leave company" });
    }
  });

  app.post("/api/company/:id/upgrade", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).send("Company not found");
      if (isTutorialCompany(company)) return res.status(400).send("Tutorial company cannot be upgraded");

      const nextLevel = company.level + 1;
      const reqs = LEVEL_REQUIREMENTS.find(r => r.level === nextLevel);

      if (!reqs) return res.status(400).send("Max level reached");

      const members = await storage.getCompanyMembers(company.id);
      const memberCount = members.length || 1;

      if (company.ork < reqs.ork) return res.status(400).send(`Need ${reqs.ork} ORK`);
      if (company.balance < reqs.cost) return res.status(400).send(`Need ${reqs.cost} balance`);
      if (memberCount < 1) return res.status(400).send(`Need 1 player`);

      const updated = await storage.updateCompany(company.id, {
        level: nextLevel,
        balance: company.balance - reqs.cost,
        warehouseCapacity: reqs.warehouse,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to upgrade company" });
    }
  });

  app.post("/api/company/:id/expand-warehouse", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).send("Company not found");
      if (isTutorialCompany(company)) return res.status(400).send("Tutorial company cannot expand warehouse");

      const capacity = Number(company.warehouseCapacity) || 50;
      if (company.level === 1 && capacity < 100) {
        const cost = 1000;
        if (company.balance < cost) return res.status(400).send("Not enough balance");

        const updated = await storage.updateCompany(company.id, {
          balance: company.balance - cost,
          warehouseCapacity: 100
        });
        return res.json(updated);
      }

      res.status(400).send("Expansion not available");
    } catch (error) {
      res.status(500).json({ error: "Failed to expand warehouse" });
    }
  });

  app.get("/api/companies/:id/blueprints", async (req, res) => {
    try {
      await assertFeatureEnabled("blueprints", "Blueprints are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Blueprints are disabled by admin settings" });
    }
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const current = await syncTutorialBlueprintState(company, companyBlueprints.get(company.id));
    res.json({
      available: isTutorialCompany(company) ? [buildTutorialBlueprintView()] : getAvailableBlueprints(company.level),
      active: current ?? null,
      produced: companyGadgets.get(company.id) ?? [],
    });
  });

  app.get("/api/companies/:id/exclusive", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      res.json({
        active: getExclusiveProject(company.id),
        catalog: getExclusiveCatalog(company.id),
        produced: (companyGadgets.get(company.id) ?? []).filter((item) => item.isExclusive),
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load exclusive gadgets" });
    }
  });

  app.post("/api/companies/:id/exclusive/start", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      const name = normalizeExclusiveName(req.body?.name);
      const partRefs = Array.isArray(req.body?.partRefs) ? req.body.partRefs.map((item: unknown) => String(item)) : [];
      const seedPartsInput = Array.isArray(req.body?.seedParts) ? req.body.seedParts : [];
      const selectedPartsCount = seedPartsInput.length || partRefs.length;
      if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can start exclusive gadget design" });
      if (name.length < 3) return res.status(400).json({ error: "Название эксклюзивного гаджета должно быть от 3 символов" });
      if (selectedPartsCount < 3 || selectedPartsCount > 6) {
        return res.status(400).json({ error: "Для эксклюзивного гаджета нужно выбрать от 3 до 6 деталей" });
      }
      if (getExclusiveProject(company.id)?.status === "in_progress") {
        return res.status(400).json({ error: "У компании уже идет разработка эксклюзивного гаджета" });
      }

      const { seedParts, snapshot } = seedPartsInput.length
        ? {
            seedParts: seedPartsInput.map((item: any) => ({
              id: String(item.id),
              rarity: String(item.rarity || "Common") as any,
              type: String(item.type || ALL_PARTS[String(item.id)]?.type || "processor") as any,
              name: String(item.name || ALL_PARTS[String(item.id)]?.name || item.id),
            })) as ExclusiveSeedPart[],
            snapshot: await getUserWithGameState(userId),
          }
        : await buildExclusiveSeedPartsFromInventory(userId, partRefs);
      if (!snapshot) return res.status(404).json({ error: "CEO snapshot not found" });
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      const professionId = getPlayerProfessionId(snapshot.user);
      const blueprint = buildExclusiveBlueprintDefinition({
        id: `exclusive-${randomUUID()}`,
        companyId: company.id,
        companyName: company.name,
        gadgetName: name,
        seedParts,
        ceoSkills: (snapshot.game as any).skills ?? {},
        ceoProfessionId: professionId,
        departmentEffects,
      });
      if (Number(company.balance || 0) < Number(blueprint.developmentCostGrm || 0)) {
        return res.status(400).json({ error: `Недостаточно GRM компании для старта разработки (${blueprint.developmentCostGrm} GRM)` });
      }
      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - Number(blueprint.developmentCostGrm || 0),
      });

      const project: ExclusiveProjectState = {
        blueprint,
        status: "in_progress",
        progressHours: 0,
        startedAt: Date.now(),
        investedResearch: createEmptyExclusiveResearchMap(),
        progressTicks: 0,
        lastContribution: createEmptyExclusiveResearchMap(),
        participantUserIds: [userId],
      };
      exclusiveProjectByCompanyId.set(company.id, project);
      const gadgetWear = await applyGadgetWear(userId, {
        cause: "blueprint_development",
        qualityHint: Number(blueprint.successChance || 1),
      });
      res.json({ ...project, gadgetWear: gadgetWear.report });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to start exclusive design" });
    }
  });

  app.post("/api/companies/:id/exclusive/progress", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      const member = await storage.getMemberByUserId(company.id, userId);
      if (!member) return res.status(403).json({ error: "Только сотрудники компании могут развивать эксклюзивный гаджет" });
      const project = getExclusiveProject(company.id);
      if (!project || project.status !== "in_progress") {
        return res.status(400).json({ error: "Нет активной эксклюзивной разработки" });
      }
      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "Профиль сотрудника не найден" });
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      const researchState = getExclusiveResearchState(project);
      const members = await storage.getCompanyMembers(company.id);
      const memberIds = new Set(members.map((member) => member.userId));
      const participantIds = Array.from(new Set([company.ownerId, ...(project.participantUserIds ?? [])])).filter((id) => memberIds.has(id));
      const participantSnapshots = await Promise.all(
        participantIds.map(async (participantId) => {
          const participantSnapshot = await getUserWithGameState(participantId);
          if (!participantSnapshot) return null;
          return {
            skills: ((participantSnapshot.game as any).skills ?? {}) as Record<string, number>,
            professionId: getPlayerProfessionId(participantSnapshot.user),
            advancedPersonalityId: getAdvancedPersonalityId(participantSnapshot.user),
          };
        }),
      );
      const contribution = buildExclusiveResearchContribution({
        members: participantSnapshots.filter(Boolean) as Array<{
          skills: Record<string, number>;
          professionId: string | null;
          advancedPersonalityId: string | null;
        }>,
        departmentEffects,
        required: researchState.required,
      });

      const nextInvested: ExclusiveResearchMap = { ...(project.investedResearch ?? createEmptyExclusiveResearchMap()) };
      let progressHoursGain = 0;
      for (const skill of EXCLUSIVE_RESEARCH_SKILLS) {
        const required = Math.max(0, Number(researchState.required[skill] ?? 0));
        if (required <= 0) continue;
        const current = Math.max(0, Number(nextInvested[skill] ?? 0));
        const gain = Math.max(0, Number(contribution[skill] ?? 0));
        nextInvested[skill] = Number(Math.min(required, current + gain).toFixed(2));
        progressHoursGain += gain;
      }
      project.investedResearch = nextInvested;
      project.lastContribution = contribution;
      project.progressTicks = Math.max(0, Number(project.progressTicks || 0)) + 1;
      project.participantUserIds = participantIds;

      const updatedResearchState = getExclusiveResearchState(project);
      project.progressHours = Number(
        (
          Math.max(1, Number(project.blueprint.developmentHoursRequired || 1))
          * (Number(updatedResearchState.percent || 0) / 100)
        ).toFixed(2),
      );

      if (updatedResearchState.isComplete) {
        project.completedAt = Date.now();
        if (Math.random() <= project.blueprint.successChance) {
          project.status = "production_ready";
          setExclusiveCatalog(company.id, [project.blueprint, ...getExclusiveCatalog(company.id)]);
        } else {
          project.status = "failed";
          project.failedReason = "Команда не смогла довести прототип до стабильного релиза";
        }
      }
      exclusiveProjectByCompanyId.set(company.id, project);
      const gadgetWear = await applyGadgetWear(userId, {
        cause: "blueprint_development",
        qualityHint: Number(project.blueprint.successChance || 1),
      });
      res.json({
        ...project,
        progressGain: Number(progressHoursGain.toFixed(2)),
        contribution,
        research: updatedResearchState,
        gadgetWear: gadgetWear.report,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to progress exclusive design" });
    }
  });

  app.post("/api/companies/:id/exclusive/join", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      const member = await storage.getMemberByUserId(company.id, userId);
      if (!member) return res.status(403).json({ error: "Только сотрудники компании могут присоединиться к разработке" });
      const project = getExclusiveProject(company.id);
      if (!project || project.status !== "in_progress") {
        return res.status(400).json({ error: "Сейчас нет активной эксклюзивной разработки" });
      }
      const participantIds = new Set(project.participantUserIds ?? []);
      participantIds.add(userId);
      participantIds.add(company.ownerId);
      project.participantUserIds = Array.from(participantIds);
      exclusiveProjectByCompanyId.set(company.id, project);
      res.json({
        ok: true,
        participantCount: project.participantUserIds.length,
        project,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to join exclusive design" });
    }
  });

  app.post("/api/companies/:id/exclusive/produce", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      const blueprintId = String(req.body?.blueprintId || "");
      const quantity = Math.max(1, Math.min(5, Math.floor(Number(req.body?.quantity || 1))));
      if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can produce exclusive gadgets" });
      const catalog = getExclusiveCatalog(company.id);
      const blueprint = catalog.find((item) => item.id === blueprintId);
      if (!blueprint) return res.status(404).json({ error: "Эксклюзивный чертеж не найден" });
      if (blueprint.remainingUnits <= 0) return res.status(400).json({ error: "Лимит выпуска этого гаджета исчерпан" });

      const actualQuantity = Math.min(quantity, blueprint.remainingUnits);
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      const gramCost = Math.max(1, Math.round(blueprint.productionCostGram * actualQuantity * departmentEffects.productionCostMultiplier));
      if (Number(company.balance || 0) < gramCost) {
        return res.status(400).json({ error: `Недостаточно GRM компании для производства (${gramCost} GRM)` });
      }
      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - gramCost,
      });
      const produced = companyGadgets.get(company.id) ?? [];
      const ownerSnapshot = await getUserWithGameState(userId);
      const creatorTesting = Number(ownerSnapshot?.game.skills.testing || 0);
      const creatorAttention = Number(ownerSnapshot?.game.skills.attention || 0);
      const created: ProducedGadget[] = [];
      for (let i = 0; i < actualQuantity; i += 1) {
        const quality = Number((1 + departmentEffects.gadgetQualityBonus + blueprint.successChance * 0.35).toFixed(2));
        const gadgetCondition = createGadgetConditionProfile({
          rarity: "Exclusive",
          quality,
          testing: creatorTesting,
          attention: creatorAttention,
        });
        created.push({
          id: randomUUID(),
          blueprintId: blueprint.id,
          companyId: company.id,
          name: blueprint.name,
          category: blueprint.category,
          stats: Object.fromEntries(Object.entries(blueprint.baseStats).map(([key, value]) => [key, Number((Number(value) * quality).toFixed(2))])),
          quality,
          minPrice: Math.round(blueprint.productionCostGram * quality * 6),
          maxPrice: Math.round(blueprint.productionCostGram * quality * 9),
          ...gadgetCondition,
          producedAt: Date.now(),
          isExclusive: true,
          exclusiveBonusType: blueprint.bonusType,
          exclusiveBonusValue: blueprint.bonusValue,
          exclusiveBonusLabel: blueprint.bonusLabel,
        });
      }
      produced.unshift(...created);
      companyGadgets.set(company.id, produced);

      blueprint.remainingUnits -= actualQuantity;
      setExclusiveCatalog(company.id, catalog.map((item) => (item.id === blueprint.id ? { ...blueprint } : item)));

      let bonusApplied: Record<string, unknown> = {};
      if (blueprint.bonusType === "finance") {
        const companyBonus = blueprint.bonusValue * actualQuantity;
        await storage.updateCompany(company.id, { balance: Number(company.balance || 0) + companyBonus });
        bonusApplied = { financeGrm: companyBonus };
      } else if (blueprint.bonusType === "xp") {
        const owner = await storage.getUser(userId);
        if (owner) {
          const levelState = applyExperienceGainForLevel(owner, blueprint.bonusValue * actualQuantity);
          await storage.updateUser(userId, { level: levelState.level, experience: levelState.experience });
        }
        bonusApplied = { xp: blueprint.bonusValue * actualQuantity };
      } else {
        const skillName = blueprint.bonusSkill || getExclusiveSkillRewardSkill(blueprint.dominantProfessionId);
        const snapshot = await getUserWithGameState(userId);
        if (snapshot) {
          const game = snapshot.game as any;
          const skills = { ...(game.skills ?? {}) };
          skills[skillName] = Number(skills[skillName] || 0) + blueprint.bonusValue * actualQuantity;
          applyGameStatePatch(userId, { skills });
        }
        bonusApplied = { skill: skillName, amount: blueprint.bonusValue * actualQuantity };
      }

      const gadgetWear = await applyGadgetWear(userId, {
        cause: "production",
        qualityHint: Number(created[0]?.quality || 1),
      });
      res.json({
        ok: true,
        produced: created,
        blueprint: { ...blueprint },
        companyBalance: Number(company.balance || 0) - gramCost,
        bonusApplied,
        gadgetWear: gadgetWear.report,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to produce exclusive gadget" });
    }
  });

  app.post("/api/companies/:id/blueprints/start", async (req, res) => {
    try {
      await assertFeatureEnabled("blueprints", "Blueprints are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Blueprints are disabled by admin settings" });
    }
    const { userId, blueprintId } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can start blueprint" });
    const ceoUser = await storage.getUser(company.ownerId);
    const ceoAdvanced = ceoUser ? getAdvancedPersonalityId(ceoUser) : null;

    const isTutorial = isTutorialCompany(company);
    if (isTutorial) {
      try {
        await assertFeatureEnabled("tutorialFreeBlueprint", "Tutorial free blueprint is disabled by admin settings");
      } catch (error: any) {
        return res.status(403).json({
          error: error?.message || "Tutorial free blueprint is disabled by admin settings",
          // TODO: Add paid tutorial blueprint flow when free blueprint is disabled.
        });
      }
    }
    if (isTutorial) {
      const tutorialOwnerId = String(company.tutorialOwnerId || company.ownerId);
      const unlock = await isTutorialProductionUnlocked(tutorialOwnerId);
      if (!unlock.allowed) {
        return res.status(400).json({ error: "Tutorial blueprint is locked for current tutorial step" });
      }
    }
    const normalizedBlueprintId = isTutorial
      ? (String(blueprintId || TUTORIAL_DEMO_BLUEPRINT.id))
      : String(blueprintId || "");
    const blueprint = isTutorial
      ? (normalizedBlueprintId === TUTORIAL_DEMO_BLUEPRINT.id ? buildTutorialBlueprintView() : null)
      : GADGET_BLUEPRINTS.find((b) => b.id === normalizedBlueprintId);
    if (!blueprint) return res.status(404).json({ error: "Blueprint not found" });

    if (!isTutorial) {
      const settings = await getGameSettings();
      const winnerBoost = getWinnerBoostForCompany(company.id);
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      let blueprintCost = Math.max(
        1,
        Math.round((Number(blueprint.production?.costGram || 1) * 25) * Math.max(0.1, settings.multipliers.blueprintCostMultiplier)),
      );
      if (winnerBoost && "researchCostMultiplier" in winnerBoost) {
        blueprintCost = Math.max(1, Math.round(blueprintCost * winnerBoost.researchCostMultiplier));
      }
      const researchModifier = getGlobalEventModifier({
        type: "research_modifier",
        target: String(blueprint.category || "all"),
        city: company.city,
      });
      blueprintCost = Math.max(1, Math.round(blueprintCost * Math.max(0.05, 1 - researchModifier)));
      blueprintCost = Math.max(1, Math.round(blueprintCost * departmentEffects.blueprintCostMultiplier));
      if (ceoAdvanced === "engineer") {
        blueprintCost = Math.max(1, Math.round(blueprintCost * 0.9));
      }
      if (ceoAdvanced === "strategist") {
        blueprintCost = Math.max(1, Math.round(blueprintCost * 0.92));
      }
      if (company.balance < blueprintCost) {
        return res.status(400).json({ error: `Недостаточно баланса компании для старта чертежа (${blueprintCost} GRM)` });
      }
      await storage.updateCompany(company.id, { balance: company.balance - blueprintCost });
      // TODO: Persist blueprint development ledger/history for auditing economy changes.
    }

    companyBlueprints.set(company.id, {
      blueprintId: normalizedBlueprintId,
      status: "in_progress",
      progressHours: 0,
      startedAt: Date.now(),
    });

    const gadgetWear = await applyGadgetWear(userId, {
      cause: "blueprint_development",
      qualityHint: Number(blueprint.time || 1) > 18 ? 0.95 : 1,
    });
    res.json({
      ...companyBlueprints.get(company.id),
      ceoAdvancedPersonality: ceoAdvanced,
      gadgetWear: gadgetWear.report,
    });
  });

  app.post("/api/companies/:id/blueprints/progress", async (req, res) => {
    try {
      await assertFeatureEnabled("blueprints", "Blueprints are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Blueprints are disabled by admin settings" });
    }
    const { userId, hours = 24 } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can progress blueprint" });
    const ceoUser = await storage.getUser(company.ownerId);
    const ceoAdvanced = ceoUser ? getAdvancedPersonalityId(ceoUser) : null;

    const state = companyBlueprints.get(company.id);
    if (!state) return res.status(400).json({ error: "No active blueprint" });

    if (isTutorialCompany(company)) {
      const synced = await syncTutorialBlueprintState(company, state);
      const gadgetWear = await applyGadgetWear(String(userId || company.ownerId), {
        cause: "blueprint_development",
      });
      return res.json({ ...synced, gadgetWear: gadgetWear.report });
    }

    const blueprint = GADGET_BLUEPRINTS.find((b) => b.id === state.blueprintId);
    if (!blueprint) return res.status(404).json({ error: "Blueprint not found" });

    const settings = await getGameSettings();
    const winnerBoost = getWinnerBoostForCompany(company.id);
    const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
    const speedMultiplier = Math.max(
      0.1,
      settings.multipliers.productionSpeedMultiplier
        * Number(winnerBoost && "productionSpeedMultiplier" in winnerBoost ? winnerBoost.productionSpeedMultiplier : 1),
    );
    const productionModifier = getGlobalEventModifier({
      type: "production_modifier",
      target: String(blueprint.category || "all"),
      city: company.city,
    });
    const engineerMultiplier = ceoAdvanced === "engineer" ? 1.15 : 1;
    state.progressHours += Number(hours) * speedMultiplier * Math.max(0.1, 1 + productionModifier) * engineerMultiplier * departmentEffects.blueprintSpeedMultiplier;
    if (state.progressHours >= blueprint.time) {
      state.status = "production_ready";
      state.completedAt = Date.now();
      const updated = await storage.updateCompany(company.id, { ork: company.ork + 1 });
      const gadgetWear = await applyGadgetWear(String(userId), {
        cause: "blueprint_development",
        qualityHint: Number(hours || 1) / Math.max(1, Number(blueprint.time || 1)),
      });
      return res.json({ ...state, company: updated, gadgetWear: gadgetWear.report });
    }

    const gadgetWear = await applyGadgetWear(String(userId), {
      cause: "blueprint_development",
      qualityHint: Number(hours || 1) / Math.max(1, Number(blueprint.time || 1)),
    });
    return res.json({ ...state, gadgetWear: gadgetWear.report });
  });

  app.post("/api/companies/:id/produce", async (req, res) => {
    try {
      await assertFeatureEnabled("production", "Production is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Production is disabled by admin settings" });
    }
    const { userId, parts = [] } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can produce gadgets" });
    const ceoUser = await storage.getUser(company.ownerId);
    const ceoAdvanced = ceoUser ? getAdvancedPersonalityId(ceoUser) : null;

    const state = await syncTutorialBlueprintState(company, companyBlueprints.get(company.id));
    if (!state || state.status !== "production_ready") {
      return res.status(400).json({ error: "Blueprint not ready" });
    }

    const isTutorial = isTutorialCompany(company);
    const tutorialOwnerId = String(company.tutorialOwnerId || company.ownerId);
    if (isTutorial) {
      const unlock = await isTutorialProductionUnlocked(tutorialOwnerId);
      if (!unlock.allowed) {
        return res.status(400).json({ error: "Tutorial production is locked for current tutorial step" });
      }
    }
    const blueprint = isTutorial
      ? buildTutorialBlueprintView()
      : GADGET_BLUEPRINTS.find((b) => b.id === state.blueprintId);
    if (!blueprint) return res.status(404).json({ error: "Blueprint not found" });

    if (!isTutorial) {
      const reqParts = blueprint.production.parts;
      for (const [partType, quantity] of Object.entries(reqParts)) {
        const found = parts.filter((p: any) => p.type === partType).length;
        if (found < quantity) return res.status(400).json({ error: `РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РґРµС‚Р°Р»РµР№ С‚РёРїР° ${partType}` });
      }
    }

    if (isTutorial) {
      try {
        await assertFeatureEnabled(
          "tutorialProductionWithoutParts",
          "Tutorial production without parts is disabled by admin settings",
        );
      } catch (error: any) {
        return res.status(403).json({ error: error?.message || "Tutorial production settings block this action" });
      }
    }

    let gramPayment = null as Awaited<ReturnType<typeof spendGram>> | null;
    if (!isTutorial) {
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      const productionGramCost = Math.max(1, Math.round(Number(blueprint.production.costGram || 1) * departmentEffects.productionCostMultiplier));
      try {
        gramPayment = await spendGram(userId, productionGramCost, `РџСЂРѕРёР·РІРѕРґСЃС‚РІРѕ ${blueprint.name}`);
      } catch (error: any) {
        return res.status(400).json({ error: error?.message || "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ GRAM РґР»СЏ РїСЂРѕРёР·РІРѕРґСЃС‚РІР°" });
      }
    }

    const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
    let quality = isTutorial
      ? 1
      : parts.length
      ? parts.reduce((sum: number, p: any) => sum + (RARITY_QUALITY_MULTIPLIERS[p.rarity as keyof typeof RARITY_QUALITY_MULTIPLIERS] ?? 1), 0) / parts.length
      : 1;
    quality *= 1 + departmentEffects.gadgetQualityBonus;
    if (!isTutorial && ceoAdvanced === "engineer") {
      quality *= 1.05;
    }

    const stats = Object.fromEntries(
      Object.entries(blueprint.baseStats).map(([k, v]) => [k, Number((v * quality).toFixed(2))]),
    );
    if (!isTutorial && ceoAdvanced === "engineer") {
      const keys = Object.keys(stats);
      if (keys.length > 0) {
        const randomStat = keys[Math.floor(Math.random() * keys.length)];
        const current = Number(stats[randomStat] || 0);
        stats[randomStat] = Number((current * 1.05).toFixed(2));
      }
    }

    const basePrice = isTutorial ? TUTORIAL_DEMO_BLUEPRINT.minPrice : blueprint.production.costGram * 10;
    const settings = await getGameSettings();
    const winnerBoost = getWinnerBoostForCompany(company.id);
    const saleBoost = Number(winnerBoost && "salePriceMultiplier" in winnerBoost ? winnerBoost.salePriceMultiplier : 1);
    const demandModifier = getGlobalEventModifier({
      type: "demand_modifier",
      target: String(blueprint.category || "all"),
      city: company.city,
    });
    const priceModifier = getGlobalEventModifier({
      type: "price_modifier",
      target: String(blueprint.category || "all"),
      city: company.city,
    });
    const sellPriceMultiplier = Math.max(
      0.1,
      settings.multipliers.gadgetSellPriceMultiplier * saleBoost * Math.max(0.1, 1 + demandModifier + priceModifier),
    );
    const producedAt = Date.now();
    const ownerSnapshot = await getUserWithGameState(userId);
    const creatorTesting = Number(ownerSnapshot?.game.skills.testing || 0);
    const creatorAttention = Number(ownerSnapshot?.game.skills.attention || 0);
    const gadgetCondition = createGadgetConditionProfile({
      rarity: "Rare",
      quality,
      testing: creatorTesting,
      attention: creatorAttention,
    });
    const gadget: ProducedGadget = {
      id: randomUUID(),
      blueprintId: blueprint.id,
      companyId: company.id,
      name: blueprint.name,
      category: blueprint.category,
      stats,
      quality: Number(quality.toFixed(2)),
      minPrice: isTutorial ? TUTORIAL_DEMO_BLUEPRINT.minPrice : Math.round(basePrice * quality * 0.9 * sellPriceMultiplier),
      maxPrice: isTutorial ? TUTORIAL_DEMO_BLUEPRINT.maxPrice : Math.round(basePrice * quality * 1.4 * sellPriceMultiplier),
      ...gadgetCondition,
      producedAt,
    };

    if (isTutorial) {
      const registrationState = await getRegistrationFlowState(tutorialOwnerId);
      const perfectInterview = Boolean(registrationState?.meta.perfectInterview);
      const exclusiveRewardGranted = Boolean(registrationState?.meta.exclusiveRewardGranted);
      if (perfectInterview && !exclusiveRewardGranted) {
        gadget.isExclusive = true;
        gadget.description = "Прототип лучшего стажера";
      }
    }

    const produced = companyGadgets.get(company.id) ?? [];
    produced.push(gadget);
    companyGadgets.set(company.id, produced);
    registerProductionSignal(String(blueprint.category || "all"), 1);
    let inventoryReward: Record<string, unknown> | null = null;
    if (isTutorial) {
      const tutorialState = await getTutorialState(tutorialOwnerId);
      if (tutorialState?.isActive && !tutorialState.isCompleted) {
        await applyTutorialEvent(tutorialOwnerId, "demo_gadget_produced");
      }

      const registrationState = await getRegistrationFlowState(tutorialOwnerId);
      if (registrationState?.registration.registrationFlow.currentStep === "first_craft") {
        const ownerSnapshot = await getUserWithGameState(tutorialOwnerId);
        if (ownerSnapshot) {
          const rewardItem = buildTutorialInventoryGadget(producedAt, Boolean(gadget.isExclusive));
          applyGameStatePatch(tutorialOwnerId, {
            inventory: [...ownerSnapshot.game.inventory, rewardItem],
          });
          inventoryReward = rewardItem;
          companyGadgets.set(company.id, (companyGadgets.get(company.id) ?? []).filter((item) => item.id !== gadget.id));
        }
        await markRegistrationFirstCraftCompleted(tutorialOwnerId, {
          tutorialCompanyId: company.id,
          exclusiveRewardGranted: Boolean(gadget.isExclusive),
        });
        await completeRegistration(tutorialOwnerId);
        await storage.deleteCompany(company.id);
      }
    }

    const gadgetWear = await applyGadgetWear(String(userId), {
      cause: "production",
      qualityHint: quality,
      severityMultiplier: isTutorial ? 0.7 : 1,
    });
    res.json({
      ...gadget,
      gramSpent: isTutorial ? 0 : blueprint.production.costGram,
      gramBalance: gramPayment?.state.gramBalance ?? null,
      inventoryReward,
      gadgetWear: gadgetWear.report,
    });
  });

  app.post("/api/companies/:id/market/list", async (req, res) => {
    try {
      await assertFeatureEnabled("market", "Market is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Market is disabled by admin settings" });
    }
    const { userId, gadgetId, price, mode = "fixed", durationHours = 2 } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    const membership = await storage.getMemberByUserId(company.id, userId);
    const actorRole = company.ownerId === userId ? "owner" : membership?.role;
    if (!isLeadershipRole(actorRole)) return res.status(403).json({ error: "Только руководящий состав может создавать лоты" });
    if (isTutorialCompany(company)) {
      return res.status(400).json({ error: "Tutorial company cannot list gadgets on market" });
    }

    const produced = companyGadgets.get(company.id) ?? [];
    const gadget = produced.find((g) => g.id === gadgetId);
    if (!gadget) return res.status(404).json({ error: "Gadget not found" });
    // TODO: Apply dynamic gadget price bands when economy.dynamicGadgetPricesEnabled is wired to market analytics.
    if (mode !== "fixed" && mode !== "auction") {
      return res.status(400).json({ error: "mode РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ fixed РёР»Рё auction" });
    }

    if (mode === "auction" && gadget.quality < 2) {
      return res.status(400).json({ error: "РђСѓРєС†РёРѕРЅ РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РґР»СЏ СЂРµРґРєРёС… РіР°РґР¶РµС‚РѕРІ (quality >= 2.0)" });
    }

    if (price < gadget.minPrice || price > gadget.maxPrice) {
      return res.status(400).json({ error: `Р¦РµРЅР°/СЃС‚Р°СЂС‚РѕРІР°СЏ С†РµРЅР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РІ РґРёР°РїР°Р·РѕРЅРµ ${gadget.minPrice}-${gadget.maxPrice}` });
    }

    const normalizedDuration = Math.max(2, Math.min(12, Number(durationHours) || 2));

    const listing: MarketListing = {
      id: randomUUID(),
      gadgetId,
      companyId: company.id,
      companyName: company.name,
      sellerUserId: userId,
      saleType: mode,
      price: mode === "fixed" ? price : undefined,
      startingPrice: mode === "auction" ? price : undefined,
      currentBid: mode === "auction" ? price : undefined,
      currentBidderId: undefined,
      auctionEndsAt: mode === "auction" ? Date.now() + normalizedDuration * 60 * 60 * 1000 : undefined,
      minIncrement: mode === "auction" ? Math.max(10, Math.floor(price * 0.05)) : undefined,
      status: "active",
      createdAt: Date.now(),
      sold: false,
    };

    marketListings.unshift(listing);
    res.json(listing);
  });

  app.get("/api/market", async (_req, res) => {
    try {
      await assertFeatureEnabled("market", "Market is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Market is disabled by admin settings" });
    }
    await settleExpiredAuctions();
    const enriched = marketListings
      .filter((l) => l.status === "active")
      .map((listing) => {
        const gadget = Array.from(companyGadgets.values()).flat().find((g) => g.id === listing.gadgetId);
        return { ...listing, gadget };
      });

    res.json(enriched);
  });

  app.post("/api/market/buy", async (req, res) => {
    try {
      await assertFeatureEnabled("market", "Market is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Market is disabled by admin settings" });
    }
    await settleExpiredAuctions();
    const { listingId, buyerId } = req.body ?? {};
    const listing = marketListings.find((l) => l.id === listingId && l.status === "active");
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.saleType !== "fixed" || !listing.price) {
      return res.status(400).json({ error: "Р­С‚РѕС‚ Р»РѕС‚ РїСЂРѕРґР°РµС‚СЃСЏ С‡РµСЂРµР· Р°СѓРєС†РёРѕРЅ" });
    }

    const buyer = await storage.getUser(buyerId);
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });
    if (buyer.balance < listing.price) return res.status(400).json({ error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ" });
    const buyerMembership = await resolvePlayerCompanyMembership(buyerId);
    if (Date.now() - Number(listing.createdAt || 0) < 5 * 60 * 1000 && buyerMembership?.company?.id !== listing.companyId) {
      return res.status(403).json({ error: "Первые 5 минут купить этот гаджет могут только игроки компании-разработчика" });
    }

    const company = await storage.getCompany(listing.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const settings = await getGameSettings();
    const sellerCeo = await storage.getUser(company.ownerId);
    const sellerAdvanced = sellerCeo ? getAdvancedPersonalityId(sellerCeo) : null;
    const feeRate = getMarketFeeRate(
      company.city,
      settings.economy.commissionsEnabled && settings.economy.taxesEnabled,
    );
    let netIncome = Math.floor(listing.price * (1 - feeRate));
    if (sellerAdvanced === "strategist") {
      netIncome = Math.max(1, Math.floor(netIncome * 1.08));
    }
    const fee = listing.price - netIncome;
    await storage.updateUser(buyer.id, { balance: buyer.balance - listing.price });
    await storage.updateCompany(company.id, { balance: company.balance + netIncome });
    const purchasedGadget = await transferProducedGadgetToPlayerInventory(
      buyerId,
      removeProducedGadget(listing.companyId, listing.gadgetId),
    );
    listing.status = "sold";
    listing.sold = true;
    listing.salePrice = listing.price;

    res.json({ ok: true, fee, netIncome, purchasedGadget });
  });

  app.post("/api/market/bid", async (req, res) => {
    try {
      await assertFeatureEnabled("market", "Market is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Market is disabled by admin settings" });
    }
    await settleExpiredAuctions();
    const { listingId, bidderId, amount } = req.body ?? {};
    const listing = marketListings.find((l) => l.id === listingId && l.status === "active");
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.saleType !== "auction") return res.status(400).json({ error: "РЎС‚Р°РІРєРё РґРѕСЃС‚СѓРїРЅС‹ С‚РѕР»СЊРєРѕ РґР»СЏ Р°СѓРєС†РёРѕРЅР°" });
    if (!listing.auctionEndsAt || listing.auctionEndsAt <= Date.now()) return res.status(400).json({ error: "РђСѓРєС†РёРѕРЅ Р·Р°РІРµСЂС€РµРЅ" });

    const bidder = await storage.getUser(bidderId);
    if (!bidder) return res.status(404).json({ error: "Bidder not found" });
    const bidderMembership = await resolvePlayerCompanyMembership(bidderId);
    if (Date.now() - Number(listing.createdAt || 0) < 5 * 60 * 1000 && bidderMembership?.company?.id !== listing.companyId) {
      return res.status(403).json({ error: "Первые 5 минут участвовать в аукционе могут только игроки компании-разработчика" });
    }

    const minNext = (listing.currentBid ?? listing.startingPrice ?? 0) + (listing.minIncrement ?? 10);
    if (Number(amount) < minNext) {
      return res.status(400).json({ error: `РњРёРЅРёРјР°Р»СЊРЅР°СЏ СЃС‚Р°РІРєР°: ${minNext}` });
    }

    if (bidder.balance < Number(amount)) {
      return res.status(400).json({ error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ РґР»СЏ СЃС‚Р°РІРєРё" });
    }

    listing.currentBid = Number(amount);
    listing.currentBidderId = bidderId;

    res.json({ ok: true, listing });
  });

  app.get("/api/city-contracts/:city", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Companies are disabled by admin settings" });
    }
    const contracts = getContractsByCity(req.params.city);
    res.json(contracts);
  });

  app.post("/api/city-contracts/:contractId/accept", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Companies are disabled by admin settings" });
    }
    const { userId, companyId } = req.body ?? {};
    if (!userId || !companyId) return res.status(400).json({ error: "userId Рё companyId РѕР±СЏР·Р°С‚РµР»СЊРЅС‹" });

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (isTutorialCompany(company)) {
      return res.status(400).json({ error: "Tutorial company cannot accept city contracts" });
    }

    const membership = await storage.getMemberByUserId(companyId, userId);
    if (!membership) return res.status(403).json({ error: "РўРѕР»СЊРєРѕ СѓС‡Р°СЃС‚РЅРёРє РєРѕРјРїР°РЅРёРё РјРѕР¶РµС‚ РїСЂРёРЅСЏС‚СЊ РєРѕРЅС‚СЂР°РєС‚" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "РљРѕРЅС‚СЂР°РєС‚ РЅРµ РЅР°Р№РґРµРЅ" });
    if (contract.status === "completed") return res.status(400).json({ error: "РљРѕРЅС‚СЂР°РєС‚ СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅ" });
    if (contract.assignedCompanyId && contract.assignedCompanyId !== companyId) {
      return res.status(400).json({ error: "РљРѕРЅС‚СЂР°РєС‚ СѓР¶Рµ РїСЂРёРЅСЏС‚ РґСЂСѓРіРѕР№ РєРѕРјРїР°РЅРёРµР№" });
    }

    contract.status = "in_progress";
    contract.assignedCompanyId = companyId;
    res.json(contract);
  });

  app.post("/api/city-contracts/:contractId/deliver", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Companies are disabled by admin settings" });
    }
    const { userId, companyId } = req.body ?? {};
    if (!userId || !companyId) return res.status(400).json({ error: "userId Рё companyId РѕР±СЏР·Р°С‚РµР»СЊРЅС‹" });

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (isTutorialCompany(company)) {
      return res.status(400).json({ error: "Tutorial company cannot deliver city contracts" });
    }

    const membership = await storage.getMemberByUserId(companyId, userId);
    if (!membership) return res.status(403).json({ error: "РўРѕР»СЊРєРѕ СѓС‡Р°СЃС‚РЅРёРє РєРѕРјРїР°РЅРёРё РјРѕР¶РµС‚ СЃРґР°РІР°С‚СЊ РєРѕРЅС‚СЂР°РєС‚" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "РљРѕРЅС‚СЂР°РєС‚ РЅРµ РЅР°Р№РґРµРЅ" });
    if (contract.assignedCompanyId !== companyId) return res.status(400).json({ error: "РљРѕРЅС‚СЂР°РєС‚ РЅРµ Р·Р°РєСЂРµРїР»РµРЅ Р·Р° РІР°С€РµР№ РєРѕРјРїР°РЅРёРµР№" });
    if (contract.status === "completed") return res.status(400).json({ error: "РљРѕРЅС‚СЂР°РєС‚ СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅ" });

    let consumedGadgets: string[] = [];
    let consumedPartsCount = 0;
    if (contract.kind === "parts_supply") {
      const requiredType = String(contract.requiredPartType || "").trim();
      if (!requiredType) {
        return res.status(400).json({ error: "Тип запчастей для контракта не задан" });
      }
      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "User not found" });
      const inventory = [...(snapshot.game.inventory ?? [])];

      const matchingPartIds: string[] = [];
      for (const item of inventory) {
        if (item.type !== "part") continue;
        const partDef = ALL_PARTS[item.id];
        if (!partDef || partDef.type !== requiredType) continue;
        const qty = Math.max(1, Number(item.quantity || 1));
        for (let i = 0; i < qty; i += 1) {
          matchingPartIds.push(item.id);
        }
      }
      if (matchingPartIds.length < contract.requiredQuantity) {
        return res.status(400).json({
          error: `Нужно ${contract.requiredQuantity} запчастей типа ${requiredType}. Доступно: ${matchingPartIds.length}`,
        });
      }

      const toConsume = new Map<string, number>();
      for (const id of matchingPartIds.slice(0, contract.requiredQuantity)) {
        toConsume.set(id, (toConsume.get(id) ?? 0) + 1);
      }
      const nextInventory = [];
      for (const item of inventory) {
        if (item.type !== "part") {
          nextInventory.push(item);
          continue;
        }
        const want = toConsume.get(item.id) ?? 0;
        if (want <= 0) {
          nextInventory.push(item);
          continue;
        }
        const qty = Math.max(1, Number(item.quantity || 1));
        const leftQty = Math.max(0, qty - want);
        toConsume.set(item.id, Math.max(0, want - qty));
        if (leftQty > 0) {
          nextInventory.push({ ...item, quantity: leftQty });
        }
      }
      applyGameStatePatch(userId, { inventory: nextInventory });
      consumedPartsCount = contract.requiredQuantity;
    } else if (contract.kind === "skill_research") {
      const requiredSkill = contract.requiredSkill;
      const requiredPoints = Math.max(0, Number(contract.requiredSkillPoints ?? 0));
      if (!requiredSkill || requiredPoints <= 0) {
        return res.status(400).json({ error: "Параметры контракта по навыкам не заданы" });
      }
      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "User not found" });
      const currentPoints = Math.max(0, Number(snapshot.game.skills?.[requiredSkill] ?? 0));
      if (currentPoints < requiredPoints) {
        return res.status(400).json({
          error: `Недостаточно навыка ${requiredSkill}. Нужно ${requiredPoints}, у вас ${currentPoints}`,
        });
      }
    } else {
      const produced = companyGadgets.get(company.id) ?? [];
      const listedIds = new Set(
        marketListings.filter((listing) => listing.status === "active").map((listing) => listing.gadgetId)
      );
      const eligible = produced.filter(
        (gadget) =>
          gadget.category === contract.category &&
          gadget.quality >= contract.minQuality &&
          !listedIds.has(gadget.id)
      );

      if (eligible.length < contract.requiredQuantity) {
        return res.status(400).json({
          error: `Нужно ${contract.requiredQuantity} гаджет(ов) категории ${contract.category} с качеством от ${contract.minQuality}`,
        });
      }

      const selectedIds = new Set(eligible.slice(0, contract.requiredQuantity).map((gadget) => gadget.id));
      const left = produced.filter((gadget) => !selectedIds.has(gadget.id));
      companyGadgets.set(company.id, left);
      consumedGadgets = Array.from(selectedIds);
    }

    contract.status = "completed";
    contract.completedAt = Date.now();

    const updatedCompany = await storage.updateCompany(company.id, {
      balance: company.balance + contract.rewardMoney,
      ork: company.ork + contract.rewardOrk,
    });

    res.json({
      contract,
      consumedGadgets,
      consumedPartsCount,
      company: updatedCompany,
    });
  });

  app.get("/api/users/:id/advanced-personality", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      unlocked: false,
      levelRequired: null,
      selected: null,
      needsChoice: false,
      options: [],
    });
  });

  app.post("/api/users/:id/advanced-personality", async (req, res) => {
    void req;
    res.status(410).json({ error: "Механика второго характера отключена" });
  });

  app.get("/api/users/:id/profession", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const professionId = getPlayerProfessionId(user);
    res.json({
      unlocked: Number(user.level || 0) >= PROFESSION_UNLOCK_LEVEL,
      levelRequired: PROFESSION_UNLOCK_LEVEL,
      selected: professionId,
      profile: professionId ? getProfessionById(professionId) ?? null : null,
      needsChoice: canSelectProfession(user),
      options: PROFESSIONS,
    });
  });

  app.post("/api/users/:id/profession", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (Number(user.level || 0) < PROFESSION_UNLOCK_LEVEL) {
        return res.status(400).json({ error: `Доступно с уровня ${PROFESSION_UNLOCK_LEVEL}` });
      }
      if (getPlayerProfessionId(user)) {
        return res.status(400).json({ error: "Профессия уже выбрана" });
      }

      const professionId = String(req.body?.professionId || "").trim();
      if (!isProfessionId(professionId)) {
        return res.status(400).json({ error: "Профессия не найдена" });
      }

      const updated = await setPlayerProfession(user.id, professionId);
      res.json({
        ok: true,
        selected: professionId,
        profile: getProfessionById(professionId) ?? null,
        user: serializeSafeUser(updated),
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось выбрать профессию" });
    }
  });

  app.get("/api/companies/:id/mining/status", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (isTutorialCompany(company)) return res.status(400).json({ error: "Tutorial company cannot mine parts" });
      const userId = String(req.query.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const membership = await storage.getMemberByUserId(company.id, userId);
      if (!membership) return res.status(403).json({ error: "Only company members can use mining" });
      const state = companyMiningByCompanyId.get(company.id);
      res.json(buildMiningStatusView(state));
    } catch (error) {
      res.status(500).json({ error: "Failed to get mining status" });
    }
  });

  app.post("/api/companies/:id/mining/start", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (isTutorialCompany(company)) return res.status(400).json({ error: "Tutorial company cannot mine parts" });
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const membership = await storage.getMemberByUserId(company.id, userId);
      if (!membership) return res.status(403).json({ error: "Only company members can start mining" });

      const current = companyMiningByCompanyId.get(company.id);
      const currentStatus = buildMiningStatusView(current);
      if (currentStatus.status === "in_progress" || currentStatus.status === "ready_to_claim") {
        return res.json(currentStatus);
      }

      const requestedPlanId = String(req.body?.planId || COMPANY_MINING_DEFAULT_PLAN_ID);
      const plan = getCompanyMiningPlan(requestedPlanId);
      const startedAt = Date.now();
      const next: CompanyMiningState = {
        companyId: company.id,
        startedByUserId: userId,
        startedAt,
        endsAt: startedAt + plan.durationSeconds * 1000,
        planId: plan.id,
        reward: rollCompanyMiningReward(company.level, plan.id),
      };
      companyMiningByCompanyId.set(company.id, next);
      return res.json(buildMiningStatusView(next));
    } catch (error) {
      res.status(500).json({ error: "Failed to start mining" });
    }
  });

  app.post("/api/companies/:id/mining/claim", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (isTutorialCompany(company)) return res.status(400).json({ error: "Tutorial company cannot mine parts" });
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const membership = await storage.getMemberByUserId(company.id, userId);
      if (!membership) return res.status(403).json({ error: "Only company members can claim mining reward" });
      const state = companyMiningByCompanyId.get(company.id);
      if (!state || state.claimedAt) {
        return res.status(400).json({ error: "No active mining cycle" });
      }
      if (Date.now() < state.endsAt) {
        return res.status(400).json({ error: "Mining is still in progress" });
      }

      state.claimedAt = Date.now();
      companyMiningByCompanyId.delete(company.id);

      res.json({
        ok: true,
        reward: state.reward,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to claim mining reward" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    try {
      await assertFeatureEnabled("chat", "Chat is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Chat is disabled by admin settings" });
    }
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    try {
      await assertFeatureEnabled("chat", "Chat is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Chat is disabled by admin settings" });
    }
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const message = await storage.createMessage(parsed.data);
    res.json(message);
  });

  app.post("/api/admin/reset-db", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      await storage.resetAllData();
      res.sendStatus(200);
    } catch (e) {
      res.status(500).send("Failed to reset database");
    }
  });

  return httpServer;
}
