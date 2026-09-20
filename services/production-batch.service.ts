/**
 * Production Batch service
 *
 * Handles production batch creation, retrieval, update, deletion,
 * state machine transitions, and cost aggregation on completion.
 * All operations are scoped to a company.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9,
 *              15.10, 15.11, 15.12, 15.17, 15.18, 15.19,
 *              16.1, 16.2, 16.3, 16.6, 16.7
 */

import { and, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";

import {
  expenses,
  productionBatches,
  productItems,
  products,
} from "@/db/schema";

import { ServiceError } from "@/lib/service-error";

import type { PaginationParams } from "@/lib/pagination";

import type {
  CreateBatchInput,
  UpdateBatchInput,
} from "@/validators/production-batch.validator";

/**
 * Valid state transitions for production batch lifecycle.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
};

/**
 * Generate the next sequential batch number for a company.
 * Format: BATCH-XXXX (zero-padded 4 digits).
 * Must be called inside a transaction to avoid race conditions.
 */
export async function generateBatchNumber(
  companyId: string,
  tx?: typeof db
): Promise<string> {
  const queryDb = tx ?? db;

  const [result] = await queryDb
    .select({
      maxBatchNumber: sql<string | null>`MAX(${productionBatches.batchNumber})`,
    })
    .from(productionBatches)
    .where(eq(productionBatches.companyId, companyId));

  let nextNumber = 1;

  if (result?.maxBatchNumber) {
    // Extract the numeric portion from "BATCH-XXXX"
    const numericPart = result.maxBatchNumber.replace("BATCH-", "");
    const parsed = parseInt(numericPart, 10);
    if (!isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  return `BATCH-${nextNumber.toString().padStart(4, "0")}`;
}

/**
 * Validate that productId exists and belongs to the given company.
 * Throws ServiceError 400 if not found.
 */
async function validateProductId(
  productId: string,
  companyId: string,
  tx?: typeof db
) {
  const queryDb = tx ?? db;

  const [product] = await queryDb
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .limit(1);

  if (!product) {
    throw new ServiceError("Invalid product reference", 400);
  }
}

/**
 * Validate that productItemId belongs to the specified productId.
 * Throws ServiceError 400 if not found or doesn't belong to the product.
 */
async function validateProductItemId(
  productItemId: string,
  productId: string,
  tx?: typeof db
) {
  const queryDb = tx ?? db;

  const [item] = await queryDb
    .select({ id: productItems.id })
    .from(productItems)
    .where(
      and(
        eq(productItems.id, productItemId),
        eq(productItems.productId, productId)
      )
    )
    .limit(1);

  if (!item) {
    throw new ServiceError("Invalid product item reference", 400);
  }
}

/**
 * Validate state transition according to the batch lifecycle state machine.
 * Throws ServiceError 422 if transition is not permitted.
 */
function validateStatusTransition(currentStatus: string, newStatus: string) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new ServiceError("Status transition not permitted", 422);
  }
}

/**
 * Validate quantity cross-field constraint:
 * producedQuantity must equal goodQuantity + rejectedQuantity
 * when all three are provided.
 */
function validateQuantities(data: UpdateBatchInput, _existing: { producedQuantity: number; goodQuantity: number; rejectedQuantity: number }) {
  const produced = data.producedQuantity ?? undefined;
  const good = data.goodQuantity ?? undefined;
  const rejected = data.rejectedQuantity ?? undefined;

  // Only validate when all three are provided in the update
  if (produced !== undefined && good !== undefined && rejected !== undefined) {
    if (produced !== good + rejected) {
      throw new ServiceError(
        "producedQuantity must equal goodQuantity + rejectedQuantity",
        400
      );
    }
  }
}

/**
 * Aggregate expenses by category for a production batch and compute costs.
 * Returns cost totals and per-unit values.
 */
async function aggregateBatchCosts(
  batchId: string,
  goodQuantity: number,
  tx: typeof db
) {
  // Get all expenses linked to this batch where includeInManufacturingCost is true
  const batchExpenses = await tx
    .select({
      category: expenses.category,
      amount: expenses.amount,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.productionBatchId, batchId),
        eq(expenses.includeInManufacturingCost, true)
      )
    );

  // Aggregate by category
  const categoryCosts: Record<string, number> = {
    MATERIAL: 0,
    LABOUR: 0,
    PACKAGING: 0,
    OVERHEAD: 0,
    TRANSPORT: 0,
    OTHER: 0,
  };

  for (const expense of batchExpenses) {
    const amount = parseFloat(expense.amount);
    categoryCosts[expense.category] += amount;
  }

  const totalManufacturingCost = Object.values(categoryCosts).reduce(
    (sum, cost) => sum + cost,
    0
  );

  const costPerUnit = totalManufacturingCost / goodQuantity;

  return {
    materialCost: categoryCosts.MATERIAL.toFixed(2),
    labourCost: categoryCosts.LABOUR.toFixed(2),
    packagingCost: categoryCosts.PACKAGING.toFixed(2),
    overheadCost: categoryCosts.OVERHEAD.toFixed(2),
    transportCost: categoryCosts.TRANSPORT.toFixed(2),
    otherCost: categoryCosts.OTHER.toFixed(2),
    totalManufacturingCost: totalManufacturingCost.toFixed(2),
    costPerUnit: costPerUnit.toFixed(4),
    materialCostPerUnit: (categoryCosts.MATERIAL / goodQuantity).toFixed(4),
    labourCostPerUnit: (categoryCosts.LABOUR / goodQuantity).toFixed(4),
    packagingCostPerUnit: (categoryCosts.PACKAGING / goodQuantity).toFixed(4),
    overheadCostPerUnit: (categoryCosts.OVERHEAD / goodQuantity).toFixed(4),
    transportCostPerUnit: (categoryCosts.TRANSPORT / goodQuantity).toFixed(4),
    otherCostPerUnit: (categoryCosts.OTHER / goodQuantity).toFixed(4),
  };
}

/**
 * Create a new production batch scoped to the company.
 * Generates a sequential batch number inside a transaction.
 * Validates product and product item references.
 */
export async function createBatch(companyId: string, data: CreateBatchInput) {
  // Validate productId
  await validateProductId(data.productId, companyId);

  // Validate productItemId if provided
  if (data.productItemId) {
    await validateProductItemId(data.productItemId, data.productId);
  }

  const batch = await db.transaction(async (tx) => {
    const batchNumber = await generateBatchNumber(companyId, tx as unknown as typeof db);

    const [created] = await tx
      .insert(productionBatches)
      .values({
        companyId,
        batchNumber,
        productId: data.productId,
        productItemId: data.productItemId ?? null,
        startDate: data.startDate,
        status: data.status ?? "DRAFT",
        plannedQuantity: data.plannedQuantity,
      })
      .returning();

    return created;
  });

  return batch;
}

/**
 * Return a paginated list of production batches for the company,
 * ordered by startDate descending.
 */
export async function getBatches(
  companyId: string,
  params: PaginationParams
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const where = eq(productionBatches.companyId, companyId);

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(productionBatches)
      .where(where)
      .orderBy(desc(productionBatches.startDate))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(productionBatches).where(where),
  ]);

  return { data, total };
}

/**
 * Fetch a single production batch by id scoped to company.
 * Throws 404 if not found or doesn't belong to the company.
 */
export async function getBatchById(companyId: string, id: string) {
  const [batch] = await db
    .select()
    .from(productionBatches)
    .where(
      and(
        eq(productionBatches.id, id),
        eq(productionBatches.companyId, companyId)
      )
    )
    .limit(1);

  if (!batch) {
    throw new ServiceError("Production batch not found", 404);
  }

  return batch;
}

/**
 * Update a production batch. Handles state machine transitions and
 * cost aggregation on completion atomically.
 *
 * - Rejects updates to COMPLETED/CANCELLED batches (409)
 * - Validates state transitions (422 for invalid)
 * - Validates goodQuantity > 0 for completion (422)
 * - Validates quantity cross-field constraint
 * - Aggregates costs on COMPLETED transition atomically
 */
export async function updateBatch(
  companyId: string,
  id: string,
  data: UpdateBatchInput
) {
  const existing = await getBatchById(companyId, id);

  // Reject updates to immutable batches
  if (existing.status === "COMPLETED") {
    throw new ServiceError("Completed batch is read-only", 409);
  }
  if (existing.status === "CANCELLED") {
    throw new ServiceError("Cancelled batch is read-only", 409);
  }

  // Validate status transition if status is being changed
  if (data.status && data.status !== existing.status) {
    validateStatusTransition(existing.status, data.status);

    // For COMPLETED transition, validate goodQuantity > 0
    if (data.status === "COMPLETED") {
      const effectiveGoodQuantity = data.goodQuantity ?? existing.goodQuantity;
      if (effectiveGoodQuantity <= 0) {
        throw new ServiceError(
          "Good quantity must be greater than zero for cost calculation",
          422
        );
      }
    }
  }

  // Validate quantity cross-field constraint
  validateQuantities(data, {
    producedQuantity: existing.producedQuantity,
    goodQuantity: existing.goodQuantity,
    rejectedQuantity: existing.rejectedQuantity,
  });

  // Build update set with only provided fields
  const updateSet: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.status !== undefined) updateSet.status = data.status;
  if (data.plannedQuantity !== undefined)
    updateSet.plannedQuantity = data.plannedQuantity;
  if (data.producedQuantity !== undefined)
    updateSet.producedQuantity = data.producedQuantity;
  if (data.goodQuantity !== undefined)
    updateSet.goodQuantity = data.goodQuantity;
  if (data.rejectedQuantity !== undefined)
    updateSet.rejectedQuantity = data.rejectedQuantity;
  if (data.completionDate !== undefined)
    updateSet.completionDate = data.completionDate;

  // If transitioning to COMPLETED, aggregate costs atomically
  if (data.status === "COMPLETED") {
    const effectiveGoodQuantity = data.goodQuantity ?? existing.goodQuantity;

    const updated = await db.transaction(async (tx) => {
      // Aggregate expenses by category
      const costs = await aggregateBatchCosts(
        id,
        effectiveGoodQuantity,
        tx as unknown as typeof db
      );

      // Merge cost data into update set
      Object.assign(updateSet, costs);

      // Set completion date if not explicitly provided
      if (!data.completionDate) {
        updateSet.completionDate = new Date();
      }

      const [result] = await tx
        .update(productionBatches)
        .set(updateSet)
        .where(
          and(
            eq(productionBatches.id, id),
            eq(productionBatches.companyId, companyId)
          )
        )
        .returning();

      return result;
    });

    return updated;
  }

  // Non-completion update (standard)
  const [updated] = await db
    .update(productionBatches)
    .set(updateSet)
    .where(
      and(
        eq(productionBatches.id, id),
        eq(productionBatches.companyId, companyId)
      )
    )
    .returning();

  return updated;
}

/**
 * Delete a production batch. Only DRAFT batches can be deleted.
 * Returns the deleted record.
 * Throws 409 if batch is not in DRAFT status.
 * Throws 404 if not found or doesn't belong to company.
 */
export async function deleteBatch(companyId: string, id: string) {
  const existing = await getBatchById(companyId, id);

  if (existing.status !== "DRAFT") {
    throw new ServiceError(
      "Cannot delete batch in its current status",
      409
    );
  }

  const [deleted] = await db
    .delete(productionBatches)
    .where(
      and(
        eq(productionBatches.id, id),
        eq(productionBatches.companyId, companyId)
      )
    )
    .returning();

  return deleted;
}

/**
 * Get paginated list of expenses for a specific production batch.
 * Validates the batch exists and belongs to the company.
 */
export async function getBatchExpenses(
  companyId: string,
  batchId: string,
  params: PaginationParams
) {
  // Verify batch exists and belongs to company
  await getBatchById(companyId, batchId);

  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const where = eq(expenses.productionBatchId, batchId);

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.expenseDate))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(expenses).where(where),
  ]);

  return { data, total };
}
