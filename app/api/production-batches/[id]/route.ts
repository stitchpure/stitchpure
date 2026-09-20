import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { updateBatchSchema } from "@/validators/production-batch.validator";
import {
  getBatchById,
  updateBatch,
  deleteBatch,
} from "@/services/production-batch.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Fields that should be null for non-COMPLETED batches (Requirements 16.4, 16.5).
 */
const COST_PER_UNIT_FIELDS = [
  "costPerUnit",
  "materialCostPerUnit",
  "labourCostPerUnit",
  "packagingCostPerUnit",
  "overheadCostPerUnit",
  "transportCostPerUnit",
  "otherCostPerUnit",
] as const;

/**
 * Transform batch data: set costPerUnit fields to null for non-COMPLETED batches.
 */
function sanitizeBatchCosts<T extends Record<string, unknown>>(batch: T): T {
  if ((batch as any).status !== "COMPLETED") {
    const sanitized = { ...batch };
    for (const field of COST_PER_UNIT_FIELDS) {
      (sanitized as any)[field] = null;
    }
    return sanitized;
  }
  return batch;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const batch = await getBatchById(user.companyId, id);
    return NextResponse.json({ success: true, data: sanitizeBatchCosts(batch) });
  } catch (error) {
    return handleApiError(error, "Unable to fetch production batch");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = updateBatchSchema.parse(body);
    const updated = await updateBatch(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Production batch updated successfully",
      data: sanitizeBatchCosts(updated),
    });
  } catch (error) {
    return handleApiError(error, "Unable to update production batch");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const deleted = await deleteBatch(user.companyId, id);
    return NextResponse.json({
      success: true,
      message: "Production batch deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return handleApiError(error, "Unable to delete production batch");
  }
}
