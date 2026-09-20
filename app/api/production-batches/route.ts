import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createBatchSchema } from "@/validators/production-batch.validator";
import { createBatch, getBatches } from "@/services/production-batch.service";
import { Roles } from "@/types/role";

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

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const params = parsePaginationParams(request.nextUrl.searchParams);
    const { data, total } = await getBatches(user.companyId, params);
    const pagination = buildPaginationMeta(total, params);
    const sanitizedData = data.map(sanitizeBatchCosts);
    return NextResponse.json({ success: true, data: sanitizedData, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch production batches");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const body = await request.json();
    const data = createBatchSchema.parse(body);
    const batch = await createBatch(user.companyId, data);
    return NextResponse.json(
      { success: true, message: "Production batch created successfully", data: batch },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Unable to create production batch");
  }
}
