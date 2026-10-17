import { z } from "zod";

import { CarStatus } from "../generated/prisma/enums.js";
import { booleanish, optionalTrimmed } from "./common.validator.js";
import { paginationQuerySchema } from "../utils/pagination.js";

const currentYear = new Date().getFullYear();

const yearSchema = z
  .coerce.number()
  .int()
  .min(1900, "Year must be 1900 or later.")
  .max(currentYear + 1, "Year cannot be in the future.");

const priceSchema = z.coerce.number().positive("Price must be greater than zero.");

const carBaseShape = {
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(160),
  brand: z.string().trim().min(1, "Brand is required.").max(80),
  model: z.string().trim().min(1, "Model is required.").max(80),
  category: optionalTrimmed(60),
  year: yearSchema,
  price: priceSchema,
  mileage: z.coerce.number().int().min(0).max(2_000_000).default(0),
  fuelType: optionalTrimmed(60),
  transmission: optionalTrimmed(60),
  condition: optionalTrimmed(60),
  description: optionalTrimmed(8000),
  status: z.enum(CarStatus).default(CarStatus.AVAILABLE),
  featured: booleanish(false),
  isPublished: booleanish(true)
};

export const createCarSchema = z.object(carBaseShape);

export const updateCarSchema = z
  .object({
    title: carBaseShape.title.optional(),
    brand: carBaseShape.brand.optional(),
    model: carBaseShape.model.optional(),
    year: yearSchema.optional(),
    price: z.coerce.number().positive().optional(),
    mileage: z.coerce.number().int().min(0).max(2_000_000).optional(),
    fuelType: carBaseShape.fuelType,
    transmission: carBaseShape.transmission,
    condition: carBaseShape.condition,
    description: carBaseShape.description,
    status: z.enum(CarStatus).optional(),
    featured: booleanish(),
    isPublished: booleanish(),
    category: carBaseShape.category
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided."
  });

export const carSortEnum = z.enum([
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "year_desc",
  "year_asc",
  "mileage_asc"
]);

export const listCarsSchema = paginationQuerySchema
  .extend({
    search: optionalTrimmed(120),
    brand: optionalTrimmed(80),
    category: optionalTrimmed(60),
    status: z.enum(CarStatus).optional(),
    featured: booleanish(),
    isPublished: booleanish(),
    /** Admin-only: return published and unpublished vehicles together. */
    includeUnpublished: booleanish(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    minYear: z.coerce.number().int().min(1900).optional(),
    maxYear: z.coerce.number().int().min(1900).optional(),
    sort: carSortEnum.default("newest")
  })
  .refine(
    (data) => data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice,
    { message: "minPrice cannot be greater than maxPrice.", path: ["minPrice"] }
  )
  .refine(
    (data) => data.minYear === undefined || data.maxYear === undefined || data.minYear <= data.maxYear,
    { message: "minYear cannot be greater than maxYear.", path: ["minYear"] }
  );

export type CreateCarInput = z.infer<typeof createCarSchema>;
export type UpdateCarInput = z.infer<typeof updateCarSchema>;
export type ListCarsQuery = z.infer<typeof listCarsSchema>;