import { z } from "zod";
import { GSTIN_REGEX, GSTIN_ERROR_MESSAGE } from "@/lib/gstin";

export const createSaleSchema = z.object({
  referenceNo: z.string().optional(),

  saleDate: z.coerce.date(),

  customerName: z
    .string()
    .max(150, "Customer name must be at most 150 characters")
    .optional(),

  customerPhone: z
    .string()
    .max(20, "Customer phone must be at most 20 characters")
    .optional(),

  status: z
    .enum(["PENDING", "COMPLETED", "CANCELLED"])
    .default("PENDING"),

  notes: z.string().optional(),

  buyerGstin: z.string().length(15).regex(GSTIN_REGEX, GSTIN_ERROR_MESSAGE).nullable().optional(),

  shippingAddress: z.string().nullable().optional(),

  placeOfSupply: z.string().max(50).nullable().optional(),

  channel: z.string().max(50, "Channel must be at most 50 characters").optional(),

  listingId: z.string().uuid("Invalid listing ID").optional(),

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

export const updateSaleSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
  notes: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
