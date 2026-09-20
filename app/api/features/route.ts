import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { authMiddleware } from "@/middleware/auth";
import { db } from "@/db";
import { companies } from "@/db/schema";

/**
 * GET /api/features
 *
 * Returns the feature flags for the current user's company.
 * Used by the frontend to gate premium features.
 */
export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);

    const [company] = await db
      .select({
        hasLabelSplitter: companies.hasLabelSplitter,
        subscriptionPlan: companies.subscriptionPlan,
      })
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        hasLabelSplitter: company.hasLabelSplitter,
        plan: company.subscriptionPlan,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to fetch features";
    const isAuth = message.toLowerCase().includes("token") || message.toLowerCase().includes("authorization");
    return NextResponse.json(
      { success: false, message },
      { status: isAuth ? 401 : 500 }
    );
  }
}
