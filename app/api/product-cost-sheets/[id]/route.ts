import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { updateCostSheetSchema } from "@/validators/product-cost-sheet.validator";
import {
  getCostSheetById,
  updateCostSheet,
} from "@/services/product-cost-sheet.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const costSheet = await getCostSheetById(user.companyId, id);
    return NextResponse.json({ success: true, data: costSheet });
  } catch (error) {
    return handleApiError(error, "Unable to fetch product cost sheet");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = updateCostSheetSchema.parse(body);
    const updated = await updateCostSheet(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Product cost sheet updated successfully",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update product cost sheet");
  }
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, message: "Method not allowed. Cost sheets cannot be deleted." },
    { status: 405 }
  );
}
