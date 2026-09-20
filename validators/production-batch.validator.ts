import { z } from "zod";

export const createBatchSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  productItemId: z.string().uuid("Invalid product item ID").optional().nullable(),
  startDate: z.coerce.date(),
  plannedQuantity: z.coerce.number().int().min(1, "Planned quantity must be at least 1"),
  status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("DRAFT"),
});

export const updateBatchSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  plannedQuantity: z.coerce.number().int().min(1, "Planned quantity must be at least 1").optional(),
  producedQuantity: z.coerce.number().int().min(0, "Produced quantity cannot be negative").optional(),
  goodQuantity: z.coerce.number().int().min(0, "Good quantity cannot be negative").optional(),
  rejectedQuantity: z.coerce.number().int().min(0, "Rejected quantity cannot be negative").optional(),
  completionDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
