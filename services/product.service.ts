import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { ServiceError } from "@/lib/service-error";
import { deriveSlug } from "@/lib/derive-slug";
import type { PaginationParams } from "@/lib/pagination";
import type { CreateProductInput, UpdateProductInput } from "@/validators/product.validator";

/**
 * Create a new product for a company.
 * Throws 409 if a product with the same name already exists within the company.
 * Requirements: 1.1, 1.9
 */
export async function createProduct(
  companyId: string,
  data: CreateProductInput
) {
  // Check for duplicate name within the company
  const existing = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.name, data.name)
      )
    );

  if (existing.length) {
    throw new ServiceError("A product with this name already exists", 409);
  }

  const [product] = await db
    .insert(products)
    .values({
      companyId,
      name: data.name,
      slug: deriveSlug(data.name),
      description: data.description ?? null,
      categoryId: data.categoryId ?? null,
      hsnCode: data.hsnCode ?? null,
      images: data.images ?? [],
      isActive: data.isActive ?? true,
    })
    .returning();

  return product;
}

/**
 * Get a paginated list of active products for a company.
 * Requirements: 1.2, 1.3
 */
export async function getProducts(
  companyId: string,
  params: PaginationParams
) {
  const offset = (params.page - 1) * params.limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          eq(products.isActive, true)
        )
      )
      .limit(params.limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          eq(products.isActive, true)
        )
      ),
  ]);

  return {
    data,
    total: totalResult[0]?.count ?? 0,
  };
}

/**
 * Get a single product by id, scoped to the company.
 * Throws 404 if not found.
 * Requirements: 1.4
 */
export async function getProductById(companyId: string, id: string) {
  const result = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        eq(products.companyId, companyId)
      )
    );

  if (!result.length) {
    throw new ServiceError("Product not found", 404);
  }

  return result[0];
}

/**
 * Partially update a product. Re-derives slug if name changes.
 * Throws 404 if not found.
 * Requirements: 1.5, 1.6, 1.7
 */
export async function updateProduct(
  companyId: string,
  id: string,
  data: UpdateProductInput
) {
  // Verify the product exists and belongs to the company
  await getProductById(companyId, id);

  const updates: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  // Re-derive slug if name is being updated
  if (data.name !== undefined) {
    updates.slug = deriveSlug(data.name);
  }

  const [updated] = await db
    .update(products)
    .set(updates)
    .where(
      and(
        eq(products.id, id),
        eq(products.companyId, companyId)
      )
    )
    .returning();

  return updated;
}

/**
 * Soft-delete a product by setting isActive to false.
 * Throws 404 if not found.
 * Requirements: 1.8
 */
export async function softDeleteProduct(companyId: string, id: string) {
  // Verify the product exists and belongs to the company
  await getProductById(companyId, id);

  const [updated] = await db
    .update(products)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.id, id),
        eq(products.companyId, companyId)
      )
    )
    .returning();

  return updated;
}
