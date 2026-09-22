import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { bootstrapFirstUser } from "@/services/auth.service";
import { formatZodError } from "@/lib/error-handler";
import { checkRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit";

/**
 * One-time bootstrap registration.
 *
 * Public self-registration is disabled for this single-company site. This
 * endpoint exists only to create the FIRST admin user of a fresh deployment
 * (e.g. a new Neon DB) from the browser instead of running the seed script.
 *
 * `bootstrapFirstUser` refuses to run once any user exists, so this becomes a
 * no-op (403) after the initial setup — it is NOT an open signup route.
 */
const bootstrapSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name cannot exceed 120 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password cannot exceed 72 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  companyName: z.string().max(150).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = bootstrapSchema.parse(body);

    // Rate limit by email to prevent abuse of the bootstrap endpoint
    const rateResult = checkRateLimit(
      `register:${data.email.toLowerCase()}`,
      LOGIN_RATE_LIMIT
    );
    if (!rateResult.allowed) {
      const retryAfterSeconds = Math.ceil((rateResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          message: `Too many attempts. Please try again in ${Math.ceil(
            retryAfterSeconds / 60
          )} minutes.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const result = await bootstrapFirstUser(data);

    return NextResponse.json({
      success: true,
      message: "Account created",
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

    const message =
      error instanceof Error ? error.message : "Registration failed";

    // "Setup already completed" → 403, everything else → 400
    const status = message.toLowerCase().includes("already completed") ? 403 : 400;

    return NextResponse.json({ success: false, message }, { status });
  }
}
