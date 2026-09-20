/**
 * Sale service
 *
 * Handles sale creation, retrieval, update, and deletion
 * scoped to a company.
 *
 * Requirements: 8.1–8.11
 */

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";

import { sales, saleItems, products, productItems, listings } from "@/db/schema";

import { ServiceError } from "@/lib/service-error";

import type { PaginationParams } from "@/lib/pagination";

import {
  writeStockEntry,
  getStockLevel,
} from "@/services/stock-ledger.service";

import type {
  CreateSaleInput,
  UpdateSaleInput,
} from "@/validators/sale.validator";

/**
 * Create a new sale (and optionally deduct stock if COMPLETED).
 */
export async function createSale(companyId: string, data: CreateSaleInput) {
  return db.transaction(async (tx) => {
    // Validate all product item IDs belong to this company
    const itemIds = data.items.map((i) => i.productItemId);

    const validItems = await tx
      .select({ id: productItems.id, sku: productItems.sku })
      .from(productItems)
      .innerJoin(products, eq(products.id, productItems.productId))
      .where(eq(products.companyId, companyId));

    const validItemMap = new Map(validItems.map((v) => [v.id, v]));

    for (const itemId of itemIds) {
      if (!validItemMap.has(itemId)) {
        throw new ServiceError(
          `Product item ${itemId} not found or does not belong to your company`,
          404
        );
      }
    }

    // If COMPLETED, check sufficient stock for each item
    if (data.status === "COMPLETED") {
      for (const item of data.items) {
        const currentStock = await getStockLevel(companyId, item.productItemId);
        if (currentStock - item.quantity < 0) {
          const sku = validItemMap.get(item.productItemId)?.sku ?? item.productItemId;
          throw new ServiceError(
            `Insufficient stock for item "${sku}". Available: ${currentStock}, requested: ${item.quantity}`,
            422
          );
        }
      }
    }

    // Validate listing ownership if listingId is provided
    if (data.listingId) {
      const [listing] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(
          and(eq(listings.id, data.listingId), eq(listings.companyId, companyId))
        )
        .limit(1);

      if (!listing) {
        throw new ServiceError(
          "Listing not found or does not belong to your company",
          404
        );
      }
    }

    // Compute total amount
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Insert the sale
    const [sale] = await tx
      .insert(sales)
      .values({
        companyId,
        referenceNo: data.referenceNo ?? null,
        saleDate: data.saleDate,
        customerName: data.customerName ?? null,
        customerPhone: data.customerPhone ?? null,
        totalAmount: totalAmount.toFixed(2),
        status: data.status,
        notes: data.notes ?? null,
        channel: data.channel ?? null,
        listingId: data.listingId ?? null,
      })
      .returning();

    // Insert sale items
    const insertedItems = await tx
      .insert(saleItems)
      .values(
        data.items.map((item) => ({
          saleId: sale.id,
          productItemId: item.productItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          totalPrice: (item.quantity * item.unitPrice).toFixed(2),
        }))
      )
      .returning();

    // Write stock ledger if COMPLETED
    if (data.status === "COMPLETED") {
      for (const item of data.items) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.productItemId,
          movementType: "SALE",
          referenceType: "SALE",
          referenceId: sale.id,
          quantityChange: -item.quantity,
        });
      }
    }

    return { ...sale, items: insertedItems };
  });
}

/**
 * Optional filters for the getSales query.
 */
export interface GetSalesFilters {
  returnStatus?: string;
}

/**
 * Return a paginated list of sales for the company.
 */
export async function getSales(
  companyId: string,
  params: PaginationParams,
  filters?: GetSalesFilters
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(sales.companyId, companyId)];

  if (filters?.returnStatus) {
    conditions.push(eq(sales.returnStatus, filters.returnStatus));
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(sales)
      .where(where)
      .orderBy(desc(sales.saleDate))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(sales).where(where),
  ]);

  return { data, total };
}

/**
 * Fetch a single sale with its items. Throws 404 if not found.
 */
export async function getSaleById(companyId: string, id: string) {
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.companyId, companyId)))
    .limit(1);

  if (!sale) {
    throw new ServiceError("Sale not found", 404);
  }

  const items = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, id));

  return { ...sale, items };
}

/**
 * Update a sale's status (and write ledger entries when needed).
 *
 * Transition rules:
 *   COMPLETED → PENDING   : forbidden
 *   PENDING   → COMPLETED : stock check + write negative entries
 *   COMPLETED → CANCELLED : write positive (reversal) entries
 */
export async function updateSale(
  companyId: string,
  id: string,
  data: UpdateSaleInput
) {
  const existing = await getSaleById(companyId, id);

  const oldStatus = existing.status;
  const newStatus = data.status;

  if (oldStatus === "COMPLETED" && newStatus === "PENDING") {
    throw new ServiceError("Cannot revert a completed sale", 400);
  }

  if (oldStatus === newStatus) {
    const [updated] = await db
      .update(sales)
      .set({
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(sales.id, id), eq(sales.companyId, companyId)))
      .returning();
    return updated;
  }

  return db.transaction(async (tx) => {
    if (oldStatus === "PENDING" && newStatus === "COMPLETED") {
      // Stock check before writing
      for (const item of existing.items) {
        const currentStock = await getStockLevel(companyId, item.productItemId);
        if (currentStock - item.quantity < 0) {
          throw new ServiceError(
            `Insufficient stock for item "${item.productItemId}". Available: ${currentStock}, requested: ${item.quantity}`,
            422
          );
        }
      }

      for (const item of existing.items) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.productItemId,
          movementType: "SALE",
          referenceType: "SALE",
          referenceId: id,
          quantityChange: -item.quantity,
        });
      }
    }

    if (oldStatus === "COMPLETED" && newStatus === "CANCELLED") {
      for (const item of existing.items) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.productItemId,
          movementType: "ADJUSTMENT",
          referenceType: "SALE",
          referenceId: id,
          quantityChange: item.quantity,
          notes: "Sale cancellation reversal",
        });
      }
    }

    const [updated] = await tx
      .update(sales)
      .set({
        status: newStatus,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(sales.id, id), eq(sales.companyId, companyId)))
      .returning();

    return updated;
  });
}

/**
 * Delete a sale. Only PENDING sales may be deleted.
 */
export async function deleteSale(companyId: string, id: string) {
  const existing = await getSaleById(companyId, id);

  if (existing.status !== "PENDING") {
    throw new ServiceError("Can only delete pending sales", 409);
  }

  const [deleted] = await db
    .delete(sales)
    .where(and(eq(sales.id, id), eq(sales.companyId, companyId)))
    .returning();

  return deleted;
}
