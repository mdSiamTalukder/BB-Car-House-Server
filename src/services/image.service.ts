import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import { cloudinaryNotConfiguredError, getCloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export interface StoredImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

function uploadStream(
  buffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(
          new AppError(error.message || "Image upload failed.", 502, {
            code: "IMAGE_UPLOAD_FAILED",
            cause: error
          })
        );
        return;
      }

      if (!result) {
        reject(new AppError("Image upload returned an empty response.", 502));
        return;
      }

      resolve(result);
    });

    stream.end(buffer);
  });
}

/**
 * Uploads one buffered image to Cloudinary.
 *
 * When Cloudinary is not configured this rejects with a 503 `AppError` before
 * any network call is made, so the caller surfaces a clear HTTP response
 * instead of failing with an opaque SDK error.
 */
export async function uploadImage(
  file: Express.Multer.File,
  options: { folder?: string; publicId?: string } = {}
): Promise<StoredImage> {
  if (!isCloudinaryConfigured()) {
    throw cloudinaryNotConfiguredError();
  }

  const result = await uploadStream(file.buffer, {
    folder: options.folder ?? env.CLOUDINARY_FOLDER,
    resource_type: "image",
    ...(options.publicId ? { public_id: options.publicId, overwrite: true } : {}),
    transformation: [{ quality: "auto", fetch_format: "auto" }]
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes
  };
}

/**
 * Deletes an asset from Cloudinary. Never throws: a stale database row is worse
 * than an orphaned asset, so failures are logged and the caller continues.
 */
export async function destroyImage(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  try {
    const result = await getCloudinary().uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true
    });

    return result.result === "ok" || result.result === "not found";
  } catch (error) {
    console.error(`[cloudinary] failed to destroy "${publicId}"`, error);
    return false;
  }
}