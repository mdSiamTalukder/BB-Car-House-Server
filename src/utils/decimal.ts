interface DecimalLike {
  toNumber: () => number;
}

/** Prisma `Decimal` values are serialised as numbers so the API stays JSON friendly. */
export function decimalToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof (value as DecimalLike).toNumber === "function") {
    return (value as DecimalLike).toNumber();
  }

  return Number(value ?? 0);
}