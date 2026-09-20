import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createPurchaseSchema } from "@/validators/purchase.validator";
import { getPurchases, createPurchase } from "@/services/purchase.service";
import { Roles } from "@/types/role";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const params = parsePaginationParams(request.nextUrl.searchParams);
    const { data, total } = await getPurchases(user.companyId, params);
    const pagination = buildPaginationMeta(total, params);
    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch purchases");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const body = await request.json();
    const data = createPurchaseSchema.parse(body);
    const purchase = await createPurchase(user.companyId, data);
    return NextResponse.json(
      { success: true, message: "Purchase created successfully", data: purchase },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Unable to create purchase");
  }
}
