import { z } from "zod";

export const createCostSheetSchema = z.object({
  productionBatchId: z.string().uuid("Invalid production batch ID"),
  effectiveDate: z.coerce.date(),
});

const REJECTED_COST_FIELDS = [
  "materialCostPerUnit",
  "labourCostPerUnit",
  "packagingCostPerUnit",
  "overheadCostPerUnit",
  "transportCostPerUnit",
  "otherCostPerUnit",
  "totalManufacturingCostPerUnit",
] as const;

export const updateCostSheetSchema = z
  .object({
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    effectiveDate: z.coerce.date().optional(),
  })
  .strict()
  .refine(
    (data) => {
      const keys = Object.keys(data);
      return !REJECTED_COST_FIELDS.some((field) => keys.includes(field));
    },
    {
      message:
        "Cost value fields cannot be updated. Rejected fields: materialCostPerUnit, labourCostPerUnit, packagingCostPerUnit, overheadCostPerUnit, transportCostPerUnit, otherCostPerUnit, totalManufacturingCostPerUnit",
    }
  );

export type CreateCostSheetInput = z.infer<typeof createCostSheetSchema>;
export type UpdateCostSheetInput = z.infer<typeof updateCostSheetSchema>;
