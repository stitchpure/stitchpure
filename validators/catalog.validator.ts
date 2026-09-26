import { z } from "zod";

/**
 * Unified "catalog" creation (Meesho-style single-catalog upload).
 *
 * A single payload that describes a product AND all of its size variants at
 * once. Submitting it creates, in one transaction:
 *   - the product
 *   - a "Size" variant option + one value per size row
 *   - one product item (SKU) per size row, with its own price/mrp/weight
 *   - an opening-stock ledger entry per size row (quantity)
 *
 * Meesho collects many apparel-specific attributes (fabric, neck, sleeve …);
 * this schema only carries what the current data model can store.
 */

const imageUrlSchema = z
  .string()
  .url("Each image must be a valid URL")
  .max(500);

const sizeRowSchema = z.object({
  /** The size label, e.g. "S", "M", "XL". Becomes a product option value. */
  size: z
    .string()
    .trim()
    .min(1, "Size is required")
    .max(100, "Size cannot exceed 100 characters"),

  /** Unique stock-keeping unit for this size. Uppercased. */
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(100, "SKU cannot exceed 100 characters")
    .transform((v) => v.toUpperCase()),

  barcode: z
    .string()
    .trim()
    .max(100, "Barcode cannot exceed 100 characters")
    .optional()
    .nullable()
    .transform((v) => v || null),

  /** Cost price (what you pay). Defaults to 0 when not tracked. */
  purchasePrice: z.coerce
    .number()
    .min(0, "Purchase price cannot be negative")
    .default(0),

  /** Selling price (customer-facing). */
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),

  mrp: z.coerce.number().min(0, "MRP cannot be negative").optional().nullable(),

  weight: z.coerce
    .number()
    .min(0, "Weight cannot be negative")
    .optional()
    .nullable(),

  /** Opening stock for this size. 0 is allowed (nothing in stock yet). */
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .default(0),
});

export const createCatalogSchema = z
  .object({
    // ---- Product-level fields ----
    name: z
      .string()
      .trim()
      .min(2, "Product name must be at least 2 characters")
      .max(150, "Product name must be at most 150 characters"),

    description: z.string().max(2000).optional(),

    categoryId: z.string().uuid("Invalid category id").optional(),

    hsnCode: z
      .string()
      .max(20, "HSN code must be at most 20 characters")
      .optional(),

    images: z
      .array(imageUrlSchema)
      .max(3, "Maximum 3 images per product")
      .optional()
      .default([]),

    /** Label for the variant option. Almost always "Size". */
    optionName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .default("Size"),

    // ---- Size variants ----
    sizes: z
      .array(sizeRowSchema)
      .min(1, "Add at least one size variant"),
  })
  .superRefine((data, ctx) => {
    // Unique size labels
    const sizeLabels = data.sizes.map((s) => s.size.toLowerCase());
    if (new Set(sizeLabels).size !== sizeLabels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sizes"],
        message: "Each size can only appear once",
      });
    }

    // Unique SKUs within the payload
    const skus = data.sizes.map((s) => s.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sizes"],
        message: "SKUs must be unique across sizes",
      });
    }

    // Selling price cannot exceed MRP (per row)
    data.sizes.forEach((s, i) => {
      if (s.mrp !== null && s.mrp !== undefined && s.sellingPrice > s.mrp) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sizes", i, "sellingPrice"],
          message: "Selling price cannot be greater than MRP",
        });
      }
    });
  });

export type CreateCatalogInput = z.infer<typeof createCatalogSchema>;
export type CatalogSizeRow = z.infer<typeof sizeRowSchema>;
