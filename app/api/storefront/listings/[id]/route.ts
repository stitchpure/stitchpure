import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { ServiceError } from "@/lib/service-error";
import { formatZodError } from "@/lib/format-zod-error";
import { updateStorefrontListingSchema } from "@/validators/storefront.validator";
import { updateListing } from "@/services/storefront.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/storefront/listings/[id] — update listing (OWNER/MANAGER)
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const { id } = await params;
    const body = await request.json();
    const data = updateStorefrontListingSchema.parse(body);
    const listing = await updateListing(user.companyId, id, data);

    // Public storefront pages can be held in the route/client cache. Ensure
    // visibility and price changes are reflected on the next navigation.
    revalidatePath("/storefront", "layout");

    return NextResponse.json({
      success: true,
      message: "Storefront listing updated successfully",
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
