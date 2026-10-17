import type { Request, Response } from "express";

import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { getDashboardStats } from "../services/dashboard.service.js";
import type { DashboardQuery } from "../validators/inquiry.validator.js";

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await getDashboardStats(req.query as unknown as DashboardQuery);

  return sendSuccess(res, { message: "Dashboard statistics retrieved.", data: stats });
});