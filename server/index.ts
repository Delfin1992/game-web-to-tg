import "./env";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes/index";
import { initializeStorage, storageMode } from "./storage";
import { serveStatic } from "./static";
import { getAllowedOrigins, isOriginAllowed, warnIfAdminPasswordMissing } from "./shared/env";
import { startTelegramBot } from "./telegram/index";
import { setupVite } from "./vite";

const app = express();
const httpServer = createServer(app);
const allowedOrigins = getAllowedOrigins();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  if (isOriginAllowed(requestOrigin, allowedOrigins)) {
    res.header("Access-Control-Allow-Origin", requestOrigin || "*");
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

async function main() {
  console.log("Starting server...");
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Runtime mode: ${isProduction ? "production" : "development"}`);
  warnIfAdminPasswordMissing();

  console.log("Initializing storage...");
  await initializeStorage();

  console.log("Registering routes...");
  await registerRoutes(httpServer, app);
  console.log("Routes registered");

  if (isProduction) {
    serveStatic(app);
    console.log("Static client serving enabled");
  } else {
    await setupVite(httpServer, app);
    console.log("Vite middleware enabled");
  }

  const port = process.env.PORT || 5000;
  httpServer.listen(port, () => {
    console.log("Server running successfully");
    console.log(`Server URL: http://localhost:${port}`);
    console.log(`Storage mode: ${storageMode === "postgres" ? "PostgreSQL (Drizzle ORM)" : "In-memory fallback"}`);
    startTelegramBot(httpServer);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

export { app, httpServer };
