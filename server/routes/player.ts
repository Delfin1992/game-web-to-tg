import type { Express } from "express";
import type { storage as storageType } from "../storage";
import { buildUserRoutePayload } from "./user-response";
import {
  getActiveHousingIdForCity,
  getInventoryCapacityForUser,
  getPlayerHousingState,
  purchaseHousing,
  setActiveHousing,
} from "../player-meta";
import { listHousesForCity } from "../../shared/housing";
import {
  acceptRepairOrder,
  calculateRepairEstimate,
  cancelRepairOrderByPlayer,
  createRepairOrder,
  listRepairOrdersForCity,
  listRepairOrdersForCompany,
  listRepairableGadgets,
  startRepairOrder,
} from "../repair-service";
import { canManageCompanyAssets } from "../company-security";

type PlayerRouteDeps = {
  storage: typeof storageType;
  getUserWithGameState: (userId: string) => Promise<any | null>;
  getTutorialState: (userId: string) => Promise<any | null>;
  buildPlayerRegistrationState: (user: any) => { registrationStep?: string } & Record<string, unknown>;
  getCurrentInterviewQuestion: (user: any) => any;
  serializeSafeUser: (user: any) => any;
  applyGameStatePatch: (userId: string, patch: Record<string, unknown>) => void;
  assertFeatureEnabled: (feature: any, message?: string) => Promise<any>;
  getStockMarketSnapshot: (userId: string) => Promise<any>;
  buyStockAsset: (userId: string, ticker: string, quantity: number) => Promise<any>;
  sellStockAsset: (userId: string, ticker: string, quantity: number) => Promise<any>;
  applyTutorialEvent: (userId: string, eventType: any) => Promise<any>;
  getTutorialActiveStep: (state: any) => number;
  getTutorialProgressText: (state: any) => string;
  TUTORIAL_STEP_CONTENT: Record<number, any>;
  startTutorial: (userId: string) => Promise<any>;
  isTutorialCompany: (company: any) => boolean;
  TUTORIAL_DEMO_COMPANY_NAME: string;
  assignTutorialDemoCompany: (userId: string, companyId: string) => Promise<any>;
  removeProducedGadget: (companyId: string, gadgetId: string) => any;
  companyGadgets: Map<string, any[]>;
  companyBlueprints: Map<string, any>;
  clearTutorialDemoCompany: (userId: string) => Promise<any>;
  completeTutorial: (userId: string) => Promise<any>;
  TUTORIAL_DEMO_BLUEPRINT: { name: string };
  TutorialEventTypes: readonly string[];
  PLAYABLE_PROFESSIONS: any[];
  PROFESSION_UNLOCK_LEVEL: number;
  getPlayerProfessionId: (user: any) => string | null;
  getProfessionById: (professionId: string) => any;
  canSelectProfession: (user: any) => boolean;
  isProfessionId: (professionId: string) => boolean;
  setPlayerProfession: (userId: string, professionId: any) => Promise<any>;
  resolvePlayerCompanyMembership: (userId: string) => Promise<{ company: any; role: string } | null>;
};

export function registerPlayerRoutes(app: Express, deps: PlayerRouteDeps) {
  const buildHousingSnapshot = async (userId: string) => {
    const user = await deps.storage.getUser(userId);
    if (!user) return null;
    const houses = listHousesForCity(user.city);
    return {
      city: user.city,
      balance: Number(user.balance || 0),
      housingState: getPlayerHousingState(user),
      activeHousingId: getActiveHousingIdForCity(user),
      inventoryCapacity: getInventoryCapacityForUser(user),
      houses,
      ownedHousingIds: houses
        .filter((house) => (getPlayerHousingState(user).ownedByCity?.[house.cityId] ?? []).includes(house.id))
        .map((house) => house.id),
    };
  };

  const buildRepairSnapshot = async (userId: string) => {
    const user = await deps.storage.getUser(userId);
    if (!user) return null;
    const repairable = await listRepairableGadgets(userId);
    const cityOrders = listRepairOrdersForCity(user.city);
    const membership = await deps.resolvePlayerCompanyMembership(userId);
    const canManageRepairOrders = membership
      ? canManageCompanyAssets({
          actorUserId: userId,
          companyOwnerId: membership.company.ownerId,
          role: membership.role,
        })
      : false;
    const companyOrders = canManageRepairOrders && membership
      ? listRepairOrdersForCompany(membership.company.id)
      : [];

    return {
      city: user.city,
      repairableGadgets: repairable.map((item) => ({
        ...item,
        estimate: calculateRepairEstimate(item),
      })),
      activeOrders: cityOrders.filter((order) => order.playerId === userId),
      cityOrders: canManageRepairOrders
        ? cityOrders.filter((order) => order.status === "queued")
        : [],
      companyOrders,
      companyPanel: canManageRepairOrders && membership
        ? {
            companyId: membership.company.id,
            companyName: membership.company.name,
            role: membership.role,
          }
        : null,
    };
  };

  app.get("/api/users/:id", async (req, res) => {
    const payload = await buildUserRoutePayload({
      storage: deps.storage,
      getUserWithGameState: deps.getUserWithGameState,
      getTutorialState: deps.getTutorialState,
      buildPlayerRegistrationState: deps.buildPlayerRegistrationState,
      getCurrentInterviewQuestion: deps.getCurrentInterviewQuestion,
      serializeSafeUser: deps.serializeSafeUser,
    }, req.params.id);

    if (!payload) return res.status(404).json({ error: "User not found" });
    res.json(payload);
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body ?? {};
      const userPatch: Record<string, unknown> = {};
      if (typeof updates.level === "number") userPatch.level = updates.level;
      if (typeof updates.experience === "number") userPatch.experience = updates.experience;
      if (typeof updates.balance === "number") userPatch.balance = updates.balance;
      if (typeof updates.reputation === "number") userPatch.reputation = updates.reputation;
      if (typeof updates.city === "string") userPatch.city = updates.city;
      if (typeof updates.personality === "string") userPatch.personality = updates.personality;
      if (typeof updates.gender === "string") userPatch.gender = updates.gender;

      await deps.storage.updateUser(req.params.id, userPatch as any);

      deps.applyGameStatePatch(req.params.id, {
        skills: updates.skills,
        inventory: updates.inventory,
        workTime: updates.workTime,
        studyTime: updates.studyTime,
        gramBalance: updates.gramBalance,
        activeBankProduct: updates.activeBankProduct,
        activePvpBankBoost: updates.activePvpBankBoost,
      });

      const payload = await buildUserRoutePayload({
        storage: deps.storage,
        getUserWithGameState: deps.getUserWithGameState,
        getTutorialState: deps.getTutorialState,
        buildPlayerRegistrationState: deps.buildPlayerRegistrationState,
        getCurrentInterviewQuestion: deps.getCurrentInterviewQuestion,
        serializeSafeUser: deps.serializeSafeUser,
      }, req.params.id);

      if (!payload) return res.status(404).json({ error: "User not found" });
      res.json(payload);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/stocks", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("stocks", "Stocks are disabled by admin settings");
      const userId = String(req.query.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      res.json(await deps.getStockMarketSnapshot(userId));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load stock market" });
    }
  });

  app.post("/api/stocks/buy", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("stocks", "Stocks are disabled by admin settings");
      const userId = String(req.body?.userId ?? "").trim();
      const ticker = String(req.body?.ticker ?? "").trim();
      const quantity = Number(req.body?.quantity ?? 0);
      if (!userId || !ticker || !Number.isFinite(quantity)) {
        return res.status(400).json({ error: "userId, ticker and quantity are required" });
      }
      const result = await deps.buyStockAsset(userId, ticker, quantity);
      const tutorial = await deps.applyTutorialEvent(userId, "first_stock_bought").catch(() => null);
      res.json({ ...result, tutorial });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to buy stock" });
    }
  });

  app.post("/api/stocks/sell", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("stocks", "Stocks are disabled by admin settings");
      const userId = String(req.body?.userId ?? "").trim();
      const ticker = String(req.body?.ticker ?? "").trim();
      const quantity = Number(req.body?.quantity ?? 0);
      if (!userId || !ticker || !Number.isFinite(quantity)) {
        return res.status(400).json({ error: "userId, ticker and quantity are required" });
      }
      res.json(await deps.sellStockAsset(userId, ticker, quantity));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to sell stock" });
    }
  });

  app.get("/api/housing/:userId", async (req, res) => {
    try {
      const snapshot = await buildHousingSnapshot(req.params.userId);
      if (!snapshot) return res.status(404).json({ error: "User not found" });
      res.json(snapshot);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load housing" });
    }
  });

  app.post("/api/housing/:userId/purchase", async (req, res) => {
    try {
      const houseId = String(req.body?.houseId ?? "").trim();
      if (!houseId) return res.status(400).json({ error: "houseId is required" });
      await purchaseHousing(req.params.userId, houseId);
      const snapshot = await buildHousingSnapshot(req.params.userId);
      if (!snapshot) return res.status(404).json({ error: "User not found" });
      res.json(snapshot);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to purchase housing" });
    }
  });

  app.post("/api/housing/:userId/activate", async (req, res) => {
    try {
      const houseId = String(req.body?.houseId ?? "").trim();
      if (!houseId) return res.status(400).json({ error: "houseId is required" });
      await setActiveHousing(req.params.userId, houseId);
      const snapshot = await buildHousingSnapshot(req.params.userId);
      if (!snapshot) return res.status(404).json({ error: "User not found" });
      res.json(snapshot);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to activate housing" });
    }
  });

  app.get("/api/repair-service/:userId", async (req, res) => {
    try {
      const snapshot = await buildRepairSnapshot(req.params.userId);
      if (!snapshot) return res.status(404).json({ error: "User not found" });
      res.json(snapshot);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load repair service" });
    }
  });

  app.post("/api/repair-service/:userId/orders", async (req, res) => {
    try {
      const gadgetRef = String(req.body?.gadgetRef ?? "").trim();
      const requestedPrice = req.body?.requestedPrice;
      if (!gadgetRef) return res.status(400).json({ error: "gadgetRef is required" });
      const order = await createRepairOrder({
        userId: req.params.userId,
        gadgetRef,
        requestedPrice: requestedPrice == null ? null : Number(requestedPrice),
      });
      const snapshot = await buildRepairSnapshot(req.params.userId);
      res.json({ order, snapshot });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to create repair order" });
    }
  });

  app.post("/api/repair-service/:userId/orders/:orderId/cancel", async (req, res) => {
    try {
      await cancelRepairOrderByPlayer(req.params.userId, req.params.orderId);
      const snapshot = await buildRepairSnapshot(req.params.userId);
      if (!snapshot) return res.status(404).json({ error: "User not found" });
      res.json(snapshot);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to cancel repair order" });
    }
  });

  app.post("/api/repair-service/:userId/orders/:orderId/accept", async (req, res) => {
    try {
      const membership = await deps.resolvePlayerCompanyMembership(req.params.userId);
      if (!membership) return res.status(400).json({ error: "Company membership required" });
      const allowed = canManageCompanyAssets({
        actorUserId: req.params.userId,
        companyOwnerId: membership.company.ownerId,
        role: membership.role,
      });
      if (!allowed) {
        return res.status(403).json({ error: "Только CEO и его заместитель могут принимать ремонтные заказы компании." });
      }
      const order = await acceptRepairOrder({
        orderId: req.params.orderId,
        company: membership.company,
        acceptedBy: req.params.userId,
      });
      await startRepairOrder({
        orderId: order.id,
        companyId: membership.company.id,
        startedBy: req.params.userId,
      });
      const snapshot = await buildRepairSnapshot(req.params.userId);
      res.json({ order, snapshot });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to accept repair order" });
    }
  });

  app.get("/api/tutorial/:userId", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const state = await deps.getTutorialState(req.params.userId);
      if (!state) return res.status(404).json({ error: "User not found" });

      const activeStep = deps.getTutorialActiveStep(state);
      res.json({
        state,
        activeStep,
        progressText: deps.getTutorialProgressText(state),
        stepContent: deps.TUTORIAL_STEP_CONTENT[activeStep] ?? deps.TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error) {
      console.error("Failed to load tutorial state:", error);
      res.status(500).json({ error: "Failed to load tutorial state" });
    }
  });

  app.post("/api/tutorial/:userId/start", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const result = await deps.startTutorial(req.params.userId);
      const activeStep = deps.getTutorialActiveStep(result.state);
      res.json({
        ...result,
        activeStep,
        progressText: deps.getTutorialProgressText(result.state),
        stepContent: deps.TUTORIAL_STEP_CONTENT[activeStep] ?? deps.TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to start tutorial" });
    }
  });

  app.post("/api/tutorial/:userId/event", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const eventType = String(req.body?.eventType || "");
      if (!deps.TutorialEventTypes.includes(eventType)) {
        return res.status(400).json({ error: "Unsupported tutorial event" });
      }

      const result = await deps.applyTutorialEvent(req.params.userId, eventType);
      const activeStep = deps.getTutorialActiveStep(result.state);
      res.json({
        ...result,
        activeStep,
        progressText: deps.getTutorialProgressText(result.state),
        stepContent: deps.TUTORIAL_STEP_CONTENT[activeStep] ?? deps.TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to apply tutorial event" });
    }
  });

  app.post("/api/tutorial/:userId/demo-company", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      await deps.assertFeatureEnabled("demoCompany", "Demo companies are disabled by admin settings");
      await deps.assertFeatureEnabled("tutorialDemoCompany", "Tutorial demo company is disabled by admin settings");
      const user = await deps.storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const tutorialState = await deps.getTutorialState(user.id);
      if (!tutorialState || !tutorialState.isActive || tutorialState.isCompleted) {
        return res.status(400).json({ error: "Tutorial is not active" });
      }
      if (tutorialState.currentStep < 3) {
        return res.status(400).json({ error: "Demo company unlocks after job and education tutorial steps" });
      }

      let company = await deps.storage.getTutorialCompanyByOwner(user.id);
      if (!company) {
        company = await deps.storage.createCompany(
          {
            name: deps.TUTORIAL_DEMO_COMPANY_NAME,
            city: user.city,
            isTutorial: true,
            tutorialOwnerId: user.id,
          },
          user.id,
          user.username,
        );
      }
      const tutorialCapitalTarget = 30000;
      if (Number(company.balance ?? 0) < tutorialCapitalTarget) {
        company = await deps.storage.updateCompany(company.id, { balance: tutorialCapitalTarget });
      }

      const tutorial = await deps.assignTutorialDemoCompany(user.id, company.id);
      const activeStep = deps.getTutorialActiveStep(tutorial.state);
      res.json({
        company,
        tutorial: {
          ...tutorial,
          activeStep,
          progressText: deps.getTutorialProgressText(tutorial.state),
          stepContent: deps.TUTORIAL_STEP_CONTENT[activeStep] ?? deps.TUTORIAL_STEP_CONTENT[1],
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to create tutorial company" });
    }
  });

  app.post("/api/tutorial/:userId/demo-sell", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const state = await deps.getTutorialState(req.params.userId);
      if (!state) return res.status(404).json({ error: "User not found" });
      if (!state.demoCompanyId) return res.status(400).json({ error: "Demo company not found" });
      if (!state.isActive || state.isCompleted) {
        return res.status(400).json({ error: "Tutorial is not active" });
      }
      if (state.currentStep < 6) {
        return res.status(400).json({ error: "Selling unlocks after producing tutorial gadget" });
      }

      const company = await deps.storage.getCompany(state.demoCompanyId);
      if (!company || !deps.isTutorialCompany(company)) {
        return res.status(404).json({ error: "Tutorial company not found" });
      }
      if (String(company.tutorialOwnerId || company.ownerId) !== req.params.userId) {
        return res.status(403).json({ error: "Not tutorial owner" });
      }

      const produced = deps.companyGadgets.get(company.id) ?? [];
      const demoGadget = produced.find((item) => item.name === deps.TUTORIAL_DEMO_BLUEPRINT.name) ?? produced[0];
      if (!demoGadget) {
        return res.status(400).json({ error: "No produced demo gadget to sell" });
      }

      const sold = deps.removeProducedGadget(company.id, demoGadget.id);
      const tutorial = await deps.applyTutorialEvent(req.params.userId, "demo_gadget_sold");
      const activeStep = deps.getTutorialActiveStep(tutorial.state);
      res.json({
        soldGadget: sold,
        tutorial: {
          ...tutorial,
          activeStep,
          progressText: deps.getTutorialProgressText(tutorial.state),
          stepContent: deps.TUTORIAL_STEP_CONTENT[activeStep] ?? deps.TUTORIAL_STEP_CONTENT[1],
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to sell tutorial gadget" });
    }
  });

  app.post("/api/tutorial/:userId/complete", async (req, res) => {
    try {
      await deps.assertFeatureEnabled("tutorial", "Tutorial is disabled by admin settings");
      const before = await deps.getTutorialState(req.params.userId);
      const demoCompanyId = before?.demoCompanyId ?? null;

      const result = await deps.completeTutorial(req.params.userId);

      if (demoCompanyId) {
        const demoCompany = await deps.storage.getCompany(demoCompanyId);
        if (demoCompany && deps.isTutorialCompany(demoCompany)) {
          await deps.storage.deleteCompany(demoCompany.id);
        }
        deps.companyBlueprints.delete(demoCompanyId);
        deps.companyGadgets.delete(demoCompanyId);
      }
      await deps.clearTutorialDemoCompany(req.params.userId);

      const activeStep = deps.getTutorialActiveStep(result.state);
      res.json({
        ...result,
        activeStep,
        progressText: deps.getTutorialProgressText(result.state),
        stepContent: deps.TUTORIAL_STEP_CONTENT[activeStep] ?? deps.TUTORIAL_STEP_CONTENT[1],
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to complete tutorial" });
    }
  });

  app.get("/api/users/:id/advanced-personality", async (req, res) => {
    const user = await deps.storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      unlocked: false,
      levelRequired: null,
      selected: null,
      needsChoice: false,
      options: [],
    });
  });

  app.post("/api/users/:id/advanced-personality", async (req, res) => {
    void req;
    res.status(410).json({ error: "Механика второго характера отключена" });
  });

  app.get("/api/users/:id/profession", async (req, res) => {
    const user = await deps.storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const professionId = deps.getPlayerProfessionId(user);
    res.json({
      unlocked: Number(user.level || 0) >= deps.PROFESSION_UNLOCK_LEVEL,
      levelRequired: deps.PROFESSION_UNLOCK_LEVEL,
      selected: professionId,
      profile: professionId ? deps.getProfessionById(professionId) ?? null : null,
      needsChoice: deps.canSelectProfession(user),
      options: deps.PLAYABLE_PROFESSIONS,
    });
  });

  app.post("/api/users/:id/profession", async (req, res) => {
    try {
      const user = await deps.storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (Number(user.level || 0) < deps.PROFESSION_UNLOCK_LEVEL) {
        return res.status(400).json({ error: `Доступно с уровня ${deps.PROFESSION_UNLOCK_LEVEL}` });
      }
      if (deps.getPlayerProfessionId(user)) {
        return res.status(400).json({ error: "Профессия уже выбрана" });
      }

      const professionId = String(req.body?.professionId || "").trim();
      if (!deps.isProfessionId(professionId) || professionId === "devops") {
        return res.status(400).json({ error: "Профессия не найдена" });
      }

      const updated = await deps.setPlayerProfession(user.id, professionId);
      res.json({
        ok: true,
        selected: professionId,
        profile: deps.getProfessionById(professionId) ?? null,
        user: deps.serializeSafeUser(updated),
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Не удалось выбрать профессию" });
    }
  });
}
