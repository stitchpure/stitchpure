import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createSaleSchema } from "@/validators/sale.validator";
import { getSales, createSale } from "@/services/sale.service";
import { Roles } from "@/types/role";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Optional filters
    const returnStatus = request.nextUrl.searchParams.get("returnStatus") ?? undefined;
    const filters = { returnStatus };

    const { data, total } = await getSales(user.companyId, params, filters);
    const pagination = buildPaginationMeta(total, params);
    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch sales");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const body = await request.json();
    const data = createSaleSchema.parse(body);
    const sale = await createSale(user.companyId, data);
    return NextResponse.json(
      { success: true, message: "Sale created successfully", data: sale },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Unable to create sale");
  }
}
