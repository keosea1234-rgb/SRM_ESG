// server/modules/contracts/contracts.controller.ts
import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import { sendError, sendSuccess } from "../../middleware/errorHandler";
import { parsePagination } from "../../shared/pagination";
import { parseContractFilters } from '../../shared/filters';
import {
  getContractsService,
  getContractByIdService,
  createContractService,
  updateContractService,
  deleteContractService,
} from "./contracts.service";

export async function getContractsHandler(req: AuthRequest, res: Response) {
  try {
    const pagination = parsePagination(req.query);
    const filters = parseContractFilters(req.query);
    const result = await getContractsService(pagination, filters);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? 'Internal server error');
  }
}

export async function getContractByIdHandler(req: AuthRequest, res: Response) {
  try {
    const result = await getContractByIdService(String(req.params.id));
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

export async function createContractHandler(req: AuthRequest, res: Response) {
  try {
    const result = await createContractService(req.body);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data, 201);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

export async function updateContractHandler(req: AuthRequest, res: Response) {
  try {
    const result = await updateContractService(String(req.params.id), req.body);
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, result.data);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}

export async function deleteContractHandler(req: AuthRequest, res: Response) {
  try {
    const result = await deleteContractService(String(req.params.id));
    if (!result.ok) return sendError(res, result.status, result.error);
    sendSuccess(res, null, 204);
  } catch (err: any) {
    sendError(res, 500, err?.message ?? "Internal server error");
  }
}
