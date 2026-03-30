import { TRPCError } from "@trpc/server";
import { format, startOfDay } from "date-fns";
import { z } from "zod";
import { ActivityType, RentalStatus } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { env } from "~/env";
import { sendEmail } from "~/server/utils/email";
import { getRequestMetadata, logActivity } from "~/server/utils/activity-log";

const packageItemInputSchema = z.object({
  gearItemId: z.string().min(1),
  quantity: z.number().int().min(1),
});

const inventoryItemInputSchema = z.object({
  name: z.string().trim().min(1),
  shortName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  quantity: z.number().int().min(0),
  image: z.string().trim().optional(),
});

const packageInputSchema = z.object({
  name: z.string().trim().min(1),
  shortName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  price: z.number().min(0),
  image: z.string().trim().optional(),
  items: z.array(packageItemInputSchema).min(1),
});

const packageItemInclude = {
  include: {
    gearItem: true,
  },
  orderBy: {
    createdAt: "asc",
  },
} as const;

const gearPackageInclude = {
  items: packageItemInclude,
} as const;

const rentalInclude = {
  gearPackage: {
    include: gearPackageInclude,
  },
} as const;

type IncludedGearPackage = {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  price: number;
  image: string | null;
  items: Array<{
    id: string;
    gearItemId: string;
    gearPackageId: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
    gearItem: {
      id: string;
      name: string;
      shortName: string | null;
      description: string | null;
      quantity: number;
      image: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
};

type IncludedRental = {
  id: string;
  packageId: string;
  userName: string;
  contactInfo: string;
  startDate: Date;
  endDate: Date;
  status: RentalStatus;
  createdAt: Date;
  updatedAt: Date;
  gearPackage: IncludedGearPackage;
};

function eachDayKeyInRange(startDate: Date, endDate: Date) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const keys: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    keys.push(format(current, "yyyy-MM-dd"));
    current.setDate(current.getDate() + 1);
  }

  return keys;
}

function buildUsageByDate(rentals: IncludedRental[]) {
  const usageByDate = new Map<string, Map<string, number>>();

  for (const rental of rentals) {
    for (const dateKey of eachDayKeyInRange(rental.startDate, rental.endDate)) {
      const dayUsage = usageByDate.get(dateKey) ?? new Map<string, number>();

      for (const item of rental.gearPackage.items) {
        dayUsage.set(
          item.gearItemId,
          (dayUsage.get(item.gearItemId) ?? 0) + item.quantity,
        );
      }

      usageByDate.set(dateKey, dayUsage);
    }
  }

  return usageByDate;
}

function getPackageAvailability(
  gearPackage: IncludedGearPackage,
  approvedRentals: IncludedRental[],
  startDate: Date,
  endDate: Date,
) {
  const usageByDate = buildUsageByDate(approvedRentals);
  const conflictingDates = new Set<string>();
  const limitingItems = new Set<string>();

  for (const dateKey of eachDayKeyInRange(startDate, endDate)) {
    const dayUsage = usageByDate.get(dateKey) ?? new Map<string, number>();

    for (const item of gearPackage.items) {
      const alreadyBooked = dayUsage.get(item.gearItemId) ?? 0;
      if (alreadyBooked + item.quantity > item.gearItem.quantity) {
        conflictingDates.add(dateKey);
        limitingItems.add(item.gearItem.name);
      }
    }
  }

  return {
    available: conflictingDates.size === 0,
    conflictingDates: Array.from(conflictingDates).sort(),
    limitingItems: Array.from(limitingItems).sort(),
  };
}

async function getPackageWithItemsOrThrow(
  ctx: { db: typeof import("~/server/db").db },
  packageId: string,
) {
  const gearPackage = await ctx.db.gearPackage.findUnique({
    where: { id: packageId },
    include: gearPackageInclude,
  });

  if (!gearPackage) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Package not found.",
    });
  }

  if (gearPackage.items.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Package has no inventory items configured.",
    });
  }

  return gearPackage as IncludedGearPackage;
}

async function assertPackageAvailabilityOrThrow(
  ctx: { db: typeof import("~/server/db").db },
  packageId: string,
  startDate: Date,
  endDate: Date,
  options?: { excludeRentalId?: string },
) {
  const gearPackage = await getPackageWithItemsOrThrow(ctx, packageId);
  const overlappingApprovedRentals = (await ctx.db.rental.findMany({
    where: {
      status: RentalStatus.APPROVED,
      id: options?.excludeRentalId
        ? { not: options.excludeRentalId }
        : undefined,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      gearPackage: {
        items: {
          some: {
            gearItemId: {
              in: gearPackage.items.map((item) => item.gearItemId),
            },
          },
        },
      },
    },
    include: rentalInclude,
  })) as IncludedRental[];

  const availability = getPackageAvailability(
    gearPackage,
    overlappingApprovedRentals,
    startDate,
    endDate,
  );

  if (!availability.available) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        availability.limitingItems.length > 0
          ? `Package is unavailable for the selected dates because ${availability.limitingItems.join(", ")} is fully booked.`
          : "Package is unavailable for the selected dates.",
    });
  }

  return gearPackage;
}

export const rentalsRouter = createTRPCRouter({
  getPublicPackages: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gearPackage.findMany({
      include: gearPackageInclude,
      orderBy: { name: "asc" },
    });
  }),

  getPublicRentals: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.rental.findMany({
      where: { status: RentalStatus.APPROVED },
      select: {
        id: true,
        packageId: true,
        userName: true,
        startDate: true,
        endDate: true,
        gearPackage: {
          select: {
            id: true,
            name: true,
            shortName: true,
            items: {
              select: {
                id: true,
                gearItemId: true,
                quantity: true,
                gearItem: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    quantity: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { startDate: "asc" },
    });
  }),

  createRentalRequest: publicProcedure
    .input(
      z
        .object({
          packageId: z.string().min(1),
          userName: z.string().trim().min(1),
          contactInfo: z.string().trim().min(1),
          startDate: z.date(),
          endDate: z.date(),
        })
        .refine((input) => input.endDate >= input.startDate, {
          message: "End date must be after start date.",
          path: ["endDate"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const gearPackage = await assertPackageAvailabilityOrThrow(
        ctx,
        input.packageId,
        input.startDate,
        input.endDate,
      );

      const rental = await ctx.db.rental.create({
        data: {
          packageId: input.packageId,
          userName: input.userName,
          contactInfo: input.contactInfo,
          startDate: input.startDate,
          endDate: input.endDate,
          status: RentalStatus.PENDING,
        },
        include: rentalInclude,
      });

      const metadata = await getRequestMetadata();
      await logActivity({
        type: ActivityType.RENTAL_CREATED,
        action: `Rental request created by ${input.userName} for ${gearPackage.name}`,
        details: {
          rentalId: rental.id,
          packageId: gearPackage.id,
        },
        ipAddress: metadata.ipAddress ?? undefined,
        userAgent: metadata.userAgent ?? undefined,
      });

      try {
        const notificationEmailSetting = await ctx.db.keyValueStore.findUnique({
          where: { key: "gearRentalNotification" },
        });

        if (!notificationEmailSetting?.value) {
          throw new Error("Gear rental notification email setting not found");
        }

        const packageBreakdown = gearPackage.items
          .map((item) => `${item.quantity}x ${item.gearItem.name}`)
          .join(", ");

        await sendEmail({
          to: notificationEmailSetting.value,
          subject: `New Gear Rental Request: ${input.userName}`,
          text:
            `A new gear rental request has been submitted.\n\n` +
            `User: ${input.userName}\n` +
            `Contact: ${input.contactInfo}\n` +
            `Package: ${gearPackage.name}\n` +
            `Includes: ${packageBreakdown}\n` +
            `Start Date: ${format(input.startDate, "PPP")}\n` +
            `End Date: ${format(input.endDate, "PPP")}\n\n` +
            `Review this request in the admin dashboard.`,
          html: `
              <h1>New Gear Rental Request</h1>
              <p><strong>User:</strong> ${input.userName}</p>
              <p><strong>Contact:</strong> ${input.contactInfo}</p>
              <p><strong>Package:</strong> ${gearPackage.name}</p>
              <p><strong>Includes:</strong> ${packageBreakdown}</p>
              <p><strong>Start Date:</strong> ${format(input.startDate, "PPP")}</p>
              <p><strong>End Date:</strong> ${format(input.endDate, "PPP")}</p>
              <br/>
              <p><a href="${env.NEXT_PUBLIC_APP_URL}/admin/rentals">Review Request in Admin Dashboard</a></p>
            `,
        });
      } catch (error) {
        console.error("Failed to send rental notification email:", error);
      }

      return rental;
    }),

  adminGetInventoryItems: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.gearItem.findMany({
      include: {
        packageItems: {
          include: {
            gearPackage: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  adminGetPackages: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.gearPackage.findMany({
      include: gearPackageInclude,
      orderBy: { name: "asc" },
    });
  }),

  adminGetRentals: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.rental.findMany({
      include: rentalInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  adminCreateInventoryItem: adminProcedure
    .input(inventoryItemInputSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.gearItem.create({
        data: input,
      });

      await logActivity({
        type: ActivityType.GEAR_CREATED,
        action: `Inventory item created: ${item.name}`,
        details: { gearItemId: item.id },
        userId: ctx.user.id,
      });

      return item;
    }),

  adminUpdateInventoryItem: adminProcedure
    .input(
      inventoryItemInputSchema.partial().extend({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const item = await ctx.db.gearItem.update({
        where: { id },
        data,
      });

      await logActivity({
        type: ActivityType.GEAR_UPDATED,
        action: `Inventory item updated: ${item.name}`,
        details: { gearItemId: item.id },
        userId: ctx.user.id,
      });

      return item;
    }),

  adminDeleteInventoryItem: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.gearItem.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.GEAR_DELETED,
        action: `Inventory item deleted: ${item.name}`,
        details: { gearItemId: item.id },
        userId: ctx.user.id,
      });

      return item;
    }),

  adminCreatePackage: adminProcedure
    .input(packageInputSchema)
    .mutation(async ({ ctx, input }) => {
      const gearPackage = await ctx.db.gearPackage.create({
        data: {
          name: input.name,
          shortName: input.shortName,
          description: input.description,
          price: input.price,
          image: input.image,
          items: {
            create: input.items.map((item) => ({
              gearItemId: item.gearItemId,
              quantity: item.quantity,
            })),
          },
        },
        include: gearPackageInclude,
      });

      await logActivity({
        type: ActivityType.PACKAGE_CREATED,
        action: `Rental package created: ${gearPackage.name}`,
        details: { packageId: gearPackage.id },
        userId: ctx.user.id,
      });

      return gearPackage;
    }),

  adminUpdatePackage: adminProcedure
    .input(
      packageInputSchema.partial().extend({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...data } = input;

      if (items) {
        const duplicateGearItemIds = items
          .map((item) => item.gearItemId)
          .filter(
            (gearItemId, index, allIds) => allIds.indexOf(gearItemId) !== index,
          );

        if (duplicateGearItemIds.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Package items cannot contain duplicate inventory items.",
          });
        }
      }

      const gearPackage = await ctx.db.$transaction(async (tx) => {
        if (items) {
          await tx.gearPackageItem.deleteMany({
            where: { gearPackageId: id },
          });
        }

        return tx.gearPackage.update({
          where: { id },
          data: {
            ...data,
            items: items
              ? {
                  create: items.map((item) => ({
                    gearItemId: item.gearItemId,
                    quantity: item.quantity,
                  })),
                }
              : undefined,
          },
          include: gearPackageInclude,
        });
      });

      await logActivity({
        type: ActivityType.PACKAGE_UPDATED,
        action: `Rental package updated: ${gearPackage.name}`,
        details: { packageId: gearPackage.id },
        userId: ctx.user.id,
      });

      return gearPackage;
    }),

  adminDeletePackage: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const gearPackage = await ctx.db.gearPackage.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.PACKAGE_DELETED,
        action: `Rental package deleted: ${gearPackage.name}`,
        details: { packageId: gearPackage.id },
        userId: ctx.user.id,
      });

      return gearPackage;
    }),

  adminApproveRental: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existingRental = await ctx.db.rental.findUnique({
        where: { id: input.id },
        include: rentalInclude,
      });

      if (!existingRental) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rental request not found.",
        });
      }

      await assertPackageAvailabilityOrThrow(
        ctx,
        existingRental.packageId,
        existingRental.startDate,
        existingRental.endDate,
        { excludeRentalId: existingRental.id },
      );

      const rental = await ctx.db.rental.update({
        where: { id: input.id },
        data: { status: RentalStatus.APPROVED },
        include: rentalInclude,
      });

      await logActivity({
        type: ActivityType.RENTAL_APPROVED,
        action: `Rental approved for ${rental.userName} (${rental.gearPackage.name})`,
        details: { rentalId: rental.id },
        userId: ctx.user.id,
      });

      return rental;
    }),

  adminRejectRental: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rental = await ctx.db.rental.update({
        where: { id: input.id },
        data: { status: RentalStatus.REJECTED },
        include: rentalInclude,
      });

      await logActivity({
        type: ActivityType.RENTAL_REJECTED,
        action: `Rental rejected for ${rental.userName} (${rental.gearPackage.name})`,
        details: { rentalId: rental.id },
        userId: ctx.user.id,
      });

      return rental;
    }),

  adminDeleteRental: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rental = await ctx.db.rental.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.RENTAL_DELETED,
        action: `Rental record deleted for ${rental.userName}`,
        details: { rentalId: rental.id },
        userId: ctx.user.id,
      });

      return rental;
    }),
});
