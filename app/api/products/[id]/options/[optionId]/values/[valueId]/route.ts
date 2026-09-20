import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { Roles } from "@/types/role";
import { updateProductOptionValueSchema } from "@/validators/product-option.validator";
import {
  updateProductOptionValue,
  softDeleteProductOptionValue,
} from "@/services/product-option.service";

// PATCH /api/products/[id]/options/[optionId]/values/[valueId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string; valueId: string }> }
) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = updateProductOptionValueSchema.parse(body);

    const { id: productId, optionId, valueId } = await params;
    const value = await updateProductOptionValue(
      user.companyId,
      productId,
      optionId,
      valueId,
      data
    );

    return NextResponse.json({ success: true, data: value }, { status: 200 });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: formatZodError(error) },
        { status: 400 }
      );
    }
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    if (
      typeof error.message === "string" &&
      (error.message.toLowerCase().includes("token") ||
        error.message.toLowerCase().includes("authorization"))
    ) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]/options/[optionId]/values/[valueId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string; valueId: string }> }
) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const { id: productId, optionId, valueId } = await params;
    const value = await softDeleteProductOptionValue(
      user.companyId,
      productId,
      optionId,
      valueId
    );

    return NextResponse.json({ success: true, data: value }, { status: 200 });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: formatZodError(error) },
        { status: 400 }
      );
    }
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    if (
      typeof error.message === "string" &&
      (error.message.toLowerCase().includes("token") ||
        error.message.toLowerCase().includes("authorization"))
    ) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
