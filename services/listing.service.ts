/**
 * Listing service
 *
 * Handles listing creation, retrieval, update, deactivation,
 * and performance metrics, scoped to a company.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4
 */

import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";

import {
  listings,
  sales,
  saleItems,
  products,
  productItems,
} from "@/db/schema";

import { ServiceError } from "@/lib/service-error";

import type { PaginationParams } from "@/lib/pagination";

import type {
  CreateListingInput,
  UpdateListingInput,
} from "@/validators/listing.validator";

export interface ListingFilters {
  channel?: string;
  productItemId?: string;
  isActive?: boolean;
}

export interface ListingPerformance {
  listingId: string;
  totalOrders: number;
  totalReturns: number;
  returnRate: number;
  totalRevenue: number;
  profit: number;
}

/**
 * Create a new listing.
 * Validates that the productItemId belongs to the company.
 */
export async function createListing(
  companyId: string,
  data: CreateListingInput
) {
  // Validate product item ownership
  const [validItem] = await db
    .select({ id: productItems.id })
    .from(productItems)
    .innerJoin(products, eq(products.id, productItems.productId))
    .where(
      and(
        eq(products.companyId, companyId),
        eq(productItems.id, data.productItemId)
      )
    )
    .limit(1);

  if (!validItem) {
    throw new ServiceError(
      "Product item not found or does not belong to your company",
      404
    );
  }

  const [created] = await db
    .insert(listings)
    .values({
      companyId,
      productItemId: data.productItemId,
      channel: data.channel,
      title: data.title,
      listingPrice: data.listingPrice.toFixed(2),
      platformSku: data.platformSku ?? null,
      listingUrl: data.listingUrl ?? null,
    })
    .returning();

  return created;
}

/**
 * Return a paginated list of listings for the company.
 * Supports optional filters: channel, productItemId, isActive.
 */
export async function getListings(
  companyId: string,
  params: PaginationParams,
  filters?: ListingFilters
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(listings.companyId, companyId)];

  if (filters?.channel) {
    conditions.push(eq(listings.channel, filters.channel as any));
  }

  if (filters?.productItemId) {
    conditions.push(eq(listings.productItemId, filters.productItemId));
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(listings.isActive, filters.isActive));
  }

  const where = and(...conditions);

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(listings)
      .where(where)
      .orderBy(desc(listings.createdAt))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(listings).where(where),
  ]);

  return { data, total };
}

/**
 * Fetch a single listing by id AND companyId. Throws 404 if not found.
 */
export async function getListingById(companyId: string, id: string) {
  const [listing] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.companyId, companyId)))
    .limit(1);

  if (!listing) {
    throw new ServiceError("Listing not found", 404);
  }

  return listing;
}

/**
 * Update a listing. Verifies ownership first, then applies partial update.
 */
export async function updateListing(
  companyId: string,
  id: string,
  data: UpdateListingInput
) {
  // Verify ownership
  await getListingById(companyId, id);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.listingPrice !== undefined) updateData.listingPrice = data.listingPrice.toFixed(2);
  if (data.platformSku !== undefined) updateData.platformSku = data.platformSku;
  if (data.listingUrl !== undefined) updateData.listingUrl = data.listingUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [updated] = await db
    .update(listings)
    .set(updateData)
    .where(and(eq(listings.id, id), eq(listings.companyId, companyId)))
    .returning();

  return updated;
}

/**
 * Deactivate a listing (soft-delete). Sets is_active to false.
 */
export async function deactivateListing(companyId: string, id: string) {
  // Verify ownership
  await getListingById(companyId, id);

  const [updated] = await db
    .update(listings)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(listings.id, id), eq(listings.companyId, companyId)))
    .returning();

  return updated;
}

/**
 * Get performance metrics for a listing.
 * Computes: total_orders, total_returns, return_rate, total_revenue, profit.
 */
export async function getListingPerformance(
  companyId: string,
  id: string
): Promise<ListingPerformance> {
  // Verify listing exists and belongs to company
  await getListingById(companyId, id);

  // Query sales metrics for this listing
  const [metrics] = await db
    .select({
      totalOrders: count(),
      totalReturns: count(sales.returnStatus),
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)`,
    })
    .from(sales)
    .where(eq(sales.listingId, id));

  const totalOrders = metrics?.totalOrders ?? 0;
  const totalReturns = metrics?.totalReturns ?? 0;
  const totalRevenue = parseFloat(metrics?.totalRevenue ?? "0");
  const returnRate = totalOrders > 0 ? totalReturns / totalOrders : 0;

  // Compute total cost from sale items joined with product items' purchase price
  const [costResult] = await db
    .select({
      totalCost: sql<string>`COALESCE(SUM(${saleItems.quantity} * ${productItems.purchasePrice}::numeric), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(productItems, eq(productItems.id, saleItems.productItemId))
    .where(eq(sales.listingId, id));

  const totalCost = parseFloat(costResult?.totalCost ?? "0");
  const profit = totalRevenue - totalCost;

  return {
    listingId: id,
    totalOrders,
    totalReturns,
    returnRate: Math.round(returnRate * 10000) / 10000, // 4 decimal places
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  };
}
