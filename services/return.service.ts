/**
 * Return service
 *
 * Handles return processing and return rate reporting.
 *
 * Requirements: 11.1, 11.2, 11.3, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4,
 *              14.1, 14.2, 14.3, 15.1, 15.2, 15.3, 15.4, 16.1, 16.2, 16.4
 */

import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";

import { sales, saleItems, productItems } from "@/db/schema";

import { ServiceError } from "@/lib/service-error";

import { writeStockEntry } from "@/services/stock-ledger.service";

import type { ProcessReturnInput } from "@/validators/return.validator";

/**
 * Process a return for a completed sale.
 *
 * 1. Validates the sale is COMPLETED and not already returned.
 * 2. If scannedSku is provided, verifies it matches one of the sale items' product item SKUs.
 * 3. Updates the sale record with return fields.
 * 4. If returnCondition is "Good", creates stock_ledger RETURN entries restoring stock for each sale item.
 * 5. All within a DB transaction.
 */
export async function processReturn(
  companyId: string,
  saleId: string,
  data: ProcessReturnInput
) {
  return db.transaction(async (tx) => {
    // Fetch the sale and verify it belongs to the company
    const [sale] = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.companyId, companyId)))
      .limit(1);

    if (!sale) {
      throw new ServiceError("Sale not found", 404);
    }

    // Validate sale is COMPLETED
    if (sale.status !== "COMPLETED") {
      throw new ServiceError(
        "Can only process returns for completed sales",
        409
      );
    }

    // Validate sale is not already returned
    if (sale.returnStatus === "RETURNED") {
      throw new ServiceError("This sale has already been returned", 409);
    }

    // Fetch sale items with their product item details
    const items = await tx
      .select({
        saleItemId: saleItems.id,
        productItemId: saleItems.productItemId,
        quantity: saleItems.quantity,
        sku: productItems.sku,
      })
      .from(saleItems)
      .innerJoin(productItems, eq(productItems.id, saleItems.productItemId))
      .where(eq(saleItems.saleId, saleId));

    // If scannedSku is provided, verify it matches one of the sale items
    if (data.scannedSku) {
      const matchingItem = items.find(
        (item) => item.sku === data.scannedSku
      );
      if (!matchingItem) {
        throw new ServiceError(
          `Scanned SKU "${data.scannedSku}" does not match any item in this sale`,
          400
        );
      }
    }

    // Update the sale record with return fields
    const [updatedSale] = await tx
      .update(sales)
      .set({
        returnStatus: "RETURNED",
        returnReason: data.returnReason,
        returnCondition: data.returnCondition,
        returnedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(sales.id, saleId), eq(sales.companyId, companyId)))
      .returning();

    // If condition is Good, create stock_ledger RETURN entries to restore stock
    if (data.returnCondition === "Good") {
      for (const item of items) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.productItemId,
          movementType: "RETURN",
          referenceType: "SALE",
          referenceId: saleId,
          quantityChange: item.quantity,
          notes: `Return (Good condition) - Reason: ${data.returnReason}`,
        });
      }
    }
    // For Damaged or Wrong_Product conditions, no stock ledger entry is created

    return updatedSale;
  });
}

export interface ReturnReportItem {
  listingId: string | null;
  totalOrders: number;
  returnCount: number;
  returnRate: number;
  reasonBreakdown: Record<string, number>;
  conditionBreakdown: Record<string, number>;
}

/**
 * Get return rate report grouped by listing.
 *
 * For each listing:
 * - total_orders: all sales for that listing
 * - return_count: sales with return_status IS NOT NULL
 * - return_rate: return_count / total_orders
 * - breakdown by return_reason and return_condition
 *
 * Sorted by return_rate descending.
 */
export async function getReturnReport(
  companyId: string
): Promise<ReturnReportItem[]> {
  // Get total orders per listing
  const orderCounts = await db
    .select({
      listingId: sales.listingId,
      totalOrders: count().as("total_orders"),
    })
    .from(sales)
    .where(and(eq(sales.companyId, companyId), isNotNull(sales.listingId)))
    .groupBy(sales.listingId);

  // Get return counts per listing
  const returnCounts = await db
    .select({
      listingId: sales.listingId,
      returnCount: count().as("return_count"),
    })
    .from(sales)
    .where(
      and(
        eq(sales.companyId, companyId),
        isNotNull(sales.listingId),
        isNotNull(sales.returnStatus)
      )
    )
    .groupBy(sales.listingId);

  // Get reason breakdown per listing
  const reasonBreakdowns = await db
    .select({
      listingId: sales.listingId,
      returnReason: sales.returnReason,
      count: count().as("count"),
    })
    .from(sales)
    .where(
      and(
        eq(sales.companyId, companyId),
        isNotNull(sales.listingId),
        isNotNull(sales.returnStatus),
        isNotNull(sales.returnReason)
      )
    )
    .groupBy(sales.listingId, sales.returnReason);

  // Get condition breakdown per listing
  const conditionBreakdowns = await db
    .select({
      listingId: sales.listingId,
      returnCondition: sales.returnCondition,
      count: count().as("count"),
    })
    .from(sales)
    .where(
      and(
        eq(sales.companyId, companyId),
        isNotNull(sales.listingId),
        isNotNull(sales.returnStatus),
        isNotNull(sales.returnCondition)
      )
    )
    .groupBy(sales.listingId, sales.returnCondition);

  // Build lookup maps
  const orderMap = new Map<string, number>();
  for (const row of orderCounts) {
    if (row.listingId) {
      orderMap.set(row.listingId, row.totalOrders);
    }
  }

  const returnMap = new Map<string, number>();
  for (const row of returnCounts) {
    if (row.listingId) {
      returnMap.set(row.listingId, row.returnCount);
    }
  }

  const reasonMap = new Map<string, Record<string, number>>();
  for (const row of reasonBreakdowns) {
    if (row.listingId && row.returnReason) {
      if (!reasonMap.has(row.listingId)) {
        reasonMap.set(row.listingId, {});
      }
      reasonMap.get(row.listingId)![row.returnReason] = row.count;
    }
  }

  const conditionMap = new Map<string, Record<string, number>>();
  for (const row of conditionBreakdowns) {
    if (row.listingId && row.returnCondition) {
      if (!conditionMap.has(row.listingId)) {
        conditionMap.set(row.listingId, {});
      }
      conditionMap.get(row.listingId)![row.returnCondition] = row.count;
    }
  }

  // Combine into report items
  const listingIds = new Set<string>();
  for (const row of orderCounts) {
    if (row.listingId) listingIds.add(row.listingId);
  }

  const report: ReturnReportItem[] = [];

  for (const listingId of listingIds) {
    const totalOrders = orderMap.get(listingId) ?? 0;
    const returnCount = returnMap.get(listingId) ?? 0;
    const returnRate = totalOrders > 0 ? returnCount / totalOrders : 0;

    report.push({
      listingId,
      totalOrders,
      returnCount,
      returnRate: Math.round(returnRate * 10000) / 10000, // 4 decimal places
      reasonBreakdown: reasonMap.get(listingId) ?? {},
      conditionBreakdown: conditionMap.get(listingId) ?? {},
    });
  }

  // Sort by return_rate descending
  report.sort((a, b) => b.returnRate - a.returnRate);

  return report;
}
