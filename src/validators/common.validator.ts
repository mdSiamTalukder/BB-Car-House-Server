import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().min(1, "Identifier is required.")
});

export const slugParamSchema = z.object({
  slug: z.string().min(1, "Slug is required.")
});

/**
 * Accepts real booleans plus the string forms used in query strings and
 * `multipart/form-data`. `z.coerce.boolean()` is avoided because it turns the
 * string `"false"` into `true`.
 */
export const booleanish = (defaultValue?: boolean) => {
  const base = z.union([z.boolean(), z.enum(["true", "false", "1", "0", "on", "off", "yes", "no"])]);

  const transformed = base.transform((value) =>
    typeof value === "boolean" ? value : ["true", "1", "on", "yes"].includes(value.toLowerCase())
  );

  return defaultValue === undefined ? transformed.optional() : transformed.default(defaultValue);
};

/** Trimmed optional string that treats an empty string as "not provided". */
export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

/**
 * Trimmed optional string that also enforces a minimum length.
 *
 * The empty-string check runs first (via `z.preprocess`), so a blank or
 * whitespace-only value is treated as "not provided" instead of failing the
 * minimum-length check. This avoids the classic `z.string().min(6).optional()`
 * bug where `""` is a 422 even though the field is optional.
 */
export const optionalTrimmedMin = (min: number, max: number, message?: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(min, message).max(max).optional()
  );