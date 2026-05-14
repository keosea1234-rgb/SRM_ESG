import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole.js";
import { writeLimiter } from "../../middleware/rateLimiter";
import { validate } from "../../middleware/validate";
import { createContractSchema, updateContractSchema } from "./contracts.schema";
import {
  getContractsHandler,
  getContractByIdHandler,
  createContractHandler,
  updateContractHandler,
  deleteContractHandler,
} from "./contracts.controller";

const contractsRouter = Router();
contractsRouter.use(requireAuth);

contractsRouter.get("/contracts", getContractsHandler);
contractsRouter.get("/contracts/:id", getContractByIdHandler);
contractsRouter.post("/contracts", requireRole("admin", "procurement_manager"), writeLimiter, validate(createContractSchema), createContractHandler);
contractsRouter.put("/contracts/:id", requireRole("admin", "procurement_manager"), writeLimiter, validate(updateContractSchema), updateContractHandler);
contractsRouter.delete("/contracts/:id", requireRole("admin", "procurement_manager"), writeLimiter, deleteContractHandler);

export default contractsRouter;
