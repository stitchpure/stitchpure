import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createListingSchema } from "@/validators/listing.validator";
import { createListing, getListings } from "@/services/listing.service";
import { Roles } from "@/types/role";

// GET /api/listings — paginated list of listings for the authenticated company
export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);

    const searchParams = request.nextUrl.searchParams;
    const paginationParams = parsePaginationParams(searchParams);

    // Parse optional filter params
    const channel = searchParams.get("channel") ?? undefined;
    const productItemId = searchParams.get("productItemId") ?? undefined;
    const isActiveParam = searchParams.get("isActive");
    const isActive =
      isActiveParam === "true"
        ? true
        : isActiveParam === "false"
          ? false
          : undefined;

    const filters = { channel, productItemId, isActive };

    const { data, total } = await getListings(
      user.companyId,
      paginationParams,
      filters
    );

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

// POST /api/listings — create a new listing (OWNER or MANAGER only)
export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = createListingSchema.parse(body);

    const listing = await createListing(user.companyId, data);

    return NextResponse.json(
      {
        success: true,
        message: "Listing created successfully",
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
