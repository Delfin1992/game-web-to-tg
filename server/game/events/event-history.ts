import type { City } from "./event-templates";

type CooldownBucket = Map<string, number>;

const templateLastAt: CooldownBucket = new Map();
const targetLastAt: CooldownBucket = new Map();
const cityLastAt: CooldownBucket = new Map();

const productionCounterByTarget = new Map<string, number>();
const priceSpikeCounterByTarget = new Map<string, number>();

function canUse(lastAt: number | undefined, cooldownHours: number, nowMs: number) {
  if (!lastAt) return true;
  return nowMs - lastAt >= cooldownHours * 60 * 60 * 1000;
}

export function canUseTemplate(templateId: string, cooldownHours: number, nowMs: number) {
  return canUse(templateLastAt.get(templateId), cooldownHours, nowMs);
}

export function canUseTarget(target: string, nowMs: number, cooldownHours: number = 24) {
  return canUse(targetLastAt.get(target), cooldownHours, nowMs);
}

export function canUseCity(city: City, nowMs: number, cooldownHours: number = 18) {
  if (city === "global") return true;
  return canUse(cityLastAt.get(city), cooldownHours, nowMs);
}

export function registerEventHistory(input: { templateId: string; target?: string; city?: City; atMs: number }) {
  templateLastAt.set(input.templateId, input.atMs);
  if (input.target) targetLastAt.set(input.target, input.atMs);
  if (input.city && input.city !== "global") cityLastAt.set(input.city, input.atMs);
}

export function registerProductionSignal(target: string, amount: number = 1) {
  const key = String(target || "unknown");
  productionCounterByTarget.set(key, Number(productionCounterByTarget.get(key) || 0) + Math.max(1, amount));
}

export function registerPriceSpikeSignal(target: string, weight: number = 1) {
  const key = String(target || "unknown");
  priceSpikeCounterByTarget.set(key, Number(priceSpikeCounterByTarget.get(key) || 0) + Math.max(1, weight));
}

export function getOversupplyScore(target: string) {
  return Number(productionCounterByTarget.get(String(target || "unknown")) || 0);
}

export function getPriceCorrectionScore(target: string) {
  return Number(priceSpikeCounterByTarget.get(String(target || "unknown")) || 0);
}

export function decayEconomicSignals() {
  for (const [key, value] of Array.from(productionCounterByTarget.entries())) {
    const next = Math.max(0, Math.floor(value * 0.85));
    if (next <= 0) productionCounterByTarget.delete(key);
    else productionCounterByTarget.set(key, next);
  }
  for (const [key, value] of Array.from(priceSpikeCounterByTarget.entries())) {
    const next = Math.max(0, Math.floor(value * 0.8));
    if (next <= 0) priceSpikeCounterByTarget.delete(key);
    else priceSpikeCounterByTarget.set(key, next);
  }
}
