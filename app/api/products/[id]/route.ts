import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { updateProductSchema } from "@/validators/product.validator";
import {
  getProductById,
  updateProduct,
  softDeleteProduct,
} from "@/services/product.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/products/[id] — fetch a single product
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;

    const product = await getProductById(user.companyId, id);

    return NextResponse.json({ success: true, data: product });
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: (error as ServiceError).message },
        { status: (error as ServiceError).statusCode }
      );
    }
    const err = error as any;
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

// PATCH /api/products/[id] — partial update (OWNER or MANAGER only)
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const { id } = await params;
    const body = await request.json();
    const data = updateProductSchema.parse(body);

    const product = await updateProduct(user.companyId, id, data);

    return NextResponse.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: formatZodError(error),
        },
        { status: 400 }
      );
    }
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: (error as ServiceError).message },
        { status: (error as ServiceError).statusCode }
      );
    }
    const err = error as any;
    const isAuthError =
      err.message?.toLowerCase().includes("token") ||
      err.message?.toLowerCase().includes("authorization");
    return NextResponse.json(
      { success: false, message: err.message },
      { status: isAuthError ? 401 : (err.statusCode ?? 500) }
    );
  }
}

// DELETE /api/products/[id] — soft-delete (OWNER or MANAGER only)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const { id } = await params;
    const product = await softDeleteProduct(user.companyId, id);

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: (error as ServiceError).message },
        { status: (error as ServiceError).statusCode }
      );
    }
    const err = error as any;
    const isAuthError =
      err.message?.toLowerCase().includes("token") ||
      err.message?.toLowerCase().includes("authorization");
    return NextResponse.json(
      { success: false, message: err.message },
      { status: isAuthError ? 401 : (err.statusCode ?? 500) }
    );
  }
}
