import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";

import { cloudinaryNotConfiguredError, isCloudinaryConfigured } from "../config/cloudinary.js";
import { allowedUploadMimeTypes, maxUploadSizeBytes } from "../config/env.js";
import { unprocessable } from "../utils/AppError.js";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (!allowedUploadMimeTypes.includes(file.mimetype.toLowerCase())) {
    callback(
      unprocessable(
        `Unsupported file type "${file.mimetype}". Allowed: ${allowedUploadMimeTypes.join(", ")}.`
      )
    );
    return;
  }

  callback(null, true);
};

export const uploadSingleImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxUploadSizeBytes,
    files: 1
  }
}).single("image");

export const uploadManyImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxUploadSizeBytes,
    files: 10
  }
}).array("images", 10);

function countUploadedFiles(req: Request): number {
  const value = req.files;

  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if ("fieldname" in value) return 1;

  return Object.values(value).reduce((total, files) => total + files.length, 0);
}

/**
 * Rejects only requests that actually carry an image. Creating or updating a
 * car without pictures keeps working when Cloudinary is not configured.
 */
export const requireCloudinaryForFiles: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (countUploadedFiles(req) > 0 && !isCloudinaryConfigured()) {
    next(cloudinaryNotConfiguredError());
    return;
  }

  next();
};