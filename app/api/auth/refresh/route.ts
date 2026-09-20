import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/services/auth.service";

/**
 * POST /api/auth/refresh
 *
 * Accepts a refresh token and returns a new access token.
 * The refresh token itself is not rotated (single-use rotation adds complexity).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json(
        { success: false, message: "Refresh token is required" },
        { status: 400 }
      );
    }

    const result = await refreshAccessToken(refreshToken);

    return NextResponse.json({
      success: true,
      message: "Token refreshed",
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Token refresh failed";
    return NextResponse.json(
      { success: false, message },
      { status: 401 }
    );
  }
}
