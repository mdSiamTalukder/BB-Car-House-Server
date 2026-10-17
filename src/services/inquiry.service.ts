import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type {
  CreateInquiryInput,
  ListInquiriesQuery,
  UpdateInquiryStatusInput
} from "../validators/inquiry.validator.js";
import { notFound } from "../utils/AppError.js";
import { buildPaginationMeta } from "../utils/apiResponse.js";
import { handleKnownPrismaError } from "../utils/prismaErrors.js";
import { toSkip } from "../utils/pagination.js";

const carSummarySelect = {
  id: true,
  title: true,
  slug: true,
  brand: true,
  model: true,
  year: true
} satisfies Prisma.CarSelect;

const inquiryInclude = {
  car: { select: carSummarySelect }
} satisfies Prisma.InquiryInclude;

export async function createInquiry(input: CreateInquiryInput) {
  if (input.carId) {
    // `carId` comes from the client, so re-validate it against the database.
    // Only published cars are publicly reachable, so an inquiry may only be
    // linked to one — an unpublished/deleted id is treated as "not found".
    const car = await prisma.car.findFirst({
      where: { id: input.carId, isPublished: true },
      select: { id: true }
    });

    if (!car) {
      throw notFound("Car referenced by the inquiry");
    }
  }

  try {
    return await prisma.inquiry.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        message: input.message,
        carId: input.carId ?? null
      },
      include: inquiryInclude
    });
  } catch (error) {
    handleKnownPrismaError(error);
  }
}

export async function listInquiries(query: ListInquiriesQuery) {
  const where: Prisma.InquiryWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.carId) where.carId = query.carId;

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { message: { contains: query.search, mode: "insensitive" } }
    ];
  }

  const orderBy: Prisma.InquiryOrderByWithRelationInput =
    query.sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" };

  try {
    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: inquiryInclude,
        orderBy,
        skip: toSkip(query.pageSize, query.page),
        take: query.pageSize
      }),
      prisma.inquiry.count({ where })
    ]);

    return {
      inquiries,
      pagination: buildPaginationMeta(query.page, query.pageSize, total)
    };
  } catch (error) {
    handleKnownPrismaError(error);
  }
}

export async function getInquiryById(id: string) {
  const inquiry = await prisma.inquiry.findUnique({ where: { id }, include: inquiryInclude });

  if (!inquiry) throw notFound("Inquiry");

  return inquiry;
}

export async function updateInquiryStatus(id: string, input: UpdateInquiryStatusInput) {
  const existing = await prisma.inquiry.findUnique({ where: { id }, select: { id: true } });

  if (!existing) throw notFound("Inquiry");

  const data: Prisma.InquiryUpdateInput = { status: input.status };

  if (input.carId !== undefined) {
    if (input.carId === null) {
      data.car = { disconnect: true };
    } else {
      const car = await prisma.car.findUnique({ where: { id: input.carId }, select: { id: true } });

      if (!car) throw notFound("Car referenced by the inquiry");

      data.car = { connect: { id: input.carId } };
    }
  }

  try {
    return await prisma.inquiry.update({ where: { id }, data, include: inquiryInclude });
  } catch (error) {
    handleKnownPrismaError(error);
  }
}

export async function deleteInquiry(id: string): Promise<void> {
  try {
    await prisma.inquiry.delete({ where: { id } });
  } catch (error) {
    handleKnownPrismaError(error);
  }
}