/**
 * Purchase service
 *
 * Handles purchase creation, retrieval, update, and deletion
 * scoped to a company.
 *
 * Requirements: 7.1–7.10
 */

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";

import {
  purchases,
  purchaseItems,
  products,
  productItems,
} from "@/db/schema";

import { ServiceError } from "@/lib/service-error";

import type { PaginationParams } from "@/lib/pagination";

import { writeStockEntry } from "@/services/stock-ledger.service";

import type {
  CreatePurchaseInput,
  UpdatePurchaseInput,
  EditPurchaseInput,
} from "@/validators/purchase.validator";

/**
 * Create a new purchase (and optionally update stock if RECEIVED).
 */
export async function createPurchase(
  companyId: string,
  data: CreatePurchaseInput
) {
  return db.transaction(async (tx) => {
    // Validate all product item IDs belong to this company
    const itemIds = data.items.map((i) => i.productItemId);

    const validItems = await tx
      .select({ id: productItems.id })
      .from(productItems)
      .innerJoin(products, eq(products.id, productItems.productId))
      .where(
        and(
          eq(products.companyId, companyId)
        )
      );

    const validItemIdSet = new Set(validItems.map((v) => v.id));

    for (const itemId of itemIds) {
      if (!validItemIdSet.has(itemId)) {
        throw new ServiceError(
          `Product item ${itemId} not found or does not belong to your company`,
          404
        );
      }
    }

    // Compute total amount
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Insert the purchase
    const [purchase] = await tx
      .insert(purchases)
      .values({
        companyId,
        supplierId: data.supplierId ?? null,
        referenceNo: data.referenceNo ?? null,
        purchaseDate: data.purchaseDate,
        totalAmount: totalAmount.toFixed(2),
        status: data.status,
        notes: data.notes ?? null,
      })
      .returning();

    // Insert purchase items
    const insertedItems = await tx
      .insert(purchaseItems)
      .values(
        data.items.map((item) => ({
          purchaseId: purchase.id,
          productItemId: item.productItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          totalPrice: (item.quantity * item.unitPrice).toFixed(2),
        }))
      )
      .returning();

    // Write stock ledger if status is RECEIVED
    if (data.status === "RECEIVED") {
      for (const item of data.items) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.productItemId,
          movementType: "PURCHASE",
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          quantityChange: item.quantity,
        });
      }
    }

    return { ...purchase, items: insertedItems };
  });
}

/**
 * Return a paginated list of purchases for the company.
 */
export async function getPurchases(
  companyId: string,
  params: PaginationParams
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const where = eq(purchases.companyId, companyId);

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(purchases)
      .where(where)
      .orderBy(desc(purchases.purchaseDate))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(purchases).where(where),
  ]);

  return { data, total };
}

/**
 * Fetch a single purchase with its items. Throws 404 if not found.
 */
export async function getPurchaseById(companyId: string, id: string) {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.id, id), eq(purchases.companyId, companyId)))
    .limit(1);

  if (!purchase) {
    throw new ServiceError("Purchase not found", 404);
  }

  const items = await db
    .select()
    .from(purchaseItems)
    .where(eq(purchaseItems.purchaseId, id));

  return { ...purchase, items };
}

/**
 * Update a purchase's status (and write ledger entries when needed).
 *
 * Transition rules:
 *   RECEIVED → PENDING : forbidden
 *   PENDING  → RECEIVED: write positive stock entries
 *   RECEIVED → CANCELLED: write negative (reversal) stock entries
 */
export async function updatePurchase(
  companyId: string,
  id: string,
  data: UpdatePurchaseInput
) {
  const existing = await getPurchaseById(companyId, id);

  const oldStatus = existing.status;
  const newStatus = data.status;

  if (oldStatus === "RECEIVED" && newStatus === "PENDING") {
    throw new ServiceError("Cannot revert a received purchase", 400);
  }

  if (oldStatus === newStatus) {
    // No status change — just update notes if provided
    const [updated] = await db
      .update(purchases)
      .set({
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(purchases.id, id), eq(purchases.companyId, companyId)))
      .returning();
    return updated;
  }

  return db.transaction(async (tx) => {
    if (oldStatus === "PENDING" && newStatus === "RECEIVED") {
      for (const item of existing.items) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.productItemId,
          movementType: "PURCHASE",
          referenceType: "PURCHASE",
          referenceId: id,
          quantityChange: item.quantity,
        });
      }
    }

    if (oldStatus === "RECEIVED" && newStatus === "CANCELLED") {
      for (const item of existing.items) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.productItemId,
          movementType: "ADJUSTMENT",
          referenceType: "PURCHASE",
          referenceId: id,
          quantityChange: -item.quantity,
          notes: "Purchase cancellation reversal",
        });
      }
    }

    const [updated] = await tx
      .update(purchases)
      .set({
        status: newStatus,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(purchases.id, id), eq(purchases.companyId, companyId)))
      .returning();

    return updated;
  });
}

/**
 * Full edit of a PENDING purchase — replaces metadata and all line items.
 * Only PENDING purchases can be edited (no stock ledger entries exist yet).
 */
export async function editPurchase(
  companyId: string,
  id: string,
  data: EditPurchaseInput
) {
  const existing = await getPurchaseById(companyId, id);

  if (existing.status !== "PENDING") {
    throw new ServiceError(
      "Can only edit purchases with PENDING status",
      409
    );
  }

  return db.transaction(async (tx) => {
    // Validate all new product item IDs belong to this company
    const itemIds = data.items.map((i) => i.productItemId);

    const validItems = await tx
      .select({ id: productItems.id })
      .from(productItems)
      .innerJoin(products, eq(products.id, productItems.productId))
      .where(and(eq(products.companyId, companyId)));

    const validItemIdSet = new Set(validItems.map((v) => v.id));

    for (const itemId of itemIds) {
      if (!validItemIdSet.has(itemId)) {
        throw new ServiceError(
          `Product item ${itemId} not found or does not belong to your company`,
          404
        );
      }
    }

    // Compute new total
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Update purchase metadata
    const [updated] = await tx
      .update(purchases)
      .set({
        supplierId: data.supplierId ?? null,
        referenceNo: data.referenceNo ?? null,
        purchaseDate: data.purchaseDate,
        totalAmount: totalAmount.toFixed(2),
        notes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(purchases.id, id), eq(purchases.companyId, companyId)))
      .returning();

    // Delete old items and insert new ones
    await tx
      .delete(purchaseItems)
      .where(eq(purchaseItems.purchaseId, id));

    const insertedItems = await tx
      .insert(purchaseItems)
      .values(
        data.items.map((item) => ({
          purchaseId: id,
          productItemId: item.productItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          totalPrice: (item.quantity * item.unitPrice).toFixed(2),
        }))
      )
      .returning();

    return { ...updated, items: insertedItems };
  });
}

/**
 * Delete a purchase. Only PENDING purchases may be deleted.
 */
export async function deletePurchase(companyId: string, id: string) {
  const existing = await getPurchaseById(companyId, id);

  if (existing.status !== "PENDING") {
    throw new ServiceError("Can only delete pending purchases", 409);
  }

  const [deleted] = await db
    .delete(purchases)
    .where(and(eq(purchases.id, id), eq(purchases.companyId, companyId)))
    .returning();

  return deleted;
}
