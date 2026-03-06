// server/storage.ts
import { db, testConnection } from "./db";
import {
  users,
  companies,
  companyMembers,
  companyJoinRequests,
  messages
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
} from "../shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User>;
  usernameExists(username: string): Promise<boolean>;

  getCompany(id: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  getCompaniesByCity(city: string): Promise<Company[]>;
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

  resetAllData(): Promise<void>;
}

export class DrizzleStorage implements IStorage {
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

  async createCompany(insertCompany: InsertCompany, ownerId: string, ownerUsername: string): Promise<Company> {
    const result = await db.insert(companies).values({
      name: insertCompany.name,
      city: insertCompany.city,
      ownerId,
      level: 1,
      ork: 0,
      balance: 1000,
      warehouseCapacity: 50,
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

  async resetAllData(): Promise<void> {
    await db.delete(messages);
    await db.delete(companyJoinRequests);
    await db.delete(companyMembers);
    await db.delete(companies);
    await db.delete(users);
  }
}

class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private companies = new Map<string, Company>();
  private members = new Map<string, CompanyMember[]>();
  private joinRequests = new Map<string, JoinRequest>();
  private msgs: Message[] = [];

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

  async getCompany(id: string) { return this.companies.get(id); }
  async getAllCompanies() { return Array.from(this.companies.values()); }
  async getCompaniesByCity(city: string) { return Array.from(this.companies.values()).filter((c) => c.city === city); }

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

  async resetAllData() {
    this.users.clear();
    this.companies.clear();
    this.members.clear();
    this.joinRequests.clear();
    this.msgs = [];
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
