import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { updateCompanySchema } from "@/validators/company.validator";
import { getCompanyById, updateCompany } from "@/services/company.service";
import { Roles } from "@/types/role";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    const { id } = await params;
    const company = await getCompanyById(user.companyId, id);
    return NextResponse.json({ success: true, data: company });
  } catch (error) {
    return handleApiError(error, "Unable to fetch company");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER);
    const { id } = await params;
    const body = await request.json();
    const data = updateCompanySchema.parse(body);
    const company = await updateCompany(user.companyId, id, data);
    return NextResponse.json({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update company");
  }
}
