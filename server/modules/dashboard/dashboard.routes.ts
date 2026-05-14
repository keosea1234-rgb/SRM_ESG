// Declares dashboard module routes and maps them to controller handlers with auth protection.
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { getDashboardOverviewHandler } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/dashboard/overview", getDashboardOverviewHandler);

export default dashboardRouter;