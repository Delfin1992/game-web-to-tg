import type { Express } from "express";
import {
  claimNotificationReward,
  deactivateCityEvent,
  deactivateGlobalEvent,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  upsertCityEventNotification,
  upsertGlobalEventNotification,
} from "../notifications/service";

export function registerNotificationRoutes(app: Express) {
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = String(req.query.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      res.json(await listUserNotifications(userId));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load notifications" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const item = await markNotificationRead(userId, req.params.id);
      res.json({ ok: true, item });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      await markAllNotificationsRead(userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to mark notifications as read" });
    }
  });

  app.post("/api/notifications/:id/claim", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "userId is required" });
      res.json(await claimNotificationReward(userId, req.params.id));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to claim notification reward" });
    }
  });

  app.post("/api/admin/events/city", async (req, res) => {
    try {
      const city = String(req.body?.city || "").trim();
      const eventKey = String(req.body?.eventKey || "").trim();
      const title = String(req.body?.title || "").trim();
      const message = String(req.body?.message || "").trim();
      if (!city || !eventKey || !title || !message) {
        return res.status(400).json({ error: "city, eventKey, title and message are required" });
      }
      const type = (String(req.body?.type || "CITY_EVENT_ACTIVE").trim() || "CITY_EVENT_ACTIVE") as any;
      const item = upsertCityEventNotification(city, {
        type,
        eventKey,
        title,
        message,
        dataJson: req.body?.dataJson && typeof req.body.dataJson === "object" ? req.body.dataJson : null,
        activeFrom: Number.isFinite(Number(req.body?.activeFrom)) ? Number(req.body.activeFrom) : null,
        activeUntil: Number.isFinite(Number(req.body?.activeUntil)) ? Number(req.body.activeUntil) : null,
        replacesEventKey: req.body?.replacesEventKey ? String(req.body.replacesEventKey) : null,
      });
      res.json({ ok: true, item });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to publish city event" });
    }
  });

  app.post("/api/admin/events/global", async (req, res) => {
    try {
      const eventKey = String(req.body?.eventKey || "").trim();
      const title = String(req.body?.title || "").trim();
      const message = String(req.body?.message || "").trim();
      if (!eventKey || !title || !message) {
        return res.status(400).json({ error: "eventKey, title and message are required" });
      }
      const type = (String(req.body?.type || "GLOBAL_EVENT_ACTIVE").trim() || "GLOBAL_EVENT_ACTIVE") as any;
      const item = upsertGlobalEventNotification({
        type,
        eventKey,
        title,
        message,
        dataJson: req.body?.dataJson && typeof req.body.dataJson === "object" ? req.body.dataJson : null,
        activeFrom: Number.isFinite(Number(req.body?.activeFrom)) ? Number(req.body.activeFrom) : null,
        activeUntil: Number.isFinite(Number(req.body?.activeUntil)) ? Number(req.body.activeUntil) : null,
        replacesEventKey: req.body?.replacesEventKey ? String(req.body.replacesEventKey) : null,
      });
      res.json({ ok: true, item });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to publish global event" });
    }
  });

  app.post("/api/admin/events/city/deactivate", async (req, res) => {
    try {
      const city = String(req.body?.city || "").trim();
      const eventKey = String(req.body?.eventKey || "").trim();
      if (!city || !eventKey) return res.status(400).json({ error: "city and eventKey are required" });
      res.json({ ok: true, changed: deactivateCityEvent(eventKey, city) });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to deactivate city event" });
    }
  });

  app.post("/api/admin/events/global/deactivate", async (req, res) => {
    try {
      const eventKey = String(req.body?.eventKey || "").trim();
      if (!eventKey) return res.status(400).json({ error: "eventKey is required" });
      res.json({ ok: true, changed: deactivateGlobalEvent(eventKey) });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to deactivate global event" });
    }
  });
}
