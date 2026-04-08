import type { Express } from "express";
import { buildHomeDashboardSummary } from "../home-dashboard";

type HomeDashboardRouteDeps = {
  getUserWithGameState: (userId: string) => Promise<any | null>;
  getContractsByCity: (city: string) => any[];
  isTutorialCompany?: (company: any) => boolean;
};

export function registerHomeDashboardRoutes(app: Express, deps: HomeDashboardRouteDeps) {
  app.get("/api/home-dashboard", async (req, res) => {
    try {
      const userId = String(req.query.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      res.json(await buildHomeDashboardSummary(userId, deps));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load home dashboard" });
    }
  });
}
