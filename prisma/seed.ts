import "dotenv/config";

import bcrypt from "bcryptjs";

import { env } from "../src/config/env.js";
import { disconnectPrisma, prisma } from "../src/config/prisma.js";
import { AppError } from "../src/utils/AppError.js";

/**
 * Creates the first admin account so `/api/auth/login` can be used.
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD and are never hard coded.
 *
 * The seed only needs the database, so Cloudinary being unconfigured is fine.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Showroom Admin";

  if (!env.DATABASE_URL) {
    console.error("[seed] DATABASE_URL must be set in server/.env before seeding.");
    process.exitCode = 1;
    return;
  }

  if (!email || !password) {
    console.error(
      "[seed] ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env before seeding."
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error("[seed] ADMIN_PASSWORD must be at least 8 characters long.");
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`[seed] Admin "${email}" already exists, nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

  await prisma.user.create({
    data: { email, name, passwordHash, role: "ADMIN" }
  });

  console.log(`[seed] Created admin "${email}".`);
}

main()
  .catch((error) => {
    if (error instanceof AppError) {
      console.error(`[seed] ${error.message}`);
    } else {
      console.error("[seed] Failed:", error);
    }

    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());