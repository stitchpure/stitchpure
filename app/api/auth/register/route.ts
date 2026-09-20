import { NextResponse } from "next/server";

/**
 * Public self-registration is DISABLED for this single-company brand site.
 *
 * There is only one company and only its owner/staff should have admin access.
 * New admin users are created from inside the dashboard (Users page) or via the
 * seed script — never through a public signup endpoint.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: "Public registration is disabled. Please contact the administrator.",
    },
    { status: 403 }
  );
}
