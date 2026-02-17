import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { RentalStatus, ActivityType } from "~Prisma/client";
import { logActivity, getRequestMetadata } from "~/server/utils/activity-log";
import { sendEmail } from "~/server/utils/email";
import { format } from "date-fns";
import { env } from "~/env";

export const rentalsRouter = createTRPCRouter({
  // Public procedures
  getAllGear: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gearItem.findMany({
      orderBy: { name: "asc" },
    });
  }),

  getPublicRentals: publicProcedure.query(async ({ ctx }) => {
    // Only return approved rentals for the public calendar
    // Hidden contactInfo
    const rentals = await ctx.db.rental.findMany({
      where: { status: RentalStatus.APPROVED },
      select: {
        id: true,
        gearItemId: true,
        userName: true,
        startDate: true,
        endDate: true,
      },
    });
    return rentals;
  }),

  createRentalRequest: publicProcedure
    .input(
      z.object({
        gearItemIds: z.array(z.string()).min(1),
        userName: z.string().min(1),
        contactInfo: z.string().min(1),
        startDate: z.date(),
        endDate: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { gearItemIds, ...rest } = input;

      const rentals = await ctx.db.$transaction(
        gearItemIds.map((gearItemId) =>
          ctx.db.rental.create({
            data: {
              ...rest,
              gearItemId,
              status: RentalStatus.PENDING,
            },
          })
        )
      );

      const metadata = await getRequestMetadata();
      await logActivity({
        type: ActivityType.RENTAL_CREATED,
        action: `Rental request created by ${input.userName} for ${gearItemIds.length} items`,
        details: { rentalIds: rentals.map(r => r.id), gearItemIds },
        ipAddress: metadata.ipAddress ?? undefined,
        userAgent: metadata.userAgent ?? undefined,
      });

      // Send email notification
      try {
        const notificationEmailSetting = await ctx.db.keyValueStore.findUnique({
          where: { key: "gearRentalNotification" },
        });

        if (!notificationEmailSetting?.value) {
          throw new Error("Gear rental notification email setting not found");
        }

        const gearItems = await ctx.db.gearItem.findMany({
          where: { id: { in: gearItemIds } },
        });
        const gearNames = gearItems.map((g) => g.name).join(", ");

        await sendEmail({
          to: notificationEmailSetting.value,
          subject: `New Gear Rental Request: ${input.userName}`,
          text: `A new gear rental request has been submitted.\n\n` +
            `User: ${input.userName}\n` +
            `Contact: ${input.contactInfo}\n` +
            `Gear: ${gearNames}\n` +
            `Start Date: ${format(input.startDate, "PPP")}\n` +
            `End Date: ${format(input.endDate, "PPP")}\n\n` +
            `Review this request in the admin dashboard.`,
          html: `
              <h1>New Gear Rental Request</h1>
              <p><strong>User:</strong> ${input.userName}</p>
              <p><strong>Contact:</strong> ${input.contactInfo}</p>
              <p><strong>Gear:</strong> ${gearNames}</p>
              <p><strong>Start Date:</strong> ${format(input.startDate, "PPP")}</p>
              <p><strong>End Date:</strong> ${format(input.endDate, "PPP")}</p>
              <br/>
              <p><a href="${env.NEXT_PUBLIC_APP_URL}/admin/rentals">Review Request in Admin Dashboard</a></p>
            `,
        });

      } catch (error) {
        console.error("Failed to send rental notification email:", error);
      }

      return rentals;
    }),

  // Admin procedures
  adminGetRentals: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.rental.findMany({
      include: {
        gearItem: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  adminCreateGear: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().min(0),
        image: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const gear = await ctx.db.gearItem.create({
        data: input,
      });

      await logActivity({
        type: ActivityType.GEAR_CREATED,
        action: `Gear item created: ${input.name}`,
        details: { gearId: gear.id },
        userId: ctx.user.id,
      });

      return gear;
    }),

  adminUpdateGear: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        price: z.number().min(0).optional(),
        image: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const gear = await ctx.db.gearItem.update({
        where: { id },
        data,
      });

      await logActivity({
        type: ActivityType.GEAR_UPDATED,
        action: `Gear item updated: ${gear.name}`,
        details: { gearId: gear.id },
        userId: ctx.user.id,
      });

      return gear;
    }),

  adminDeleteGear: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gear = await ctx.db.gearItem.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.GEAR_DELETED,
        action: `Gear item deleted: ${gear.name}`,
        details: { gearId: gear.id },
        userId: ctx.user.id,
      });

      return gear;
    }),

  adminApproveRental: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rental = await ctx.db.rental.update({
        where: { id: input.id },
        data: { status: RentalStatus.APPROVED },
        include: { gearItem: true },
      });

      await logActivity({
        type: ActivityType.RENTAL_APPROVED,
        action: `Rental approved for ${rental.userName} (${rental.gearItem.name})`,
        details: { rentalId: rental.id },
        userId: ctx.user.id,
      });

      return rental;
    }),

  adminRejectRental: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rental = await ctx.db.rental.update({
        where: { id: input.id },
        data: { status: RentalStatus.REJECTED },
        include: { gearItem: true },
      });

      await logActivity({
        type: ActivityType.RENTAL_REJECTED,
        action: `Rental rejected for ${rental.userName} (${rental.gearItem.name})`,
        details: { rentalId: rental.id },
        userId: ctx.user.id,
      });

      return rental;
    }),

  adminDeleteRental: adminProcedure
    .input(z.object({ id: z.string() }))
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
