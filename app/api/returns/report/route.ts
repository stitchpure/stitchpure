import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { ServiceError } from "@/lib/service-error";
import { getReturnReport } from "@/services/return.service";

// GET /api/returns/report — listing-wise return rate data
export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);

    const report = await getReturnReport(user.companyId);

    return NextResponse.json({
      success: true,
      data: report,
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
