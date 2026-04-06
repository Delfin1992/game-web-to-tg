import type { Express } from "express";
import type { storage as storageType } from "../storage";
import { buildUserRoutePayload } from "./user-response";

type RegistrationRouteDeps = {
  storage: typeof storageType;
  insertUserSchema: {
    safeParse: (input: unknown) => { success: true; data: any } | { success: false };
  };
  cleanupOldTimestamps: (items: number[], now?: number) => number[];
  deviceRegistrationTimestamps: Map<string, number[]>;
  ipRegistrationTimestamps: Map<string, number[]>;
  getUserIdByTelegramId: (telegramId: string) => string | undefined;
  bindTelegramIdToUser: (telegramId: string, userId: string) => void;
  isValidRegistrationSkillsAllocation: (skills?: any) => boolean;
  normalizeRegistrationSkillsAllocation: (skills?: any) => any;
  countRegistrationSkillPoints: (skills?: any) => number;
  REGISTRATION_INITIAL_SKILL_POINTS: number;
  resolveRegistrationCityName: (value?: string | null) => string | undefined | null;
  resolveRegistrationPersonalityId: (value?: string | null) => string | undefined | null;
  applyGameStatePatch: (userId: string, patch: Record<string, unknown>) => void;
  generateReferralCode: (username: string) => string;
  userReferralCodes: Map<string, string>;
  referralCodeToUserId: Map<string, string>;
  referredByUserId: Map<string, string>;
  referralChildrenByUserId: Map<string, Set<string>>;
  serializeSafeUser: (user: any) => any;
  buildRegistrationOptions: () => Promise<any>;
  submitRegistrationAnswer: (userId: string, input: { questionId: any; answerId: string }) => Promise<any>;
  buildPlayerRegistrationState: (user: any) => { registrationStep?: string } & Record<string, unknown>;
  ensureRegistrationTutorialCompany: (userId: string) => Promise<any>;
  getUserWithGameState: (userId: string) => Promise<any | null>;
  getTutorialState: (userId: string) => Promise<any | null>;
  getCurrentInterviewQuestion: (user: any) => any;
  saveRegistrationProgress: (userId: string, payload: Record<string, unknown>) => Promise<any>;
  completeRegistration: (userId: string, payload: Record<string, unknown>) => Promise<any>;
};

export function registerRegistrationRoutes(app: Express, deps: RegistrationRouteDeps) {
  app.post("/api/register", async (req, res) => {
    try {
      const { referralCode, deviceFingerprint, telegramId } = req.body ?? {};
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();

      if (typeof telegramId === "string" && telegramId.trim().length > 0) {
        if (deps.getUserIdByTelegramId(telegramId)) {
          return res.status(409).json({ error: "Этот Telegram аккаунт уже зарегистрирован" });
        }
      }

      if (typeof deviceFingerprint === "string" && deviceFingerprint.trim().length > 0) {
        const existing = deps.cleanupOldTimestamps(deps.deviceRegistrationTimestamps.get(deviceFingerprint) ?? [], now);
        if (existing.length >= 1) {
          return res.status(429).json({ error: "С этого устройства уже создан аккаунт за последние 24 часа" });
        }
        if ((deps.deviceRegistrationTimestamps.get(deviceFingerprint) ?? []).length >= 2) {
          return res.status(429).json({ error: "Превышен лимит аккаунтов для устройства" });
        }
      }

      const ipHistory = deps.cleanupOldTimestamps(deps.ipRegistrationTimestamps.get(ip) ?? [], now);
      if (ipHistory.length >= 3) {
        return res.status(429).json({ error: "Слишком много регистраций с этого IP за сутки" });
      }

      const parsed = deps.insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data" });
      }
      const registrationSkills = deps.normalizeRegistrationSkillsAllocation(req.body?.skills);
      if (!deps.isValidRegistrationSkillsAllocation(registrationSkills)) {
        return res.status(400).json({
          error: `Распредели все ${deps.REGISTRATION_INITIAL_SKILL_POINTS} очков навыков`,
          details: { total: deps.countRegistrationSkillPoints(registrationSkills) },
        });
      }

      const resolvedCity = deps.resolveRegistrationCityName(parsed.data.city);
      const resolvedPersonality = deps.resolveRegistrationPersonalityId(parsed.data.personality);
      if (!resolvedCity || !resolvedPersonality) {
        return res.status(400).json({ error: "Invalid registration data" });
      }

      const exists = await deps.storage.usernameExists(parsed.data.username);
      if (exists) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const user = await deps.storage.createUser({
        ...parsed.data,
        city: resolvedCity,
        personality: resolvedPersonality,
      });
      deps.applyGameStatePatch(user.id, { skills: registrationSkills });

      const code = deps.generateReferralCode(user.username);
      deps.userReferralCodes.set(user.id, code);
      deps.referralCodeToUserId.set(code, user.id);

      if (typeof referralCode === "string" && referralCode.trim().length > 0) {
        const referrerId = deps.referralCodeToUserId.get(referralCode.trim());
        if (referrerId && referrerId !== user.id) {
          deps.referredByUserId.set(user.id, referrerId);
          const children = deps.referralChildrenByUserId.get(referrerId) ?? new Set<string>();
          children.add(user.id);
          deps.referralChildrenByUserId.set(referrerId, children);

          const referrer = await deps.storage.getUser(referrerId);
          if (referrer) {
            await deps.storage.updateUser(referrer.id, { balance: referrer.balance + 200 });
          }
          await deps.storage.updateUser(user.id, { balance: user.balance + 100 });
          user.balance += 100;
        }
      }

      if (typeof telegramId === "string" && telegramId.trim().length > 0) {
        deps.bindTelegramIdToUser(telegramId, user.id);
      }
      if (typeof deviceFingerprint === "string" && deviceFingerprint.trim().length > 0) {
        const history = deps.deviceRegistrationTimestamps.get(deviceFingerprint) ?? [];
        history.push(now);
        deps.deviceRegistrationTimestamps.set(deviceFingerprint, history);
      }
      ipHistory.push(now);
      deps.ipRegistrationTimestamps.set(ip, ipHistory);

      res.status(201).json({ ...deps.serializeSafeUser(user), referralCode: code });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.get("/api/check-username/:username", async (req, res) => {
    const exists = await deps.storage.usernameExists(req.params.username);
    res.json({ exists, available: !exists });
  });

  app.get("/api/registration/options", async (_req, res) => {
    try {
      res.json(await deps.buildRegistrationOptions());
    } catch (error) {
      console.error("Failed to load registration options:", error);
      res.status(500).json({ error: "Failed to load registration options" });
    }
  });

  app.post("/api/registration/submit-answer", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      const questionId = String(req.body?.questionId || "").trim();
      const answerId = String(req.body?.answerId || "").trim();
      if (!userId || !questionId || !answerId) {
        return res.status(400).json({ error: "userId, questionId and answerId are required" });
      }

      const user = await deps.storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const updated = await deps.submitRegistrationAnswer(user.id, { questionId: questionId as any, answerId });
      const registrationState = deps.buildPlayerRegistrationState(updated);
      let tutorialCompany = null as Awaited<ReturnType<typeof deps.storage.getCompany>> | null;

      if (registrationState.registrationStep === "first_craft") {
        tutorialCompany = await deps.ensureRegistrationTutorialCompany(updated.id);
      }

      const payload = await buildUserRoutePayload({
        storage: deps.storage,
        getUserWithGameState: deps.getUserWithGameState,
        getTutorialState: deps.getTutorialState,
        buildPlayerRegistrationState: deps.buildPlayerRegistrationState,
        getCurrentInterviewQuestion: deps.getCurrentInterviewQuestion,
        serializeSafeUser: deps.serializeSafeUser,
      }, updated.id);

      if (!payload) return res.status(404).json({ error: "User not found" });

      res.json({
        ...payload,
        registration: deps.buildPlayerRegistrationState((await deps.storage.getUser(updated.id)) ?? updated),
        tutorialCompany,
      });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to submit registration answer" });
    }
  });

  app.patch("/api/users/:id/registration", async (req, res) => {
    try {
      const user = await deps.storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const payload = {
        username: typeof req.body?.username === "string" ? req.body.username : undefined,
        cityId: typeof req.body?.cityId === "string" ? req.body.cityId : undefined,
        city: typeof req.body?.city === "string" ? req.body.city : undefined,
        personalityId: typeof req.body?.personalityId === "string" ? req.body.personalityId : undefined,
        personality: typeof req.body?.personality === "string" ? req.body.personality : undefined,
        gender: typeof req.body?.gender === "string" ? req.body.gender : undefined,
        skills: typeof req.body?.skills === "object" && req.body?.skills !== null ? req.body.skills : undefined,
      };

      const updated = req.body?.action === "complete"
        ? await deps.completeRegistration(user.id, payload)
        : await deps.saveRegistrationProgress(user.id, payload);

      const responsePayload = await buildUserRoutePayload({
        storage: deps.storage,
        getUserWithGameState: deps.getUserWithGameState,
        getTutorialState: deps.getTutorialState,
        buildPlayerRegistrationState: deps.buildPlayerRegistrationState,
        getCurrentInterviewQuestion: deps.getCurrentInterviewQuestion,
        serializeSafeUser: deps.serializeSafeUser,
      }, updated.id);

      if (!responsePayload) return res.status(404).json({ error: "User not found" });
      res.json(responsePayload);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to update registration" });
    }
  });
}
