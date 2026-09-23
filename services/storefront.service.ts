import { db } from "@/db";
import {
  storefrontListings,
  storefrontInquiries,
  products,
  companies,
  categories,
  productOptions,
  productOptionValues,
  productItems,
  itemOptionValues,
  stockLedger,
} from "@/db/schema";
import {
  eq,
  and,
  count,
  ilike,
  sql,
  desc,
  asc,
  inArray,
  gte,
  lte,
} from "drizzle-orm";
import { ServiceError } from "@/lib/service-error";
import type {
  CreateStorefrontListingInput,
  UpdateStorefrontListingInput,
  StorefrontQueryInput,
  CreateStorefrontInquiryInput,
} from "@/validators/storefront.validator";

const visibleStorefrontConditions = [
  eq(storefrontListings.isVisible, true),
  eq(products.isActive, true),
  eq(companies.isActive, true),
];

/**
 * Get paginated storefront products visible to the public.
 */
export async function getStorefrontProducts(params: StorefrontQueryInput) {
  const {
    page,
    limit,
    categoryId,
    categoryIds,
    search,
    minPrice,
    maxPrice,
  } = params;
  const offset = (page - 1) * limit;

  const conditions = [...visibleStorefrontConditions];

  if (search && search.trim().length >= 3) {
    conditions.push(ilike(products.name, `%${search.trim()}%`));
  }

  if (categoryIds?.length) {
    conditions.push(inArray(products.categoryId, categoryIds));
  } else if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  if (minPrice !== undefined) {
    conditions.push(
      gte(storefrontListings.wholesalePrice, minPrice.toFixed(2))
    );
  }

  if (maxPrice !== undefined) {
    conditions.push(
      lte(storefrontListings.wholesalePrice, maxPrice.toFixed(2))
    );
  }

  const whereClause = and(...conditions);

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: storefrontListings.id,
        productId: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        images: products.images,
        categoryName: categories.name,
        wholesalePrice: storefrontListings.wholesalePrice,
        companyId: companies.id,
        companyName: companies.name,
        companySlug: companies.slug,
        companyPhone: companies.phone,
        companyEmail: companies.email,
      })
      .from(storefrontListings)
      .innerJoin(products, eq(storefrontListings.productId, products.id))
      .innerJoin(companies, eq(products.companyId, companies.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause)
      .orderBy(sql`${storefrontListings.createdAt} DESC`)
      .limit(limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(storefrontListings)
      .innerJoin(products, eq(storefrontListings.productId, products.id))
      .innerJoin(companies, eq(products.companyId, companies.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause),
  ]);

  return {
    data,
    total: totalResult[0]?.count ?? 0,
  };
}

/**
 * Get a single visible storefront product by product id.
 */
export async function getStorefrontProductById(productId: string) {
  const [row] = await db
    .select({
      id: storefrontListings.id,
      productId: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      images: products.images,
      categoryName: categories.name,
      wholesalePrice: storefrontListings.wholesalePrice,
      companyId: companies.id,
      companyName: companies.name,
      companySlug: companies.slug,
      companyPhone: companies.phone,
      companyEmail: companies.email,
      companyLogo: companies.logo,
      companyAddress: companies.registeredAddress,
    })
    .from(storefrontListings)
    .innerJoin(products, eq(storefrontListings.productId, products.id))
    .innerJoin(companies, eq(products.companyId, companies.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(...visibleStorefrontConditions, eq(products.id, productId))
    )
    .limit(1);

  if (!row) {
    throw new ServiceError("Product not found", 404);
  }

  // Available quantity = sum of stock ledger movements across all of this
  // product's items. Stock is not stored directly; it is derived from the
  // running ledger (purchases add, sales subtract).
  const [stockRow] = await db
    .select({
      available: sql<number>`COALESCE(SUM(${stockLedger.quantityChange}), 0)::int`,
    })
    .from(stockLedger)
    .innerJoin(productItems, eq(stockLedger.productItemId, productItems.id))
    .where(eq(productItems.productId, productId));

  const availableQuantity = Math.max(0, Number(stockRow?.available ?? 0));

  return { ...row, availableQuantity };
}

export interface StorefrontOptionValue {
  id: string;
  value: string;
  colorCode: string | null;
  /**
   * Available stock for this specific option value (e.g. size "M"), summed
   * from the stock ledger across all product items carrying this value.
   * 0 means out of stock — the storefront disables the option.
   */
  stock: number;
}

export interface StorefrontOption {
  id: string;
  name: string;
  type: "TEXT" | "COLOR" | "NUMBER";
  values: StorefrontOptionValue[];
}

/**
 * Get the public-facing variant options (e.g. Size, Color) for a product,
 * with their selectable values. Only active variant options/values are
 * returned, ordered by display order.
 */
export async function getStorefrontProductOptions(
  productId: string
): Promise<StorefrontOption[]> {
  const optionRows = await db
    .select({
      id: productOptions.id,
      name: productOptions.name,
      type: productOptions.type,
    })
    .from(productOptions)
    .where(
      and(
        eq(productOptions.productId, productId),
        eq(productOptions.isVariant, true),
        eq(productOptions.isActive, true)
      )
    )
    .orderBy(asc(productOptions.displayOrder), asc(productOptions.name));

  if (optionRows.length === 0) return [];

  const optionIds = optionRows.map((o) => o.id);

  const valueRows = await db
    .select({
      id: productOptionValues.id,
      optionId: productOptionValues.optionId,
      value: productOptionValues.value,
      colorCode: productOptionValues.colorCode,
    })
    .from(productOptionValues)
    .where(
      and(
        inArray(productOptionValues.optionId, optionIds),
        eq(productOptionValues.isActive, true)
      )
    )
    .orderBy(asc(productOptionValues.displayOrder), asc(productOptionValues.value));

  // Per-value available stock. For each option value (e.g. size "M") sum the
  // stock ledger across every product item that carries that value. Values
  // with no linked item, or a non-positive balance, are treated as 0.
  const valueIds = valueRows.map((v) => v.id);

  const stockByValueId = new Map<string, number>();

  if (valueIds.length > 0) {
    const stockRows = await db
      .select({
        optionValueId: itemOptionValues.optionValueId,
        available: sql<number>`COALESCE(SUM(${stockLedger.quantityChange}), 0)::int`,
      })
      .from(itemOptionValues)
      .leftJoin(
        stockLedger,
        eq(stockLedger.productItemId, itemOptionValues.itemId)
      )
      .where(inArray(itemOptionValues.optionValueId, valueIds))
      .groupBy(itemOptionValues.optionValueId);

    for (const r of stockRows) {
      stockByValueId.set(r.optionValueId, Math.max(0, Number(r.available ?? 0)));
    }
  }

  return optionRows.map((option) => ({
    id: option.id,
    name: option.name,
    type: option.type as StorefrontOption["type"],
    values: valueRows
      .filter((v) => v.optionId === option.id)
      .map((v) => ({
        id: v.id,
        value: v.value,
        colorCode: v.colorCode,
        stock: stockByValueId.get(v.id) ?? 0,
      })),
  }));
}

/**
 * Get a single visible storefront product by company slug + product slug.
 */
export async function getStorefrontProductBySlugs(
  companySlug: string,
  productSlug: string
) {
  const [row] = await db
    .select({
      id: storefrontListings.id,
      productId: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      images: products.images,
      categoryName: categories.name,
      wholesalePrice: storefrontListings.wholesalePrice,
      companyId: companies.id,
      companyName: companies.name,
      companySlug: companies.slug,
      companyPhone: companies.phone,
      companyEmail: companies.email,
      companyLogo: companies.logo,
      companyAddress: companies.registeredAddress,
    })
    .from(storefrontListings)
    .innerJoin(products, eq(storefrontListings.productId, products.id))
    .innerJoin(companies, eq(products.companyId, companies.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        ...visibleStorefrontConditions,
        eq(companies.slug, companySlug),
        eq(products.slug, productSlug)
      )
    )
    .limit(1);

  if (!row) {
    throw new ServiceError("Product not found", 404);
  }

  return row;
}

/**
 * Create a public wholesale inquiry for a company (optional product).
 */
export async function createStorefrontInquiry(data: CreateStorefrontInquiryInput) {
  const [company] = await db
    .select({ id: companies.id, isActive: companies.isActive })
    .from(companies)
    .where(eq(companies.id, data.companyId))
    .limit(1);

  if (!company || !company.isActive) {
    throw new ServiceError("Company not found", 404);
  }

  if (data.productId) {
    const [product] = await db
      .select({ id: products.id, companyId: products.companyId })
      .from(products)
      .where(eq(products.id, data.productId))
      .limit(1);

    if (!product || product.companyId !== data.companyId) {
      throw new ServiceError("Product not found for this company", 404);
    }
  }

  const [inquiry] = await db
    .insert(storefrontInquiries)
    .values({
      companyId: data.companyId,
      productId: data.productId || null,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      message: data.message,
    })
    .returning();

  return inquiry;
}

/**
 * List inquiries for a company (dashboard).
 */
export async function getCompanyInquiries(companyId: string) {
  return db
    .select({
      id: storefrontInquiries.id,
      name: storefrontInquiries.name,
      phone: storefrontInquiries.phone,
      email: storefrontInquiries.email,
      message: storefrontInquiries.message,
      createdAt: storefrontInquiries.createdAt,
      productId: storefrontInquiries.productId,
      productName: products.name,
    })
    .from(storefrontInquiries)
    .leftJoin(products, eq(storefrontInquiries.productId, products.id))
    .where(eq(storefrontInquiries.companyId, companyId))
    .orderBy(desc(storefrontInquiries.createdAt));
}

export async function getCompanyListings(companyId: string) {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productImages: products.images,
      listingId: storefrontListings.id,
      wholesalePrice: storefrontListings.wholesalePrice,
      isVisible: storefrontListings.isVisible,
      createdAt: storefrontListings.createdAt,
      updatedAt: storefrontListings.updatedAt,
    })
    .from(products)
    .leftJoin(
      storefrontListings,
      eq(storefrontListings.productId, products.id)
    )
    .where(
      and(eq(products.companyId, companyId), eq(products.isActive, true))
    )
    .orderBy(products.name);

  return rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    productImages: row.productImages ?? [],
    listing: row.listingId
      ? {
          id: row.listingId,
          wholesalePrice: row.wholesalePrice,
          isVisible: row.isVisible,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      : null,
  }));
}

export async function getStorefrontCategories() {
  const rows = await db
    .selectDistinct({
      id: categories.id,
      name: categories.name,
      bannerImage: categories.bannerImage,
    })
    .from(storefrontListings)
    .innerJoin(products, eq(storefrontListings.productId, products.id))
    .innerJoin(companies, eq(products.companyId, companies.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...visibleStorefrontConditions))
    .orderBy(categories.name);

  return rows;
}

export async function createListing(
  companyId: string,
  data: CreateStorefrontListingInput
) {
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(eq(products.id, data.productId), eq(products.companyId, companyId))
    );

  if (!product) {
    throw new ServiceError(
      "Forbidden: product does not belong to your company",
      403
    );
  }

  const [existing] = await db
    .select()
    .from(storefrontListings)
    .where(eq(storefrontListings.productId, data.productId));

  if (existing) {
    throw new ServiceError("Listing already exists for this product", 409);
  }

  const [listing] = await db
    .insert(storefrontListings)
    .values({
      productId: data.productId,
      wholesalePrice: data.wholesalePrice.toFixed(2),
      isVisible: data.isVisible,
    })
    .returning();

  return listing;
}

export async function updateListing(
  companyId: string,
  listingId: string,
  data: UpdateStorefrontListingInput
) {
  const [listingWithProduct] = await db
    .select({
      id: storefrontListings.id,
      companyId: products.companyId,
    })
    .from(storefrontListings)
    .innerJoin(products, eq(storefrontListings.productId, products.id))
    .where(eq(storefrontListings.id, listingId));

  if (!listingWithProduct) {
    throw new ServiceError("Listing not found", 404);
  }

  if (listingWithProduct.companyId !== companyId) {
    throw new ServiceError(
      "Forbidden: listing does not belong to your company",
      403
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.wholesalePrice !== undefined) {
    updates.wholesalePrice = data.wholesalePrice.toFixed(2);
  }

  if (data.isVisible !== undefined) {
    updates.isVisible = data.isVisible;
  }

  const [updated] = await db
    .update(storefrontListings)
    .set(updates)
    .where(eq(storefrontListings.id, listingId))
    .returning();

  return updated;
}
