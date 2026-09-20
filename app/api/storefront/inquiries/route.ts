import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { authMiddleware } from "@/middleware/auth";
import { formatZodError } from "@/lib/format-zod-error";
import { ServiceError } from "@/lib/service-error";
import { createStorefrontInquirySchema } from "@/validators/storefront.validator";
import {
  createStorefrontInquiry,
  getCompanyInquiries,
} from "@/services/storefront.service";

// GET /api/storefront/inquiries — company inquiries (authenticated)
export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    const data = await getCompanyInquiries(user.companyId);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    const err = error as { message?: string; statusCode?: number };
    const isAuthError =
      err.message?.toLowerCase().includes("token") ||
      err.message?.toLowerCase().includes("authorization");
    return NextResponse.json(
      { success: false, message: err.message ?? "Request failed" },
      { status: isAuthError ? 401 : (err.statusCode ?? 500) }
    );
  }
}

// POST /api/storefront/inquiries — public inquiry submission (no auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createStorefrontInquirySchema.parse(body);
    const inquiry = await createStorefrontInquiry(data);

    return NextResponse.json(
      {
        success: true,
        message: "Inquiry sent successfully",
        data: { id: inquiry.id },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: formatZodError(error),
        },
        { status: 400 }
      );
    }
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/storefront/inquiries error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to send inquiry" },
      { status: 500 }
    );
  }
}
