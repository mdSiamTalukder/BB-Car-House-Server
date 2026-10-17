import type { Request, RequestHandler, Response } from "express";

import { AppError } from "../utils/AppError.js";

interface Options {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed per window and key. */
  max: number;
  /** Builds the bucket key. Defaults to the client IP address. */
  keyGenerator?: (req: Request) => string;
  /** Message used in the 429 response. */
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small dependency-free fixed-window rate limiter used to slow down credential
 * brute forcing on the login endpoint. State is kept in memory, which is enough
 * for a single API instance; a shared store would be needed for multi-instance
 * deployments.
 */
export function rateLimit(options: Options): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next) => {
    const now = Date.now();
    const key = options.keyGenerator?.(req) ?? req.ip ?? "unknown";

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, options.max - bucket.count);

    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      res.setHeader("Retry-After", String(retryAfter));

      next(
        new AppError(options.message ?? "Too many requests. Please try again later.", 429, {
          code: "TOO_MANY_REQUESTS",
          details: { retryAfter }
        })
      );
      return;
    }

    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    next();
  };
}
