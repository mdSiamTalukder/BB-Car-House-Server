export interface AppErrorOptions {
  code?: string;
  details?: unknown;
  cause?: unknown;
}

/**
 * Operational (expected) HTTP failure. Anything thrown that is not an
 * `AppError` is treated as a bug and reported as a generic 500.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly isOperational = true;

  constructor(message: string, statusCode = 500, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = options.code ?? defaultCodeForStatus(statusCode);
    this.details = options.details;

    Error.captureStackTrace(this, AppError);
  }
}

function defaultCodeForStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 429:
      return "TOO_MANY_REQUESTS";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(message, 400, { code: "BAD_REQUEST", details });

export const unauthorized = (message = "Authentication required.", code = "UNAUTHORIZED") =>
  new AppError(message, 401, { code });

export const forbidden = (message = "You do not have permission to perform this action.") =>
  new AppError(message, 403);

export const notFound = (resource = "Resource") => new AppError(`${resource} not found.`, 404);

export const conflict = (message: string, details?: unknown) =>
  new AppError(message, 409, { code: "CONFLICT", details });

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(message, 422, { code: "UNPROCESSABLE_ENTITY", details });

export const serviceUnavailable = (message: string, code = "SERVICE_UNAVAILABLE") =>
  new AppError(message, 503, { code });