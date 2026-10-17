import type { Request, Response } from "express";

import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as inquiryService from "../services/inquiry.service.js";
import type {
  CreateInquiryInput,
  ListInquiriesQuery,
  UpdateInquiryStatusInput
} from "../validators/inquiry.validator.js";

export const createInquiry = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await inquiryService.createInquiry(req.body as CreateInquiryInput);

  return sendSuccess(res, {
    status: 201,
    message: "Thank you. Your message has been received.",
    data: { inquiry }
  });
});

export const listInquiries = asyncHandler(async (req: Request, res: Response) => {
  const { inquiries, pagination } = await inquiryService.listInquiries(
    req.query as unknown as ListInquiriesQuery
  );

  return sendSuccess(res, {
    message: "Inquiries retrieved.",
    data: { inquiries },
    meta: { pagination }
  });
});

export const getInquiry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const inquiry = await inquiryService.getInquiryById(id);

  return sendSuccess(res, { message: "Inquiry retrieved.", data: { inquiry } });
});

export const updateInquiryStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const inquiry = await inquiryService.updateInquiryStatus(id, req.body as UpdateInquiryStatusInput);

  return sendSuccess(res, { message: "Inquiry updated.", data: { inquiry } });
});

export const deleteInquiry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  await inquiryService.deleteInquiry(id);

  return sendSuccess(res, { message: "Inquiry deleted.", data: null });
});