import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createExpenseSchema } from "@/validators/expense.validator";
import { getExpenses, createExpense } from "@/services/expense.service";
import { Roles } from "@/types/role";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const params = parsePaginationParams(request.nextUrl.searchParams);
    const productionBatchId = request.nextUrl.searchParams.get("productionBatchId")?.trim() || undefined;
    const category = request.nextUrl.searchParams.get("category")?.trim() || undefined;
    const { data, total } = await getExpenses(user.companyId, params, { productionBatchId, category });
    const pagination = buildPaginationMeta(total, params);
    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch expenses");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const body = await request.json();
    const data = createExpenseSchema.parse(body);
    const expense = await createExpense(user.companyId, user.userId, data);
    return NextResponse.json(
      { success: true, message: "Expense created successfully", data: expense },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Unable to create expense");
  }
}
