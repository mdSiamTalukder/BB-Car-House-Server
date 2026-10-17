import { v2 as cloudinary } from "cloudinary";

import { AppError } from "../utils/AppError.js";
import { env } from "./env.js";

export const CLOUDINARY_ENV_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
] as const;

/** Names of the Cloudinary variables that are still blank or unset. */
export function missingCloudinaryEnv(): string[] {
  return CLOUDINARY_ENV_VARS.filter((name) => !env[name]);
}

export function isCloudinaryConfigured(): boolean {
  return missingCloudinaryEnv().length === 0;
}

/**
 * Single source of truth for the "Cloudinary is not set up" failure so the
 * upload guard and the upload service return the same 503 response.
 */
export function cloudinaryNotConfiguredError(): AppError {
  return new AppError(
    `Image uploads are disabled because Cloudinary is not configured. Set ${missingCloudinaryEnv().join(", ")} in server/.env and restart the API.`,
    503,
    { code: "CLOUDINARY_NOT_CONFIGURED" }
  );
}

let configured = false;

export function getCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw cloudinaryNotConfiguredError();
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true
    });

    configured = true;
  }

  return cloudinary;
}