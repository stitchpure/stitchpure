import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { updateExpenseSchema } from "@/validators/expense.validator";
import {
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "@/services/expense.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const data = await getExpenseById(user.companyId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, "Unable to fetch expense");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = updateExpenseSchema.parse(body);
    const updated = await updateExpense(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Expense updated successfully",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update expense");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.MANAGER, Roles.OWNER);
    const { id } = await params;
    const deleted = await deleteExpense(user.companyId, id);
    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return handleApiError(error, "Unable to delete expense");
  }
}
