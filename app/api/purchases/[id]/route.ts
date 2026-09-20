import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import {
  updatePurchaseSchema,
  editPurchaseSchema,
} from "@/validators/purchase.validator";
import {
  getPurchaseById,
  updatePurchase,
  editPurchase,
  deletePurchase,
} from "@/services/purchase.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const data = await getPurchaseById(user.companyId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, "Unable to fetch purchase");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = updatePurchaseSchema.parse(body);
    const updated = await updatePurchase(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Purchase updated successfully",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update purchase");
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = editPurchaseSchema.parse(body);
    const updated = await editPurchase(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Purchase edited successfully",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error, "Unable to edit purchase");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const deleted = await deletePurchase(user.companyId, id);
    return NextResponse.json({
      success: true,
      message: "Purchase deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return handleApiError(error, "Unable to delete purchase");
  }
}
