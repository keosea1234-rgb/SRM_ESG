import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimiter";
import { getAlertsHandler, markReadHandler } from "./alerts.controller";

const alertsRouter = Router();
alertsRouter.use(requireAuth);

alertsRouter.get("/alerts", getAlertsHandler);
alertsRouter.patch("/alerts/:id/read", writeLimiter, markReadHandler);

export default alertsRouter;
