// server/modules/esg/esg.routes.ts
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimiter";
import { requireRole } from "../../middleware/requireRole.js";
import {
  handleCreateAssessment,
  handleGetAssessmentHistory,
  handleGetBySupplier,
  handleGetHotspots,
  handleGetLeaderboard,
  handleGetSummary,
} from "./esg.controller";
import { exportESGLeaderboardCSVHandler } from "../suppliers/export.controller";

const router = Router();
router.use(requireAuth);

router.get("/summary", handleGetSummary);
router.get("/leaderboard", handleGetLeaderboard);
router.get("/hotspots", handleGetHotspots);
router.get("/export", exportESGLeaderboardCSVHandler);
router.get("/:supplierId/history", handleGetAssessmentHistory);
router.get("/:supplierId", handleGetBySupplier);
/** POST write is intentionally limited to admin + esg_analyst roles. */
router.post(
  "/:supplierId",
  requireRole("admin", "esg_analyst"),
  writeLimiter,
  handleCreateAssessment
);

export default router;
