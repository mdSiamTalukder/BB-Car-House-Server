import { z } from "zod";

import { InquiryStatus } from "../generated/prisma/enums.js";
import { booleanish, optionalTrimmed, optionalTrimmedMin } from "./common.validator.js";
import { paginationQuerySchema } from "../utils/pagination.js";

export const createInquirySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("A valid email address is required.")),
  // Optional: a blank or whitespace-only phone is "not provided", not a 422.
  phone: optionalTrimmedMin(6, 32, "Phone number looks too short."),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(5000),
  // Optional car association. A blank `carId` is ignored rather than rejected;
  // the service re-validates that the id resolves to a real, published car.
  carId: optionalTrimmed(64)
});

export const updateInquiryStatusSchema = z.object({
  status: z.enum(InquiryStatus),
  carId: z.string().trim().min(1).nullable().optional()
});

export const listInquiriesSchema = paginationQuerySchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(InquiryStatus).optional(),
  carId: z.string().trim().min(1).optional(),
  search: optionalTrimmed(120),
  sort: z.enum(["newest", "oldest"]).default("newest")
});

export const dashboardQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
  recentLimit: z.coerce.number().int().min(1).max(50).default(5),
  includeInactive: booleanish(false)
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type UpdateInquiryStatusInput = z.infer<typeof updateInquiryStatusSchema>;
export type ListInquiriesQuery = z.infer<typeof listInquiriesSchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;