import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { loginSchema } from "@/validators/auth.validator";
import { loginUser } from "@/services/auth.service";
import { formatZodError } from "@/lib/error-handler";
import { checkRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    // Rate limit by email (prevents brute force on specific accounts)
    const rateLimitKey = `login:${data.email.toLowerCase()}`;
    const rateResult = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT);

    if (!rateResult.allowed) {
      const retryAfterSeconds = Math.ceil((rateResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          message: `Too many login attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
      );
    }

    const result = await loginUser(data.email, data.password);

    return NextResponse.json({
      success: true,
      message: "Login successful",
      data: result,
    });
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

    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json(
      { success: false, message },
      { status: 401 }
    );
  }
}
