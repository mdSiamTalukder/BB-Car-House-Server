import "dotenv/config";
import { z } from "zod";

/**
 * Accepts real booleans and the usual string representations without the
 * `Boolean("false") === true` footgun of `z.coerce.boolean()`.
 */
const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === "boolean") return value;

    const normalised = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalised)) return true;
    if (["0", "false", "no", "off", ""].includes(normalised)) return false;

    ctx.addIssue({ code: "custom", message: "Expected a boolean value (true/false)" });
    return z.NEVER;
  });

/**
 * dotenv turns `KEY=` into an empty string rather than omitting the key, so every
 * optional variable has to treat `""` (and whitespace-only values) as "not set".
 * Without this, `.optional()` still rejects empty strings and the process exits
 * at import time.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** An optional variable: unset or blank becomes `undefined`. */
const optionalEnvString = z.preprocess(emptyToUndefined, z.string().optional());

/** A variable with a fallback that is only used when unset or blank. */
const envStringWithDefault = (fallback: string) =>
  z.preprocess(emptyToUndefined, z.string().default(fallback));

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "test", "production"]).default("development")
  ),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(5000)),
  API_URL: optionalEnvString,
  CLIENT_URL: envStringWithDefault("http://localhost:3000"),
  TRUST_PROXY: booleanFromEnv.default(false),

  // Required by the features that use them, but blank values are treated as
  // "not configured" so the process can still boot and report what is missing.
  DATABASE_URL: optionalEnvString,
  JWT_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(32, "JWT_SECRET must be at least 32 characters long").optional()
  ),
  JWT_EXPIRES_IN: envStringWithDefault("7d"),
  BCRYPT_SALT_ROUNDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(10).max(15).default(12)
  ),

  // Cloudinary is optional: the API and the Prisma seed run without it. Image
  // endpoints report a 503 only when an upload is actually requested.
  CLOUDINARY_CLOUD_NAME: optionalEnvString,
  CLOUDINARY_API_KEY: optionalEnvString,
  CLOUDINARY_API_SECRET: optionalEnvString,
  CLOUDINARY_FOLDER: envStringWithDefault("bb-car-house"),

  MAX_UPLOAD_SIZE_MB: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(1).max(25).default(5)
  ),
  UPLOAD_ALLOWED_MIME_TYPES: envStringWithDefault("image/jpeg,image/png,image/webp,image/avif")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const { fieldErrors } = z.flattenError(parsed.error);

  console.error("[config] Invalid environment configuration:");
  for (const [field, messages] of Object.entries(fieldErrors)) {
    console.error(`  - ${field}: ${messages?.join(", ")}`);
  }

  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === "production";

/** Origins accepted by the CORS layer. `CLIENT_URL` may hold a comma separated list. */
export const allowedOrigins: string[] = env.CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const allowedUploadMimeTypes: string[] = env.UPLOAD_ALLOWED_MIME_TYPES.split(",")
  .map((type) => type.trim().toLowerCase())
  .filter(Boolean);

export const maxUploadSizeBytes = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;

/**
 * Features that are implemented but unusable until the matching environment
 * variables are provided. Reported at boot so setup gaps are obvious.
 */
export function missingFeatureEnv(): { feature: string; variables: string[] }[] {
  const missing: { feature: string; variables: string[] }[] = [];

  if (!env.DATABASE_URL) {
    missing.push({ feature: "database", variables: ["DATABASE_URL"] });
  }

  const cloudinaryVariables = (
    [
      ["CLOUDINARY_CLOUD_NAME", env.CLOUDINARY_CLOUD_NAME],
      ["CLOUDINARY_API_KEY", env.CLOUDINARY_API_KEY],
      ["CLOUDINARY_API_SECRET", env.CLOUDINARY_API_SECRET],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (cloudinaryVariables.length > 0) {
    missing.push({ feature: "image uploads", variables: cloudinaryVariables });
  }

  if (!env.JWT_SECRET) {
    missing.push({ feature: "admin authentication", variables: ["JWT_SECRET"] });
  }

  return missing;
}