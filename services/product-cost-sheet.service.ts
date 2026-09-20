/**
 * Product Cost Sheet service
 *
 * Handles cost sheet creation, retrieval, and update scoped to a company.
 * Cost sheets derive their cost values from completed production batches.
 * Company scoping is done via the referenced product's companyId.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12, 17.15
 */

import { and, count, desc, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";

import { productCostSheets, productionBatches, products } from "@/db/schema";

import { ServiceError } from "@/lib/service-error";

import type { PaginationParams } from "@/lib/pagination";

import type {
  CreateCostSheetInput,
  UpdateCostSheetInput,
} from "@/validators/product-cost-sheet.validator";

/**
 * Create a new product cost sheet from a completed production batch.
 *
 * - Fetches the production batch and verifies COMPLETED status (422 if not)
 * - Verifies company ownership via the batch's product (404 if wrong company)
 * - Derives all cost values from the batch's per-unit cost fields
 * - Creates the cost sheet with status DRAFT
 */
export async function createCostSheet(
  companyId: string,
  data: CreateCostSheetInput
) {
  // Fetch the production batch
  const [batch] = await db
    .select()
    .from(productionBatches)
    .where(eq(productionBatches.id, data.productionBatchId))
    .limit(1);

  if (!batch) {
    throw new ServiceError("Production batch not found", 404);
  }

  // Verify the batch is COMPLETED
  if (batch.status !== "COMPLETED") {
    throw new ServiceError(
      "Cost sheet can only be created from a completed production batch",
      422
    );
  }

  // Verify company ownership via the batch's product
  const [product] = await db
    .select({ id: products.id, companyId: products.companyId })
    .from(products)
    .where(
      and(eq(products.id, batch.productId), eq(products.companyId, companyId))
    )
    .limit(1);

  if (!product) {
    throw new ServiceError("Production batch not found", 404);
  }

  // Derive cost values from the batch per-unit fields
  const [costSheet] = await db
    .insert(productCostSheets)
    .values({
      productId: batch.productId,
      productItemId: batch.productItemId ?? null,
      productionBatchId: batch.id,
      effectiveDate: data.effectiveDate,
      materialCostPerUnit: batch.materialCostPerUnit ?? "0",
      labourCostPerUnit: batch.labourCostPerUnit ?? "0",
      packagingCostPerUnit: batch.packagingCostPerUnit ?? "0",
      overheadCostPerUnit: batch.overheadCostPerUnit ?? "0",
      transportCostPerUnit: batch.transportCostPerUnit ?? "0",
      otherCostPerUnit: batch.otherCostPerUnit ?? "0",
      totalManufacturingCostPerUnit: batch.costPerUnit ?? "0",
      status: "DRAFT",
    })
    .returning();

  return costSheet;
}

/**
 * Return a paginated list of cost sheets for the company,
 * ordered by effectiveDate descending.
 * Company scoping via join with products table.
 */
export async function getCostSheets(
  companyId: string,
  params: PaginationParams
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: productCostSheets.id,
        productId: productCostSheets.productId,
        productItemId: productCostSheets.productItemId,
        productionBatchId: productCostSheets.productionBatchId,
        effectiveDate: productCostSheets.effectiveDate,
        materialCostPerUnit: productCostSheets.materialCostPerUnit,
        labourCostPerUnit: productCostSheets.labourCostPerUnit,
        packagingCostPerUnit: productCostSheets.packagingCostPerUnit,
        overheadCostPerUnit: productCostSheets.overheadCostPerUnit,
        transportCostPerUnit: productCostSheets.transportCostPerUnit,
        otherCostPerUnit: productCostSheets.otherCostPerUnit,
        totalManufacturingCostPerUnit:
          productCostSheets.totalManufacturingCostPerUnit,
        status: productCostSheets.status,
        createdAt: productCostSheets.createdAt,
        updatedAt: productCostSheets.updatedAt,
      })
      .from(productCostSheets)
      .innerJoin(products, eq(products.id, productCostSheets.productId))
      .where(eq(products.companyId, companyId))
      .orderBy(desc(productCostSheets.effectiveDate))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(productCostSheets)
      .innerJoin(products, eq(products.id, productCostSheets.productId))
      .where(eq(products.companyId, companyId)),
  ]);

  return { data, total };
}

/**
 * Fetch a single cost sheet by id scoped to company.
 * Company scoping via join with products table.
 * Throws 404 if not found or doesn't belong to the company.
 */
export async function getCostSheetById(companyId: string, id: string) {
  const [costSheet] = await db
    .select({
      id: productCostSheets.id,
      productId: productCostSheets.productId,
      productItemId: productCostSheets.productItemId,
      productionBatchId: productCostSheets.productionBatchId,
      effectiveDate: productCostSheets.effectiveDate,
      materialCostPerUnit: productCostSheets.materialCostPerUnit,
      labourCostPerUnit: productCostSheets.labourCostPerUnit,
      packagingCostPerUnit: productCostSheets.packagingCostPerUnit,
      overheadCostPerUnit: productCostSheets.overheadCostPerUnit,
      transportCostPerUnit: productCostSheets.transportCostPerUnit,
      otherCostPerUnit: productCostSheets.otherCostPerUnit,
      totalManufacturingCostPerUnit:
        productCostSheets.totalManufacturingCostPerUnit,
      status: productCostSheets.status,
      createdAt: productCostSheets.createdAt,
      updatedAt: productCostSheets.updatedAt,
    })
    .from(productCostSheets)
    .innerJoin(products, eq(products.id, productCostSheets.productId))
    .where(
      and(eq(productCostSheets.id, id), eq(products.companyId, companyId))
    )
    .limit(1);

  if (!costSheet) {
    throw new ServiceError("Cost sheet not found", 404);
  }

  return costSheet;
}

/**
 * Update a cost sheet. Only status and effectiveDate can be updated.
 * Cost value fields are rejected at the validator level (400).
 *
 * When status is set to ACTIVE, implements one-active archival:
 * - Finds any existing ACTIVE cost sheet with same productId + productItemId
 * - Archives it in a transaction along with activating the current sheet
 */
export async function updateCostSheet(
  companyId: string,
  id: string,
  data: UpdateCostSheetInput
) {
  // Verify the cost sheet exists and belongs to the company
  const existing = await getCostSheetById(companyId, id);

  // Build update set with only provided fields
  const updateSet: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.status !== undefined) updateSet.status = data.status;
  if (data.effectiveDate !== undefined) updateSet.effectiveDate = data.effectiveDate;

  // If transitioning to ACTIVE, handle one-active archival in a transaction
  if (data.status === "ACTIVE") {
    const updated = await db.transaction(async (tx) => {
      // Archive any existing ACTIVE cost sheet for same productId + productItemId
      const archiveConditions = [
        eq(productCostSheets.productId, existing.productId),
        eq(productCostSheets.status, "ACTIVE"),
        ne(productCostSheets.id, id),
      ];

      // Handle productItemId - match null with null, or specific value
      if (existing.productItemId) {
        archiveConditions.push(
          eq(productCostSheets.productItemId, existing.productItemId)
        );
      } else {
        archiveConditions.push(isNull(productCostSheets.productItemId));
      }

      await tx
        .update(productCostSheets)
        .set({ status: "ARCHIVED", updatedAt: new Date() })
        .where(and(...archiveConditions));

      // Update the current cost sheet
      const [result] = await tx
        .update(productCostSheets)
        .set(updateSet)
        .where(eq(productCostSheets.id, id))
        .returning();

      return result;
    });

    return updated;
  }

  // Standard update (non-ACTIVE transition)
  const [updated] = await db
    .update(productCostSheets)
    .set(updateSet)
    .where(eq(productCostSheets.id, id))
    .returning();

  return updated;
}
