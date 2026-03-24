// server/storage.ts
import { db, testConnection } from "./db";
import {
  users,
  companies,
  companyMembers,
  companyJoinRequests,
  messages,
  gameSettings,
  hackathonSabotageLogs,
  globalEvents,
  pvpDuelLogs,
} from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  type User,
  type InsertUser,
  type UpdateUser,
  type Company,
  type InsertCompany,
  type CompanyMember,
  type InsertCompanyMember,
  type Message,
  type InsertMessage,
  type JoinRequest,
  type InsertJoinRequest,
  type GameSettingsRow,
  type UpdateGameSettingsRow,
  type HackathonSabotageLog,
  type InsertHackathonSabotageLog,
  type GlobalEventRow,
  type InsertGlobalEventRow,
  type PvpDuelLogRow,
  type InsertPvpDuelLogRow,
} from "../shared/schema";
import { randomUUID } from "crypto";
import { createDefaultTutorialState, serializeTutorialState } from "../shared/tutorial";
import { DEFAULT_GAME_SETTINGS } from "../shared/game-settings";

type StoredGlobalEvent = {
  id: string;
  templateId: string;
  title: string;
  description: string;
  city?: string;
  target?: string;
  intensity: "low" | "medium" | "high";
  durationHours: number;
  effects: Array<{ type: string; target: string; value: number }>;
  startedAt: number;
  endsAt: number;
};

type StoredPvpDuelLog = {
  id: string;
  playerAId: string;
  playerAName: string;
  playerARatingBefore: number;
  playerARatingAfter: number;
  playerBId: string;
  playerBName: string;
  playerBRatingBefore: number;
  playerBRatingAfter: number;
  winnerUserId?: string | null;
  rounds: unknown[];
  createdAt: number;
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  usernameExists(username: string): Promise<boolean>;

  getCompany(id: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  getCompaniesByCity(city: string): Promise<Company[]>;
  getTutorialCompanyByOwner(userId: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany, ownerId: string, ownerUsername: string): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;

  getCompanyMembers(companyId: string): Promise<CompanyMember[]>;
  getMemberByUserId(companyId: string, userId: string): Promise<CompanyMember | undefined>;
  addCompanyMember(member: InsertCompanyMember): Promise<CompanyMember>;
  removeCompanyMember(companyId: string, userId: string): Promise<void>;

  createJoinRequest(request: InsertJoinRequest): Promise<JoinRequest>;
  getJoinRequestsByCompany(companyId: string): Promise<JoinRequest[]>;
  getJoinRequestsByUser(userId: string): Promise<JoinRequest[]>;
  updateJoinRequestStatus(requestId: string, status: string): Promise<void>;

  getMessages(limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  getGameSettings(): Promise<GameSettingsRow>;
  updateGameSettings(updates: UpdateGameSettingsRow): Promise<GameSettingsRow>;

  createHackathonSabotageLog(log: InsertHackathonSabotageLog): Promise<HackathonSabotageLog>;
  updateHackathonSabotageLog(id: string, updates: Partial<HackathonSabotageLog>): Promise<HackathonSabotageLog | undefined>;
  getHackathonSabotageLogsByEvent(eventId: string, companyId?: string): Promise<HackathonSabotageLog[]>;
  getPendingHackathonPoachOffer(targetUserId: string, eventId: string): Promise<HackathonSabotageLog | undefined>;

  createGlobalEvent(event: StoredGlobalEvent): Promise<StoredGlobalEvent>;
  getCurrentGlobalEvents(nowMs: number): Promise<StoredGlobalEvent[]>;
  getGlobalEventsHistory(limit?: number): Promise<StoredGlobalEvent[]>;
  createPvpDuelLog(log: StoredPvpDuelLog): Promise<StoredPvpDuelLog>;
  getPvpDuelHistoryByUser(userId: string, limit?: number): Promise<StoredPvpDuelLog[]>;

  resetAllData(): Promise<void>;
}

function buildDefaultGameSettingsRow(): GameSettingsRow {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 1,
    jobsEnabled: DEFAULT_GAME_SETTINGS.systems.jobsEnabled,
    educationEnabled: DEFAULT_GAME_SETTINGS.systems.educationEnabled,
    companiesEnabled: DEFAULT_GAME_SETTINGS.systems.companiesEnabled,
    blueprintsEnabled: DEFAULT_GAME_SETTINGS.systems.blueprintsEnabled,
    productionEnabled: DEFAULT_GAME_SETTINGS.systems.productionEnabled,
    marketEnabled: DEFAULT_GAME_SETTINGS.systems.marketEnabled,
    leaderboardsEnabled: DEFAULT_GAME_SETTINGS.systems.leaderboardsEnabled,
    chatEnabled: DEFAULT_GAME_SETTINGS.systems.chatEnabled,
    bankEnabled: DEFAULT_GAME_SETTINGS.systems.bankEnabled,
    gramEnabled: DEFAULT_GAME_SETTINGS.systems.gramEnabled,
    cityBonusesEnabled: DEFAULT_GAME_SETTINGS.systems.cityBonusesEnabled,
    tutorialEnabled: DEFAULT_GAME_SETTINGS.systems.tutorialEnabled,
    demoCompanyEnabled: DEFAULT_GAME_SETTINGS.systems.demoCompanyEnabled,
    ipoEnabled: DEFAULT_GAME_SETTINGS.systems.ipoEnabled,
    stocksEnabled: DEFAULT_GAME_SETTINGS.systems.stocksEnabled,
    dynamicCurrencyEnabled: DEFAULT_GAME_SETTINGS.economy.dynamicCurrencyEnabled,
    dynamicGadgetPricesEnabled: DEFAULT_GAME_SETTINGS.economy.dynamicGadgetPricesEnabled,
    taxesEnabled: DEFAULT_GAME_SETTINGS.economy.taxesEnabled,
    commissionsEnabled: DEFAULT_GAME_SETTINGS.economy.commissionsEnabled,
    tutorialDemoCompanyEnabled: DEFAULT_GAME_SETTINGS.tutorial.tutorialDemoCompanyEnabled,
    tutorialFreeBlueprintEnabled: DEFAULT_GAME_SETTINGS.tutorial.tutorialFreeBlueprintEnabled,
    tutorialProductionWithoutPartsEnabled: DEFAULT_GAME_SETTINGS.tutorial.tutorialProductionWithoutPartsEnabled,
    workIncomeMultiplier: 100,
    workXpMultiplier: 100,
    blueprintCostMultiplier: 100,
    productionSpeedMultiplier: 100,
    gadgetSellPriceMultiplier: 100,
    createdAt: now,
    updatedAt: now,
  };
}

export class DrizzleStorage implements IStorage {
  private settingsFallback: GameSettingsRow = buildDefaultGameSettingsRow();
  private sabotageLogsFallback: HackathonSabotageLog[] = [];
  private globalEventsFallback: StoredGlobalEvent[] = [];
  private pvpDuelLogsFallback: StoredPvpDuelLog[] = [];
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async usernameExists(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    return !!user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      username: insertUser.username,
      password: insertUser.password,
      city: insertUser.city ?? "Санкт-Петербург",
      personality: insertUser.personality ?? "workaholic",
      gender: insertUser.gender ?? "male",
      level: 1,
      experience: 0,
      balance: 1000,
      reputation: 0,
      tutorialState: serializeTutorialState(createDefaultTutorialState()),
    }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User> {
    const result = await db.update(users)
      .set({ ...updates })
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(companyJoinRequests).where(eq(companyJoinRequests.userId, id));
    await db.delete(companyMembers).where(eq(companyMembers.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async getCompaniesByCity(city: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.city, city));
  }

  async getTutorialCompanyByOwner(userId: string): Promise<Company | undefined> {
    const result = await db
      .select()
      .from(companies)
      .where(and(eq(companies.isTutorial, true), eq(companies.tutorialOwnerId, userId)))
      .limit(1);
    return result[0];
  }

  async createCompany(insertCompany: InsertCompany, ownerId: string, ownerUsername: string): Promise<Company> {
    const result = await db.insert(companies).values({
      name: insertCompany.name,
      city: insertCompany.city,
      ownerId,
      level: 1,
      ork: 0,
      balance: 1000,
      warehouseCapacity: 50,
      isTutorial: insertCompany.isTutorial ?? false,
      tutorialOwnerId: insertCompany.tutorialOwnerId ?? null,
    }).returning();

    await db.insert(companyMembers).values({
      companyId: result[0].id,
      userId: ownerId,
      username: ownerUsername,
      role: "owner",
    });

    return result[0];
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const result = await db.update(companies)
      .set({ ...updates })
      .where(eq(companies.id, id))
      .returning();
    if (!result[0]) throw new Error("Company not found");
    return result[0];
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companyMembers).where(eq(companyMembers.companyId, id));
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    return await db.select().from(companyMembers).where(eq(companyMembers.companyId, companyId));
  }

  async getMemberByUserId(companyId: string, userId: string): Promise<CompanyMember | undefined> {
    const result = await db.select().from(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId))).limit(1);
    return result[0];
  }

  async addCompanyMember(insertMember: InsertCompanyMember): Promise<CompanyMember> {
    const result = await db.insert(companyMembers).values(insertMember).returning();
    return result[0];
  }

  async removeCompanyMember(companyId: string, userId: string): Promise<void> {
    await db.delete(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
  }

  async createJoinRequest(insertRequest: InsertJoinRequest): Promise<JoinRequest> {
    const result = await db.insert(companyJoinRequests).values({ ...insertRequest, status: "pending" }).returning();
    return result[0];
  }

  async getJoinRequestsByCompany(companyId: string): Promise<JoinRequest[]> {
    return await db.select().from(companyJoinRequests)
      .where(and(eq(companyJoinRequests.companyId, companyId), eq(companyJoinRequests.status, "pending")));
  }

  async getJoinRequestsByUser(userId: string): Promise<JoinRequest[]> {
    return await db.select().from(companyJoinRequests).where(eq(companyJoinRequests.userId, userId));
  }

  async updateJoinRequestStatus(requestId: string, status: string): Promise<void> {
    await db.update(companyJoinRequests).set({ status }).where(eq(companyJoinRequests.id, requestId));
  }

  async getMessages(limit: number = 50): Promise<Message[]> {
    return await db.select().from(messages).orderBy(desc(messages.timestamp)).limit(limit);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values({ ...insertMessage, timestamp: Math.floor(Date.now() / 1000) }).returning();
    return result[0];
  }

  async getGameSettings(): Promise<GameSettingsRow> {
    try {
      const existing = await db.select().from(gameSettings).where(eq(gameSettings.id, 1)).limit(1);
      if (existing[0]) {
        this.settingsFallback = existing[0];
        return existing[0];
      }
      const created = await db.insert(gameSettings).values({ id: 1 }).returning();
      this.settingsFallback = created[0];
      return created[0];
    } catch (error) {
      // TODO: Remove this fallback once all environments apply `migrations/0001_game_settings.sql`.
      console.warn("Game settings table is unavailable, using in-memory fallback.");
      return this.settingsFallback;
    }
  }

  async updateGameSettings(updates: UpdateGameSettingsRow): Promise<GameSettingsRow> {
    try {
      await this.getGameSettings();
      const result = await db.update(gameSettings)
        .set({
          ...updates,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(gameSettings.id, 1))
        .returning();
      if (!result[0]) throw new Error("Game settings update failed");
      this.settingsFallback = result[0];
      return result[0];
    } catch (error) {
      // TODO: Remove this fallback once all environments apply `migrations/0001_game_settings.sql`.
      const merged: GameSettingsRow = {
        ...this.settingsFallback,
        ...updates,
        updatedAt: Math.floor(Date.now() / 1000),
      };
      this.settingsFallback = merged;
      return merged;
    }
  }

  async createHackathonSabotageLog(log: InsertHackathonSabotageLog): Promise<HackathonSabotageLog> {
    try {
      const result = await db.insert(hackathonSabotageLogs).values(log).returning();
      return result[0];
    } catch {
      const created: HackathonSabotageLog = {
        id: String(log.id || randomUUID()),
        eventId: String(log.eventId || ""),
        attackerCompanyId: String(log.attackerCompanyId || ""),
        attackerCompanyName: String(log.attackerCompanyName || ""),
        targetCompanyId: String(log.targetCompanyId || ""),
        targetCompanyName: String(log.targetCompanyName || ""),
        initiatorUserId: String(log.initiatorUserId || ""),
        targetUserId: log.targetUserId ? String(log.targetUserId) : null,
        sabotageType: String(log.sabotageType || ""),
        status: String(log.status || "resolved"),
        success: typeof log.success === "boolean" ? log.success : null,
        detected: Boolean(log.detected),
        scoreDeltaAttacker: Number(log.scoreDeltaAttacker || 0),
        scoreDeltaTarget: Number(log.scoreDeltaTarget || 0),
        details: String(log.details || "{}"),
        createdAt: Number(log.createdAt || Math.floor(Date.now() / 1000)),
        resolvedAt: log.resolvedAt ? Number(log.resolvedAt) : null,
      };
      this.sabotageLogsFallback.push(created);
      return created;
    }
  }

  async updateHackathonSabotageLog(id: string, updates: Partial<HackathonSabotageLog>): Promise<HackathonSabotageLog | undefined> {
    try {
      const result = await db.update(hackathonSabotageLogs).set(updates).where(eq(hackathonSabotageLogs.id, id)).returning();
      return result[0];
    } catch {
      const index = this.sabotageLogsFallback.findIndex((row) => row.id === id);
      if (index < 0) return undefined;
      this.sabotageLogsFallback[index] = { ...this.sabotageLogsFallback[index], ...updates };
      return this.sabotageLogsFallback[index];
    }
  }

  async getHackathonSabotageLogsByEvent(eventId: string, companyId?: string): Promise<HackathonSabotageLog[]> {
    try {
      const rows = await db.select().from(hackathonSabotageLogs).where(eq(hackathonSabotageLogs.eventId, eventId));
      if (!companyId) return rows;
      return rows.filter((row) => row.attackerCompanyId === companyId || row.targetCompanyId === companyId);
    } catch {
      return this.sabotageLogsFallback.filter((row) =>
        row.eventId === eventId && (!companyId || row.attackerCompanyId === companyId || row.targetCompanyId === companyId),
      );
    }
  }

  async getPendingHackathonPoachOffer(targetUserId: string, eventId: string): Promise<HackathonSabotageLog | undefined> {
    try {
      const rows = await db
        .select()
        .from(hackathonSabotageLogs)
        .where(and(eq(hackathonSabotageLogs.eventId, eventId), eq(hackathonSabotageLogs.targetUserId, targetUserId)));
      return rows.find((row) => row.status === "poach_pending");
    } catch {
      return this.sabotageLogsFallback.find((row) =>
        row.eventId === eventId && row.targetUserId === targetUserId && row.status === "poach_pending",
      );
    }
  }

  async createGlobalEvent(event: StoredGlobalEvent): Promise<StoredGlobalEvent> {
    const row: InsertGlobalEventRow = {
      id: event.id,
      templateId: event.templateId,
      title: event.title,
      description: event.description,
      city: event.city ?? null,
      target: event.target ?? null,
      intensity: event.intensity,
      duration: event.durationHours,
      effects: JSON.stringify(event.effects || []),
      startedAt: event.startedAt,
      endsAt: event.endsAt,
    };
    try {
      const result = await db.insert(globalEvents).values(row).returning();
      const created = result[0];
      return {
        id: created.id,
        templateId: created.templateId,
        title: created.title,
        description: created.description,
        city: created.city ?? undefined,
        target: created.target ?? undefined,
        intensity: created.intensity as StoredGlobalEvent["intensity"],
        durationHours: Number(created.duration || 0),
        effects: JSON.parse(String(created.effects || "[]")),
        startedAt: Number(created.startedAt || 0),
        endsAt: Number(created.endsAt || 0),
      };
    } catch {
      this.globalEventsFallback.unshift(event);
      return event;
    }
  }

  async getCurrentGlobalEvents(nowMs: number): Promise<StoredGlobalEvent[]> {
    try {
      const rows = await db.select().from(globalEvents);
      return rows
        .filter((row) => Number(row.endsAt || 0) > nowMs)
        .sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0))
        .map((row) => ({
          id: row.id,
          templateId: row.templateId,
          title: row.title,
          description: row.description,
          city: row.city ?? undefined,
          target: row.target ?? undefined,
          intensity: row.intensity as StoredGlobalEvent["intensity"],
          durationHours: Number(row.duration || 0),
          effects: JSON.parse(String(row.effects || "[]")),
          startedAt: Number(row.startedAt || 0),
          endsAt: Number(row.endsAt || 0),
        }));
    } catch {
      return this.globalEventsFallback.filter((event) => event.endsAt > nowMs);
    }
  }

  async getGlobalEventsHistory(limit: number = 100): Promise<StoredGlobalEvent[]> {
    try {
      const rows = await db.select().from(globalEvents).orderBy(desc(globalEvents.startedAt)).limit(Math.max(1, Math.min(500, limit)));
      return rows.map((row) => ({
        id: row.id,
        templateId: row.templateId,
        title: row.title,
        description: row.description,
        city: row.city ?? undefined,
        target: row.target ?? undefined,
        intensity: row.intensity as StoredGlobalEvent["intensity"],
        durationHours: Number(row.duration || 0),
        effects: JSON.parse(String(row.effects || "[]")),
        startedAt: Number(row.startedAt || 0),
        endsAt: Number(row.endsAt || 0),
      }));
    } catch {
      return this.globalEventsFallback.slice(0, Math.max(1, Math.min(500, limit)));
    }
  }

  async createPvpDuelLog(log: StoredPvpDuelLog): Promise<StoredPvpDuelLog> {
    const row: InsertPvpDuelLogRow = {
      id: log.id,
      playerAId: log.playerAId,
      playerAName: log.playerAName,
      playerARatingBefore: log.playerARatingBefore,
      playerARatingAfter: log.playerARatingAfter,
      playerBId: log.playerBId,
      playerBName: log.playerBName,
      playerBRatingBefore: log.playerBRatingBefore,
      playerBRatingAfter: log.playerBRatingAfter,
      winnerUserId: log.winnerUserId ?? null,
      rounds: JSON.stringify(log.rounds || []),
      createdAt: log.createdAt,
    };
    try {
      const result = await db.insert(pvpDuelLogs).values(row).returning();
      const created = result[0];
      return {
        id: created.id,
        playerAId: created.playerAId,
        playerAName: created.playerAName,
        playerARatingBefore: Number(created.playerARatingBefore || 0),
        playerARatingAfter: Number(created.playerARatingAfter || 0),
        playerBId: created.playerBId,
        playerBName: created.playerBName,
        playerBRatingBefore: Number(created.playerBRatingBefore || 0),
        playerBRatingAfter: Number(created.playerBRatingAfter || 0),
        winnerUserId: created.winnerUserId ?? null,
        rounds: JSON.parse(String(created.rounds || "[]")),
        createdAt: Number(created.createdAt || 0),
      };
    } catch {
      this.pvpDuelLogsFallback.unshift(log);
      return log;
    }
  }

  async getPvpDuelHistoryByUser(userId: string, limit: number = 20): Promise<StoredPvpDuelLog[]> {
    const capped = Math.max(1, Math.min(200, limit));
    try {
      const rows = await db.select().from(pvpDuelLogs).orderBy(desc(pvpDuelLogs.createdAt)).limit(1000);
      return rows
        .filter((row) => row.playerAId === userId || row.playerBId === userId)
        .slice(0, capped)
        .map((row) => ({
          id: row.id,
          playerAId: row.playerAId,
          playerAName: row.playerAName,
          playerARatingBefore: Number(row.playerARatingBefore || 0),
          playerARatingAfter: Number(row.playerARatingAfter || 0),
          playerBId: row.playerBId,
          playerBName: row.playerBName,
          playerBRatingBefore: Number(row.playerBRatingBefore || 0),
          playerBRatingAfter: Number(row.playerBRatingAfter || 0),
          winnerUserId: row.winnerUserId ?? null,
          rounds: JSON.parse(String(row.rounds || "[]")),
          createdAt: Number(row.createdAt || 0),
        }));
    } catch {
      return this.pvpDuelLogsFallback
        .filter((row) => row.playerAId === userId || row.playerBId === userId)
        .slice(0, capped);
    }
  }

  async resetAllData(): Promise<void> {
    await db.delete(messages);
    await db.delete(companyJoinRequests);
    await db.delete(companyMembers);
    await db.delete(hackathonSabotageLogs);
    await db.delete(globalEvents);
    await db.delete(pvpDuelLogs);
    await db.delete(companies);
    await db.delete(users);
    await db.delete(gameSettings);
  }
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private companies = new Map<string, Company>();
  private members = new Map<string, CompanyMember[]>();
  private joinRequests = new Map<string, JoinRequest>();
  private msgs: Message[] = [];
  private settings: GameSettingsRow = buildDefaultGameSettingsRow();
  private hackathonSabotageLogs: HackathonSabotageLog[] = [];
  private globalEventsStore: StoredGlobalEvent[] = [];
  private pvpDuelLogsStore: StoredPvpDuelLog[] = [];

  async getUser(id: string) { return this.users.get(id); }
  async getUserByUsername(username: string) { return Array.from(this.users.values()).find((u) => u.username === username); }
  async getUsers() { return Array.from(this.users.values()); }
  async usernameExists(username: string) { return !!(await this.getUserByUsername(username)); }

  async createUser(user: InsertUser) {
    const created: User = {
      id: randomUUID(),
      username: user.username,
      password: user.password,
      city: user.city ?? "Санкт-Петербург",
      personality: user.personality ?? "workaholic",
      gender: user.gender ?? "male",
      level: 1,
      experience: 0,
      balance: 1000,
      reputation: 0,
      pvpRating: 1000,
      pvpWins: 0,
      pvpLosses: 0,
      pvpMatches: 0,
      pvpDailyMatches: 0,
      pvpDailyStamp: "",
      lastActiveAt: Math.floor(Date.now() / 1000),
      tutorialState: serializeTutorialState(createDefaultTutorialState()),
    };
    this.users.set(created.id, created);
    return created;
  }

  async updateUser(id: string, updates: UpdateUser) {
    const prev = this.users.get(id);
    if (!prev) throw new Error("User not found");
    const next = { ...prev, ...updates } as User;
    this.users.set(id, next);
    return next;
  }

  async deleteUser(id: string) {
    this.users.delete(id);
    for (const [companyId, list] of Array.from(this.members.entries())) {
      this.members.set(companyId, list.filter((member: CompanyMember) => member.userId !== id));
    }
    for (const [requestId, request] of Array.from(this.joinRequests.entries())) {
      if (request.userId === id) {
        this.joinRequests.delete(requestId);
      }
    }
  }

  async getCompany(id: string) { return this.companies.get(id); }
  async getAllCompanies() { return Array.from(this.companies.values()); }
  async getCompaniesByCity(city: string) { return Array.from(this.companies.values()).filter((c) => c.city === city); }
  async getTutorialCompanyByOwner(userId: string) {
    return Array.from(this.companies.values()).find(
      (company) => Boolean(company.isTutorial) && company.tutorialOwnerId === userId,
    );
  }

  async createCompany(company: InsertCompany, ownerId: string, ownerUsername: string) {
    const created: Company = {
      id: randomUUID(),
      name: company.name,
      city: company.city,
      ownerId,
      level: 1,
      ork: 0,
      balance: 1000,
      warehouseCapacity: 50,
      isTutorial: company.isTutorial ?? false,
      tutorialOwnerId: company.tutorialOwnerId ?? null,
    };
    this.companies.set(created.id, created);
    const member: CompanyMember = { id: randomUUID(), companyId: created.id, userId: ownerId, username: ownerUsername, role: "owner" };
    this.members.set(created.id, [member]);
    return created;
  }

  async updateCompany(id: string, updates: Partial<Company>) {
    const prev = this.companies.get(id);
    if (!prev) throw new Error("Company not found");
    const next = { ...prev, ...updates } as Company;
    this.companies.set(id, next);
    return next;
  }

  async deleteCompany(id: string) {
    this.companies.delete(id);
    this.members.delete(id);
  }

  async getCompanyMembers(companyId: string) { return this.members.get(companyId) ?? []; }

  async getMemberByUserId(companyId: string, userId: string) {
    return (this.members.get(companyId) ?? []).find((m) => m.userId === userId);
  }

  async addCompanyMember(member: InsertCompanyMember) {
    const created: CompanyMember = { id: randomUUID(), ...member, role: member.role ?? "member" };
    const list = this.members.get(member.companyId) ?? [];
    list.push(created);
    this.members.set(member.companyId, list);
    return created;
  }

  async removeCompanyMember(companyId: string, userId: string) {
    const list = this.members.get(companyId) ?? [];
    this.members.set(companyId, list.filter((m) => m.userId !== userId));
  }

  async createJoinRequest(request: InsertJoinRequest) {
    const created: JoinRequest = { id: randomUUID(), ...request, status: "pending" };
    this.joinRequests.set(created.id, created);
    return created;
  }

  async getJoinRequestsByCompany(companyId: string) {
    return Array.from(this.joinRequests.values()).filter((r) => r.companyId === companyId && r.status === "pending");
  }

  async getJoinRequestsByUser(userId: string) {
    return Array.from(this.joinRequests.values()).filter((r) => r.userId === userId);
  }

  async updateJoinRequestStatus(requestId: string, status: string) {
    const req = this.joinRequests.get(requestId);
    if (req) this.joinRequests.set(requestId, { ...req, status });
  }

  async getMessages(limit: number = 50) { return [...this.msgs].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit); }

  async createMessage(message: InsertMessage) {
    const created: Message = { id: randomUUID(), ...message, timestamp: Math.floor(Date.now() / 1000) };
    this.msgs.push(created);
    return created;
  }

  async getGameSettings() {
    return this.settings;
  }

  async updateGameSettings(updates: UpdateGameSettingsRow) {
    this.settings = {
      ...this.settings,
      ...updates,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    return this.settings;
  }

  async createHackathonSabotageLog(log: InsertHackathonSabotageLog) {
    const created: HackathonSabotageLog = {
      id: String(log.id || randomUUID()),
      eventId: String(log.eventId || ""),
      attackerCompanyId: String(log.attackerCompanyId || ""),
      attackerCompanyName: String(log.attackerCompanyName || ""),
      targetCompanyId: String(log.targetCompanyId || ""),
      targetCompanyName: String(log.targetCompanyName || ""),
      initiatorUserId: String(log.initiatorUserId || ""),
      targetUserId: log.targetUserId ? String(log.targetUserId) : null,
      sabotageType: String(log.sabotageType || ""),
      status: String(log.status || "resolved"),
      success: typeof log.success === "boolean" ? log.success : null,
      detected: Boolean(log.detected),
      scoreDeltaAttacker: Number(log.scoreDeltaAttacker || 0),
      scoreDeltaTarget: Number(log.scoreDeltaTarget || 0),
      details: String(log.details || "{}"),
      createdAt: Number(log.createdAt || Math.floor(Date.now() / 1000)),
      resolvedAt: log.resolvedAt ? Number(log.resolvedAt) : null,
    };
    this.hackathonSabotageLogs.push(created);
    return created;
  }

  async updateHackathonSabotageLog(id: string, updates: Partial<HackathonSabotageLog>) {
    const index = this.hackathonSabotageLogs.findIndex((row) => row.id === id);
    if (index < 0) return undefined;
    this.hackathonSabotageLogs[index] = { ...this.hackathonSabotageLogs[index], ...updates };
    return this.hackathonSabotageLogs[index];
  }

  async getHackathonSabotageLogsByEvent(eventId: string, companyId?: string) {
    return this.hackathonSabotageLogs.filter((row) =>
      row.eventId === eventId && (!companyId || row.attackerCompanyId === companyId || row.targetCompanyId === companyId),
    );
  }

  async getPendingHackathonPoachOffer(targetUserId: string, eventId: string) {
    return this.hackathonSabotageLogs.find((row) =>
      row.eventId === eventId && row.targetUserId === targetUserId && row.status === "poach_pending",
    );
  }

  async createGlobalEvent(event: StoredGlobalEvent) {
    this.globalEventsStore.unshift(event);
    return event;
  }

  async getCurrentGlobalEvents(nowMs: number) {
    return this.globalEventsStore.filter((event) => event.endsAt > nowMs);
  }

  async getGlobalEventsHistory(limit: number = 100) {
    return this.globalEventsStore.slice(0, Math.max(1, Math.min(500, limit)));
  }

  async createPvpDuelLog(log: StoredPvpDuelLog) {
    this.pvpDuelLogsStore.unshift(log);
    return log;
  }

  async getPvpDuelHistoryByUser(userId: string, limit: number = 20) {
    const capped = Math.max(1, Math.min(200, limit));
    return this.pvpDuelLogsStore
      .filter((row) => row.playerAId === userId || row.playerBId === userId)
      .slice(0, capped);
  }

  async resetAllData() {
    this.users.clear();
    this.companies.clear();
    this.members.clear();
    this.joinRequests.clear();
    this.msgs = [];
    this.settings = buildDefaultGameSettingsRow();
    this.hackathonSabotageLogs = [];
    this.globalEventsStore = [];
    this.pvpDuelLogsStore = [];
  }
}

export let storage: IStorage = new MemStorage();
export let storageMode: "memory" | "postgres" = "memory";

export async function initializeStorage() {
  const ok = await testConnection();
  if (ok) {
    storage = new DrizzleStorage();
    storageMode = "postgres";
    console.log("✅ Using PostgreSQL storage");
  } else {
    storage = new MemStorage();
    storageMode = "memory";
    console.warn("⚠️ PostgreSQL недоступна. Запущен fallback: in-memory storage (данные не сохраняются после перезапуска).\nДля постоянной БД установите DATABASE_URL на рабочий Postgres.");
  }
}
