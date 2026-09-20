import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { products, productOptions, productOptionValues } from "@/db/schema";
import { ServiceError } from "@/lib/service-error";
import { deriveSlug } from "@/lib/derive-slug";

import type { CreateProductOptionInput } from "@/validators/product-option.validator";
import type { UpdateProductOptionInput } from "@/validators/product-option.validator";
import type { CreateProductOptionValueInput } from "@/validators/product-option.validator";
import type { UpdateProductOptionValueInput } from "@/validators/product-option.validator";

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Verify that the product exists and belongs to the given company.
 * Throws a 404 ServiceError if not found.
 */
async function verifyProductOwnership(
  companyId: string,
  productId: string
): Promise<void> {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .limit(1);

  if (!product) {
    throw new ServiceError("Product not found", 404);
  }
}

/**
 * Verify that the option exists and belongs to the given product.
 * Throws a 404 ServiceError if not found.
 */
async function verifyOptionOwnership(
  productId: string,
  optionId: string
): Promise<void> {
  const [option] = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(
      and(
        eq(productOptions.id, optionId),
        eq(productOptions.productId, productId)
      )
    )
    .limit(1);

  if (!option) {
    throw new ServiceError("Product option not found", 404);
  }
}

// ── Product Option CRUD ────────────────────────────────────────────────────

/**
 * Requirements: 2.1, 2.2
 *
 * Create a new product option.
 * Verifies product ownership, derives slug from name,
 * and guards against duplicate option names per product.
 */
export async function createProductOption(
  companyId: string,
  productId: string,
  data: CreateProductOptionInput
) {
  await verifyProductOwnership(companyId, productId);

  // Guard against duplicate option name for the same product
  const [existing] = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(
      and(
        eq(productOptions.productId, productId),
        eq(productOptions.name, data.name)
      )
    )
    .limit(1);

  if (existing) {
    throw new ServiceError(
      "A product option with this name already exists for the product",
      409
    );
  }

  const slug = deriveSlug(data.name);

  const [created] = await db
    .insert(productOptions)
    .values({
      productId,
      name: data.name,
      slug,
      type: data.type,
      isRequired: data.isRequired,
      isVariant: data.isVariant,
      displayOrder: data.displayOrder,
    })
    .returning();

  return created;
}

/**
 * Requirements: 2.3
 *
 * Return all active options for a product, ordered by displayOrder.
 */
export async function getProductOptions(
  companyId: string,
  productId: string
) {
  await verifyProductOwnership(companyId, productId);

  return db
    .select()
    .from(productOptions)
    .where(
      and(
        eq(productOptions.productId, productId),
        eq(productOptions.isActive, true)
      )
    )
    .orderBy(asc(productOptions.displayOrder));
}

/**
 * Requirements: 2.4, 2.5
 *
 * Partially update a product option.
 * Returns the updated row or throws 404 if the option is not found.
 */
export async function updateProductOption(
  companyId: string,
  productId: string,
  optionId: string,
  data: UpdateProductOptionInput
) {
  await verifyProductOwnership(companyId, productId);

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) {
    updateValues.name = data.name;
    updateValues.slug = deriveSlug(data.name);
  }
  if (data.type !== undefined) updateValues.type = data.type;
  if (data.isRequired !== undefined) updateValues.isRequired = data.isRequired;
  if (data.isVariant !== undefined) updateValues.isVariant = data.isVariant;
  if (data.displayOrder !== undefined)
    updateValues.displayOrder = data.displayOrder;

  const [updated] = await db
    .update(productOptions)
    .set(updateValues)
    .where(
      and(
        eq(productOptions.id, optionId),
        eq(productOptions.productId, productId)
      )
    )
    .returning();

  if (!updated) {
    throw new ServiceError("Product option not found", 404);
  }

  return updated;
}

/**
 * Requirements: 2.6
 *
 * Soft-delete a product option by setting isActive = false.
 */
export async function softDeleteProductOption(
  companyId: string,
  productId: string,
  optionId: string
) {
  await verifyProductOwnership(companyId, productId);

  const [updated] = await db
    .update(productOptions)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(productOptions.id, optionId),
        eq(productOptions.productId, productId)
      )
    )
    .returning();

  if (!updated) {
    throw new ServiceError("Product option not found", 404);
  }

  return updated;
}

// ── Product Option Value CRUD ──────────────────────────────────────────────

/**
 * Requirements: 2.7, 2.8
 *
 * Create a new value for a product option.
 * Verifies product and option ownership, guards against duplicate values.
 */
export async function createProductOptionValue(
  companyId: string,
  productId: string,
  optionId: string,
  data: CreateProductOptionValueInput
) {
  await verifyProductOwnership(companyId, productId);
  await verifyOptionOwnership(productId, optionId);

  // Guard against duplicate value for the same option
  const [existing] = await db
    .select({ id: productOptionValues.id })
    .from(productOptionValues)
    .where(
      and(
        eq(productOptionValues.optionId, optionId),
        eq(productOptionValues.value, data.value)
      )
    )
    .limit(1);

  if (existing) {
    throw new ServiceError(
      "A value with this name already exists for the option",
      409
    );
  }

  const [created] = await db
    .insert(productOptionValues)
    .values({
      optionId,
      value: data.value,
      code: data.code ?? null,
      colorCode: data.colorCode ?? null,
      displayOrder: data.displayOrder,
    })
    .returning();

  return created;
}

/**
 * Requirements: 2.9
 *
 * Return all active values for an option, ordered by displayOrder.
 */
export async function getProductOptionValues(
  companyId: string,
  productId: string,
  optionId: string
) {
  await verifyProductOwnership(companyId, productId);
  await verifyOptionOwnership(productId, optionId);

  return db
    .select()
    .from(productOptionValues)
    .where(
      and(
        eq(productOptionValues.optionId, optionId),
        eq(productOptionValues.isActive, true)
      )
    )
    .orderBy(asc(productOptionValues.displayOrder));
}

/**
 * Requirements: 2.10, 2.11
 *
 * Partially update a product option value.
 * Returns the updated row or throws 404 if not found.
 */
export async function updateProductOptionValue(
  companyId: string,
  productId: string,
  optionId: string,
  valueId: string,
  data: UpdateProductOptionValueInput
) {
  await verifyProductOwnership(companyId, productId);
  await verifyOptionOwnership(productId, optionId);

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (data.value !== undefined) updateValues.value = data.value;
  if (data.code !== undefined) updateValues.code = data.code;
  if (data.colorCode !== undefined) updateValues.colorCode = data.colorCode;
  if (data.displayOrder !== undefined)
    updateValues.displayOrder = data.displayOrder;

  const [updated] = await db
    .update(productOptionValues)
    .set(updateValues)
    .where(
      and(
        eq(productOptionValues.id, valueId),
        eq(productOptionValues.optionId, optionId)
      )
    )
    .returning();

  if (!updated) {
    throw new ServiceError("Product option value not found", 404);
  }

  return updated;
}

/**
 * Requirements: 2.12, 2.13
 *
 * Soft-delete a product option value by setting isActive = false.
 */
export async function softDeleteProductOptionValue(
  companyId: string,
  productId: string,
  optionId: string,
  valueId: string
) {
  await verifyProductOwnership(companyId, productId);
  await verifyOptionOwnership(productId, optionId);

  const [updated] = await db
    .update(productOptionValues)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(productOptionValues.id, valueId),
        eq(productOptionValues.optionId, optionId)
      )
    )
    .returning();

  if (!updated) {
    throw new ServiceError("Product option value not found", 404);
  }

  return updated;
}
