import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { ServiceError } from "@/lib/service-error";
import { getListingPerformance } from "@/services/listing.service";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/listings/[id]/performance — fetch listing performance metrics
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;

    const result = await getListingPerformance(user.companyId, id);

    return NextResponse.json({ success: true, data: result });
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
