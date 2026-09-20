import { z } from "zod";

const itemOptionValueSchema = z.object({
  optionId: z.string().uuid("Invalid option ID"),

  optionValueId: z.string().uuid("Invalid option value ID"),
});

export const createProductItemSchema = z
  .object({
    productId: z.string().uuid("Invalid product ID"),

    sku: z
      .string()
      .trim()
      .min(2, "SKU must contain at least 2 characters")
      .max(100, "SKU cannot exceed 100 characters")
      .transform((value) => value.toUpperCase()),

    barcode: z
      .string()
      .trim()
      .max(100, "Barcode cannot exceed 100 characters")
      .optional()
      .nullable()
      .transform((value) => value || null),

    purchasePrice: z.coerce
      .number()
      .min(0, "Purchase price cannot be negative"),

    sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),

    mrp: z.coerce
      .number()
      .min(0, "MRP cannot be negative")
      .optional()
      .nullable(),

    weight: z.coerce
      .number()
      .min(0, "Weight cannot be negative")
      .optional()
      .nullable(),

    status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).default("ACTIVE"),

    optionValues: z.array(itemOptionValueSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const optionIds = data.optionValues.map((item) => item.optionId);

    const uniqueOptionIds = new Set(optionIds);

    if (optionIds.length !== uniqueOptionIds.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionValues"],
        message: "Same option cannot be selected more than once",
      });
    }

    const optionValueIds = data.optionValues.map((item) => item.optionValueId);

    const uniqueOptionValueIds = new Set(optionValueIds);

    if (optionValueIds.length !== uniqueOptionValueIds.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionValues"],
        message: "Same option value cannot be selected more than once",
      });
    }

    if (
      data.mrp !== null &&
      data.mrp !== undefined &&
      data.sellingPrice > data.mrp
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sellingPrice"],
        message: "Selling price cannot be greater than MRP",
      });
    }
  });

export type CreateProductItemInput = z.infer<typeof createProductItemSchema>;

// Task 6.1 – updateProductItemSchema
// Requirements: 3.1

export const updateProductItemSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .optional(),

    barcode: z.string().nullable().optional(),

    purchasePrice: z.coerce
      .number()
      .min(0, "Purchase price cannot be negative")
      .optional(),

    sellingPrice: z.coerce
      .number()
      .min(0, "Selling price cannot be negative")
      .optional(),

    mrp: z.coerce
      .number()
      .min(0, "MRP cannot be negative")
      .nullable()
      .optional(),

    weight: z.coerce
      .number()
      .min(0, "Weight cannot be negative")
      .nullable()
      .optional(),

    status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.mrp !== null &&
      data.mrp !== undefined &&
      data.sellingPrice !== undefined &&
      data.sellingPrice > data.mrp
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sellingPrice"],
        message: "Selling price cannot be greater than MRP",
      });
    }
  });

export type UpdateProductItemInput = z.infer<typeof updateProductItemSchema>;
