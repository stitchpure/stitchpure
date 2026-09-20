import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { formatZodError } from "@/lib/format-zod-error";
import { buildPaginationMeta } from "@/lib/pagination";
import { storefrontQuerySchema } from "@/validators/storefront.validator";
import {
  getStorefrontProducts,
  getStorefrontCategories,
} from "@/services/storefront.service";

// GET /api/storefront/products — public paginated storefront catalog
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const raw = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      categoryIds: searchParams.get("categoryIds") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      minPrice: searchParams.get("minPrice") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      includeCategories: searchParams.get("includeCategories") ?? undefined,
    };

    const params = storefrontQuerySchema.parse(raw);
    const { data, total } = await getStorefrontProducts(params);
    const pagination = buildPaginationMeta(total, {
      page: params.page,
      limit: params.limit,
    });

    const includeCategories = searchParams.get("includeCategories") === "true";
    const categories = includeCategories
      ? await getStorefrontCategories()
      : undefined;

    return NextResponse.json({
      success: true,
      data,
      pagination,
      ...(categories ? { categories } : {}),
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid pagination parameters",
          errors: formatZodError(error),
        },
        { status: 400 }
      );
    }

    console.error("GET /api/storefront/products error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load products" },
      { status: 500 }
    );
  }
}
