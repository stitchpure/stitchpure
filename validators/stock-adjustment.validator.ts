import { z } from "zod";

/**
 * Manual stock adjustment: set an item's stock to a target quantity.
 * The service records the difference as an ADJUSTMENT ledger entry.
 */
export const createStockAdjustmentSchema = z.object({
  productItemId: z.string().uuid("Invalid product item id"),

  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative"),

  notes: z.string().max(500).optional(),
});

export type CreateStockAdjustmentInput = z.infer<
  typeof createStockAdjustmentSchema
>;
