import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createCostSheetSchema } from "@/validators/product-cost-sheet.validator";
import { createCostSheet, getCostSheets } from "@/services/product-cost-sheet.service";
import { Roles } from "@/types/role";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const params = parsePaginationParams(request.nextUrl.searchParams);
    const { data, total } = await getCostSheets(user.companyId, params);
    const pagination = buildPaginationMeta(total, params);
    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch product cost sheets");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const body = await request.json();
    const data = createCostSheetSchema.parse(body);
    const costSheet = await createCostSheet(user.companyId, data);
    return NextResponse.json(
      { success: true, message: "Product cost sheet created successfully", data: costSheet },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Unable to create product cost sheet");
  }
}
