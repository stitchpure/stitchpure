import { z } from "zod";

export const createListingSchema = z.object({
  productItemId: z
    .string()
    .uuid("Invalid product item ID"),

  channel: z.enum(["Meesho", "Flipkart", "Amazon", "Offline"], {
    message: "Channel must be one of: Meesho, Flipkart, Amazon, or Offline",
  }),

  title: z
    .string()
    .min(1, "Title is required")
    .max(300, "Title must be at most 300 characters"),

  listingPrice: z.coerce
    .number()
    .min(0, "Listing price must be 0 or greater"),

  platformSku: z
    .string()
    .max(150, "Platform SKU must be at most 150 characters")
    .optional(),

  listingUrl: z
    .string()
    .url("Invalid URL format")
    .max(500, "Listing URL must be at most 500 characters")
    .optional(),
});

export const updateListingSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(300, "Title must be at most 300 characters")
    .optional(),

  listingPrice: z.coerce
    .number()
    .min(0, "Listing price must be 0 or greater")
    .optional(),

  platformSku: z
    .string()
    .max(150, "Platform SKU must be at most 150 characters")
    .optional(),

  listingUrl: z
    .string()
    .url("Invalid URL format")
    .max(500, "Listing URL must be at most 500 characters")
    .optional(),

  isActive: z.boolean().optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
