import type { Express } from "express";
import { claimDailyQuestReward, getDailyQuestSnapshot } from "../daily-quests/service";

type DailyQuestRouteDeps = {
  getUserWithGameState: (userId: string) => Promise<any | null>;
  applyGameStatePatch: (userId: string, payload: Record<string, unknown>) => void;
};

export function registerDailyQuestRoutes(app: Express, deps: DailyQuestRouteDeps) {
  app.get("/api/daily-quests", async (req, res) => {
    try {
      const userId = String(req.query.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      res.json(await getDailyQuestSnapshot(userId));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load daily quests" });
    }
  });

  app.post("/api/daily-quests/:questId/claim", async (req, res) => {
    try {
      const userId = String(req.body?.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const result = await claimDailyQuestReward(userId, req.params.questId, {
        getUserWithGameState: deps.getUserWithGameState,
        applyGameStatePatch: deps.applyGameStatePatch,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to claim daily quest reward" });
    }
  });
}
