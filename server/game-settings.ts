import { storage } from "./storage";
import type { GameSettingsRow, UpdateGameSettingsRow } from "../shared/schema";
import {
  DEFAULT_GAME_SETTINGS,
  normalizeGameSettingsPatch,
  type GameFeatureKey,
  type GameSettings,
  type GameSettingsPatch,
} from "../shared/game-settings";

function toPercentMultiplier(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Number((value / 100).toFixed(4));
}

function toStoredMultiplier(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(10, Math.min(1000, Math.round(value * 100)));
}

function mapRowToSettings(row: GameSettingsRow): GameSettings {
  return {
    systems: {
      jobsEnabled: row.jobsEnabled,
      educationEnabled: row.educationEnabled,
      companiesEnabled: row.companiesEnabled,
      blueprintsEnabled: row.blueprintsEnabled,
      productionEnabled: row.productionEnabled,
      marketEnabled: row.marketEnabled,
      leaderboardsEnabled: row.leaderboardsEnabled,
      chatEnabled: row.chatEnabled,
      bankEnabled: row.bankEnabled,
      gramEnabled: row.gramEnabled,
      cityBonusesEnabled: row.cityBonusesEnabled,
      tutorialEnabled: row.tutorialEnabled,
      demoCompanyEnabled: row.demoCompanyEnabled,
      ipoEnabled: row.ipoEnabled,
      stocksEnabled: row.stocksEnabled,
    },
    economy: {
      dynamicCurrencyEnabled: row.dynamicCurrencyEnabled,
      gramEnabled: row.gramEnabled,
      dynamicGadgetPricesEnabled: row.dynamicGadgetPricesEnabled,
      taxesEnabled: row.taxesEnabled,
      commissionsEnabled: row.commissionsEnabled,
    },
    tutorial: {
      tutorialEnabled: row.tutorialEnabled,
      tutorialDemoCompanyEnabled: row.tutorialDemoCompanyEnabled,
      tutorialFreeBlueprintEnabled: row.tutorialFreeBlueprintEnabled,
      tutorialProductionWithoutPartsEnabled: row.tutorialProductionWithoutPartsEnabled,
    },
    multipliers: {
      workIncomeMultiplier: toPercentMultiplier(row.workIncomeMultiplier, DEFAULT_GAME_SETTINGS.multipliers.workIncomeMultiplier),
      workXpMultiplier: toPercentMultiplier(row.workXpMultiplier, DEFAULT_GAME_SETTINGS.multipliers.workXpMultiplier),
      blueprintCostMultiplier: toPercentMultiplier(row.blueprintCostMultiplier, DEFAULT_GAME_SETTINGS.multipliers.blueprintCostMultiplier),
      productionSpeedMultiplier: toPercentMultiplier(row.productionSpeedMultiplier, DEFAULT_GAME_SETTINGS.multipliers.productionSpeedMultiplier),
      gadgetSellPriceMultiplier: toPercentMultiplier(row.gadgetSellPriceMultiplier, DEFAULT_GAME_SETTINGS.multipliers.gadgetSellPriceMultiplier),
    },
    updatedAt: row.updatedAt * 1000,
  };
}

function mapPatchToRowUpdates(patch: GameSettingsPatch): UpdateGameSettingsRow {
  const normalized = normalizeGameSettingsPatch(patch);
  return {
    jobsEnabled: normalized.systems?.jobsEnabled,
    educationEnabled: normalized.systems?.educationEnabled,
    companiesEnabled: normalized.systems?.companiesEnabled,
    blueprintsEnabled: normalized.systems?.blueprintsEnabled,
    productionEnabled: normalized.systems?.productionEnabled,
    marketEnabled: normalized.systems?.marketEnabled,
    leaderboardsEnabled: normalized.systems?.leaderboardsEnabled,
    chatEnabled: normalized.systems?.chatEnabled,
    bankEnabled: normalized.systems?.bankEnabled,
    gramEnabled: normalized.systems?.gramEnabled ?? normalized.economy?.gramEnabled,
    cityBonusesEnabled: normalized.systems?.cityBonusesEnabled,
    tutorialEnabled: normalized.systems?.tutorialEnabled ?? normalized.tutorial?.tutorialEnabled,
    demoCompanyEnabled: normalized.systems?.demoCompanyEnabled,
    ipoEnabled: normalized.systems?.ipoEnabled,
    stocksEnabled: normalized.systems?.stocksEnabled,
    dynamicCurrencyEnabled: normalized.economy?.dynamicCurrencyEnabled,
    dynamicGadgetPricesEnabled: normalized.economy?.dynamicGadgetPricesEnabled,
    taxesEnabled: normalized.economy?.taxesEnabled,
    commissionsEnabled: normalized.economy?.commissionsEnabled,
    tutorialDemoCompanyEnabled: normalized.tutorial?.tutorialDemoCompanyEnabled,
    tutorialFreeBlueprintEnabled: normalized.tutorial?.tutorialFreeBlueprintEnabled,
    tutorialProductionWithoutPartsEnabled: normalized.tutorial?.tutorialProductionWithoutPartsEnabled,
    workIncomeMultiplier: normalized.multipliers?.workIncomeMultiplier === undefined
      ? undefined
      : toStoredMultiplier(normalized.multipliers.workIncomeMultiplier, DEFAULT_GAME_SETTINGS.multipliers.workIncomeMultiplier),
    workXpMultiplier: normalized.multipliers?.workXpMultiplier === undefined
      ? undefined
      : toStoredMultiplier(normalized.multipliers.workXpMultiplier, DEFAULT_GAME_SETTINGS.multipliers.workXpMultiplier),
    blueprintCostMultiplier: normalized.multipliers?.blueprintCostMultiplier === undefined
      ? undefined
      : toStoredMultiplier(normalized.multipliers.blueprintCostMultiplier, DEFAULT_GAME_SETTINGS.multipliers.blueprintCostMultiplier),
    productionSpeedMultiplier: normalized.multipliers?.productionSpeedMultiplier === undefined
      ? undefined
      : toStoredMultiplier(normalized.multipliers.productionSpeedMultiplier, DEFAULT_GAME_SETTINGS.multipliers.productionSpeedMultiplier),
    gadgetSellPriceMultiplier: normalized.multipliers?.gadgetSellPriceMultiplier === undefined
      ? undefined
      : toStoredMultiplier(normalized.multipliers.gadgetSellPriceMultiplier, DEFAULT_GAME_SETTINGS.multipliers.gadgetSellPriceMultiplier),
  };
}

export async function getGameSettings() {
  const row = await storage.getGameSettings();
  return mapRowToSettings(row);
}

export async function updateGameSettings(patch: GameSettingsPatch) {
  const updates = mapPatchToRowUpdates(patch);
  const row = await storage.updateGameSettings(updates);
  return mapRowToSettings(row);
}

export function isFeatureEnabled(settings: GameSettings, feature: GameFeatureKey) {
  switch (feature) {
    case "jobs": return settings.systems.jobsEnabled;
    case "education": return settings.systems.educationEnabled;
    case "companies": return settings.systems.companiesEnabled;
    case "blueprints": return settings.systems.blueprintsEnabled;
    case "production": return settings.systems.productionEnabled;
    case "market": return settings.systems.marketEnabled;
    case "leaderboards": return settings.systems.leaderboardsEnabled;
    case "chat": return settings.systems.chatEnabled;
    case "bank": return settings.systems.bankEnabled;
    case "gram": return settings.systems.gramEnabled && settings.economy.gramEnabled;
    case "cityBonuses": return settings.systems.cityBonusesEnabled;
    case "tutorial": return settings.systems.tutorialEnabled && settings.tutorial.tutorialEnabled;
    case "demoCompany": return settings.systems.demoCompanyEnabled;
    case "ipo": return settings.systems.ipoEnabled;
    case "stocks": return settings.systems.stocksEnabled;
    case "tutorialDemoCompany": return settings.tutorial.tutorialDemoCompanyEnabled;
    case "tutorialFreeBlueprint": return settings.tutorial.tutorialFreeBlueprintEnabled;
    case "tutorialProductionWithoutParts": return settings.tutorial.tutorialProductionWithoutPartsEnabled;
    default: return true;
  }
}

export async function assertFeatureEnabled(feature: GameFeatureKey, message?: string) {
  const settings = await getGameSettings();
  if (!isFeatureEnabled(settings, feature)) {
    throw new Error(message || `Feature "${feature}" is disabled by admin settings`);
  }
  return settings;
}

export async function applyMultipliers() {
  const settings = await getGameSettings();
  return settings.multipliers;
}

