import { z } from "zod";

export const sortStateSchema = z.object({
  id: z.string(),
  desc: z.boolean().default(false),
});

export const filterOperatorSchema = z.enum([
  "contains",
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "between",
  "before",
  "after",
  "isTrue",
  "isFalse",
]);

export const columnFilterSchema = z.object({
  id: z.string(),
  operator: filterOperatorSchema,
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
    ])
    .nullish(),
});

export function createListInputSchema(options?: {
  defaultPageSize?: number;
  maxPageSize?: number;
}) {
  const defaultPageSize = options?.defaultPageSize ?? 25;
  const maxPageSize = options?.maxPageSize ?? 200;

  return z.object({
    search: z.string().trim().optional(),
    sort: z.array(sortStateSchema).default([]),
    filters: z.array(columnFilterSchema).default([]),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  });
}

export const listInputSchema = createListInputSchema();

export type ListInput = z.infer<typeof listInputSchema>;
export type SortState = z.infer<typeof sortStateSchema>;
export type ColumnFilter = z.infer<typeof columnFilterSchema>;
export type FilterOperator = z.infer<typeof filterOperatorSchema>;

export interface ListResult<TRow> {
  rows: TRow[];
  total: number;
  page: number;
  pageSize: number;
}
