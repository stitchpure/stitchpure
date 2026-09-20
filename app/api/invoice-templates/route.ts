import { handleApiError } from "@/lib/api-route";
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { invoiceTemplateSchema } from "@/validators/invoice.validator";
import {
  getTemplateConfig,
  updateTemplateConfig,
} from "@/services/invoice-template.service";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const data = await getTemplateConfig(user.companyId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, "Unable to fetch invoice template config");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const body = await request.json();
    const validated = invoiceTemplateSchema.parse(body);
    const data = await updateTemplateConfig(user.companyId, validated);
    return NextResponse.json({
      success: true,
      message: "Invoice template updated successfully",
      data,
    });
  } catch (error) {
    return handleApiError(error, "Unable to update invoice template config");
  }
}
