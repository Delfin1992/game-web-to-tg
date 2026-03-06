// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";
import { initializeStorage, storageMode } from "./storage";
import { startTelegramBot } from "./telegram";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

async function main() {
  console.log("🚀 Starting server...");

  console.log("📊 Initializing storage...");
  await initializeStorage();

  console.log("📍 Registering routes...");
  await registerRoutes(httpServer, app);
  console.log("✅ Routes registered");

  const port = process.env.PORT || 5000;

  httpServer.listen(port, () => {
    console.log("✅ Server running successfully");
    console.log(`🌐 Server URL: http://localhost:${port}`);
    console.log(`🗄️  Storage mode: ${storageMode === "postgres" ? "PostgreSQL (Drizzle ORM)" : "In-memory fallback"}`);
    startTelegramBot(httpServer);
  });
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

export { app, httpServer };