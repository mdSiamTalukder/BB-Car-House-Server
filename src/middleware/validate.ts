import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodType } from "zod";

import { unprocessable } from "../utils/AppError.js";

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function formatZodError(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}

/**
 * `req.query` is an accessor-only property in Express 5, so it has to be
 * redefined rather than assigned.
 */
function defineValue(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        defineValue(req, "body", schemas.body.parse(req.body));
      }

      if (schemas.query) {
        defineValue(req, "query", schemas.query.parse(req.query));
      }

      if (schemas.params) {
        defineValue(req, "params", schemas.params.parse(req.params));
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(unprocessable("Request validation failed.", formatZodError(error)));
        return;
      }

      next(error);
    }
  };
}