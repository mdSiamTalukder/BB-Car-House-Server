import type { Prisma } from "../generated/prisma/client.js";
import { Prisma as PrismaNS } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { CreateCarInput, ListCarsQuery, UpdateCarInput } from "../validators/car.validator.js";
import { notFound, unprocessable } from "../utils/AppError.js";
import { buildPaginationMeta } from "../utils/apiResponse.js";
import { decimalToNumber } from "../utils/decimal.js";
import { handleKnownPrismaError } from "../utils/prismaErrors.js";
import { buildUniqueSlug, slugify } from "../utils/slug.js";
import { toSkip } from "../utils/pagination.js";
import { destroyImage, uploadImage } from "./image.service.js";

const carInclude = {
  images: { orderBy: { sortOrder: "asc" } }
} satisfies Prisma.CarInclude;

type CarWithImages = Prisma.CarGetPayload<{ include: typeof carInclude }>;

export interface CarDto {
  id: string;
  title: string;
  slug: string;
  brand: string;
  model: string;
  category: string | null;
  year: number;
  price: number;
  mileage: number;
  fuelType: string | null;
  transmission: string | null;
  condition: string | null;
  description: string | null;
  status: string;
  featured: boolean;
  isPublished: boolean;
  images: { id: string; url: string; publicId: string; alt: string | null; sortOrder: number }[];
  createdAt: Date;
  updatedAt: Date;
}

export function toCarDto(car: CarWithImages): CarDto {
  return {
    ...car,
    price: decimalToNumber(car.price),
    images: car.images.map(({ id, url, publicId, alt, sortOrder }) => ({
      id,
      url,
      publicId,
      alt,
      sortOrder
    }))
  };
}

const orderByMap: Record<ListCarsQuery["sort"], Prisma.CarOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  year_desc: { year: "desc" },
  year_asc: { year: "asc" },
  mileage_asc: { mileage: "asc" }
};

async function generateUniqueSlug(source: string): Promise<string> {
  const base = slugify(source) || "car";

  const taken = await prisma.car.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true }
  });

  return buildUniqueSlug(
    source,
    taken.map((car) => car.slug),
    "car"
  );
}

export async function listCars(query: ListCarsQuery, options: { isAdmin?: boolean } = {}) {
  const where: Prisma.CarWhereInput = {};
  const isAdmin = options.isAdmin ?? false;

  if (query.status) where.status = query.status;
  if (query.featured !== undefined) where.featured = query.featured;

  // Unpublished vehicles are only reachable by an authenticated admin.
  if (isAdmin) {
    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    } else if (!query.includeUnpublished) {
      where.isPublished = true;
    }
  } else {
    where.isPublished = true;
  }

  if (query.category) {
    where.category = { equals: query.category, mode: "insensitive" };
  }

  if (query.brand) {
    where.brand = { equals: query.brand, mode: "insensitive" };
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { brand: { contains: query.search, mode: "insensitive" } },
      { model: { contains: query.search, mode: "insensitive" } },
      { category: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } }
    ];
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {
      ...(query.minPrice !== undefined ? { gte: new PrismaNS.Decimal(query.minPrice) } : {}),
      ...(query.maxPrice !== undefined ? { lte: new PrismaNS.Decimal(query.maxPrice) } : {})
    };
  }

  if (query.minYear !== undefined || query.maxYear !== undefined) {
    where.year = {
      ...(query.minYear !== undefined ? { gte: query.minYear } : {}),
      ...(query.maxYear !== undefined ? { lte: query.maxYear } : {})
    };
  }

  const skip = toSkip(query.pageSize, query.page);

  try {
    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where,
        include: carInclude,
        orderBy: orderByMap[query.sort],
        skip,
        take: query.pageSize
      }),
      prisma.car.count({ where })
    ]);

    return {
      cars: cars.map(toCarDto),
      pagination: buildPaginationMeta(query.page, query.pageSize, total)
    };
  } catch (error) {
    handleKnownPrismaError(error);
  }
}

export async function getCarById(id: string, options: { isAdmin?: boolean } = {}): Promise<CarDto> {
  const car = await prisma.car.findUnique({ where: { id }, include: carInclude });

  if (!car || (!car.isPublished && !options.isAdmin)) throw notFound("Car");

  return toCarDto(car);
}

export async function getCarBySlug(slug: string, options: { isAdmin?: boolean } = {}): Promise<CarDto> {
  const car = await prisma.car.findUnique({ where: { slug }, include: carInclude });

  if (!car || (!car.isPublished && !options.isAdmin)) throw notFound("Car");

  return toCarDto(car);
}

/**
 * Distinct category and brand values used to populate public and admin filters.
 * Unpublished vehicles are only included for admins.
 */
export async function getCarFacets(options: { isAdmin?: boolean } = {}) {
  const where: Prisma.CarWhereInput = options.isAdmin ? {} : { isPublished: true };

  const [categories, brands] = await Promise.all([
    prisma.car.findMany({
      where: { ...where, category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" }
    }),
    prisma.car.findMany({
      where,
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" }
    })
  ]);

  return {
    categories: categories.map((row) => row.category).filter((value): value is string => Boolean(value)),
    brands: brands.map((row) => row.brand)
  };
}

async function storeUploadedImages(
  carId: string,
  files: Express.Multer.File[]
): Promise<void> {
  const existing = await prisma.carImage.count({ where: { carId } });

  const uploaded = await Promise.all(
    files.map(async (file, index) => {
      const stored = await uploadImage(file);
      return { carId, url: stored.url, publicId: stored.publicId, sortOrder: existing + index };
    })
  );

  if (uploaded.length > 0) {
    await prisma.carImage.createMany({ data: uploaded });
  }
}

export async function createCar(input: CreateCarInput, files: Express.Multer.File[] = []): Promise<CarDto> {
  const slug = await generateUniqueSlug(input.title);

  // Upload first so a failed insert can still roll the Cloudinary assets back.
  const uploaded = await Promise.all(files.map((file) => uploadImage(file)));

  try {
    const car = await prisma.car.create({
      data: {
        title: input.title,
        slug,
        brand: input.brand,
        model: input.model,
        category: input.category ?? null,
        year: input.year,
        price: new PrismaNS.Decimal(input.price),
        mileage: input.mileage,
        fuelType: input.fuelType ?? null,
        transmission: input.transmission ?? null,
        condition: input.condition ?? null,
        description: input.description ?? null,
        status: input.status,
        featured: input.featured,
        isPublished: input.isPublished,
        images: {
          create: uploaded.map((stored, index) => ({
            url: stored.url,
            publicId: stored.publicId,
            sortOrder: index
          }))
        }
      },
      include: carInclude
    });

    return toCarDto(car);
  } catch (error) {
    await Promise.all(uploaded.map((stored) => destroyImage(stored.publicId)));
    handleKnownPrismaError(error);
  }
}

export async function updateCar(id: string, input: UpdateCarInput, files: Express.Multer.File[] = []): Promise<CarDto> {
  const existing = await prisma.car.findUnique({ where: { id }, select: { id: true } });

  if (!existing) throw notFound("Car");

  const data: Prisma.CarUpdateInput = {};

  if (input.title !== undefined) {
    data.title = input.title;
    data.slug = await generateUniqueSlug(input.title);
  }

  if (input.brand !== undefined) data.brand = input.brand;
  if (input.model !== undefined) data.model = input.model;
  if (input.year !== undefined) data.year = input.year;
  if (input.price !== undefined) data.price = new PrismaNS.Decimal(input.price);
  if (input.mileage !== undefined) data.mileage = input.mileage;
  if (input.status !== undefined) data.status = input.status;
  if (input.featured !== undefined) data.featured = input.featured;
  if (input.isPublished !== undefined) data.isPublished = input.isPublished;

  for (const field of ["category", "fuelType", "transmission", "condition", "description"] as const) {
    const value = input[field];
    if (value !== undefined) data[field] = value === "" ? null : value;
  }

  let car: CarWithImages;

  try {
    car = await prisma.car.update({ where: { id }, data, include: carInclude });
  } catch (error) {
    handleKnownPrismaError(error);
  }

  if (files.length > 0) {
    await storeUploadedImages(id, files);
    car = await prisma.car.findUniqueOrThrow({ where: { id }, include: carInclude });
  }

  return toCarDto(car);
}

export async function addCarImages(id: string, files: Express.Multer.File[]): Promise<CarDto> {
  const existing = await prisma.car.findUnique({ where: { id }, select: { id: true } });

  if (!existing) throw notFound("Car");

  if (files.length === 0) {
    throw unprocessable("No image files were received. Use the \"images\" field.");
  }

  await storeUploadedImages(id, files);

  const car = await prisma.car.findUniqueOrThrow({ where: { id }, include: carInclude });

  return toCarDto(car);
}

export async function deleteCarImage(carId: string, imageId: string): Promise<CarDto> {
  const image = await prisma.carImage.findFirst({ where: { id: imageId, carId } });

  if (!image) throw notFound("Car image");

  try {
    await prisma.carImage.delete({ where: { id: imageId } });
  } catch (error) {
    handleKnownPrismaError(error);
  }

  await destroyImage(image.publicId);

  return getCarById(carId);
}

export async function deleteCar(id: string): Promise<void> {
  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, images: { select: { publicId: true } } }
  });

  if (!car) throw notFound("Car");

  try {
    await prisma.car.delete({ where: { id } });
  } catch (error) {
    handleKnownPrismaError(error);
  }

  await Promise.all(car.images.map((image) => destroyImage(image.publicId)));
}