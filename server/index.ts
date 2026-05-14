// SRM API entry point — initializes middleware, mounts routers, starts server
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as Sentry from "@sentry/node";
import suppliersRouter from "./modules/suppliers/suppliers.routes";
import contractsRouter from "./modules/contracts/contracts.routes";
import dashboardRouter from "./modules/dashboard/dashboard.routes";
import performanceRouter from "./modules/performance/performance.routes";
import riskRouter from "./modules/risk/risk.routes";
import activityRouter from "./modules/activity/activity.routes";
import esgRouter from "./modules/esg/esg.routes";
import alertsRouter from "./modules/alerts/alerts.routes";
import complianceRouter from "./modules/compliance/compliance.routes";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { generalLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./shared/logger";
import { startDailySnapshotWorker } from "./jobs/workers/dailySnapshotWorker";
import { startExternalDataWorker } from "./jobs/workers/externalDataWorker";
import { startScheduler } from "./jobs/scheduler";
import { areBackgroundJobsEnabled, closeQueues } from "./jobs/queue";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dotenvPath = path.resolve(__dirname, "..", ".env");

dotenv.config({ path: dotenvPath });

const app = express();
app.use(correlationIdMiddleware);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin only in development
      // (mobile apps, curl, health checks — but also file:// and sandboxed iframes)
      if (!origin) {
        if (process.env.NODE_ENV === "production") {
          return callback(new Error("CORS: null origin not allowed in production"));
        }
        return callback(null, true);
      }
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(generalLimiter);

const jsonParser = express.json();
app.use((req, res, next) => {
  const pathname = (req.path || "").split("?")[0] || req.path;
  const isMultipart = String(req.headers["content-type"] ?? "")
    .toLowerCase()
    .includes("multipart/form-data");
  const isSupplierDocumentUpload =
    req.method === "POST" && /^\/api\/suppliers\/[^/]+\/documents\/?$/.test(pathname);

  if (isSupplierDocumentUpload && isMultipart) {
    return next();
  }

  return jsonParser(req, res, next);
});
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const responseTimeMs = Date.now() - startTime;
    const payload = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTimeMs,
    };

    if (res.statusCode >= 500) {
      logger.error(payload, "Request completed with server error");
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn(payload, "Request completed with client error");
      return;
    }

    logger.info(payload, "Request completed successfully");
  });

  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "srm-api" });
});

app.use("/api", suppliersRouter);
app.use("/api", contractsRouter);
app.use("/api", dashboardRouter);
app.use("/api", performanceRouter);
app.use("/api/risk", riskRouter);
app.use("/api", activityRouter);
app.use("/api/esg", esgRouter);
app.use("/api", alertsRouter);
app.use("/api", complianceRouter);

Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  logger.info({ port: PORT }, "SRM API running");

  const jobsEnabled = areBackgroundJobsEnabled();
  logger.info(
    {
      jobsEnabled,
      backgroundJobs: jobsEnabled ? "enabled" : "disabled",
      NODE_ENV: process.env.NODE_ENV ?? "(unset)",
      DISABLE_JOBS: process.env.DISABLE_JOBS ?? "(unset)",
      dotenvPath,
    },
    jobsEnabled
      ? "Background jobs ENABLED - starting BullMQ workers and scheduler"
      : "Background jobs DISABLED - skipping BullMQ workers, scheduler, and queue clients"
  );

  const snapshotWorker = jobsEnabled ? startDailySnapshotWorker() : null;
  const externalDataWorker = jobsEnabled ? startExternalDataWorker() : null;

  if (jobsEnabled) {
    await startScheduler();
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    await snapshotWorker?.close();
    await externalDataWorker?.close();
    if (jobsEnabled) {
      await closeQueues();
      logger.info("BullMQ shutdown complete");
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
