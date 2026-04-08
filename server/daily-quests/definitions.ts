import type { User } from "../../shared/schema";

export type DailyQuestCategory =
  | "pvp"
  | "education"
  | "repair"
  | "economy"
  | "general";

export type DailyQuestEventType =
  | "complete_jobs"
  | "complete_education"
  | "buy_shop_item"
  | "play_pvp"
  | "win_pvp"
  | "exchange_gram"
  | "open_bank_product"
  | "repair_gadget"
  | "buy_housing"
  | "buy_stock"
  | "sell_stock"
  | "earn_money"
  | "spend_study_energy"
  | "gain_skill_points";

export type DailyQuestReward = {
  money?: number;
  xp?: number;
  reputation?: number;
  gram?: number;
  workEnergy?: number;
  studyEnergy?: number;
  itemId?: string;
  itemName?: string;
  itemType?: "part" | "trophy";
  itemQuantity?: number;
  itemRarity?: string;
  itemStats?: Record<string, number>;
};

export type DailyQuestDefinition = {
  id: string;
  category: DailyQuestCategory;
  title: string;
  description: string;
  eventType: DailyQuestEventType;
  target: number;
  enabled: boolean;
  minLevel?: number;
  weight?: number;
  isEligible?: (user: User) => boolean;
};

const ALWAYS = () => true;
const HAS_PROFESSION = (user: User) => Boolean((user as User & { profession?: unknown }).profession);

export const DAILY_QUESTS_PER_DAY = 3;

export const DAILY_QUEST_DEFINITIONS: DailyQuestDefinition[] = [
  {
    id: "jobs_2",
    category: "general",
    title: "Рабочий ритм",
    description: "Выполни 2 работы.",
    eventType: "complete_jobs",
    target: 2,
    enabled: true,
    weight: 5,
    isEligible: ALWAYS,
  },
  {
    id: "jobs_3",
    category: "general",
    title: "Полная смена",
    description: "Выполни 3 работы.",
    eventType: "complete_jobs",
    target: 3,
    enabled: true,
    weight: 3,
    minLevel: 2,
    isEligible: ALWAYS,
  },
  {
    id: "education_1",
    category: "education",
    title: "Быстрая прокачка",
    description: "Заверши 1 обучение.",
    eventType: "complete_education",
    target: 1,
    enabled: true,
    weight: 5,
    isEligible: ALWAYS,
  },
  {
    id: "education_2",
    category: "education",
    title: "Учёба в темпе",
    description: "Заверши 2 обучения.",
    eventType: "complete_education",
    target: 2,
    enabled: true,
    weight: 3,
    minLevel: 2,
    isEligible: ALWAYS,
  },
  {
    id: "study_energy_30",
    category: "education",
    title: "Время учиться",
    description: "Потрать 30% энергии учёбы.",
    eventType: "spend_study_energy",
    target: 30,
    enabled: true,
    weight: 4,
    isEligible: ALWAYS,
  },
  {
    id: "skills_3",
    category: "education",
    title: "Рост навыков",
    description: "Получи 3 очка навыков через обучение.",
    eventType: "gain_skill_points",
    target: 3,
    enabled: true,
    weight: 4,
    isEligible: ALWAYS,
  },
  {
    id: "repair_order_1",
    category: "repair",
    title: "Нужен сервис",
    description: "Отправь 1 гаджет в ремонт.",
    eventType: "repair_gadget",
    target: 1,
    enabled: true,
    weight: 3,
    minLevel: 2,
    isEligible: ALWAYS,
  },
  {
    id: "shop_1",
    category: "economy",
    title: "Полезная покупка",
    description: "Купи 1 предмет в магазине.",
    eventType: "buy_shop_item",
    target: 1,
    enabled: true,
    weight: 4,
    isEligible: ALWAYS,
  },
  {
    id: "earn_money_250",
    category: "economy",
    title: "Денежный поток",
    description: "Заработай 250 местной валюты.",
    eventType: "earn_money",
    target: 250,
    enabled: true,
    weight: 4,
    isEligible: ALWAYS,
  },
  {
    id: "exchange_50",
    category: "economy",
    title: "Обменный курс",
    description: "Проведи обмен на 50 через GRM.",
    eventType: "exchange_gram",
    target: 50,
    enabled: true,
    weight: 3,
    minLevel: 2,
    isEligible: ALWAYS,
  },
  {
    id: "bank_product_1",
    category: "economy",
    title: "Финансовый ход",
    description: "Открой 1 банковский продукт.",
    eventType: "open_bank_product",
    target: 1,
    enabled: true,
    weight: 2,
    minLevel: 2,
    isEligible: ALWAYS,
  },
  {
    id: "buy_stock_1",
    category: "economy",
    title: "Первый актив дня",
    description: "Купи 1 актив на бирже.",
    eventType: "buy_stock",
    target: 1,
    enabled: true,
    weight: 2,
    minLevel: 3,
    isEligible: ALWAYS,
  },
  {
    id: "sell_stock_1",
    category: "economy",
    title: "Фиксация результата",
    description: "Продай 1 актив на бирже.",
    eventType: "sell_stock",
    target: 1,
    enabled: true,
    weight: 1,
    minLevel: 3,
    isEligible: ALWAYS,
  },
  {
    id: "play_pvp_1",
    category: "pvp",
    title: "Разминка на арене",
    description: "Сыграй 1 PvP-дуэль.",
    eventType: "play_pvp",
    target: 1,
    enabled: true,
    weight: 3,
    minLevel: 5,
    isEligible: HAS_PROFESSION,
  },
  {
    id: "play_pvp_2",
    category: "pvp",
    title: "Боевая серия",
    description: "Сыграй 2 PvP-дуэли.",
    eventType: "play_pvp",
    target: 2,
    enabled: true,
    weight: 2,
    minLevel: 6,
    isEligible: HAS_PROFESSION,
  },
  {
    id: "win_pvp_1",
    category: "pvp",
    title: "Победа дня",
    description: "Выиграй 1 PvP-дуэль.",
    eventType: "win_pvp",
    target: 1,
    enabled: true,
    weight: 2,
    minLevel: 6,
    isEligible: HAS_PROFESSION,
  },
];
