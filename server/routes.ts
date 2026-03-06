// server/routes.ts
import type { Express } from "express";
import { type Server } from "http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { insertMessageSchema, insertUserSchema } from "../shared/schema";
import { GADGET_BLUEPRINTS, getAvailableBlueprints, RARITY_QUALITY_MULTIPLIERS, type BlueprintStatus } from "../shared/gadgets";

type CompanyBlueprintState = {
  blueprintId: string;
  status: BlueprintStatus;
  progressHours: number;
  startedAt?: number;
  completedAt?: number;
};

type ProducedGadget = {
  id: string;
  blueprintId: string;
  companyId: string;
  name: string;
  category: string;
  stats: Record<string, number>;
  quality: number;
  minPrice: number;
  maxPrice: number;
  durability: number;
  maxDurability: number;
  producedAt: number;
};

type MarketListing = {
  id: string;
  gadgetId: string;
  companyId: string;
  companyName: string;
  sellerUserId: string;
  saleType: "fixed" | "auction";
  price?: number;
  startingPrice?: number;
  currentBid?: number;
  currentBidderId?: string;
  auctionEndsAt?: number;
  minIncrement?: number;
  status: "active" | "sold" | "expired";
  salePrice?: number;
  createdAt: number;
  sold: boolean;
};

type CityContractStatus = "open" | "in_progress" | "completed";

type CityContract = {
  id: string;
  city: string;
  title: string;
  customer: string;
  category: string;
  requiredQuantity: number;
  minQuality: number;
  rewardMoney: number;
  rewardOrk: number;
  expiresAt: number;
  status: CityContractStatus;
  assignedCompanyId?: string;
  completedAt?: number;
};

const companyBlueprints = new Map<string, CompanyBlueprintState>();
const companyGadgets = new Map<string, ProducedGadget[]>();
const marketListings: MarketListing[] = [];
const cityContracts = new Map<string, CityContract[]>();
const MARKET_FEE_RATE = 0.08;

const PASSIVE_INCOME = {
  tier1: { referrals: 1, percentage: 0.5, cap: 100 },
  tier2: { referrals: 5, percentage: 1.0, cap: 300 },
  tier3: { referrals: 10, percentage: 1.5, cap: 600 },
  tier4: { referrals: 25, percentage: 2.0, cap: 1000 },
  tier5: { referrals: 50, percentage: 3.0, cap: 2000 },
} as const;

const userReferralCodes = new Map<string, string>();
const referralCodeToUserId = new Map<string, string>();
const referredByUserId = new Map<string, string>();
const referralChildrenByUserId = new Map<string, Set<string>>();
const referralClaimHistory = new Map<string, Set<string>>();

const telegramIdToUserId = new Map<string, string>();
const deviceRegistrationTimestamps = new Map<string, number[]>();
const ipRegistrationTimestamps = new Map<string, number[]>();


type TelegramAuthUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

function parseTelegramInitData(initDataRaw: string) {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) return null;

  const items: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    items.push(`${key}=${value}`);
  });
  items.sort();

  return {
    hash,
    dataCheckString: items.join("\n"),
    authDate: Number(params.get("auth_date") ?? 0),
    startParam: params.get("start_param") ?? undefined,
    userRaw: params.get("user") ?? undefined,
  };
}

function verifyTelegramInitData(initDataRaw: string, botToken: string) {
  const parsed = parseTelegramInitData(initDataRaw);
  if (!parsed) return { ok: false as const, reason: "hash_missing" };

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(parsed.dataCheckString).digest("hex");

  const expected = Buffer.from(expectedHash, "utf8");
  const actual = Buffer.from(parsed.hash, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false as const, reason: "hash_mismatch" };
  }

  const maxAgeSeconds = 24 * 60 * 60;
  if (!parsed.authDate || Math.floor(Date.now() / 1000) - parsed.authDate > maxAgeSeconds) {
    return { ok: false as const, reason: "auth_expired" };
  }

  return { ok: true as const, parsed };
}

function buildTelegramUsername(user: TelegramAuthUser) {
  if (user.username && user.username.trim().length > 0) {
    return `tg_${user.username.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()}`.slice(0, 30);
  }
  return `tg_${user.id}`;
}

async function generateUniqueUsername(base: string) {
  const normalized = base.slice(0, 28);
  if (!(await storage.usernameExists(normalized))) return normalized;

  for (let i = 0; i < 10; i++) {
    const candidate = `${normalized.slice(0, 24)}_${randomBytes(2).toString("hex")}`;
    if (!(await storage.usernameExists(candidate))) return candidate;
  }

  return `${normalized.slice(0, 20)}_${Date.now().toString(36)}`;
}

function cleanupOldTimestamps(items: number[], now = Date.now()) {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  return items.filter((ts) => ts >= dayAgo);
}

function resolvePassiveTier(referralsCount: number) {
  if (referralsCount >= PASSIVE_INCOME.tier5.referrals) return PASSIVE_INCOME.tier5;
  if (referralsCount >= PASSIVE_INCOME.tier4.referrals) return PASSIVE_INCOME.tier4;
  if (referralsCount >= PASSIVE_INCOME.tier3.referrals) return PASSIVE_INCOME.tier3;
  if (referralsCount >= PASSIVE_INCOME.tier2.referrals) return PASSIVE_INCOME.tier2;
  return PASSIVE_INCOME.tier1;
}

function generateReferralCode(username: string) {
  const normalized = username.replace(/\s+/g, "").toUpperCase().slice(0, 6) || "PLAYER";
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${normalized}-${random}`;
}

const CITY_CONTRACT_TEMPLATES = [
  { title: "Городская цифровизация", customer: "Мэрия", category: "tablets", qty: 2, quality: 1.2, reward: 2200, ork: 1, ttlHours: 48 },
  { title: "Оснащение колл-центра", customer: "Телеком Корп", category: "smartphones", qty: 3, quality: 1.1, reward: 2600, ork: 1, ttlHours: 48 },
  { title: "Поставка для аналитиков", customer: "Data Group", category: "laptops", qty: 2, quality: 1.4, reward: 3600, ork: 2, ttlHours: 72 },
  { title: "Носимые устройства для фитнеса", customer: "HealthLab", category: "smartwatches", qty: 3, quality: 1.25, reward: 2400, ork: 1, ttlHours: 48 },
  { title: "Майнинговый пилот", customer: "EnergyTech", category: "asic_miners", qty: 1, quality: 1.6, reward: 4200, ork: 2, ttlHours: 72 },
] as const;

function buildContractsForCity(city: string): CityContract[] {
  const now = Date.now();
  return CITY_CONTRACT_TEMPLATES.map((template) => ({
    id: randomUUID(),
    city,
    title: template.title,
    customer: template.customer,
    category: template.category,
    requiredQuantity: template.qty,
    minQuality: template.quality,
    rewardMoney: template.reward,
    rewardOrk: template.ork,
    expiresAt: now + template.ttlHours * 60 * 60 * 1000,
    status: "open",
  }));
}

function getContractsByCity(city: string): CityContract[] {
  const existing = cityContracts.get(city) ?? [];
  const now = Date.now();

  const active = existing.filter((contract) => contract.status === "completed" || contract.expiresAt > now);
  const hasOpenContracts = active.some((contract) => contract.status !== "completed");
  if (!hasOpenContracts) {
    const replenished = buildContractsForCity(city);
    cityContracts.set(city, replenished);
    return replenished;
  }

  cityContracts.set(city, active);
  return active;
}

function removeProducedGadget(companyId: string, gadgetId: string): ProducedGadget | null {
  const produced = companyGadgets.get(companyId) ?? [];
  const index = produced.findIndex((gadget) => gadget.id === gadgetId);
  if (index < 0) return null;
  const [removed] = produced.splice(index, 1);
  companyGadgets.set(companyId, produced);
  return removed;
}

async function settleExpiredAuctions() {
  const now = Date.now();
  for (const listing of marketListings) {
    if (listing.saleType !== "auction" || listing.status !== "active" || !listing.auctionEndsAt) continue;
    if (listing.auctionEndsAt > now) continue;

    if (!listing.currentBid || !listing.currentBidderId) {
      listing.status = "expired";
      continue;
    }

    const buyer = await storage.getUser(listing.currentBidderId);
    const company = await storage.getCompany(listing.companyId);
    if (!buyer || !company || buyer.balance < listing.currentBid) {
      listing.status = "expired";
      continue;
    }

    const netIncome = Math.floor(listing.currentBid * (1 - MARKET_FEE_RATE));
    await storage.updateUser(buyer.id, { balance: buyer.balance - listing.currentBid });
    await storage.updateCompany(company.id, { balance: company.balance + netIncome });
    removeProducedGadget(listing.companyId, listing.gadgetId);

    listing.status = "sold";
    listing.sold = true;
    listing.salePrice = listing.currentBid;
  }
}

const LEVEL_REQUIREMENTS = [
  { level: 1, ork: 0, cost: 1000, minPlayers: 1, warehouse: 50 },
  { level: 2, ork: 100, cost: 2000, minPlayers: 1, warehouse: 100 },
  { level: 3, ork: 250, cost: 5000, minPlayers: 1, warehouse: 120 },
  { level: 4, ork: 450, cost: 10000, minPlayers: 1, warehouse: 150 },
  { level: 5, ork: 700, cost: 20000, minPlayers: 1, warehouse: 200 },
  { level: 6, ork: 1000, cost: 35000, minPlayers: 1, warehouse: 250 },
  { level: 7, ork: 1400, cost: 60000, minPlayers: 1, warehouse: 300 },
  { level: 8, ork: 1900, cost: 100000, minPlayers: 1, warehouse: 350 },
  { level: 9, ork: 2500, cost: 160000, minPlayers: 1, warehouse: 400 },
  { level: 10, ork: 3200, cost: 250000, minPlayers: 1, warehouse: 500 },
];

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ✅ РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
  app.post("/api/register", async (req, res) => {
    try {
      const { referralCode, deviceFingerprint, telegramId } = req.body ?? {};
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();

      if (typeof telegramId === "string" && telegramId.trim().length > 0) {
        if (telegramIdToUserId.has(telegramId)) {
          return res.status(409).json({ error: "Этот Telegram аккаунт уже зарегистрирован" });
        }
      }

      if (typeof deviceFingerprint === "string" && deviceFingerprint.trim().length > 0) {
        const existing = cleanupOldTimestamps(deviceRegistrationTimestamps.get(deviceFingerprint) ?? [], now);
        if (existing.length >= 1) {
          return res.status(429).json({ error: "С этого устройства уже создан аккаунт за последние 24 часа" });
        }
        if ((deviceRegistrationTimestamps.get(deviceFingerprint) ?? []).length >= 2) {
          return res.status(429).json({ error: "Превышен лимит аккаунтов для устройства" });
        }
      }

      const ipHistory = cleanupOldTimestamps(ipRegistrationTimestamps.get(ip) ?? [], now);
      if (ipHistory.length >= 3) {
        return res.status(429).json({ error: "Слишком много регистраций с этого IP за сутки" });
      }

      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data" });
      }

      const exists = await storage.usernameExists(parsed.data.username);
      if (exists) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const user = await storage.createUser(parsed.data);

      const code = generateReferralCode(user.username);
      userReferralCodes.set(user.id, code);
      referralCodeToUserId.set(code, user.id);

      if (typeof referralCode === "string" && referralCode.trim().length > 0) {
        const referrerId = referralCodeToUserId.get(referralCode.trim());
        if (referrerId && referrerId !== user.id) {
          referredByUserId.set(user.id, referrerId);
          const children = referralChildrenByUserId.get(referrerId) ?? new Set<string>();
          children.add(user.id);
          referralChildrenByUserId.set(referrerId, children);

          const referrer = await storage.getUser(referrerId);
          if (referrer) {
            await storage.updateUser(referrer.id, { balance: referrer.balance + 200 });
          }
          await storage.updateUser(user.id, { balance: user.balance + 100 });
          user.balance += 100;
        }
      }

      if (typeof telegramId === "string" && telegramId.trim().length > 0) {
        telegramIdToUserId.set(telegramId, user.id);
      }
      if (typeof deviceFingerprint === "string" && deviceFingerprint.trim().length > 0) {
        const history = deviceRegistrationTimestamps.get(deviceFingerprint) ?? [];
        history.push(now);
        deviceRegistrationTimestamps.set(deviceFingerprint, history);
      }
      ipHistory.push(now);
      ipRegistrationTimestamps.set(ip, ipHistory);

      const { password, ...safeUser } = user;
      res.status(201).json({ ...safeUser, referralCode: code });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ✅ ПРОВЕРКА НИКА
  app.get("/api/check-username/:username", async (req, res) => {
    const exists = await storage.usernameExists(req.params.username);
    res.json({ exists, available: !exists });
  });

  app.post("/api/telegram/auth", async (req, res) => {
    try {
      const initData = typeof req.body?.initData === "string" ? req.body.initData : "";
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      let telegramUser: TelegramAuthUser | null = null;
      let startParam: string | undefined;

      if (initData && botToken) {
        const verified = verifyTelegramInitData(initData, botToken);
        if (!verified.ok) {
          return res.status(401).json({ error: "Invalid Telegram initData", code: verified.reason });
        }

        startParam = verified.parsed.startParam;
        if (verified.parsed.userRaw) {
          telegramUser = JSON.parse(verified.parsed.userRaw) as TelegramAuthUser;
        }
      } else if (req.body?.user && typeof req.body.user.id === "number") {
        telegramUser = req.body.user as TelegramAuthUser;
        startParam = typeof req.body?.startParam === "string" ? req.body.startParam : undefined;
      }

      if (!telegramUser || typeof telegramUser.id !== "number") {
        return res.status(400).json({ error: "Telegram user is required" });
      }

      const telegramId = String(telegramUser.id);
      const mappedUserId = telegramIdToUserId.get(telegramId);
      if (mappedUserId) {
        const mappedUser = await storage.getUser(mappedUserId);
        if (mappedUser) {
          const { password, ...safeUser } = mappedUser;
          return res.json({ ...safeUser, isNewUser: false });
        }
      }

      const baseUsername = buildTelegramUsername(telegramUser);
      const existingByBase = await storage.getUserByUsername(baseUsername);
      if (existingByBase) {
        telegramIdToUserId.set(telegramId, existingByBase.id);
        const { password, ...safeUser } = existingByBase;
        return res.json({ ...safeUser, isNewUser: false });
      }

      const username = await generateUniqueUsername(baseUsername);
      const created = await storage.createUser({
        username,
        password: `tg_${randomUUID()}`,
        city: "Санкт-Петербург",
        personality: "workaholic",
        gender: "male",
      });

      const code = generateReferralCode(created.username);
      userReferralCodes.set(created.id, code);
      referralCodeToUserId.set(code, created.id);
      telegramIdToUserId.set(telegramId, created.id);

      const referralCode = startParam?.startsWith("ref_") ? startParam.slice(4) : undefined;
      if (referralCode) {
        const referrerId = referralCodeToUserId.get(referralCode.trim());
        if (referrerId && referrerId !== created.id) {
          referredByUserId.set(created.id, referrerId);
          const children = referralChildrenByUserId.get(referrerId) ?? new Set<string>();
          children.add(created.id);
          referralChildrenByUserId.set(referrerId, children);

          const referrer = await storage.getUser(referrerId);
          if (referrer) {
            await storage.updateUser(referrer.id, { balance: referrer.balance + 200 });
          }
          await storage.updateUser(created.id, { balance: created.balance + 100 });
          created.balance += 100;
        }
      }

      const { password, ...safeUser } = created;
      res.status(201).json({ ...safeUser, isNewUser: true, referralCode: code });
    } catch (error) {
      console.error("Telegram auth failed:", error);
      res.status(500).json({ error: "Telegram auth failed" });
    }
  });

  app.get("/api/referrals/:userId", async (req, res) => {
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const referrals = Array.from(referralChildrenByUserId.get(user.id) ?? []);
    const referralUsers = (await Promise.all(referrals.map((id) => storage.getUser(id)))).filter(Boolean) as any[];
    const tier = resolvePassiveTier(referrals.length);
    const estimatedRaw = referralUsers.reduce((sum, refUser) => sum + refUser.balance * (tier.percentage / 100), 0);
    const estimatedTodayIncome = Math.min(tier.cap, Math.floor(estimatedRaw));

    res.json({
      referralCode: userReferralCodes.get(user.id) ?? null,
      referredBy: referredByUserId.get(user.id) ?? null,
      referralsCount: referrals.length,
      tier,
      estimatedTodayIncome,
      passiveIncomeConfig: PASSIVE_INCOME,
      referrals: referralUsers.map((u) => ({ id: u.id, username: u.username, level: u.level, balance: u.balance })),
    });
  });

  app.post("/api/referrals/:userId/claim", async (req, res) => {
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const dayKey = new Date().toISOString().slice(0, 10);
    const claimedDays = referralClaimHistory.get(user.id) ?? new Set<string>();
    if (claimedDays.has(dayKey)) {
      return res.status(400).json({ error: "Пассивный доход уже получен сегодня" });
    }

    const referrals = Array.from(referralChildrenByUserId.get(user.id) ?? []);
    const referralUsers = (await Promise.all(referrals.map((id) => storage.getUser(id)))).filter(Boolean) as any[];
    if (referralUsers.length === 0) {
      return res.status(400).json({ error: "Нет рефералов для начисления" });
    }

    const tier = resolvePassiveTier(referralUsers.length);
    const rawIncome = referralUsers.reduce((sum, refUser) => sum + refUser.balance * (tier.percentage / 100), 0);
    const payout = Math.min(tier.cap, Math.floor(rawIncome));
    if (payout <= 0) {
      return res.status(400).json({ error: "Нет доступного пассивного дохода" });
    }

    const updated = await storage.updateUser(user.id, { balance: user.balance + payout });
    claimedDays.add(dayKey);
    referralClaimHistory.set(user.id, claimedDays);

    const { password, ...safeUser } = updated;
    res.json({ ok: true, payout, tier, user: safeUser });
  });

  // ✅ ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  // ✅ СОХРАНЕНИЕ ПРОГРЕССА ПОЛЬЗОВАТЕЛЯ
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body ?? {};
      const updated = await storage.updateUser(req.params.id, {
        level: typeof updates.level === "number" ? updates.level : undefined,
        experience: typeof updates.experience === "number" ? updates.experience : undefined,
        balance: typeof updates.balance === "number" ? updates.balance : undefined,
        reputation: typeof updates.reputation === "number" ? updates.reputation : undefined,
        city: typeof updates.city === "string" ? updates.city : undefined,
        personality: typeof updates.personality === "string" ? updates.personality : undefined,
        gender: typeof updates.gender === "string" ? updates.gender : undefined,
      });

      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ✅ ГЛОБАЛЬНЫЙ РЕЙТИНГ ИГРОКОВ
  app.get("/api/leaderboard/players", async (req, res) => {
    try {
      const sort = String(req.query.sort ?? "level");
      const users = await storage.getUsers();

      const sorted = [...users].sort((a, b) => {
        if (sort === "reputation") return b.reputation - a.reputation;
        if (sort === "wealth") return b.balance - a.balance;
        return b.level - a.level;
      });

      res.json(sorted.slice(0, 50).map(({ password, ...u }) => u));
    } catch (error) {
      console.error("Failed to load players leaderboard:", error);
      res.status(500).json({ error: "Failed to load players leaderboard" });
    }
  });

  // ✅ ГЛОБАЛЬНЫЙ РЕЙТИНГ КОМПАНИЙ
  app.get("/api/leaderboard/companies", async (req, res) => {
    try {
      const sort = String(req.query.sort ?? "level");
      const companies = await storage.getAllCompanies();

      const sorted = [...companies].sort((a, b) => {
        if (sort === "wealth") return b.balance - a.balance;
        if (sort === "blueprints") return b.ork - a.ork;
        return b.level - a.level;
      });

      res.json(
        sorted.slice(0, 50).map((c) => ({
          ...c,
          developedBlueprints: c.ork,
        }))
      );
    } catch (error) {
      console.error("Failed to load companies leaderboard:", error);
      res.status(500).json({ error: "Failed to load companies leaderboard" });
    }
  });

  // ✅ СОЗДАНИЕ КОМПАНИИ
  app.post("/api/company", async (req, res) => {
    try {
      const { name, ownerId, username, city } = req.body;
      console.log("🏢 Creating company:", { name, ownerId, username, city });

      const company = await storage.createCompany({ name, city }, ownerId, username);
      console.log("✅ Company created:", company.id);
      res.json(company);
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // ✅ ПОЛУЧЕНИЕ ВСЕХ КОМПАНИЙ
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Get all companies error:", error);
      res.status(500).json({ error: "Failed to get companies" });
    }
  });

  // ✅ ПОЛУЧЕНИЕ КОМПАНИЙ ПО ГОРОДУ
  app.get("/api/companies/city/:city", async (req, res) => {
    try {
      const companies = await storage.getCompaniesByCity(req.params.city);
      res.json(companies);
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Failed to get companies" });
    }
  });

  // ✅ ПОЛУЧЕНИЕ КОМПАНИИ ПО ID
  app.get("/api/companies/:id", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to get company" });
    }
  });

  app.post("/api/companies/:id/join", async (req, res) => {
    try {
      const { userId, username } = req.body;
      const request = await storage.createJoinRequest({
        companyId: req.params.id,
        userId,
        username,
      });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to create join request" });
    }
  });

  app.get("/api/companies/:id/requests", async (req, res) => {
    try {
      const requests = await storage.getJoinRequestsByCompany(req.params.id);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to get join requests" });
    }
  });

  app.post("/api/companies/requests/:id/respond", async (req, res) => {
    try {
      const { status, companyId, userId, username } = req.body;
      await storage.updateJoinRequestStatus(req.params.id, status);

      if (status === "accepted") {
        await storage.addCompanyMember({
          companyId,
          userId,
          username,
          role: "member",
        });
      }

      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to respond to request" });
    }
  });

  app.post("/api/companies/:id/leave", async (req, res) => {
    try {
      const { userId } = req.body;
      await storage.removeCompanyMember(req.params.id, userId);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to leave company" });
    }
  });

  app.post("/api/company/:id/upgrade", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).send("Company not found");

      const nextLevel = company.level + 1;
      const reqs = LEVEL_REQUIREMENTS.find(r => r.level === nextLevel);

      if (!reqs) return res.status(400).send("Max level reached");

      const members = await storage.getCompanyMembers(company.id);
      const memberCount = members.length || 1;

      if (company.ork < reqs.ork) return res.status(400).send(`Need ${reqs.ork} ORK`);
      if (company.balance < reqs.cost) return res.status(400).send(`Need ${reqs.cost} balance`);
      if (memberCount < 1) return res.status(400).send(`Need 1 player`);

      const updated = await storage.updateCompany(company.id, {
        level: nextLevel,
        balance: company.balance - reqs.cost,
        warehouseCapacity: reqs.warehouse,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to upgrade company" });
    }
  });

  app.post("/api/company/:id/expand-warehouse", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).send("Company not found");

      const capacity = Number(company.warehouseCapacity) || 50;
      if (company.level === 1 && capacity < 100) {
        const cost = 1000;
        if (company.balance < cost) return res.status(400).send("Not enough balance");

        const updated = await storage.updateCompany(company.id, {
          balance: company.balance - cost,
          warehouseCapacity: 100
        });
        return res.json(updated);
      }

      res.status(400).send("Expansion not available");
    } catch (error) {
      res.status(500).json({ error: "Failed to expand warehouse" });
    }
  });

  app.get("/api/companies/:id/blueprints", async (req, res) => {
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const current = companyBlueprints.get(company.id);
    res.json({
      available: getAvailableBlueprints(company.level),
      active: current ?? null,
      produced: companyGadgets.get(company.id) ?? [],
    });
  });

  app.post("/api/companies/:id/blueprints/start", async (req, res) => {
    const { userId, blueprintId } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can start blueprint" });

    const blueprint = GADGET_BLUEPRINTS.find((b) => b.id === blueprintId);
    if (!blueprint) return res.status(404).json({ error: "Blueprint not found" });

    companyBlueprints.set(company.id, {
      blueprintId,
      status: "in_progress",
      progressHours: 0,
      startedAt: Date.now(),
    });

    res.json(companyBlueprints.get(company.id));
  });

  app.post("/api/companies/:id/blueprints/progress", async (req, res) => {
    const { userId, hours = 24 } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can progress blueprint" });

    const state = companyBlueprints.get(company.id);
    if (!state) return res.status(400).json({ error: "No active blueprint" });

    const blueprint = GADGET_BLUEPRINTS.find((b) => b.id === state.blueprintId);
    if (!blueprint) return res.status(404).json({ error: "Blueprint not found" });

    state.progressHours += Number(hours);
    if (state.progressHours >= blueprint.time) {
      state.status = "production_ready";
      state.completedAt = Date.now();
      const updated = await storage.updateCompany(company.id, { ork: company.ork + 1 });
      return res.json({ ...state, company: updated });
    }

    return res.json(state);
  });

  app.post("/api/companies/:id/produce", async (req, res) => {
    const { userId, parts = [] } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can produce gadgets" });

    const state = companyBlueprints.get(company.id);
    if (!state || state.status !== "production_ready") {
      return res.status(400).json({ error: "Blueprint not ready" });
    }

    const blueprint = GADGET_BLUEPRINTS.find((b) => b.id === state.blueprintId);
    if (!blueprint) return res.status(404).json({ error: "Blueprint not found" });

    const reqParts = blueprint.production.parts;
    for (const [partType, quantity] of Object.entries(reqParts)) {
      const found = parts.filter((p: any) => p.type === partType).length;
      if (found < quantity) return res.status(400).json({ error: `Недостаточно деталей типа ${partType}` });
    }

    const quality = parts.length
      ? parts.reduce((sum: number, p: any) => sum + (RARITY_QUALITY_MULTIPLIERS[p.rarity as keyof typeof RARITY_QUALITY_MULTIPLIERS] ?? 1), 0) / parts.length
      : 1;

    const stats = Object.fromEntries(
      Object.entries(blueprint.baseStats).map(([k, v]) => [k, Number((v * quality).toFixed(2))])
    );

    const basePrice = blueprint.production.costGram * 10;
    const gadget: ProducedGadget = {
      id: randomUUID(),
      blueprintId: blueprint.id,
      companyId: company.id,
      name: blueprint.name,
      category: blueprint.category,
      stats,
      quality: Number(quality.toFixed(2)),
      minPrice: Math.round(basePrice * quality * 0.9),
      maxPrice: Math.round(basePrice * quality * 1.4),
      durability: 100,
      maxDurability: 100,
      producedAt: Date.now(),
    };

    const produced = companyGadgets.get(company.id) ?? [];
    produced.push(gadget);
    companyGadgets.set(company.id, produced);

    res.json(gadget);
  });

  app.post("/api/companies/:id/market/list", async (req, res) => {
    const { userId, gadgetId, price, mode = "fixed", durationHours = 2 } = req.body ?? {};
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.ownerId !== userId) return res.status(403).json({ error: "Only CEO can create listings" });

    const produced = companyGadgets.get(company.id) ?? [];
    const gadget = produced.find((g) => g.id === gadgetId);
    if (!gadget) return res.status(404).json({ error: "Gadget not found" });
    if (mode !== "fixed" && mode !== "auction") {
      return res.status(400).json({ error: "mode должен быть fixed или auction" });
    }

    if (mode === "auction" && gadget.quality < 2) {
      return res.status(400).json({ error: "Аукцион доступен только для редких гаджетов (quality >= 2.0)" });
    }

    if (price < gadget.minPrice || price > gadget.maxPrice) {
      return res.status(400).json({ error: `Цена/стартовая цена должна быть в диапазоне ${gadget.minPrice}-${gadget.maxPrice}` });
    }

    const normalizedDuration = Math.max(2, Math.min(12, Number(durationHours) || 2));

    const listing: MarketListing = {
      id: randomUUID(),
      gadgetId,
      companyId: company.id,
      companyName: company.name,
      sellerUserId: userId,
      saleType: mode,
      price: mode === "fixed" ? price : undefined,
      startingPrice: mode === "auction" ? price : undefined,
      currentBid: mode === "auction" ? price : undefined,
      currentBidderId: undefined,
      auctionEndsAt: mode === "auction" ? Date.now() + normalizedDuration * 60 * 60 * 1000 : undefined,
      minIncrement: mode === "auction" ? Math.max(10, Math.floor(price * 0.05)) : undefined,
      status: "active",
      createdAt: Date.now(),
      sold: false,
    };

    marketListings.unshift(listing);
    res.json(listing);
  });

  app.get("/api/market", async (_req, res) => {
    await settleExpiredAuctions();
    const enriched = marketListings
      .filter((l) => l.status === "active")
      .map((listing) => {
        const gadget = Array.from(companyGadgets.values()).flat().find((g) => g.id === listing.gadgetId);
        return { ...listing, gadget };
      });

    res.json(enriched);
  });

  app.post("/api/market/buy", async (req, res) => {
    await settleExpiredAuctions();
    const { listingId, buyerId } = req.body ?? {};
    const listing = marketListings.find((l) => l.id === listingId && l.status === "active");
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.saleType !== "fixed" || !listing.price) {
      return res.status(400).json({ error: "Этот лот продается через аукцион" });
    }

    const buyer = await storage.getUser(buyerId);
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });
    if (buyer.balance < listing.price) return res.status(400).json({ error: "Недостаточно средств" });

    const company = await storage.getCompany(listing.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const netIncome = Math.floor(listing.price * (1 - MARKET_FEE_RATE));
    const fee = listing.price - netIncome;
    await storage.updateUser(buyer.id, { balance: buyer.balance - listing.price });
    await storage.updateCompany(company.id, { balance: company.balance + netIncome });
    const purchasedGadget = removeProducedGadget(listing.companyId, listing.gadgetId);
    listing.status = "sold";
    listing.sold = true;
    listing.salePrice = listing.price;

    res.json({ ok: true, fee, netIncome, purchasedGadget });
  });

  app.post("/api/market/bid", async (req, res) => {
    await settleExpiredAuctions();
    const { listingId, bidderId, amount } = req.body ?? {};
    const listing = marketListings.find((l) => l.id === listingId && l.status === "active");
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.saleType !== "auction") return res.status(400).json({ error: "Ставки доступны только для аукциона" });
    if (!listing.auctionEndsAt || listing.auctionEndsAt <= Date.now()) return res.status(400).json({ error: "Аукцион завершен" });

    const bidder = await storage.getUser(bidderId);
    if (!bidder) return res.status(404).json({ error: "Bidder not found" });

    const minNext = (listing.currentBid ?? listing.startingPrice ?? 0) + (listing.minIncrement ?? 10);
    if (Number(amount) < minNext) {
      return res.status(400).json({ error: `Минимальная ставка: ${minNext}` });
    }

    if (bidder.balance < Number(amount)) {
      return res.status(400).json({ error: "Недостаточно средств для ставки" });
    }

    listing.currentBid = Number(amount);
    listing.currentBidderId = bidderId;

    res.json({ ok: true, listing });
  });

  app.get("/api/city-contracts/:city", async (req, res) => {
    const contracts = getContractsByCity(req.params.city);
    res.json(contracts);
  });

  app.post("/api/city-contracts/:contractId/accept", async (req, res) => {
    const { userId, companyId } = req.body ?? {};
    if (!userId || !companyId) return res.status(400).json({ error: "userId и companyId обязательны" });

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const membership = await storage.getMemberByUserId(companyId, userId);
    if (!membership) return res.status(403).json({ error: "Только участник компании может принять контракт" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "Контракт не найден" });
    if (contract.status === "completed") return res.status(400).json({ error: "Контракт уже завершен" });
    if (contract.assignedCompanyId && contract.assignedCompanyId !== companyId) {
      return res.status(400).json({ error: "Контракт уже принят другой компанией" });
    }

    contract.status = "in_progress";
    contract.assignedCompanyId = companyId;
    res.json(contract);
  });

  app.post("/api/city-contracts/:contractId/deliver", async (req, res) => {
    const { userId, companyId } = req.body ?? {};
    if (!userId || !companyId) return res.status(400).json({ error: "userId и companyId обязательны" });

    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const membership = await storage.getMemberByUserId(companyId, userId);
    if (!membership) return res.status(403).json({ error: "Только участник компании может сдавать контракт" });

    const contracts = getContractsByCity(company.city);
    const contract = contracts.find((item) => item.id === req.params.contractId);
    if (!contract) return res.status(404).json({ error: "Контракт не найден" });
    if (contract.assignedCompanyId !== companyId) return res.status(400).json({ error: "Контракт не закреплен за вашей компанией" });
    if (contract.status === "completed") return res.status(400).json({ error: "Контракт уже завершен" });

    const produced = companyGadgets.get(company.id) ?? [];
    const listedIds = new Set(
      marketListings.filter((listing) => listing.status === "active").map((listing) => listing.gadgetId)
    );
    const eligible = produced.filter(
      (gadget) =>
        gadget.category === contract.category &&
        gadget.quality >= contract.minQuality &&
        !listedIds.has(gadget.id)
    );

    if (eligible.length < contract.requiredQuantity) {
      return res.status(400).json({
        error: `Нужно ${contract.requiredQuantity} гаджет(ов) категории ${contract.category} с качеством от ${contract.minQuality}`,
      });
    }

    const selectedIds = new Set(eligible.slice(0, contract.requiredQuantity).map((gadget) => gadget.id));
    const left = produced.filter((gadget) => !selectedIds.has(gadget.id));
    companyGadgets.set(company.id, left);

    contract.status = "completed";
    contract.completedAt = Date.now();

    const updatedCompany = await storage.updateCompany(company.id, {
      balance: company.balance + contract.rewardMoney,
      ork: company.ork + contract.rewardOrk,
    });

    res.json({
      contract,
      consumedGadgets: Array.from(selectedIds),
      company: updatedCompany,
    });
  });

  app.get("/api/messages", async (req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const message = await storage.createMessage(parsed.data);
    res.json(message);
  });

  app.post("/api/admin/reset-db", async (req, res) => {
    try {
      await storage.resetAllData();
      res.sendStatus(200);
    } catch (e) {
      res.status(500).send("Failed to reset database");
    }
  });

  return httpServer;
}
