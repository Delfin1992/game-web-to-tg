import type { Express } from "express";
import type { storage as storageType } from "../storage";
import { createNotification } from "../notifications/service";

type PvpRouteDeps = {
  storage: typeof storageType;
  assertFeatureEnabled: (feature: any, message?: string) => Promise<any>;
  isPvpBotUsername: (username: string | null | undefined) => boolean;
  isTutorialCompany: (company: any) => boolean;
  getPvpQueueState: (userId: string) => any;
  updatePvpHeartbeat: (userId: string) => void;
  flushCompletedPvpDuels: () => Promise<any[]>;
  canEnterPvp: (user: any) => { ok: boolean; reason?: string | null; professionId?: string | null };
  getPvpAccessMessage: (reason: any) => string;
  getUtcDayStamp: (nowMs?: number) => string;
  getPvpBoostCatalog: () => any[];
  getPvpShopRotation: () => any;
  PVP_DUEL_CONFIG: any;
  spendGram: (userId: string, amount: number, reason: string) => Promise<any>;
  purchasePvpBoost: (userId: string, boostId: any) => any;
  startActivePvpDuelNow: (userId: string) => any;
  selectPvpTactic: (userId: string, stageKey: any, tacticId: any) => any;
  getUserWithGameState: (userId: string) => Promise<any | null>;
  resolvePlayerCompanyMembership: (userId: string) => Promise<any | null>;
  getContractsByCity: (city: string) => any[];
  readDuelSkills: (snapshot: any) => any;
  readEquippedPvpGadget: (snapshot: any) => any;
  computePvpPowerScore: (input: { skills: any; level: number; gadget?: any }) => number;
  queuePlayerForPvp: (input: any) => void;
  runPvpMatchmaking: () => any;
  leavePvpQueue: (userId: string) => void;
  clearPendingPvpBoosts: (userId: string) => void;
  clearPendingPvpTactics: (userId: string) => void;
  consumePendingPvpResult: (userId: string) => any;
  rollPvpRewardPart: (input: { isWinner: boolean; isDraw: boolean }) => any;
  transferMarketPartToPlayerInventory: (userId: string, part: any) => Promise<any>;
  applyGadgetWear: (userId: string, input: any) => Promise<any>;
  getCurrencySymbol: (city: string) => string;
  trackDailyQuestEvent: (userId: string, event: { type: "play_pvp" | "win_pvp"; value?: number }) => Promise<{ notices: string[] }>;
};

export function registerPvpRoutes(app: Express, deps: PvpRouteDeps) {
  app.get("/api/leaderboard/players", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("leaderboards", "Leaderboards are disabled by admin settings");
      const sort = String(req.query.sort ?? "level");
      const users = (await deps.storage.getUsers()).filter((user) => !deps.isPvpBotUsername(user.username));

      const sorted = [...users].sort((a, b) => {
        if (sort === "pvp") return Number(b.pvpRating || 1000) - Number(a.pvpRating || 1000);
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

  app.get("/api/leaderboard/companies", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("leaderboards", "Leaderboards are disabled by admin settings");
      const sort = String(req.query.sort ?? "level");
      const companies = (await deps.storage.getAllCompanies()).filter((company) => !deps.isTutorialCompany(company));

      const sorted = [...companies].sort((a, b) => {
        if (sort === "wealth") return b.balance - a.balance;
        if (sort === "blueprints") return b.ork - a.ork;
        return b.level - a.level;
      });

      res.json(
        sorted.slice(0, 50).map((c) => ({
          ...c,
          developedBlueprints: c.ork,
        })),
      );
    } catch (error) {
      console.error("Failed to load companies leaderboard:", error);
      res.status(500).json({ error: "Failed to load companies leaderboard" });
    }
  });

  app.get("/api/leaderboard/pvp-developers", async (_req, res) => {
    try {
      await deps.assertFeatureEnabled("leaderboards", "Leaderboards are disabled by admin settings");
      const users = (await deps.storage.getUsers()).filter((user) => !deps.isPvpBotUsername(user.username));
      const sorted = [...users]
        .sort((a, b) => {
          const ratingDiff = Number(b.pvpRating || 1000) - Number(a.pvpRating || 1000);
          if (ratingDiff !== 0) return ratingDiff;
          const winsDiff = Number(b.pvpWins || 0) - Number(a.pvpWins || 0);
          if (winsDiff !== 0) return winsDiff;
          return Number(b.pvpMatches || 0) - Number(a.pvpMatches || 0);
        })
        .slice(0, 50)
        .map(({ password, tutorialState, ...user }) => ({
          ...user,
          pvpRating: Number(user.pvpRating || 1000),
          pvpWins: Number(user.pvpWins || 0),
          pvpLosses: Number(user.pvpLosses || 0),
          pvpMatches: Number(user.pvpMatches || 0),
        }));
      res.json(sorted);
    } catch (error) {
      console.error("Failed to load PvP developers leaderboard:", error);
      res.status(500).json({ error: "Failed to load PvP developers leaderboard" });
    }
  });

  app.post("/api/pvp/heartbeat", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      await deps.storage.updateUser(userId, { lastActiveAt: Math.floor(Date.now() / 1000) });
      deps.updatePvpHeartbeat(userId);
      await deps.flushCompletedPvpDuels();
      deps.runPvpMatchmaking();
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to update heartbeat" });
    }
  });

  app.get("/api/pvp/status", async (req, res) => {
    try {
      const userId = String(req.query.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      await deps.flushCompletedPvpDuels();
      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = deps.canEnterPvp(user);
      const state = deps.getPvpQueueState(userId);
      const stamp = deps.getUtcDayStamp();
      const dailyMatches = user.pvpDailyStamp === stamp ? Number(user.pvpDailyMatches || 0) : 0;
      res.json({
        access,
        accessMessage: access.ok ? null : deps.getPvpAccessMessage(access.reason),
        inQueue: state.inQueue,
        queueJoinedAtMs: state.queueJoinedAtMs,
        queueWaitSec: state.queueWaitSec,
        queueSize: state.queueSize,
        hasPendingResult: state.hasPendingResult,
        activeDuel: state.activeDuel,
        pendingBoosts: state.pendingBoosts,
        pendingTactics: state.pendingTactics,
        boostCatalog: deps.getPvpBoostCatalog(),
        boostRotation: deps.getPvpShopRotation(),
        rating: Number(user.pvpRating || 1000),
        wins: Number(user.pvpWins || 0),
        losses: Number(user.pvpLosses || 0),
        matches: Number(user.pvpMatches || 0),
        dailyLimit: deps.PVP_DUEL_CONFIG.dailyLimit,
        dailyMatches,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load PvP status" });
    }
  });

  app.post("/api/pvp/boosts/purchase", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const boostId = String(req.body?.boostId || "") as any;
      if (!userId || !boostId) return res.status(400).json({ error: "userId and boostId are required" });
      const boost = deps.getPvpBoostCatalog().find((item) => item.id === boostId);
      if (!boost) return res.status(404).json({ error: "Этот PvP-предмет сегодня недоступен в ротации" });
      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = deps.canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: deps.getPvpAccessMessage(access.reason), reason: access.reason });
      }
      const currentState = deps.getPvpQueueState(user.id);
      if (currentState.activeDuel && !currentState.activeDuel.awaitingStart) {
        return res.status(400).json({ error: "Нельзя менять PvP-предмет во время активной дуэли" });
      }
      if (!currentState.activeDuel && currentState.pendingBoosts?.includes(boost.id)) {
        return res.status(400).json({ error: "Этот PvP-предмет уже выбран для следующей дуэли" });
      }
      const payment = await deps.spendGram(user.id, boost.costGram, `PvP boost: ${boost.name}`);
      const pendingBoosts = deps.purchasePvpBoost(user.id, boost.id);
      res.json({ ok: true, boost, pendingBoosts, gramBalance: payment.state.gramBalance });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to purchase PvP boost" });
    }
  });

  app.post("/api/pvp/duel/start", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = deps.canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: deps.getPvpAccessMessage(access.reason), reason: access.reason });
      }
      const duel = deps.startActivePvpDuelNow(userId);
      if (!duel) return res.status(404).json({ error: "Активная дуэль не найдена" });
      const state = deps.getPvpQueueState(userId);
      res.json({ ok: true, activeDuel: state.activeDuel });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to start PvP duel" });
    }
  });

  app.post("/api/pvp/tactics/select", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const stageKey = String(req.body?.stageKey || "");
      const tacticId = String(req.body?.tacticId || "");
      if (!userId || !stageKey || !tacticId) {
        return res.status(400).json({ error: "userId, stageKey and tacticId are required" });
      }
      if (!["concept", "core", "tests"].includes(stageKey)) {
        return res.status(400).json({ error: "Unknown PvP round" });
      }
      if (!["speed", "quality", "stability", "pressure"].includes(tacticId)) {
        return res.status(400).json({ error: "Unknown PvP tactic" });
      }
      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = deps.canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: deps.getPvpAccessMessage(access.reason), reason: access.reason });
      }
      const tactics = deps.selectPvpTactic(userId, stageKey, tacticId);
      const state = deps.getPvpQueueState(userId);
      res.json({ ok: true, tactics, activeDuel: state.activeDuel, pendingTactics: state.pendingTactics });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to select PvP tactic" });
    }
  });

  app.post("/api/pvp/queue/join", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const access = deps.canEnterPvp(user);
      if (!access.ok) {
        return res.status(400).json({ error: deps.getPvpAccessMessage(access.reason), reason: access.reason });
      }

      const stamp = deps.getUtcDayStamp();
      const dailyMatches = user.pvpDailyStamp === stamp ? Number(user.pvpDailyMatches || 0) : 0;
      if (dailyMatches >= deps.PVP_DUEL_CONFIG.dailyLimit) {
        return res.status(400).json({ error: `Достигнут дневной лимит PvP боёв (${deps.PVP_DUEL_CONFIG.dailyLimit})` });
      }

      const snapshot = await deps.getUserWithGameState(user.id);
      if (!snapshot) return res.status(404).json({ error: "User game state not found" });
      const currentState = deps.getPvpQueueState(user.id);
      if (currentState.activeDuel) {
        return res.status(400).json({ error: "Текущая PvP дуэль ещё не завершена" });
      }
      if (currentState.hasPendingResult) {
        return res.status(400).json({ error: "Сначала забери результат предыдущей PvP дуэли" });
      }
      const membership = await deps.resolvePlayerCompanyMembership(user.id);
      if (membership) {
        const companyContracts = deps.getContractsByCity(membership.company.city);
        const busyByContract = companyContracts.some(
          (contract: any) => contract.status === "in_progress" && contract.assignedCompanyId === membership.company.id,
        );
        if (busyByContract) {
          return res.status(400).json({ error: "Нельзя входить в PvP во время активного городского контракта компании" });
        }
      }
      const skills = deps.readDuelSkills(snapshot);
      const gadget = deps.readEquippedPvpGadget(snapshot);
      const skillSum = skills.analytics + skills.design + skills.drawing + skills.coding + skills.modeling + skills.testing + skills.attention;
      const pvpPowerScore = deps.computePvpPowerScore({ skills, level: Number(user.level || 1), gadget });
      const energyCost = Number(deps.PVP_DUEL_CONFIG.process.baseEnergyCost || 0);

      await deps.storage.updateUser(user.id, { lastActiveAt: Math.floor(Date.now() / 1000) });
      deps.queuePlayerForPvp({
        userId: user.id,
        username: user.username,
        level: Number(user.level || 1),
        rating: Number(user.pvpRating || 1000),
        professionId: access.professionId,
        skills,
        skillSum,
        pvpPowerScore,
        gadget,
      });

      await deps.flushCompletedPvpDuels();
      const result = deps.runPvpMatchmaking();

      const state = deps.getPvpQueueState(user.id);
      res.json({
        ok: true,
        inQueue: state.inQueue,
        queueSize: state.queueSize,
        queueWaitSec: state.queueWaitSec,
        activeDuel: state.activeDuel,
        pendingBoosts: state.pendingBoosts,
        energyCost,
        pvpPowerScore,
        activeGadget: gadget ? { id: gadget.id, name: gadget.name } : null,
        matched: !!result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to join PvP queue" });
    }
  });

  app.post("/api/pvp/queue/leave", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      deps.leavePvpQueue(userId);
      deps.clearPendingPvpBoosts(userId);
      deps.clearPendingPvpTactics(userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to leave PvP queue" });
    }
  });

  app.post("/api/pvp/result/claim", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      if (!userId) return res.status(400).json({ error: "userId is required" });
      await deps.flushCompletedPvpDuels();
      const result = deps.consumePendingPvpResult(userId);
      if (!result) return res.json({ ok: true, result: null });

      const perspectiveA = result.playerAUserId === userId;
      const myBefore = perspectiveA ? result.playerARatingBefore : result.playerBRatingBefore;
      const myAfter = perspectiveA ? result.playerARatingAfter : result.playerBRatingAfter;
      const opponentName = perspectiveA ? result.playerBName : result.playerAName;
      const isWinner = result.winnerUserId === userId;
      const isDraw = result.winnerUserId === null;
      const opponentIsBot = perspectiveA ? Boolean(result.playerBIsBot) : Boolean(result.playerAIsBot);
      const moneyReward = isWinner && opponentIsBot ? Math.max(0, Number(deps.PVP_DUEL_CONFIG.reward.botWinMoney || 0)) : 0;
      const user = await deps.storage.getUser(userId);
      if (moneyReward > 0 && user) {
        await deps.storage.updateUser(user.id, { balance: Number(user.balance || 0) + moneyReward });
      }
      const droppedPartDef = deps.rollPvpRewardPart({ isWinner, isDraw });
      const droppedPart = droppedPartDef
        ? await deps.transferMarketPartToPlayerInventory(userId, {
            id: String(droppedPartDef.id),
            name: String(droppedPartDef.name),
            rarity: String(droppedPartDef.rarity),
            type: String(droppedPartDef.partType || droppedPartDef.type || "unknown"),
          })
        : null;
      const gadgetWear = await deps.applyGadgetWear(userId, {
        cause: "pvp",
        severityMultiplier: result.winnerUserId === null ? 1 : isWinner ? 1 : 1.08,
        negativeEventChanceBonus: 0.03,
      });
      const playQuest = await deps.trackDailyQuestEvent(userId, { type: "play_pvp", value: 1 });
      const winQuest = isWinner ? await deps.trackDailyQuestEvent(userId, { type: "win_pvp", value: 1 }) : { notices: [] };
      createNotification(userId, {
        type: "PVP_RESULT",
        title: isDraw ? "⚔️ PvP-дуэль завершилась вничью" : isWinner ? "🏆 PvP-дуэль выиграна" : "⚔️ PvP-дуэль завершена",
        message: isDraw
          ? `Бой с ${opponentName} закончился ничьей.`
          : isWinner
            ? `Ты победил ${opponentName}. Рейтинг: ${myBefore} → ${myAfter}.`
            : `Ты уступил ${opponentName}. Рейтинг: ${myBefore} → ${myAfter}.`,
        dataJson: {
          opponentName,
          ratingBefore: myBefore,
          ratingAfter: myAfter,
          isWinner,
          isDraw,
          droppedPartId: droppedPart?.id ?? null,
        },
      });

      res.json({
        ok: true,
        result: {
          id: result.id,
          createdAtMs: result.createdAtMs,
          opponentName,
          rounds: result.rounds,
          winnerUserId: result.winnerUserId,
          isWinner,
          isDraw,
          ratingBefore: myBefore,
          ratingAfter: myAfter,
          ratingDelta: myAfter - myBefore,
          xpReward: result.winnerUserId === null ? Number(result.drawXp || 0) : isWinner ? result.winnerXp : result.loserXp,
          reputationReward: result.winnerUserId === null ? Number(result.drawReputation || 0) : isWinner ? result.winnerReputation : 0,
          moneyReward,
          moneyRewardCurrency: deps.getCurrencySymbol(user?.city || "Сан-Франциско"),
          energyCost: perspectiveA ? Number(result.energyCostA || 0) : Number(result.energyCostB || 0),
          droppedPart,
          gadgetWear: gadgetWear.report,
          notices: [...playQuest.notices, ...winQuest.notices],
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to claim PvP result" });
    }
  });

  app.get("/api/pvp/history", async (req, res) => {
    try {
      const userId = String(req.query.userId || "");
      const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const rows = await deps.storage.getPvpDuelHistoryByUser(userId, limit);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load PvP history" });
    }
  });
}
