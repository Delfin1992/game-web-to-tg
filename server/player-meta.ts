import type { User } from "../shared/schema";
import {
  BASE_PLAYER_INVENTORY_CAPACITY,
  getHousingById,
  getHousingCityIdByName,
  getStarterHousingForCity,
  type HousingCityId,
} from "../shared/housing";
import {
  PROFESSION_UNLOCK_LEVEL,
  isProfessionId,
  type ProfessionId,
} from "../shared/professions";

type PlayerHousingState = {
  ownedByCity?: Partial<Record<HousingCityId, string[]>>;
  activeByCity?: Partial<Record<HousingCityId, string>>;
  lastAsicPayoutAtByCity?: Partial<Record<HousingCityId, number>>;
};

type PlayerMetaContainer = Record<string, unknown> & {
  advancedPersonality?: string;
  profession?: ProfessionId;
  trainingConsumablesUsedByLevel?: Record<string, number>;
  completedStudyCourseIds?: string[];
  housing?: PlayerHousingState;
};

function parseMetaContainer(raw: unknown): PlayerMetaContainer {
  if (typeof raw !== "string" || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as PlayerMetaContainer;
  } catch {
    return {};
  }
}

function serializeMetaContainer(next: PlayerMetaContainer) {
  return JSON.stringify(next);
}

function sanitizeHousingState(raw: unknown): PlayerHousingState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const cityIds: HousingCityId[] = ["san_francisco"];

  const ownedByCity: Partial<Record<HousingCityId, string[]>> = {};
  const activeByCity: Partial<Record<HousingCityId, string>> = {};
  const lastAsicPayoutAtByCity: Partial<Record<HousingCityId, number>> = {};

  for (const cityId of cityIds) {
    const owned = (source.ownedByCity as Record<string, unknown> | undefined)?.[cityId];
    if (Array.isArray(owned)) {
      ownedByCity[cityId] = owned.map((item) => String(item || "").trim()).filter(Boolean);
    }

    const active = String((source.activeByCity as Record<string, unknown> | undefined)?.[cityId] || "").trim();
    if (active) activeByCity[cityId] = active;

    const payoutAt = Number((source.lastAsicPayoutAtByCity as Record<string, unknown> | undefined)?.[cityId] || 0);
    if (Number.isFinite(payoutAt) && payoutAt > 0) lastAsicPayoutAtByCity[cityId] = payoutAt;
  }

  return {
    ownedByCity,
    activeByCity,
    lastAsicPayoutAtByCity,
  };
}

function getPlayerMetaContainer(user: Pick<User, "tutorialState">) {
  const container = parseMetaContainer(user.tutorialState);
  return {
    ...container,
    housing: sanitizeHousingState(container.housing),
  };
}

function buildStarterAwareHousingState(user: Pick<User, "city" | "tutorialState">) {
  const container = getPlayerMetaContainer(user);
  const housing = sanitizeHousingState(container.housing);
  const cityId = getHousingCityIdByName(user.city);
  const starter = getStarterHousingForCity(user.city);
  if (!cityId || !starter) return housing;

  const owned = new Set(housing.ownedByCity?.[cityId] ?? []);
  if (!owned.size) owned.add(starter.id);

  return {
    ownedByCity: {
      ...housing.ownedByCity,
      [cityId]: Array.from(owned),
    },
    activeByCity: {
      ...housing.activeByCity,
      [cityId]: housing.activeByCity?.[cityId] || starter.id,
    },
    lastAsicPayoutAtByCity: {
      ...housing.lastAsicPayoutAtByCity,
    },
  };
}

function isAdvancedPersonalityEnabled() {
  return String(process.env.ENABLE_ADVANCED_PERSONALITY ?? "false").toLowerCase() === "true";
}

export function getAdvancedPersonalityId(user: Pick<User, "tutorialState">): string | null {
  if (!isAdvancedPersonalityEnabled()) return null;
  const container = getPlayerMetaContainer(user);
  return typeof container.advancedPersonality === "string" && container.advancedPersonality.trim().length > 0
    ? container.advancedPersonality
    : null;
}

export function canSelectAdvancedPersonality(user: Pick<User, "level" | "tutorialState">) {
  void user;
  return false;
}

export async function setAdvancedPersonality(userId: string, personalityId: string) {
  void userId;
  void personalityId;
  throw new Error("Механика второго характера пока отключена.");
}

export function getPlayerProfessionId(user: Pick<User, "tutorialState">): ProfessionId | null {
  const container = getPlayerMetaContainer(user);
  return isProfessionId(container.profession) ? container.profession : null;
}

export function canSelectProfession(user: Pick<User, "level" | "tutorialState">) {
  return Number(user.level || 0) >= PROFESSION_UNLOCK_LEVEL && !getPlayerProfessionId(user);
}

export async function setPlayerProfession(userId: string, professionId: ProfessionId) {
  const { storage } = await import("./storage");
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const container = getPlayerMetaContainer(user);
  return storage.updateUser(user.id, {
    tutorialState: serializeMetaContainer({
      ...container,
      profession: professionId,
    }),
  });
}

export function mergeTutorialStateContainer(existingRaw: unknown, patch: Record<string, unknown>) {
  const existing = getPlayerMetaContainer({ tutorialState: String(existingRaw ?? "{}") });
  return serializeMetaContainer({
    ...existing,
    ...patch,
  });
}

export function getTrainingConsumablesUsedAtLevel(user: Pick<User, "level" | "tutorialState">) {
  const container = getPlayerMetaContainer(user);
  const key = String(Math.max(1, Number(user.level || 1)));
  const map = container.trainingConsumablesUsedByLevel;
  if (!map || typeof map !== "object") return 0;
  return Math.max(0, Number((map as Record<string, unknown>)[key] || 0));
}

export async function incrementTrainingConsumablesUsedAtLevel(userId: string, level: number) {
  const { storage } = await import("./storage");
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const container = getPlayerMetaContainer(user);
  const key = String(Math.max(1, Number(level || 1)));
  const current = container.trainingConsumablesUsedByLevel && typeof container.trainingConsumablesUsedByLevel === "object"
    ? container.trainingConsumablesUsedByLevel
    : {};
  return storage.updateUser(user.id, {
    tutorialState: serializeMetaContainer({
      ...container,
      trainingConsumablesUsedByLevel: {
        ...current,
        [key]: Math.max(0, Number((current as Record<string, unknown>)[key] || 0)) + 1,
      },
    }),
  });
}

export function hasCompletedStudyCourse(user: Pick<User, "tutorialState">, courseId: string) {
  const container = getPlayerMetaContainer(user);
  const items = Array.isArray(container.completedStudyCourseIds) ? container.completedStudyCourseIds : [];
  return items.includes(courseId);
}

export async function markStudyCourseCompleted(userId: string, courseId: string) {
  const { storage } = await import("./storage");
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const container = getPlayerMetaContainer(user);
  const items = Array.isArray(container.completedStudyCourseIds) ? container.completedStudyCourseIds : [];
  if (items.includes(courseId)) return user;
  return storage.updateUser(user.id, {
    tutorialState: serializeMetaContainer({
      ...container,
      completedStudyCourseIds: [...items, courseId],
    }),
  });
}

export function getPlayerHousingState(user: Pick<User, "city" | "tutorialState">) {
  return buildStarterAwareHousingState(user);
}

export function getOwnedHousingIdsForCity(user: Pick<User, "city" | "tutorialState">, city = user.city) {
  const cityId = getHousingCityIdByName(city);
  if (!cityId) return [] as string[];
  return buildStarterAwareHousingState({ city, tutorialState: user.tutorialState }).ownedByCity?.[cityId] ?? [];
}

export function getActiveHousingIdForCity(user: Pick<User, "city" | "tutorialState">, city = user.city) {
  const cityId = getHousingCityIdByName(city);
  if (!cityId) return null;
  return buildStarterAwareHousingState({ city, tutorialState: user.tutorialState }).activeByCity?.[cityId] ?? null;
}

export function getActiveHousing(user: Pick<User, "city" | "tutorialState">, city = user.city) {
  const activeId = getActiveHousingIdForCity(user, city);
  return activeId ? getHousingById(activeId) : null;
}

export function getInventoryCapacityForUser(user: Pick<User, "city" | "tutorialState">) {
  const activeHouse = getActiveHousing(user);
  return BASE_PLAYER_INVENTORY_CAPACITY + Number(activeHouse?.bonuses.inventorySlots || 0);
}

export async function grantStarterHousing(userId: string) {
  const { storage } = await import("./storage");
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const cityId = getHousingCityIdByName(user.city);
  const starter = getStarterHousingForCity(user.city);
  if (!cityId || !starter) return user;
  const container = getPlayerMetaContainer(user);
  const housing = buildStarterAwareHousingState(user);
  const owned = new Set(housing.ownedByCity?.[cityId] ?? []);
  if (owned.has(starter.id) && housing.activeByCity?.[cityId] === starter.id) return user;
  owned.add(starter.id);
  return storage.updateUser(user.id, {
    tutorialState: serializeMetaContainer({
      ...container,
      housing: {
        ...housing,
        ownedByCity: {
          ...housing.ownedByCity,
          [cityId]: Array.from(owned),
        },
        activeByCity: {
          ...housing.activeByCity,
          [cityId]: starter.id,
        },
      },
    }),
  });
}

export async function purchaseHousing(userId: string, houseId: string) {
  const { storage } = await import("./storage");
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const house = getHousingById(houseId);
  if (!house) throw new Error("Дом не найден");
  const cityId = getHousingCityIdByName(user.city);
  if (!cityId || house.cityId !== cityId) {
    throw new Error("Этот дом нельзя купить в текущем городе");
  }

  const container = getPlayerMetaContainer(user);
  const housing = buildStarterAwareHousingState(user);
  const owned = new Set(housing.ownedByCity?.[cityId] ?? []);

  if (owned.has(house.id)) {
    return storage.updateUser(user.id, {
      tutorialState: serializeMetaContainer({
        ...container,
        housing: {
          ...housing,
          activeByCity: {
            ...housing.activeByCity,
            [cityId]: house.id,
          },
        },
      }),
    });
  }

  if (Number(user.balance || 0) < house.priceLocal) {
    throw new Error(`Недостаточно средств. Нужно ${house.priceLocal}.`);
  }

  owned.add(house.id);
  return storage.updateUser(user.id, {
    balance: user.balance - house.priceLocal,
    tutorialState: serializeMetaContainer({
      ...container,
      housing: {
        ...housing,
        ownedByCity: {
          ...housing.ownedByCity,
          [cityId]: Array.from(owned),
        },
        activeByCity: {
          ...housing.activeByCity,
          [cityId]: house.id,
        },
      },
    }),
  });
}

export async function setActiveHousing(userId: string, houseId: string) {
  const { storage } = await import("./storage");
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const house = getHousingById(houseId);
  if (!house) throw new Error("Дом не найден");
  const cityId = getHousingCityIdByName(user.city);
  const housing = buildStarterAwareHousingState(user);
  if (!cityId || house.cityId !== cityId || !(housing.ownedByCity?.[cityId] ?? []).includes(house.id)) {
    throw new Error("Этот дом ещё не куплен");
  }
  const container = getPlayerMetaContainer(user);
  return storage.updateUser(user.id, {
    tutorialState: serializeMetaContainer({
      ...container,
      housing: {
        ...housing,
        activeByCity: {
          ...housing.activeByCity,
          [cityId]: house.id,
        },
      },
    }),
  });
}

export async function markHousingAsicPayout(userId: string, city: string, timestampMs: number) {
  const { storage } = await import("./storage");
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");
  const cityId = getHousingCityIdByName(city);
  if (!cityId) return user;
  const container = getPlayerMetaContainer(user);
  const housing = buildStarterAwareHousingState(user);
  return storage.updateUser(user.id, {
    tutorialState: serializeMetaContainer({
      ...container,
      housing: {
        ...housing,
        lastAsicPayoutAtByCity: {
          ...housing.lastAsicPayoutAtByCity,
          [cityId]: Math.max(0, Math.floor(timestampMs)),
        },
      },
    }),
  });
}

export function getHousingLastAsicPayoutAt(user: Pick<User, "city" | "tutorialState">, city = user.city) {
  const cityId = getHousingCityIdByName(city);
  if (!cityId) return 0;
  return Math.max(
    0,
    Number(buildStarterAwareHousingState({ city, tutorialState: user.tutorialState }).lastAsicPayoutAtByCity?.[cityId] || 0),
  );
}
