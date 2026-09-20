import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { getStockLedger } from "@/services/stock-ledger.service";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);

    const productItemId = request.nextUrl.searchParams.get("productItemId");
    if (!productItemId) {
      return NextResponse.json(
        { success: false, message: "productItemId query parameter is required" },
        { status: 400 }
      );
    }

    const params = parsePaginationParams(request.nextUrl.searchParams);
    const { data, total } = await getStockLedger(
      user.companyId,
      productItemId,
      params
    );
    const pagination = buildPaginationMeta(total, params);

    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch stock ledger");
  }
}
