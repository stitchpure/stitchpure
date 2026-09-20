import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { processReturnSchema } from "@/validators/return.validator";
import { processReturn } from "@/services/return.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ saleId: string }> };

// POST /api/returns/[saleId] — process a return for a completed sale
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const { saleId } = await params;
    const body = await request.json();
    const data = processReturnSchema.parse(body);

    const updatedSale = await processReturn(user.companyId, saleId, data);

    return NextResponse.json({
      success: true,
      message: "Return processed successfully",
      data: updatedSale,
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
