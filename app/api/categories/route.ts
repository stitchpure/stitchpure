import { NextRequest } from "next/server";

import { authMiddleware } from "@/middleware/auth";
import { requireRole } from "@/middleware/role";
import { Roles } from "@/types/role";
import { createCategorySchema } from "@/validators/category.validator";
import { createCategory, getCategories } from "@/services/category.service";
import { handleApiError, jsonCreated, jsonOk } from "@/lib/api-route";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

// GET ALL CATEGORIES

export async function GET(request: NextRequest) {
  try {
    const user = authMiddleware(request);

    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";
    const paginationParams = parsePaginationParams(searchParams);

    const { data, total } = await getCategories(user.companyId as string, {
      includeInactive,
      ...paginationParams,
    });

    const pagination = buildPaginationMeta(total, paginationParams);

    return jsonOk(data, { pagination });
  } catch (error) {
    return handleApiError(error, "Unable to fetch categories");
  }
}

// CREATE CATEGORY

export async function POST(request: NextRequest) {
  try {
    const user = authMiddleware(request);
    requireRole(user, Roles.OWNER, Roles.MANAGER);

    const body = await request.json();
    const data = createCategorySchema.parse(body);

    const category = await createCategory(user.companyId as string, data);

    return jsonCreated(category, "Category created successfully");
  } catch (error) {
    return handleApiError(error, "Unable to create category");
  }
}
