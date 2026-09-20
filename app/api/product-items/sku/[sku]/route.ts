import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";

import { authMiddleware } from "@/middleware/auth";
import { db } from "@/db";
import {
  productItems,
  products,
  itemOptionValues,
  productOptions,
  productOptionValues,
} from "@/db/schema";
import { getStockLevel } from "@/services/stock-ledger.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const authUser = authMiddleware(request);
    const { sku } = await params;

    // The scanned value may be either a SKU or a barcode. Match on both so
    // gun/camera scanners work regardless of which one is printed on the label.
    const scannedValue = sku;

    // Look up product item by SKU or barcode with company ownership check
    const [item] = await db
      .select({
        id: productItems.id,
        productId: productItems.productId,
        productName: products.name,
        sku: productItems.sku,
        barcode: productItems.barcode,
        purchasePrice: productItems.purchasePrice,
        sellingPrice: productItems.sellingPrice,
        mrp: productItems.mrp,
        weight: productItems.weight,
        status: productItems.status,
        createdAt: productItems.createdAt,
        updatedAt: productItems.updatedAt,
      })
      .from(productItems)
      .innerJoin(products, eq(products.id, productItems.productId))
      .where(
        and(
          or(
            eq(productItems.sku, scannedValue),
            eq(productItems.barcode, scannedValue)
          ),
          eq(products.companyId, authUser.companyId)
        )
      )
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, message: "No product found for this SKU or barcode" },
        { status: 404 }
      );
    }

    // Fetch variant option values
    const optionValues = await db
      .select({
        optionId: productOptions.id,
        optionName: productOptions.name,
        optionSlug: productOptions.slug,
        optionValueId: productOptionValues.id,
        value: productOptionValues.value,
        code: productOptionValues.code,
        colorCode: productOptionValues.colorCode,
      })
      .from(itemOptionValues)
      .innerJoin(productOptions, eq(productOptions.id, itemOptionValues.optionId))
      .innerJoin(
        productOptionValues,
        eq(productOptionValues.id, itemOptionValues.optionValueId)
      )
      .where(eq(itemOptionValues.itemId, item.id))
      .orderBy(productOptions.displayOrder);

    // Get current stock level
    const stockLevel = await getStockLevel(authUser.companyId, item.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...item,
          stockLevel,
          optionValues,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to look up product item by SKU";
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes("token") ||
      normalizedMessage.includes("authorization")
    ) {
      return NextResponse.json(
        { success: false, message },
        { status: 401 }
      );
    }

    console.error("Unable to look up product item by SKU", error);

    return NextResponse.json(
      { success: false, message: "Unable to look up product item by SKU" },
      { status: 500 }
    );
  }
}
