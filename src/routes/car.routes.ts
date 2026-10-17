import { Router } from "express";

import { UserRole } from "../generated/prisma/enums.js";
import * as carController from "../controllers/car.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.js";
import { uploadManyImages, requireCloudinaryForFiles } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema, slugParamSchema } from "../validators/common.validator.js";
import {
  createCarSchema,
  listCarsSchema,
  updateCarSchema
} from "../validators/car.validator.js";

export const carRouter = Router();

carRouter.get(
  "/",
  optionalAuthenticate,
  validate({ query: listCarsSchema }),
  carController.listCars
);
carRouter.get("/categories", optionalAuthenticate, carController.getCarFacets);
carRouter.get(
  "/slug/:slug",
  optionalAuthenticate,
  validate({ params: slugParamSchema }),
  carController.getCar
);

const adminOnly = [authenticate, requireRole(UserRole.ADMIN)] as const;

carRouter.post(
  "/",
  ...adminOnly,
  uploadManyImages,
  requireCloudinaryForFiles,
  validate({ body: createCarSchema }),
  carController.createCar
);

carRouter.patch(
  "/:id",
  ...adminOnly,
  uploadManyImages,
  requireCloudinaryForFiles,
  validate({ params: idParamSchema, body: updateCarSchema }),
  carController.updateCar
);

carRouter.delete("/:id", ...adminOnly, validate({ params: idParamSchema }), carController.deleteCar);

carRouter.post(
  "/:id/images",
  ...adminOnly,
  uploadManyImages,
  requireCloudinaryForFiles,
  validate({ params: idParamSchema }),
  carController.addCarImages
);

carRouter.delete(
  "/:id/images/:imageId",
  ...adminOnly,
  validate({ params: idParamSchema }),
  carController.deleteCarImage
);

carRouter.get(
  "/:id",
  optionalAuthenticate,
  validate({ params: idParamSchema }),
  carController.getCar
);