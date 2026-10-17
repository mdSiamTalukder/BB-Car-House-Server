import { PrismaNeon } from "@prisma/adapter-neon";

import { AppError } from "../utils/AppError.js";
import { env } from "./env.js";
import { PrismaClient } from "../generated/prisma/client.js";

let client: PrismaClient | undefined;

export function createPrismaClient(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new AppError(
      "Database is not configured. Set DATABASE_URL in server/.env and restart the API.",
      503,
      { code: "DATABASE_NOT_CONFIGURED" }
    );
  }

  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });

  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  client ??= createPrismaClient();
  return client;
}

/**
 * Lazily initialised singleton. The process boots (and `/api/health` answers)
 * even when `DATABASE_URL` is missing; the error only surfaces once a query runs.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getPrismaClient();
    const value = Reflect.get(instance, property);

    return typeof value === "function" ? value.bind(instance) : value;
  }
});

export async function disconnectPrisma(): Promise<void> {
  if (!client) return;

  await client.$disconnect();
  client = undefined;
}