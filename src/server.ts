import "dotenv/config";

import { createApp } from "./app.js";
import { disconnectPrisma } from "./config/prisma.js";
import { allowedOrigins, env, missingFeatureEnv } from "./config/env.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`[server] BB Car House API listening on http://localhost:${env.PORT}`);
  console.log(`[server] Environment: ${env.NODE_ENV}`);
  console.log(`[server] CORS origins: ${allowedOrigins.join(", ")}`);

  for (const { feature, variables } of missingFeatureEnv()) {
    console.warn(
      `[server] "${feature}" is disabled until you set: ${variables.join(", ")} (server/.env)`
    );
  }
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down.`);

  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));