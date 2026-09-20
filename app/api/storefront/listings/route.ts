import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { createStorefrontListingSchema } from "@/validators/storefront.validator";
import {
  getCompanyListings,
  createListing,
} from "@/services/storefront.service";
import { Roles } from "@/types/role";

// GET /api/storefront/listings — company products with listing status
export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const data = await getCompanyListings(user.companyId);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    const err = error as { message?: string; statusCode?: number };
    const isAuthError =
      err.message?.toLowerCase().includes("token") ||
      err.message?.toLowerCase().includes("authorization");
    return NextResponse.json(
      { success: false, message: err.message ?? "Request failed" },
      { status: isAuthError ? 401 : (err.statusCode ?? 500) }
    );
  }
}

// POST /api/storefront/listings — create listing (OWNER/MANAGER)
export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = createStorefrontListingSchema.parse(body);
    const listing = await createListing(user.companyId, data);

    revalidatePath("/storefront", "layout");

    return NextResponse.json(
      {
        success: true,
        message: "Storefront listing created successfully",
        data: listing,
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
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    const err = error as { message?: string; statusCode?: number };
    const isAuthError =
      err.message?.toLowerCase().includes("token") ||
      err.message?.toLowerCase().includes("authorization");
    return NextResponse.json(
      { success: false, message: err.message ?? "Request failed" },
      { status: isAuthError ? 401 : (err.statusCode ?? 500) }
    );
  }
}
