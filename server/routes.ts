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
import { BALANCE_CONFIG, getCompanyCreateCostLocal, getMarketFeeRate, resolveCityId } from "../shared/balance-config";
import {
  WEEKLY_HACKATHON_CONFIG,
  HACKATHON_ALLOWED_PART_TYPES,
  type HackathonPartType,
  type HackathonSabotageType,
} from "../shared/weekly-hackathon";
import {
  applyWeeklyHackathonRewards,
  applyWinnerRewardsToCompanies,
  contributeGrmToWeeklyHackathon,
  contributePartToWeeklyHackathon,
  contributeSkillToWeeklyHackathon,
  endWeeklyHackathon,
  formatWeeklyHackathonTop,
  getHackathonRoundView,
  getWeeklyHackathonCompanyScore,
  getWeeklyHackathonPlayerStats,
  getWeeklyHackathonSabotageState,
  getWeeklyHackathonState,
  joinPlayerToWeeklyHackathonTeam,
  launchWeeklyHackathonSabotage,
  resolveHackathonPoachOffer,
  getWinnerBoostForCompany,
  setHackathonCompanySecurityLevel,
  registerCompanyForWeeklyHackathon,
  resetWeeklyHackathon,
  startWeeklyHackathon,
  startWeeklyHackathonScheduler,
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
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
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

function getProducedGadgetUpgradeGroupKey(gadget: ProducedGadget) {
  const baseName = String(gadget.baseName || gadget.name || "").trim().toLowerCase();
  const category = normalizeProducedCategory(gadget.category);
  const blueprintId = String(gadget.blueprintId || "").trim().toLowerCase();
  return `${baseName}::${category}::${blueprintId}`;
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
    const epic = rollRandomPartDrop(1, { allowedQualities: ["Epic"] });
    if (epic) return epic;
    const rare = rollRandomPartDrop(1.5, { allowedQualities: ["Rare"] });
    return rare;
  }
  const uncommon = rollRandomPartDrop(5, { allowedQualities: ["Uncommon"] });
  if (uncommon) return uncommon;
  const common = rollRandomPartDrop(10, { allowedQualities: ["Common"] });
  return common;
}

function isLeadershipRole(role: string | null | undefined) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "owner" || normalized === "manager" || normalized === "cto";
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
  state.completedAt = Date.now();
  const tutorialOwnerId = String(company.tutorialOwnerId || company.ownerId);
  await applyTutorialEvent(tutorialOwnerId, "demo_blueprint_done");

  return state;
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
    await storage.updateUser(buyer.id, { balance: buyer.balance - listing.currentBid });
    await storage.updateCompany(company.id, { balance: company.balance + netIncome });
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

const LEVEL_REQUIREMENTS = BALANCE_CONFIG.company.levelRequirements;

async function applyHackathonRewards() {
  await applyWeeklyHackathonRewards({
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

  // вњ… Р Р•Р“РРЎРўР РђР¦РРЇ РџРћР›Р¬Р—РћР’РђРўР•Р›РЇ
  app.post("/api/register", async (req, res) => {
    try {
      const { referralCode, deviceFingerprint, telegramId } = req.body ?? {};
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();

      if (typeof telegramId === "string" && telegramId.trim().length > 0) {
        if (getUserIdByTelegramId(telegramId)) {
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
      activePvpBankBoost: (game as any).activePvpBankBoost ?? null,
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
        activePvpBankBoost: updates.activePvpBankBoost,
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
        activePvpBankBoost: (game as any).activePvpBankBoost ?? null,
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
        activePvpBankBoost: (game as any).activePvpBankBoost ?? null,
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
      const users = (await storage.getUsers()).filter((user) => !isPvpBotUsername(user.username));

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
      const users = (await storage.getUsers()).filter((user) => !isPvpBotUsername(user.username));
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
      const access = canEnterPvp(user);
      const state = getPvpQueueState(userId);
      const stamp = getUtcDayStamp();
      const dailyMatches = user.pvpDailyStamp === stamp ? Number(user.pvpDailyMatches || 0) : 0;
      res.json({
        access,
        accessMessage: access.ok ? null : getPvpAccessMessage(access.reason),
        inQueue: state.inQueue,
        queueJoinedAtMs: state.queueJoinedAtMs,
        queueWaitSec: state.queueWaitSec,
        queueSize: state.queueSize,
        hasPendingResult: state.hasPendingResult,
        activeDuel: state.activeDuel,
        pendingBoosts: state.pendingBoosts,
        pendingTactics: state.pendingTactics,
        boostCatalog: getPvpBoostCatalog(),
        boostRotation: getPvpShopRotation(),
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
      if (!boost) return res.status(404).json({ error: "Этот PvP-предмет сегодня недоступен в ротации" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: getPvpAccessMessage(access.reason), reason: access.reason });
      }
      const currentState = getPvpQueueState(user.id);
      if (currentState.activeDuel && !currentState.activeDuel.awaitingStart) {
        return res.status(400).json({ error: "Нельзя менять PvP-предмет во время активной дуэли" });
      }
      if (!currentState.activeDuel && currentState.pendingBoosts?.includes(boost.id)) {
        return res.status(400).json({ error: "Этот PvP-предмет уже выбран для следующей дуэли" });
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
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: getPvpAccessMessage(access.reason), reason: access.reason });
      }
      const duel = startActivePvpDuelNow(userId);
      if (!duel) return res.status(404).json({ error: "Активная дуэль не найдена" });
      const state = getPvpQueueState(userId);
      res.json({ ok: true, activeDuel: state.activeDuel });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to start PvP duel" });
    }
  });

  app.post("/api/pvp/tactics/select", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const stageKey = String(req.body?.stageKey || "") as "concept" | "core" | "tests";
      const tacticId = String(req.body?.tacticId || "") as "speed" | "quality" | "stability" | "pressure";
      if (!userId || !stageKey || !tacticId) {
        return res.status(400).json({ error: "userId, stageKey and tacticId are required" });
      }
      if (!["concept", "core", "tests"].includes(stageKey)) {
        return res.status(400).json({ error: "Unknown PvP round" });
      }
      if (!["speed", "quality", "stability", "pressure"].includes(tacticId)) {
        return res.status(400).json({ error: "Unknown PvP tactic" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: getPvpAccessMessage(access.reason), reason: access.reason });
      }
      const tactics = selectPvpTactic(userId, stageKey, tacticId);
      const state = getPvpQueueState(userId);
      res.json({
        ok: true,
        tactics,
        activeDuel: state.activeDuel,
        pendingTactics: state.pendingTactics,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to select PvP tactic" });
    }
  });

  app.post("/api/pvp/queue/join", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: getPvpAccessMessage(access.reason), reason: access.reason });
      }

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
      const skills = readDuelSkills(snapshot);
      const gadget = readEquippedPvpGadget(snapshot);
      const skillSum = skills.analytics + skills.design + skills.drawing + skills.coding + skills.modeling + skills.testing + skills.attention;
      const pvpPowerScore = computePvpPowerScore({ skills, level: Number(user.level || 1), gadget });
      const energyCost = Number(PVP_DUEL_CONFIG.process.baseEnergyCost || 0);

      await storage.updateUser(user.id, { lastActiveAt: Math.floor(Date.now() / 1000) });
      queuePlayerForPvp({
        userId: user.id,
        username: user.username,
        level: Number(user.level || 1),
        rating: Number(user.pvpRating || 1000),
        professionId: access.professionId,
        skills,
        skillSum,
        pvpPowerScore,
        gadget,
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
        pvpPowerScore,
        activeGadget: gadget ? { id: gadget.id, name: gadget.name } : null,
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
      clearPendingPvpTactics(userId);
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
      const isDraw = result.winnerUserId === null;
      const opponentIsBot = perspectiveA ? Boolean(result.playerBIsBot) : Boolean(result.playerAIsBot);
      const moneyReward = isWinner && opponentIsBot ? Math.max(0, Number(PVP_DUEL_CONFIG.reward.botWinMoney || 0)) : 0;
      const user = await storage.getUser(userId);
      if (moneyReward > 0 && user) {
        await storage.updateUser(user.id, { balance: Number(user.balance || 0) + moneyReward });
      }
      const droppedPartDef = rollPvpRewardPart({ isWinner, isDraw });
      const droppedPart = droppedPartDef
        ? await transferMarketPartToPlayerInventory(userId, {
            id: String(droppedPartDef.id),
            name: String(droppedPartDef.name),
            rarity: String(droppedPartDef.rarity),
            type: String(droppedPartDef.partType || droppedPartDef.type || "unknown"),
          })
        : null;
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
          isDraw,
          ratingBefore: myBefore,
          ratingAfter: myAfter,
          ratingDelta: myAfter - myBefore,
          xpReward: result.winnerUserId === null ? Number(result.drawXp || 0) : isWinner ? result.winnerXp : result.loserXp,
          reputationReward: result.winnerUserId === null ? Number(result.drawReputation || 0) : isWinner ? result.winnerReputation : 0,
          moneyReward,
          moneyRewardCurrency: getCurrencySymbol(user?.city || "Сан-Франциско"),
          energyCost: perspectiveA ? Number(result.energyCostA || 0) : Number(result.energyCostB || 0),
          droppedPart,
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
      liveRound: getHackathonRoundView(),
      playerStats: userId && companyId ? getWeeklyHackathonPlayerStats(userId, companyId) : null,
      companyScore: companyId ? getWeeklyHackathonCompanyScore(companyId) : null,
      sabotage: getWeeklyHackathonSabotageState(companyId || undefined),
      config: {
        registrationCostGrm: WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
        maxParticipantsPerCompany: WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany,
        registrationWindowMs: WEEKLY_HACKATHON_CONFIG.registrationWindowMs,
        roundDurationMs: WEEKLY_HACKATHON_CONFIG.roundDurationMs,
        tickMs: WEEKLY_HACKATHON_CONFIG.tickMs,
        eligibility: WEEKLY_HACKATHON_CONFIG.eligibility,
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
      const entry = registerCompanyForWeeklyHackathon({
        companyId: company.id,
        companyName: company.name,
        city: company.city,
        companyLevel: company.level,
        rndLevel,
        companyEmoji: null,
        startedByUserId: userId,
      });
      res.json({ ok: true, entry, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось зарегистрировать компанию" });
    }
  });

  app.post("/api/hackathon/join-team", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "Игрок не найден" });
      const member = await storage.getMemberByUserId(membership.company.id, userId);
      const recentPvpLogs = await storage.getPvpDuelHistoryByUser(userId, 200);
      const recentSinceSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      const eligibility = validateHackathonEligibility({
        membershipCreatedAt: Number(member?.createdAt || 0) || null,
        level: Number(user.level || 1),
        totalPvpBattles: Number(user.pvpMatches || 0),
        recentPvpBattles7d: recentPvpLogs.filter((row) => Number(row.createdAt || 0) >= recentSinceSec).length,
      });
      if (!eligibility.ok) {
        return res.status(400).json({
          error: eligibility.reasons[0] || "Игрок не проходит условия участия",
          reasons: eligibility.reasons,
          eligibility,
        });
      }
      const joined = joinPlayerToWeeklyHackathonTeam({
        userId,
        username: String(user.username || "Игрок"),
        companyId: membership.company.id,
      });
      res.json({ ok: true, joined, state: getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось записаться в состав" });
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

    const current = await syncCompanyBlueprintResearchProject(company);
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
    const current = await syncCompanyBlueprintResearchProject(company);
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
    const state = await syncCompanyBlueprintResearchProject(company);
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
      const state = await syncCompanyBlueprintResearchProject(company);
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
      const synced = await syncCompanyBlueprintResearchProject(company);
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
    const { userId, gadgetId, partRef, price, mode = "fixed", durationHours = 2 } = req.body ?? {};
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
      return res.status(400).json({ error: "mode РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ fixed РёР»Рё auction" });
    }

    const minPrice = gadget
      ? gadget.minPrice
      : Math.max(10, Math.floor(getPartPrice(String(listedPart?.id || "")) * 0.85));
    const maxPrice = gadget
      ? gadget.maxPrice
      : Math.max(minPrice, Math.ceil(getPartPrice(String(listedPart?.id || "")) * 2.4));

    if (price < minPrice || price > maxPrice) {
      if (listedPart) restoreCompanyWarehousePartFromMarket(company.id, listedPart);
      return res.status(400).json({ error: `Р¦РµРЅР°/СЃС‚Р°СЂС‚РѕРІР°СЏ С†РµРЅР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РІ РґРёР°РїР°Р·РѕРЅРµ ${minPrice}-${maxPrice}` });
    }

    const normalizedDuration = Math.max(2, Math.min(12, Number(durationHours) || 2));

    const listing: MarketListing = {
      id: randomUUID(),
      listingKind: listedPart ? "part" : "gadget",
      gadgetId: gadget ? String(gadgetId) : undefined,
      partRef: listedPart ? String(partRef) : undefined,
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
      auctionEndsAt: mode === "auction" ? Date.now() + normalizedDuration * 60 * 60 * 1000 : undefined,
      auctionDurationHours: mode === "auction" ? normalizedDuration : undefined,
      minIncrement: mode === "auction" ? Math.max(10, Math.floor(price * 0.05)) : undefined,
      status: "active",
      createdAt: Date.now(),
      sold: false,
    };

    marketListings.unshift(listing);
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
        role: access.role || null,
      },
    });
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
    if (Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000 && buyerMembership?.company?.id !== listing.companyId) {
      return res.status(403).json({ error: "Первые 20 минут купить этот лот могут только игроки компании-разработчика" });
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
    const purchasedItem = listing.listingKind === "part"
      ? await transferMarketPartToPlayerInventory(
          buyerId,
          listing.partId ? {
            id: listing.partId,
            name: String(listing.partName || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.name || listing.partId),
            rarity: String(listing.partRarity || "Common"),
            type: String(listing.partType || ALL_PARTS[listing.partId as keyof typeof ALL_PARTS]?.type || "unknown"),
          } : null,
        )
      : await transferProducedGadgetToPlayerInventory(
          buyerId,
          removeProducedGadget(listing.companyId, String(listing.gadgetId || "")),
          {
            acquisitionSource: "auction",
            acquiredAt: Date.now(),
            lastAuctionPurchaseAt: Date.now(),
          },
        );
    listing.status = "sold";
    listing.sold = true;
    listing.salePrice = listing.price;
    if (listing.listingKind === "gadget") {
      appendEconomyAuditEvent({
        eventType: "MARKET_GADGET_PURCHASED",
        userId: buyer.id,
        companyId: company.id,
        targetId: String(listing.gadgetId || ""),
        amount: Number(listing.price || 0),
        status: "success",
        metadata: {
          sellerUserId: listing.sellerUserId,
          saleType: "fixed",
          listingId: listing.id,
        },
      });
    }

    res.json({ ok: true, fee, netIncome, purchasedItem });
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
    if (Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000 && bidderMembership?.company?.id !== listing.companyId) {
      return res.status(403).json({ error: "Первые 20 минут участвовать в аукционе могут только игроки компании-разработчика" });
    }

    const minNext = (listing.currentBid ?? listing.startingPrice ?? 0) + (listing.minIncrement ?? 10);
    if (Number(amount) < minNext) {
      return res.status(400).json({ error: `РњРёРЅРёРјР°Р»СЊРЅР°СЏ СЃС‚Р°РІРєР°: ${minNext}` });
    }

    if (bidder.balance < Number(amount)) {
      return res.status(400).json({ error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ РґР»СЏ СЃС‚Р°РІРєРё" });
    }

    const previousBidderId = String(listing.currentBidderId || "").trim();
    const previousBid = Number(listing.currentBid || listing.startingPrice || 0);
    listing.currentBid = Number(amount);
    listing.currentBidderId = bidderId;
    if (listing.auctionDurationHours) {
      listing.auctionEndsAt = Date.now() + Number(listing.auctionDurationHours) * 60 * 60 * 1000;
    }

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
    await requireCompanyAssetManagerAccess({ company, userId, action: "contract_deliver" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "РљРѕРЅС‚СЂР°РєС‚ РЅРµ РЅР°Р№РґРµРЅ" });
    if (contract.assignedCompanyId !== companyId) return res.status(400).json({ error: "РљРѕРЅС‚СЂР°РєС‚ РЅРµ Р·Р°РєСЂРµРїР»РµРЅ Р·Р° РІР°С€РµР№ РєРѕРјРїР°РЅРёРµР№" });
    if (contract.status === "completed") return res.status(400).json({ error: "РљРѕРЅС‚СЂР°РєС‚ СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅ" });

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
      options: PLAYABLE_PROFESSIONS,
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
      if (!isProfessionId(professionId) || professionId === "devops") {
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
