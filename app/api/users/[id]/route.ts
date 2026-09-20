import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { updateUserSchema } from "@/validators/user.validator";
import { getUserById, updateUser, softDeleteUser } from "@/services/user.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER);
    const { id } = await params;
    const data = await getUserById(user.companyId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, "Unable to fetch user");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = updateUserSchema.parse(body);
    const updated = await updateUser(user.companyId, user.userId, id, data);
    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update user");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER);
    const { id } = await params;
    const deleted = await softDeleteUser(user.companyId, user.userId, id);
    return NextResponse.json({
      success: true,
      message: "User deactivated successfully",
      data: deleted,
    });
  } catch (error) {
    return handleApiError(error, "Unable to delete user");
  }
}
