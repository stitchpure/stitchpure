/**
 * Stock Ledger service
 *
 * Handles stock level queries and ledger writes.
 *
 * Requirements: 9.1–9.5
 */

import { db } from "@/db";

import { stockLedger, productItems, products } from "@/db/schema";

import { and, count, desc, eq, sql } from "drizzle-orm";

import { ServiceError } from "@/lib/service-error";

import type { PaginationParams } from "@/lib/pagination";

/**
 * Get the current stock level for a product item within a company.
 * Returns the sum of all quantity changes in the ledger (defaults to 0).
 */
export async function getStockLevel(
  companyId: string,
  productItemId: string
): Promise<number> {
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${stockLedger.quantityChange}), 0)`,
    })
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.productItemId, productItemId),
        eq(stockLedger.companyId, companyId)
      )
    );

  return Number(result[0]?.total ?? 0);
}

/**
 * Write a stock ledger entry within a transaction.
 * Calculates quantityAfter as current stock + quantityChange.
 */
export async function writeStockEntry(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: {
    companyId: string;
    productItemId: string;
    movementType: "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN";
    referenceType?: string;
    referenceId?: string;
    quantityChange: number;
    notes?: string;
  }
) {
  const currentResult = await tx
    .select({
      total: sql<string>`COALESCE(SUM(${stockLedger.quantityChange}), 0)`,
    })
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.productItemId, entry.productItemId),
        eq(stockLedger.companyId, entry.companyId)
      )
    );

  const current = Number(currentResult[0]?.total ?? 0);
  const quantityAfter = current + entry.quantityChange;

  const [inserted] = await tx
    .insert(stockLedger)
    .values({
      companyId: entry.companyId,
      productItemId: entry.productItemId,
      movementType: entry.movementType,
      referenceType: entry.referenceType ?? null,
      referenceId: entry.referenceId ?? null,
      quantityChange: entry.quantityChange,
      quantityAfter,
      notes: entry.notes ?? null,
    })
    .returning();

  return inserted;
}

/**
 * Return a paginated ledger for a specific product item.
 * Verifies the item belongs to the company before querying.
 */
export async function getStockLedger(
  companyId: string,
  productItemId: string,
  params: PaginationParams
) {
  // Verify the product item belongs to the company
  const [item] = await db
    .select({ id: productItems.id })
    .from(productItems)
    .innerJoin(products, eq(products.id, productItems.productId))
    .where(
      and(
        eq(productItems.id, productItemId),
        eq(products.companyId, companyId)
      )
    )
    .limit(1);

  if (!item) {
    throw new ServiceError("Product item not found", 404);
  }

  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const where = and(
    eq(stockLedger.productItemId, productItemId),
    eq(stockLedger.companyId, companyId)
  );

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(stockLedger)
      .where(where)
      .orderBy(desc(stockLedger.createdAt))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(stockLedger).where(where),
  ]);

  return { data, total };
}
