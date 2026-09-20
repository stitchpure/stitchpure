import { z } from "zod";

export const processReturnSchema = z.object({
  returnReason: z.enum(
    ["Size_Issue", "Damaged_In_Transit", "Changed_Mind", "Wrong_Product_Shipped"],
    { message: "Return reason is required" }
  ),
  returnCondition: z.enum(
    ["Good", "Damaged", "Wrong_Product"],
    { message: "Return condition is required" }
  ),
  scannedSku: z.string().optional(),
});

export type ProcessReturnInput = z.infer<typeof processReturnSchema>;
