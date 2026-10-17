/** Converts a title into a URL friendly slug. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Produces a slug that is not taken by any of the `existingSlugs`,
 * appending `-2`, `-3`, ... when needed.
 */
export function buildUniqueSlug(
  source: string,
  existingSlugs: Iterable<string>,
  fallback = "item"
): string {
  const base = slugify(source) || fallback;
  const taken = new Set(existingSlugs);

  if (!taken.has(base)) return base;

  let suffix = 2;

  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}