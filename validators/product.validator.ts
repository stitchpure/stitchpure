import { z } from "zod";

const imageUrlSchema = z
  .string()
  .url("Each image must be a valid URL")
  .max(500);

export const createProductSchema = z.object({
  name: z
    .string()
    .min(2, "Product name must be at least 2 characters")
    .max(150, "Product name must be at most 150 characters"),

  description: z.string().optional(),

  categoryId: z.string().uuid("Invalid category id").optional(),

  hsnCode: z.string().max(20, "HSN code must be at most 20 characters").optional(),

  isActive: z.boolean().optional().default(true),

  // Up to 3 product images
  images: z.array(imageUrlSchema).max(3, "Maximum 3 images per product").optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
