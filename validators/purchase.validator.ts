import { z } from "zod";

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid("Invalid supplier ID").optional().nullable(),

  referenceNo: z
    .string()
    .max(100, "Reference number must be at most 100 characters")
    .optional(),

  purchaseDate: z.coerce.date(),

  status: z
    .enum(["PENDING", "RECEIVED", "CANCELLED"])
    .default("PENDING"),

  notes: z.string().optional(),

  items: z
    .array(
      z.object({
        productItemId: z.string().uuid("Invalid product item ID"),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
        unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
      })
    )
    .min(1, "At least one item is required"),
});

export const updatePurchaseSchema = z.object({
  status: z.enum(["PENDING", "RECEIVED", "CANCELLED"]),
  notes: z.string().optional(),
});

/**
 * Schema for full edit of a PENDING purchase.
 * Allows changing supplier, reference, date, notes, and replacing all line items.
 */
export const editPurchaseSchema = z.object({
  supplierId: z.string().uuid("Invalid supplier ID").optional().nullable(),

  referenceNo: z
    .string()
    .max(100, "Reference number must be at most 100 characters")
    .optional(),

  purchaseDate: z.coerce.date(),

  notes: z.string().optional(),

  items: z
    .array(
      z.object({
        productItemId: z.string().uuid("Invalid product item ID"),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
        unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
      })
    )
    .min(1, "At least one item is required"),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type EditPurchaseInput = z.infer<typeof editPurchaseSchema>;
