/**
 * Expense service
 *
 * Handles expense creation, retrieval, update, and deletion
 * scoped to a company.
 *
 * Requirements: 14.1, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 14.15
 */

import { and, count, desc, eq, SQL } from "drizzle-orm";

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
  CreateExpenseInput,
  UpdateExpenseInput,
} from "@/validators/expense.validator";

/**
 * Validate that a production batch exists and belongs to the given company.
 * Throws ServiceError 404 if not found.
 */
async function validateProductionBatchId(
  productionBatchId: string,
  companyId: string
) {
  const [batch] = await db
    .select({ id: productionBatches.id })
    .from(productionBatches)
    .where(
      and(
        eq(productionBatches.id, productionBatchId),
        eq(productionBatches.companyId, companyId)
      )
    )
    .limit(1);

  if (!batch) {
    throw new ServiceError("Production batch not found", 404);
  }
}

/**
 * Validate that a product item exists and belongs to the given company
 * (via its parent product). Throws ServiceError 404 if not found.
 */
async function validateProductItemId(
  productItemId: string,
  companyId: string
) {
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
}

/**
 * Check for duplicate expense: same name + category on the same batch.
 * Throws ServiceError 409 if duplicate found.
 * Optionally excludes a specific expense id (for updates).
 */
async function checkDuplicateExpense(
  productionBatchId: string,
  name: string,
  category: string,
  excludeId?: string
) {
  const conditions = [
    eq(expenses.productionBatchId, productionBatchId),
    eq(expenses.name, name),
    eq(expenses.category, category as typeof expenses.category.enumValues[number]),
  ];

  const [existing] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(...conditions))
    .limit(1);

  if (existing && existing.id !== excludeId) {
    throw new ServiceError(
      "An expense with the same name and category already exists on this batch",
      409
    );
  }
}

/**
 * Create a new expense scoped to the company.
 * Validates references and checks for duplicates.
 */
export async function createExpense(
  companyId: string,
  userId: string,
  data: CreateExpenseInput
) {
  // Validate productionBatchId if provided
  if (data.productionBatchId) {
    await validateProductionBatchId(data.productionBatchId, companyId);
  }

  // Validate productItemId if provided
  if (data.productItemId) {
    await validateProductItemId(data.productItemId, companyId);
  }

  // Check for duplicate expense on same batch (same name + category)
  if (data.productionBatchId) {
    await checkDuplicateExpense(
      data.productionBatchId,
      data.name,
      data.category
    );
  }

  const [expense] = await db
    .insert(expenses)
    .values({
      companyId,
      createdBy: userId,
      name: data.name,
      amount: data.amount.toFixed(2),
      category: data.category,
      expenseDate: data.expenseDate,
      productionBatchId: data.productionBatchId ?? null,
      productItemId: data.productItemId ?? null,
      includeInManufacturingCost: data.includeInManufacturingCost ?? true,
      notes: data.notes ?? null,
    })
    .returning();

  return expense;
}

/**
 * Return a paginated list of expenses for the company,
 * ordered by expenseDate descending.
 */
export async function getExpenses(
  companyId: string,
  params: PaginationParams,
  filters?: { productionBatchId?: string; category?: string }
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [eq(expenses.companyId, companyId)];

  if (filters?.productionBatchId) {
    conditions.push(eq(expenses.productionBatchId, filters.productionBatchId));
  }

  if (filters?.category) {
    conditions.push(eq(expenses.category, filters.category as typeof expenses.category.enumValues[number]));
  }

  const where = and(...conditions);

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

/**
 * Fetch a single expense by id scoped to company.
 * Throws 404 if not found or doesn't belong to the company.
 */
export async function getExpenseById(companyId: string, id: string) {
  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.companyId, companyId)))
    .limit(1);

  if (!expense) {
    throw new ServiceError("Expense not found", 404);
  }

  return expense;
}

/**
 * Update an expense. Only updates provided fields.
 * Re-validates references if changed. Checks duplicates if name/category/batch changes.
 */
export async function updateExpense(
  companyId: string,
  id: string,
  data: UpdateExpenseInput
) {
  const existing = await getExpenseById(companyId, id);

  // Validate productionBatchId if being changed
  if (data.productionBatchId !== undefined && data.productionBatchId !== null) {
    await validateProductionBatchId(data.productionBatchId, companyId);
  }

  // Validate productItemId if being changed
  if (data.productItemId !== undefined && data.productItemId !== null) {
    await validateProductItemId(data.productItemId, companyId);
  }

  // Determine effective values for duplicate check
  const effectiveName = data.name ?? existing.name;
  const effectiveCategory = data.category ?? existing.category;
  const effectiveBatchId =
    data.productionBatchId !== undefined
      ? data.productionBatchId
      : existing.productionBatchId;

  // Check for duplicate expense on same batch if batch is set
  if (effectiveBatchId) {
    await checkDuplicateExpense(
      effectiveBatchId,
      effectiveName,
      effectiveCategory,
      id
    );
  }

  // Build update set with only provided fields
  const updateSet: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateSet.name = data.name;
  if (data.amount !== undefined) updateSet.amount = data.amount.toFixed(2);
  if (data.category !== undefined) updateSet.category = data.category;
  if (data.expenseDate !== undefined) updateSet.expenseDate = data.expenseDate;
  if (data.productionBatchId !== undefined)
    updateSet.productionBatchId = data.productionBatchId;
  if (data.productItemId !== undefined)
    updateSet.productItemId = data.productItemId;
  if (data.includeInManufacturingCost !== undefined)
    updateSet.includeInManufacturingCost = data.includeInManufacturingCost;
  if (data.notes !== undefined) updateSet.notes = data.notes;

  const [updated] = await db
    .update(expenses)
    .set(updateSet)
    .where(and(eq(expenses.id, id), eq(expenses.companyId, companyId)))
    .returning();

  return updated;
}

/**
 * Permanently delete an expense. Returns the deleted record.
 * Throws 404 if not found or doesn't belong to the company.
 */
export async function deleteExpense(companyId: string, id: string) {
  // Verify it exists and belongs to company
  await getExpenseById(companyId, id);

  const [deleted] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.companyId, companyId)))
    .returning();

  return deleted;
}
