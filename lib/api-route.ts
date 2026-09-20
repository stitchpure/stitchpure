import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { formatZodError } from "@/lib/format-zod-error";
import { ServiceError } from "@/lib/service-error";

function isAuthMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("token") ||
    lower.includes("authorization") ||
    lower.includes("jwt")
  );
}

/**
 * Shared API route error → JSON response mapper.
 * Use in catch blocks instead of per-route handleError copies.
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string
): NextResponse {
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

  const err = error as { message?: string; statusCode?: number } | null;
  const message = err?.message ?? defaultMessage;

  if (typeof err?.statusCode === "number") {
    return NextResponse.json(
      { success: false, message },
      { status: err.statusCode }
    );
  }

  if (typeof message === "string" && isAuthMessage(message)) {
    return NextResponse.json(
      { success: false, message },
      { status: 401 }
    );
  }

  console.error(defaultMessage, error);
  return NextResponse.json(
    { success: false, message: defaultMessage },
    { status: 500 }
  );
}

/** Success JSON helper for list/detail responses. */
export function jsonOk<T>(
  data: T,
  options?: {
    status?: number;
    message?: string;
    pagination?: unknown;
  }
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...(options?.message ? { message: options.message } : {}),
      data,
      ...(options?.pagination ? { pagination: options.pagination } : {}),
    },
    { status: options?.status ?? 200 }
  );
}

/** Created (201) success helper. */
export function jsonCreated<T>(data: T, message?: string): NextResponse {
  return jsonOk(data, { status: 201, message });
}
