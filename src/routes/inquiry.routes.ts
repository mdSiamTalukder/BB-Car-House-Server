import { Router } from "express";

import { UserRole } from "../generated/prisma/enums.js";
import * as inquiryController from "../controllers/inquiry.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../validators/common.validator.js";
import {
  createInquirySchema,
  listInquiriesSchema,
  updateInquiryStatusSchema
} from "../validators/inquiry.validator.js";

export const inquiryRouter = Router();

/** Public contact form submission. */
inquiryRouter.post("/", validate({ body: createInquirySchema }), inquiryController.createInquiry);

inquiryRouter.use(authenticate, requireRole(UserRole.ADMIN));

inquiryRouter.get("/", validate({ query: listInquiriesSchema }), inquiryController.listInquiries);
inquiryRouter.get("/:id", validate({ params: idParamSchema }), inquiryController.getInquiry);
inquiryRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateInquiryStatusSchema }),
  inquiryController.updateInquiryStatus
);
inquiryRouter.delete("/:id", validate({ params: idParamSchema }), inquiryController.deleteInquiry);