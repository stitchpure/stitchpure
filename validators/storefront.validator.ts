import { z } from "zod";

export const createStorefrontListingSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  wholesalePrice: z
    .number()
    .min(0.01, "Wholesale price must be at least ₹0.01")
    .max(9999999999.99, "Wholesale price must not exceed ₹9,999,999,999.99"),
  isVisible: z.boolean().default(false),
});

export const updateStorefrontListingSchema = z.object({
  wholesalePrice: z
    .number()
    .min(0.01, "Wholesale price must be at least ₹0.01")
    .max(9999999999.99, "Wholesale price must not exceed ₹9,999,999,999.99")
    .optional(),
  isVisible: z.boolean().optional(),
});

export const storefrontQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  categoryId: z.string().uuid().optional(),
  categoryIds: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.split(",").map((id) => id.trim()).filter(Boolean)
        : value,
    z.array(z.string().uuid()).max(20).optional()
  ),
  search: z.string().max(100).optional(),
  minPrice: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(9999999999.99).optional()
  ),
  maxPrice: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(9999999999.99).optional()
  ),
}).refine(
  (value) =>
    value.minPrice === undefined ||
    value.maxPrice === undefined ||
    value.minPrice <= value.maxPrice,
  {
    message: "Minimum price must not exceed maximum price",
    path: ["minPrice"],
  }
);

export const createStorefrontInquirySchema = z.object({
  companyId: z.string().uuid("Invalid company ID"),
  productId: z.string().uuid("Invalid product ID").optional().nullable(),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  phone: z
    .string()
    .trim()
    .min(8, "Enter a valid phone number")
    .max(20, "Phone number is too long")
    .regex(/^[+\d\s()-]+$/, "Enter a valid phone number"),
  email: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().trim().email("Enter a valid email").max(150).optional()
  ),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message is too long"),
});

export type CreateStorefrontListingInput = z.infer<typeof createStorefrontListingSchema>;
export type UpdateStorefrontListingInput = z.infer<typeof updateStorefrontListingSchema>;
export type StorefrontQueryInput = z.infer<typeof storefrontQuerySchema>;
export type CreateStorefrontInquiryInput = z.infer<
  typeof createStorefrontInquirySchema
>;
