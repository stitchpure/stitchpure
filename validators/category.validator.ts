import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name minimum 2 characters")
    .max(100, "Category name maximum 100 characters"),

  parentId: z.string().uuid("Invalid parent category id").optional(),

  description: z.string().optional(),

  // Single banner image URL
  bannerImage: z.string().url("Banner image must be a valid URL").optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),

  parentId: z.string().uuid().optional().nullable(),

  description: z.string().optional().nullable(),

  bannerImage: z.string().url().optional().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
