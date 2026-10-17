/**
 * Mints a short-lived admin access token using the app's own signing helper.
 * Used by scripts/smoke.sh to exercise the protected routes without a database.
 *
 * Usage: JWT_SECRET=... npx tsx scripts/mint-token.ts
 */
import "dotenv/config";

import { signAccessToken } from "../src/utils/jwt.js";

const token = signAccessToken({
  id: "smoke-test-admin",
  email: "smoke-test@bbcarhouse.com",
  name: "Smoke Test Admin",
  role: "ADMIN"
});

process.stdout.write(token);