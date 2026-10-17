import { Router } from "express";

import { isCloudinaryConfigured } from "../config/cloudinary.js";
import { env, missingFeatureEnv } from "../config/env.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { adminRouter } from "./admin.routes.js";
import { authRouter } from "./auth.routes.js";
import { carRouter } from "./car.routes.js";
import { inquiryRouter } from "./inquiry.routes.js";

export const apiRouter = Router();

apiRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const missing = missingFeatureEnv();

    return sendSuccess(res, {
      message: "BB Car House API is running.",
      data: {
        status: missing.length === 0 ? "ok" : "degraded",
        environment: env.NODE_ENV,
        databaseConfigured: Boolean(env.DATABASE_URL),
        cloudinaryConfigured: isCloudinaryConfigured(),
        jwtConfigured: Boolean(env.JWT_SECRET),
        missingConfiguration: missing
      },
      meta: { timestamp: new Date().toISOString() }
    });
  })
);

apiRouter.use("/auth", authRouter);
apiRouter.use("/cars", carRouter);
apiRouter.use("/inquiries", inquiryRouter);
apiRouter.use("/admin", adminRouter);