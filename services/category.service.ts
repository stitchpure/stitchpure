import { db } from "@/db";

import { categories, products } from "@/db/schema";

import { eq, and, count } from "drizzle-orm";

import type { CreateCategoryInput } from "@/validators/category.validator";

import type { UpdateCategoryInput } from "@/validators/category.validator";

// Create Category

export async function createCategory(
  companyId: string,
  data: CreateCategoryInput
) {
  // Check duplicate category (only among active categories)

  const existing = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.companyId, companyId),
        eq(categories.name, data.name),
        eq(categories.isActive, true)
      )
    );

  if (existing.length) {
    throw new Error("Category already exists");
  }

  const [category] = await db
    .insert(categories)
    .values({
      companyId,
      parentId: data.parentId || null,
      name: data.name,
      slug: data.name.toLowerCase().replaceAll(" ", "-"),
      description: data.description,
      bannerImage: data.bannerImage ?? null,
    })
    .returning();

  return category;
}

// Get All Categories

export type GetCategoriesParams = {
  includeInactive?: boolean;
  page: number;
  limit: number;
};

export async function getCategories(
  companyId: string,
  params: GetCategoriesParams = { page: 1, limit: 20 }
) {
  const { includeInactive = false, page, limit } = params;
  const offset = (page - 1) * limit;

  const whereClause = includeInactive
    ? eq(categories.companyId, companyId)
    : and(eq(categories.companyId, companyId), eq(categories.isActive, true));

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(whereClause)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(categories)
      .where(whereClause),
  ]);

  return { data, total };
}

// Get Single Category

export async function getCategoryById(companyId: string, id: string) {
  const result = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, id),

        eq(categories.companyId, companyId)
      )
    );

  return result[0];
}

// Update Category

export async function updateCategory(
  companyId: string,
  id: string,
  data: UpdateCategoryInput
) {
  const result = await db
    .update(categories)
    .set({
      ...data,

      updatedAt: new Date(),
    })
    .where(
      and(
        eq(categories.id, id),

        eq(categories.companyId, companyId)
      )
    )
    .returning();

  return result[0];
}

// Delete Category (hard delete — categoryId on products becomes null via FK onDelete: set null)

export async function deleteCategory(companyId: string, id: string) {
  // Check if any active products are using this category
  const [{ productCount }] = await db
    .select({ productCount: count() })
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.categoryId, id),
        eq(products.isActive, true)
      )
    );

  if (productCount > 0) {
    throw new Error(
      `Cannot delete — ${productCount} product${productCount > 1 ? "s are" : " is"} using this category. Reassign or delete those products first.`
    );
  }

  const result = await db
    .delete(categories)
    .where(
      and(
        eq(categories.id, id),
        eq(categories.companyId, companyId)
      )
    )
    .returning();

  return result[0];
}
