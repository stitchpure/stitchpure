import { NextResponse } from "next/server";

import { NextRequest } from "next/server";

import { authMiddleware } from "@/middleware/auth";

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);

    return NextResponse.json({
      success: true,

      user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,

        message: error.message,
      },
      {
        status: 401,
      }
    );
  }
}
