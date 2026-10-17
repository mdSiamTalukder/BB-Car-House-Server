import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { DashboardQuery } from "../validators/inquiry.validator.js";
import { decimalToNumber } from "../utils/decimal.js";

const carSummarySelect = {
  id: true,
  title: true,
  slug: true,
  brand: true,
  model: true,
  category: true,
  year: true,
  price: true,
  status: true,
  featured: true,
  isPublished: true,
  mileage: true,
  createdAt: true
} satisfies Prisma.CarSelect;

const inquirySummarySelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  status: true,
  createdAt: true
} satisfies Prisma.InquirySelect;

/** Builds an array of `months` ISO month-start timestamps ending with the current month. */
function recentMonthBuckets(months: number): Date[] {
  const now = new Date();
  const buckets: Date[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    buckets.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)));
  }

  return buckets;
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboardStats(query: DashboardQuery) {
  const now = new Date();
  const monthBuckets = recentMonthBuckets(query.months);
  const since = monthBuckets[0];
  const carWhere: Prisma.CarWhereInput = query.includeInactive ? {} : { status: "AVAILABLE" };

  const [
    totalCars,
    availableCars,
    reservedCars,
    soldCars,
    featuredCars,
    publishedCars,
    unpublishedCars,
    totalInquiries,
    newInquiries,
    contactedInquiries,
    closedInquiries,
    carAggregate,
    carsSince,
    inquiriesSince,
    recentCars,
    recentInquiries
  ] = await Promise.all([
    prisma.car.count(),
    prisma.car.count({ where: { status: "AVAILABLE" } }),
    prisma.car.count({ where: { status: "RESERVED" } }),
    prisma.car.count({ where: { status: "SOLD" } }),
    prisma.car.count({ where: { featured: true } }),
    prisma.car.count({ where: { isPublished: true } }),
    prisma.car.count({ where: { isPublished: false } }),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { status: "NEW" } }),
    prisma.inquiry.count({ where: { status: "CONTACTED" } }),
    prisma.inquiry.count({ where: { status: "CLOSED" } }),
    prisma.car.aggregate({
      where: carWhere,
      _avg: { price: true, mileage: true, year: true },
      _sum: { price: true }
    }),
    prisma.car.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, price: true, status: true }
    }),
    prisma.inquiry.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true }
    }),
    prisma.car.findMany({
      orderBy: { createdAt: "desc" },
      take: query.recentLimit,
      select: carSummarySelect
    }),
    prisma.inquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: query.recentLimit,
      select: inquirySummarySelect
    })
  ]);

  const carCounts = new Map<string, { added: number; inventoryValue: number }>(
    monthBuckets.map((bucket) => [toMonthKey(bucket), { added: 0, inventoryValue: 0 }])
  );

  for (const car of carsSince) {
    const bucket = carCounts.get(toMonthKey(car.createdAt));

    if (!bucket) continue;

    bucket.added += 1;
    bucket.inventoryValue += decimalToNumber(car.price);
  }

  const inquiryCounts = new Map<string, { received: number; closed: number }>(
    monthBuckets.map((bucket) => [toMonthKey(bucket), { received: 0, closed: 0 }])
  );

  for (const inquiry of inquiriesSince) {
    const bucket = inquiryCounts.get(toMonthKey(inquiry.createdAt));

    if (!bucket) continue;

    bucket.received += 1;
    if (inquiry.status === "CLOSED") bucket.closed += 1;
  }

  return {
    generatedAt: now.toISOString(),
    cars: {
      total: totalCars,
      available: availableCars,
      reserved: reservedCars,
      sold: soldCars,
      featured: featuredCars,
      published: publishedCars,
      unpublished: unpublishedCars,
      averagePrice: carAggregate._avg.price ? decimalToNumber(carAggregate._avg.price) : 0,
      averageMileage: carAggregate._avg.mileage ?? 0,
      averageYear: carAggregate._avg.year ?? 0,
      inventoryValue: carAggregate._sum.price ? decimalToNumber(carAggregate._sum.price) : 0
    },
    inquiries: {
      total: totalInquiries,
      new: newInquiries,
      contacted: contactedInquiries,
      closed: closedInquiries,
      responseRate:
        totalInquiries === 0 ? 0 : Number((((contactedInquiries + closedInquiries) / totalInquiries) * 100).toFixed(1))
    },
    trend: monthBuckets.map((bucket) => {
      const key = toMonthKey(bucket);

      return {
        month: key,
        carsAdded: carCounts.get(key)?.added ?? 0,
        inquiriesReceived: inquiryCounts.get(key)?.received ?? 0,
        inquiriesClosed: inquiryCounts.get(key)?.closed ?? 0,
        inventoryValue: carCounts.get(key)?.inventoryValue ?? 0
      };
    }),
    recentCars: recentCars.map((car) => ({ ...car, price: decimalToNumber(car.price) })),
    recentInquiries
  };
}