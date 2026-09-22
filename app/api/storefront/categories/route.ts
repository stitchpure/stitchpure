import { NextResponse } from "next/server";

import { getStorefrontCategories } from "@/services/storefront.service";

// GET /api/storefront/categories — public list of categories that have at
// least one visible storefront listing (used for the search "Collections"
// suggestions). Includes each category's banner image for thumbnails.
export async function GET() {
  try {
    const categories = await getStorefrontCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error: unknown) {
    console.error("GET /api/storefront/categories error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load categories" },
      { status: 500 }
    );
  }
}
