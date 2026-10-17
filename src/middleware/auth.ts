import type { NextFunction, Request, Response } from "express";

import { UserRole } from "../generated/prisma/enums.js";
import { forbidden, unauthorized } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractBearerToken, verifyAccessToken } from "../utils/jwt.js";

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    throw unauthorized("Missing bearer token.");
  }

  const payload = verifyAccessToken(token);

  req.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role as UserRole
  };

  next();
});

/**
 * Attaches `req.user` when a valid bearer token is present and otherwise
 * continues as an anonymous request. Used by public routes that expose extra
 * data (for example unpublished vehicles) to admins without failing for
 * regular visitors.
 */
export const optionalAuthenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    try {
      const payload = verifyAccessToken(token);

      req.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role as UserRole
      };
    } catch {
      // An invalid or expired token is treated the same as no token at all.
    }

    next();
  }
);

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(forbidden());
      return;
    }

    next();
  };
}