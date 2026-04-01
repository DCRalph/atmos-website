import { TRPCError } from "@trpc/server";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { z } from "zod";
import {
  ActivityType,
  DiscountRuleMode,
  DiscountType,
  RentalStatus,
} from "~Prisma/client";
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
  price: z.number().min(0),
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

const discountRuleRequirementInputSchema = z.object({
  gearItemId: z.string().min(1),
  requiredQty: z.number().int().min(1),
  discountValue: z.number().min(0).default(0),
});

const discountRuleBaseSchema = z.object({
  name: z.string().trim().min(1),
  isActive: z.boolean().default(true),
  discountMode: z.enum([DiscountRuleMode.TOTAL, DiscountRuleMode.PER_ITEM]),
  discountType: z.enum([DiscountType.FIXED_AMOUNT, DiscountType.PERCENTAGE]),
  discountValue: z.number().min(0),
  requirements: z.array(discountRuleRequirementInputSchema).min(1),
});

const discountRuleInputSchema = discountRuleBaseSchema
  .superRefine((input, ctx) => {
    const seen = new Set<string>();

    for (const requirement of input.requirements) {
      if (seen.has(requirement.gearItemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Discount rule requirements cannot contain duplicate items.",
          path: ["requirements"],
        });
        break;
      }

      seen.add(requirement.gearItemId);
    }

    if (input.discountType === DiscountType.PERCENTAGE && input.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discounts cannot exceed 100%.",
        path: ["discountValue"],
      });
    }

    if (input.discountMode === DiscountRuleMode.TOTAL && input.discountValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total discount rules must have a discount value above 0.",
        path: ["discountValue"],
      });
    }

    if (input.discountMode === DiscountRuleMode.PER_ITEM) {
      const hasPerItemDiscount = input.requirements.some(
        (requirement) => requirement.discountValue > 0,
      );

      if (!hasPerItemDiscount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Per-item discount rules must include at least one item discount above 0.",
          path: ["requirements"],
        });
      }

      for (const requirement of input.requirements) {
        if (
          input.discountType === DiscountType.PERCENTAGE &&
          requirement.discountValue > 100
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Per-item percentage discounts cannot exceed 100%.",
            path: ["requirements"],
          });
          break;
        }
      }
    }
  });

const discountRuleUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
    discountMode: z.enum([DiscountRuleMode.TOTAL, DiscountRuleMode.PER_ITEM]).optional(),
    discountType: z
      .enum([DiscountType.FIXED_AMOUNT, DiscountType.PERCENTAGE])
      .optional(),
    discountValue: z.number().min(0).optional(),
    requirements: z.array(discountRuleRequirementInputSchema).min(1).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.requirements) {
      const seen = new Set<string>();

      for (const requirement of input.requirements) {
        if (seen.has(requirement.gearItemId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Discount rule requirements cannot contain duplicate items.",
            path: ["requirements"],
          });
          break;
        }

        seen.add(requirement.gearItemId);
      }
    }

    const discountType = input.discountType;
    const discountValue = input.discountValue;
    if (
      discountType === DiscountType.PERCENTAGE &&
      discountValue !== undefined &&
      discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discounts cannot exceed 100%.",
        path: ["discountValue"],
      });
    }

    if (
      input.discountMode === DiscountRuleMode.TOTAL &&
      discountValue !== undefined &&
      discountValue <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total discount rules must have a discount value above 0.",
        path: ["discountValue"],
      });
    }

    if (input.discountMode === DiscountRuleMode.PER_ITEM && input.requirements) {
      const hasPerItemDiscount = input.requirements.some(
        (requirement) => requirement.discountValue > 0,
      );
      if (!hasPerItemDiscount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Per-item discount rules must include at least one item discount above 0.",
          path: ["requirements"],
        });
      }

      if (discountType === DiscountType.PERCENTAGE) {
        for (const requirement of input.requirements) {
          if (requirement.discountValue > 100) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Per-item percentage discounts cannot exceed 100%.",
              path: ["requirements"],
            });
            break;
          }
        }
      }
    }
  });

const rentalModeSchema = z.enum(["PACKAGE", "ITEMS"]);

const rentalSelectionItemSchema = z.object({
  gearItemId: z.string().min(1),
  quantity: z.number().int().min(1),
});

const rentalDatesSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((input) => input.endDate >= input.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  });

const quoteRentalSelectionInputSchema = rentalDatesSchema
  .extend({
    mode: rentalModeSchema,
    packageId: z.string().min(1).optional(),
    items: z.array(rentalSelectionItemSchema).default([]),
  })
  .superRefine((input, ctx) => {
    if (input.mode === "PACKAGE" && !input.packageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Package is required for package quotes.",
        path: ["packageId"],
      });
    }

    if (input.mode === "PACKAGE" && input.items.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Package quotes cannot include individual items.",
        path: ["items"],
      });
    }

    if (input.mode === "ITEMS" && input.packageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Item quotes cannot include a package.",
        path: ["packageId"],
      });
    }
  });

const createRentalRequestInputSchema = quoteRentalSelectionInputSchema
  .extend({
    userName: z.string().trim().min(1),
    contactInfo: z.string().trim().min(1),
  })
  .superRefine((input, ctx) => {
    if (input.mode === "ITEMS" && input.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one item before submitting.",
        path: ["items"],
      });
    }
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

const rentalItemInclude = {
  include: {
    gearItem: true,
  },
  orderBy: {
    createdAt: "asc",
  },
} as const;

const discountRuleInclude = {
  requirements: {
    include: {
      gearItem: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} as const;

const rentalInclude = {
  gearPackage: {
    include: gearPackageInclude,
  },
  rentalItems: rentalItemInclude,
} as const;

type IncludedGearItem = {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  quantity: number;
  price: number;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SelectionLineItem = {
  gearItemId: string;
  quantity: number;
  gearItem: IncludedGearItem;
};

type IncludedGearPackage = {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  price: number;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    gearItemId: string;
    gearPackageId: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
    gearItem: IncludedGearItem;
  }>;
};

type IncludedDiscountRule = {
  id: string;
  name: string;
  isActive: boolean;
  discountMode: DiscountRuleMode;
  discountType: DiscountType;
  discountValue: number;
  createdAt: Date;
  updatedAt: Date;
  requirements: Array<{
    id: string;
    discountRuleId: string;
    gearItemId: string;
    requiredQty: number;
    discountValue: number;
    createdAt: Date;
    updatedAt: Date;
    gearItem: IncludedGearItem;
  }>;
};

type IncludedRental = {
  id: string;
  packageId: string | null;
  userName: string;
  contactInfo: string;
  startDate: Date;
  endDate: Date;
  status: RentalStatus;
  baseDailyPrice: number;
  discountDailyAmount: number;
  discountedDailyPrice: number;
  estimatedTotalPrice: number;
  appliedDiscountRuleId: string | null;
  appliedDiscountName: string | null;
  appliedDiscountMode: DiscountRuleMode | null;
  appliedDiscountType: DiscountType | null;
  appliedDiscountValue: number | null;
  createdAt: Date;
  updatedAt: Date;
  gearPackage: IncludedGearPackage | null;
  rentalItems: Array<{
    id: string;
    rentalId: string;
    gearItemId: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
    gearItem: IncludedGearItem;
  }>;
};

type AvailabilityEntry = {
  gearItemId: string;
  name: string;
  shortName: string | null;
  totalQuantity: number;
  bookedQuantity: number;
  remainingQuantity: number;
  price: number;
};

type SelectionAvailability = {
  available: boolean;
  conflictingDates: string[];
  limitingItems: string[];
};

type SelectedDiscount = {
  ruleId: string;
  name: string;
  discountMode: DiscountRuleMode;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
};

type ItemPricingBreakdown = {
  gearItemId: string;
  quantity: number;
  unitPrice: number;
  originalRowTotal: number;
  discountPerUnit: number;
  rowDiscountTotal: number;
  discountedUnitPrice: number;
  discountedRowTotal: number;
};

type ItemSelectionQuote = {
  mode: "ITEMS";
  selectedItems: SelectionLineItem[];
  availabilityByItem: Record<string, AvailabilityEntry>;
  available: boolean;
  conflictingDates: string[];
  limitingItems: string[];
  numDays: number;
  baseDailyPrice: number;
  discountDailyAmount: number;
  discountedDailyPrice: number;
  estimatedTotalPrice: number;
  appliedDiscount: SelectedDiscount | null;
  itemPricing: ItemPricingBreakdown[];
};

type PackageSelectionQuote = {
  mode: "PACKAGE";
  gearPackage: IncludedGearPackage;
  selectedItems: SelectionLineItem[];
  availabilityByItem: Record<string, AvailabilityEntry>;
  available: boolean;
  conflictingDates: string[];
  limitingItems: string[];
  numDays: number;
  baseDailyPrice: number;
  discountDailyAmount: number;
  discountedDailyPrice: number;
  estimatedTotalPrice: number;
  appliedDiscount: null;
  itemPricing: ItemPricingBreakdown[];
};

type SelectionQuote = ItemSelectionQuote | PackageSelectionQuote;

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

function getNumDays(startDate: Date, endDate: Date) {
  return differenceInCalendarDays(startOfDay(endDate), startOfDay(startDate)) + 1;
}

function getDuplicateIds(values: string[]) {
  return values.filter(
    (value, index, allValues) => allValues.indexOf(value) !== index,
  );
}

function normalizeSelectedItems(items: Array<{ gearItemId: string; quantity: number }>) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    quantities.set(item.gearItemId, (quantities.get(item.gearItemId) ?? 0) + item.quantity);
  }

  return Array.from(quantities.entries())
    .map(([gearItemId, quantity]) => ({
      gearItemId,
      quantity,
    }))
    .sort((a, b) => a.gearItemId.localeCompare(b.gearItemId));
}

function getRentalLineItems(rental: IncludedRental): SelectionLineItem[] {
  if (rental.rentalItems.length > 0) {
    return rental.rentalItems.map((item) => ({
      gearItemId: item.gearItemId,
      quantity: item.quantity,
      gearItem: item.gearItem,
    }));
  }

  return (rental.gearPackage?.items ?? []).map((item) => ({
    gearItemId: item.gearItemId,
    quantity: item.quantity,
    gearItem: item.gearItem,
  }));
}

function buildUsageByDate(rentals: IncludedRental[]) {
  const usageByDate = new Map<string, Map<string, number>>();

  for (const rental of rentals) {
    for (const dateKey of eachDayKeyInRange(rental.startDate, rental.endDate)) {
      const dayUsage = usageByDate.get(dateKey) ?? new Map<string, number>();

      for (const item of getRentalLineItems(rental)) {
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

function buildAvailabilityByItem(
  inventoryItems: IncludedGearItem[],
  usageByDate: Map<string, Map<string, number>>,
  startDate: Date,
  endDate: Date,
) {
  const availabilityByItem: Record<string, AvailabilityEntry> = Object.fromEntries(
    inventoryItems.map((item) => [
      item.id,
      {
        gearItemId: item.id,
        name: item.name,
        shortName: item.shortName,
        totalQuantity: item.quantity,
        bookedQuantity: 0,
        remainingQuantity: item.quantity,
        price: item.price,
      },
    ]),
  );

  for (const dateKey of eachDayKeyInRange(startDate, endDate)) {
    const dayUsage = usageByDate.get(dateKey) ?? new Map<string, number>();

    for (const item of inventoryItems) {
      const entry = availabilityByItem[item.id];
      if (!entry) continue;
      const bookedQuantity = dayUsage.get(item.id) ?? 0;
      entry.bookedQuantity = Math.max(entry.bookedQuantity, bookedQuantity);
      entry.remainingQuantity = Math.min(
        entry.remainingQuantity,
        Math.max(item.quantity - bookedQuantity, 0),
      );
    }
  }

  return availabilityByItem;
}

function getSelectionAvailability(
  selectedItems: SelectionLineItem[],
  usageByDate: Map<string, Map<string, number>>,
  startDate: Date,
  endDate: Date,
): SelectionAvailability {
  const conflictingDates = new Set<string>();
  const limitingItems = new Set<string>();

  for (const dateKey of eachDayKeyInRange(startDate, endDate)) {
    const dayUsage = usageByDate.get(dateKey) ?? new Map<string, number>();

    for (const item of selectedItems) {
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

function formatLineItems(items: SelectionLineItem[]) {
  return items.map((item) => `${item.quantity}x ${item.gearItem.name}`).join(", ");
}

function formatDiscountRuleSummary(rule: IncludedDiscountRule) {
  const requirementSummary = rule.requirements
    .map((requirement) => {
      if (rule.discountMode === DiscountRuleMode.PER_ITEM) {
        const discountLabel =
          rule.discountType === DiscountType.FIXED_AMOUNT
            ? `$${requirement.discountValue}/item`
            : `${requirement.discountValue}%/item`;
        return `${requirement.requiredQty}x ${requirement.gearItem.name} (${discountLabel})`;
      }

      return `${requirement.requiredQty}x ${requirement.gearItem.name}`;
    })
    .join(" + ");
  const discountSummary =
    rule.discountMode === DiscountRuleMode.TOTAL
      ? rule.discountType === DiscountType.FIXED_AMOUNT
        ? `$${rule.discountValue} off/day`
        : `${rule.discountValue}% off/day`
      : rule.discountType === DiscountType.FIXED_AMOUNT
        ? "Per-item fixed discount"
        : "Per-item percentage discount";

  return `${requirementSummary} => ${discountSummary}`;
}

function applyRuleToItems(
  rule: IncludedDiscountRule,
  selectedItems: SelectionLineItem[],
): { discountAmount: number; itemPricing: ItemPricingBreakdown[] } {
  const requirementByItemId = new Map(
    rule.requirements.map((requirement) => [requirement.gearItemId, requirement]),
  );

  const itemPricing = selectedItems.map((item) => {
    const unitPrice = item.gearItem.price;
    const originalRowTotal = unitPrice * item.quantity;
    const requirement = requirementByItemId.get(item.gearItemId);

    if (
      rule.discountMode !== DiscountRuleMode.PER_ITEM ||
      !requirement ||
      requirement.discountValue <= 0
    ) {
      return {
        gearItemId: item.gearItemId,
        quantity: item.quantity,
        unitPrice,
        originalRowTotal,
        discountPerUnit: 0,
        rowDiscountTotal: 0,
        discountedUnitPrice: unitPrice,
        discountedRowTotal: originalRowTotal,
      };
    }

    const rawDiscountPerUnit =
      rule.discountType === DiscountType.FIXED_AMOUNT
        ? requirement.discountValue
        : unitPrice * (requirement.discountValue / 100);
    const discountPerUnit = Math.min(rawDiscountPerUnit, unitPrice);
    const rowDiscountTotal = discountPerUnit * item.quantity;
    const discountedUnitPrice = Math.max(unitPrice - discountPerUnit, 0);
    const discountedRowTotal = Math.max(originalRowTotal - rowDiscountTotal, 0);

    return {
      gearItemId: item.gearItemId,
      quantity: item.quantity,
      unitPrice,
      originalRowTotal,
      discountPerUnit,
      rowDiscountTotal,
      discountedUnitPrice,
      discountedRowTotal,
    };
  });

  const discountAmount = itemPricing.reduce(
    (total, row) => total + row.rowDiscountTotal,
    0,
  );

  return {
    discountAmount,
    itemPricing,
  };
}

function selectBestDiscountRule(
  rules: IncludedDiscountRule[],
  selectedItems: SelectionLineItem[],
  baseDailyPrice: number,
): { selectedDiscount: SelectedDiscount | null; itemPricing: ItemPricingBreakdown[] } {
  if (baseDailyPrice <= 0 || selectedItems.length === 0) {
    return {
      selectedDiscount: null,
      itemPricing: selectedItems.map((item) => ({
        gearItemId: item.gearItemId,
        quantity: item.quantity,
        unitPrice: item.gearItem.price,
        originalRowTotal: item.gearItem.price * item.quantity,
        discountPerUnit: 0,
        rowDiscountTotal: 0,
        discountedUnitPrice: item.gearItem.price,
        discountedRowTotal: item.gearItem.price * item.quantity,
      })),
    };
  }

  const selectedQuantities = new Map<string, number>();
  for (const item of selectedItems) {
    selectedQuantities.set(item.gearItemId, item.quantity);
  }

  let bestDiscount: SelectedDiscount | null = null;
  let bestItemPricing: ItemPricingBreakdown[] = selectedItems.map((item) => ({
    gearItemId: item.gearItemId,
    quantity: item.quantity,
    unitPrice: item.gearItem.price,
    originalRowTotal: item.gearItem.price * item.quantity,
    discountPerUnit: 0,
    rowDiscountTotal: 0,
    discountedUnitPrice: item.gearItem.price,
    discountedRowTotal: item.gearItem.price * item.quantity,
  }));

  for (const rule of rules) {
    if (
      !rule.isActive ||
      rule.requirements.some(
        (requirement) =>
          (selectedQuantities.get(requirement.gearItemId) ?? 0) <
          requirement.requiredQty,
      )
    ) {
      continue;
    }

    const ruleResult =
      rule.discountMode === DiscountRuleMode.TOTAL
        ? {
            discountAmount: Math.min(
              rule.discountType === DiscountType.FIXED_AMOUNT
                ? rule.discountValue
                : baseDailyPrice * (rule.discountValue / 100),
              baseDailyPrice,
            ),
            itemPricing: bestItemPricing.map((row) => ({
              ...row,
              discountPerUnit: 0,
              rowDiscountTotal: 0,
              discountedUnitPrice: row.unitPrice,
              discountedRowTotal: row.originalRowTotal,
            })),
          }
        : applyRuleToItems(rule, selectedItems);
    const discountAmount = Math.min(ruleResult.discountAmount, baseDailyPrice);

    if (!bestDiscount || discountAmount > bestDiscount.discountAmount) {
      bestDiscount = {
        ruleId: rule.id,
        name: rule.name,
        discountMode: rule.discountMode,
        discountType: rule.discountType,
        discountValue: rule.discountValue,
        discountAmount,
      };
      bestItemPricing =
        rule.discountMode === DiscountRuleMode.TOTAL
          ? bestItemPricing
          : ruleResult.itemPricing;
    }
  }

  return {
    selectedDiscount: bestDiscount,
    itemPricing: bestItemPricing,
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

async function getOverlappingApprovedRentals(
  ctx: { db: typeof import("~/server/db").db },
  startDate: Date,
  endDate: Date,
  options?: { excludeRentalId?: string },
) {
  return (await ctx.db.rental.findMany({
    where: {
      status: RentalStatus.APPROVED,
      id: options?.excludeRentalId ? { not: options.excludeRentalId } : undefined,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: rentalInclude,
    orderBy: { startDate: "asc" },
  })) as IncludedRental[];
}

async function buildItemSelectionLinesOrThrow(
  ctx: { db: typeof import("~/server/db").db },
  items: Array<{ gearItemId: string; quantity: number }>,
) {
  const normalizedItems = normalizeSelectedItems(items);

  if (normalizedItems.length === 0) {
    return [] as SelectionLineItem[];
  }

  const inventoryItems = await ctx.db.gearItem.findMany({
    where: {
      id: {
        in: normalizedItems.map((item) => item.gearItemId),
      },
    },
  });

  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
  const missingIds = normalizedItems
    .map((item) => item.gearItemId)
    .filter((gearItemId) => !inventoryById.has(gearItemId));

  if (missingIds.length > 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "One or more selected inventory items no longer exist.",
    });
  }

  return normalizedItems.map((item) => ({
    gearItemId: item.gearItemId,
    quantity: item.quantity,
    gearItem: inventoryById.get(item.gearItemId)!,
  }));
}

async function getSelectionQuote(
  ctx: { db: typeof import("~/server/db").db },
  input: z.infer<typeof quoteRentalSelectionInputSchema>,
  options?: { excludeRentalId?: string },
): Promise<SelectionQuote> {
  const [approvedRentals, inventoryItems] = await Promise.all([
    getOverlappingApprovedRentals(ctx, input.startDate, input.endDate, options),
    ctx.db.gearItem.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  const usageByDate = buildUsageByDate(approvedRentals);
  const availabilityByItem = buildAvailabilityByItem(
    inventoryItems,
    usageByDate,
    input.startDate,
    input.endDate,
  );
  const numDays = getNumDays(input.startDate, input.endDate);

  if (input.mode === "PACKAGE") {
    const gearPackage = await getPackageWithItemsOrThrow(ctx, input.packageId!);
    const selectedItems = gearPackage.items.map((item) => ({
      gearItemId: item.gearItemId,
      quantity: item.quantity,
      gearItem: item.gearItem,
    }));
    const availability = getSelectionAvailability(
      selectedItems,
      usageByDate,
      input.startDate,
      input.endDate,
    );

    return {
      mode: "PACKAGE",
      gearPackage,
      selectedItems,
      availabilityByItem,
      available: availability.available,
      conflictingDates: availability.conflictingDates,
      limitingItems: availability.limitingItems,
      numDays,
      baseDailyPrice: gearPackage.price,
      discountDailyAmount: 0,
      discountedDailyPrice: gearPackage.price,
      estimatedTotalPrice: gearPackage.price * numDays,
      appliedDiscount: null,
      itemPricing: selectedItems.map((item) => ({
        gearItemId: item.gearItemId,
        quantity: item.quantity,
        unitPrice: item.gearItem.price,
        originalRowTotal: item.gearItem.price * item.quantity,
        discountPerUnit: 0,
        rowDiscountTotal: 0,
        discountedUnitPrice: item.gearItem.price,
        discountedRowTotal: item.gearItem.price * item.quantity,
      })),
    };
  }

  const selectedItems = await buildItemSelectionLinesOrThrow(ctx, input.items);
  const availability = getSelectionAvailability(
    selectedItems,
    usageByDate,
    input.startDate,
    input.endDate,
  );
  const activeRules = (await ctx.db.discountRule.findMany({
    where: { isActive: true },
    include: discountRuleInclude,
    orderBy: { createdAt: "asc" },
  })) as IncludedDiscountRule[];
  const baseDailyPrice = selectedItems.reduce(
    (total, item) => total + item.quantity * item.gearItem.price,
    0,
  );
  const discountResult = selectBestDiscountRule(
    activeRules,
    selectedItems,
    baseDailyPrice,
  );
  const appliedDiscount = discountResult.selectedDiscount;
  const discountDailyAmount = appliedDiscount?.discountAmount ?? 0;
  const discountedDailyPrice = Math.max(baseDailyPrice - discountDailyAmount, 0);

  return {
    mode: "ITEMS",
    selectedItems,
    availabilityByItem,
    available: availability.available,
    conflictingDates: availability.conflictingDates,
    limitingItems: availability.limitingItems,
    numDays,
    baseDailyPrice,
    discountDailyAmount,
    discountedDailyPrice,
    estimatedTotalPrice: discountedDailyPrice * numDays,
    appliedDiscount,
    itemPricing: discountResult.itemPricing,
  };
}

async function assertSelectionAvailabilityOrThrow(
  ctx: { db: typeof import("~/server/db").db },
  input: z.infer<typeof quoteRentalSelectionInputSchema>,
  options?: { excludeRentalId?: string },
) {
  const quote = await getSelectionQuote(ctx, input, options);

  if (!quote.available) {
    const selectionLabel =
      quote.mode === "PACKAGE" ? "Package" : "Selected items";

    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        quote.limitingItems.length > 0
          ? `${selectionLabel} is unavailable for the selected dates because ${quote.limitingItems.join(", ")} is fully booked.`
          : `${selectionLabel} is unavailable for the selected dates.`,
    });
  }

  return quote;
}

function getRentalSelectionInput(existingRental: IncludedRental) {
  if (existingRental.rentalItems.length > 0) {
    return {
      mode: "ITEMS" as const,
      items: existingRental.rentalItems.map((item) => ({
        gearItemId: item.gearItemId,
        quantity: item.quantity,
      })),
    };
  }

  if (!existingRental.packageId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Rental is missing both package and item selections.",
    });
  }

  return {
    mode: "PACKAGE" as const,
    packageId: existingRental.packageId,
    items: [],
  };
}

function getRentalDisplayName(rental: IncludedRental) {
  if (rental.gearPackage) {
    return rental.gearPackage.name;
  }

  if (rental.rentalItems.length > 0) {
    return "Individual item rental";
  }

  return "Rental";
}

export const rentalsRouter = createTRPCRouter({
  getPublicPackages: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gearPackage.findMany({
      include: gearPackageInclude,
      orderBy: { name: "asc" },
    });
  }),

  getPublicInventoryItems: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gearItem.findMany({
      orderBy: { name: "asc" },
    });
  }),

  quoteRentalSelection: publicProcedure
    .input(quoteRentalSelectionInputSchema)
    .query(async ({ ctx, input }) => {
      return getSelectionQuote(ctx, input);
    }),

  getPublicRentals: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.rental.findMany({
      where: { status: RentalStatus.APPROVED },
      include: rentalInclude,
      orderBy: { startDate: "asc" },
    });
  }),

  createRentalRequest: publicProcedure
    .input(createRentalRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const quote = await assertSelectionAvailabilityOrThrow(ctx, input);
      const rental = await ctx.db.rental.create({
        data: {
          packageId: quote.mode === "PACKAGE" ? quote.gearPackage.id : undefined,
          userName: input.userName,
          contactInfo: input.contactInfo,
          startDate: input.startDate,
          endDate: input.endDate,
          status: RentalStatus.PENDING,
          baseDailyPrice: quote.baseDailyPrice,
          discountDailyAmount: quote.discountDailyAmount,
          discountedDailyPrice: quote.discountedDailyPrice,
          estimatedTotalPrice: quote.estimatedTotalPrice,
          appliedDiscountRuleId: quote.appliedDiscount?.ruleId,
          appliedDiscountName: quote.appliedDiscount?.name,
          appliedDiscountMode: quote.appliedDiscount?.discountMode,
          appliedDiscountType: quote.appliedDiscount?.discountType,
          appliedDiscountValue:
            quote.appliedDiscount?.discountMode === DiscountRuleMode.TOTAL
              ? quote.appliedDiscount.discountValue
              : null,
          rentalItems:
            quote.mode === "ITEMS"
              ? {
                  create: quote.selectedItems.map((item) => ({
                    gearItemId: item.gearItemId,
                    quantity: item.quantity,
                  })),
                }
              : undefined,
        },
        include: rentalInclude,
      });

      const metadata = await getRequestMetadata();
      await logActivity({
        type: ActivityType.RENTAL_CREATED,
        action: `Rental request created by ${input.userName} for ${
          quote.mode === "PACKAGE" ? quote.gearPackage.name : "individual items"
        }`,
        details: {
          rentalId: rental.id,
          packageId: quote.mode === "PACKAGE" ? quote.gearPackage.id : null,
          itemIds:
            quote.mode === "ITEMS"
              ? quote.selectedItems.map((item) => item.gearItemId)
              : [],
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

        const selectionTitle =
          quote.mode === "PACKAGE"
            ? `Package: ${quote.gearPackage.name}`
            : "Selection: Individual items";
        const selectionBreakdown = formatLineItems(quote.selectedItems);
        const discountSummary = quote.appliedDiscount
          ? quote.appliedDiscount.discountMode === DiscountRuleMode.PER_ITEM
            ? `$${quote.appliedDiscount.discountAmount}/day item discounts via ${quote.appliedDiscount.name}`
            : quote.appliedDiscount.discountType === DiscountType.FIXED_AMOUNT
              ? `$${quote.appliedDiscount.discountAmount}/day off via ${quote.appliedDiscount.name}`
              : `${quote.appliedDiscount.discountValue}% off/day via ${quote.appliedDiscount.name}`
          : "None";

        await sendEmail({
          to: notificationEmailSetting.value,
          subject: `New Gear Rental Request: ${input.userName}`,
          text:
            `A new gear rental request has been submitted.\n\n` +
            `User: ${input.userName}\n` +
            `Contact: ${input.contactInfo}\n` +
            `${selectionTitle}\n` +
            `Items: ${selectionBreakdown}\n` +
            `Estimated Total: $${quote.estimatedTotalPrice}\n` +
            `Discount: ${discountSummary}\n` +
            `Start Date: ${format(input.startDate, "PPP")}\n` +
            `End Date: ${format(input.endDate, "PPP")}\n\n` +
            `Review this request in the admin dashboard.`,
          html: `
              <h1>New Gear Rental Request</h1>
              <p><strong>User:</strong> ${input.userName}</p>
              <p><strong>Contact:</strong> ${input.contactInfo}</p>
              <p><strong>${selectionTitle}</strong></p>
              <p><strong>Items:</strong> ${selectionBreakdown}</p>
              <p><strong>Estimated Total:</strong> $${quote.estimatedTotalPrice}</p>
              <p><strong>Discount:</strong> ${discountSummary}</p>
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
        discountRequirements: {
          include: {
            discountRule: {
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

  adminGetDiscountRules: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.discountRule.findMany({
      include: discountRuleInclude,
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
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
      const duplicateGearItemIds = getDuplicateIds(
        input.items.map((item) => item.gearItemId),
      );

      if (duplicateGearItemIds.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Package items cannot contain duplicate inventory items.",
        });
      }

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
        const duplicateGearItemIds = getDuplicateIds(
          items.map((item) => item.gearItemId),
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

  adminCreateDiscountRule: adminProcedure
    .input(discountRuleInputSchema)
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.db.discountRule.create({
        data: {
          name: input.name,
          isActive: input.isActive,
          discountMode: input.discountMode,
          discountType: input.discountType,
          discountValue: input.discountValue,
          requirements: {
            create: input.requirements.map((requirement) => ({
              gearItemId: requirement.gearItemId,
              requiredQty: requirement.requiredQty,
              discountValue: requirement.discountValue,
            })),
          },
        },
        include: discountRuleInclude,
      });

      await logActivity({
        type: ActivityType.DISCOUNT_RULE_CREATED,
        action: `Discount rule created: ${rule.name}`,
        details: {
          discountRuleId: rule.id,
          summary: formatDiscountRuleSummary(rule as IncludedDiscountRule),
        },
        userId: ctx.user.id,
      });

      return rule;
    }),

  adminUpdateDiscountRule: adminProcedure
    .input(discountRuleUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, requirements, ...data } = input;

      if (requirements) {
        const duplicateIds = getDuplicateIds(
          requirements.map((requirement) => requirement.gearItemId),
        );

        if (duplicateIds.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Discount rule requirements cannot contain duplicate items.",
          });
        }

        if (
          data.discountType === DiscountType.PERCENTAGE &&
          data.discountValue !== undefined &&
          data.discountValue > 100
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Percentage discounts cannot exceed 100%.",
          });
        }
      }

      const rule = await ctx.db.$transaction(async (tx) => {
        if (requirements) {
          await tx.discountRuleRequirement.deleteMany({
            where: { discountRuleId: id },
          });
        }

        return tx.discountRule.update({
          where: { id },
          data: {
            ...data,
            requirements: requirements
              ? {
                  create: requirements.map((requirement) => ({
                    gearItemId: requirement.gearItemId,
                    requiredQty: requirement.requiredQty,
                    discountValue: requirement.discountValue,
                  })),
                }
              : undefined,
          },
          include: discountRuleInclude,
        });
      });

      await logActivity({
        type: ActivityType.DISCOUNT_RULE_UPDATED,
        action: `Discount rule updated: ${rule.name}`,
        details: {
          discountRuleId: rule.id,
          summary: formatDiscountRuleSummary(rule as IncludedDiscountRule),
        },
        userId: ctx.user.id,
      });

      return rule;
    }),

  adminDeleteDiscountRule: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.db.discountRule.delete({
        where: { id: input.id },
        include: discountRuleInclude,
      });

      await logActivity({
        type: ActivityType.DISCOUNT_RULE_DELETED,
        action: `Discount rule deleted: ${rule.name}`,
        details: {
          discountRuleId: rule.id,
          summary: formatDiscountRuleSummary(rule as IncludedDiscountRule),
        },
        userId: ctx.user.id,
      });

      return rule;
    }),

  adminApproveRental: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existingRental = (await ctx.db.rental.findUnique({
        where: { id: input.id },
        include: rentalInclude,
      })) as IncludedRental | null;

      if (!existingRental) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rental request not found.",
        });
      }

      const selection = getRentalSelectionInput(existingRental);
      await assertSelectionAvailabilityOrThrow(
        ctx,
        {
          ...selection,
          startDate: existingRental.startDate,
          endDate: existingRental.endDate,
        },
        { excludeRentalId: existingRental.id },
      );

      const rental = (await ctx.db.rental.update({
        where: { id: input.id },
        data: { status: RentalStatus.APPROVED },
        include: rentalInclude,
      })) as IncludedRental;

      await logActivity({
        type: ActivityType.RENTAL_APPROVED,
        action: `Rental approved for ${rental.userName} (${getRentalDisplayName(rental)})`,
        details: { rentalId: rental.id },
        userId: ctx.user.id,
      });

      return rental;
    }),

  adminRejectRental: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rental = (await ctx.db.rental.update({
        where: { id: input.id },
        data: { status: RentalStatus.REJECTED },
        include: rentalInclude,
      })) as IncludedRental;

      await logActivity({
        type: ActivityType.RENTAL_REJECTED,
        action: `Rental rejected for ${rental.userName} (${getRentalDisplayName(rental)})`,
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
