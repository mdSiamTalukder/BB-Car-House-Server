import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code?: string;
  errors?: unknown;
  stack?: string;
}

interface SendSuccessOptions<T> {
  status?: number;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(res: Response, options: SendSuccessOptions<T>): Response {
  const body: ApiSuccessBody<T> = {
    success: true,
    message: options.message ?? "OK",
    data: options.data
  };

  if (options.meta) {
    body.meta = options.meta;
  }

  return res.status(options.status ?? 200).json(body);
}

interface SendErrorOptions {
  status: number;
  message: string;
  code?: string;
  errors?: unknown;
  stack?: string;
}

export function sendError(res: Response, options: SendErrorOptions): Response {
  const body: ApiErrorBody = {
    success: false,
    message: options.message
  };

  if (options.code) body.code = options.code;
  if (options.errors !== undefined) body.errors = options.errors;
  if (options.stack) body.stack = options.stack;

  return res.status(options.status).json(body);
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}