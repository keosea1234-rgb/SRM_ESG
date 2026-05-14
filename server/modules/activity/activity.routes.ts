// Route definitions for activity log module.
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { getActivityLogHandler, getDistinctActionsHandler } from "./activity.controller";

const router = Router();

router.get("/activity-log/actions", requireAuth, getDistinctActionsHandler);
router.get("/activity-log", requireAuth, getActivityLogHandler);

export default router;
