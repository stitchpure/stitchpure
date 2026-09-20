import { z } from "zod";

// ── Product Option schemas ─────────────────────────────────────────────────

export const createProductOptionSchema = z.object({
  name: z
    .string()
    .min(2, "Option name must be at least 2 characters")
    .max(100, "Option name must be at most 100 characters"),

  type: z.enum(["TEXT", "COLOR", "NUMBER"]).default("TEXT"),

  isRequired: z.boolean().default(true),

  isVariant: z.boolean().default(true),

  displayOrder: z.number().int("Display order must be an integer").default(0),
});

export const updateProductOptionSchema = createProductOptionSchema.partial();

// ── Product Option Value schemas ───────────────────────────────────────────

export const createProductOptionValueSchema = z.object({
  value: z
    .string()
    .min(1, "Value must be at least 1 character")
    .max(100, "Value must be at most 100 characters"),

  code: z.string().max(50, "Code must be at most 50 characters").optional(),

  colorCode: z
    .string()
    .max(20, "Color code must be at most 20 characters")
    .optional(),

  displayOrder: z.number().int("Display order must be an integer").default(0),
});

export const updateProductOptionValueSchema =
  createProductOptionValueSchema.partial();

// ── Inferred types ─────────────────────────────────────────────────────────

export type CreateProductOptionInput = z.infer<
  typeof createProductOptionSchema
>;

export type UpdateProductOptionInput = z.infer<
  typeof updateProductOptionSchema
>;

export type CreateProductOptionValueInput = z.infer<
  typeof createProductOptionValueSchema
>;

export type UpdateProductOptionValueInput = z.infer<
  typeof updateProductOptionValueSchema
>;
