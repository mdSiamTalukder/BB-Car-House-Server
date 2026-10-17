import { AppError } from "./AppError.js";

/**
 * Translates the Prisma error codes we can meaningfully surface into HTTP errors
 * and re-throws anything else so it surfaces as a 500.
 */
export function handleKnownPrismaError(error: unknown): never {
  if (error instanceof AppError) throw error;

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "P2002") {
    throw new AppError("A record with these values already exists.", 409, {
      code: "UNIQUE_CONSTRAINT_VIOLATION",
      details: (error as { meta?: unknown }).meta
    });
  }

  if (code === "P2025") {
    throw new AppError("The requested record was not found.", 404, {
      code: "RECORD_NOT_FOUND"
    });
  }

  throw error;
}