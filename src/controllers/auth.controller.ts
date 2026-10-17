import type { Request, Response } from "express";

import type {
  ChangePasswordInput,
  LoginInput,
  UpdateProfileInput
} from "../validators/auth.validator.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { unauthorized } from "../utils/AppError.js";
import * as authService from "../services/auth.service.js";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);

  return sendSuccess(res, {
    status: 200,
    message: "Signed in successfully.",
    data: result
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();

  const user = await authService.getProfile(req.user.id);

  return sendSuccess(res, { message: "Current user.", data: { user } });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();

  const user = await authService.updateProfile(req.user.id, req.body as UpdateProfileInput);

  return sendSuccess(res, { message: "Profile updated.", data: { user } });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();

  await authService.changePassword(req.user.id, req.body as ChangePasswordInput);

  return sendSuccess(res, { message: "Password changed successfully.", data: null });
});