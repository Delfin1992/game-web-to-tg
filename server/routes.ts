// server/routes.ts
import type { Express } from "express";
import { type Server } from "http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { registerRuntimeSnapshotProvider, storage } from "./storage";
import {
  bindTelegramIdToUser,
  getTelegramIdByUserId,
  getUserIdByTelegramId,
  unbindTelegramByTelegramId,
  unbindTelegramByUserId,
} from "./telegram-bindings";
export {
  bindTelegramIdToUser,
  getTelegramIdByUserId,
  getUserIdByTelegramId,
  unbindTelegramByTelegramId,
  unbindTelegramByUserId,
} from "./telegram-bindings";
import { insertMessageSchema, insertUserSchema, type Company } from "../shared/schema";
import {
  countRegistrationSkillPoints,
  isValidRegistrationSkillsAllocation,
  normalizeRegistrationSkillsAllocation,
  REGISTRATION_INITIAL_SKILL_POINTS,
} from "../shared/registration";
import { GADGET_BLUEPRINTS, getAvailableBlueprints, getBlueprintById, RARITY_QUALITY_MULTIPLIERS, type BlueprintStatus } from "../shared/gadgets";
import {
  applyGameStatePatch,
  applyGadgetWear,
  consumePvpBankBoost,
  createGadgetConditionProfile,
  getEffectiveGadgetPowerScore,
  getEffectiveGadgetStats,
  getCurrencySymbol,
  getUserWithGameState,
  SHOP_ITEMS,
  spendGram,
} from "./game-engine";
import {
  companyBlueprintGlobalOwnerByBlueprintId,
  companyBlueprintWarehouseByCompanyId,
  companyEconomyByCompanyId,
  companyWarehousePartsByCompanyId,
} from "./telegram/state";
import {
  ALL_PARTS,
  getPartById,
  getPartPrice,
  normalizePartQuality,
  rollRandomPartDrop,
  resolvePartDefinition,
  type PartQuality,
  type PartType,
} from "../client/src/lib/parts";
import {
  COMPANY_MINING_DEFAULT_PLAN_ID,
  COMPANY_MINING_PLANS,
  getCompanyMiningPlan,
  type CompanyMiningRewardView,
  type CompanyMiningStatus,
  type CompanyMiningPlanId,
} from "../shared/company-mining";
import { fixEncoding } from "./telegram/helpers";
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
import { appendEconomyAuditEvent } from "./economy-audit";
import { canManageCompanyAssets, COMPANY_ASSET_MANAGER_ERROR } from "./company-security";
import type { GameSettingsPatch } from "../shared/game-settings";
import {
  BALANCE_CONFIG,
  getCompanyCreateCostLocal,
  getLocalPerGrm,
  getMarketFeeRate,
  resolveCityId,
} from "../shared/balance-config";
import {
  WEEKLY_HACKATHON_CONFIG,
  HACKATHON_ALLOWED_PART_TYPES,
  type HackathonPartType,
  type HackathonSabotageType,
} from "../shared/weekly-hackathon";
import {
  applyWeeklyHackathonRewards,
  applyWeeklyHackathonDefense,
  applyWeeklyHackathonSabotage,
  applyWinnerRewardsToCompanies,
  contributeGrmToWeeklyHackathon,
  contributePartToWeeklyHackathon,
  contributeSkillToWeeklyHackathon,
  endWeeklyHackathon,
  formatWeeklyHackathonTop,
  getHackathonRoundView,
  getAvailableHackathonDefenseTypes,
  getAvailableHackathonSabotageTypes,
  getRegisteredHackathonCompany,
  getWeeklyHackathonCompanyScore,
  getWeeklyHackathonPlayerStats,
  getWeeklyHackathonSabotageState,
  getWeeklyHackathonState,
  joinPlayerToWeeklyHackathonTeam,
  getWinnerBoostForCompany,
  registerCompanyForWeeklyHackathon,
  resetWeeklyHackathon,
  startWeeklyHackathon,
  startWeeklyHackathonScheduler,
  upgradeWeeklyHackathonDefenseLevel,
  upgradeWeeklyHackathonSabotageLevel,
  validateHackathonEligibility,
} from "./weekly-hackathon";
import {
  PLAYABLE_PROFESSIONS,
  PROFESSION_UNLOCK_LEVEL,
  getProfessionById,
  isProfessionId,
} from "../shared/professions";
import {
  canSelectProfession,
  getAdvancedPersonalityId,
  getProfessionPromptShown,
  getPlayerProfessionId,
  setPlayerProfession,
} from "./player-meta";
import { canEnterPvp, getPvpAccessMessage } from "./pvp-access";
import {
  generateEvent,
  getCurrentGlobalEvents,
  getGlobalEventModifier,
  getGlobalEventsHistory,
  refreshGlobalEventsCache,
} from "./game/events/event-engine";
import { startGlobalEventScheduler } from "./game/events/event-scheduler";
import { registerProductionSignal } from "./game/events/event-history";
import { getPvpShopRotation, PVP_DUEL_CONFIG } from "../shared/pvp-duel";
import {
  clearPendingPvpBoosts,
  clearPendingPvpTactics,
  getPendingPvpBoosts,
  getPendingPvpTactics,
  getPvpBoostCatalog,
  consumePendingPvpResult,
  getPvpQueueState,
  leavePvpQueue,
  type PvpDuelResult,
  purchasePvpBoost,
  selectPvpTactic,
  settleCompletedPvpDuels,
  startActivePvpDuelNow,
  queuePlayerForPvp,
  runPvpMatchmaking,
  updatePvpHeartbeat,
} from "./pvp-duel";
import { startPvpTestBotLoop } from "./pvp-test-bot";
import {
  buyStockAsset,
  declareCompanyDividends,
  getCompanyDividendSnapshot,
  getStockMarketSnapshot,
  sellStockAsset,
} from "./stock-exchange";
import { getDepartmentEffects, reconcileCompanyEconomy, type CompanyDepartmentEffects, type CompanyEconomyLike } from "../client/src/lib/companySystem";
import { assignCompanyMemberDepartment, clearCompanyStaffing, getCompanyStaffingSnapshot } from "./company-staffing";
import { type CompanyDepartmentKey } from "../shared/company-staffing";
import {
  EXCLUSIVE_RESEARCH_SKILLS,
  EXCLUSIVE_UPGRADE_BASE_COST_GRM,
  EXCLUSIVE_UPGRADE_BASE_DURATION_MINUTES,
  EXCLUSIVE_UPGRADE_MAX_LEVEL,
  EXCLUSIVE_UPGRADE_REQUIRED_GADGETS,
  EXCLUSIVE_UPGRADE_RARITY_SCORE,
  EXCLUSIVE_UPGRADE_REQUIRED_PARTS,
  EXCLUSIVE_UPGRADE_SUCCESS_MULTIPLIER,
  getExclusiveResearchState,
  type ExclusiveBlueprintDefinition,
  type ExclusiveProjectState,
  type ExclusiveResearchMap,
  type ExclusiveSeedPart,
} from "../shared/exclusive-gadgets";
import { getAdminPassword, warnIfAdminPasswordMissing } from "./shared/env";
import { registerRegistrationRoutes } from "./routes/registration";
import { registerPlayerRoutes } from "./routes/player";
import { registerPvpRoutes } from "./routes/pvp";
import { registerHackathonRoutes } from "./routes/hackathon";
import { registerDailyQuestRoutes } from "./routes/daily-quests";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerHomeDashboardRoutes } from "./routes/home-dashboard";
import {
  buildCompanyIpoEligibility,
  buildCompanyIpoOptions,
  buildCompanyStockPreview,
  launchCompanyIpo,
  recordCompanyBlueprintCompleted,
  recordCompanyHackathonParticipation,
  recordCompanyHackathonPlacement,
  recordCompanyProductionClaim,
  setCompanyEconomyRuntimeState,
  startCompanyStockDailyScheduler,
} from "./services/company-stock-service";
import { trackDailyQuestEvent } from "./daily-quests/service";
import {
  calculateCompanySkillContribution,
  ensureCompanyMemberStatsSeeded,
  getCompanyMemberContributionStats,
  getTaskContributions,
  markCompanyContractCompleted,
  markCompanyRepairCompleted,
  recordCompanyMoneyContribution,
  recordCompanyPartsContribution,
  recordCompanyTaskContribution,
  type CompanyContributionSkillType,
} from "./company-coop";
import {
  createNotification,
  createNotifications,
} from "./notifications/service";

type CompanyBlueprintState = {
  id?: string;
  companyId?: string;
  blueprintId: string;
  status: BlueprintStatus;
  projectStatus?: "active" | "completed" | "cancelled";
  progressHours: number;
  startedByUserId?: string;
  requiredPoints?: Partial<Record<"coding" | "design" | "analytics" | "testing" | "attention", number>>;
  currentPoints?: Partial<Record<"coding" | "design" | "analytics" | "testing" | "attention", number>>;
  lastContribution?: Partial<Record<"coding" | "design" | "analytics" | "testing" | "attention", number>>;
  participantUserIds?: string[];
  tickSeconds?: number;
  estimatedFinishAt?: number | null;
  lastTickAt?: number;
  lastNotifiedStatus?: "in_progress" | "production_ready" | null;
  startedAt?: number;
  completedAt?: number;
};

type CompanyProductionOrder = {
  id: string;
  companyId: string;
  kind: "standard" | "exclusive";
  blueprintId: string;
  blueprintName: string;
  baseName?: string;
  category: string;
  quantity: number;
  startedAt: number;
  readyAt: number;
  status: "in_progress" | "ready_to_claim";
  quality: number;
  stats: Record<string, number>;
  minPrice: number;
  maxPrice: number;
  gramCost: number;
  isExclusive?: boolean;
  exclusiveLevel?: number;
  exclusiveBonusType?: "finance" | "xp" | "skills";
  exclusiveBonusValue?: number;
  exclusiveBonusLabel?: string;
};

type ProducedGadget = {
  id: string;
  blueprintId: string;
  companyId: string;
  name: string;
  title?: string;
  baseName?: string;
  category: string;
  branch?: string;
  generation?: number;
  rarity?: string;
  requiredLevel?: number;
  description?: string;
  stats: Record<string, number>;
  companyEmoji?: string | null;
  isCompanyMade?: boolean;
  quality: number;
  wear?: number;
  wearRate?: number;
  repairCost?: number;
  basePrice?: number;
  productionCostGrm?: number;
  auctionMinPrice?: number;
  auctionMaxPrice?: number;
  productionPartsRequirement?: Record<string, number>;
  pvpRoundBonus?: any;
  specialEffect?: string | null;
  hashPower?: number;
  incomePerCycle?: number;
  powerCostPerCycle?: number;
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
  exclusiveLevel?: number;
  exclusiveBonusType?: "finance" | "xp" | "skills";
  exclusiveBonusValue?: number;
  exclusiveBonusLabel?: string;
  acquisitionSource?: "auction" | "company_production" | "reward" | "other";
  acquiredAt?: number;
  lastAuctionPurchaseAt?: number | null;
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

function getLeadingCompanyEmoji(name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] || "";
  return isValidCompanyEmojiInput(firstToken) ? firstToken : "";
}

function buildProducedCompanyGadgetName(companyName: string, gadgetName: string) {
  const emoji = getLeadingCompanyEmoji(companyName);
  return emoji ? `${emoji} ${String(gadgetName || "").trim()}`.trim() : String(gadgetName || "").trim();
}

function normalizeProducedCategory(category: string) {
  const value = String(category || "").trim().toLowerCase();
  if (value === "smartphone") return "smartphones";
  if (value === "smartwatch") return "smartwatches";
  if (value === "tablet") return "tablets";
  if (value === "laptop") return "laptops";
  if (value === "asic") return "asic_miners";
  return value || "smartphones";
}

function getExclusiveRequiredPartTypeForCategory(category: string) {
  const normalized = normalizeProducedCategory(category);
  if (normalized === "smartphones") return "processor";
  if (normalized === "smartwatches") return "strap";
  if (normalized === "tablets") return "display";
  if (normalized === "laptops") return "storage";
  if (normalized === "asic_miners") return "asic_chip";
  return "processor";
}

function isPartCompatibleWithExclusiveCategory(category: string, partType: string) {
  const normalized = normalizeProducedCategory(category);
  const compatible: Record<string, string[]> = {
    smartphones: ["processor", "display", "camera", "battery", "case", "motherboard"],
    smartwatches: ["processor", "display", "strap", "battery", "case", "controller"],
    tablets: ["processor", "memory", "display", "battery", "case", "storage", "camera"],
    laptops: ["processor", "memory", "display", "battery", "motherboard", "cooling", "case", "storage"],
    asic_miners: ["asic_chip", "cooling", "power", "case", "controller"],
  };
  return (compatible[normalized] ?? compatible.smartphones).includes(String(partType || "").trim());
}

function getProducedGadgetExclusiveLevel(gadget: Partial<ProducedGadget> | null | undefined) {
  return Math.max(0, Number(gadget?.exclusiveLevel || 0));
}

function getExclusiveUpgradeCostGrm(category: string, nextLevel: number) {
  const normalized = normalizeProducedCategory(category);
  const base = EXCLUSIVE_UPGRADE_BASE_COST_GRM[normalized] ?? 2000;
  return Math.round(base * (1 + Math.max(0, nextLevel - 1) * 0.55));
}

function getExclusiveUpgradeDurationMinutes(category: string, nextLevel: number) {
  const normalized = normalizeProducedCategory(category);
  const base = EXCLUSIVE_UPGRADE_BASE_DURATION_MINUTES[normalized] ?? 30;
  return Math.round(base * Math.pow(1.6, Math.max(0, nextLevel - 1)));
}

function getExclusiveUpgradeSuccessChance(parts: Array<{ rarity?: string }>, nextLevel: number) {
  const rarityScore = parts.reduce((sum, item) => sum + Number(EXCLUSIVE_UPGRADE_RARITY_SCORE[String(item?.rarity || "Common") as keyof typeof EXCLUSIVE_UPGRADE_RARITY_SCORE] || 0), 0);
  const base = 0.38 - Math.max(0, nextLevel - 1) * 0.06;
  return Math.max(0.35, Math.min(0.9, Number((base + rarityScore / 100).toFixed(2))));
}

type MarketListing = {
  id: string;
  listingKind: "gadget" | "part";
  gadgetId?: string;
  partRef?: string;
  partId?: string;
  partName?: string;
  partRarity?: string;
  partType?: string;
  companyId: string;
  companyName: string;
  sellerUserId: string;
  saleType: "fixed" | "auction";
  price?: number;
  startingPrice?: number;
  currentBid?: number;
  currentBidderId?: string;
  auctionEndsAt?: number;
  auctionDurationHours?: number;
  minIncrement?: number;
  status: "active" | "sold" | "expired";
  salePrice?: number;
  createdAt: number;
  sold: boolean;
};

const AUCTION_POST_BID_EXTENSION_MINUTES = 15;

type CityContractStatus = "open" | "in_progress" | "completed";
type CityContractKind = "gadget_delivery" | "parts_supply" | "skill_research" | "staged_skill";

type CityContractStage = {
  index: number;
  title: string;
  skillType: CompanyContributionSkillType;
  target: number;
  progress: number;
  contributions: Array<{
    id: string;
    userId: string;
    username: string;
    value: number;
    skillType: CompanyContributionSkillType;
    createdAt: number;
  }>;
  completedAt?: number;
};

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
  currentStageIndex?: number;
  stages?: CityContractStage[];
  participantRewardMoney?: number;
  participantRewardXp?: number;
  participantBaseMoney?: number;
  participantBaseXp?: number;
  participantRewardsGranted?: boolean;
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

type BlueprintResearchSkillKey = "coding" | "design" | "analytics" | "testing" | "attention";
type BlueprintResearchPoints = Partial<Record<BlueprintResearchSkillKey, number>>;

const BLUEPRINT_RESEARCH_SKILLS: BlueprintResearchSkillKey[] = ["coding", "design", "analytics", "testing", "attention"];
const BLUEPRINT_RESEARCH_TICK_SECONDS = 5;
const BLUEPRINT_RESEARCH_PARTICIPANT_SYNERGY = [1, 1.03, 1.06, 1.08, 1.1] as const;

const BLUEPRINT_RESEARCH_DEPARTMENT_BOOSTS: Record<
  CompanyDepartmentKey,
  Partial<Record<BlueprintResearchSkillKey, number>>
> = {
  researchAndDevelopment: { coding: 0.12, analytics: 0.08, testing: 0.06 },
  production: { coding: 0.08, testing: 0.08, attention: 0.05 },
  marketing: { design: 0.12, analytics: 0.06, attention: 0.04 },
  finance: { analytics: 0.12, attention: 0.05, design: 0.03 },
  infrastructure: { testing: 0.12, attention: 0.08, coding: 0.04 },
};

const BLUEPRINT_RESEARCH_PROFESSION_BOOSTS: Record<
  string,
  Partial<Record<BlueprintResearchSkillKey, number>>
> = {
  backend: { coding: 0.04, testing: 0.02 },
  designer: { design: 0.04, attention: 0.02 },
  analyst: { analytics: 0.04, coding: 0.02 },
  qa: { testing: 0.04, attention: 0.02 },
  devops: { coding: 0.03, testing: 0.03, attention: 0.02 },
};

const companyBlueprints = new Map<string, CompanyBlueprintState>();
const companyGadgets = new Map<string, ProducedGadget[]>();
const exclusiveProjectByCompanyId = new Map<string, ExclusiveProjectState>();
const exclusiveCatalogByCompanyId = new Map<string, ExclusiveBlueprintDefinition[]>();
const companyProductionOrders = new Map<string, CompanyProductionOrder>();

const STANDARD_PRODUCTION_BASE_SECONDS: Record<string, number> = {
  smartphones: 12 * 60,
  smartwatches: 10 * 60,
  tablets: 16 * 60,
  laptops: 22 * 60,
  asic_miners: 28 * 60,
};

const EXCLUSIVE_PRODUCTION_BASE_SECONDS: Record<string, number> = {
  smartphones: 18 * 60,
  smartwatches: 15 * 60,
  tablets: 24 * 60,
  laptops: 30 * 60,
  asic_miners: 36 * 60,
};

function getCompanyWarehouseParts(companyId: string) {
  const current = companyWarehousePartsByCompanyId.get(companyId) ?? [];
  const normalized = normalizeCompanyWarehouseParts(current);
  if (normalized.changed) {
    companyWarehousePartsByCompanyId.set(companyId, normalized.parts);
  }
  return normalized.parts;
}

function setCompanyWarehouseParts(companyId: string, parts: any[]) {
  companyWarehousePartsByCompanyId.set(companyId, normalizeCompanyWarehouseParts(parts).parts);
}

type NormalizedCompanyWarehousePart = {
  id: string;
  name: string;
  title: string;
  type: PartType;
  partType: PartType;
  rarity: PartQuality;
  quality: PartQuality;
  deviceCategory: string;
  gadgetCategory: string;
  quantity: number;
};

function normalizeCompanyWarehousePart(item: any): NormalizedCompanyWarehousePart | null {
  const definition = resolvePartDefinition({
    id: item?.id,
    type: item?.type,
    partType: item?.partType,
    rarity: item?.rarity,
    quality: item?.quality,
    deviceCategory: item?.deviceCategory,
  });
  if (!definition) return null;
  const quantity = Math.max(1, Number(item?.quantity || 1));
  return {
    id: definition.id,
    name: definition.name,
    title: definition.title,
    type: definition.type,
    partType: definition.partType,
    rarity: definition.quality,
    quality: definition.quality,
    deviceCategory: definition.deviceCategory,
    gadgetCategory: definition.gadgetCategory,
    quantity,
  };
}

function normalizeCompanyWarehouseParts(parts: any[]) {
  const normalized: NormalizedCompanyWarehousePart[] = [];
  let changed = false;
  for (const item of Array.isArray(parts) ? parts : []) {
    const nextItem = normalizeCompanyWarehousePart(item);
    if (!nextItem) {
      changed = true;
      continue;
    }
    if (
      String(item?.id || "") !== nextItem.id
      || String(item?.rarity || "") !== nextItem.rarity
      || String(item?.quality || "") !== nextItem.quality
      || String(item?.type || "") !== nextItem.type
      || String(item?.deviceCategory || "") !== nextItem.deviceCategory
      || String(item?.gadgetCategory || "") !== nextItem.gadgetCategory
      || String(item?.name || "") !== nextItem.name
    ) {
      changed = true;
    }
    const existing = normalized.find((entry) => entry.id === nextItem.id);
    if (existing) {
      existing.quantity += nextItem.quantity;
      changed = true;
      continue;
    }
    normalized.push(nextItem);
  }
  return { parts: normalized, changed };
}

function normalizeSelectedWarehousePart(part: any, fallbackType?: string) {
  const definition = resolvePartDefinition({
    id: part?.id,
    type: part?.type ?? fallbackType,
    partType: part?.partType,
    rarity: part?.rarity,
    quality: part?.quality,
    deviceCategory: part?.deviceCategory,
  });
  if (!definition) return null;
  return {
    id: definition.id,
    name: definition.name,
    title: definition.title,
    type: definition.type,
    partType: definition.partType,
    rarity: definition.quality,
    quality: definition.quality,
    deviceCategory: definition.deviceCategory,
    gadgetCategory: definition.gadgetCategory,
  };
}

function getBlueprintRecipeRequirements(blueprint: { productionRecipe?: Array<{ partType: string; quality: string; quantity: number }>; production?: { parts?: Record<string, number> } }) {
  if (Array.isArray(blueprint.productionRecipe) && blueprint.productionRecipe.length) {
    return blueprint.productionRecipe.map((item) => ({
      partType: String(item.partType) as PartType,
      quality: normalizePartQuality(item.quality) as PartQuality,
      quantity: Math.max(1, Number(item.quantity || 1)),
    }));
  }
  return Object.entries(blueprint.production?.parts ?? {}).map(([partType, quantity]) => ({
    partType: String(partType) as PartType,
    quality: "Common" as PartQuality,
    quantity: Math.max(1, Number(quantity || 1)),
  }));
}

function storeCompanyBlueprintForCompany(companyId: string, blueprintId: string) {
  const normalizedId = String(blueprintId || "").trim();
  if (!normalizedId) return;
  const current = companyBlueprintWarehouseByCompanyId.get(companyId) ?? new Set<string>();
  current.add(normalizedId);
  companyBlueprintWarehouseByCompanyId.set(companyId, current);
}

function rememberGlobalBlueprintOwner(company: Company, blueprintId: string) {
  const normalizedId = String(blueprintId || "").trim();
  if (!normalizedId) return null;
  const current = companyBlueprintGlobalOwnerByBlueprintId.get(normalizedId);
  if (current?.companyId) return current;
  const companyEmoji = getLeadingCompanyEmoji(company.name);
  const owner = {
    companyId: company.id,
    companyName: company.name,
    companyEmoji: companyEmoji || null,
  };
  companyBlueprintGlobalOwnerByBlueprintId.set(normalizedId, owner);
  return owner;
}

function getGlobalBlueprintOwner(blueprintId: string) {
  return companyBlueprintGlobalOwnerByBlueprintId.get(String(blueprintId || "").trim()) ?? null;
}

function removeCompanyWarehousePartForMarket(companyId: string, ref: string) {
  const [partId = "", rarity = "Common"] = String(ref || "").split("::");
  if (!partId) return null;
  const next = [...getCompanyWarehouseParts(companyId)];
  const index = next.findIndex((item) => String(item?.id || "") === partId && String(item?.rarity || "Common") === rarity);
  if (index < 0) return null;
  const item = next[index];
  const available = Math.max(1, Number(item?.quantity || 1));
  const removed = {
    id: partId,
    name: String(item?.name || getPartById(partId)?.name || partId),
    type: String(item?.type || getPartById(partId)?.type || "unknown"),
    rarity: String(item?.rarity || rarity),
    quantity: 1,
  };
  if (available <= 1) next.splice(index, 1);
  else next[index] = { ...item, quantity: available - 1 };
  setCompanyWarehouseParts(companyId, next);
  return removed;
}

function restoreCompanyWarehousePartFromMarket(
  companyId: string,
  part: { id: string; name: string; type: string; rarity: string; quantity?: number } | null | undefined,
) {
  if (!part?.id) return;
  const next = [...getCompanyWarehouseParts(companyId)];
  const existingIndex = next.findIndex((item) => String(item?.id || "") === part.id && String(item?.rarity || "Common") === String(part.rarity || "Common"));
  if (existingIndex >= 0) {
    next[existingIndex] = {
      ...next[existingIndex],
      quantity: Math.max(1, Number(next[existingIndex]?.quantity || 1)) + Math.max(1, Number(part.quantity || 1)),
    };
  } else {
    next.push({
      id: part.id,
      name: part.name,
      title: String(getPartById(part.id)?.title || part.name),
      type: part.type as PartType,
      partType: part.type as PartType,
      rarity: part.rarity as PartQuality,
      quality: part.rarity as PartQuality,
      deviceCategory: String(getPartById(part.id)?.deviceCategory || ""),
      gadgetCategory: String(getPartById(part.id)?.gadgetCategory || ""),
      quantity: Math.max(1, Number(part.quantity || 1)),
    });
  }
  setCompanyWarehouseParts(companyId, next);
}

function buildPlayerInventoryPartFromMarket(part: { id: string; name: string; rarity: string; type: string }) {
  const partDef = getPartById(part.id);
  return {
    id: part.id,
    name: part.name,
    type: "part" as const,
    rarity: part.rarity,
    quantity: 1,
    stats: partDef?.stats ?? {},
  };
}

function buildCompanyWarehouseUnitRefs(
  companyId: string,
  requiredPartType?: string | null,
): Array<{ ref: string; id: string; rarity: string; type: string }> {
  const parts = getCompanyWarehouseParts(companyId);
  const refs: Array<{ ref: string; id: string; rarity: string; type: string }> = [];
  for (const item of parts) {
    const itemType = String(item?.type || getPartById(item?.id)?.type || "");
    if (requiredPartType && itemType !== requiredPartType) continue;
    const quantity = Math.max(1, Number(item?.quantity || 1));
    const rarity = String(item?.rarity || getPartById(item?.id)?.rarity || "Common");
    const id = String(item?.id || "");
    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      refs.push({
        ref: `${id}::${rarity}::${unitIndex + 1}`,
        id,
        rarity,
        type: itemType,
      });
    }
  }
  return refs;
}

function consumeCompanyWarehousePartRefs(companyId: string, partRefs: string[]) {
  const consumeCounter = new Map<string, number>();
  for (const ref of partRefs) {
    const [id = "", rarity = "Common"] = String(ref || "").split("::");
    if (!id) continue;
    const key = `${id}::${rarity}`;
    consumeCounter.set(key, (consumeCounter.get(key) ?? 0) + 1);
  }

  const next = [...getCompanyWarehouseParts(companyId)];
  for (let index = 0; index < next.length; index += 1) {
    const item = next[index];
    const key = `${String(item?.id || "")}::${String(item?.rarity || "Common")}`;
    const toConsume = consumeCounter.get(key) ?? 0;
    if (toConsume <= 0) continue;
    const available = Math.max(1, Number(item?.quantity || 1));
    const left = Math.max(0, available - toConsume);
    consumeCounter.set(key, Math.max(0, toConsume - available));
    if (left > 0) {
      next[index] = { ...item, quantity: left };
      continue;
    }
    next.splice(index, 1);
    index -= 1;
  }

  const remaining = Array.from(consumeCounter.values()).some((value) => value > 0);
  if (remaining) {
    throw new Error("Не удалось списать выбранные детали со склада компании");
  }
  setCompanyWarehouseParts(companyId, next);
}

async function getCompanyContractSkillTotal(
  companyId: string,
  requiredSkill: "coding" | "design" | "analytics" | "testing",
) {
  const members = await storage.getCompanyMembers(companyId);
  const memberIds = Array.from(new Set(members.map((member) => String(member.userId || "")).filter(Boolean)));
  let total = 0;
  for (const memberId of memberIds) {
    const snapshot = await getUserWithGameState(memberId);
    total += Math.max(0, Number((snapshot?.game as any)?.skills?.[requiredSkill] ?? 0));
  }
  return total;
}

function createEmptyExclusiveResearchMap(): ExclusiveResearchMap {
  return {
    coding: 0,
    testing: 0,
    analytics: 0,
    design: 0,
    attention: 0,
  };
}

function createEmptyBlueprintResearchPoints(): BlueprintResearchPoints {
  return {
    coding: 0,
    design: 0,
    analytics: 0,
    testing: 0,
    attention: 0,
  };
}

function buildBlueprintResearchRequirements(blueprint: any): BlueprintResearchPoints {
  const requirements = blueprint?.requirements ?? {};
  const stats = blueprint?.baseStats ?? {};
  const next = createEmptyBlueprintResearchPoints();

  next.coding = Math.max(
    0,
    Math.round(
      Math.max(
        Number(requirements.coding ?? 0),
        Number(stats.coding ?? 0) > 0 ? Number(stats.coding ?? 0) * 34 : 0,
      ),
    ),
  );
  next.design = Math.max(
    0,
    Math.round(
      Math.max(
        Number(requirements.design ?? 0),
        Number(stats.design ?? 0) > 0 ? Number(stats.design ?? 0) * 34 : 0,
      ),
    ),
  );
  next.analytics = Math.max(
    0,
    Math.round(
      Math.max(
        Number(requirements.analytics ?? 0),
        Number(stats.analytics ?? 0) > 0 ? Number(stats.analytics ?? 0) * 32 : 0,
      ),
    ),
  );
  next.testing = Math.max(0, Math.round(Number(stats.testing ?? 0) > 0 ? Number(stats.testing ?? 0) * 36 : 0));
  next.attention = Math.max(0, Math.round(Number(stats.attention ?? 0) > 0 ? Number(stats.attention ?? 0) * 30 : 0));
  return next;
}

function getBlueprintResearchSynergyMultiplier(participantCount: number) {
  if (participantCount <= 1) return BLUEPRINT_RESEARCH_PARTICIPANT_SYNERGY[0];
  if (participantCount === 2) return BLUEPRINT_RESEARCH_PARTICIPANT_SYNERGY[1];
  if (participantCount === 3) return BLUEPRINT_RESEARCH_PARTICIPANT_SYNERGY[2];
  if (participantCount === 4) return BLUEPRINT_RESEARCH_PARTICIPANT_SYNERGY[3];
  return BLUEPRINT_RESEARCH_PARTICIPANT_SYNERGY[4];
}

function calculateBlueprintResearchPercent(required: BlueprintResearchPoints, current: BlueprintResearchPoints) {
  const requiredEntries = BLUEPRINT_RESEARCH_SKILLS
    .map((skill) => ({ skill, required: Math.max(0, Number(required[skill] ?? 0)) }))
    .filter((entry) => entry.required > 0);
  if (!requiredEntries.length) return 100;
  const totalRequired = requiredEntries.reduce((sum, entry) => sum + entry.required, 0);
  const totalCurrent = requiredEntries.reduce((sum, entry) => sum + Math.min(entry.required, Math.max(0, Number(current[entry.skill] ?? 0))), 0);
  return Math.max(0, Math.min(100, Math.round((totalCurrent / totalRequired) * 100)));
}

function isBlueprintResearchComplete(required: BlueprintResearchPoints, current: BlueprintResearchPoints) {
  return BLUEPRINT_RESEARCH_SKILLS.every((skill) => {
    const needed = Math.max(0, Number(required[skill] ?? 0));
    if (needed <= 0) return true;
    return Math.max(0, Number(current[skill] ?? 0)) >= needed;
  });
}

function estimateBlueprintResearchFinishAt(
  required: BlueprintResearchPoints,
  current: BlueprintResearchPoints,
  perTick: BlueprintResearchPoints,
  tickSeconds: number,
) {
  const now = Date.now();
  let slowestTicks: number | null = null;

  for (const skill of BLUEPRINT_RESEARCH_SKILLS) {
    const needed = Math.max(0, Number(required[skill] ?? 0));
    if (needed <= 0) continue;
    const have = Math.max(0, Number(current[skill] ?? 0));
    if (have >= needed) continue;
    const gain = Math.max(0, Number(perTick[skill] ?? 0));
    if (gain <= 0) return null;
    const ticksLeft = Math.ceil((needed - have) / gain);
    slowestTicks = slowestTicks === null ? ticksLeft : Math.max(slowestTicks, ticksLeft);
  }

  if (slowestTicks === null) return now;
  return now + slowestTicks * Math.max(1, tickSeconds) * 1000;
}

function findUserActiveBlueprintResearch(userId: string, excludeCompanyId?: string) {
  for (const [companyId, state] of companyBlueprints.entries()) {
    if (excludeCompanyId && companyId === excludeCompanyId) continue;
    if (state.status !== "in_progress" || state.projectStatus !== "active") continue;
    if ((state.participantUserIds ?? []).includes(userId)) return state;
  }
  return null;
}

async function assertBlueprintResearchAvailability(userId: string, companyId: string) {
  const otherProject = findUserActiveBlueprintResearch(userId, companyId);
  if (otherProject) {
    throw new Error("Игрок уже участвует в другой разработке чертежа");
  }
  const pvpState = getPvpQueueState(userId);
  if (pvpState.activeDuel) {
    throw new Error("Нельзя присоединиться к разработке во время активной PvP-дуэли");
  }
}

async function sendTelegramBotText(chatId: number, text: string, replyMarkup?: Record<string, unknown>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !Number.isFinite(chatId) || chatId <= 0) return;
  try {
    const safeText = fixEncoding(text);
    const safeReplyMarkup = replyMarkup ? JSON.parse(JSON.stringify(replyMarkup, (_key, value) => (typeof value === "string" ? fixEncoding(value) : value))) : undefined;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        ...(safeReplyMarkup ? { reply_markup: safeReplyMarkup } : {}),
      }),
    });
  } catch (error) {
    console.warn("Failed to send blueprint research telegram message:", error);
  }
}

function formatMarketAmount(value: number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(".", ",")}m`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2).replace(".", ",")}k`;
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  return `${sign}${abs.toFixed(2).replace(".", ",")}`;
}

function formatAuctionLotTitle(listing: MarketListing) {
  if (listing.listingKind === "part") {
    return String(listing.partName || ALL_PARTS[String(listing.partId || "") as keyof typeof ALL_PARTS]?.name || "Запчасть");
  }
  return String(listing.gadgetId || "гаджет");
}

async function notifyCompanyBlueprintResearchStarted(company: any, blueprint: any, participantUserIds: string[]) {
  const members = await storage.getCompanyMembers(company.id);
  for (const member of members) {
    if (participantUserIds.includes(member.userId)) continue;
    const telegramId = Number(getTelegramIdByUserId(member.userId) || 0);
    if (!telegramId) continue;
    await sendTelegramBotText(
      telegramId,
      [
        `🧪 CEO начал разработку нового чертежа: ${blueprint.name}`,
        `🏢 Компания: ${company.name}`,
        "Чтобы ускорить исследование, присоединяйся к проекту и вложи свои навыки в разработку.",
      ].join("\n"),
      {
        inline_keyboard: [
          [{ text: "🤝 Присоединиться", callback_data: "company:bp_join" }],
          [{ text: "📈 Открыть прогресс", callback_data: "company:bp_progress_live" }],
          [{ text: "Позже", callback_data: "company:bureau" }],
        ],
      },
    );
  }
}

async function notifyCompanyBlueprintResearchCompleted(company: any, state: CompanyBlueprintState, blueprint: any) {
  recordCompanyBlueprintCompleted(company.id);
  const notified = new Set<string>([company.ownerId, ...(state.participantUserIds ?? [])]);
  for (const userId of notified) {
    const telegramId = Number(getTelegramIdByUserId(userId) || 0);
    if (!telegramId) continue;
    await sendTelegramBotText(
      telegramId,
      [
        `✅ Разработка завершена: ${blueprint?.name ?? state.blueprintId}`,
        `🏢 Компания: ${company.name}`,
        "Чертёж готов к производству. CEO уже может запускать выпуск партии.",
      ].join("\n"),
    );
  }

  const users = await storage.getUsers();
  const announcement = [
    "📣 НОВЫЙ ЧЕРТЁЖ В МИРЕ ИГРЫ",
    "━━━━━━━━━━━━━━",
    `Разработан гаджет: ${String((blueprint?.name ?? state.blueprintId) || "Новый гаджет").trim()}`,
    `Компания: ${String(company.name || "").trim()}`,
  ].join("\n");
  for (const user of users) {
    if (notified.has(user.id) || isPvpBotUsername(user.username)) continue;
    const telegramId = Number(getTelegramIdByUserId(user.id) || 0);
    if (!telegramId) continue;
    await sendTelegramBotText(telegramId, announcement);
  }
}

async function computeBlueprintResearchTick(company: any, state: CompanyBlueprintState) {
  const staffing = await getCompanyStaffingSnapshot(company.id);
  const staffingByUserId = new Map(staffing.members.map((member) => [member.userId, member.assignedDepartment ?? null] as const));
  const members = await storage.getCompanyMembers(company.id);
  const memberIds = new Set(members.map((member) => member.userId));
  const activeParticipants = Array.from(new Set([company.ownerId, ...(state.participantUserIds ?? [])])).filter((userId) => memberIds.has(userId));
  const synergy = getBlueprintResearchSynergyMultiplier(activeParticipants.length);
  const winnerBoost = getWinnerBoostForCompany(company.id);
  const winnerResearchMultiplier = typeof winnerBoost?.researchSpeedMultiplier === "number" ? winnerBoost.researchSpeedMultiplier : 1;
  const next = createEmptyBlueprintResearchPoints();

  for (const userId of activeParticipants) {
    const snapshot = await getUserWithGameState(userId);
    if (!snapshot) continue;
    const skills = ((snapshot.game as any)?.skills ?? {}) as Record<string, number>;
    const professionId = getPlayerProfessionId(snapshot.user);
    const advanced = getAdvancedPersonalityId(snapshot.user);
    const department = staffingByUserId.get(userId) as CompanyDepartmentKey | null | undefined;
    for (const skill of BLUEPRINT_RESEARCH_SKILLS) {
      const needed = Math.max(0, Number(state.requiredPoints?.[skill] ?? 0));
      if (needed <= 0) continue;
      const base = Math.max(0, Number(skills[skill] ?? 0));
      if (base <= 0) continue;
      const departmentMultiplier = 1 + Math.max(0, Number(BLUEPRINT_RESEARCH_DEPARTMENT_BOOSTS[department as CompanyDepartmentKey]?.[skill] ?? 0));
      const professionMultiplier = 1 + Math.max(0, Number(BLUEPRINT_RESEARCH_PROFESSION_BOOSTS[String(professionId || "")]?.[skill] ?? 0));
      const advancedMultiplier = advanced === "engineer" ? 1.05 : advanced === "strategist" ? 1.03 : 1;
      next[skill] = Number(((next[skill] ?? 0) + base * departmentMultiplier * professionMultiplier * advancedMultiplier).toFixed(2));
    }
  }

  for (const skill of BLUEPRINT_RESEARCH_SKILLS) {
    next[skill] = Number((Math.max(0, Number(next[skill] ?? 0)) * synergy * winnerResearchMultiplier).toFixed(2));
  }

  return {
    participantUserIds: activeParticipants,
    perTick: next,
  };
}

async function syncCompanyBlueprintResearchProject(company: any) {
  const state = companyBlueprints.get(company.id);
  if (!state || state.status !== "in_progress" || state.projectStatus !== "active") {
    return state ?? null;
  }

  const blueprint = getBlueprintById(state.blueprintId) ?? (isTutorialCompany(company) ? buildTutorialBlueprintView() : null);
  if (!blueprint) {
    return state;
  }

  const tickMs = Math.max(1, Number(state.tickSeconds ?? BLUEPRINT_RESEARCH_TICK_SECONDS)) * 1000;
  const startedAt = Number(state.startedAt || Date.now());
  const lastTickAt = Math.max(startedAt, Number(state.lastTickAt || startedAt));
  const now = Date.now();
  let ticksToApply = Math.floor((now - lastTickAt) / tickMs);

  if (ticksToApply <= 0) {
    const contribution = await computeBlueprintResearchTick(company, state);
    state.participantUserIds = contribution.participantUserIds;
    state.lastContribution = contribution.perTick;
    state.estimatedFinishAt = estimateBlueprintResearchFinishAt(
      state.requiredPoints ?? createEmptyBlueprintResearchPoints(),
      state.currentPoints ?? createEmptyBlueprintResearchPoints(),
      contribution.perTick,
      Number(state.tickSeconds ?? BLUEPRINT_RESEARCH_TICK_SECONDS),
    );
    companyBlueprints.set(company.id, state);
    return state;
  }

  while (ticksToApply > 0 && state.status === "in_progress" && state.projectStatus === "active") {
    const contribution = await computeBlueprintResearchTick(company, state);
    state.participantUserIds = contribution.participantUserIds;
    state.lastContribution = contribution.perTick;
    const current = { ...createEmptyBlueprintResearchPoints(), ...(state.currentPoints ?? {}) };
    const required = { ...createEmptyBlueprintResearchPoints(), ...(state.requiredPoints ?? {}) };
    for (const skill of BLUEPRINT_RESEARCH_SKILLS) {
      const needed = Math.max(0, Number(required[skill] ?? 0));
      if (needed <= 0) continue;
      const nextValue = Math.min(needed, Math.max(0, Number(current[skill] ?? 0)) + Math.max(0, Number(contribution.perTick[skill] ?? 0)));
      current[skill] = Number(nextValue.toFixed(2));
    }
    state.currentPoints = current;
    state.lastTickAt = Math.min(now, Math.max(lastTickAt, Number(state.lastTickAt || lastTickAt)) + tickMs);
    state.progressHours = Number(((Number(blueprint.time || 1) * calculateBlueprintResearchPercent(required, current)) / 100).toFixed(2));
    state.estimatedFinishAt = estimateBlueprintResearchFinishAt(required, current, contribution.perTick, Number(state.tickSeconds ?? BLUEPRINT_RESEARCH_TICK_SECONDS));

    if (isBlueprintResearchComplete(required, current)) {
      state.status = "production_ready";
      state.projectStatus = "completed";
      state.completedAt = Date.now();
      state.estimatedFinishAt = Date.now();
      storeCompanyBlueprintForCompany(company.id, state.blueprintId);
      rememberGlobalBlueprintOwner(company, state.blueprintId);
      await storage.updateCompany(company.id, { ork: Number(company.ork || 0) + 1 });
      if (state.lastNotifiedStatus !== "production_ready") {
        await notifyCompanyBlueprintResearchCompleted(company, state, blueprint);
        state.lastNotifiedStatus = "production_ready";
      }
    }
    ticksToApply -= 1;
  }

  companyBlueprints.set(company.id, state);
  return state;
}

async function buildBlueprintResearchApiView(company: any, state: CompanyBlueprintState | null | undefined) {
  if (!state) return null;
  const members = await storage.getCompanyMembers(company.id);
  const memberNameByUserId = new Map(members.map((member) => [member.userId, member.username] as const));
  return {
    ...state,
    participantNames: (state.participantUserIds ?? [])
      .map((userId) => memberNameByUserId.get(userId))
      .filter(Boolean),
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

function exportCompanyRoutesRuntimeSnapshot() {
  return {
    companyBlueprints: Array.from(companyBlueprints.entries()),
    companyGadgets: Array.from(companyGadgets.entries()),
    exclusiveProjectByCompanyId: Array.from(exclusiveProjectByCompanyId.entries()),
    exclusiveCatalogByCompanyId: Array.from(exclusiveCatalogByCompanyId.entries()),
    companyProductionOrders: Array.from(companyProductionOrders.entries()),
    marketListings: [...marketListings],
    cityContracts: Array.from(cityContracts.entries()),
    companyMiningByCompanyId: Array.from(companyMiningByCompanyId.entries()),
  };
}

function importCompanyRoutesRuntimeSnapshot(snapshot: unknown) {
  companyBlueprints.clear();
  companyGadgets.clear();
  exclusiveProjectByCompanyId.clear();
  exclusiveCatalogByCompanyId.clear();
  companyProductionOrders.clear();
  marketListings.length = 0;
  cityContracts.clear();
  companyMiningByCompanyId.clear();

  const next = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  const importMapEntries = <T>(target: Map<string, T>, source: unknown) => {
    if (!Array.isArray(source)) return;
    for (const entry of source) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const key = String(entry[0] ?? "").trim();
      if (!key) continue;
      target.set(key, entry[1] as T);
    }
  };

  importMapEntries(companyBlueprints, next.companyBlueprints);
  importMapEntries(companyGadgets, next.companyGadgets);
  importMapEntries(exclusiveProjectByCompanyId, next.exclusiveProjectByCompanyId);
  importMapEntries(exclusiveCatalogByCompanyId, next.exclusiveCatalogByCompanyId);
  importMapEntries(companyProductionOrders, next.companyProductionOrders);
  if (Array.isArray(next.marketListings)) {
    marketListings.push(...next.marketListings as MarketListing[]);
  }
  importMapEntries(cityContracts, next.cityContracts);
  importMapEntries(companyMiningByCompanyId, next.companyMiningByCompanyId);
}

function clearCompanyRoutesRuntimeState() {
  companyBlueprints.clear();
  companyGadgets.clear();
  exclusiveProjectByCompanyId.clear();
  exclusiveCatalogByCompanyId.clear();
  companyProductionOrders.clear();
  marketListings.length = 0;
  cityContracts.clear();
  companyMiningByCompanyId.clear();
}

registerRuntimeSnapshotProvider("company-routes", {
  exportSnapshot: exportCompanyRoutesRuntimeSnapshot,
  importSnapshot: importCompanyRoutesRuntimeSnapshot,
  clear: clearCompanyRoutesRuntimeState,
});

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
    professionPromptShown: getProfessionPromptShown(user),
    ...buildPlayerRegistrationState(user),
  };
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
  return {
    analytics: Number(analytics.toFixed(2)),
    design: Number(design.toFixed(2)),
    drawing,
    coding: Number(coding.toFixed(2)),
    modeling,
    testing: Number(testing.toFixed(2)),
    attention: Number(attention.toFixed(2)),
  };
}

function readEquippedPvpGadget(snapshot: Awaited<ReturnType<typeof getUserWithGameState>>) {
  const inventory = Array.isArray((snapshot?.game as any)?.inventory) ? (snapshot?.game as any).inventory : [];
  const equipped = inventory
    .filter((item: any) => (item?.type === "gadget" || item?.type === "gear") && item?.isEquipped)
    .map((item: any) => {
      const stats = getEffectiveGadgetStats(item, { playerLevel: Number(snapshot?.user?.level || 1) });
      const normalizedStats = {
        analytics: Math.max(0, Number(stats.analytics || 0)),
        coding: Math.max(0, Number(stats.coding || 0)),
        testing: Math.max(0, Number(stats.testing || 0)),
        attention: Math.max(0, Number(stats.attention || 0)),
        design: Math.max(0, Number(stats.design || 0)),
        drawing: Math.max(0, Number(stats.drawing || 0)),
        modeling: Math.max(0, Number(stats.modeling || 0)),
      };
      const powerScore =
        normalizedStats.analytics
        + normalizedStats.design
        + normalizedStats.coding
        + normalizedStats.testing
        + normalizedStats.attention
        + normalizedStats.modeling * 0.4
        + normalizedStats.drawing * 0.35;
      return {
        id: String(item?.id || "gadget"),
        name: String(item?.name || "Гаджет"),
        stats: normalizedStats,
        powerScore: Number((getEffectiveGadgetPowerScore(item, { playerLevel: Number(snapshot?.user?.level || 1) }) || powerScore).toFixed(2)),
        requiredLevel: Number(item?.requiredLevel || 1),
        quality: Number(item?.quality || 1),
        wear: Number(item?.wear || 0),
        pvpRoundBonus: item?.pvpRoundBonus ?? null,
      };
    })
    .sort((a: any, b: any) => Number(b.powerScore || 0) - Number(a.powerScore || 0));
  return equipped[0] ?? null;
}

function computePvpPowerScore(input: {
  skills: ReturnType<typeof readDuelSkills>;
  level: number;
  gadget?: ReturnType<typeof readEquippedPvpGadget>;
}) {
  const { skills, level, gadget } = input;
  const skillPower =
    Number(skills.analytics || 0)
    + Number(skills.design || 0)
    + Number(skills.coding || 0)
    + Number(skills.testing || 0)
    + Number(skills.attention || 0)
    + Number(skills.modeling || 0) * 0.4
    + Number(skills.drawing || 0) * 0.35;
  const gadgetPower = Number(gadget?.powerScore || 0) * 0.65;
  const levelPower = Math.max(1, Number(level || 1)) * PVP_DUEL_CONFIG.scoring.levelPowerWeight;
  return Number((skillPower + gadgetPower + levelPower).toFixed(2));
}

async function applyDuelResultToPlayers(result: PvpDuelResult | null) {
  if (!result) return;
  const a = await storage.getUser(result.playerAUserId);
  const b = await storage.getUser(result.playerBUserId);
  if (!a || !b) return;
  const isBotA = Boolean(result.playerAIsBot);
  const isBotB = Boolean(result.playerBIsBot);

  const isWinnerA = result.winnerUserId === a.id;
  const isWinnerB = result.winnerUserId === b.id;
  const isDraw = result.winnerUserId === null;
  const xpA = isDraw ? Number(result.drawXp || result.loserXp || 0) : isWinnerA ? result.winnerXp : result.loserXp;
  const xpB = isDraw ? Number(result.drawXp || result.loserXp || 0) : isWinnerB ? result.winnerXp : result.loserXp;
  const repA = isDraw ? Number(result.drawReputation || 0) : isWinnerA ? result.winnerReputation : 0;
  const repB = isDraw ? Number(result.drawReputation || 0) : isWinnerB ? result.winnerReputation : 0;

  const stamp = getUtcDayStamp(result.createdAtMs);
  const aDailyMatches = a.pvpDailyStamp === stamp ? Number(a.pvpDailyMatches || 0) + 1 : 1;
  const bDailyMatches = b.pvpDailyStamp === stamp ? Number(b.pvpDailyMatches || 0) + 1 : 1;

  const snapshotA = await getUserWithGameState(a.id);
  const snapshotB = await getUserWithGameState(b.id);
  const boostA = isWinnerA ? consumePvpBankBoost(a.id) : null;
  const boostB = isWinnerB ? consumePvpBankBoost(b.id) : null;
  const xpBonusA = boostA ? Math.round(xpA * Number(boostA.xpBonusPct || 0)) : 0;
  const xpBonusB = boostB ? Math.round(xpB * Number(boostB.xpBonusPct || 0)) : 0;
  const repBonusA = boostA ? Math.round(repA * Number(boostA.rewardBonusPct || 0)) : 0;
  const repBonusB = boostB ? Math.round(repB * Number(boostB.rewardBonusPct || 0)) : 0;
  const ratingBonusA = boostA ? Math.round(Number(boostA.ratingBonusFlat || 0)) : 0;
  const ratingBonusB = boostB ? Math.round(Number(boostB.ratingBonusFlat || 0)) : 0;
  const aLevelState = applyExperienceGainForLevel(a, xpA + xpBonusA);
  const bLevelState = applyExperienceGainForLevel(b, xpB + xpBonusB);
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

  if (!isBotA) {
    await storage.updateUser(a.id, {
      level: aLevelState.level,
      experience: aLevelState.experience,
      reputation: Number(a.reputation || 0) + repA + repBonusA,
      pvpRating: Math.max(0, Number(result.playerARatingAfter || 0) + ratingBonusA),
      pvpMatches: Number(a.pvpMatches || 0) + 1,
      pvpWins: Number(a.pvpWins || 0) + (isWinnerA ? 1 : 0),
      pvpLosses: Number(a.pvpLosses || 0) + (isDraw ? 0 : isWinnerA ? 0 : 1),
      pvpDailyStamp: stamp,
      pvpDailyMatches: aDailyMatches,
      lastActiveAt: Math.floor(Date.now() / 1000),
    });
  }

  if (!isBotB) {
    await storage.updateUser(b.id, {
      level: bLevelState.level,
      experience: bLevelState.experience,
      reputation: Number(b.reputation || 0) + repB + repBonusB,
      pvpRating: Math.max(0, Number(result.playerBRatingAfter || 0) + ratingBonusB),
      pvpMatches: Number(b.pvpMatches || 0) + 1,
      pvpWins: Number(b.pvpWins || 0) + (isWinnerB ? 1 : 0),
      pvpLosses: Number(b.pvpLosses || 0) + (isDraw ? 0 : isWinnerB ? 0 : 1),
      pvpDailyStamp: stamp,
      pvpDailyMatches: bDailyMatches,
      lastActiveAt: Math.floor(Date.now() / 1000),
    });
  }

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

function isPvpBotUsername(username: string | null | undefined) {
  const value = String(username || "").trim().toLowerCase();
  const base = String(process.env.PVP_TEST_BOT_USERNAME || "pvp_test_bot").trim().toLowerCase();
  return value === base || value.startsWith(`${base}_`);
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
  const bonusTier = Math.floor((level - 1) / 3);
  const common = Math.max(58, 78 - bonusTier * 2);
  const uncommon = 18 + bonusTier * 1.5;
  const rare = 4 + bonusTier * 0.35;
  const epic = 0;
  return { Common: common, Uncommon: uncommon, Rare: rare, Epic: epic };
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

const STAGED_CONTRACT_TEMPLATES = [
  {
    title: "Диагностика платформы",
    customer: "Support Grid",
    stages: [
      { title: "Диагностика", skillType: "testing" as const, target: 180 },
      { title: "Аналитика", skillType: "analytics" as const, target: 160 },
    ],
    reward: 1900,
    ork: 1,
    ttlHours: 48,
  },
  {
    title: "Разработка сервиса",
    customer: "Urban Cloud",
    stages: [
      { title: "Проектирование", skillType: "design" as const, target: 150 },
      { title: "Разработка", skillType: "coding" as const, target: 220 },
    ],
    reward: 2400,
    ork: 1,
    ttlHours: 48,
  },
  {
    title: "Аудит качества",
    customer: "QA Bureau",
    stages: [
      { title: "Сбор данных", skillType: "analytics" as const, target: 150 },
      { title: "Проверка", skillType: "testing" as const, target: 190 },
    ],
    reward: 2100,
    ork: 1,
    ttlHours: 48,
  },
  {
    title: "Создание прототипа",
    customer: "Product Lab",
    stages: [
      { title: "Концепт", skillType: "design" as const, target: 170 },
      { title: "Прототип", skillType: "coding" as const, target: 210 },
      { title: "Тестирование", skillType: "testing" as const, target: 160 },
    ],
    reward: 2900,
    ork: 2,
    ttlHours: 72,
  },
  {
    title: "Оптимизация системы",
    customer: "ScaleOps",
    stages: [
      { title: "Анализ", skillType: "analytics" as const, target: 140 },
      { title: "Оптимизация", skillType: "coding" as const, target: 210 },
      { title: "Проверка стабильности", skillType: "testing" as const, target: 170 },
    ],
    reward: 3000,
    ork: 2,
    ttlHours: 72,
  },
] as const;

function pickRandomDistinct<T>(items: readonly T[], count: number) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)));
}

function cloneContractStages(template: typeof STAGED_CONTRACT_TEMPLATES[number], rewardMultiplier: number): CityContractStage[] {
  return template.stages.map((stage, index) => ({
    index,
    title: stage.title,
    skillType: stage.skillType,
    target: Math.max(60, Math.round(stage.target * rewardMultiplier)),
    progress: 0,
    contributions: [],
  }));
}

function getCurrentContractStage(contract: CityContract) {
  const currentStageIndex = Math.max(0, Number(contract.currentStageIndex || 0));
  return contract.stages?.[currentStageIndex] ?? null;
}

function isContractStageComplete(stage: CityContractStage | null | undefined) {
  if (!stage) return false;
  return Number(stage.progress || 0) >= Number(stage.target || 0);
}

function aggregateContractContributionByUser(contract: CityContract) {
  const totals = new Map<string, { userId: string; username: string; value: number }>();
  for (const stage of contract.stages ?? []) {
    for (const row of stage.contributions ?? []) {
      const current = totals.get(row.userId) ?? {
        userId: row.userId,
        username: row.username,
        value: 0,
      };
      current.value = Number((current.value + Number(row.value || 0)).toFixed(2));
      current.username = row.username || current.username;
      totals.set(row.userId, current);
    }
  }
  return Array.from(totals.values()).sort((a, b) => b.value - a.value);
}

function buildContractsForCity(city: string): CityContract[] {
  const now = Date.now();
  const cityId = resolveCityId(city);
  const rewardMultiplier = BALANCE_CONFIG.cityContracts.rewardMultiplierByCityId[cityId] ?? 1;
  const rewardByCity = (value: number) => Math.max(1, Math.round(value * rewardMultiplier));
  const stagedContracts: CityContract[] = pickRandomDistinct(STAGED_CONTRACT_TEMPLATES, 4).map((template) => ({
    id: randomUUID(),
    city,
    title: template.title,
    customer: template.customer,
    kind: "staged_skill",
    category: "skills",
    requiredQuantity: 1,
    minQuality: 1,
    rewardMoney: rewardByCity(template.reward),
    rewardOrk: template.ork,
    expiresAt: now + template.ttlHours * 60 * 60 * 1000,
    status: "open",
    currentStageIndex: 0,
    stages: cloneContractStages(template, rewardMultiplier),
    participantRewardMoney: Math.max(40, Math.round(rewardByCity(template.reward) * 0.18)),
    participantRewardXp: Math.max(20, Math.round(template.reward / 55)),
    participantBaseMoney: 12,
    participantBaseXp: 6,
  }));
  return stagedContracts;
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

async function completeStagedCompanyContract(contract: CityContract, company: Company) {
  if (contract.participantRewardsGranted) return;

  const updatedCompany = await storage.updateCompany(company.id, {
    balance: Number(company.balance || 0) + Number(contract.rewardMoney || 0),
    ork: Number(company.ork || 0) + Number(contract.rewardOrk || 0),
  });

  const contributionRows = aggregateContractContributionByUser(contract);
  const totalContribution = contributionRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const participantsCount = Math.max(1, contributionRows.length);
  const moneyPool = Math.max(0, Number(contract.participantRewardMoney || 0));
  const xpPool = Math.max(0, Number(contract.participantRewardXp || 0));
  const baseMoney = Math.max(0, Number(contract.participantBaseMoney || 0));
  const baseXp = Math.max(0, Number(contract.participantBaseXp || 0));
  const participantRewards: Array<{ userId: string; username: string; money: number; xp: number; share: number }> = [];

  for (const row of contributionRows) {
    const user = await storage.getUser(row.userId);
    if (!user) continue;
    const share = totalContribution > 0 ? Number(row.value || 0) / totalContribution : 1 / participantsCount;
    const rewardMoney = baseMoney + Math.max(0, Math.round(moneyPool * share));
    const rewardXp = baseXp + Math.max(0, Math.round(xpPool * share));
    const levelState = applyExperienceGainForLevel(user, rewardXp);
    await storage.updateUser(user.id, {
      balance: Number(user.balance || 0) + rewardMoney,
      level: levelState.level,
      experience: levelState.experience,
      lastActiveAt: Math.floor(Date.now() / 1000),
    });
    participantRewards.push({
      userId: user.id,
      username: user.username,
      money: rewardMoney,
      xp: rewardXp,
      share: Number(share.toFixed(4)),
    });
    createNotification(user.id, {
      type: "CONTRACT_COMPLETED",
      title: "🎯 Контракт завершён",
      message: `Компания закрыла контракт «${contract.title}». Твоя доля: $${rewardMoney} и ${rewardXp} XP.`,
      dataJson: {
        companyId: company.id,
        companyName: company.name,
        contractId: contract.id,
        contractTitle: contract.title,
        rewardMoney,
        rewardXp,
        share: Number(share.toFixed(4)),
      },
    });
    markCompanyContractCompleted({
      companyId: company.id,
      userId: user.id,
      username: user.username,
    });
  }

  contract.participantRewardsGranted = true;
  return {
    company: updatedCompany,
    participantRewards,
  };
}

function removeProducedGadget(companyId: string, gadgetId: string): ProducedGadget | null {
  const produced = companyGadgets.get(companyId) ?? [];
  const index = produced.findIndex((gadget) => gadget.id === gadgetId);
  if (index < 0) return null;
  const [removed] = produced.splice(index, 1);
  companyGadgets.set(companyId, produced);
  return removed;
}

function getProducedGadget(companyId: string, gadgetId: string) {
  const produced = companyGadgets.get(companyId) ?? [];
  return produced.find((gadget) => gadget.id === gadgetId) ?? null;
}

function getProducedGadgetUpgradeGroupKey(gadget: ProducedGadget) {
  const baseName = String(gadget.baseName || gadget.name || "").trim().toLowerCase();
  const category = normalizeProducedCategory(gadget.category);
  const blueprintId = String(gadget.blueprintId || "").trim().toLowerCase();
  return `${baseName}::${category}::${blueprintId}`;
}

function getMarketGadgetBatchKey(gadget: Partial<ProducedGadget> | null | undefined) {
  if (!gadget) return "";
  return JSON.stringify({
    baseName: String(gadget.baseName || gadget.name || "").trim().toLowerCase(),
    category: normalizeProducedCategory(String(gadget.category || "")),
    blueprintId: String(gadget.blueprintId || "").trim().toLowerCase(),
    quality: Number(gadget.quality || 0).toFixed(2),
    stats: gadget.stats || {},
    exclusiveLevel: Number(gadget.exclusiveLevel || 0),
    bonus: String(gadget.exclusiveBonusLabel || ""),
  });
}

function getActiveMarketListedGadgetIds() {
  return new Set(
    marketListings
      .filter((listing) => listing.status === "active" && listing.listingKind === "gadget" && listing.gadgetId)
      .map((listing) => String(listing.gadgetId))
  );
}

function getProducedGadgetMarketBatch(companyId: string, gadgetId: string, requiredCount: number) {
  const produced = companyGadgets.get(companyId) ?? [];
  const target = produced.find((item) => item.id === gadgetId);
  if (!target) return [];
  const targetKey = getMarketGadgetBatchKey(target);
  const listedIds = getActiveMarketListedGadgetIds();
  return produced
    .filter((item) => !listedIds.has(String(item.id)) && getMarketGadgetBatchKey(item) === targetKey)
    .slice(0, requiredCount);
}

function getExclusiveUpgradeCandidates(companyId: string) {
  const produced = companyGadgets.get(companyId) ?? [];
  const groups = new Map<string, { representative: ProducedGadget; items: ProducedGadget[] }>();
  for (const item of produced) {
    if (item.isExclusive) continue;
    const key = getProducedGadgetUpgradeGroupKey(item);
    const current = groups.get(key);
    if (current) {
      current.items.push(item);
      continue;
    }
    groups.set(key, { representative: item, items: [item] });
  }

  return Array.from(groups.values())
    .filter((group) => group.items.length >= EXCLUSIVE_UPGRADE_REQUIRED_GADGETS)
    .map((group) => ({
      ...group.representative,
      availableQuantity: group.items.length,
    }));
}

function getProducedGadgetUpgradeBatch(companyId: string, gadgetId: string, requiredCount: number) {
  const produced = companyGadgets.get(companyId) ?? [];
  const target = produced.find((item) => item.id === gadgetId);
  if (!target) return [];
  const key = getProducedGadgetUpgradeGroupKey(target);
  return produced
    .filter((item) => !item.isExclusive && getProducedGadgetUpgradeGroupKey(item) === key)
    .slice(0, requiredCount);
}

function buildPlayerInventoryGadgetFromProduced(gadget: ProducedGadget) {
  return {
    id: gadget.id,
    name: gadget.name,
    title: gadget.title ?? gadget.name,
    baseName: gadget.baseName,
    category: gadget.category,
    branch: gadget.branch as any,
    generation: Number(gadget.generation ?? 1),
    requiredLevel: Number(gadget.requiredLevel ?? 1),
    stats: { ...(gadget.stats || {}) },
    rarity: String(gadget.rarity || (gadget.isExclusive ? "Exclusive" : "Rare")),
    quantity: 1,
    type: "gadget" as const,
    isCompanyMade: Boolean(gadget.isCompanyMade ?? true),
    companyId: gadget.companyId,
    companyEmoji: gadget.companyEmoji ?? null,
    durability: gadget.durability,
    maxDurability: gadget.maxDurability,
    condition: gadget.condition,
    maxCondition: gadget.maxCondition,
    isBroken: Boolean(gadget.isBroken),
    reliability: Number(gadget.reliability ?? 1),
    quality: Number(gadget.quality ?? 1),
    wear: Number(gadget.wear ?? 0),
    wearRate: Number(gadget.wearRate ?? 1),
    repairCost: Number(gadget.repairCost ?? 0),
    basePrice: Number(gadget.basePrice ?? gadget.minPrice ?? 0),
    productionCostGrm: Number(gadget.productionCostGrm ?? 0),
    auctionMinPrice: Number(gadget.auctionMinPrice ?? gadget.minPrice ?? 0),
    auctionMaxPrice: Number(gadget.auctionMaxPrice ?? gadget.maxPrice ?? 0),
    productionPartsRequirement: gadget.productionPartsRequirement ? { ...(gadget.productionPartsRequirement || {}) } : undefined,
    pvpRoundBonus: gadget.pvpRoundBonus ?? null,
    specialEffect: gadget.specialEffect ?? null,
    hashPower: gadget.hashPower,
    incomePerCycle: gadget.incomePerCycle,
    powerCostPerCycle: gadget.powerCostPerCycle,
    isExclusive: Boolean(gadget.isExclusive),
    upgradeLevel: getProducedGadgetExclusiveLevel(gadget),
    exclusiveLevel: getProducedGadgetExclusiveLevel(gadget),
    exclusiveBonusType: gadget.exclusiveBonusType,
    exclusiveBonusValue: gadget.exclusiveBonusValue,
    exclusiveBonusLabel: gadget.exclusiveBonusLabel,
    acquisitionSource: gadget.acquisitionSource ?? "company_production",
    acquiredAt: Number(gadget.acquiredAt || gadget.producedAt || Date.now()),
    lastAuctionPurchaseAt: Number(gadget.lastAuctionPurchaseAt || 0) || null,
  };
}

async function transferProducedGadgetToPlayerInventory(
  userId: string,
  gadget: ProducedGadget | null,
  acquisition?: {
    acquisitionSource?: "auction" | "company_production" | "reward" | "other";
    acquiredAt?: number;
    lastAuctionPurchaseAt?: number | null;
  },
) {
  if (!gadget) return null;
  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) return null;
  const inventory = Array.isArray((snapshot.game as any)?.inventory) ? [...((snapshot.game as any).inventory)] : [];
  inventory.unshift({
    ...buildPlayerInventoryGadgetFromProduced(gadget),
    acquisitionSource: acquisition?.acquisitionSource ?? gadget.acquisitionSource ?? "company_production",
    acquiredAt: Number(acquisition?.acquiredAt || gadget.acquiredAt || gadget.producedAt || Date.now()),
    lastAuctionPurchaseAt: Number(acquisition?.lastAuctionPurchaseAt || gadget.lastAuctionPurchaseAt || 0) || null,
  });
  applyGameStatePatch(userId, { inventory });
  return gadget;
}

async function transferMarketPartToPlayerInventory(
  userId: string,
  part: { id: string; name: string; rarity: string; type: string } | null,
) {
  if (!part) return null;
  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) return null;
  const inventory = Array.isArray((snapshot.game as any)?.inventory) ? [...((snapshot.game as any).inventory)] : [];
  const existingIndex = inventory.findIndex((item) => item?.type === "part" && item?.id === part.id && String(item?.rarity || "Common") === String(part.rarity || "Common"));
  if (existingIndex >= 0) {
    inventory[existingIndex] = {
      ...inventory[existingIndex],
      quantity: Math.max(1, Number(inventory[existingIndex]?.quantity || 1)) + 1,
    };
  } else {
    inventory.unshift(buildPlayerInventoryPartFromMarket(part));
  }
  applyGameStatePatch(userId, { inventory });
  return part;
}

function rollPvpRewardPart(input: { isWinner: boolean; isDraw: boolean }) {
  if (input.isDraw) return null;
  if (input.isWinner) {
    const epic = rollRandomPartDrop(10, { allowedQualities: ["Epic"] });
    if (epic) return epic;
    const rare = rollRandomPartDrop(22, { allowedQualities: ["Rare"] });
    return rare;
  }
  const uncommon = rollRandomPartDrop(20, { allowedQualities: ["Uncommon"] });
  if (uncommon) return uncommon;
  const common = rollRandomPartDrop(35, { allowedQualities: ["Common"] });
  return common;
}

function isLeadershipRole(role: string | null | undefined) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "owner" || normalized === "manager" || normalized === "cto" || normalized === "deputy";
}

async function resolveCompanyActorRole(companyId: string, userId: string) {
  const membership = await storage.getMemberByUserId(companyId, userId);
  return membership?.role ?? null;
}

async function requireCompanyAssetManagerAccess(input: {
  company: Company;
  userId: string;
  action: string;
}) {
  const role = await resolveCompanyActorRole(input.company.id, input.userId);
  const allowed = canManageCompanyAssets({
    actorUserId: input.userId,
    companyOwnerId: input.company.ownerId,
    role,
  });
  if (!allowed) {
    appendEconomyAuditEvent({
      eventType: "COMPANY_ASSET_ACTION_DENIED",
      userId: input.userId,
      companyId: input.company.id,
      targetId: input.action,
      status: "blocked",
      reason: COMPANY_ASSET_MANAGER_ERROR,
      metadata: { action: input.action, role: role || null },
    });
    throw new Error(COMPANY_ASSET_MANAGER_ERROR);
  }
  return { role };
}

const AUCTION_GADGET_RELIST_BLOCK_MS = 7 * 24 * 60 * 60 * 1000;

function getAuctionRelistBlockMessage() {
  return "Этот гаджет нельзя перепродать в течение 7 дней после покупки на аукционе.";
}

function getRemainingAuctionRelistMs(gadget: Partial<ProducedGadget> | null | undefined) {
  const lastAuctionPurchaseAt = Number(gadget?.lastAuctionPurchaseAt || 0);
  if (!lastAuctionPurchaseAt) return 0;
  return Math.max(0, lastAuctionPurchaseAt + AUCTION_GADGET_RELIST_BLOCK_MS - Date.now());
}

function canRelistAuctionPurchasedGadget(gadget: Partial<ProducedGadget> | null | undefined) {
  const source = String(gadget?.acquisitionSource || "").trim().toLowerCase();
  if (source !== "auction") return true;
  const lastAuctionPurchaseAt = Number(gadget?.lastAuctionPurchaseAt || 0);
  if (!lastAuctionPurchaseAt) return true;
  return Date.now() - lastAuctionPurchaseAt >= AUCTION_GADGET_RELIST_BLOCK_MS;
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

function isCompanyHackathonManagerRole(role: string, ownerId: string | null | undefined, actorUserId: string) {
  return canManageCompanyAssets({
    actorUserId,
    companyOwnerId: ownerId,
    role,
  });
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

function parseBlueprintTierFromId(blueprintId: string) {
  const tier = Number(String(blueprintId || "").split("-").at(-1) || "1");
  return Number.isFinite(tier) && tier > 0 ? tier : 1;
}

function getBlueprintTierMultiplier(blueprintId: string) {
  const tier = parseBlueprintTierFromId(blueprintId);
  if (tier <= 2) return 1;
  if (tier <= 4) return 1.25;
  if (tier <= 6) return 1.55;
  if (tier <= 8) return 1.9;
  return 2.3;
}

function getProductionQuantityMultiplier(quantity: number) {
  return 1 + Math.max(0, quantity - 1) * 0.7;
}

function getBatchQualityPenalty(quantity: number) {
  return Math.max(0, Math.max(0, quantity - 3) * 0.015);
}

function syncCompanyProductionOrder(companyId: string) {
  const order = companyProductionOrders.get(companyId);
  if (!order) return null;
  if (order.status === "in_progress" && Date.now() >= Number(order.readyAt || 0)) {
    order.status = "ready_to_claim";
    companyProductionOrders.set(companyId, order);
  }
  return order;
}

function getCompanyWarehouseUsedSlotsForClaim(company: any, producedCount: number) {
  const warehouseParts = Array.isArray(company?.warehouse) ? company.warehouse : [];
  const partSlots = warehouseParts.reduce(
    (sum: number, item: any) => sum + Math.max(0, Math.floor(Number(item?.quantity) || 0)),
    0,
  );
  return Math.max(0, producedCount) + partSlots;
}

async function ensureCompanyWarehouseCanClaimProduction(company: any, quantity: number) {
  const produced = companyGadgets.get(company.id) ?? [];
  const capacity = Math.max(0, Number(company.warehouseCapacity) || 50);
  const used = getCompanyWarehouseUsedSlotsForClaim(company, produced.length);
  const free = Math.max(0, capacity - used);
  return {
    ok: free >= Math.max(1, quantity),
    free,
  };
}

function buildProducedGadgetsFromOrder(input: {
  order: CompanyProductionOrder;
  companyId: string;
  testing: number;
  attention: number;
}) {
  const created: ProducedGadget[] = [];
  for (let index = 0; index < input.order.quantity; index += 1) {
    const gadgetCondition = createGadgetConditionProfile({
      rarity: input.order.isExclusive ? "Rare" : "Rare",
      quality: input.order.quality,
      testing: input.testing,
      attention: input.attention,
    });
    created.push({
      id: randomUUID(),
      blueprintId: input.order.blueprintId,
      companyId: input.companyId,
      name: input.order.blueprintName,
      title: input.order.blueprintName,
      baseName: input.order.baseName || input.order.blueprintName,
      category: input.order.category,
      branch: getBlueprintById(input.order.blueprintId)?.branch,
      generation: getBlueprintById(input.order.blueprintId)?.generation ?? 1,
      rarity: getBlueprintById(input.order.blueprintId)?.rarity ?? (input.order.isExclusive ? "Epic" : "Rare"),
      requiredLevel: getBlueprintById(input.order.blueprintId)?.requiredLevel ?? 1,
      stats: Object.fromEntries(
        Object.entries(input.order.stats).map(([key, value]) => [key, Number(value.toFixed ? value.toFixed(2) : Number(value || 0).toFixed(2))]),
      ),
      quality: Number(input.order.quality.toFixed(2)),
      wear: 0,
      wearRate: Number(getBlueprintById(input.order.blueprintId)?.wearRate ?? 1),
      repairCost: Number(getBlueprintById(input.order.blueprintId)?.repairCost ?? 0),
      basePrice: Number(getBlueprintById(input.order.blueprintId)?.basePrice ?? input.order.minPrice ?? 0),
      productionCostGrm: Number(input.order.gramCost ?? getBlueprintById(input.order.blueprintId)?.productionCostGrm ?? 0),
      auctionMinPrice: Number(input.order.minPrice ?? getBlueprintById(input.order.blueprintId)?.auctionMinPrice ?? 0),
      auctionMaxPrice: Number(input.order.maxPrice ?? getBlueprintById(input.order.blueprintId)?.auctionMaxPrice ?? 0),
      productionPartsRequirement: { ...(getBlueprintById(input.order.blueprintId)?.productionPartsRequirement || {}) },
      pvpRoundBonus: getBlueprintById(input.order.blueprintId)?.pvpRoundBonus ?? null,
      specialEffect: getBlueprintById(input.order.blueprintId)?.specialEffect ?? null,
      hashPower: getBlueprintById(input.order.blueprintId)?.hashPower,
      incomePerCycle: getBlueprintById(input.order.blueprintId)?.incomePerCycle,
      powerCostPerCycle: getBlueprintById(input.order.blueprintId)?.powerCostPerCycle,
      minPrice: input.order.minPrice,
      maxPrice: input.order.maxPrice,
      ...gadgetCondition,
      producedAt: Date.now(),
      isCompanyMade: true,
      isExclusive: input.order.isExclusive,
      acquisitionSource: "company_production",
      acquiredAt: Date.now(),
      lastAuctionPurchaseAt: null,
      exclusiveLevel: Math.max(0, Number(input.order.exclusiveLevel || 0)),
      exclusiveBonusType: input.order.exclusiveBonusType,
      exclusiveBonusValue: input.order.exclusiveBonusValue,
      exclusiveBonusLabel: input.order.exclusiveBonusLabel,
    });
  }
  return created;
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
  state.projectStatus = "completed";
  state.estimatedFinishAt = Date.now();
  state.completedAt = Date.now();
  const tutorialOwnerId = String(company.tutorialOwnerId || company.ownerId);
  await applyTutorialEvent(tutorialOwnerId, "demo_blueprint_done");

  return state;
}

async function syncBlueprintStateForCompany(company: any) {
  const current = companyBlueprints.get(company.id);
  if (isTutorialCompany(company)) {
    const synced = await syncTutorialBlueprintState(company, current);
    if (synced) companyBlueprints.set(company.id, synced);
    return synced ?? null;
  }
  return await syncCompanyBlueprintResearchProject(company);
}

function calculateStandardProductionDurationSeconds(input: {
  blueprintId: string;
  category: string;
  quantity: number;
  departmentEffects: CompanyDepartmentEffects;
  ceoAdvanced: string | null;
}) {
  const base = STANDARD_PRODUCTION_BASE_SECONDS[input.category] ?? 12 * 60;
  const tierMultiplier = getBlueprintTierMultiplier(input.blueprintId);
  const quantityMultiplier = getProductionQuantityMultiplier(input.quantity);
  const engineerSpeed = input.ceoAdvanced === "engineer" ? 1.05 : 1;
  const speedDivisor = Math.max(
    0.1,
    Number(input.departmentEffects.productionSpeedMultiplier || 1) * engineerSpeed,
  );
  return Math.max(6 * 60, Math.ceil((base * tierMultiplier * quantityMultiplier) / speedDivisor));
}

function calculateExclusiveProductionDurationSeconds(input: {
  blueprintId: string;
  category: string;
  quantity: number;
  departmentEffects: CompanyDepartmentEffects;
  ceoAdvanced: string | null;
}) {
  const base = EXCLUSIVE_PRODUCTION_BASE_SECONDS[input.category] ?? 18 * 60;
  const quantityMultiplier = getProductionQuantityMultiplier(input.quantity);
  const engineerSpeed = input.ceoAdvanced === "engineer" ? 1.08 : 1;
  const speedDivisor = Math.max(
    0.1,
    Number(input.departmentEffects.productionSpeedMultiplier || 1) * engineerSpeed,
  );
  return Math.max(8 * 60, Math.ceil((base * quantityMultiplier) / speedDivisor));
}

function buildExclusiveUpgradeBlueprint(input: {
  companyId: string;
  companyName: string;
  gadget: ProducedGadget;
  selectedParts: Array<{ id: string; name?: string; rarity: string; type: string }>;
}) {
  const currentLevel = getProducedGadgetExclusiveLevel(input.gadget);
  const nextLevel = Math.min(EXCLUSIVE_UPGRADE_MAX_LEVEL, currentLevel + 1);
  const category = normalizeProducedCategory(input.gadget.category);
  const successChance = getExclusiveUpgradeSuccessChance(input.selectedParts, nextLevel);
  const developmentCostGrm = getExclusiveUpgradeCostGrm(category, nextLevel);
  const developmentHoursRequired = Number((getExclusiveUpgradeDurationMinutes(category, nextLevel) / 60).toFixed(2));
  const requiredPartType = getExclusiveRequiredPartTypeForCategory(category);
  const partSummary = input.selectedParts.map((part) => `${String(part.name || ALL_PARTS[part.id as keyof typeof ALL_PARTS]?.name || part.id)} [${part.rarity}]`);
  const levelMultiplier = Math.pow(EXCLUSIVE_UPGRADE_SUCCESS_MULTIPLIER, nextLevel);
  const upgradedStats = Object.fromEntries(
    Object.entries(input.gadget.stats || {}).map(([key, value]) => [key, Number((Number(value || 0) * levelMultiplier).toFixed(2))]),
  );
  const originalName = String(input.gadget.baseName || input.gadget.name || "Гаджет").trim();
  const upgradedName = `${originalName} EX+${nextLevel}`;
  return {
    id: `exclusive-upgrade-${randomUUID()}`,
    companyId: input.companyId,
    companyName: input.companyName,
    name: buildProducedCompanyGadgetName(input.companyName, upgradedName),
    category,
    flavor: `Улучшенная версия ${originalName} уровня EX+${nextLevel}`,
    successChance,
    developmentHoursRequired,
    developmentCostGrm,
    productionCostGram: 0,
    totalUnits: 1,
    remainingUnits: 1,
    baseStats: upgradedStats,
    dominantProfessionId: null,
    seedParts: input.selectedParts.map((part) => ({
      id: String(part.id),
      rarity: String(part.rarity || "Common") as any,
      type: String(part.type || ALL_PARTS[String(part.id)]?.type || requiredPartType) as any,
      name: String(part.name || ALL_PARTS[String(part.id)]?.name || part.id),
    })),
    partSummary,
    requiredResearch: createEmptyExclusiveResearchMap(),
    bonusType: "skills" as const,
    bonusValue: 0,
    bonusLabel: `EX+${nextLevel}: x${EXCLUSIVE_UPGRADE_SUCCESS_MULTIPLIER} к характеристикам гаджета`,
    targetGadgetId: input.gadget.id,
    targetGadgetName: originalName,
    targetExclusiveLevel: currentLevel,
    upgradeLevel: nextLevel,
    requiredPartType: requiredPartType as any,
    requiredPartCount: EXCLUSIVE_UPGRADE_REQUIRED_PARTS,
    requiredGadgetCount: EXCLUSIVE_UPGRADE_REQUIRED_GADGETS,
  } satisfies ExclusiveBlueprintDefinition;
}

async function settleExpiredAuctions() {
  const now = Date.now();
  const settings = await getGameSettings();
  for (const listing of marketListings) {
    if (listing.saleType !== "auction" || listing.status !== "active" || !listing.auctionEndsAt) continue;
    if (listing.auctionEndsAt > now) continue;

    if (!listing.currentBid || !listing.currentBidderId) {
      if (listing.listingKind === "part" && listing.partId) {
        restoreCompanyWarehousePartFromMarket(listing.companyId, {
          id: listing.partId,
          name: String(listing.partName || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.name || listing.partId),
          type: String(listing.partType || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.type || "unknown"),
          rarity: String(listing.partRarity || "Common"),
          quantity: 1,
        });
      }
      listing.status = "expired";
      if (String(listing.sellerUserId || "").trim()) {
        createNotification(String(listing.sellerUserId), {
          type: "AUCTION_ENDED",
          title: "⌛ Аукцион завершён без ставок",
          message: `Лот «${formatAuctionLotTitle(listing)}» не был продан.`,
          dataJson: {
            listingId: listing.id,
            companyId: listing.companyId,
          },
        });
      }
      continue;
    }

    const buyer = await storage.getUser(listing.currentBidderId);
    const company = await storage.getCompany(listing.companyId);
    if (!buyer || !company || buyer.balance < listing.currentBid) {
      if (listing.listingKind === "part" && listing.partId) {
        restoreCompanyWarehousePartFromMarket(listing.companyId, {
          id: listing.partId,
          name: String(listing.partName || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.name || listing.partId),
          type: String(listing.partType || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.type || "unknown"),
          rarity: String(listing.partRarity || "Common"),
          quantity: 1,
        });
      }
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
    const nextCompanyBalance = Number(company.balance || 0) + netIncome;
    await storage.updateUser(buyer.id, { balance: buyer.balance - listing.currentBid });
    await storage.updateCompany(company.id, { balance: nextCompanyBalance });
    await applyCompanyMarketIncomeToRuntime(company, nextCompanyBalance, netIncome);
    const soldGadget = listing.listingKind === "gadget"
      ? removeProducedGadget(listing.companyId, String(listing.gadgetId || ""))
      : null;
    if (listing.listingKind === "part") {
      await transferMarketPartToPlayerInventory(buyer.id, listing.partId ? {
        id: listing.partId,
        name: String(listing.partName || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.name || listing.partId),
        rarity: String(listing.partRarity || "Common"),
        type: String(listing.partType || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.type || "unknown"),
      } : null);
    } else {
      await transferProducedGadgetToPlayerInventory(
        buyer.id,
        soldGadget,
        {
          acquisitionSource: "auction",
          acquiredAt: Date.now(),
          lastAuctionPurchaseAt: Date.now(),
        },
      );
      appendEconomyAuditEvent({
        eventType: "MARKET_GADGET_PURCHASED",
        userId: buyer.id,
        companyId: company.id,
        targetId: String(soldGadget?.id || listing.gadgetId || ""),
        amount: Number(listing.currentBid || 0),
        status: "success",
        metadata: {
          sellerUserId: listing.sellerUserId,
          saleType: "auction",
          listingId: listing.id,
        },
      });
    }

    listing.status = "sold";
    listing.sold = true;
    listing.salePrice = listing.currentBid;

    const buyerTelegramId = Number(getTelegramIdByUserId(buyer.id) || 0);
    createNotification(buyer.id, {
      type: "AUCTION_WON",
      title: "🏆 Аукцион выигран",
      message: `Ты выиграл лот «${listing.listingKind === "gadget" ? String(soldGadget?.name || "Гаджет") : String(listing.partName || "Запчасть")}».`,
      dataJson: {
        listingId: listing.id,
        companyId: listing.companyId,
        salePrice: listing.currentBid,
      },
    });
    if (buyerTelegramId) {
      await sendTelegramBotText(
        buyerTelegramId,
        [
          `🏆 Аукцион завершён: ты выиграл лот`,
          `Лот: ${listing.listingKind === "gadget" ? String(soldGadget?.name || "Гаджет") : String(listing.partName || "Запчасть")}`,
          `Списано: ${formatMarketAmount(Number(listing.currentBid || 0))} GRM`,
          listing.listingKind === "gadget"
            ? "Гаджет уже добавлен в твой инвентарь."
            : "Запчасть уже добавлена в твой инвентарь.",
        ].join("\n"),
      );
    }

    const sellerTelegramId = Number(getTelegramIdByUserId(company.ownerId) || 0);
    createNotification(company.ownerId, {
      type: "MARKET_LISTING_SOLD",
      title: "💰 Лот компании продан",
      message: `Компания продала лот за ${formatMarketAmount(Number(listing.currentBid || 0))} GRM.`,
      dataJson: {
        listingId: listing.id,
        companyId: company.id,
        netIncome,
      },
    });
    if (sellerTelegramId) {
      await sendTelegramBotText(
        sellerTelegramId,
        [
          `✅ Аукцион компании завершён`,
          `Лот продан за ${formatMarketAmount(Number(listing.currentBid || 0))} GRM`,
          `Компания получила: ${formatMarketAmount(netIncome)} GRM`,
        ].join("\n"),
      );
    }
  }
}

async function applyCompanyMarketIncomeToRuntime(company: any, nextBalance: number, incomeGrm: number) {
  const safeIncome = Math.max(0, Number(incomeGrm || 0));
  const members = await storage.getCompanyMembers(String(company.id));
  const currentRuntime = companyEconomyByCompanyId.get(String(company.id));
  const baseEconomy = reconcileCompanyEconomy({
    ...(company as CompanyEconomyLike),
    ...(currentRuntime ?? {}),
    balance: nextBalance,
    capitalGRM: nextBalance,
    profitGRM: Number(currentRuntime?.profitGRM ?? (company as any).profitGRM ?? 0),
    employeeCount: Math.max(1, members.length),
  } as CompanyEconomyLike);

  const updatedEconomy = reconcileCompanyEconomy({
    ...baseEconomy,
    balance: nextBalance,
    capitalGRM: nextBalance,
    profitGRM: Number(baseEconomy.profitGRM || 0) + safeIncome,
    employeeCount: Math.max(1, members.length),
  } as CompanyEconomyLike);

  setCompanyEconomyRuntimeState(
    {
      ...company,
      balance: nextBalance,
    },
    updatedEconomy,
  );
}

const LEVEL_REQUIREMENTS = BALANCE_CONFIG.company.levelRequirements;

async function applyHackathonRewards() {
  const beforeState = getWeeklyHackathonState();
  const result = await applyWeeklyHackathonRewards({
    updateCompanyBalance: async (companyId, addGrm) => {
      const company = await storage.getCompany(companyId);
      if (!company) return;
      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) + Math.max(0, Math.floor(addGrm || 0)),
      });
    },
    addCompanyPart: async (companyId, quality) => {
      const dropped = rollRandomPartDrop(100, { allowedQualities: [quality] });
      if (!dropped) return;
      const current = companyWarehousePartsByCompanyId.get(companyId) ?? [];
      const next = [...current];
      const existingIndex = next.findIndex((item: any) => String(item?.id || "") === dropped.id);
      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: Math.max(1, Number(next[existingIndex]?.quantity || 1)) + 1,
        };
      } else {
        next.push({
          id: dropped.id,
          name: dropped.title,
          rarity: dropped.rarity,
          quantity: 1,
          type: "part",
          partType: dropped.partType,
          deviceCategory: dropped.deviceCategory,
        });
      }
      companyWarehousePartsByCompanyId.set(companyId, next);
    },
    updatePlayerGramBalance: async (userId, addGrm) => {
      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return;
      const current = Number((snapshot.game as any)?.gramBalance || 0);
      applyGameStatePatch(userId, { gramBalance: Number((current + Math.max(0, addGrm)).toFixed(2)) });
    },
    addPlayerPart: async (userId, quality) => {
      const dropped = rollRandomPartDrop(100, { allowedQualities: [quality] });
      if (!dropped) return;
      await transferMarketPartToPlayerInventory(userId, {
        id: dropped.id,
        name: dropped.title,
        rarity: dropped.rarity,
        type: "part",
      });
    },
  });
  if (!result.applied) return;
  if (result.mvpPlayerId) {
    createNotification(result.mvpPlayerId, {
      type: "HACKATHON_RESULT",
      title: "🎯 Награда MVP хакатона",
      message: `Ты стал самым полезным участником хакатона и получил +${Number(result.mvpRewardGrm || 0)} GRM.`,
      dataJson: {
        mvpRewardGrm: Number(result.mvpRewardGrm || 0),
      },
    });
    const telegramId = Number(getTelegramIdByUserId(result.mvpPlayerId) || 0);
    if (telegramId) {
      await sendTelegramBotText(
        telegramId,
        [
          "🎯 Награда MVP хакатона",
          `+${Number(result.mvpRewardGrm || 0)} GRM`,
          "Ты стал самым полезным участником хакатона по суммарному вкладу.",
        ].join("\n"),
      );
    }
  }
  const winners = result.winners ?? [];
  const winnerPlaces = new Map<string, number>();
  for (const [index, winner] of winners.entries()) {
    winnerPlaces.set(String(winner.companyId), index + 1);
  }
  const registeredCompanies = Array.isArray(beforeState?.registeredCompanies) ? beforeState.registeredCompanies : [];
  for (const company of registeredCompanies) {
    const companyId = String(company?.companyId || "");
    if (!companyId) continue;
    recordCompanyHackathonPlacement(companyId, winnerPlaces.get(companyId) ?? null);
    const members = await storage.getCompanyMembers(companyId);
    const place = winnerPlaces.get(companyId);
    if (place) {
      createNotifications(
        members.map((member) => member.userId),
        {
          type: "HACKATHON_RESULT",
          title: "🏁 Хакатон завершён",
          message: `Компания «${String(company?.companyName || "Компания")}» заняла ${place} место.`,
          dataJson: {
            companyId,
            place,
          },
        },
      );
    }
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await refreshGlobalEventsCache(true);
  startGlobalEventScheduler();
  startPvpTestBotLoop();
  startWeeklyHackathonScheduler({
    resolvePlayerSnapshot: async (userId) => {
      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return null;
      const companies = await storage.getAllCompanies();
      let memberCreatedAt: number | null = null;
      for (const company of companies) {
        if (company.ownerId === userId) {
          const ownerMember = await storage.getMemberByUserId(company.id, userId);
          memberCreatedAt = Number(ownerMember?.createdAt || 0) || null;
          break;
        }
        const member = await storage.getMemberByUserId(company.id, userId);
        if (member) {
          memberCreatedAt = Number(member.createdAt || 0) || null;
          break;
        }
      }
      const recentPvpLogs = await storage.getPvpDuelHistoryByUser(userId, 200);
      const recentSinceSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      return {
        userId,
        username: String(snapshot.user?.username || "Игрок"),
        skills: { ...((snapshot.game as any)?.skills ?? {}) },
        level: Number(snapshot.user?.level || 1),
        membershipCreatedAt: memberCreatedAt,
        totalPvpBattles: Number(snapshot.user?.pvpMatches || 0),
        recentPvpBattles7d: recentPvpLogs.filter((row) => Number(row.createdAt || 0) >= recentSinceSec).length,
      };
    },
    onAutoEnd: async () => {
      await applyHackathonRewards();
    },
  });
  await startCompanyStockDailyScheduler({
    onCompanyUpdated: async ({ company, historyEntry, summary }) => {
      const members = await storage.getCompanyMembers(company.companyId);
      const text = [
        "📊 Дневное изменение акций компании",
        `🏢 ${company.companyName}`,
        `Цена: ${historyEntry.previousPrice} → ${historyEntry.newPrice} GRM`,
        `Изменение: ${historyEntry.deltaPercent > 0 ? "+" : ""}${historyEntry.deltaPercent}%`,
        summary.length ? `Факторы: ${summary.join(", ")}` : "Факторы: без сильных изменений",
      ].join("\n");
      for (const member of members) {
        const telegramId = Number(getTelegramIdByUserId(member.userId) || 0);
        if (!telegramId) continue;
        await sendTelegramBotText(telegramId, text);
      }
    },
  });
  setInterval(() => {
    void (async () => {
      const companies = await storage.getAllCompanies();
      for (const company of companies) {
        try {
          await syncCompanyBlueprintResearchProject(company);
        } catch (error) {
          console.warn("Failed to sync company blueprint research tick:", error);
        }
      }
    })();
  }, BLUEPRINT_RESEARCH_TICK_SECONDS * 1000);

  setInterval(() => {
    void settleExpiredAuctions().catch((error) => {
      console.warn("Failed to settle expired auctions:", error);
    });
  }, 15 * 1000);

  registerRegistrationRoutes(app, {
    storage,
    insertUserSchema,
    cleanupOldTimestamps,
    deviceRegistrationTimestamps,
    ipRegistrationTimestamps,
    getUserIdByTelegramId,
    bindTelegramIdToUser,
    isValidRegistrationSkillsAllocation,
    normalizeRegistrationSkillsAllocation,
    countRegistrationSkillPoints,
    REGISTRATION_INITIAL_SKILL_POINTS,
    resolveRegistrationCityName,
    resolveRegistrationPersonalityId,
    applyGameStatePatch,
    generateReferralCode,
    userReferralCodes,
    referralCodeToUserId,
    referredByUserId,
    referralChildrenByUserId,
    serializeSafeUser,
    buildRegistrationOptions,
    submitRegistrationAnswer,
    buildPlayerRegistrationState,
    ensureRegistrationTutorialCompany,
    getUserWithGameState,
    getTutorialState,
    getCurrentInterviewQuestion,
    saveRegistrationProgress,
    completeRegistration,
  });

  registerPlayerRoutes(app, {
    storage,
    getUserWithGameState,
    getTutorialState,
    buildPlayerRegistrationState,
    getCurrentInterviewQuestion,
    serializeSafeUser,
    applyGameStatePatch,
    assertFeatureEnabled,
    getStockMarketSnapshot,
    buyStockAsset,
    sellStockAsset,
    applyTutorialEvent,
    getTutorialActiveStep,
    getTutorialProgressText,
    TUTORIAL_STEP_CONTENT,
    startTutorial,
    isTutorialCompany,
    TUTORIAL_DEMO_COMPANY_NAME,
    assignTutorialDemoCompany,
    removeProducedGadget,
    companyGadgets,
    companyBlueprints,
    clearTutorialDemoCompany,
    completeTutorial,
    TUTORIAL_DEMO_BLUEPRINT,
    TutorialEventTypes: [
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
    ] as const,
    PLAYABLE_PROFESSIONS,
    PROFESSION_UNLOCK_LEVEL,
    getPlayerProfessionId,
    getProfessionById,
    canSelectProfession,
    isProfessionId,
    setPlayerProfession,
    resolvePlayerCompanyMembership,
  });

  registerPvpRoutes(app, {
    storage,
    assertFeatureEnabled,
    isPvpBotUsername,
    isTutorialCompany,
    getPvpQueueState,
    updatePvpHeartbeat,
    flushCompletedPvpDuels,
    canEnterPvp,
    getPvpAccessMessage,
    getUtcDayStamp,
    getPvpBoostCatalog,
    getPvpShopRotation,
    PVP_DUEL_CONFIG,
    spendGram,
    purchasePvpBoost,
    startActivePvpDuelNow,
    selectPvpTactic,
    getUserWithGameState,
    resolvePlayerCompanyMembership,
    getContractsByCity,
    readDuelSkills,
    readEquippedPvpGadget,
    computePvpPowerScore,
    queuePlayerForPvp,
    runPvpMatchmaking,
    leavePvpQueue,
    clearPendingPvpBoosts,
    clearPendingPvpTactics,
    consumePendingPvpResult,
    rollPvpRewardPart,
    transferMarketPartToPlayerInventory,
    applyGadgetWear,
    getCurrencySymbol,
    trackDailyQuestEvent,
  });

  registerDailyQuestRoutes(app, {
    getUserWithGameState,
    applyGameStatePatch,
  });

  registerNotificationRoutes(app);

  registerHomeDashboardRoutes(app, {
    getUserWithGameState,
    getContractsByCity,
    isTutorialCompany,
  });

  registerHackathonRoutes(app, {
    storage,
    getWeeklyHackathonState,
    formatWeeklyHackathonTop,
    getHackathonRoundView,
    getWeeklyHackathonPlayerStats,
    getWeeklyHackathonCompanyScore,
    getWeeklyHackathonSabotageState,
    WEEKLY_HACKATHON_CONFIG,
    registerCompanyForWeeklyHackathon,
    resolvePlayerCompanyMembership,
    validateHackathonEligibility,
    joinPlayerToWeeklyHackathonTeam,
    getUserWithGameState,
    getEffectiveCompanyDepartmentEffects,
    applyGameStatePatch,
    contributeSkillToWeeklyHackathon,
    spendGram,
    contributeGrmToWeeklyHackathon,
    ALL_PARTS,
    HACKATHON_ALLOWED_PART_TYPES,
    contributePartToWeeklyHackathon,
    isCompanyHackathonManagerRole,
    getRegisteredHackathonCompany,
    upgradeWeeklyHackathonSabotageLevel,
    upgradeWeeklyHackathonDefenseLevel,
    getAvailableHackathonSabotageTypes,
    getAvailableHackathonDefenseTypes,
    applyWeeklyHackathonSabotage,
    applyWeeklyHackathonDefense,
    recordCompanyHackathonParticipation,
    recordCompanyTaskContribution,
    recordCompanyMoneyContribution,
    recordCompanyPartsContribution,
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
        city: "Санкт-Петербург",
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
      return res.status(400).json({ error: "Пассивный доход уже получен сегодня" });
    }

    const referrals = Array.from(referralChildrenByUserId.get(user.id) ?? []);
    const referralUsers = (await Promise.all(referrals.map((id) => storage.getUser(id)))).filter(Boolean) as any[];
    if (referralUsers.length === 0) {
      return res.status(400).json({ error: "Нет рефералов для начисления" });
    }

    const tier = resolvePassiveTier(referralUsers.length);
    const rawIncome = referralUsers.reduce((sum, refUser) => sum + refUser.balance * (tier.percentage / 100), 0);
    const payout = Math.min(tier.cap, Math.floor(rawIncome));
    if (payout <= 0) {
      return res.status(400).json({ error: "Нет доступного пассивного дохода" });
    }

    const updated = await storage.updateUser(user.id, { balance: user.balance + payout });
    claimedDays.add(dayKey);
    referralClaimHistory.set(user.id, claimedDays);

    const { password, ...safeUser } = updated;
    res.json({ ok: true, payout, tier, user: safeUser });
  });

  // Создание компании
  app.post("/api/company", async (req, res) => {
    let debitedOwner: { id: string; balance: number } | null = null;
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const { ownerId, username, city } = req.body;
      const name = normalizeCompanyNameInput(req.body?.name);
      const emoji = normalizeCompanyEmojiInput(req.body?.emoji);
      console.log("🏢 Creating company:", { name, emoji, ownerId, username, city });

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
      console.log("✅ Company created:", company.id);
      res.json({ ...company, creationCost });
    } catch (error) {
      if (debitedOwner) {
        await storage.updateUser(debitedOwner.id, { balance: debitedOwner.balance });
      }
      console.error("Create company error:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // Получение всех компаний
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

  // Получение компаний по городу
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

  // Получение компании по ID
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

  app.get("/api/companies/:id/stock", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const members = await storage.getCompanyMembers(company.id);
      const runtime = companyEconomyByCompanyId.get(String(company.id))
        ?? reconcileCompanyEconomy({
          ...company,
          employeeCount: members.length,
        } as CompanyEconomyLike);
      const eligibility = await buildCompanyIpoEligibility(company, runtime);
      const preview = await buildCompanyStockPreview(company, runtime);
      const options = buildCompanyIpoOptions({ city: company.city }, eligibility);
      const dividends = await getCompanyDividendSnapshot(company.id);
      res.json({
        economy: runtime,
        eligibility,
        preview,
        options,
        dividends,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to get company stock data" });
    }
  });

  app.post("/api/companies/:id/ipo/run", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      if (company.ownerId !== userId) {
        return res.status(403).json({ error: "Только CEO может вывести компанию на IPO." });
      }
      const ipoTypeId = String(req.body?.ipoTypeId || "boosted");
      const members = await storage.getCompanyMembers(company.id);
      const runtime = companyEconomyByCompanyId.get(String(company.id))
        ?? reconcileCompanyEconomy({
          ...company,
          employeeCount: members.length,
        } as CompanyEconomyLike);
      const eligibility = await buildCompanyIpoEligibility(company, runtime);
      const result = launchCompanyIpo(runtime, eligibility, ipoTypeId as any);
      if (!result.ok) {
        return res.status(400).json({ error: result.reason || "IPO недоступно" });
      }
      const saved = setCompanyEconomyRuntimeState(company, result.company);
      res.json({
        ok: true,
        company: saved,
        sharePrice: result.sharePrice,
        ipoTypeId,
        investmentGrm: result.variant?.investmentGrm ?? 0,
        eligibility,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to run IPO" });
    }
  });

  app.post("/api/companies/:id/dividends/declare", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      const payoutPerShareGrm = Number(req.body?.payoutPerShareGrm || 0);
      if (!userId) return res.status(400).json({ error: "userId is required" });
      if (company.ownerId !== userId) {
        return res.status(403).json({ error: "Только CEO может объявлять дивиденды." });
      }
      const members = await storage.getCompanyMembers(company.id);
      const runtime = companyEconomyByCompanyId.get(String(company.id))
        ?? reconcileCompanyEconomy({
          ...company,
          employeeCount: members.length,
        } as CompanyEconomyLike);
      if (!runtime.shares.isPublic) {
        return res.status(400).json({ error: "Дивиденды доступны только публичной компании." });
      }
      const dividendSnapshot = await getCompanyDividendSnapshot(company.id);
      const totalPayoutGrm = Number((dividendSnapshot.distributedShares * Math.max(0, payoutPerShareGrm)).toFixed(2));
      if (totalPayoutGrm <= 0) {
        return res.status(400).json({ error: "Сумма дивидендов должна быть больше нуля." });
      }
      if (runtime.capitalGRM < totalPayoutGrm) {
        return res.status(400).json({ error: "Недостаточно GRM на балансе компании." });
      }
      const payout = await declareCompanyDividends(company.id, payoutPerShareGrm);
      const saved = setCompanyEconomyRuntimeState(company, reconcileCompanyEconomy({
        ...runtime,
        capitalGRM: Number((runtime.capitalGRM - payout.totalPayoutGrm).toFixed(2)),
        shares: {
          ...runtime.shares,
          lastDividendPerShareGRM: Number(payoutPerShareGrm.toFixed(2)),
          lastDividendAt: Date.now(),
        },
      }));
      res.json({
        ok: true,
        payout,
        company: saved,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to declare dividends" });
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
      const actorAccess = canManageCompanyAssets({
        actorUserId,
        companyOwnerId: company.ownerId,
        role: (await storage.getMemberByUserId(company.id, actorUserId))?.role,
      });
      if (!actorAccess) {
        return res.status(403).json({ error: "Назначать сотрудников по отделам могут только CEO и заместитель" });
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

  app.post("/api/companies/:id/staffing/role", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });

      const actorUserId = String(req.body?.actorUserId || "");
      const targetUserId = String(req.body?.targetUserId || "");
      const role = String(req.body?.role || "").trim().toLowerCase();
      if (!actorUserId || !targetUserId || !role) {
        return res.status(400).json({ error: "actorUserId, targetUserId и role обязательны" });
      }
      if (String(company.ownerId) !== actorUserId) {
        return res.status(403).json({ error: "Назначать заместителя может только CEO" });
      }
      if (String(company.ownerId) === targetUserId) {
        return res.status(400).json({ error: "CEO нельзя переназначить через этот экран" });
      }
      if (!["member", "deputy"].includes(role)) {
        return res.status(400).json({ error: "Неизвестная роль" });
      }

      const targetMember = await storage.getMemberByUserId(company.id, targetUserId);
      if (!targetMember) return res.status(404).json({ error: "Сотрудник не найден" });

      if (role === "deputy") {
        const members = await storage.getCompanyMembers(company.id);
        for (const member of members) {
          if (member.userId !== targetUserId && String(member.role || "").toLowerCase() === "deputy") {
            await storage.updateCompanyMemberRole(company.id, member.userId, "member");
          }
        }
      }

      const updated = await storage.updateCompanyMemberRole(company.id, targetUserId, role);
      createNotification(targetUserId, {
        type: "COMPANY_ROLE_ASSIGNED",
        title: role === "deputy" ? "👔 Тебя назначили заместителем CEO" : "👤 Твоя роль в компании обновлена",
        message:
          role === "deputy"
            ? `Теперь ты заместитель CEO в компании «${company.name}».`
            : `В компании «${company.name}» тебе вернули обычную роль сотрудника.`,
        dataJson: {
          companyId: company.id,
          companyName: company.name,
          role,
        },
      });
      const staffing = await getCompanyStaffingSnapshot(company.id);
      const economy = reconcileCompanyEconomy({
        ...(company as CompanyEconomyLike),
        employeeCount: staffing.members.length,
      });
      const effects = getDepartmentEffects(economy.departments, staffing);
      res.json({ ok: true, member: updated, staffing, effects });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to update role" });
    }
  });

  app.get("/api/companies/:id/member-stats", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const stats = await ensureCompanyMemberStatsSeeded(company.id);
      res.json({ companyId: company.id, items: stats });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to get company member stats" });
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
        createNotification(String(userId), {
          type: "COMPANY_JOIN_ACCEPTED",
          title: "🏢 Тебя приняли в компанию",
          message: `Компания «${company.name}» одобрила твою заявку.`,
          dataJson: {
            companyId: company.id,
            companyName: company.name,
          },
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

    const current = await syncBlueprintStateForCompany(company);
    const productionOrder = syncCompanyProductionOrder(company.id);
    res.json({
      available: isTutorialCompany(company) ? [buildTutorialBlueprintView()] : getAvailableBlueprints(company.level),
      active: await buildBlueprintResearchApiView(company, current),
      produced: companyGadgets.get(company.id) ?? [],
      productionOrder,
    });
  });

  app.get("/api/companies/:id/exclusive", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const productionOrder = syncCompanyProductionOrder(company.id);
      const produced = companyGadgets.get(company.id) ?? [];
      res.json({
        active: getExclusiveProject(company.id),
        catalog: getExclusiveCatalog(company.id),
        produced: produced.filter((item) => item.isExclusive),
        upgradeCandidates: getExclusiveUpgradeCandidates(company.id),
        productionOrder,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load exclusive gadgets" });
    }
  });

  app.post("/api/companies/:id/exclusive/preview", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      const gadgetId = String(req.body?.gadgetId || "");
      const seedPartsInput = Array.isArray(req.body?.seedParts) ? req.body.seedParts : [];
      await requireCompanyAssetManagerAccess({ company, userId, action: "exclusive_preview" });
      if (!gadgetId) return res.status(400).json({ error: "Для EX-апгрейда сначала выберите базовый гаджет компании" });
      if (seedPartsInput.length !== EXCLUSIVE_UPGRADE_REQUIRED_PARTS) {
        return res.status(400).json({ error: `Для апгрейда нужно выбрать ровно ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей` });
      }
      const produced = companyGadgets.get(company.id) ?? [];
      const targetGadget = produced.find((item) => item.id === gadgetId);
      if (!targetGadget) return res.status(404).json({ error: "Базовый гаджет для апгрейда не найден" });
      const targetBatch = getProducedGadgetUpgradeBatch(company.id, gadgetId, EXCLUSIVE_UPGRADE_REQUIRED_GADGETS);
      if (targetBatch.length < EXCLUSIVE_UPGRADE_REQUIRED_GADGETS) {
        return res.status(400).json({ error: `Для EX-апгрейда нужно минимум ${EXCLUSIVE_UPGRADE_REQUIRED_GADGETS} одинаковых обычных гаджетов этой модели` });
      }
      const currentLevel = getProducedGadgetExclusiveLevel(targetGadget);
      if (currentLevel >= EXCLUSIVE_UPGRADE_MAX_LEVEL) {
        return res.status(400).json({ error: `Гаджет уже достиг максимального уровня EX+${EXCLUSIVE_UPGRADE_MAX_LEVEL}` });
      }
      const normalizedSeedParts = seedPartsInput.map((item: any) => ({
        id: String(item.id),
        rarity: String(item.rarity || "Common") as any,
        type: String(item.type || ALL_PARTS[String(item.id)]?.type || "processor") as any,
        name: String(item.name || ALL_PARTS[String(item.id)]?.name || item.id),
      })) as ExclusiveSeedPart[];
      const invalidPart = normalizedSeedParts.find((part) => !isPartCompatibleWithExclusiveCategory(targetGadget.category, part.type));
      if (invalidPart) {
        return res.status(400).json({ error: `Деталь ${invalidPart.name || invalidPart.id} не подходит для апгрейда этого гаджета` });
      }
      const blueprint = buildExclusiveUpgradeBlueprint({
        companyId: company.id,
        companyName: company.name,
        gadget: targetGadget,
        selectedParts: normalizedSeedParts.map((part) => ({
          id: part.id,
          name: part.name,
          rarity: String(part.rarity || "Common"),
          type: String(part.type || "processor"),
        })),
      });
      res.json({
        blueprint,
        companyBalanceAfterStart: Number(company.balance || 0) - Number(blueprint.developmentCostGrm || 0),
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to preview exclusive upgrade" });
    }
  });

  app.post("/api/companies/:id/exclusive/start", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      const gadgetId = String(req.body?.gadgetId || "");
      const seedPartsInput = Array.isArray(req.body?.seedParts) ? req.body.seedParts : [];
      const selectedPartsCount = seedPartsInput.length;
      await requireCompanyAssetManagerAccess({ company, userId, action: "exclusive_start" });
      if (!gadgetId) {
        return res.status(400).json({ error: "Для EX-апгрейда сначала выберите базовый гаджет компании" });
      }
      if (getExclusiveProject(company.id)?.status === "in_progress") {
        return res.status(400).json({ error: "У компании уже идет разработка эксклюзивного гаджета" });
      }

      const normalizedSeedParts = seedPartsInput.map((item: any) => ({
        id: String(item.id),
        rarity: String(item.rarity || "Common") as any,
        type: String(item.type || ALL_PARTS[String(item.id)]?.type || "processor") as any,
        name: String(item.name || ALL_PARTS[String(item.id)]?.name || item.id),
      })) as ExclusiveSeedPart[];
      const snapshot = await getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "CEO snapshot not found" });
      let blueprint: ExclusiveBlueprintDefinition;
      let reservedTargetGadget: ProducedGadget | null = null;

      if (selectedPartsCount !== EXCLUSIVE_UPGRADE_REQUIRED_PARTS) {
        return res.status(400).json({ error: `Для апгрейда нужно выбрать ровно ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей` });
      }
      const produced = companyGadgets.get(company.id) ?? [];
      const targetGadget = produced.find((item) => item.id === gadgetId);
      if (!targetGadget) return res.status(404).json({ error: "Базовый гаджет для апгрейда не найден" });
      const targetBatch = getProducedGadgetUpgradeBatch(company.id, gadgetId, EXCLUSIVE_UPGRADE_REQUIRED_GADGETS);
      if (targetBatch.length < EXCLUSIVE_UPGRADE_REQUIRED_GADGETS) {
        return res.status(400).json({ error: `Для EX-апгрейда нужно минимум ${EXCLUSIVE_UPGRADE_REQUIRED_GADGETS} одинаковых обычных гаджетов этой модели` });
      }
      const currentLevel = getProducedGadgetExclusiveLevel(targetGadget);
      if (currentLevel >= EXCLUSIVE_UPGRADE_MAX_LEVEL) {
        return res.status(400).json({ error: `Гаджет уже достиг максимального уровня EX+${EXCLUSIVE_UPGRADE_MAX_LEVEL}` });
      }
      if (targetGadget.isBroken) {
        return res.status(400).json({ error: "Сначала нужно отремонтировать гаджет, а потом запускать апгрейд" });
      }
      if (normalizedSeedParts.length !== EXCLUSIVE_UPGRADE_REQUIRED_PARTS) {
        return res.status(400).json({ error: `Для апгрейда нужно выбрать ровно ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей` });
      }
      const invalidPart = normalizedSeedParts.find((part) => !isPartCompatibleWithExclusiveCategory(targetGadget.category, part.type));
      if (invalidPart) {
        return res.status(400).json({ error: `Деталь ${invalidPart.name || invalidPart.id} не подходит для апгрейда этого гаджета` });
      }
      blueprint = buildExclusiveUpgradeBlueprint({
        companyId: company.id,
        companyName: company.name,
        gadget: targetGadget,
        selectedParts: normalizedSeedParts.map((part) => ({
          id: part.id,
          name: part.name,
          rarity: String(part.rarity || "Common"),
          type: String(part.type || "processor"),
        })),
      });
      const reservedBatch = targetBatch
        .map((item) => removeProducedGadget(company.id, item.id))
        .filter(Boolean) as ProducedGadget[];
      reservedTargetGadget = reservedBatch[0] ?? null;
      if (reservedBatch.length !== EXCLUSIVE_UPGRADE_REQUIRED_GADGETS || !reservedTargetGadget) {
        for (const gadget of reservedBatch) {
          const producedList = companyGadgets.get(company.id) ?? [];
          producedList.push(gadget);
          companyGadgets.set(company.id, producedList);
        }
        return res.status(404).json({ error: "Не удалось зарезервировать партию базовых гаджетов для апгрейда" });
      }

      if (Number(company.balance || 0) < Number(blueprint.developmentCostGrm || 0)) {
        for (const gadget of reservedBatch) {
          const producedList = companyGadgets.get(company.id) ?? [];
          producedList.push(gadget);
          companyGadgets.set(company.id, producedList);
        }
        return res.status(400).json({ error: `Недостаточно GRM компании для старта разработки (${blueprint.developmentCostGrm} GRM)` });
      }
      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - Number(blueprint.developmentCostGrm || 0),
      });
      await appendEconomyAuditEvent({
        eventType: "COMPANY_FUNDS_SPENT",
        userId: String(userId),
        companyId: company.id,
        amount: Number(blueprint.developmentCostGrm || 0),
        status: "success",
        reason: "exclusive_upgrade_start",
        metadata: {
          blueprintId: blueprint.id,
          targetGadgetId: reservedTargetGadget?.id ?? null,
        },
      });

      const project: ExclusiveProjectState = {
        blueprint,
        status: "in_progress",
        progressHours: 0,
        startedAt: Date.now(),
        readyAt: Date.now() + Math.round(Number(blueprint.developmentHoursRequired || 0) * 60 * 60 * 1000),
        investedResearch: createEmptyExclusiveResearchMap(),
        progressTicks: 0,
        lastContribution: createEmptyExclusiveResearchMap(),
        participantUserIds: [userId],
        targetGadget: reservedTargetGadget
          ? {
              id: reservedTargetGadget.id,
              name: reservedTargetGadget.name,
              category: reservedTargetGadget.category,
              stats: { ...(reservedTargetGadget.stats || {}) },
              quality: Number(reservedTargetGadget.quality || 1),
              reliability: Number(reservedTargetGadget.reliability ?? 1),
              condition: Number(reservedTargetGadget.condition || reservedTargetGadget.maxCondition || 100),
              maxCondition: Number(reservedTargetGadget.maxCondition || 100),
              minPrice: Number(reservedTargetGadget.minPrice || 0),
              maxPrice: Number(reservedTargetGadget.maxPrice || 0),
              exclusiveLevel: getProducedGadgetExclusiveLevel(reservedTargetGadget),
            }
          : undefined,
        reservedBatchGadgets: reservedBatch.map((gadget) => ({
          id: gadget.id,
          name: gadget.name,
          baseName: gadget.baseName,
          category: gadget.category,
          stats: { ...(gadget.stats || {}) },
          quality: Number(gadget.quality || 1),
          reliability: Number(gadget.reliability ?? 1),
          condition: Number(gadget.condition || gadget.maxCondition || 100),
          maxCondition: Number(gadget.maxCondition || 100),
          minPrice: Number(gadget.minPrice || 0),
          maxPrice: Number(gadget.maxPrice || 0),
          exclusiveLevel: getProducedGadgetExclusiveLevel(gadget),
        })),
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
      if (project.targetGadget) {
        const readyAt = Number(project.readyAt || (project.startedAt + Number(project.blueprint.developmentHoursRequired || 0) * 60 * 60 * 1000));
        const totalMs = Math.max(1, readyAt - Number(project.startedAt || Date.now()));
        const remainingMs = Math.max(0, readyAt - Date.now());
        const percent = Math.max(0, Math.min(100, Math.round(((totalMs - remainingMs) / totalMs) * 100)));
        project.progressTicks = Math.max(0, Number(project.progressTicks || 0)) + 1;
        project.progressHours = Number((((totalMs - remainingMs) / (60 * 60 * 1000))).toFixed(2));
        if (remainingMs > 0) {
          exclusiveProjectByCompanyId.set(company.id, project);
          const gadgetWear = await applyGadgetWear(userId, {
            cause: "blueprint_development",
            qualityHint: Number(project.blueprint.successChance || 1),
          });
          return res.json({
            ...project,
            progressGain: 0,
            contribution: createEmptyExclusiveResearchMap(),
            research: {
              required: createEmptyExclusiveResearchMap(),
              invested: createEmptyExclusiveResearchMap(),
              totalRequired: totalMs,
              totalInvested: totalMs - remainingMs,
              percent,
              isComplete: false,
            },
            remainingMs,
            gadgetWear: gadgetWear.report,
          });
        }

        if (!project.upgradeResolved) {
          project.upgradeResolved = true;
          project.completedAt = Date.now();
          if (Math.random() <= Number(project.blueprint.successChance || 0)) {
            project.status = "production_ready";
            setExclusiveCatalog(company.id, [project.blueprint, ...getExclusiveCatalog(company.id)]);
          } else {
            project.status = "failed";
            project.failedReason = `Апгрейд не стабилизировался. На склад компании возвращена партия из ${EXCLUSIVE_UPGRADE_REQUIRED_GADGETS} гаджетов`;
            if (!project.targetReturned && Array.isArray(project.reservedBatchGadgets) && project.reservedBatchGadgets.length) {
              const produced = companyGadgets.get(company.id) ?? [];
              for (const gadget of project.reservedBatchGadgets) {
                produced.push({
                  id: gadget.id,
                  blueprintId: project.blueprint.targetGadgetId || gadget.id,
                  companyId: company.id,
                  name: gadget.name,
                  baseName: gadget.baseName || project.blueprint.targetGadgetName || gadget.name,
                  category: gadget.category,
                  stats: { ...(gadget.stats || {}) },
                  quality: Number(gadget.quality || 1),
                  minPrice: Number(gadget.minPrice || 0),
                  maxPrice: Number(gadget.maxPrice || 0),
                  durability: Number(gadget.maxCondition || 100),
                  maxDurability: Number(gadget.maxCondition || 100),
                  condition: Number(gadget.condition || gadget.maxCondition || 100),
                  maxCondition: Number(gadget.maxCondition || 100),
                  reliability: Number(gadget.reliability ?? 1),
                  producedAt: Date.now(),
                  acquisitionSource: "company_production",
                  acquiredAt: Date.now(),
                  lastAuctionPurchaseAt: null,
                  isExclusive: Number(gadget.exclusiveLevel || 0) > 0,
                  exclusiveLevel: Number(gadget.exclusiveLevel || 0),
                });
              }
              companyGadgets.set(company.id, produced);
              project.targetReturned = true;
            }
          }
        }
        exclusiveProjectByCompanyId.set(company.id, project);
        const gadgetWear = await applyGadgetWear(userId, {
          cause: "blueprint_development",
          qualityHint: Number(project.blueprint.successChance || 1),
        });
        return res.json({
          ...project,
          progressGain: 0,
          contribution: createEmptyExclusiveResearchMap(),
          research: {
            required: createEmptyExclusiveResearchMap(),
            invested: createEmptyExclusiveResearchMap(),
            totalRequired: totalMs,
            totalInvested: totalMs,
            percent: 100,
            isComplete: true,
          },
          remainingMs: 0,
          gadgetWear: gadgetWear.report,
        });
      }
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
          project.failedReason = "Не удалось довести EX-апгрейд до стабильного релиза";
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
      await requireCompanyAssetManagerAccess({ company, userId, action: "exclusive_produce" });
      const activeOrder = syncCompanyProductionOrder(company.id);
      if (activeOrder) {
        return res.status(400).json({
          error: activeOrder.status === "ready_to_claim"
            ? "У компании уже есть готовая партия. Сначала заберите выпуск."
            : "У компании уже идет производство партии.",
        });
      }
      const catalog = getExclusiveCatalog(company.id);
      const blueprint = catalog.find((item) => item.id === blueprintId);
      if (!blueprint) return res.status(404).json({ error: "Эксклюзивный чертеж не найден" });
      if (blueprint.remainingUnits <= 0) return res.status(400).json({ error: "Лимит выпуска этого гаджета исчерпан" });
      const upgradeProject = blueprint.targetGadgetId ? getExclusiveProject(company.id) : null;

      const actualQuantity = blueprint.targetGadgetId ? 1 : Math.min(quantity, blueprint.remainingUnits);
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      const gramCost = blueprint.productionCostGram > 0
        ? Math.max(1, Math.round(blueprint.productionCostGram * actualQuantity * departmentEffects.productionCostMultiplier))
        : 0;
      if (gramCost > 0 && Number(company.balance || 0) < gramCost) {
        return res.status(400).json({ error: `Недостаточно GRM компании для производства (${gramCost} GRM)` });
      }
      if (gramCost > 0) {
        await storage.updateCompany(company.id, {
          balance: Number(company.balance || 0) - gramCost,
        });
        await appendEconomyAuditEvent({
          eventType: "COMPANY_FUNDS_SPENT",
          userId: String(userId),
          companyId: company.id,
          amount: gramCost,
          status: "success",
          reason: "exclusive_production_start",
          metadata: {
            blueprintId: blueprint.id,
            quantity: actualQuantity,
          },
        });
      }
      const ceoUser = await storage.getUser(company.ownerId);
      const ceoAdvanced = ceoUser ? getAdvancedPersonalityId(ceoUser) : null;
      const quality = Number(
        (
          (1 + departmentEffects.gadgetQualityBonus + blueprint.successChance * 0.35)
          * (1 - getBatchQualityPenalty(actualQuantity))
        ).toFixed(2),
      );
      const durationSeconds = calculateExclusiveProductionDurationSeconds({
        blueprintId: blueprint.id,
        category: blueprint.category,
        quantity: actualQuantity,
        departmentEffects,
        ceoAdvanced,
      });
      const startedAt = Date.now();
      const order: CompanyProductionOrder = {
        id: randomUUID(),
        companyId: company.id,
        kind: "exclusive",
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        baseName: blueprint.targetGadgetName || blueprint.name,
        category: blueprint.category,
        quantity: actualQuantity,
        startedAt,
        readyAt: startedAt + durationSeconds * 1000,
        status: "in_progress",
        quality,
        stats: Object.fromEntries(
          Object.entries(blueprint.baseStats).map(([key, value]) => [key, Number((Number(value) * quality).toFixed(2))]),
        ),
        minPrice: blueprint.targetGadgetId
          ? Math.max(100, Math.round(Number(upgradeProject?.targetGadget?.minPrice || 0) * Math.max(1, quality)))
          : Math.round(blueprint.productionCostGram * quality * 6),
        maxPrice: blueprint.targetGadgetId
          ? Math.max(150, Math.round(Number(upgradeProject?.targetGadget?.maxPrice || 0) * Math.max(1.1, quality)))
          : Math.round(blueprint.productionCostGram * quality * 9),
        gramCost,
        isExclusive: true,
        exclusiveLevel: Math.max(1, Number(blueprint.upgradeLevel || 1)),
        exclusiveBonusType: blueprint.bonusType,
        exclusiveBonusValue: blueprint.bonusValue,
        exclusiveBonusLabel: blueprint.bonusLabel,
      };
      companyProductionOrders.set(company.id, order);

      blueprint.remainingUnits -= actualQuantity;
      setExclusiveCatalog(company.id, catalog.map((item) => (item.id === blueprint.id ? { ...blueprint } : item)));

      const gadgetWear = await applyGadgetWear(userId, {
        cause: "production",
        qualityHint: Number(order.quality || 1),
      });
      res.json({
        started: true,
        order,
        durationSeconds,
        blueprint: { ...blueprint },
        companyBalance: Number(company.balance || 0) - gramCost,
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
    await requireCompanyAssetManagerAccess({ company, userId, action: "blueprint_start" });
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
    const globalOwner = getGlobalBlueprintOwner(normalizedBlueprintId);
    if (globalOwner && globalOwner.companyId !== company.id) {
      return res.status(400).json({ error: `Этот чертёж уже разработан компанией ${globalOwner.companyName}` });
    }
    const current = await syncBlueprintStateForCompany(company);
    if (current && current.status === "in_progress") {
      return res.status(400).json({ error: "У компании уже идет активная разработка чертежа" });
    }
    await assertBlueprintResearchAvailability(String(userId), company.id);

    if (!isTutorial) {
      const settings = await getGameSettings();
      const winnerBoost = getWinnerBoostForCompany(company.id);
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      let blueprintCost = Math.max(
        1,
        Math.round((Number(blueprint.production?.costGram || 1) * 25) * Math.max(0.1, settings.multipliers.blueprintCostMultiplier)),
      );
      if (winnerBoost && typeof winnerBoost.researchCostMultiplier === "number") {
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
      await appendEconomyAuditEvent({
        eventType: "COMPANY_FUNDS_SPENT",
        userId: String(userId),
        companyId: company.id,
        amount: blueprintCost,
        status: "success",
        reason: "blueprint_research_start",
        metadata: {
          blueprintId: normalizedBlueprintId,
        },
      });
    }
    const requiredPoints = buildBlueprintResearchRequirements(blueprint);
    const startedAt = Date.now();
    const activeProject: CompanyBlueprintState = {
      id: randomUUID(),
      companyId: company.id,
      blueprintId: normalizedBlueprintId,
      startedByUserId: String(userId),
      status: "in_progress",
      projectStatus: "active",
      progressHours: 0,
      requiredPoints,
      currentPoints: createEmptyBlueprintResearchPoints(),
      lastContribution: createEmptyBlueprintResearchPoints(),
      participantUserIds: [String(userId)],
      tickSeconds: BLUEPRINT_RESEARCH_TICK_SECONDS,
      estimatedFinishAt: null,
      lastTickAt: startedAt,
      lastNotifiedStatus: "in_progress",
      startedAt,
    };
    companyBlueprints.set(company.id, activeProject);
    await syncCompanyBlueprintResearchProject(company);
    await notifyCompanyBlueprintResearchStarted(company, blueprint, activeProject.participantUserIds ?? []);

    const gadgetWear = await applyGadgetWear(userId, {
      cause: "blueprint_development",
      qualityHint: Number(blueprint.time || 1) > 18 ? 0.95 : 1,
    });
    res.json({
      ...(await buildBlueprintResearchApiView(company, companyBlueprints.get(company.id))),
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
    const { userId } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    const membership = await storage.getMemberByUserId(company.id, String(userId || ""));
    if (!membership) return res.status(403).json({ error: "Only company members can view blueprint progress" });
    const state = await syncBlueprintStateForCompany(company);
    if (!state) return res.status(400).json({ error: "No active blueprint" });
    const gadgetWear = await applyGadgetWear(String(userId), {
      cause: "blueprint_development",
      qualityHint: 1,
    });
    return res.json({ ...(await buildBlueprintResearchApiView(company, state)), gadgetWear: gadgetWear.report });
  });

  app.post("/api/companies/:id/blueprints/join", async (req, res) => {
    try {
      await assertFeatureEnabled("blueprints", "Blueprints are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Blueprints are disabled by admin settings" });
    }
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const membership = await storage.getMemberByUserId(company.id, userId);
      if (!membership) return res.status(403).json({ error: "Только сотрудники компании могут присоединиться к разработке" });
      await assertBlueprintResearchAvailability(userId, company.id);
      const state = await syncBlueprintStateForCompany(company);
      if (!state || state.status !== "in_progress" || state.projectStatus !== "active") {
        return res.status(400).json({ error: "Сейчас нет активной разработки" });
      }
      const participantIds = new Set([...(state.participantUserIds ?? []), company.ownerId]);
      if (participantIds.has(userId)) {
        return res.json({ ok: true, alreadyJoined: true, project: await buildBlueprintResearchApiView(company, state) });
      }
      participantIds.add(userId);
      state.participantUserIds = Array.from(participantIds);
      state.lastTickAt = Math.min(Date.now(), Number(state.lastTickAt || Date.now()));
      companyBlueprints.set(company.id, state);
      const synced = await syncBlueprintStateForCompany(company);
      res.json({
        ok: true,
        alreadyJoined: false,
        project: await buildBlueprintResearchApiView(company, synced),
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to join blueprint research" });
    }
  });

  app.post("/api/companies/:id/produce", async (req, res) => {
    try {
      await assertFeatureEnabled("production", "Production is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Production is disabled by admin settings" });
    }
    const { userId, parts = [], quantity = 1 } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    await requireCompanyAssetManagerAccess({ company, userId, action: "production_start" });
    const activeOrder = syncCompanyProductionOrder(company.id);
    if (activeOrder) {
      return res.status(400).json({
        error: activeOrder.status === "ready_to_claim"
          ? "У компании уже есть готовая партия. Сначала заберите выпуск."
          : "У компании уже идет производство партии.",
      });
    }
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

    const normalizedSelectedParts = Array.isArray(parts)
      ? parts
          .map((part: any) => normalizeSelectedWarehousePart(part))
          .filter((part): part is NonNullable<typeof part> => Boolean(part))
      : [];

    if (!isTutorial) {
      const recipe = getBlueprintRecipeRequirements(blueprint);
      const availability = new Map<string, number>();
      for (const part of normalizedSelectedParts) {
        const key = `${part.partType}:${part.quality}`;
        availability.set(key, (availability.get(key) ?? 0) + 1);
      }
      for (const requirement of recipe) {
        const key = `${requirement.partType}:${requirement.quality}`;
        const found = availability.get(key) ?? 0;
        if (found < requirement.quantity) {
          return res.status(400).json({
            error: `Недостаточно деталей ${requirement.partType} качества ${requirement.quality}: нужно ${requirement.quantity}, доступно ${found}`,
          });
        }
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

    const actualQuantity = Math.max(1, Math.min(10, Math.floor(Number(quantity) || 1)));
    let productionGramCost = 0;
    let companyBalanceAfterProduction: number | null = null;
    if (!isTutorial) {
      const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
      const batchDiscountMultiplier = Math.max(0.88, 1 - Math.max(0, actualQuantity - 1) * 0.02);
      productionGramCost = Math.max(
        1,
        Math.round(
          Number(blueprint.production.costGram || 1)
          * actualQuantity
          * batchDiscountMultiplier
          * departmentEffects.productionCostMultiplier,
        ),
      );
      if (Number(company.balance || 0) < productionGramCost) {
        return res.status(400).json({ error: `Недостаточно GRM компании для производства (${productionGramCost} GRM)` });
      }
      companyBalanceAfterProduction = Number(company.balance || 0) - productionGramCost;
      await storage.updateCompany(company.id, {
        balance: companyBalanceAfterProduction,
      });
      await appendEconomyAuditEvent({
        eventType: "COMPANY_FUNDS_SPENT",
        userId: String(userId),
        companyId: company.id,
        amount: productionGramCost,
        status: "success",
        reason: "standard_production_start",
        metadata: {
          blueprintId: blueprint.id,
          quantity: actualQuantity,
        },
      });
    }

    const { effects: departmentEffects } = await getEffectiveCompanyDepartmentEffects(company);
    let quality = isTutorial
      ? 1
      : normalizedSelectedParts.length
      ? normalizedSelectedParts.reduce((sum: number, p: any) => sum + (RARITY_QUALITY_MULTIPLIERS[p.rarity as keyof typeof RARITY_QUALITY_MULTIPLIERS] ?? 1), 0) / normalizedSelectedParts.length
      : 1;
    quality *= 1 + departmentEffects.gadgetQualityBonus;
    quality *= 1 - getBatchQualityPenalty(actualQuantity);
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
    const durationSeconds = isTutorial
      ? TUTORIAL_DEMO_BLUEPRINT.timeSeconds
      : calculateStandardProductionDurationSeconds({
          blueprintId: blueprint.id,
          category: blueprint.category,
          quantity: actualQuantity,
          departmentEffects,
          ceoAdvanced,
        });
    const startedAt = Date.now();
    const order: CompanyProductionOrder = {
      id: randomUUID(),
      companyId: company.id,
      kind: "standard",
      blueprintId: blueprint.id,
      blueprintName: buildProducedCompanyGadgetName(company.name, blueprint.name),
      baseName: blueprint.name,
      category: blueprint.category,
      quantity: actualQuantity,
      startedAt,
      readyAt: startedAt + durationSeconds * 1000,
      status: "in_progress",
      quality: Number(quality.toFixed(2)),
      stats,
      minPrice: isTutorial ? TUTORIAL_DEMO_BLUEPRINT.minPrice : Math.round(basePrice * quality * 0.9 * sellPriceMultiplier),
      maxPrice: isTutorial ? TUTORIAL_DEMO_BLUEPRINT.maxPrice : Math.round(basePrice * quality * 1.4 * sellPriceMultiplier),
      gramCost: isTutorial ? 0 : productionGramCost,
    };
    companyProductionOrders.set(company.id, order);

    const gadgetWear = await applyGadgetWear(String(userId), {
      cause: "production",
      qualityHint: quality,
      severityMultiplier: isTutorial ? 0.7 : 1,
    });
    res.json({
      started: true,
      order,
      durationSeconds,
      gramSpent: order.gramCost,
      companyBalance: companyBalanceAfterProduction,
      gadgetWear: gadgetWear.report,
    });
  });

  app.post("/api/companies/:id/production/claim", async (req, res) => {
    try {
      await assertFeatureEnabled("production", "Production is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Production is disabled by admin settings" });
    }

    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    const userId = String(req.body?.userId || "");
    await requireCompanyAssetManagerAccess({ company, userId, action: "production_claim" });

    const order = syncCompanyProductionOrder(company.id);
    if (!order) return res.status(400).json({ error: "У компании нет активной производственной партии" });
    if (order.status !== "ready_to_claim") {
      const remainingSeconds = Math.max(1, Math.ceil((Number(order.readyAt || 0) - Date.now()) / 1000));
      return res.status(400).json({ error: `Партия еще в производстве. Осталось около ${remainingSeconds} сек.` });
    }

    const warehouseCheck = await ensureCompanyWarehouseCanClaimProduction(company, order.quantity);
    if (!warehouseCheck.ok) {
      return res.status(400).json({ error: `Склад заполнен, добавить невозможно. Свободно слотов: ${warehouseCheck.free}.` });
    }

    const ownerSnapshot = await getUserWithGameState(userId);
    const creatorTesting = Number(ownerSnapshot?.game.skills.testing || 0);
    const creatorAttention = Number(ownerSnapshot?.game.skills.attention || 0);
    const created = buildProducedGadgetsFromOrder({
      order,
      companyId: company.id,
      testing: creatorTesting,
      attention: creatorAttention,
    });
    const produced = companyGadgets.get(company.id) ?? [];
    produced.push(...created);
    companyGadgets.set(company.id, produced);
    recordCompanyProductionClaim(
      company.id,
      created.length,
      created.filter((item) => Boolean(item.isExclusive)).length,
    );
    registerProductionSignal(String(order.category || "all"), order.quantity);
    companyProductionOrders.delete(company.id);
    if (order.isExclusive) {
      const activeProject = getExclusiveProject(company.id);
      if (activeProject?.blueprint?.id === order.blueprintId) {
        exclusiveProjectByCompanyId.delete(company.id);
      }
      const catalog = getExclusiveCatalog(company.id).filter((item) => item.id !== order.blueprintId);
      setExclusiveCatalog(company.id, catalog);
    }

    if (isTutorialCompany(company)) {
      const tutorialOwnerId = String(company.tutorialOwnerId || company.ownerId);
      const tutorialState = await getTutorialState(tutorialOwnerId);
      if (tutorialState?.isActive && !tutorialState.isCompleted) {
        await applyTutorialEvent(tutorialOwnerId, "demo_gadget_produced");
      }

      const registrationState = await getRegistrationFlowState(tutorialOwnerId);
      if (registrationState?.registration.registrationFlow.currentStep === "first_craft") {
        const ownerTutorialSnapshot = await getUserWithGameState(tutorialOwnerId);
        if (ownerTutorialSnapshot) {
          const rewardItem = buildTutorialInventoryGadget(Date.now(), false);
          applyGameStatePatch(tutorialOwnerId, {
            inventory: [...ownerTutorialSnapshot.game.inventory, rewardItem],
          });
        }
        await markRegistrationFirstCraftCompleted(tutorialOwnerId, {
          tutorialCompanyId: company.id,
          exclusiveRewardGranted: false,
        });
        await completeRegistration(tutorialOwnerId);
        await storage.deleteCompany(company.id);
      }
    }

    let bonusApplied: Record<string, unknown> | null = null;
    if (order.isExclusive && order.exclusiveBonusType === "finance") {
      const updatedCompany = await storage.getCompany(company.id);
      if (updatedCompany) {
        const financeBonus = Math.max(0, Number(order.exclusiveBonusValue || 0)) * order.quantity;
        await storage.updateCompany(updatedCompany.id, {
          balance: Number(updatedCompany.balance || 0) + financeBonus,
        });
        bonusApplied = { financeGrm: financeBonus };
      }
    } else if (order.isExclusive && order.exclusiveBonusType === "xp") {
      const owner = await storage.getUser(company.ownerId);
      if (owner) {
        const levelState = applyExperienceGainForLevel(owner, Math.max(0, Number(order.exclusiveBonusValue || 0)) * order.quantity);
        await storage.updateUser(owner.id, { level: levelState.level, experience: levelState.experience });
        bonusApplied = { xp: Math.max(0, Number(order.exclusiveBonusValue || 0)) * order.quantity };
      }
    } else if (order.isExclusive && order.exclusiveBonusType === "skills") {
      const ownerSnapshotForSkills = await getUserWithGameState(company.ownerId);
      if (ownerSnapshotForSkills) {
        const professionId = getPlayerProfessionId(ownerSnapshotForSkills.user);
        const skillName = getExclusiveSkillRewardSkill(professionId);
        const skills = { ...(ownerSnapshotForSkills.game as any).skills };
        const gain = Math.max(0, Number(order.exclusiveBonusValue || 0)) * order.quantity;
        skills[skillName] = Number(skills[skillName] || 0) + gain;
        applyGameStatePatch(ownerSnapshotForSkills.user.id, { skills });
        bonusApplied = { skill: skillName, amount: gain };
      }
    }

    const gadgetWear = await applyGadgetWear(String(userId), {
      cause: "production",
      qualityHint: Number(order.quality || 1),
    });
    res.json({
      ok: true,
      produced: created,
      order,
      bonusApplied,
      gadgetWear: gadgetWear.report,
    });
  });

  app.post("/api/companies/:id/market/list", async (req, res) => {
    try {
      await assertFeatureEnabled("market", "Market is disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Market is disabled by admin settings" });
    }
    const { userId, gadgetId, partRef, quantity: rawQuantity, price, mode = "fixed", durationHours = 2 } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    const access = await requireCompanyAssetManagerAccess({ company, userId: String(userId || ""), action: "market_listing_create" });
    if (isTutorialCompany(company)) {
      return res.status(400).json({ error: "Tutorial company cannot list gadgets on market" });
    }

    const produced = companyGadgets.get(company.id) ?? [];
    const gadget = gadgetId ? produced.find((g) => g.id === gadgetId) : null;
    const listedPart = partRef ? removeCompanyWarehousePartForMarket(company.id, String(partRef)) : null;
    if (!gadget && !listedPart) return res.status(404).json({ error: "Лот не найден на складе компании" });
    const requestedQuantity = Math.max(1, Math.floor(Number(rawQuantity) || 1));
    if (listedPart && requestedQuantity > 1) {
      restoreCompanyWarehousePartFromMarket(company.id, listedPart);
      return res.status(400).json({ error: "Количество можно указать только для одинаковых гаджетов" });
    }
    if (gadget) {
      appendEconomyAuditEvent({
        eventType: "MARKET_GADGET_RELIST_ATTEMPT",
        userId: String(userId || ""),
        companyId: company.id,
        targetId: gadget.id,
        amount: Number(price || 0),
        status: "success",
        metadata: {
          acquisitionSource: gadget.acquisitionSource ?? null,
          lastAuctionPurchaseAt: gadget.lastAuctionPurchaseAt ?? null,
        },
      });
      if (!canRelistAuctionPurchasedGadget(gadget)) {
        appendEconomyAuditEvent({
          eventType: "MARKET_GADGET_RELIST_BLOCKED",
          userId: String(userId || ""),
          companyId: company.id,
          targetId: gadget.id,
          amount: Number(price || 0),
          status: "blocked",
          reason: getAuctionRelistBlockMessage(),
          metadata: {
            acquisitionSource: gadget.acquisitionSource ?? null,
            lastAuctionPurchaseAt: gadget.lastAuctionPurchaseAt ?? null,
            remainingMs: getRemainingAuctionRelistMs(gadget),
          },
        });
        return res.status(403).json({ error: getAuctionRelistBlockMessage() });
      }
    }
    // TODO: Apply dynamic gadget price bands when economy.dynamicGadgetPricesEnabled is wired to market analytics.
    if (mode !== "fixed" && mode !== "auction") {
      if (listedPart) restoreCompanyWarehousePartFromMarket(company.id, listedPart);
      return res.status(400).json({ error: "mode должен быть fixed или auction" });
    }

    const minPrice = gadget
      ? gadget.minPrice
      : Math.max(10, Math.floor(getPartPrice(String(listedPart?.id || "")) * 0.85));
    const maxPrice = gadget
      ? gadget.maxPrice
      : Math.max(minPrice, Math.ceil(getPartPrice(String(listedPart?.id || "")) * 2.4));

    if (price < minPrice || price > maxPrice) {
      if (listedPart) restoreCompanyWarehousePartFromMarket(company.id, listedPart);
      return res.status(400).json({ error: `Цена/стартовая цена должна быть в диапазоне ${minPrice}-${maxPrice}` });
    }

    const normalizedDuration = Math.max(2, Math.min(12, Number(durationHours) || 2));
    const gadgetsToList = gadget
      ? getProducedGadgetMarketBatch(company.id, String(gadgetId), requestedQuantity)
      : [];
    if (gadget && gadgetsToList.length < requestedQuantity) {
      return res.status(400).json({ error: `Доступно только ${gadgetsToList.length} шт.` });
    }
    const createdAt = Date.now();
    const auctionEndsAt = mode === "auction" ? createdAt + normalizedDuration * 60 * 60 * 1000 : undefined;
    const listingsToCreate: MarketListing[] = listedPart
      ? [{
          id: randomUUID(),
          listingKind: "part",
          partRef: String(partRef),
          partId: listedPart?.id,
          partName: listedPart?.name,
          partRarity: listedPart?.rarity,
          partType: listedPart?.type,
          companyId: company.id,
          companyName: company.name,
          sellerUserId: userId,
          saleType: mode,
          price: mode === "fixed" ? price : undefined,
          startingPrice: mode === "auction" ? price : undefined,
          currentBid: mode === "auction" ? price : undefined,
          currentBidderId: undefined,
          auctionEndsAt,
          auctionDurationHours: mode === "auction" ? normalizedDuration : undefined,
          minIncrement: mode === "auction" ? Math.max(10, Math.floor(price * 0.05)) : undefined,
          status: "active",
          createdAt,
          sold: false,
        }]
      : gadgetsToList.map((item) => ({
          id: randomUUID(),
          listingKind: "gadget",
          gadgetId: String(item.id),
          companyId: company.id,
          companyName: company.name,
          sellerUserId: userId,
          saleType: mode,
          price: mode === "fixed" ? price : undefined,
          startingPrice: mode === "auction" ? price : undefined,
          currentBid: mode === "auction" ? price : undefined,
          currentBidderId: undefined,
          auctionEndsAt,
          auctionDurationHours: mode === "auction" ? normalizedDuration : undefined,
          minIncrement: mode === "auction" ? Math.max(10, Math.floor(price * 0.05)) : undefined,
          status: "active",
          createdAt,
          sold: false,
        }));

    marketListings.unshift(...listingsToCreate);
    const listing = listingsToCreate[0];
    appendEconomyAuditEvent({
      eventType: "COMPANY_MARKET_LISTING_CREATED",
      userId: String(userId || ""),
      companyId: company.id,
      targetId: listing.listingKind === "gadget" ? String(listing.gadgetId || "") : String(listing.partId || ""),
      amount: Number(mode === "auction" ? listing.startingPrice || 0 : listing.price || 0),
      status: "success",
      metadata: {
        listingId: listing.id,
        listingKind: listing.listingKind,
        saleType: listing.saleType,
        quantity: listingsToCreate.length,
        role: access.role || null,
      },
    });
    res.json({
      listing,
      listings: listingsToCreate,
      quantity: listingsToCreate.length,
    });
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
        const gadget = listing.listingKind === "gadget"
          ? Array.from(companyGadgets.values()).flat().find((g) => g.id === listing.gadgetId)
          : undefined;
        const part = listing.listingKind === "part" && listing.partId
          ? {
              id: listing.partId,
              name: String(listing.partName || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.name || listing.partId),
              rarity: String(listing.partRarity || "Common"),
              type: String(listing.partType || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.type || "unknown"),
              basePrice: getPartPrice(listing.partId),
            }
          : undefined;
        return { ...listing, gadget, part };
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
    const { listingId, buyerId, quantity: rawQuantity } = req.body ?? {};
    const listing = marketListings.find((l) => l.id === listingId && l.status === "active");
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.saleType !== "fixed" || !listing.price) {
      return res.status(400).json({ error: "Этот лот продается через аукцион" });
    }
    const requestedQuantity = Math.max(1, Math.floor(Number(rawQuantity) || 1));

    const buyer = await storage.getUser(buyerId);
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });
    const buyerMembership = await resolvePlayerCompanyMembership(buyerId);
    if (Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000 && buyerMembership?.company?.id !== listing.companyId) {
      return res.status(403).json({ error: "Первые 20 минут купить этот лот могут только игроки компании-разработчика" });
    }

    const company = await storage.getCompany(listing.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    let listingsToBuy = [listing];
    if (requestedQuantity > 1) {
      if (listing.listingKind !== "gadget") {
        return res.status(400).json({ error: "Количество можно выбрать только при покупке гаджетов" });
      }
      const targetGadget = getProducedGadget(listing.companyId, String(listing.gadgetId || ""));
      if (!targetGadget) {
        return res.status(404).json({ error: "Гаджет для покупки не найден" });
      }
      const targetKey = getMarketGadgetBatchKey(targetGadget);
      listingsToBuy = marketListings
        .filter((candidate) => {
          if (candidate.status !== "active") return false;
          if (candidate.saleType !== "fixed") return false;
          if (candidate.listingKind !== "gadget") return false;
          if (candidate.companyId !== listing.companyId) return false;
          if (
            Date.now() - Number(candidate.createdAt || 0) < 20 * 60 * 1000
            && buyerMembership?.company?.id !== candidate.companyId
          ) return false;
          if (Number(candidate.price || 0) !== Number(listing.price || 0)) return false;
          const candidateGadget = getProducedGadget(candidate.companyId, String(candidate.gadgetId || ""));
          return getMarketGadgetBatchKey(candidateGadget) === targetKey;
        })
        .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0))
        .slice(0, requestedQuantity);
      if (listingsToBuy.length < requestedQuantity) {
        return res.status(400).json({ error: `Доступно только ${listingsToBuy.length} шт.` });
      }
    }
    const totalPrice = Number(listing.price || 0) * listingsToBuy.length;
    if (buyer.balance < totalPrice) return res.status(400).json({ error: "Недостаточно средств" });

    const settings = await getGameSettings();
    const sellerCeo = await storage.getUser(company.ownerId);
    const sellerAdvanced = sellerCeo ? getAdvancedPersonalityId(sellerCeo) : null;
    const feeRate = getMarketFeeRate(
      company.city,
      settings.economy.commissionsEnabled && settings.economy.taxesEnabled,
    );
    let netIncome = Math.floor(totalPrice * (1 - feeRate));
    if (sellerAdvanced === "strategist") {
      netIncome = Math.max(1, Math.floor(netIncome * 1.08));
    }
    const fee = totalPrice - netIncome;
    const nextCompanyBalance = Number(company.balance || 0) + netIncome;
    await storage.updateUser(buyer.id, { balance: buyer.balance - totalPrice });
    await storage.updateCompany(company.id, { balance: nextCompanyBalance });
    await applyCompanyMarketIncomeToRuntime(company, nextCompanyBalance, netIncome);
    const purchasedItems = [] as any[];
    const purchaseTimestamp = Date.now();
    for (const purchasedListing of listingsToBuy) {
      const purchasedItem = purchasedListing.listingKind === "part"
        ? await transferMarketPartToPlayerInventory(
            buyerId,
            purchasedListing.partId ? {
              id: purchasedListing.partId,
              name: String(purchasedListing.partName || ALL_PARTS[purchasedListing.partId as keyof typeof ALL_PARTS]?.name || purchasedListing.partId),
              rarity: String(purchasedListing.partRarity || "Common"),
              type: String(purchasedListing.partType || ALL_PARTS[purchasedListing.partId as keyof typeof ALL_PARTS]?.type || "unknown"),
            } : null,
          )
        : await transferProducedGadgetToPlayerInventory(
            buyerId,
            removeProducedGadget(purchasedListing.companyId, String(purchasedListing.gadgetId || "")),
            {
              acquisitionSource: "auction",
              acquiredAt: purchaseTimestamp,
              lastAuctionPurchaseAt: purchaseTimestamp,
            },
          );
      purchasedItems.push(purchasedItem);
      purchasedListing.status = "sold";
      purchasedListing.sold = true;
      purchasedListing.salePrice = purchasedListing.price;
      if (purchasedListing.listingKind === "gadget") {
        appendEconomyAuditEvent({
          eventType: "MARKET_GADGET_PURCHASED",
          userId: buyer.id,
          companyId: company.id,
          targetId: String(purchasedListing.gadgetId || ""),
          amount: Number(purchasedListing.price || 0),
          status: "success",
          metadata: {
            sellerUserId: purchasedListing.sellerUserId,
            saleType: "fixed",
            listingId: purchasedListing.id,
            quantity: listingsToBuy.length,
          },
        });
      }
    }
    createNotification(buyer.id, {
      type: "SYSTEM_INFO",
      title: "🛒 Лот куплен",
      message: `Покупка на рынке завершена. Количество: ${listingsToBuy.length}.`,
      dataJson: {
        listingId: listing.id,
        companyId: company.id,
        quantity: listingsToBuy.length,
        totalPrice,
      },
    });
    createNotification(company.ownerId, {
      type: "MARKET_LISTING_SOLD",
      title: "💰 Лот компании продан",
      message: `Компания продала лот за ${formatMarketAmount(totalPrice)} GRM.`,
      dataJson: {
        listingId: listing.id,
        companyId: company.id,
        netIncome,
        quantity: listingsToBuy.length,
      },
    });
    res.json({
      ok: true,
      fee,
      netIncome,
      quantity: listingsToBuy.length,
      totalPrice,
      purchasedItem: purchasedItems[0] ?? null,
      purchasedItems,
    });
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
    if (listing.saleType !== "auction") return res.status(400).json({ error: "Ставки доступны только для аукциона" });
    if (!listing.auctionEndsAt || listing.auctionEndsAt <= Date.now()) return res.status(400).json({ error: "Аукцион завершен" });

    const bidder = await storage.getUser(bidderId);
    if (!bidder) return res.status(404).json({ error: "Bidder not found" });
    const bidderMembership = await resolvePlayerCompanyMembership(bidderId);
    if (Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000 && bidderMembership?.company?.id !== listing.companyId) {
      return res.status(403).json({ error: "Первые 20 минут участвовать в аукционе могут только игроки компании-разработчика" });
    }

    const minNext = (listing.currentBid ?? listing.startingPrice ?? 0) + (listing.minIncrement ?? 10);
    if (Number(amount) < minNext) {
      return res.status(400).json({ error: `Минимальная ставка: ${minNext}` });
    }

    if (bidder.balance < Number(amount)) {
      return res.status(400).json({ error: "Недостаточно средств для ставки" });
    }

    const previousBidderId = String(listing.currentBidderId || "").trim();
    const previousBid = Number(listing.currentBid || listing.startingPrice || 0);
    listing.currentBid = Number(amount);
    listing.currentBidderId = bidderId;
    listing.auctionEndsAt = Date.now() + AUCTION_POST_BID_EXTENSION_MINUTES * 60 * 1000;

    if (previousBidderId && previousBidderId !== bidderId) {
      const previousBidderTelegramId = Number(getTelegramIdByUserId(previousBidderId) || 0);
      if (previousBidderTelegramId) {
        await sendTelegramBotText(
          previousBidderTelegramId,
          [
            "🔔 Твою ставку перебили",
            `Лот: ${formatAuctionLotTitle(listing)}`,
            `Твоя ставка: ${formatMarketAmount(previousBid)} GRM`,
            `Новая ставка: ${formatMarketAmount(Number(amount))} GRM`,
            "Таймер аукциона запущен заново.",
          ].join("\n"),
        );
      }
    }

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
    if (!userId || !companyId) return res.status(400).json({ error: "userId и companyId обязательны" });

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (isTutorialCompany(company)) {
      return res.status(400).json({ error: "Tutorial company cannot accept city contracts" });
    }

    const membership = await storage.getMemberByUserId(companyId, userId);
    if (!membership) return res.status(403).json({ error: "Только участник компании может принять контракт" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "Контракт не найден" });
    if (contract.status === "completed") return res.status(400).json({ error: "Контракт уже завершен" });
    if (contract.assignedCompanyId && contract.assignedCompanyId !== companyId) {
      return res.status(400).json({ error: "Контракт уже принят другой компанией" });
    }

    contract.status = "in_progress";
    contract.assignedCompanyId = companyId;
    if (contract.kind === "staged_skill" && (!Array.isArray(contract.stages) || !contract.stages.length)) {
      contract.stages = [];
      contract.currentStageIndex = 0;
    }
    res.json(contract);
  });

  app.post("/api/city-contracts/:contractId/contribute", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Companies are disabled by admin settings" });
    }
    const { userId, companyId } = req.body ?? {};
    if (!userId || !companyId) return res.status(400).json({ error: "userId и companyId обязательны" });

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (isTutorialCompany(company)) {
      return res.status(400).json({ error: "Tutorial company cannot use city contracts" });
    }

    const membership = await storage.getMemberByUserId(companyId, userId);
    if (!membership) return res.status(403).json({ error: "Только участник компании может делать вклад в контракт" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "Контракт не найден" });
    if (contract.kind !== "staged_skill") return res.status(400).json({ error: "Для этого контракта вклад навыками не поддерживается" });
    if (contract.assignedCompanyId !== companyId) return res.status(400).json({ error: "Контракт не закреплен за вашей компанией" });
    if (contract.status === "completed") return res.status(400).json({ error: "Контракт уже завершен" });

    const stage = getCurrentContractStage(contract);
    if (!stage) return res.status(400).json({ error: "У контракта не найден активный этап" });
    const calculation = await calculateCompanySkillContribution({
      companyId,
      userId,
      skillType: stage.skillType,
    });

    const contribution = recordCompanyTaskContribution({
      companyId,
      userId: calculation.userId,
      username: calculation.username,
      taskId: contract.id,
      source: "contract",
      skillType: calculation.skillType,
      value: calculation.value,
      professionBonus: calculation.professionBonus,
      departmentEfficiency: calculation.departmentEfficiency,
      randomMultiplier: calculation.randomMultiplier,
      stageIndex: stage.index,
    });

    stage.progress = Number((stage.progress + contribution.value).toFixed(2));
    stage.contributions.push({
      id: contribution.id,
      userId: contribution.userId,
      username: contribution.username,
      value: contribution.value,
      skillType: contribution.skillType,
      createdAt: contribution.createdAt,
    });

    let completionPayload: any = null;
    if (isContractStageComplete(stage)) {
      stage.progress = Math.max(stage.progress, stage.target);
      stage.completedAt = Date.now();
      contract.currentStageIndex = Math.max(0, Number(contract.currentStageIndex || 0)) + 1;
      if ((contract.currentStageIndex ?? 0) >= (contract.stages?.length ?? 0)) {
        contract.status = "completed";
        contract.completedAt = Date.now();
        completionPayload = await completeStagedCompanyContract(contract, company);
      }
    }

    res.json({
      ok: true,
      contract,
      currentStage: getCurrentContractStage(contract),
      contribution,
      contributions: getTaskContributions(contract.id),
      participantTotals: aggregateContractContributionByUser(contract),
      completed: contract.status === "completed",
      company: completionPayload?.company ?? null,
      participantRewards: completionPayload?.participantRewards ?? [],
    });
  });

  app.post("/api/city-contracts/:contractId/deliver", async (req, res) => {
    try {
      await assertFeatureEnabled("companies", "Companies are disabled by admin settings");
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || "Companies are disabled by admin settings" });
    }
    const { userId, companyId } = req.body ?? {};
    if (!userId || !companyId) return res.status(400).json({ error: "userId и companyId обязательны" });

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (isTutorialCompany(company)) {
      return res.status(400).json({ error: "Tutorial company cannot deliver city contracts" });
    }

    const membership = await storage.getMemberByUserId(companyId, userId);
    if (!membership) return res.status(403).json({ error: "Только участник компании может сдавать контракт" });
    await requireCompanyAssetManagerAccess({ company, userId, action: "contract_deliver" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "Контракт не найден" });
    if (contract.assignedCompanyId !== companyId) return res.status(400).json({ error: "Контракт не закреплен за вашей компанией" });
    if (contract.status === "completed") return res.status(400).json({ error: "Контракт уже завершен" });

    if (contract.kind === "staged_skill") {
      return res.status(400).json({ error: "Этот контракт завершается автоматически, когда сотрудники закроют все этапы вкладом." });
    }

    let consumedGadgets: string[] = [];
    let consumedPartsCount = 0;
    let consumedPartRefs: string[] = [];
    if (contract.kind === "parts_supply") {
      const requiredType = String(contract.requiredPartType || "").trim();
      if (!requiredType) {
        return res.status(400).json({ error: "Тип запчастей для контракта не задан" });
      }
      const availablePartRefs = buildCompanyWarehouseUnitRefs(company.id, requiredType);
      if (availablePartRefs.length < contract.requiredQuantity) {
        return res.status(400).json({
          error: `Нужно ${contract.requiredQuantity} запчастей типа ${requiredType} на складе компании. Доступно: ${availablePartRefs.length}`,
        });
      }

      const requestedPartRefs = Array.isArray(req.body?.partRefs)
        ? req.body.partRefs.map((value: unknown) => String(value || "").trim()).filter(Boolean)
        : [];
      const chosenPartRefs = requestedPartRefs.length
        ? requestedPartRefs
        : availablePartRefs.slice(0, contract.requiredQuantity).map((item) => item.ref);

      if (chosenPartRefs.length !== contract.requiredQuantity) {
        return res.status(400).json({
          error: `Нужно выбрать ровно ${contract.requiredQuantity} запчастей для сдачи контракта`,
        });
      }

      const availableSet = new Set(availablePartRefs.map((item) => item.ref));
      if (chosenPartRefs.some((ref: string) => !availableSet.has(ref))) {
        return res.status(400).json({ error: "Часть выбранных деталей уже отсутствует на складе компании" });
      }

      consumeCompanyWarehousePartRefs(company.id, chosenPartRefs);
      consumedPartsCount = contract.requiredQuantity;
      consumedPartRefs = chosenPartRefs;
    } else if (contract.kind === "skill_research") {
      const requiredSkill = contract.requiredSkill;
      const requiredPoints = Math.max(0, Number(contract.requiredSkillPoints ?? 0));
      if (!requiredSkill || requiredPoints <= 0) {
        return res.status(400).json({ error: "Параметры контракта по навыкам не заданы" });
      }
      const currentPoints = await getCompanyContractSkillTotal(company.id, requiredSkill);
      if (currentPoints < requiredPoints) {
        return res.status(400).json({
          error: `Недостаточно суммарного навыка компании ${requiredSkill}. Нужно ${requiredPoints}, у компании ${currentPoints}`,
        });
      }
    } else {
      const produced = companyGadgets.get(company.id) ?? [];
      const listedIds = new Set(
        marketListings
          .filter((listing) => listing.status === "active" && listing.listingKind === "gadget" && listing.gadgetId)
          .map((listing) => String(listing.gadgetId))
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
      consumedPartRefs,
      company: updatedCompany,
    });
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

  app.get("/api/admin/companies/gadget-catalog", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    const catalog = GADGET_BLUEPRINTS.map((blueprint) => ({
      id: blueprint.id,
      name: blueprint.name,
      category: blueprint.category,
      costGram: blueprint.production.costGram,
      stats: blueprint.baseStats,
    }));
    res.json(catalog);
  });

  app.post("/api/admin/companies/:id/grant-gadget", async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });

      const blueprintId = String(req.body?.blueprintId || "").trim();
      const quantity = Math.max(1, Math.floor(Number(req.body?.quantity || 0)));
      if (!blueprintId) return res.status(400).json({ error: "blueprintId is required" });
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: "quantity must be greater than 0" });
      }

      const blueprint = GADGET_BLUEPRINTS.find((item) => item.id === blueprintId);
      if (!blueprint) return res.status(404).json({ error: "Blueprint not found" });

      const companyEmoji = getLeadingCompanyEmoji(company.name);
      const displayName = companyEmoji ? buildCompanyDisplayName(blueprint.name, companyEmoji) : blueprint.name;
      const basePrice = Math.max(100, blueprint.production.costGram * 10);
      const gadgetCondition = createGadgetConditionProfile({
        rarity: "Common",
        quality: 1,
        testing: 0,
        attention: 0,
      });

      const produced = companyGadgets.get(company.id) ?? [];
  for (let index = 0; index < quantity; index += 1) {
        produced.push({
          id: randomUUID(),
          blueprintId: blueprint.id,
          companyId: company.id,
          name: displayName,
          title: blueprint.title,
          baseName: blueprint.name,
          category: blueprint.category,
          branch: blueprint.branch,
          generation: blueprint.generation,
          rarity: blueprint.rarity,
          requiredLevel: blueprint.requiredLevel,
          description: blueprint.description,
          stats: Object.fromEntries(
            Object.entries(blueprint.baseStats).map(([key, value]) => [key, Number(Number(value || 0).toFixed(2))]),
          ),
          companyEmoji: companyEmoji || null,
          isCompanyMade: true,
          quality: Number(blueprint.quality ?? 1),
          wear: 0,
          wearRate: Number(blueprint.wearRate ?? 1),
          repairCost: Number(blueprint.repairCost ?? 0),
          basePrice: Number(blueprint.basePrice ?? basePrice),
          productionCostGrm: Number(blueprint.productionCostGrm ?? blueprint.production.costGram ?? 0),
          auctionMinPrice: Number(blueprint.auctionMinPrice ?? Math.round(basePrice * 0.9)),
          auctionMaxPrice: Number(blueprint.auctionMaxPrice ?? Math.round(basePrice * 1.4)),
          productionPartsRequirement: { ...(blueprint.productionPartsRequirement || blueprint.production.parts || {}) },
          pvpRoundBonus: blueprint.pvpRoundBonus ?? null,
          specialEffect: blueprint.specialEffect ?? null,
          hashPower: blueprint.hashPower,
          incomePerCycle: blueprint.incomePerCycle,
          powerCostPerCycle: blueprint.powerCostPerCycle,
          minPrice: Number(blueprint.auctionMinPrice ?? Math.round(basePrice * 0.9)),
          maxPrice: Number(blueprint.auctionMaxPrice ?? Math.round(basePrice * 1.4)),
          ...gadgetCondition,
          producedAt: Date.now(),
          acquisitionSource: "company_production",
          acquiredAt: Date.now(),
          lastAuctionPurchaseAt: null,
          isExclusive: false,
          exclusiveLevel: 0,
        });
      }
      companyGadgets.set(company.id, produced);

      res.json({
        ok: true,
        companyId: company.id,
        companyName: company.name,
        blueprintId: blueprint.id,
        gadgetName: displayName,
        quantity,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to add company gadget" });
    }
  });

  return httpServer;
}
