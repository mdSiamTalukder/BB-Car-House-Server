import { Router } from "express";

import { UserRole } from "../generated/prisma/enums.js";
import * as dashboardController from "../controllers/dashboard.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { dashboardQuerySchema } from "../validators/inquiry.validator.js";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole(UserRole.ADMIN));

adminRouter.get(
  "/dashboard",
  validate({ query: dashboardQuerySchema }),
  dashboardController.dashboard
);