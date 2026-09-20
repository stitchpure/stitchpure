import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { updateSaleSchema } from "@/validators/sale.validator";
import { getSaleById, updateSale, deleteSale } from "@/services/sale.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const data = await getSaleById(user.companyId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, "Unable to fetch sale");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = updateSaleSchema.parse(body);
    const updated = await updateSale(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Sale updated successfully",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update sale");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const deleted = await deleteSale(user.companyId, id);
    return NextResponse.json({
      success: true,
      message: "Sale deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return handleApiError(error, "Unable to delete sale");
  }
}
