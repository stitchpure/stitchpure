import { NextRequest } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { Roles } from "@/types/role";
import { createCatalogSchema } from "@/validators/catalog.validator";
import { createCatalog } from "@/services/catalog.service";
import { handleApiError, jsonCreated } from "@/lib/api-route";

/**
 * POST /api/catalog
 *
 * Unified "add single catalog" endpoint. Creates a product, its size variant
 * option + values, one SKU per size, and opening stock — all in one
 * transaction. OWNER/MANAGER only.
 */
export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = createCatalogSchema.parse(body);

    const result = await createCatalog(user.companyId, data);

    return jsonCreated(result, "Catalog created successfully");
  } catch (error) {
    return handleApiError(error, "Unable to create catalog");
  }
}
