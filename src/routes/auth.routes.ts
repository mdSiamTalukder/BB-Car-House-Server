import { Router } from "express";

import { UserRole } from "../generated/prisma/enums.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import * as authController from "../controllers/auth.controller.js";
import { changePasswordSchema, loginSchema, updateProfileSchema } from "../validators/auth.validator.js";

export const authRouter = Router();

/** Slows down password guessing: 10 attempts per IP every 15 minutes. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts. Please wait a few minutes and try again."
});

authRouter.post("/login", loginLimiter, validate({ body: loginSchema }), authController.login);

authRouter.use(authenticate, requireRole(UserRole.ADMIN));

authRouter.get("/me", authController.getProfile);
authRouter.patch("/me", validate({ body: updateProfileSchema }), authController.updateProfile);
authRouter.post(
  "/me/change-password",
  validate({ body: changePasswordSchema }),
  authController.changePassword
);