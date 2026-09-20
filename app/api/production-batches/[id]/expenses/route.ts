import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { getBatchExpenses } from "@/services/production-batch.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const paginationParams = parsePaginationParams(request.nextUrl.searchParams);
    const { data, total } = await getBatchExpenses(user.companyId, id, paginationParams);
    const pagination = buildPaginationMeta(total, paginationParams);
    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch batch expenses");
  }
}
