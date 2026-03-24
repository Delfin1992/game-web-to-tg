import { randomUUID } from "crypto";
import { resolveCity } from "../../../shared/registration";
import { storage } from "../../storage";
import { canUseCity, canUseTarget, canUseTemplate, decayEconomicSignals, getOversupplyScore, getPriceCorrectionScore, registerEventHistory } from "./event-history";
import { EVENT_TEMPLATES, type City } from "./event-templates";

export type EventEffect = {
  type:
    | "price_modifier"
    | "demand_modifier"
    | "salary_modifier"
    | "research_modifier"
    | "production_modifier"
    | "currency_modifier";
  target: string;
  value: number;
};

export type GlobalEvent = {
  id: string;
  templateId: string;
  title: string;
  description: string;
  city?: City;
  target?: string;
  intensity: "low" | "medium" | "high";
  durationHours: number;
  effects: EventEffect[];
  startedAt: number;
  endsAt: number;
};

const INTENSITY_MULTIPLIER: Record<GlobalEvent["intensity"], number> = {
  low: 0.05,
  medium: 0.12,
  high: 0.25,
};

let activeEventsCache: GlobalEvent[] = [];
let cacheUpdatedAt = 0;
const announcementsQueue: Array<{ id: string; text: string }> = [];

function asCity(value: unknown): City {
  const raw = String(value || "");
  if (
    raw === "saint_petersburg" ||
    raw === "seoul" ||
    raw === "singapore" ||
    raw === "san_francisco" ||
    raw === "global"
  ) {
    return raw;
  }
  return "global";
}

function normalizeStoredEvent(event: any): GlobalEvent {
  return {
    id: String(event.id),
    templateId: String(event.templateId),
    title: String(event.title),
    description: String(event.description),
    city: asCity(event.city),
    target: event.target ? String(event.target) : undefined,
    intensity: event.intensity === "high" || event.intensity === "medium" ? event.intensity : "low",
    durationHours: Math.max(1, Number(event.durationHours || 1)),
    effects: Array.isArray(event.effects)
      ? event.effects.map((effect: any) => ({
          type: effect?.type,
          target: String(effect?.target || "all"),
          value: Number(effect?.value || 0),
        }))
      : [],
    startedAt: Number(event.startedAt || Date.now()),
    endsAt: Number(event.endsAt || Date.now()),
  };
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedPick<T>(items: T[], getWeight: (item: T) => number): T | null {
  const weighted = items.map((item) => ({ item, w: Math.max(0, getWeight(item)) })).filter((entry) => entry.w > 0);
  if (!weighted.length) return null;
  const total = weighted.reduce((acc, entry) => acc + entry.w, 0);
  let cursor = Math.random() * total;
  for (const entry of weighted) {
    cursor -= entry.w;
    if (cursor <= 0) return entry.item;
  }
  return weighted[weighted.length - 1].item;
}

function resolveCityId(rawCity?: string | null): City {
  const resolved = resolveCity(String(rawCity || ""));
  const cityId = resolved?.id as City | undefined;
  if (cityId === "saint_petersburg" || cityId === "seoul" || cityId === "singapore" || cityId === "san_francisco") {
    return cityId;
  }
  return "global";
}

function formatCityLabel(city: City) {
  if (city === "san_francisco") return "Сан-Франциско";
  if (city === "saint_petersburg") return "Санкт-Петербург";
  if (city === "seoul") return "Сеул";
  if (city === "singapore") return "Сингапур";
  return "весь мир";
}

function buildEffects(templateId: string, target: string, city: City, intensity: GlobalEvent["intensity"]): EventEffect[] {
  const m = INTENSITY_MULTIPLIER[intensity];
  switch (templateId) {
    case "chip_shortage":
      return [{ type: "price_modifier", target, value: Math.min(0.35, m * 1.8) }, { type: "production_modifier", target, value: -Math.min(0.2, m) }];
    case "battery_breakthrough":
      return [{ type: "production_modifier", target, value: Math.min(0.3, m * 1.5) }, { type: "research_modifier", target, value: Math.min(0.2, m) }];
    case "ai_revolution":
      return [{ type: "research_modifier", target, value: Math.min(0.3, m * 1.6) }, { type: "production_modifier", target, value: Math.min(0.15, m) }];
    case "market_boom":
      return [{ type: "demand_modifier", target, value: Math.min(0.35, m * 1.7) }, { type: "salary_modifier", target: city, value: Math.min(0.12, m * 0.8) }];
    case "market_crash":
      return [{ type: "demand_modifier", target, value: -Math.min(0.3, m * 1.6) }, { type: "salary_modifier", target: city, value: -Math.min(0.12, m) }];
    case "investment_wave":
      return [{ type: "currency_modifier", target: city, value: Math.min(0.18, m * 1.2) }, { type: "research_modifier", target: "all", value: Math.min(0.12, m) }];
    case "startup_boom":
      return [{ type: "salary_modifier", target: city, value: Math.min(0.2, m * 1.2) }, { type: "production_modifier", target: "all", value: Math.min(0.1, m * 0.8) }];
    case "chip_factory_expansion":
      return [{ type: "price_modifier", target, value: -Math.min(0.25, m * 1.5) }, { type: "production_modifier", target, value: Math.min(0.2, m) }];
    case "supply_chain_crisis":
      return [{ type: "production_modifier", target, value: -Math.min(0.25, m * 1.4) }, { type: "price_modifier", target, value: Math.min(0.3, m * 1.4) }];
    case "tech_conference":
      return [{ type: "research_modifier", target: city, value: Math.min(0.22, m * 1.3) }, { type: "salary_modifier", target: city, value: Math.min(0.1, m) }];
    case "startup_grants":
      return [
        { type: "research_modifier", target: "all", value: Math.min(0.24, m * 1.4) },
        { type: "production_modifier", target: "all", value: Math.min(0.18, m * 1.2) },
        { type: "salary_modifier", target: city, value: Math.min(0.08, m * 0.8) },
      ];
    case "electronics_shortage":
      return [
        { type: "price_modifier", target: "all", value: Math.min(0.18, m * 1.2) },
        { type: "production_modifier", target: "all", value: -Math.min(0.18, m * 1.2) },
      ];
    case "tax_audit":
      return [
        { type: "salary_modifier", target: city, value: -Math.min(0.12, m) },
        { type: "research_modifier", target: "all", value: -Math.min(0.12, m * 0.8) },
        { type: "currency_modifier", target: city, value: -Math.min(0.06, m * 0.7) },
      ];
    case "it_forum":
      return [
        { type: "salary_modifier", target: city, value: Math.min(0.14, m) },
        { type: "research_modifier", target: "all", value: Math.min(0.18, m * 1.1) },
        { type: "demand_modifier", target: "all", value: Math.min(0.1, m * 0.8) },
      ];
    case "global_recession":
      return [{ type: "salary_modifier", target: "all", value: -Math.min(0.2, m * 1.4) }, { type: "demand_modifier", target: "all", value: -Math.min(0.2, m * 1.2) }, { type: "currency_modifier", target: "all", value: -Math.min(0.08, m * 0.7) }];
    case "gaming_trend":
      return [{ type: "demand_modifier", target, value: Math.min(0.3, m * 1.4) }, { type: "price_modifier", target: "gaming_gadgets", value: Math.min(0.18, m) }];
    default:
      return [{ type: "demand_modifier", target, value: m }];
  }
}

function formatEventText(event: GlobalEvent) {
  const effectLabels: Record<EventEffect["type"], string> = {
    price_modifier: "цены",
    demand_modifier: "спрос",
    salary_modifier: "зарплаты",
    research_modifier: "исследования",
    production_modifier: "производство",
    currency_modifier: "валюта",
  };

  const formatTarget = (target: string) => {
    if (!target || target === "all") return "везде";
    if (target === "gaming_gadgets") return "игровые гаджеты";
    if (target === "san_francisco") return "Сан-Франциско";
    if (target === "saint_petersburg") return "Санкт-Петербург";
    if (target === "seoul") return "Сеул";
    if (target === "singapore") return "Сингапур";
    return target.replaceAll("_", " ");
  };

  const effectsText = event.effects
    .map((effect) => {
      const sign = effect.value >= 0 ? "+" : "";
      return `${effectLabels[effect.type]} (${formatTarget(effect.target)}): ${sign}${Math.round(effect.value * 100)}%`;
    })
    .join("; ");
  return [
    "🌍 Глобальное событие",
    event.title,
    "",
    event.description,
    "",
    `Эффект: ${effectsText}`,
    `Длительность: ${event.durationHours}ч`,
  ].join("\n");
}

export async function refreshGlobalEventsCache(force: boolean = false) {
  const now = Date.now();
  if (!force && now - cacheUpdatedAt < 30_000) return activeEventsCache;
  activeEventsCache = (await storage.getCurrentGlobalEvents(now)).map((event) => normalizeStoredEvent(event));
  cacheUpdatedAt = now;
  return activeEventsCache;
}

export function getActiveGlobalEventsCached() {
  return activeEventsCache.filter((event) => event.endsAt > Date.now());
}

export async function getCurrentGlobalEvents() {
  return refreshGlobalEventsCache(true);
}

export async function getGlobalEventsHistory(limit: number = 100) {
  const rows = await storage.getGlobalEventsHistory(limit);
  return rows.map((event) => normalizeStoredEvent(event));
}

export async function generateEvent(nowMs: number = Date.now()): Promise<GlobalEvent | null> {
  const available = EVENT_TEMPLATES.filter((template) => canUseTemplate(template.id, template.cooldownHours, nowMs));
  if (!available.length) return null;

  const selectedTemplate = weightedPick(available, (template) => {
    const oversupplyBoost = template.id === "market_crash" ? 1 + Math.min(1.5, getOversupplyScore("smartphones") / 30) : 1;
    const correctionBoost = template.id === "chip_factory_expansion" ? 1 + Math.min(1.5, getPriceCorrectionScore("processor") / 25) : 1;
    const crisisBoost = template.id === "supply_chain_crisis" ? 1 + Math.min(1.5, getPriceCorrectionScore("battery") / 30) : 1;
    return template.weight * oversupplyBoost * correctionBoost * crisisBoost;
  });
  if (!selectedTemplate) return null;

  const targetCandidates = selectedTemplate.targets.filter((target) => canUseTarget(target, nowMs, 18));
  const target = targetCandidates.length ? randomItem(targetCandidates) : randomItem(selectedTemplate.targets);

  const cityCandidates = selectedTemplate.allowedCities.filter((city) => canUseCity(city, nowMs, 12));
  const city = (cityCandidates.length ? randomItem(cityCandidates) : randomItem(selectedTemplate.allowedCities)) || "global";

  const intensity = weightedPick<GlobalEvent["intensity"]>(["low", "medium", "high"], (level) => {
    if (level === "low") return 50;
    if (level === "medium") return 35;
    return 15;
  }) || "low";

  const durationHours = randomItem(selectedTemplate.duration);
  const title = selectedTemplate.titlePattern
    .replaceAll("{target}", target)
    .replaceAll("{city}", formatCityLabel(city));
  const description = selectedTemplate.descriptionPattern
    .replaceAll("{target}", target)
    .replaceAll("{city}", formatCityLabel(city));
  const effects = buildEffects(selectedTemplate.id, target, city, intensity);

  const event: GlobalEvent = {
    id: randomUUID(),
    templateId: selectedTemplate.id,
    title,
    description,
    city,
    target,
    intensity,
    durationHours,
    effects,
    startedAt: nowMs,
    endsAt: nowMs + durationHours * 60 * 60 * 1000,
  };

  await storage.createGlobalEvent(event);
  registerEventHistory({ templateId: event.templateId, target: event.target, city: event.city, atMs: nowMs });
  announcementsQueue.push({ id: `${event.id}:announce`, text: formatEventText(event) });
  decayEconomicSignals();
  await refreshGlobalEventsCache(true);
  return event;
}

export function popGlobalEventAnnouncements() {
  const queue = announcementsQueue.slice();
  announcementsQueue.length = 0;
  return queue;
}

function effectApplies(effectTarget: string, requestedTarget: string) {
  return effectTarget === "all" || effectTarget === requestedTarget;
}

export function getGlobalEventModifier(input: {
  type: EventEffect["type"];
  target: string;
  city?: string;
}) {
  const cityId = resolveCityId(input.city || "");
  let total = 0;
  for (const event of getActiveGlobalEventsCached()) {
    const cityAllowed = !event.city || event.city === "global" || event.city === cityId;
    if (!cityAllowed) continue;
    for (const effect of event.effects) {
      if (effect.type !== input.type) continue;
      if (!effectApplies(effect.target, input.target) && !effectApplies(effect.target, cityId)) continue;
      total += Number(effect.value || 0);
    }
  }
  return total;
}

export function applyGlobalEventMultiplier(baseValue: number, modifier: number) {
  const mul = Math.max(0.05, 1 + modifier);
  return baseValue * mul;
}
