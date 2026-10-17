// `jsonwebtoken` is CommonJS, so it is imported through the default binding.
import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError, unauthorized } from "./AppError.js";

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  type: "access";
}

const ISSUER = "bb-car-house-api";
const AUDIENCE = "bb-car-house-admin";

function getJwtSecret(): string {
  if (!env.JWT_SECRET) {
    throw new AppError(
      "Authentication is not configured. Set JWT_SECRET (min 32 characters) in server/.env.",
      503,
      { code: "JWT_NOT_CONFIGURED" }
    );
  }

  return env.JWT_SECRET;
}

export function signAccessToken(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): string {
  const options: SignOptions = {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: user.id
  };

  return jwt.sign(
    {
      email: user.email,
      name: user.name,
      role: user.role,
      type: "access"
    },
    getJwtSecret(),
    options
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE
    });

    if (
      typeof decoded === "string" ||
      decoded.type !== "access" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.name !== "string" ||
      typeof decoded.role !== "string"
    ) {
      throw unauthorized("Access token payload is invalid.");
    }

    return decoded as AccessTokenPayload;
  } catch (error) {
    if (error instanceof AppError) throw error;

    const message =
      error instanceof Error && error.name === "TokenExpiredError"
        ? "Access token has expired."
        : "Access token is invalid.";

    throw unauthorized(message, error instanceof Error && error.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID");
  }
}

/** Extracts the bearer token from an `Authorization` header. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, token] = header.split(" ");

  if (!token || scheme.toLowerCase() !== "bearer") return null;

  return token.trim() || null;
}