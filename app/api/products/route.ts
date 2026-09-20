import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createProductSchema } from "@/validators/product.validator";
import { createProduct, getProducts } from "@/services/product.service";
import { Roles } from "@/types/role";

// GET /api/products — paginated list of products for the authenticated company
export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);

    const paginationParams = parsePaginationParams(request.nextUrl.searchParams);

    const { data, total } = await getProducts(user.companyId, paginationParams);

    const pagination = buildPaginationMeta(total, paginationParams);

    return NextResponse.json({
      success: true,
      data,
      pagination,
    });
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

// POST /api/products — create a new product (OWNER or MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = createProductSchema.parse(body);

    const product = await createProduct(user.companyId, data);

    return NextResponse.json(
      {
        success: true,
        message: "Product created successfully",
        data: product,
      },
      { status: 201 }
    );
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
