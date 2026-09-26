import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  products,
  productOptions,
  productOptionValues,
  productItems,
  itemOptionValues,
} from "@/db/schema";

import { ServiceError } from "@/lib/service-error";
import { deriveSlug } from "@/lib/derive-slug";
import { writeStockEntry } from "@/services/stock-ledger.service";

import type { CreateCatalogInput } from "@/validators/catalog.validator";

/**
 * Create a complete catalog entry (product + size variants + SKUs + opening
 * stock) in a single atomic transaction.
 *
 * This is the unified, Meesho-style "add single catalog" flow that collapses
 * the previous four separate steps (product → options → SKUs → purchase) into
 * one call. Either everything is created or nothing is.
 *
 * Opening stock is recorded as an ADJUSTMENT ledger entry (reason: opening
 * stock) rather than a fake purchase — the ledger stays the single source of
 * truth for stock and no phantom supplier/purchase row is created.
 */
export async function createCatalog(
  companyId: string,
  data: CreateCatalogInput
) {
  return db.transaction(async (tx) => {
    // 1. Product name must be unique within the company.
    const dupName = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.companyId, companyId), eq(products.name, data.name)))
      .limit(1);

    if (dupName.length > 0) {
      throw new ServiceError("A product with this name already exists", 409);
    }

    // 2. All SKUs must be globally unique (schema enforces this too, but we
    //    check first to return a clean 409 instead of a constraint error).
    const skus = data.sizes.map((s) => s.sku);
    const existingSkus = await tx
      .select({ sku: productItems.sku })
      .from(productItems)
      .where(inArray(productItems.sku, skus));

    if (existingSkus.length > 0) {
      const taken = existingSkus.map((r) => r.sku).join(", ");
      throw new ServiceError(`SKU already exists: ${taken}`, 409);
    }

    // 3. Barcodes (when provided) must be globally unique.
    const barcodes = data.sizes
      .map((s) => s.barcode)
      .filter((b): b is string => Boolean(b));
    if (barcodes.length > 0) {
      const existingBarcodes = await tx
        .select({ barcode: productItems.barcode })
        .from(productItems)
        .where(inArray(productItems.barcode, barcodes));
      if (existingBarcodes.length > 0) {
        const taken = existingBarcodes.map((r) => r.barcode).join(", ");
        throw new ServiceError(`Barcode already exists: ${taken}`, 409);
      }
    }

    // 4. Create the product.
    const [product] = await tx
      .insert(products)
      .values({
        companyId,
        name: data.name,
        slug: deriveSlug(data.name),
        description: data.description ?? null,
        categoryId: data.categoryId ?? null,
        hsnCode: data.hsnCode ?? null,
        images: data.images ?? [],
        isActive: true,
      })
      .returning();

    if (!product) {
      throw new ServiceError("Unable to create product", 500);
    }

    // 5. Create the variant option (e.g. "Size").
    const optionName = data.optionName?.trim() || "Size";
    const [option] = await tx
      .insert(productOptions)
      .values({
        productId: product.id,
        name: optionName,
        slug: deriveSlug(optionName),
        type: "TEXT",
        isRequired: true,
        isVariant: true,
        displayOrder: 0,
      })
      .returning();

    // 6. Create one option value + one SKU + opening stock per size row.
    const createdItems: Array<{
      id: string;
      sku: string;
      size: string;
      quantity: number;
    }> = [];

    for (let i = 0; i < data.sizes.length; i++) {
      const row = data.sizes[i];

      // 6a. Option value (the size label).
      const [value] = await tx
        .insert(productOptionValues)
        .values({
          optionId: option.id,
          value: row.size,
          displayOrder: i,
        })
        .returning();

      // 6b. The sellable item (SKU).
      const [item] = await tx
        .insert(productItems)
        .values({
          productId: product.id,
          sku: row.sku,
          barcode: row.barcode ?? null,
          purchasePrice: row.purchasePrice.toFixed(2),
          sellingPrice: row.sellingPrice.toFixed(2),
          mrp:
            row.mrp !== null && row.mrp !== undefined
              ? row.mrp.toFixed(2)
              : null,
          weight:
            row.weight !== null && row.weight !== undefined
              ? row.weight.toFixed(2)
              : null,
          status: "ACTIVE",
        })
        .returning();

      // 6c. Link the item to its size value.
      await tx.insert(itemOptionValues).values({
        itemId: item.id,
        optionId: option.id,
        optionValueId: value.id,
      });

      // 6d. Opening stock as an ADJUSTMENT ledger entry (only when > 0).
      if (row.quantity > 0) {
        await writeStockEntry(tx, {
          companyId,
          productItemId: item.id,
          movementType: "ADJUSTMENT",
          referenceType: "OPENING_STOCK",
          quantityChange: row.quantity,
          notes: "Opening stock (catalog creation)",
        });
      }

      createdItems.push({
        id: item.id,
        sku: item.sku,
        size: row.size,
        quantity: row.quantity,
      });
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
      },
      option: { id: option.id, name: option.name },
      items: createdItems,
    };
  });
}
