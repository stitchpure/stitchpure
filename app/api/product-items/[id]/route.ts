import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { updateProductItemSchema } from "@/validators/product-item.validator";
import { Roles } from "@/types/role";

import {
  getProductItemById,
  updateProductItem,
  deleteProductItem,
  ProductItemServiceError,
} from "@/services/product-item.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = authMiddleware(request);
    const { id } = await context.params;

    const productItem = await getProductItemById({
      companyId: authUser.companyId,
      itemId: id,
    });

    return NextResponse.json(
      { success: true, message: "Product item fetched successfully", data: productItem },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, "Unable to fetch product item");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);
    const { id } = await context.params;
    const body = await request.json();
    const data = updateProductItemSchema.parse(body);
    const updated = await updateProductItem(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Product item updated successfully",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update product item");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);
    const { id } = await context.params;
    const deleted = await deleteProductItem(user.companyId, id);
    return NextResponse.json({
      success: true,
      message: "Product item discontinued successfully",
      data: deleted,
    });
  } catch (error) {
    return handleApiError(error, "Unable to delete product item");
  }
}
