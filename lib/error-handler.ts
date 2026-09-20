/**
 * lib/error-handler.ts
 *
 * Prefer `@/lib/api-route` (`handleApiError`, `jsonOk`) for new API routes.
 * This file keeps the older Record-shaped Zod formatter used by auth/categories.
 */

import { ZodError } from "zod";

export { handleApiError, jsonOk, jsonCreated } from "@/lib/api-route";

/** Field → message map (legacy). Prefer `@/lib/format-zod-error` for array shape. */
export function formatZodError(error: ZodError) {
  const errors: Record<string, string> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    errors[path] = issue.message;
  });

  return errors;
}
