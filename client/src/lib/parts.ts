export type RarityName = "Common" | "Rare" | "Epic" | "Legendary";
export type DeviceType = "asic" | "smartphone" | "smartwatch" | "tablet" | "laptop";
export type PartType =
  | "processor"
  | "memory"
  | "display"
  | "battery"
  | "motherboard"
  | "case"
  | "cooling"
  | "controller"
  | "asic_chip"
  | "camera"
  | "storage"
  | "strap"
  | "power";

export const RARITY_LEVELS: Record<RarityName, { multiplier: number; icon: string; dropWeight: number }> = {
  Common: { multiplier: 1.0, icon: "⚪", dropWeight: 70 },
  Rare: { multiplier: 2.0, icon: "🔵", dropWeight: 20 },
  Epic: { multiplier: 4.0, icon: "🟣", dropWeight: 8 },
  Legendary: { multiplier: 8.0, icon: "🟡", dropWeight: 2 },
};

export const DEVICE_TYPES: Record<DeviceType, string> = {
  asic: "ASIC майнер",
  smartphone: "Смартфон",
  smartwatch: "Смарт часы",
  tablet: "Планшет",
  laptop: "Ноутбук",
};

export const PART_STATS: Record<PartType, Partial<Record<string, number>>> = {
  processor: { coding: 0.2, analytics: 0.1 },
  memory: { coding: 0.1, analytics: 0.2 },
  display: { design: 0.2, attention: 0.1 },
  battery: { attention: 0.1 },
  motherboard: { coding: 0.1, testing: 0.1 },
  case: { design: 0.1 },
  cooling: { attention: 0.2 },
  controller: { coding: 0.1, testing: 0.1 },
  asic_chip: { coding: 0.3, analytics: 0.2 },
  camera: { design: 0.2, attention: 0.1 },
  storage: { coding: 0.1, attention: 0.1 },
  strap: { design: 0.1 },
  power: { attention: 0.2 },
};

export interface PartDefinition {
  id: string;
  name: string;
  type: PartType;
  rarity: RarityName;
  basePrice: number;
  stats: Partial<Record<string, number>>;
  compatibleWith: DeviceType[];
  description: string;
  dropChance: number;
}

const DEVICE_PART_MATRIX: Record<DeviceType, PartType[]> = {
  asic: ["asic_chip", "cooling", "power", "controller", "motherboard", "case"],
  smartphone: ["processor", "memory", "display", "battery", "camera", "motherboard", "case"],
  smartwatch: ["processor", "display", "battery", "case", "strap"],
  tablet: ["processor", "memory", "display", "battery", "storage", "motherboard", "case"],
  laptop: ["processor", "memory", "display", "battery", "storage", "motherboard", "cooling", "case"],
};

const SERIES = [
  { code: "1", title: "Базовый", base: 120 },
  { code: "2", title: "Продвинутый", base: 260 },
  { code: "3", title: "Профессиональный", base: 520 },
  { code: "4", title: "Экспертный", base: 900 },
];

const RARITY_SUFFIX: Record<RarityName, string> = {
  Common: "",
  Rare: "+",
  Epic: " Pro",
  Legendary: " Max",
};

function statScale(rarity: RarityName) {
  return { Common: 1, Rare: 1.8, Epic: 2.8, Legendary: 4 }[rarity];
}

function buildAllParts() {
  const entries: PartDefinition[] = [];
  let index = 1;

  (Object.keys(DEVICE_PART_MATRIX) as DeviceType[]).forEach((device) => {
    DEVICE_PART_MATRIX[device].forEach((partType) => {
      SERIES.forEach((series, seriesIdx) => {
        (Object.keys(RARITY_LEVELS) as RarityName[]).forEach((rarity) => {
          const id = `${device[0].toUpperCase()}${String(index).padStart(4, "0")}`;
          index += 1;

          const baseStats = PART_STATS[partType] || {};
          const scaled: Partial<Record<string, number>> = {};
          Object.entries(baseStats).forEach(([k, v]) => {
            const base = v ?? 0;
            scaled[k] = Number((base * statScale(rarity) * (1 + seriesIdx * 0.6)).toFixed(2));
          });

          const basePrice = Math.round(series.base * RARITY_LEVELS[rarity].multiplier);
          const title = `${series.title} ${partType.replace("_", " ")} ${series.code}${RARITY_SUFFIX[rarity]}`;

          entries.push({
            id,
            name: title,
            type: partType,
            rarity,
            basePrice,
            stats: scaled,
            compatibleWith: [device],
            description: `${title} для устройства ${DEVICE_TYPES[device]}`,
            dropChance: Number((RARITY_LEVELS[rarity].dropWeight / 5).toFixed(2)),
          });
        });
      });
    });
  });

  return entries;
}

export const ALL_PARTS: Record<string, PartDefinition> = Object.fromEntries(
  buildAllParts().map((p) => [p.id, p])
);

export function getPartPrice(partId: string): number {
  const part = ALL_PARTS[partId];
  if (!part) return 0;
  return Math.round(part.basePrice * RARITY_LEVELS[part.rarity].multiplier);
}

function weightedPickRarity(): RarityName {
  const roll = Math.random() * 100;
  let threshold = 0;
  for (const rarity of Object.keys(RARITY_LEVELS) as RarityName[]) {
    threshold += RARITY_LEVELS[rarity].dropWeight;
    if (roll <= threshold) return rarity;
  }
  return "Common";
}

export function rollRandomPartDrop(chancePercent = 25): PartDefinition | null {
  if (Math.random() * 100 > chancePercent) return null;

  const rarity = weightedPickRarity();
  const pool = Object.values(ALL_PARTS).filter((part) => part.rarity === rarity);
  if (pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)];
}
