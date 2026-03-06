export type GadgetCategory = "smartphones" | "smartwatches" | "tablets" | "asic_miners" | "laptops";
export type BlueprintStatus = "not_started" | "in_progress" | "completed" | "production_ready";
export type RarityName = "Common" | "Rare" | "Epic" | "Legendary";

export const BLUEPRINT_STATUSES: Record<BlueprintStatus, string> = {
  not_started: "Не начат",
  in_progress: "В разработке",
  completed: "Завершен",
  production_ready: "Готов к производству",
};

export const RARITY_QUALITY_MULTIPLIERS: Record<RarityName, number> = {
  Common: 1,
  Rare: 1.5,
  Epic: 2,
  Legendary: 3,
};

export interface Blueprint {
  id: string;
  name: string;
  category: GadgetCategory;
  requirements: Partial<Record<"coding" | "design" | "analytics", number>>;
  time: number;
  description: string;
  baseStats: Record<string, number>;
  production: {
    costGram: number;
    parts: Record<string, number>;
  };
}

const templates: Record<GadgetCategory, string[]> = {
  smartphones: ["Basic Phone", "Smart Plus", "Pro Model", "Ultra Edition", "Gaming Phone", "Business Elite", "Camera Master", "Security Plus", "Foldable Pro", "AI Master"],
  smartwatches: ["Basic Watch", "Fitness Tracker", "Health Monitor", "Sport Edition", "Premium Watch", "Business Time", "Adventure Pro", "Luxury Edition", "Smart Coach", "Health Master"],
  tablets: ["Basic Tablet", "Media Plus", "Pro Tablet", "Art Studio", "Business Tab", "Education Pro", "Gaming Tab", "Cinema Plus", "Designer Pro", "Ultimate Tab"],
  asic_miners: ["Basic Miner", "Efficient Miner", "Pro Miner", "Industrial Miner", "Quantum Miner", "Smart Miner", "Eco Miner", "Multi-Algorithm", "Cloud Miner", "AI Miner"],
  laptops: ["Basic Laptop", "Student Edition", "Business Pro", "Developer Station", "Gaming Beast", "Creator Studio", "Workstation Pro", "Ultra Slim", "AI Powerhouse", "Quantum Book"],
};

const categoryParts: Record<GadgetCategory, Record<string, number>> = {
  smartphones: { processor: 1, display: 1, camera: 2, battery: 1, case: 1 },
  smartwatches: { processor: 1, display: 1, strap: 1, battery: 1, case: 1 },
  tablets: { processor: 1, memory: 1, display: 1, battery: 2, case: 1 },
  asic_miners: { asic_chip: 4, cooling: 2, power: 1, case: 1 },
  laptops: { processor: 1, memory: 2, display: 1, battery: 1, motherboard: 1, cooling: 1, case: 1 },
};

export const GADGET_BLUEPRINTS: Blueprint[] = Object.entries(templates).flatMap(([category, names]) =>
  names.map((name, idx) => ({
    id: `${category}-${idx + 1}`,
    name,
    category: category as GadgetCategory,
    requirements: { coding: 100 + idx * 60, design: 50 + idx * 40, analytics: idx * 35 },
    time: 24 + idx * 24,
    description: `${name} (${category})`,
    baseStats: {
      performance: 10 + idx * 2,
      efficiency: 8 + idx,
      design: 7 + idx,
    },
    production: {
      costGram: 80 + idx * 40,
      parts: categoryParts[category as GadgetCategory],
    },
  }))
);

export function getAvailableBlueprints(companyLevel: number): Blueprint[] {
  return GADGET_BLUEPRINTS.filter((bp) => {
    const tier = Number(bp.id.split("-").at(-1) || "1");
    if (companyLevel <= 1) return tier <= 2;
    if (companyLevel === 2) return tier <= 4;
    if (companyLevel === 3) return tier <= 6;
    if (companyLevel === 4) return tier <= 8;
    return true;
  });
}
