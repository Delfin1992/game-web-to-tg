import type { User } from "../shared/schema";
import type { RarityName } from "../client/src/lib/parts";
import { RARITY_LEVELS, getPartPrice, rollRandomPartDrop } from "../client/src/lib/parts";
import { resolveCity } from "../shared/registration";
import {
  BALANCE_CONFIG,
  type BankCreditProgramBalance,
  type BankDepositProgramBalance,
  applyBankFeeRate,
  getCityProfile,
  getEducationSkillMultiplier,
  getEnergyRegenPerSecond,
  getGrmPerLocal,
  getJobFailureChance,
  getJobRewardLocalByTier,
  getJobWorkEnergyCostByTier,
  getJobXpByTier,
  resolveJobTierFromRank,
} from "../shared/balance-config";
import {
  PROFESSION_SPECIAL_JOBS,
  getProfessionSkillCap,
  getProfessionSkillGrowthMultiplier,
  type ProfessionId,
} from "../shared/professions";
import { storage } from "./storage";
import { assertFeatureEnabled, getGameSettings } from "./game-settings";
import { ADVANCED_PERSONALITY_MODIFIERS } from "../shared/advanced-personality";
import {
  getAdvancedPersonalityId,
  getActiveHousing,
  getHousingLastAsicPayoutAt,
  getInventoryCapacityForUser,
  getPlayerProfessionId,
  getTrainingConsumablesUsedAtLevel,
  incrementTrainingConsumablesUsedAtLevel,
  markHousingAsicPayout,
} from "./player-meta";
import { applyGlobalEventMultiplier, getGlobalEventModifier } from "./game/events/event-engine";
import { registerPriceSpikeSignal } from "./game/events/event-history";
import {
  deletePlayerRuntimeState,
  getPlayerRuntimeState,
  setPlayerRuntimeState,
} from "./runtime/player-state";

export type SkillName =
  | "coding"
  | "testing"
  | "analytics"
  | "drawing"
  | "modeling"
  | "design"
  | "attention";

export type InventoryItemType = "consumable" | "gear" | "part" | "gadget";
export type BankProductType = "credit" | "deposit";

export type Skills = Record<SkillName, number>;

export interface GameInventoryItem {
  id: string;
  name: string;
  stats: Record<string, number>;
  rarity: string;
  quantity: number;
  type: InventoryItemType;
  baseName?: string;
  category?: string;
  isEquipped?: boolean;
  durability?: number;
  maxDurability?: number;
  condition?: number;
  maxCondition?: number;
  isBroken?: boolean;
  reliability?: number;
  quality?: number;
  exclusiveLevel?: number;
  repairStatus?: "none" | "queued" | "accepted" | "in_progress" | "completed";
  repairOrderId?: string;
  repairLocked?: boolean;
}

export interface GameBankProduct {
  type: BankProductType;
  amount: number;
  daysLeft: number;
  totalDays: number;
  totalReturn: number;
  name: string;
  programId?: string;
  depositKind?: "safe" | "risky" | "pvp";
  overduePenaltyRate?: number;
  graceMinutes?: number;
  isOverdue?: boolean;
  rewardBonusPct?: number;
  ratingBonusFlat?: number;
  xpBonusPct?: number;
  boostDurationMinutes?: number;
}

export interface GamePvpBankBoost {
  sourceName: string;
  rewardBonusPct: number;
  ratingBonusFlat: number;
  xpBonusPct: number;
  expiresAt: number;
}

export interface GameState {
  skills: Skills;
  inventory: GameInventoryItem[];
  workTime: number;
  studyTime: number;
  gramBalance: number;
  jobDropPity: number;
  activeBankProduct: GameBankProduct | null;
  activePvpBankBoost: GamePvpBankBoost | null;
  lastTickAt: number;
}

export interface CityBonus {
  failureRateReduction: number;
  salaryBoost: number;
  skillGrowthBoost: number;
  xpBoost: number;
}

export interface Job {
  id?: string;
  name: string;
  minStats: Record<string, number>;
  rankRequired: string;
  timeMinutes: number;
  reward: number;
  expReward: number;
  description: string;
  minLevel?: number;
  professionId?: ProfessionId;
  energyCost?: number;
  skillRewards?: Partial<Record<SkillName, number>>;
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  stats: Record<string, number>;
  description: string;
  rarity: string;
  type: "consumable" | "gear";
}

export interface BankProgram {
  id: string;
  name: string;
  minLevel: number;
  minAmount: number;
  maxAmount: number;
  description: string;
  durationMinutes: number;
  interest?: number;
  depositKind?: "safe" | "risky" | "pvp";
  overduePenaltyRate?: number;
  graceMinutes?: number;
  riskyInterest?: number;
  riskySuccessChance?: number;
  pvpRewardBonusPct?: number;
  pvpRatingBonusFlat?: number;
  pvpXpBonusPct?: number;
  pvpBoostDurationMinutes?: number;
}

type BankEarlyAction = "repay" | "withdraw";

type GameTickResult = {
  user: User;
  notices: string[];
};

export type GadgetWearCause = "pvp" | "blueprint_development" | "production";

export type GadgetWearReport = {
  cause: GadgetWearCause;
  affected: Array<{
    itemId: string;
    itemName: string;
    before: number;
    after: number;
    lost: number;
    isBroken: boolean;
  }>;
  warnings: string[];
  summary: string | null;
};

export type GadgetWearOptions = {
  cause: GadgetWearCause;
  testing?: number;
  attention?: number;
  qualityHint?: number;
  severityMultiplier?: number;
  negativeEventChanceBonus?: number;
};

export const TUTORIAL_MEDAL_ITEM_ID = "tutorial-medal";

const DEFAULT_SKILLS: Skills = {
  coding: 0,
  testing: 0,
  analytics: 0,
  drawing: 0,
  modeling: 0,
  design: 0,
  attention: 0,
};

const EMPTY_GAME_STATE: Omit<GameState, "lastTickAt"> = {
  skills: { ...DEFAULT_SKILLS },
  inventory: [],
  workTime: 1,
  studyTime: 1,
  gramBalance: 0,
  jobDropPity: 0,
  activeBankProduct: null,
  activePvpBankBoost: null,
};

const ENERGY_REGEN_PER_SECOND = getEnergyRegenPerSecond();

const CITY_CURRENCY: Record<string, string> = {
  "Сан-Франциско": "$",
  "Сингапур": "S$",
  "Санкт-Петербург": "₽",
  "Сеул": "₩",
};

export const GRM_PER_LOCAL_CURRENCY_BY_CITY: Record<string, number> = {
  "Сан-Франциско": 1,
  "Сингапур": 0.74,
  "Санкт-Петербург": 0.011,
  "Сеул": 0.00075,
};

// Backward compatibility for older UI strings. Do not use in new logic.
export const GRAM_EXCHANGE_RATE = 1;

const LEGACY_CITY_NAME_BY_ID: Record<string, string> = {
  saint_petersburg: "Санкт-Петербург",
  seoul: "Сеул",
  singapore: "Сингапур",
  san_francisco: "Сан-Франциско",
};
const LEGACY_CITY_NAME_BY_ALIAS: Record<string, string> = {
  "санкт-петербург": "Санкт-Петербург",
  "санкт петербург": "Санкт-Петербург",
  seoul: "Сеул",
  "сеул": "Сеул",
  singapore: "Сингапур",
  "сингапур": "Сингапур",
  "san francisco": "Сан-Франциско",
  "san-francisco": "Сан-Франциско",
  sf: "Сан-Франциско",
  "сан-франциско": "Сан-Франциско",
  "сан франциско": "Сан-Франциско",
};

function normalizeCityForLegacyMaps(city: string): string {
  const resolved = resolveCity(city);
  if (!resolved) {
    const normalized = String(city ?? "").trim().toLowerCase();
    return LEGACY_CITY_NAME_BY_ALIAS[normalized] ?? city;
  }
  return LEGACY_CITY_NAME_BY_ID[resolved.id] ?? resolved.name;
}

export function getLocalToGramRate(city: string): number {
  // TODO: Make this rate dynamic when economy.dynamicCurrencyEnabled is configured via admin settings.
  const base = getGrmPerLocal(city);
  const modifier = getGlobalEventModifier({
    type: "currency_modifier",
    target: "all",
    city,
  });
  return Math.max(0.000001, Number(applyGlobalEventMultiplier(base, modifier).toFixed(6)));
}

export function getGramToLocalRate(city: string): number {
  return 1 / getLocalToGramRate(city);
}

const JOBS_BY_CITY: Record<string, Job[]> = {
  "Сан-Франциско": [
    {
      name: "РЎС‚Р°Р¶РµСЂ iOS СЂР°Р·СЂР°Р±РѕС‚С‡РёРє",
      minStats: { coding: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 10,
      expReward: 20,
      description: "Р Р°Р·СЂР°Р±РѕС‚РєР° РїСЂРѕСЃС‚С‹С… С„СѓРЅРєС†РёР№ РґР»СЏ iOS РїСЂРёР»РѕР¶РµРЅРёР№",
    },
    {
      name: "Junior iOS СЂР°Р·СЂР°Р±РѕС‚С‡РёРє",
      minStats: { coding: 2, design: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 25,
      expReward: 30,
      description: "Р Р°Р·СЂР°Р±РѕС‚РєР° РєРѕРјРїРѕРЅРµРЅС‚РѕРІ iOS РїСЂРёР»РѕР¶РµРЅРёР№",
    },
    {
      name: "Middle iOS СЂР°Р·СЂР°Р±РѕС‚С‡РёРє",
      minStats: { coding: 4, design: 2, analytics: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 45,
      expReward: 40,
      description: "Р Р°Р·СЂР°Р±РѕС‚РєР° СЃР»РѕР¶РЅС‹С… С„СѓРЅРєС†РёР№ Рё РѕРїС‚РёРјРёР·Р°С†РёСЏ",
    },
  ],
  "Сингапур": [
    {
      name: "РЎС‚Р°Р¶РµСЂ QA РёРЅР¶РµРЅРµСЂ",
      minStats: { testing: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 15,
      expReward: 20,
      description: "Р‘Р°Р·РѕРІРѕРµ С‚РµСЃС‚РёСЂРѕРІР°РЅРёРµ РјРѕР±РёР»СЊРЅС‹С… СѓСЃС‚СЂРѕР№СЃС‚РІ",
    },
    {
      name: "Junior QA РёРЅР¶РµРЅРµСЂ",
      minStats: { testing: 2, attention: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 30,
      expReward: 30,
      description: "РўРµСЃС‚РёСЂРѕРІР°РЅРёРµ С„СѓРЅРєС†РёРѕРЅР°Р»Р° СѓСЃС‚СЂРѕР№СЃС‚РІ",
    },
    {
      name: "Middle QA РёРЅР¶РµРЅРµСЂ",
      minStats: { testing: 4, attention: 2, analytics: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 50,
      expReward: 40,
      description: "РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ С‚РµСЃС‚РёСЂРѕРІР°РЅРёСЏ СѓСЃС‚СЂРѕР№СЃС‚РІ",
    },
  ],
  "Санкт-Петербург": [
    {
      name: "РЎС‚Р°Р¶РµСЂ UI/UX РґРёР·Р°Р№РЅРµСЂ",
      minStats: { design: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 20,
      expReward: 25,
      description: "РЎРѕР·РґР°РЅРёРµ РїСЂРѕСЃС‚С‹С… СЌР»РµРјРµРЅС‚РѕРІ РёРЅС‚РµСЂС„РµР№СЃР°",
    },
    {
      name: "Junior UI/UX РґРёР·Р°Р№РЅРµСЂ",
      minStats: { design: 2, attention: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 35,
      expReward: 35,
      description: "Р Р°Р·СЂР°Р±РѕС‚РєР° РёРЅС‚РµСЂС„РµР№СЃРѕРІ РїСЂРёР»РѕР¶РµРЅРёР№",
    },
    {
      name: "Middle UI/UX РґРёР·Р°Р№РЅРµСЂ",
      minStats: { design: 4, attention: 2, drawing: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 55,
      expReward: 45,
      description: "РЎРѕР·РґР°РЅРёРµ СЃР»РѕР¶РЅС‹С… РёРЅС‚РµСЂС„РµР№СЃРѕРІ",
    },
  ],
  "Сеул": [
    {
      name: "РЎС‚Р°Р¶РµСЂ Game Developer",
      minStats: { coding: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 22,
      expReward: 25,
      description: "Р Р°Р·СЂР°Р±РѕС‚РєР° РїСЂРѕСЃС‚С‹С… РёРіСЂРѕРІС‹С… РјРµС…Р°РЅРёРє",
    },
    {
      name: "Junior K-Game Dev",
      minStats: { coding: 2, modeling: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 40,
      expReward: 35,
      description: "Р Р°Р±РѕС‚Р° РЅР°Рґ K-Pop РёРіСЂРѕРІС‹РјРё РїСЂРѕРµРєС‚Р°РјРё",
    },
    {
      name: "Middle Engine Developer",
      minStats: { coding: 5, modeling: 3, analytics: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 65,
      expReward: 50,
      description: "РћРїС‚РёРјРёР·Р°С†РёСЏ РёРіСЂРѕРІС‹С… РґРІРёР¶РєРѕРІ",
    },
  ],
};

const SHOP_ITEMS: ShopItem[] = [
  {
    id: "coding-book",
    name: "Учебник по программированию",
    price: 100,
    stats: { coding: 1 },
    description: "Разовое использование: +1 Кодинг",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "testing-course",
    name: "Курс по тестированию",
    price: 100,
    stats: { testing: 1 },
    description: "Разовое использование: +1 Тестирование",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "analytics-book",
    name: "Книга по аналитике",
    price: 100,
    stats: { analytics: 1 },
    description: "Разовое использование: +1 Аналитика",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "drawing-album",
    name: "Альбом для рисования",
    price: 100,
    stats: { drawing: 1 },
    description: "Разовое использование: +1 Рисование",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "advanced-coding",
    name: "Продвинутый курс программирования",
    price: 500,
    stats: { coding: 3 },
    description: "Разовое использование: +3 Кодинг",
    rarity: "Rare",
    type: "consumable",
  },
  {
    id: "gaming-keyboard",
    name: "🎮 Механическая клавиатура",
    price: 250,
    stats: { coding: 1, testing: 1 },
    description: "Экипировка: +1 Кодинг, +1 Тестирование",
    rarity: "Uncommon",
    type: "gear",
  },
  {
    id: "gaming-mouse",
    name: "🖱️ Программируемая мышь",
    price: 200,
    stats: { testing: 1, attention: 1 },
    description: "Экипировка: +1 Тестирование, +1 Внимание",
    rarity: "Uncommon",
    type: "gear",
  },
  {
    id: "monitor-uhd",
    name: "🖥️ 4K Монитор",
    price: 800,
    stats: { design: 2, drawing: 2 },
    description: "Экипировка: +2 Дизайн, +2 Рисование",
    rarity: "Rare",
    type: "gear",
  },
  {
    id: "headphones-pro",
    name: "🎧 Профессиональные наушники",
    price: 300,
    stats: { attention: 2, coding: 1 },
    description: "Экипировка: +2 Внимание, +1 Кодинг",
    rarity: "Uncommon",
    type: "gear",
  },
  {
    id: "laptop-pro",
    name: "💻 MacBook Pro",
    price: 2000,
    stats: { coding: 3, design: 2, testing: 1 },
    description: "Экипировка: +3 Кодинг, +2 Дизайн, +1 Тестирование",
    rarity: "Epic",
    type: "gear",
  },
];

function getSkillTrainingCapForLevel(level: number) {
  return Math.max(5, Math.floor(Number(level || 1)) * 5);
}

function getConsumableTrainingLimitForLevel(level: number) {
  return Math.max(2, 2 + Math.floor((Math.max(1, Number(level || 1)) - 1) / 2));
}

function getConsumableMinLevel(item: ShopItem) {
  if (item.type !== "consumable") return 1;
  if (String(item.rarity || "").toLowerCase() === "epic") return 5;
  if (String(item.rarity || "").toLowerCase() === "rare") return 3;
  return 1;
}

export function getTrainingSkillCapForLevel(
  level: number,
  skill?: SkillName | null,
  professionId?: ProfessionId | null,
) {
  const baseCap = getSkillTrainingCapForLevel(level);
  if (!skill) return baseCap;
  return getProfessionSkillCap(baseCap, professionId ?? null, skill);
}

export function getConsumableTrainingUseLimitForLevel(level: number) {
  return getConsumableTrainingLimitForLevel(level);
}

const CREDIT_PROGRAMS: BankProgram[] = BALANCE_CONFIG.bank.creditPrograms.map((program: BankCreditProgramBalance) => ({
  id: program.id,
  name: program.name,
  minLevel: program.minLevel,
  minAmount: program.minAmount,
  maxAmount: program.maxAmount,
  interest: program.interest,
  durationMinutes: program.durationMinutes,
  overduePenaltyRate: program.overduePenaltyRate,
  graceMinutes: program.graceMinutes,
  description: program.description,
}));

const DEPOSIT_PROGRAMS: BankProgram[] = BALANCE_CONFIG.bank.depositPrograms.map((program: BankDepositProgramBalance) => ({
  id: program.id,
  name: program.name,
  minLevel: program.minLevel,
  minAmount: program.minAmount,
  maxAmount: program.maxAmount,
  durationMinutes: program.durationMinutes,
  description: program.description,
  depositKind: program.depositKind,
  interest: program.guaranteedInterest,
  riskyInterest: program.riskyInterest,
  riskySuccessChance: program.riskySuccessChance,
  pvpRewardBonusPct: program.pvpRewardBonusPct,
  pvpRatingBonusFlat: program.pvpRatingBonusFlat,
  pvpXpBonusPct: program.pvpXpBonusPct,
  pvpBoostDurationMinutes: program.pvpBoostDurationMinutes,
}));

function getDefaultGameState(): GameState {
  return {
    ...EMPTY_GAME_STATE,
    skills: { ...DEFAULT_SKILLS },
    inventory: [],
    lastTickAt: Date.now(),
  };
}

function cloneInventoryItem(item: GameInventoryItem): GameInventoryItem {
  return normalizeGadgetInventoryFields({
    ...item,
    stats: { ...(item.stats || {}) },
  });
}

function sanitizeNumericStatMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(value);
    if (Number.isFinite(num)) out[key] = num;
  }
  return out;
}

function sanitizeSkills(raw: unknown): Skills {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    coding: Number(source.coding ?? 0) || 0,
    testing: Number(source.testing ?? 0) || 0,
    analytics: Number(source.analytics ?? 0) || 0,
    drawing: Number(source.drawing ?? 0) || 0,
    modeling: Number(source.modeling ?? 0) || 0,
    design: Number(source.design ?? 0) || 0,
    attention: Number(source.attention ?? 0) || 0,
  };
}

function sanitizeInventoryItem(raw: unknown): GameInventoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const id = String(source.id ?? "").trim();
  const name = String(source.name ?? "").trim();
  const type = String(source.type ?? "").trim() as InventoryItemType;
  if (!id || !name) return null;
  if (!["consumable", "gear", "part", "gadget"].includes(type)) return null;

  return normalizeGadgetInventoryFields({
    id,
    name,
    type,
    stats: sanitizeNumericStatMap(source.stats),
    rarity: String(source.rarity ?? "Common"),
    quantity: Math.max(1, Math.floor(Number(source.quantity ?? 1) || 1)),
    isEquipped: Boolean(source.isEquipped),
    durability: source.durability !== undefined ? Number(source.durability) : undefined,
    maxDurability: source.maxDurability !== undefined ? Number(source.maxDurability) : undefined,
    condition: source.condition !== undefined ? Number(source.condition) : undefined,
    maxCondition: source.maxCondition !== undefined ? Number(source.maxCondition) : undefined,
    isBroken: source.isBroken !== undefined ? Boolean(source.isBroken) : undefined,
    reliability: source.reliability !== undefined ? Number(source.reliability) : undefined,
    repairStatus: source.repairStatus !== undefined ? String(source.repairStatus) as GameInventoryItem["repairStatus"] : undefined,
    repairOrderId: source.repairOrderId !== undefined ? String(source.repairOrderId) : undefined,
    repairLocked: source.repairLocked !== undefined ? Boolean(source.repairLocked) : undefined,
  });
}

function getRarityWearMultiplier(rarityRaw: string) {
  const rarity = String(rarityRaw || "Common").trim().toLowerCase();
  if (rarity === "exclusive") return 0.55;
  if (rarity === "legendary") return 0.62;
  if (rarity === "epic") return 0.72;
  if (rarity === "rare") return 0.84;
  if (rarity === "uncommon") return 0.94;
  return 1.08;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeGadgetInventoryFields(item: GameInventoryItem): GameInventoryItem {
  if (item.type !== "gadget") {
    return item;
  }

  const maxCondition = Math.max(
    1,
    Math.round(
      Number(
        item.maxCondition
        ?? item.maxDurability
        ?? 100,
      ) || 100,
    ),
  );
  const rawCondition = Number(
    item.condition
    ?? item.durability
    ?? maxCondition,
  );
  const condition = clampNumber(Math.round(Number.isFinite(rawCondition) ? rawCondition : maxCondition), 0, maxCondition);
  const reliability = Number.isFinite(Number(item.reliability))
    ? clampNumber(Number(item.reliability), 0.7, 1.6)
    : 1;

  return {
    ...item,
    condition,
    maxCondition,
    durability: condition,
    maxDurability: maxCondition,
    reliability: Number(reliability.toFixed(2)),
    isBroken: Boolean(item.isBroken) || condition <= 0,
    repairStatus: item.repairStatus ?? "none",
    repairOrderId: item.repairOrderId ? String(item.repairOrderId) : undefined,
    repairLocked: Boolean(item.repairLocked),
    isEquipped: condition <= 0 ? false : Boolean(item.isEquipped),
  };
}

function buildGadgetConditionWarning(before: number, after: number, itemName: string) {
  if (after <= 0 && before > 0) {
    return `💥 Поломка: ${itemName} окончательно сломался. Доступно: ремонт, продажа или разбор.`;
  }
  if (before >= 30 && after < 30) {
    return `🚨 Критическое состояние: ${itemName} стал нестабильным.`;
  }
  if (before >= 70 && after < 70) {
    return `⚠️ Сильный износ: ${itemName} заметно просел по состоянию.`;
  }
  return null;
}

function buildNegativeWearEvent(cause: GadgetWearCause) {
  if (cause === "pvp") return "Сбой в пылу дуэли";
  if (cause === "production") return "Пиковая нагрузка на сборке";
  return "Негативный сбой в разработке";
}

function getBaseWearByCause(cause: GadgetWearCause) {
  if (cause === "pvp") return 1.4;
  if (cause === "production") return 1.2;
  return 0.9;
}

export function createGadgetConditionProfile(input?: {
  rarity?: string;
  quality?: number;
  testing?: number;
  attention?: number;
  maxCondition?: number;
}) {
  const quality = Math.max(0.6, Number(input?.quality ?? 1) || 1);
  const testing = Math.max(0, Number(input?.testing ?? 0) || 0);
  const attention = Math.max(0, Number(input?.attention ?? 0) || 0);
  const rarityWear = getRarityWearMultiplier(String(input?.rarity || "Common"));
  const reliability = clampNumber(
    Number((0.88 + quality * 0.12 + testing * 0.015 + attention * 0.012 + (1 - rarityWear) * 0.35).toFixed(2)),
    0.8,
    1.55,
  );
  const maxCondition = Math.max(1, Math.round(Number(input?.maxCondition ?? 100) || 100));
  return {
    condition: maxCondition,
    maxCondition,
    durability: maxCondition,
    maxDurability: maxCondition,
    isBroken: false,
    reliability,
  };
}

export async function applyGadgetWear(userId: string, options: GadgetWearOptions) {
  const context = await loadContext(userId);
  if (!context) throw new Error("Пользователь не найден");

  const { state } = context;
  const user = context.user;
  const equippedGadgets = state.inventory.filter((item) => item.type === "gadget" && item.isEquipped);
  if (!equippedGadgets.length) {
    return {
      user,
      state,
      notices: context.notices,
      report: {
        cause: options.cause,
        affected: [],
        warnings: [],
        summary: null,
      } satisfies GadgetWearReport,
    };
  }

  const testing = Math.max(0, Number(options.testing ?? state.skills.testing ?? 0));
  const attention = Math.max(0, Number(options.attention ?? state.skills.attention ?? 0));
  const severityMultiplier = clampNumber(Number(options.severityMultiplier ?? 1) || 1, 0.5, 2.5);
  const report: GadgetWearReport = {
    cause: options.cause,
    affected: [],
    warnings: [],
    summary: null,
  };

  for (const rawItem of equippedGadgets) {
    const item = normalizeGadgetInventoryFields(rawItem);
    const before = Math.max(0, Number(item.condition ?? 100));
    if (before <= 0) continue;

    const rarityWear = getRarityWearMultiplier(item.rarity);
    const reliabilityFactor = clampNumber(1.28 - Number(item.reliability ?? 1), 0.5, 1.25);
    const skillProtection = clampNumber(1 - testing * 0.02 - attention * 0.018, 0.55, 1);
    const qualityProtection = clampNumber(1 / Math.max(0.8, Number(options.qualityHint ?? 1) || 1), 0.65, 1.25);
    let wear = getBaseWearByCause(options.cause) * rarityWear * reliabilityFactor * skillProtection * qualityProtection * severityMultiplier;

    const negativeEventChance = clampNumber(
      0.1 + Number(options.negativeEventChanceBonus ?? 0) - attention * 0.01 - testing * 0.008,
      0.02,
      0.18,
    );
    if (Math.random() < negativeEventChance) {
      const extraWear = 0.6 + Math.random() * 1.2;
      wear += extraWear;
      report.warnings.push(`🔻 ${buildNegativeWearEvent(options.cause)}: ${item.name} получил дополнительный износ.`);
    }

    const after = clampNumber(Number((before - wear).toFixed(1)), 0, Number(item.maxCondition ?? 100));
    item.condition = after;
    item.maxCondition = Math.max(1, Number(item.maxCondition ?? 100));
    item.durability = after;
    item.maxDurability = item.maxCondition;

    const warning = buildGadgetConditionWarning(before, after, item.name);
    if (warning) report.warnings.push(warning);

    if (after <= 0) {
      if (item.isEquipped) {
        adjustSkillByItemStats(state, item, -1);
      }
      item.isEquipped = false;
      item.isBroken = true;
    } else {
      item.isBroken = false;
    }

    report.affected.push({
      itemId: item.id,
      itemName: item.name,
      before,
      after,
      lost: Number((before - after).toFixed(1)),
      isBroken: Boolean(item.isBroken),
    });
  }

  if (report.affected.length) {
    report.summary = [
      "🛠 Состояние гаджетов:",
      ...report.affected.map((item) => `• ${item.itemName}: ${Math.round(item.before)} → ${Math.round(item.after)}${item.isBroken ? " (сломано)" : ""}`),
      ...report.warnings,
    ].join("\n");
  }

  return { user, state, notices: context.notices, report };
}

export async function scrapBrokenGadgetItem(userId: string, itemRef: string) {
  const context = await loadContext(userId);
  if (!context) throw new Error("Пользователь не найден");

  const { state } = context;
  const item = findInventoryItemByRef(state, itemRef);
  if (!item) throw new Error("Предмет не найден");
  if (item.type !== "gadget") throw new Error("Разобрать можно только гаджет");
  const gadget = normalizeGadgetInventoryFields(item);
  if (!gadget.isBroken) throw new Error("Разбор доступен только для сломанных гаджетов");

  const recoveredParts: GameInventoryItem[] = [];
  const firstPart = createPartInventoryItem(rollRandomPartDrop(35));
  const secondPart = Math.random() < 0.45 ? createPartInventoryItem(rollRandomPartDrop(22)) : null;
  for (const part of [firstPart, secondPart].filter(Boolean) as GameInventoryItem[]) {
    if (canStoreInventoryItem(context.user, state, { id: part.id, type: part.type })) {
      addInventoryItem(state, part);
      recoveredParts.push(part);
    }
  }

  removeOneInventoryItem(state, gadget);
  return {
    user: context.user,
    state,
    notices: [
      ...context.notices,
      `♻️ Гаджет разобран: ${gadget.name}`,
      recoveredParts.length
        ? `Получены компоненты: ${recoveredParts.map((part) => part.name).join(", ")}`
        : "Полезных компонентов извлечь не удалось.",
    ],
    item: gadget,
    recoveredParts,
  };
}

function sanitizeBankProduct(raw: unknown): GameBankProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const type = String(source.type ?? "") as BankProductType;
  if (type !== "credit" && type !== "deposit") return null;

  const amount = Number(source.amount ?? 0);
  const daysLeft = Number(source.daysLeft ?? 0);
  const totalDays = Number(source.totalDays ?? 0);
  const totalReturn = Number(source.totalReturn ?? 0);
  const name = String(source.name ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(daysLeft) || daysLeft <= 0) return null;
  if (!Number.isFinite(totalDays) || totalDays <= 0) return null;
  if (!Number.isFinite(totalReturn) || totalReturn <= 0) return null;
  if (!name) return null;

  return {
    type,
    amount,
    daysLeft,
    totalDays,
    totalReturn,
    name,
    programId: source.programId !== undefined ? String(source.programId) : undefined,
    depositKind: source.depositKind === "safe" || source.depositKind === "risky" || source.depositKind === "pvp"
      ? source.depositKind
      : undefined,
    overduePenaltyRate: source.overduePenaltyRate !== undefined ? Number(source.overduePenaltyRate) : undefined,
    graceMinutes: source.graceMinutes !== undefined ? Number(source.graceMinutes) : undefined,
    isOverdue: source.isOverdue !== undefined ? Boolean(source.isOverdue) : undefined,
    rewardBonusPct: source.rewardBonusPct !== undefined ? Number(source.rewardBonusPct) : undefined,
    ratingBonusFlat: source.ratingBonusFlat !== undefined ? Number(source.ratingBonusFlat) : undefined,
    xpBonusPct: source.xpBonusPct !== undefined ? Number(source.xpBonusPct) : undefined,
    boostDurationMinutes: source.boostDurationMinutes !== undefined ? Number(source.boostDurationMinutes) : undefined,
  };
}

function sanitizePvpBankBoost(raw: unknown): GamePvpBankBoost | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const sourceName = String(source.sourceName ?? "").trim();
  const rewardBonusPct = Number(source.rewardBonusPct ?? 0);
  const ratingBonusFlat = Number(source.ratingBonusFlat ?? 0);
  const xpBonusPct = Number(source.xpBonusPct ?? 0);
  const expiresAt = Number(source.expiresAt ?? 0);
  if (!sourceName || !Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  return {
    sourceName,
    rewardBonusPct: Number.isFinite(rewardBonusPct) ? rewardBonusPct : 0,
    ratingBonusFlat: Number.isFinite(ratingBonusFlat) ? ratingBonusFlat : 0,
    xpBonusPct: Number.isFinite(xpBonusPct) ? xpBonusPct : 0,
    expiresAt,
  };
}

function addInventoryItem(state: GameState, item: GameInventoryItem) {
  const existing = state.inventory.find((current) => current.id === item.id && current.type === item.type);
  if (existing) {
    existing.quantity = Math.max(1, (existing.quantity || 1) + Math.max(1, item.quantity || 1));
    return;
  }

  state.inventory.push(cloneInventoryItem(item));
}

export function createTutorialMedalItem(): GameInventoryItem {
  return {
    id: TUTORIAL_MEDAL_ITEM_ID,
    name: "🏅 Медаль за обучение",
    stats: {},
    rarity: "Epic",
    quantity: 1,
    type: "part",
  };
}

export async function grantInventoryItemToPlayer(userId: string, item: GameInventoryItem) {
  const context = await loadContext(userId);
  if (!context) throw new Error("Пользователь не найден");
  addInventoryItem(context.state, item);
  return { user: context.user, state: context.state };
}

export async function hasInventoryItemById(userId: string, itemId: string) {
  const context = await loadContext(userId);
  if (!context) return false;
  return context.state.inventory.some((item) => item.id === itemId);
}

function getInventoryUsedSlots(state: GameState) {
  return state.inventory.length;
}

function hasFreeInventorySlot(user: Pick<User, "city" | "tutorialState">, state: GameState) {
  return getInventoryUsedSlots(state) < getInventoryCapacityForUser(user);
}

function canStoreInventoryItem(user: Pick<User, "city" | "tutorialState">, state: GameState, item: Pick<GameInventoryItem, "id" | "type">) {
  void item;
  return hasFreeInventorySlot(user, state);
}

function countOwnedAsicUnits(state: GameState) {
  return state.inventory
    .filter((item) => {
      const label = `${item.id} ${item.name}`.toLowerCase();
      return item.type === "gadget" && (label.includes("asic") || label.includes("miner"));
    })
    .reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
}

function getHousingEnergyMultiplier(user: Pick<User, "city" | "tutorialState">, mode: "work" | "study") {
  const activeHouse = getActiveHousing(user);
  return Math.max(0.5, Number(
    mode === "work"
      ? activeHouse?.bonuses.workEnergyMultiplier ?? 1
      : activeHouse?.bonuses.studyEnergyMultiplier ?? 1,
  ));
}

async function applyHousingPassiveIncome(user: User, state: GameState, notices: string[]) {
  const activeHouse = getActiveHousing(user);
  if (!activeHouse || Number(activeHouse.bonuses.asicSlots || 0) <= 0 || Number(activeHouse.bonuses.asicGramPerHour || 0) <= 0) {
    return;
  }

  const asicUnits = countOwnedAsicUnits(state);
  if (asicUnits <= 0) return;

  const activeAsicUnits = Math.min(asicUnits, Math.max(0, Number(activeHouse.bonuses.asicSlots || 0)));
  if (activeAsicUnits <= 0) return;

  const now = Date.now();
  const lastPayoutAt = getHousingLastAsicPayoutAt(user) || now;
  const elapsedMs = Math.max(0, now - lastPayoutAt);
  if (elapsedMs < 60 * 60 * 1000) return;

  const gramPerHour = Number(activeHouse.bonuses.asicGramPerHour || 0) * activeAsicUnits;
  if (gramPerHour <= 0) return;

  const earned = Number(((elapsedMs / (60 * 60 * 1000)) * gramPerHour).toFixed(2));
  if (earned < 0.05) return;

  state.gramBalance = Number((state.gramBalance + earned).toFixed(2));
  await markHousingAsicPayout(user.id, user.city, now);
  notices.push(`🏠 Домашний ASIC принёс +${earned.toFixed(2)} GRM (${activeAsicUnits} активн.)`);
}

function removeOneInventoryItem(state: GameState, item: GameInventoryItem) {
  if (item.quantity > 1) {
    item.quantity -= 1;
    return;
  }
  state.inventory = state.inventory.filter((inv) => inv !== item);
}

function adjustSkillByItemStats(state: GameState, item: GameInventoryItem, multiplier: 1 | -1) {
  for (const [key, value] of Object.entries(item.stats || {})) {
    if (!(key in state.skills)) continue;
    const skillKey = key as SkillName;
    const next = state.skills[skillKey] + Number(value) * multiplier;
    state.skills[skillKey] = Number(next.toFixed(2));
  }
}

function findInventoryItemByRef(state: GameState, ref: string) {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed) - 1;
    if (index >= 0 && index < state.inventory.length) return state.inventory[index];
    return null;
  }

  return state.inventory.find((item) => item.id === trimmed) ?? null;
}

function localizeAmountForCity(baseLocalAmount: number, city?: string) {
  const rate = Math.max(0.000001, getGrmPerLocal(city || "Сан-Франциско"));
  return Math.max(1, Math.round(baseLocalAmount / rate));
}

function findShopItemByRef(ref: string, city?: string) {
  const items = listShopItems(city);
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed) - 1;
    if (index >= 0 && index < items.length) return items[index];
    return null;
  }

  return items.find((item) => item.id === trimmed) ?? null;
}

function withBalancedJob(city: string, job: Job): Job {
  const tier = resolveJobTierFromRank(job.rankRequired);
  const salaryModifier = getGlobalEventModifier({
    type: "salary_modifier",
    target: "jobs",
    city,
  });
  return {
    ...job,
    reward: Math.max(1, Math.round(applyGlobalEventMultiplier(getJobRewardLocalByTier(city, tier), salaryModifier))),
    expReward: getJobXpByTier(city, tier),
  };
}

function getJobsForPlayer(city: string, professionId?: ProfessionId | null, level = 1) {
  const normalizedCity = normalizeCityForLegacyMaps(city);
  const jobs = (JOBS_BY_CITY[normalizedCity] ?? []).map((job) => withBalancedJob(city, job));
  if (!professionId || level < 15) return jobs;

  const specialJobs = PROFESSION_SPECIAL_JOBS
    .filter((job) => job.professionId === professionId && level >= job.minLevel)
    .map((job) => {
      const balanced = withBalancedJob(city, {
        id: job.id,
        name: job.name,
        minStats: job.minStats,
        rankRequired: job.rankRequired,
        timeMinutes: 5,
        reward: 0,
        expReward: 0,
        description: job.description,
      });
      return {
        ...balanced,
        minLevel: job.minLevel,
        professionId: job.professionId,
        energyCost: job.energyCost,
        skillRewards: job.skillRewards,
        reward: Math.max(1, Math.round(balanced.reward * job.rewardMultiplier)),
        expReward: Math.max(1, Math.round(balanced.expReward * job.expMultiplier)),
      };
    });

  return [...jobs, ...specialJobs];
}

function findJobByRef(city: string, ref: string, professionId?: ProfessionId | null, level = 1) {
  const jobs = getJobsForPlayer(city, professionId, level);
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed) - 1;
    if (index >= 0 && index < jobs.length) return jobs[index];
    return null;
  }

  const found = jobs.find((job) => job.name.toLowerCase() === trimmed.toLowerCase()) ?? null;
  return found ?? null;
}

function findBankProgramByRef(type: BankProductType, ref: string, city?: string) {
  const programs = type === "credit" ? listCreditPrograms(city) : listDepositPrograms(city);
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed) - 1;
    if (index >= 0 && index < programs.length) return programs[index];
    return null;
  }

  return programs.find((program) =>
    program.id.toLowerCase() === trimmed.toLowerCase()
    || program.name.toLowerCase() === trimmed.toLowerCase()
  ) ?? null;
}

function getBankProductCompletionValue(product: GameBankProduct) {
  if (product.type === "credit") {
    return Math.round(product.totalReturn);
  }
  if (product.depositKind === "safe") {
    return Math.round(product.totalReturn);
  }
  if (product.depositKind === "risky") {
    const successChance = Math.max(0, Math.min(1, Number(product.rewardBonusPct || 0)));
    const hit = Math.random() < successChance;
    return hit ? Math.round(product.totalReturn) : Math.round(product.amount);
  }
  return Math.round(product.amount);
}

function resolveCityBonus(user: User): CityBonus {
  const rep = Math.max(0, Number(user.reputation || 0));
  const profile = getCityProfile(user.city);

  const repFailureReduction =
    rep >= 1000 ? 8 :
      rep >= 600 ? 6 :
        rep >= 300 ? 4 :
          rep >= 100 ? 2 : 0;

  const repSalaryBoost =
    rep >= 1000 ? 6 :
      rep >= 600 ? 4 :
        rep >= 300 ? 2 : 0;

  const repXpBoost =
    rep >= 1000 ? 6 :
      rep >= 600 ? 4 :
        rep >= 300 ? 2 : 0;

  return {
    failureRateReduction: repFailureReduction + profile.failChanceFlatReduction,
    salaryBoost: repSalaryBoost,
    xpBoost: repXpBoost,
    skillGrowthBoost: Math.max(0, Math.round((getEducationSkillMultiplier(user.city) - 1) * 100)),
  };
}

function applyExperience(user: User, gain: number) {
  let level = user.level;
  let experience = user.experience + gain;

  while (experience >= 100) {
    level += 1;
    experience -= 100;
  }

  return { level, experience };
}

function hasStrategistBonus(user: User) {
  return getAdvancedPersonalityId(user) === "strategist";
}

function applyStrategistReputationGain(baseReputation: number, user: User) {
  if (!hasStrategistBonus(user)) return baseReputation;
  const scaled = baseReputation * ADVANCED_PERSONALITY_MODIFIERS.strategist.reputationSuccessMultiplier;
  return Math.max(baseReputation, Math.round(scaled));
}

function getOrCreateState(userId: string): GameState {
  const current = getPlayerRuntimeState(userId);
  if (current) {
    if (!Number.isFinite(Number((current as any).gramBalance))) {
      current.gramBalance = 0;
    }
    return current;
  }

  const created = getDefaultGameState();
  return setPlayerRuntimeState(userId, created);
}

async function advanceState(user: User, state: GameState): Promise<GameTickResult> {
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - state.lastTickAt) / 1000));
  state.lastTickAt = now;

  const notices: string[] = [];
  if (elapsedSeconds <= 0) return { user, notices };

  state.workTime = Math.min(1, Number((state.workTime + elapsedSeconds * ENERGY_REGEN_PER_SECOND).toFixed(4)));
  state.studyTime = Math.min(1, Number((state.studyTime + elapsedSeconds * ENERGY_REGEN_PER_SECOND).toFixed(4)));

  if (state.activePvpBankBoost && state.activePvpBankBoost.expiresAt <= now) {
    notices.push(`🏦 PvP-вклад "${state.activePvpBankBoost.sourceName}" завершился.`);
    state.activePvpBankBoost = null;
  }

  if (!state.activeBankProduct) return { user, notices };

  const nextMinutesLeft = state.activeBankProduct.daysLeft - elapsedSeconds / 60;
  if (nextMinutesLeft > 0) {
    state.activeBankProduct.daysLeft = nextMinutesLeft;
    return { user, notices };
  }

  const completedProduct = state.activeBankProduct;
  const advancedPersonality = getAdvancedPersonalityId(user);
  const currency = getCurrencySymbol(user.city);

  if (completedProduct.type === "deposit") {
    state.activeBankProduct = null;

    if (completedProduct.depositKind === "pvp") {
      state.activePvpBankBoost = {
        sourceName: completedProduct.name,
        rewardBonusPct: Number(completedProduct.rewardBonusPct || 0),
        ratingBonusFlat: Number(completedProduct.ratingBonusFlat || 0),
        xpBonusPct: Number(completedProduct.xpBonusPct || 0),
        expiresAt: now + Math.max(1, Number(completedProduct.boostDurationMinutes || 0)) * 60_000,
      };
      const updated = await storage.updateUser(user.id, {
        balance: user.balance + Math.round(completedProduct.amount),
      });
      notices.push(
        `✅ PvP-вклад завершён: ${currency}${Math.round(completedProduct.amount)} возвращены, а PvP-бонус активен ${Math.max(1, Math.round(Number(completedProduct.boostDurationMinutes || 0)))}м.`,
      );
      return { user: updated, notices };
    }

    let payout = getBankProductCompletionValue(completedProduct);
    if (advancedPersonality === "investor") {
      payout = Math.max(1, Math.round(payout * ADVANCED_PERSONALITY_MODIFIERS.investor.investmentIncomeMultiplier));
    }
    const updated = await storage.updateUser(user.id, {
      balance: user.balance + payout,
    });
    if (completedProduct.depositKind === "risky" && payout <= Math.round(completedProduct.amount)) {
      notices.push(`⚠️ Рискованный вклад завершён без прибыли. Возвращено ${currency}${payout}.`);
    } else {
      notices.push(`✅ Вклад завершён: +${currency}${payout}`);
    }
    return { user: updated, notices };
  }

  const creditDue = Math.round(completedProduct.totalReturn);
  if (user.balance >= creditDue) {
    state.activeBankProduct = null;
    const updated = await storage.updateUser(user.id, {
      balance: user.balance - creditDue,
    });
    notices.push(`✅ Кредит автоматически погашен: -${currency}${creditDue}`);
    return { user: updated, notices };
  }

  if (completedProduct.isOverdue) {
    state.activeBankProduct = null;
    const reputationLoss = 5;
    const updated = await storage.updateUser(user.id, {
      reputation: Math.max(0, Number(user.reputation || 0) - reputationLoss),
    });
    notices.push(`⚠️ Просрочка по кредиту усилилась. Долг закрыт банком, репутация -${reputationLoss}.`);
    return { user: updated, notices };
  }

  const penaltyRate = Math.max(0, Number(completedProduct.overduePenaltyRate || 0.15));
  const graceMinutes = Math.max(30, Math.round(Number(completedProduct.graceMinutes || 60)));
  const overdueReturn = Math.max(1, Math.round(creditDue * (1 + penaltyRate)));
  state.activeBankProduct = {
    ...completedProduct,
    totalReturn: overdueReturn,
    totalDays: graceMinutes,
    daysLeft: graceMinutes,
    isOverdue: true,
  };
  const updated = await storage.updateUser(user.id, {
    reputation: Math.max(0, Number(user.reputation || 0) - 3),
  });
  notices.push(`⚠️ Кредит просрочен. Долг вырос до ${currency}${overdueReturn}, на погашение есть ещё ${graceMinutes}м.`);
  return { user: updated, notices };
}

async function loadContext(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;
  const state = getOrCreateState(userId);
  const tick = await advanceState(user, state);
  await applyHousingPassiveIncome(tick.user, state, tick.notices);
  return { user: tick.user, state, notices: tick.notices };
}

function createPartInventoryItem(part: ReturnType<typeof rollRandomPartDrop>) {
  if (!part) return null;
  const rarity = part.rarity as RarityName;
  const icon = RARITY_LEVELS[rarity]?.icon ?? "";
  return {
    id: part.id,
    name: icon ? `${icon} ${part.name}` : part.name,
    stats: part.stats as Record<string, number>,
    rarity: part.rarity,
    quantity: 1,
    type: "part" as const,
  };
}

export function getCurrencySymbol(city: string) {
  const resolved = resolveCity(city);
  if (resolved?.currencySymbol) return resolved.currencySymbol;
  const normalizedCity = normalizeCityForLegacyMaps(city);
  return CITY_CURRENCY[normalizedCity] ?? "$";
}

export function getGadgetConditionStatusLabel(item: Pick<GameInventoryItem, "type" | "condition" | "maxCondition" | "durability" | "maxDurability" | "isBroken">) {
  if (item.type !== "gadget") return "не применяется";
  const normalized = normalizeGadgetInventoryFields(item as GameInventoryItem);
  if (normalized.isBroken || Number(normalized.condition || 0) <= 0) return "сломано";
  const percent = Math.round((Number(normalized.condition || 0) / Math.max(1, Number(normalized.maxCondition || 100))) * 100);
  if (percent < 30) return "нестабилен";
  if (percent < 70) return "сильный износ";
  return "норма";
}

export function listJobsByCity(city: string, professionId?: ProfessionId | null, level = 1) {
  return getJobsForPlayer(city, professionId, level);
}

export function getJobWorkEnergyCost(job: Job) {
  if (typeof job.energyCost === "number" && Number.isFinite(job.energyCost)) {
    return Math.max(0.01, Number(job.energyCost));
  }
  return getJobWorkEnergyCostByTier(resolveJobTierFromRank(job.rankRequired));
}

export function getInventoryCapacity(user: Pick<User, "city" | "tutorialState">) {
  return getInventoryCapacityForUser(user);
}

export function listShopItems(city?: string) {
  return SHOP_ITEMS.map((item) => {
    const priceModifier = getGlobalEventModifier({
      type: "price_modifier",
      target: item.id,
      city: city || "global",
    });
    if (priceModifier > 0.15) {
      registerPriceSpikeSignal(item.id, Math.round(priceModifier * 10));
    }
    const basePrice = item.type === "consumable"
      ? Math.round(item.price * 1.25)
      : item.price;
    const localizedPrice = localizeAmountForCity(basePrice, city);
    return {
      ...item,
      price: Math.max(1, Math.round(applyGlobalEventMultiplier(localizedPrice, priceModifier))),
    };
  });
}

export function listCreditPrograms(city?: string) {
  return CREDIT_PROGRAMS.map((program) => ({
    ...program,
    minAmount: localizeAmountForCity(program.minAmount, city),
    maxAmount: localizeAmountForCity(program.maxAmount, city),
  }));
}

export function listDepositPrograms(city?: string) {
  return DEPOSIT_PROGRAMS.map((program) => ({
    ...program,
    minAmount: localizeAmountForCity(program.minAmount, city),
    maxAmount: localizeAmountForCity(program.maxAmount, city),
  }));
}

export function getActivePvpBankBoost(userId: string) {
  const state = getOrCreateState(userId);
  const boost = sanitizePvpBankBoost(state.activePvpBankBoost);
  if (!boost) {
    state.activePvpBankBoost = null;
    return null;
  }
  if (boost.expiresAt <= Date.now()) {
    state.activePvpBankBoost = null;
    return null;
  }
  return boost;
}

export function consumePvpBankBoost(userId: string) {
  const boost = getActivePvpBankBoost(userId);
  if (!boost) return null;
  const state = getOrCreateState(userId);
  state.activePvpBankBoost = null;
  return boost;
}

export async function getUserWithGameState(userId: string) {
  const context = await loadContext(userId);
  if (!context) return null;

  return {
    user: context.user,
    game: {
      skills: context.state.skills,
      inventory: context.state.inventory,
      workTime: context.state.workTime,
      studyTime: context.state.studyTime,
      gramBalance: context.state.gramBalance,
      activeBankProduct: context.state.activeBankProduct,
      activePvpBankBoost: getActivePvpBankBoost(userId),
      jobDropPity: context.state.jobDropPity,
    },
    notices: context.notices,
  };
}

export function applyGameStatePatch(userId: string, payload: any) {
  const state = getOrCreateState(userId);
  if (!payload || typeof payload !== "object") return state;

  if ("skills" in payload) {
    state.skills = sanitizeSkills(payload.skills);
  }

  if ("inventory" in payload && Array.isArray(payload.inventory)) {
    state.inventory = payload.inventory
      .map((item: unknown) => sanitizeInventoryItem(item))
      .filter(Boolean) as GameInventoryItem[];
  }

  if ("workTime" in payload && Number.isFinite(Number(payload.workTime))) {
    const value = Number(payload.workTime);
    state.workTime = value > 1 ? Math.max(0, Math.min(1, value / 100)) : Math.max(0, Math.min(1, value));
  }

  if ("studyTime" in payload && Number.isFinite(Number(payload.studyTime))) {
    const value = Number(payload.studyTime);
    state.studyTime = value > 1 ? Math.max(0, Math.min(1, value / 100)) : Math.max(0, Math.min(1, value));
  }

  if ("gramBalance" in payload && Number.isFinite(Number(payload.gramBalance))) {
    state.gramBalance = Math.max(0, Number(Number(payload.gramBalance).toFixed(2)));
  }

  if ("activeBankProduct" in payload) {
    state.activeBankProduct = sanitizeBankProduct(payload.activeBankProduct);
  }

  if ("activePvpBankBoost" in payload) {
    state.activePvpBankBoost = sanitizePvpBankBoost(payload.activePvpBankBoost);
  }

  state.lastTickAt = Date.now();
  return state;
}

export async function performQuickWork(userId: string) {
  await assertFeatureEnabled("jobs", "Jobs are disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];

  const quickWorkEnergyCost = Number((getJobWorkEnergyCostByTier("intern") * getHousingEnergyMultiplier(user, "work")).toFixed(4));
  if (state.workTime < quickWorkEnergyCost) {
    throw new Error("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЌРЅРµСЂРіРёРё РґР»СЏ СЂР°Р±РѕС‚С‹ (РЅСѓР¶РЅРѕ РјРёРЅРёРјСѓРј 30%)");
  }

  const settings = await getGameSettings();
  const bonus = settings.systems.cityBonusesEnabled ? resolveCityBonus(user) : { failureRateReduction: 0, salaryBoost: 0, skillGrowthBoost: 0, xpBoost: 0 };
  let moneyGained = getJobRewardLocalByTier(user.city, "intern");
  let expGained = getJobXpByTier(user.city, "intern");

  if (user.personality === "workaholic") expGained = Math.floor(expGained * 1.2);
  if (user.personality === "businessman") moneyGained = Math.floor(moneyGained * 1.15);

  moneyGained = Math.floor(moneyGained * (1 + bonus.salaryBoost / 100));
  expGained = Math.floor(expGained * (1 + bonus.xpBoost / 100));
  moneyGained = Math.max(1, Math.floor(moneyGained * Math.max(0.1, settings.multipliers.workIncomeMultiplier)));
  expGained = Math.max(1, Math.floor(expGained * Math.max(0.1, settings.multipliers.workXpMultiplier)));

  const nextLevel = applyExperience(user, expGained);
  const reputationGain = applyStrategistReputationGain(2, user);
  user = await storage.updateUser(user.id, {
    balance: user.balance + moneyGained,
    reputation: (user.reputation || 0) + reputationGain,
    level: nextLevel.level,
    experience: nextLevel.experience,
  });

  state.workTime = Math.max(0, Number((state.workTime - quickWorkEnergyCost).toFixed(4)));

  const droppedPart = rollRandomPartDrop(22);
  const partItem = createPartInventoryItem(droppedPart);
  if (partItem) {
    if (canStoreInventoryItem(user, state, partItem)) {
      addInventoryItem(state, partItem);
      notices.push(`рџЋЃ РќР°Р№РґРµРЅР° РґРµС‚Р°Р»СЊ: ${droppedPart?.name} (${droppedPart?.rarity})`);
    } else {
      notices.push("📦 Инвентарь дома заполнен: деталь не поместилась.");
    }
  }

  return { user, state, notices, moneyGained, expGained, droppedPart };
}

export async function performStudy(userId: string) {
  await assertFeatureEnabled("education", "Education is disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];

  const quickStudyEnergyCost = Number((BALANCE_CONFIG.energy.studyCostByLevel.school * getHousingEnergyMultiplier(user, "study")).toFixed(4));
  if (state.studyTime < quickStudyEnergyCost) {
    throw new Error("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЌРЅРµСЂРіРёРё РґР»СЏ СѓС‡РµР±С‹ (РЅСѓР¶РЅРѕ РјРёРЅРёРјСѓРј 30%)");
  }

  const skillBoosts: SkillName[] = ["coding", "testing", "analytics"];
  const boostedSkill = skillBoosts[Math.floor(Math.random() * skillBoosts.length)];
  const settings = await getGameSettings();
  const bonus = settings.systems.cityBonusesEnabled ? resolveCityBonus(user) : { failureRateReduction: 0, salaryBoost: 0, skillGrowthBoost: 0, xpBoost: 0 };

  let skillIncrease = Math.max(1, Math.round(getEducationSkillMultiplier(user.city)));
  if (bonus.skillGrowthBoost > 0 && Math.random() * 100 < bonus.skillGrowthBoost) {
    skillIncrease += 1;
  }
  if (user.personality === "lucky" && Math.random() < 0.2) {
    skillIncrease += 1;
  }

  state.skills[boostedSkill] = Number((state.skills[boostedSkill] + skillIncrease).toFixed(2));
  state.studyTime = Math.max(0, Number((state.studyTime - quickStudyEnergyCost).toFixed(4)));

  const reputationGain = applyStrategistReputationGain(3, user);
  user = await storage.updateUser(user.id, {
    reputation: (user.reputation || 0) + reputationGain,
  });

  notices.push(`рџ“љ РќР°РІС‹Рє ${boostedSkill} СѓРІРµР»РёС‡РµРЅ РЅР° +${skillIncrease}`);

  return { user, state, notices, boostedSkill, skillIncrease };
}

export async function completeJob(userId: string, jobRef: string) {
  await assertFeatureEnabled("jobs", "Jobs are disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];

  const professionId = getPlayerProfessionId(user);
  const job = findJobByRef(user.city, jobRef, professionId, user.level);
  if (!job) throw new Error("Вакансия не найдена");
  const energyCost = Number((getJobWorkEnergyCost(job) * getHousingEnergyMultiplier(user, "work")).toFixed(4));
  if (state.workTime < energyCost) {
    throw new Error(`Недостаточно энергии для работы. Нужно ${Math.round(energyCost * 100)}, доступно ${Math.round(state.workTime * 100)}.`);
  }

  let finalMoney = job.reward;
  let finalExp = job.expReward;
  const settings = await getGameSettings();
  const bonus = settings.systems.cityBonusesEnabled
    ? resolveCityBonus(user)
    : { failureRateReduction: 0, salaryBoost: 0, skillGrowthBoost: 0, xpBoost: 0 };

  state.workTime = Math.max(0, Number((state.workTime - energyCost).toFixed(4)));
  const effectiveFailureChance = getJobFailureChance(
    user.city,
    resolveJobTierFromRank(job.rankRequired),
    bonus.failureRateReduction,
  );
  const failed = Math.random() * 100 < effectiveFailureChance;
  if (failed) {
    const penaltyMoney = Math.max(1, Math.floor(job.reward * 0.2));
    user = await storage.updateUser(user.id, {
      balance: Math.max(0, user.balance - penaltyMoney),
    });
    notices.push(`❌ Вакансия провалена: штраф ${getCurrencySymbol(user.city)}${penaltyMoney}.`);
    return {
      user,
      state,
      notices,
      job,
      failed: true,
      penaltyMoney,
      failureChance: effectiveFailureChance,
      energyCost,
      reputationGain: 0,
    };
  }

  if (user.personality === "workaholic") finalExp = Math.floor(finalExp * 1.2);
  if (user.personality === "businessman") finalMoney = Math.floor(finalMoney * 1.15);
  if (user.personality === "lucky" && Math.random() < 0.2) {
    finalMoney = Math.floor(finalMoney * 1.1);
    finalExp = Math.floor(finalExp * 1.1);
    notices.push("🍀 Удача сработала: +10% денег и XP за вакансию.");
  }

  finalMoney = Math.floor(finalMoney * (1 + bonus.salaryBoost / 100));
  finalExp = Math.floor(finalExp * (1 + bonus.xpBoost / 100));
  finalMoney = Math.max(1, Math.floor(finalMoney * Math.max(0.1, settings.multipliers.workIncomeMultiplier)));
  finalExp = Math.max(1, Math.floor(finalExp * Math.max(0.1, settings.multipliers.workXpMultiplier)));

  const expState = applyExperience(user, finalExp);
  const reputationGain = applyStrategistReputationGain(2, user);
  const nextSkills = { ...state.skills };
  const skillNotices: string[] = [];
  for (const [skillKey, rawBoost] of Object.entries(job.skillRewards || {})) {
    if (!(skillKey in nextSkills)) continue;
    const boost = Number(rawBoost || 0);
    if (!Number.isFinite(boost) || boost <= 0) continue;
    const typedSkill = skillKey as SkillName;
    const scaled = Math.max(1, Math.round(boost * getProfessionSkillGrowthMultiplier(professionId, typedSkill)));
    nextSkills[typedSkill] = Number((nextSkills[typedSkill] + scaled).toFixed(2));
    skillNotices.push(`${typedSkill} +${scaled}`);
  }
  state.skills = nextSkills;
  user = await storage.updateUser(user.id, {
    balance: user.balance + finalMoney,
    reputation: (user.reputation || 0) + reputationGain,
    level: expState.level,
    experience: expState.experience,
  });
  if (skillNotices.length) {
    notices.push(`📚 Профильный рост навыков: ${skillNotices.join(", ")}`);
  }

  const baseChance = job.expReward >= 45 ? 50 : job.expReward >= 30 ? 38 : 28;
  const effectiveChance = Math.min(85, baseChance + state.jobDropPity * 15);
  const droppedPart = rollRandomPartDrop(effectiveChance);

  if (droppedPart) {
    const partItem = createPartInventoryItem(droppedPart);
    if (partItem && canStoreInventoryItem(user, state, partItem)) {
      addInventoryItem(state, partItem);
      state.jobDropPity = 0;
      notices.push(`рџЋЃ Р—Р° РІР°РєР°РЅСЃРёСЋ РїРѕР»СѓС‡РµРЅР° РґРµС‚Р°Р»СЊ: ${droppedPart.name} (${droppedPart.rarity})`);
    } else {
      notices.push(`📦 Инвентарь полон, запчасть "${droppedPart.name}" потеряна.`);
    }
  } else {
    state.jobDropPity = Math.min(state.jobDropPity + 1, 4);
  }

  return {
    user,
    state,
    notices,
    job,
    finalMoney,
    finalExp,
    effectiveChance,
    droppedPart,
    energyCost,
    failed: false,
    failureChance: effectiveFailureChance,
    penaltyMoney: 0,
    reputationGain,
  };
}

export async function buyShopItem(userId: string, itemRef: string) {
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];

  const item = findShopItemByRef(itemRef, user.city);
  if (!item) throw new Error("РџСЂРµРґРјРµС‚ РЅРµ РЅР°Р№РґРµРЅ");
  if (item.type === "consumable") {
    const minLevel = getConsumableMinLevel(item);
    if (Number(user.level || 1) < minLevel) {
      throw new Error(`Этот курс откроется с ${minLevel} уровня.`);
    }
  }
  if (user.balance < item.price) throw new Error("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ");
  if (!canStoreInventoryItem(user, state, { id: item.id, type: item.type })) {
    throw new Error(`Инвентарь заполнен. Доступно слотов: ${getInventoryCapacityForUser(user)}.`);
  }

  user = await storage.updateUser(user.id, {
    balance: user.balance - item.price,
  });

  addInventoryItem(state, {
    id: item.id,
    name: item.name,
    stats: { ...item.stats },
    rarity: item.rarity,
    quantity: 1,
    type: item.type,
  });

  notices.push(`🛍 Куплено: ${item.name}`);
  return { user, state, notices, item };
}

export async function useInventoryItem(userId: string, itemRef: string) {
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  const notices = [...context.notices];
  const item = findInventoryItemByRef(state, itemRef);
  if (!item) throw new Error("РџСЂРµРґРјРµС‚ РЅРµ РЅР°Р№РґРµРЅ");

  if (item.type === "consumable") {
    const trainingLimit = getConsumableTrainingLimitForLevel(context.user.level);
    const usedAtLevel = getTrainingConsumablesUsedAtLevel(context.user);
    const professionId = getPlayerProfessionId(context.user);
    if (usedAtLevel >= trainingLimit) {
      throw new Error(`На этом уровне уже использован лимит учебных предметов: ${usedAtLevel}/${trainingLimit}. Подними уровень, чтобы продолжить.`);
    }
    let applied = false;
    for (const [skillKey, rawBoost] of Object.entries(item.stats || {})) {
      const skill = skillKey as SkillName;
      if (!(skill in state.skills)) continue;
      const current = Number(state.skills[skill] || 0);
      const skillCap = getTrainingSkillCapForLevel(context.user.level, skill, professionId);
      const allowedBoost = Math.max(0, Math.min(Number(rawBoost) || 0, skillCap - current));
      if (allowedBoost <= 0) continue;
      state.skills[skill] = Number((current + allowedBoost).toFixed(2));
      applied = true;
    }
    if (!applied) {
      const highestCap = Object.keys(item.stats || {}).reduce((best, skillKey) => {
        const skill = skillKey as SkillName;
        return Math.max(best, getTrainingSkillCapForLevel(context.user.level, skill, professionId));
      }, getTrainingSkillCapForLevel(context.user.level));
      throw new Error(`Навыки из этого курса уже упираются в потолок уровня (${highestCap}). Повышай уровень или выбери другой путь развития.`);
    }
    removeOneInventoryItem(state, item);
    const updatedUser = await incrementTrainingConsumablesUsedAtLevel(context.user.id, context.user.level);
    notices.push(`✅ Использован предмет: ${item.name}`);
    notices.push(`📘 Учебные предметы на этом уровне: ${usedAtLevel + 1}/${trainingLimit}`);
    return { user: updatedUser, state, notices, item };
  }

  throw new Error("Р­С‚РѕС‚ РїСЂРµРґРјРµС‚ РЅРµР»СЊР·СЏ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РєРѕРјР°РЅРґРѕР№ /use");
}

export async function toggleGearItem(userId: string, itemRef: string) {
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  const notices = [...context.notices];
  const item = findInventoryItemByRef(state, itemRef);
  if (!item) throw new Error("РџСЂРµРґРјРµС‚ РЅРµ РЅР°Р№РґРµРЅ");
  if (item.type !== "gear" && item.type !== "gadget") {
    throw new Error("РљРѕРјР°РЅРґР° /equip работает только для экипировки и гаджетов");
  }
  if (item.type === "gadget") {
    const gadget = normalizeGadgetInventoryFields(item);
    if (gadget.repairLocked) {
      throw new Error("Гаджет сейчас находится в сервисе и временно недоступен");
    }
    if (gadget.isBroken) {
      throw new Error("Сломанный гаджет нельзя использовать, пока он не будет отремонтирован");
    }
  }

  const willEquip = !item.isEquipped;
  adjustSkillByItemStats(state, item, willEquip ? 1 : -1);
  item.isEquipped = willEquip;

  notices.push(willEquip ? `🟢 Экипировано: ${item.name}` : `⚪ Снято: ${item.name}`);
  return { user: context.user, state, notices, item, isEquipped: willEquip };
}

export async function serviceGadgetItem(userId: string, itemRef: string) {
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];
  const item = findInventoryItemByRef(state, itemRef);
  if (!item) throw new Error("РџСЂРµРґРјРµС‚ РЅРµ РЅР°Р№РґРµРЅ");
  if (item.type !== "gadget") throw new Error("РћР±СЃР»СѓР¶РёРІР°РЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РґР»СЏ РіР°РґР¶РµС‚РѕРІ");

  const gadget = normalizeGadgetInventoryFields(item);
  if (gadget.repairLocked) throw new Error("Этот гаджет уже находится в сервисе");
  const maxDurability = Math.max(1, Math.round(gadget.maxCondition ?? gadget.maxDurability ?? 100));
  const currentDurability = Math.max(0, Math.round(gadget.condition ?? gadget.durability ?? maxDurability));
  const missingDurability = Math.max(0, maxDurability - currentDurability);
  if (missingDurability <= 0) throw new Error("Р“Р°РґР¶РµС‚ СѓР¶Рµ РІ РёРґРµР°Р»СЊРЅРѕРј СЃРѕСЃС‚РѕСЏРЅРёРё");

  const serviceCost = Math.max(20, missingDurability * 5 + (gadget.isBroken ? 90 : 0));
  if (user.balance < serviceCost) throw new Error(`РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ. РќСѓР¶РЅРѕ: ${getCurrencySymbol(user.city)}${serviceCost}`);

  user = await storage.updateUser(user.id, {
    balance: user.balance - serviceCost,
  });

  item.condition = maxDurability;
  item.maxCondition = maxDurability;
  item.durability = maxDurability;
  item.maxDurability = maxDurability;
  item.isBroken = false;
  notices.push(`🔧 Гаджет отремонтирован: ${item.name} (-${getCurrencySymbol(user.city)}${serviceCost})`);
  return { user, state, notices, item, serviceCost };
}

export function estimateInventorySellPrice(item: GameInventoryItem) {
  if (item.id === TUTORIAL_MEDAL_ITEM_ID) {
    return 1200;
  }
  const rarityKey = (String(item.rarity || "Common").trim() || "Common") as RarityName;
  const rarityMultiplier = RARITY_LEVELS[rarityKey]?.multiplier ?? 1;
  const statScore = Object.values(item.stats || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);

  if (item.type === "part") {
    const catalogPrice = getPartPrice(item.id);
    const fallbackBase = Math.max(80, Math.round(140 + statScore * 120));
    const basePrice = catalogPrice > 0 ? catalogPrice : fallbackBase;
    const qualityRate = Math.min(0.25, statScore * 0.04);
    return Math.max(1, Math.round(basePrice * (0.35 + qualityRate)));
  }

  if (item.type === "gadget") {
    const gadget = normalizeGadgetInventoryFields(item);
    const durabilityMax = Math.max(1, Number(gadget.maxCondition ?? gadget.maxDurability ?? 100));
    const durabilityNow = Math.max(0, Number(gadget.condition ?? gadget.durability ?? durabilityMax));
    const durabilityRatio = Math.min(1, durabilityNow / durabilityMax);
    const gadgetBase = Math.max(250, Math.round(260 + statScore * 180));
    const conditionRate = 0.3 + durabilityRatio * 0.45;
    return Math.max(1, Math.round(gadgetBase * rarityMultiplier * conditionRate));
  }

  return 0;
}

export async function sellInventoryItem(userId: string, itemRef: string) {
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];
  const item = findInventoryItemByRef(state, itemRef);
  if (!item) throw new Error("РџСЂРµРґРјРµС‚ РЅРµ РЅР°Р№РґРµРЅ");
  if (item.id === TUTORIAL_MEDAL_ITEM_ID && Number(context.user.level || 1) < 5) {
    throw new Error("Медаль за обучение можно продать только с 5 уровня.");
  }
  if (item.type !== "part" && item.type !== "gadget") {
    if (item.id !== TUTORIAL_MEDAL_ITEM_ID) {
      throw new Error("РџСЂРѕРґР°РІР°С‚СЊ РјРѕР¶РЅРѕ С‚РѕР»СЊРєРѕ Р·Р°РїС‡Р°СЃС‚Рё, РіР°РґР¶РµС‚С‹ Рё СЃРїРµС†РёР°Р»СЊРЅС‹Рµ РЅР°РіСЂР°РґС‹");
    }
  }
  const salePrice = estimateInventorySellPrice(item);
  removeOneInventoryItem(state, item);

  user = await storage.updateUser(user.id, {
    balance: user.balance + salePrice,
  });

  notices.push(`💰 Продано: ${item.name} (+${getCurrencySymbol(user.city)}${salePrice})`);
  return { user, state, notices, item, salePrice };
}

export async function openBankProduct(
  userId: string,
  type: BankProductType,
  programRef: string,
  amount: number,
  days: number,
) {
  await assertFeatureEnabled("bank", "Bank is disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];

  if (state.activeBankProduct) {
    throw new Error("РЎРЅР°С‡Р°Р»Р° Р·Р°РєСЂРѕР№ С‚РµРєСѓС‰РёР№ РєСЂРµРґРёС‚/РІРєР»Р°Рґ");
  }

  const program = findBankProgramByRef(type, programRef, user.city);
  if (!program) throw new Error("Р‘Р°РЅРєРѕРІСЃРєР°СЏ РїСЂРѕРіСЂР°РјРјР° РЅРµ РЅР°Р№РґРµРЅР°");
  if (user.level < program.minLevel) throw new Error(`РўСЂРµР±СѓРµС‚СЃСЏ СѓСЂРѕРІРµРЅСЊ ${program.minLevel}+`);
  if (amount < program.minAmount || amount > program.maxAmount) {
    throw new Error(`РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РѕС‚ ${program.minAmount} РґРѕ ${program.maxAmount}`);
  }
  void days;

  const durationMinutes = Math.max(1, Math.round(Number(program.durationMinutes || 60)));
  let totalReturn = amount;
  if (type === "credit") {
    totalReturn = Math.round(amount * (1 + Number(program.interest || 0) / 100));
  } else if (program.depositKind === "safe") {
    totalReturn = Math.round(amount * (1 + Number(program.interest || 0) / 100));
  } else if (program.depositKind === "risky") {
    totalReturn = Math.round(amount * (1 + Number(program.riskyInterest || 0) / 100));
  }

  if (type === "credit") {
    user = await storage.updateUser(user.id, { balance: user.balance + amount });
    state.activeBankProduct = {
      type: "credit",
      amount,
      daysLeft: durationMinutes,
      totalDays: durationMinutes,
      totalReturn,
      name: program.name,
      programId: program.id,
      overduePenaltyRate: Number(program.overduePenaltyRate || 0),
      graceMinutes: Number(program.graceMinutes || 0),
    };
    notices.push(
      `✅ Кредит одобрен: +${getCurrencySymbol(user.city)}${amount}. Через ${durationMinutes}м к возврату ${getCurrencySymbol(user.city)}${totalReturn}.`,
    );
    return { user, state, notices, program, totalReturn };
  }

  if (user.balance < amount) throw new Error("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ РґР»СЏ РІРєР»Р°РґР°");
  user = await storage.updateUser(user.id, { balance: user.balance - amount });
  state.activeBankProduct = {
    type: "deposit",
    amount,
    daysLeft: durationMinutes,
    totalDays: durationMinutes,
    totalReturn,
    name: program.name,
    programId: program.id,
    depositKind: program.depositKind,
    rewardBonusPct: program.depositKind === "risky"
      ? Number(program.riskySuccessChance || 0)
      : Number(program.pvpRewardBonusPct || 0),
    ratingBonusFlat: Number(program.pvpRatingBonusFlat || 0),
    xpBonusPct: Number(program.pvpXpBonusPct || 0),
    boostDurationMinutes: Number(program.pvpBoostDurationMinutes || 0),
  };
  if (program.depositKind === "pvp") {
    notices.push(
      `✅ PvP-вклад открыт: -${getCurrencySymbol(user.city)}${amount}. Через ${durationMinutes}м деньги вернутся и включится PvP-бонус.`,
    );
  } else if (program.depositKind === "risky") {
    notices.push(
      `✅ Рискованный вклад открыт: -${getCurrencySymbol(user.city)}${amount}. Через ${durationMinutes}м либо вернётся только сумма, либо до ${getCurrencySymbol(user.city)}${totalReturn}.`,
    );
  } else {
    notices.push(
      `✅ Вклад открыт: -${getCurrencySymbol(user.city)}${amount}. Через ${durationMinutes}м получите ${getCurrencySymbol(user.city)}${totalReturn}.`,
    );
  }
  return { user, state, notices, program, totalReturn };
}

export async function closeBankProduct(userId: string, action: BankEarlyAction) {
  await assertFeatureEnabled("bank", "Bank is disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  let user = context.user;
  const notices = [...context.notices];
  const active = state.activeBankProduct;
  if (!active) throw new Error("РќРµС‚ Р°РєС‚РёРІРЅРѕРіРѕ Р±Р°РЅРєРѕРІСЃРєРѕРіРѕ РїСЂРѕРґСѓРєС‚Р°");

  const minutesPassed = Math.max(0, active.totalDays - Math.ceil(active.daysLeft));
  const daysPassedPercent = minutesPassed / Math.max(1, active.totalDays);
  const totalInterest = active.totalReturn - active.amount;
  const interestForPassed = Math.round(totalInterest * daysPassedPercent);

  if (action === "repay" && active.type === "credit") {
    const amountToRepay = active.amount + interestForPassed;
    if (user.balance < amountToRepay) {
      throw new Error(`РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ. РќСѓР¶РЅРѕ: ${getCurrencySymbol(user.city)}${amountToRepay}`);
    }
    user = await storage.updateUser(user.id, { balance: user.balance - amountToRepay });
    state.activeBankProduct = null;
    notices.push(`вњ… РљСЂРµРґРёС‚ РїРѕРіР°С€РµРЅ РґРѕСЃСЂРѕС‡РЅРѕ: -${getCurrencySymbol(user.city)}${amountToRepay}`);
    return { user, state, notices, amount: amountToRepay };
  }

  if (action === "withdraw" && active.type === "deposit") {
    let amountToReceive = active.depositKind === "safe" ? active.amount + interestForPassed : active.amount;
    if (active.depositKind === "safe" && getAdvancedPersonalityId(user) === "investor") {
      amountToReceive = Math.max(1, Math.round(amountToReceive * ADVANCED_PERSONALITY_MODIFIERS.investor.investmentIncomeMultiplier));
    }
    user = await storage.updateUser(user.id, { balance: user.balance + amountToReceive });
    state.activeBankProduct = null;
    notices.push(`✅ Вклад снят досрочно: +${getCurrencySymbol(user.city)}${amountToReceive}`);
    return { user, state, notices, amount: amountToReceive };
  }

  throw new Error("Р”Р»СЏ РєСЂРµРґРёС‚Р° РёСЃРїРѕР»СЊР·СѓР№ /repay, РґР»СЏ РІРєР»Р°РґР° вЂ” /withdraw");
}

export async function exchangeCurrencyToGram(userId: string, amountCurrency: number) {
  await assertFeatureEnabled("gram", "GRAM exchange is disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  const notices = [...context.notices];
  const user = context.user;
  const normalizedAmount = Math.floor(Number(amountCurrency));

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("РЎСѓРјРјР° РѕР±РјРµРЅР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0");
  }
  if (user.balance < normalizedAmount) {
    throw new Error(`РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ. РќСѓР¶РЅРѕ: ${getCurrencySymbol(user.city)}${normalizedAmount}`);
  }

  const cityRate = getLocalToGramRate(user.city);
  let feeRate = applyBankFeeRate(BALANCE_CONFIG.bank.exchangeToGrmFeeRate, user.city);
  if (getAdvancedPersonalityId(user) === "investor") {
    feeRate *= ADVANCED_PERSONALITY_MODIFIERS.investor.exchangeFeeMultiplier;
  }
  const grossGrm = normalizedAmount * cityRate;
  const feeGrm = grossGrm * feeRate;
  const gramReceived = Number(Math.max(0, grossGrm - feeGrm).toFixed(3));
  const updatedUser = await storage.updateUser(user.id, {
    balance: user.balance - normalizedAmount,
  });
  state.gramBalance = Number((state.gramBalance + gramReceived).toFixed(3));
  notices.push(`рџ’± РћР±РјРµРЅ: -${getCurrencySymbol(updatedUser.city)}${normalizedAmount}, +${gramReceived} GRM (комиссия ${Number((feeRate * 100).toFixed(2))}%)`);

  return {
    user: updatedUser,
    state,
    notices,
    amountCurrency: normalizedAmount,
    amountGram: gramReceived,
    direction: "to_gram" as const,
  };
}

export async function exchangeGramToCurrency(userId: string, amountGram: number) {
  await assertFeatureEnabled("gram", "GRAM exchange is disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  const notices = [...context.notices];
  const user = context.user;
  const normalizedGram = Number(Number(amountGram).toFixed(3));

  if (!Number.isFinite(normalizedGram) || normalizedGram <= 0) {
    throw new Error("РљРѕР»РёС‡РµСЃС‚РІРѕ GRM РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0");
  }
  if (state.gramBalance + 1e-9 < normalizedGram) {
    throw new Error(`РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ GRM. Р”РѕСЃС‚СѓРїРЅРѕ: ${state.gramBalance.toFixed(3)} GRM`);
  }

  const cityRate = getLocalToGramRate(user.city);
  let feeRate = applyBankFeeRate(BALANCE_CONFIG.bank.exchangeFromGrmFeeRate, user.city);
  if (getAdvancedPersonalityId(user) === "investor") {
    feeRate *= ADVANCED_PERSONALITY_MODIFIERS.investor.exchangeFeeMultiplier;
  }
  const grossCurrency = normalizedGram / cityRate;
  const currencyReceived = Math.max(1, Math.round(grossCurrency * (1 - feeRate)));
  state.gramBalance = Number(Math.max(0, state.gramBalance - normalizedGram).toFixed(3));
  const updatedUser = await storage.updateUser(user.id, {
    balance: user.balance + currencyReceived,
  });
  notices.push(`рџ’± РћР±РјРµРЅ: -${normalizedGram} GRM, +${getCurrencySymbol(updatedUser.city)}${currencyReceived} (комиссия ${Number((feeRate * 100).toFixed(2))}%)`);

  return {
    user: updatedUser,
    state,
    notices,
    amountCurrency: currencyReceived,
    amountGram: normalizedGram,
    direction: "from_gram" as const,
  };
}

export async function spendGram(userId: string, amountGram: number, reason: string = "Списание GRM") {
  await assertFeatureEnabled("gram", "GRAM operations are disabled by admin settings");
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");

  const { state } = context;
  const notices = [...context.notices];
  const normalizedGram = Number(Number(amountGram).toFixed(3));

  if (!Number.isFinite(normalizedGram) || normalizedGram <= 0) {
    throw new Error("РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ СЃСѓРјРјР° GRM");
  }
  if (state.gramBalance + 1e-9 < normalizedGram) {
    throw new Error(`РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ GRM. РќСѓР¶РЅРѕ: ${normalizedGram}, РґРѕСЃС‚СѓРїРЅРѕ: ${state.gramBalance.toFixed(3)}`);
  }

  state.gramBalance = Number(Math.max(0, state.gramBalance - normalizedGram).toFixed(3));
  notices.push(`рџЄ™ ${reason}: -${normalizedGram} GRM`);
  return { user: context.user, state, notices, amountGram: normalizedGram };
}

export async function getPlayerGameSnapshot(userId: string) {
  const context = await loadContext(userId);
  if (!context) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");
  return context;
}

export function clearPlayerGameState(userId: string) {
  deletePlayerRuntimeState(userId);
}


