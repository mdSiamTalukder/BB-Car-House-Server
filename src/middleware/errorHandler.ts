import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

import { isProduction } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { sendError } from "../utils/apiResponse.js";
import { handleKnownPrismaError } from "../utils/prismaErrors.js";

interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

function normalise(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new AppError("Request validation failed.", 422, {
      code: "UNPROCESSABLE_ENTITY",
      details: error.issues
    });
  }

  if (error instanceof MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    return new AppError(error.message, status, { code: error.code });
  }

  const candidate = error as BodyParserError | undefined;

  if (candidate?.type === "entity.too.large") {
    return new AppError("Request body is too large.", 413, { code: "PAYLOAD_TOO_LARGE" });
  }

  if (candidate?.type === "entity.parse.failed") {
    return new AppError("Request body contains malformed JSON.", 400, {
      code: "INVALID_JSON"
    });
  }

  if (candidate?.name === "PrismaClientKnownRequestError") {
    try {
      handleKnownPrismaError(error);
    } catch (known) {
      return known as AppError;
    }
  }

  return new AppError("An unexpected error occurred.", 500, {
    code: "INTERNAL_SERVER_ERROR",
    cause: error
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = normalise(error);

  if (appError.statusCode >= 500) {
    console.error("[error]", error);
  } else {
    console.warn(`[error] ${appError.statusCode} ${appError.message}`);
  }

  sendError(res, {
    status: appError.statusCode,
    message: appError.message,
    code: appError.code,
    errors: appError.details,
    stack: isProduction ? undefined : appError.cause instanceof Error ? appError.cause.stack : appError.stack
  });
}