import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { Roles } from "@/types/role";
import { createProductOptionValueSchema } from "@/validators/product-option.validator";
import {
  getProductOptionValues,
  createProductOptionValue,
} from "@/services/product-option.service";

// GET /api/products/[id]/options/[optionId]/values
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    const user = authMiddleware(request);
    const { id: productId, optionId } = await params;

    const values = await getProductOptionValues(
      user.companyId,
      productId,
      optionId
    );

    return NextResponse.json({ success: true, data: values }, { status: 200 });
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

// POST /api/products/[id]/options/[optionId]/values
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = createProductOptionValueSchema.parse(body);

    const { id: productId, optionId } = await params;
    const value = await createProductOptionValue(
      user.companyId,
      productId,
      optionId,
      data
    );

    return NextResponse.json({ success: true, data: value }, { status: 201 });
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
