import { z } from "zod";

export const createExpenseSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),

  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0"),

  category: z.enum([
    "MATERIAL",
    "LABOUR",
    "PACKAGING",
    "OVERHEAD",
    "TRANSPORT",
    "OTHER",
  ]),

  expenseDate: z.coerce.date(),

  productionBatchId: z
    .string()
    .uuid("Invalid production batch ID")
    .optional()
    .nullable(),

  productItemId: z
    .string()
    .uuid("Invalid product item ID")
    .optional()
    .nullable(),

  includeInManufacturingCost: z.boolean().optional(),

  notes: z.string().optional(),
});

export const updateExpenseSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),

  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0")
    .optional(),

  category: z
    .enum([
      "MATERIAL",
      "LABOUR",
      "PACKAGING",
      "OVERHEAD",
      "TRANSPORT",
      "OTHER",
    ])
    .optional(),

  expenseDate: z.coerce.date().optional(),

  productionBatchId: z
    .string()
    .uuid("Invalid production batch ID")
    .optional()
    .nullable(),

  productItemId: z
    .string()
    .uuid("Invalid product item ID")
    .optional()
    .nullable(),

  includeInManufacturingCost: z.boolean().optional(),

  notes: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
