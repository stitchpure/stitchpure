import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { updateListingSchema } from "@/validators/listing.validator";
import {
  getListingById,
  updateListing,
  deactivateListing,
} from "@/services/listing.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/listings/[id] — fetch a single listing
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;

    const listing = await getListingById(user.companyId, id);

    return NextResponse.json({ success: true, data: listing });
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

// PUT /api/listings/[id] — update a listing (OWNER or MANAGER only)
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const { id } = await params;
    const body = await request.json();
    const data = updateListingSchema.parse(body);

    const listing = await updateListing(user.companyId, id, data);

    return NextResponse.json({
      success: true,
      message: "Listing updated successfully",
      data: listing,
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

// DELETE /api/listings/[id] — soft-delete (OWNER or MANAGER only)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const { id } = await params;
    const listing = await deactivateListing(user.companyId, id);

    return NextResponse.json({
      success: true,
      message: "Listing deleted successfully",
      data: listing,
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
