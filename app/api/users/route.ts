import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { createUserSchema } from "@/validators/user.validator";
import { getUsers, createUser } from "@/services/user.service";
import { Roles } from "@/types/role";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER);

    const params = parsePaginationParams(request.nextUrl.searchParams);
    const { data, total } = await getUsers(user.companyId, params);
    const pagination = buildPaginationMeta(total, params);

    return NextResponse.json({ success: true, data, pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch users");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER);

    const body = await request.json();
    const data = createUserSchema.parse(body);
    const created = await createUser(user.companyId, data);

    return NextResponse.json(
      { success: true, message: "User created successfully", data: created },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Unable to create user");
  }
}
