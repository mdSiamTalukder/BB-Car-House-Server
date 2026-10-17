import type { Request, Response } from "express";

import { UserRole } from "../generated/prisma/enums.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as carService from "../services/car.service.js";
import type { CreateCarInput, ListCarsQuery, UpdateCarInput } from "../validators/car.validator.js";

const isAdminRequest = (req: Request) => req.user?.role === UserRole.ADMIN;

/** Multer populates `req.files` as an array or a single object depending on the route. */
function uploadedFiles(req: Request): Express.Multer.File[] {
  const value = req.files as
    | Express.Multer.File[]
    | Express.Multer.File
    | Record<string, Express.Multer.File[]>
    | undefined;

  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter((file) => file.fieldname === "images" || file.fieldname === "image");
  }

  if ("fieldname" in value) {
    return [value as Express.Multer.File];
  }

  return Object.values(value).flat();
}

export const listCars = asyncHandler(async (req: Request, res: Response) => {
  const { cars, pagination } = await carService.listCars(req.query as unknown as ListCarsQuery, {
    isAdmin: isAdminRequest(req)
  });

  return sendSuccess(res, {
    message: "Cars retrieved.",
    data: { cars },
    meta: { pagination }
  });
});

export const getCarFacets = asyncHandler(async (req: Request, res: Response) => {
  const facets = await carService.getCarFacets({ isAdmin: isAdminRequest(req) });

  return sendSuccess(res, { message: "Car facets retrieved.", data: facets });
});

export const getCar = asyncHandler(async (req: Request, res: Response) => {
  const { id, slug } = req.params as { id?: string; slug?: string };
  const options = { isAdmin: isAdminRequest(req) };

  const car = id
    ? await carService.getCarById(id, options)
    : await carService.getCarBySlug(slug!, options);

  return sendSuccess(res, { message: "Car retrieved.", data: { car } });
});

export const createCar = asyncHandler(async (req: Request, res: Response) => {
  const car = await carService.createCar(req.body as CreateCarInput, uploadedFiles(req));

  return sendSuccess(res, {
    status: 201,
    message: "Car created successfully.",
    data: { car }
  });
});

export const updateCar = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const car = await carService.updateCar(id, req.body as UpdateCarInput, uploadedFiles(req));

  return sendSuccess(res, { message: "Car updated successfully.", data: { car } });
});

export const deleteCar = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  await carService.deleteCar(id);

  return sendSuccess(res, { message: "Car deleted successfully.", data: null });
});

export const addCarImages = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const car = await carService.addCarImages(id, uploadedFiles(req));

  return sendSuccess(res, { status: 201, message: "Images uploaded.", data: { car } });
});

export const deleteCarImage = asyncHandler(async (req: Request, res: Response) => {
  const { id, imageId } = req.params as { id: string; imageId: string };

  const car = await carService.deleteCarImage(id, imageId);

  return sendSuccess(res, { message: "Image removed.", data: { car } });
});