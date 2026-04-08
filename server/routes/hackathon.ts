import type { Express } from "express";
import type { storage as storageType } from "../storage";

type HackathonRouteDeps = {
  storage: typeof storageType;
  getWeeklyHackathonState: () => any;
  formatWeeklyHackathonTop: (limit?: number) => any;
  getHackathonRoundView: () => any;
  getWeeklyHackathonPlayerStats: (userId: string, companyId: string) => any;
  getWeeklyHackathonCompanyScore: (companyId: string) => any;
  getWeeklyHackathonSabotageState: (companyId?: string) => any;
  WEEKLY_HACKATHON_CONFIG: any;
  registerCompanyForWeeklyHackathon: (input: any) => any;
  resolvePlayerCompanyMembership: (userId: string) => Promise<any | null>;
  validateHackathonEligibility: (input: any) => { ok: boolean; reasons: string[] };
  joinPlayerToWeeklyHackathonTeam: (input: any) => any;
  getUserWithGameState: (userId: string) => Promise<any | null>;
  getEffectiveCompanyDepartmentEffects: (company: any) => Promise<any>;
  applyGameStatePatch: (userId: string, patch: Record<string, unknown>) => void;
  contributeSkillToWeeklyHackathon: (input: any) => any;
  spendGram: (userId: string, amount: number, reason: string) => Promise<any>;
  contributeGrmToWeeklyHackathon: (input: any) => any;
  ALL_PARTS: Record<string, any>;
  HACKATHON_ALLOWED_PART_TYPES: Set<string>;
  contributePartToWeeklyHackathon: (input: any) => any;
  isCompanyHackathonManagerRole: (role: string, ownerId: string | null | undefined, actorUserId: string) => boolean;
  getRegisteredHackathonCompany: (companyId: string) => any;
  upgradeWeeklyHackathonSabotageLevel: (companyId: string) => any;
  upgradeWeeklyHackathonDefenseLevel: (companyId: string) => any;
  getAvailableHackathonSabotageTypes: (companyId: string) => any[];
  getAvailableHackathonDefenseTypes: (companyId: string) => any[];
  applyWeeklyHackathonSabotage: (input: any) => any;
  applyWeeklyHackathonDefense: (input: any) => any;
  recordCompanyHackathonParticipation?: (companyId: string) => void;
  recordCompanyTaskContribution?: (input: any) => any;
  recordCompanyMoneyContribution?: (input: any) => any;
  recordCompanyPartsContribution?: (input: any) => any;
};

function listAvailableByLevel(map: Record<string, any>, level: number) {
  return Object.entries(map)
    .filter(([, config]) => Number(config?.level || 0) <= level)
    .map(([type, config]) => ({ type, ...config }));
}

export function registerHackathonRoutes(app: Express, deps: HackathonRouteDeps) {
  app.get("/api/hackathon", async (req, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "";
    const snapshot = deps.getWeeklyHackathonState();
    res.json({
      ...snapshot,
      topCompanies: deps.formatWeeklyHackathonTop(10),
      liveRound: deps.getHackathonRoundView(),
      playerStats: userId && companyId ? deps.getWeeklyHackathonPlayerStats(userId, companyId) : null,
      companyScore: companyId ? deps.getWeeklyHackathonCompanyScore(companyId) : null,
      sabotage: deps.getWeeklyHackathonSabotageState(companyId || undefined),
      config: {
        registrationCostGrm: deps.WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
        maxParticipantsPerCompany: deps.WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany,
        registrationWindowMs: deps.WEEKLY_HACKATHON_CONFIG.registrationWindowMs,
        roundDurationMs: deps.WEEKLY_HACKATHON_CONFIG.roundDurationMs,
        tickMs: deps.WEEKLY_HACKATHON_CONFIG.tickMs,
        eligibility: deps.WEEKLY_HACKATHON_CONFIG.eligibility,
      },
    });
  });

  app.post("/api/hackathon/register-company", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const companyId = String(req.body?.companyId || "");
      if (!userId || !companyId) return res.status(400).json({ error: "userId и companyId обязательны" });

      const company = await deps.storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Компания не найдена" });
      if (company.ownerId !== userId) return res.status(403).json({ error: "Зарегистрировать компанию может только CEO" });
      if (Number(company.level || 0) < 1) return res.status(400).json({ error: "Компания должна быть минимум 1 уровня" });
      if (Number(company.balance || 0) < deps.WEEKLY_HACKATHON_CONFIG.registrationCostGrm) {
        return res.status(400).json({ error: `Недостаточно GRM на балансе компании. Нужно ${deps.WEEKLY_HACKATHON_CONFIG.registrationCostGrm}` });
      }

      await deps.storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - deps.WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
      });

      const rndLevel = Math.max(0, Math.floor(Number(company.ork || 0) / 100));
      const entry = deps.registerCompanyForWeeklyHackathon({
        companyId: company.id,
        companyName: company.name,
        city: company.city,
        companyLevel: company.level,
        rndLevel,
        companyEmoji: null,
        startedByUserId: userId,
        sabotageLevel: Number(company.sabotageLevel || 0),
        defenseLevel: Number(company.defenseLevel || 0),
      });
      deps.recordCompanyHackathonParticipation?.(company.id);
      res.json({ ok: true, entry, state: deps.getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось зарегистрировать компанию" });
    }
  });

  app.post("/api/hackathon/join-team", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "Игрок не найден" });
      const member = await deps.storage.getMemberByUserId(membership.company.id, userId);
      const recentPvpLogs = await deps.storage.getPvpDuelHistoryByUser(userId, 200);
      const recentSinceSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      const eligibility = deps.validateHackathonEligibility({
        membershipCreatedAt: Number(member?.createdAt || 0) || null,
        level: Number(user.level || 1),
        totalPvpBattles: Number(user.pvpMatches || 0),
        recentPvpBattles7d: recentPvpLogs.filter((row: any) => Number(row.createdAt || 0) >= recentSinceSec).length,
      });
      if (!eligibility.ok) {
        return res.status(400).json({
          error: eligibility.reasons[0] || "Игрок не проходит условия участия",
          reasons: eligibility.reasons,
          eligibility,
        });
      }
      const joined = deps.joinPlayerToWeeklyHackathonTeam({
        userId,
        username: String(user.username || "Игрок"),
        companyId: membership.company.id,
      });
      res.json({ ok: true, joined, state: deps.getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось записаться в состав" });
    }
  });

  app.post("/api/hackathon/contribute/skill", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });

      const snapshot = await deps.getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "Игрок не найден" });
      const { effects: departmentEffects } = await deps.getEffectiveCompanyDepartmentEffects(membership.company);
      const game = snapshot.game as any;
      const workTime = Number(game.workTime || 0);
      if (workTime < deps.WEEKLY_HACKATHON_CONFIG.skillEnergyCost) {
        return res.status(400).json({ error: `Недостаточно энергии. Нужно ${Math.round(deps.WEEKLY_HACKATHON_CONFIG.skillEnergyCost * 100)}%` });
      }

      const result = deps.contributeSkillToWeeklyHackathon({
        userId,
        companyId: membership.company.id,
        skills: {
          coding: Number(game.skills?.coding || 0),
          analytics: Number(game.skills?.analytics || 0),
          design: Number(game.skills?.design || 0),
          testing: Number(game.skills?.testing || 0),
        },
        multiplier: departmentEffects.hackathonSkillMultiplier,
      });
      deps.recordCompanyTaskContribution?.({
        companyId: membership.company.id,
        userId,
        username: String(snapshot.user?.username || "Игрок"),
        taskId: `hackathon:${String(deps.getWeeklyHackathonState()?.eventId || "current")}`,
        source: "hackathon_skill",
        skillType: result?.skillType || "coding",
        value: Number(result?.contribution || 0),
        professionBonus: 1,
        departmentEfficiency: Number(departmentEffects.hackathonSkillMultiplier || 1),
        randomMultiplier: 1,
      });
      deps.applyGameStatePatch(userId, {
        workTime: Math.max(0, Number((workTime - deps.WEEKLY_HACKATHON_CONFIG.skillEnergyCost).toFixed(4))),
      });
      res.json({ ok: true, ...result, state: deps.getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось внести вклад навыками" });
    }
  });

  app.post("/api/hackathon/contribute/grm", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const amount = Math.floor(Number(req.body?.amount || 0));
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });

      const payment = await deps.spendGram(userId, amount, `Weekly Hackathon вклад ${amount} GRM`);
      const result = deps.contributeGrmToWeeklyHackathon({
        userId,
        companyId: membership.company.id,
        amount,
      });
      deps.recordCompanyMoneyContribution?.({
        companyId: membership.company.id,
        userId,
        username: String((await deps.storage.getUser(userId))?.username || "Игрок"),
        amount,
        source: "hackathon_money",
      });
      res.json({ ok: true, ...result, gramBalance: payment.state.gramBalance, state: deps.getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось внести GRM-вклад" });
    }
  });

  app.post("/api/hackathon/contribute/part", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const partRef = String(req.body?.partRef || "");
      if (!userId || !partRef) return res.status(400).json({ error: "userId и partRef обязательны" });
      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });

      const snapshot = await deps.getUserWithGameState(userId);
      if (!snapshot) return res.status(404).json({ error: "Игрок не найден" });
      const game = snapshot.game as any;
      const inventory = Array.isArray(game.inventory) ? [...game.inventory] : [];
      const index = inventory.findIndex((item: any) => item.type === "part" && String(item.id) === partRef);
      if (index < 0) return res.status(400).json({ error: "Деталь не найдена в инвентаре" });

      const inventoryItem = inventory[index];
      const part = deps.ALL_PARTS[String(inventoryItem.id)];
      if (!part) return res.status(400).json({ error: "Справочник детали не найден" });

      const mappedType =
        part.type === "processor" || part.type === "asic_chip"
          ? "CPU"
          : part.type === "memory"
          ? "Memory"
          : part.type === "camera"
          ? "Camera"
          : part.type === "battery" || part.type === "power"
          ? "Battery"
          : part.type === "controller" || part.type === "motherboard"
          ? "Security chip"
          : null;
      if (!mappedType || !deps.HACKATHON_ALLOWED_PART_TYPES.has(mappedType)) {
        return res.status(400).json({ error: "Эта деталь не подходит для хакатона" });
      }

      const result = deps.contributePartToWeeklyHackathon({
        userId,
        companyId: membership.company.id,
        partType: mappedType,
        rarity: String(inventoryItem.rarity || "Common"),
        quantity: 1,
        multiplier: (await deps.getEffectiveCompanyDepartmentEffects(membership.company)).effects.hackathonPartMultiplier,
      });
      deps.recordCompanyPartsContribution?.({
        companyId: membership.company.id,
        userId,
        username: String(snapshot.user?.username || "Игрок"),
        quantity: 1,
        source: "hackathon_part",
      });

      const qty = Math.max(1, Math.floor(Number(inventoryItem.quantity || 1)));
      if (qty <= 1) {
        inventory.splice(index, 1);
      } else {
        inventory[index] = { ...inventoryItem, quantity: qty - 1 };
      }
      deps.applyGameStatePatch(userId, { inventory });
      res.json({ ok: true, ...result, state: deps.getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось внести вклад деталью" });
    }
  });

  app.get("/api/hackathon/sabotage", async (req, res) => {
    try {
      const userId = String(req.query.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });

      const snapshot = deps.getWeeklyHackathonState();
      const companyId = String(membership.company.id);
      const company = await deps.storage.getCompany(companyId);
      const sabotageLevel = Number(company?.sabotageLevel || 0);
      const defenseLevel = Number(company?.defenseLevel || 0);
      const targets = (Array.isArray(snapshot.registeredCompanies) ? snapshot.registeredCompanies : [])
        .filter((row: any) => row.companyId !== companyId)
        .map((row: any) => ({
          companyId: row.companyId,
          companyName: row.companyName,
          city: row.city,
          score: row.score,
          sabotageLevel: Number(row.sabotageLevel || 0),
          defenseLevel: Number(row.defenseLevel || 0),
        }));

      res.json({
        ok: true,
        status: snapshot.status,
        eventId: String(snapshot.eventId || ""),
        companyId,
        role: membership.role,
        canManage: deps.isCompanyHackathonManagerRole(membership.role, membership.company.ownerId, userId),
        sabotageState: deps.getWeeklyHackathonSabotageState(companyId),
        sabotageLevel,
        defenseLevel,
        availableSabotageTypes: listAvailableByLevel(deps.WEEKLY_HACKATHON_CONFIG.sabotageAndDefense.sabotageTypes, sabotageLevel),
        availableDefenseTypes: listAvailableByLevel(deps.WEEKLY_HACKATHON_CONFIG.sabotageAndDefense.defenseTypes, defenseLevel),
        config: deps.WEEKLY_HACKATHON_CONFIG.sabotageAndDefense,
        targets,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось загрузить саботаж" });
    }
  });

  app.post("/api/hackathon/sabotage/upgrade", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      if (!deps.isCompanyHackathonManagerRole(membership.role, membership.company.ownerId, userId)) {
        return res.status(403).json({ error: "Только CEO или заместитель могут управлять саботажем и защитой в хакатоне." });
      }

      const company = await deps.storage.getCompany(String(membership.company.id));
      if (!company) return res.status(404).json({ error: "Компания не найдена" });
      const currentLevel = Math.max(0, Math.floor(Number(company.sabotageLevel || 0)));
      const nextLevel = Math.min(3, currentLevel + 1);
      if (nextLevel === currentLevel) return res.status(400).json({ error: "Саботаж уже прокачан до максимального уровня." });
      const cost = Number(deps.WEEKLY_HACKATHON_CONFIG.sabotageAndDefense.sabotageUpgradeCosts[nextLevel] || 0);
      if (Number(company.balance || 0) < cost) return res.status(400).json({ error: `Недостаточно GRM. Нужно ${cost}.` });

      await deps.storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - cost,
        sabotageLevel: nextLevel,
      });
      if (deps.getRegisteredHackathonCompany(String(company.id))) {
        deps.upgradeWeeklyHackathonSabotageLevel(String(company.id));
      }
      res.json({
        ok: true,
        sabotageLevel: nextLevel,
        balance: Number(company.balance || 0) - cost,
        cost,
        state: deps.getWeeklyHackathonState(),
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось улучшить саботаж" });
    }
  });

  app.post("/api/hackathon/defense/upgrade", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId обязателен" });
      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      if (!deps.isCompanyHackathonManagerRole(membership.role, membership.company.ownerId, userId)) {
        return res.status(403).json({ error: "Только CEO или заместитель могут управлять саботажем и защитой в хакатоне." });
      }

      const company = await deps.storage.getCompany(String(membership.company.id));
      if (!company) return res.status(404).json({ error: "Компания не найдена" });
      const currentLevel = Math.max(0, Math.floor(Number(company.defenseLevel || 0)));
      const nextLevel = Math.min(3, currentLevel + 1);
      if (nextLevel === currentLevel) return res.status(400).json({ error: "Защита уже прокачана до максимального уровня." });
      const cost = Number(deps.WEEKLY_HACKATHON_CONFIG.sabotageAndDefense.defenseUpgradeCosts[nextLevel] || 0);
      if (Number(company.balance || 0) < cost) return res.status(400).json({ error: `Недостаточно GRM. Нужно ${cost}.` });

      await deps.storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - cost,
        defenseLevel: nextLevel,
      });
      if (deps.getRegisteredHackathonCompany(String(company.id))) {
        deps.upgradeWeeklyHackathonDefenseLevel(String(company.id));
      }
      res.json({
        ok: true,
        defenseLevel: nextLevel,
        balance: Number(company.balance || 0) - cost,
        cost,
        state: deps.getWeeklyHackathonState(),
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось улучшить защиту" });
    }
  });

  app.post("/api/hackathon/sabotage/launch", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const targetCompanyId = String(req.body?.targetCompanyId || "");
      const sabotageType = String(req.body?.sabotageType || "");
      if (!userId || !targetCompanyId || !sabotageType) {
        return res.status(400).json({ error: "userId, targetCompanyId и sabotageType обязательны" });
      }

      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      if (!deps.isCompanyHackathonManagerRole(membership.role, membership.company.ownerId, userId)) {
        return res.status(403).json({ error: "Только CEO или заместитель могут управлять саботажем и защитой в хакатоне." });
      }

      const company = await deps.storage.getCompany(String(membership.company.id));
      if (!company) return res.status(404).json({ error: "Компания не найдена" });
      const availableTypes = listAvailableByLevel(
        deps.WEEKLY_HACKATHON_CONFIG.sabotageAndDefense.sabotageTypes,
        Number(company.sabotageLevel || 0),
      ).map((entry) => entry.type);
      if (!availableTypes.includes(sabotageType)) {
        return res.status(400).json({ error: "Этот тип саботажа ещё не открыт у компании." });
      }

      const result = deps.applyWeeklyHackathonSabotage({
        initiatorUserId: userId,
        attackerCompanyId: String(membership.company.id),
        targetCompanyId,
        sabotageType,
      });
      res.json({ ok: true, sabotage: result, state: deps.getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось запустить саботаж" });
    }
  });

  app.post("/api/hackathon/defense/apply", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const defenseType = String(req.body?.defenseType || "");
      if (!userId || !defenseType) return res.status(400).json({ error: "userId и defenseType обязательны" });

      const membership = await deps.resolvePlayerCompanyMembership(userId);
      if (!membership) return res.status(400).json({ error: "Игрок не состоит в компании" });
      if (!deps.isCompanyHackathonManagerRole(membership.role, membership.company.ownerId, userId)) {
        return res.status(403).json({ error: "Только CEO или заместитель могут управлять саботажем и защитой в хакатоне." });
      }

      const result = deps.applyWeeklyHackathonDefense({
        companyId: String(membership.company.id),
        defenseType,
      });
      res.json({ ok: true, result, state: deps.getWeeklyHackathonState() });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось применить защиту" });
    }
  });

  app.post("/api/hackathon/sabotage/security-level", async (_req, res) => {
    res.status(410).json({ error: "Старый security-level больше не используется. Улучшай защиту компании через новый экран хакатона." });
  });

  app.post("/api/hackathon/sabotage/poach/respond", async (_req, res) => {
    res.status(410).json({ error: "Talent poaching отключён в новом формате weekly hackathon." });
  });
}
