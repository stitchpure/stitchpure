import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";

import {
  products,
  productItems,
  productOptions,
  productOptionValues,
  itemOptionValues,
  stockLedger,
} from "@/db/schema";

import type {
  CreateProductItemInput,
  UpdateProductItemInput,
} from "@/validators/product-item.validator";

import { getStockLevel } from "@/services/stock-ledger.service";

type CreateProductItemParams = {
  companyId: string;
  data: CreateProductItemInput;
};

type GetProductItemsParams = {
  companyId: string;
  productId?: string;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  page?: number;
  limit?: number;
};

type GetProductItemByIdParams = {
  companyId: string;
  itemId: string;
};

export class ProductItemServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);

    this.name = "ProductItemServiceError";
    this.statusCode = statusCode;

    Object.setPrototypeOf(this, ProductItemServiceError.prototype);
  }
}

export async function createProductItem({
  companyId,
  data,
}: CreateProductItemParams) {
  return db.transaction(async (tx) => {
    /*
     * 1. Verify that the product belongs
     * to the logged-in company.
     */
    const [product] = await tx
      .select({
        id: products.id,
        name: products.name,
      })
      .from(products)
      .where(
        and(eq(products.id, data.productId), eq(products.companyId, companyId))
      )
      .limit(1);

    if (!product) {
      throw new ProductItemServiceError("Product not found", 404);
    }

    /*
     * 2. Check duplicate SKU.
     *
     * Current database schema makes SKU
     * globally unique.
     */
    const [existingSku] = await tx
      .select({
        id: productItems.id,
      })
      .from(productItems)
      .where(eq(productItems.sku, data.sku))
      .limit(1);

    if (existingSku) {
      throw new ProductItemServiceError(
        "An item with this SKU already exists",
        409
      );
    }

    /*
     * 3. Check duplicate barcode
     * only when barcode is provided.
     */
    if (data.barcode) {
      const [existingBarcode] = await tx
        .select({
          id: productItems.id,
        })
        .from(productItems)
        .where(eq(productItems.barcode, data.barcode))
        .limit(1);

      if (existingBarcode) {
        throw new ProductItemServiceError(
          "An item with this barcode already exists",
          409
        );
      }
    }

    /*
     * 4. Fetch all active variant options
     * for the selected product.
     */
    const variantOptions = await tx
      .select({
        id: productOptions.id,
        name: productOptions.name,
        isRequired: productOptions.isRequired,
      })
      .from(productOptions)
      .where(
        and(
          eq(productOptions.productId, data.productId),
          eq(productOptions.isVariant, true),
          eq(productOptions.isActive, true)
        )
      );

    const variantOptionIds = new Set(variantOptions.map((option) => option.id));

    /*
     * 5. Ensure every selected option
     * belongs to this product.
     */
    for (const selectedOption of data.optionValues) {
      if (!variantOptionIds.has(selectedOption.optionId)) {
        throw new ProductItemServiceError(
          "Selected option does not belong to this product"
        );
      }
    }

    /*
     * 6. Verify that all required options
     * have been selected.
     */
    const selectedOptionIds = new Set(
      data.optionValues.map((option) => option.optionId)
    );

    const missingRequiredOptions = variantOptions.filter(
      (option) => option.isRequired && !selectedOptionIds.has(option.id)
    );

    if (missingRequiredOptions.length > 0) {
      const missingNames = missingRequiredOptions
        .map((option) => option.name)
        .join(", ");

      throw new ProductItemServiceError(
        `Required options are missing: ${missingNames}`
      );
    }

    /*
     * 7. Validate selected option values.
     */
    if (data.optionValues.length > 0) {
      const selectedValueIds = data.optionValues.map(
        (option) => option.optionValueId
      );

      const optionValuesFromDatabase = await tx
        .select({
          id: productOptionValues.id,
          optionId: productOptionValues.optionId,
          value: productOptionValues.value,
          isActive: productOptionValues.isActive,
        })
        .from(productOptionValues)
        .where(inArray(productOptionValues.id, selectedValueIds));

      if (optionValuesFromDatabase.length !== selectedValueIds.length) {
        throw new ProductItemServiceError(
          "One or more selected option values do not exist"
        );
      }

      const valuesMap = new Map(
        optionValuesFromDatabase.map((value) => [value.id, value])
      );

      for (const selection of data.optionValues) {
        const optionValue = valuesMap.get(selection.optionValueId);

        if (!optionValue) {
          throw new ProductItemServiceError("Selected option value not found");
        }

        if (!optionValue.isActive) {
          throw new ProductItemServiceError(
            `Option value "${optionValue.value}" is inactive`
          );
        }

        if (optionValue.optionId !== selection.optionId) {
          throw new ProductItemServiceError(
            `Option value "${optionValue.value}" does not belong to the selected option`
          );
        }
      }
    }

    /*
     * 8. Prevent duplicate option combinations.
     *
     * Example:
     * Product = Men EVA Slipper
     * Size = 7
     * Color = Black
     *
     * This combination should exist only once.
     */
    await ensureUniqueItemCombination({
      tx,
      productId: data.productId,
      optionValues: data.optionValues,
    });

    /*
     * 9. Create the actual sellable item.
     */
    const [createdItem] = await tx
      .insert(productItems)
      .values({
        productId: data.productId,

        sku: data.sku,

        barcode: data.barcode ?? null,

        purchasePrice: data.purchasePrice.toFixed(2),

        sellingPrice: data.sellingPrice.toFixed(2),

        mrp:
          data.mrp !== null && data.mrp !== undefined
            ? data.mrp.toFixed(2)
            : null,

        weight:
          data.weight !== null && data.weight !== undefined
            ? data.weight.toFixed(2)
            : null,

        status: data.status,
      })
      .returning();

    if (!createdItem) {
      throw new ProductItemServiceError("Unable to create product item", 500);
    }

    /*
     * 10. Link the created item with
     * selected option values.
     */
    if (data.optionValues.length > 0) {
      await tx.insert(itemOptionValues).values(
        data.optionValues.map((selection) => ({
          itemId: createdItem.id,
          optionId: selection.optionId,
          optionValueId: selection.optionValueId,
        }))
      );
    }

    return {
      ...createdItem,
      productName: product.name,
      optionValues: data.optionValues,
    };
  });
}

export async function getProductItems({
  companyId,
  productId,
  search,
  status,
  page = 1,
  limit = 20,
}: GetProductItemsParams) {
  const conditions = [eq(products.companyId, companyId)];

  if (productId) {
    conditions.push(eq(productItems.productId, productId));
  }

  if (status) {
    conditions.push(eq(productItems.status, status));
  }

  if (search) {
    const normalizedSearch = search.trim();

    if (normalizedSearch) {
      const searchCondition = or(
        ilike(productItems.sku, `%${normalizedSearch}%`),
        ilike(productItems.barcode, `%${normalizedSearch}%`),
        ilike(products.name, `%${normalizedSearch}%`)
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
  }

  const offset = (page - 1) * limit;

  const [countResult, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productItems)
      .innerJoin(products, eq(products.id, productItems.productId))
      .where(and(...conditions)),

    db
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
      .where(and(...conditions))
      .orderBy(desc(productItems.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;

  if (items.length === 0) {
    return { data: [], total };
  }

  const itemIds = items.map((item) => item.id);

  const [selectedOptions, stockLevels] = await Promise.all([
    db
      .select({
        itemId: itemOptionValues.itemId,

        optionId: productOptions.id,
        optionName: productOptions.name,
        optionSlug: productOptions.slug,

        optionValueId: productOptionValues.id,

        value: productOptionValues.value,
        code: productOptionValues.code,

        colorCode: productOptionValues.colorCode,
      })
      .from(itemOptionValues)
      .innerJoin(
        productOptions,
        eq(productOptions.id, itemOptionValues.optionId)
      )
      .innerJoin(
        productOptionValues,
        eq(productOptionValues.id, itemOptionValues.optionValueId)
      )
      .where(inArray(itemOptionValues.itemId, itemIds))
      .orderBy(productOptions.displayOrder),

    db
      .select({
        productItemId: stockLedger.productItemId,
        stockLevel: sql<number>`COALESCE(SUM(${stockLedger.quantityChange}), 0)::int`,
      })
      .from(stockLedger)
      .where(inArray(stockLedger.productItemId, itemIds))
      .groupBy(stockLedger.productItemId),
  ]);

  const optionsByItem = new Map<
    string,
    Array<(typeof selectedOptions)[number]>
  >();

  for (const option of selectedOptions) {
    const currentOptions = optionsByItem.get(option.itemId) ?? [];

    currentOptions.push(option);

    optionsByItem.set(option.itemId, currentOptions);
  }

  const stockByItem = new Map<string, number>();

  for (const row of stockLevels) {
    stockByItem.set(row.productItemId, row.stockLevel);
  }

  const data = items.map((item) => ({
    ...item,

    stockLevel: stockByItem.get(item.id) ?? 0,

    optionValues: optionsByItem.get(item.id) ?? [],
  }));

  return { data, total };
}

export async function getProductItemById({
  companyId,
  itemId,
}: GetProductItemByIdParams) {
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
    .where(and(eq(productItems.id, itemId), eq(products.companyId, companyId)))
    .limit(1);

  if (!item) {
    throw new ProductItemServiceError("Product item not found", 404);
  }

  const selectedOptions = await db
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
    .where(eq(itemOptionValues.itemId, itemId))
    .orderBy(productOptions.displayOrder);

  return {
    ...item,
    stockLevel: await getStockLevel(companyId, itemId),
    optionValues: selectedOptions,
  };
}

/*
 * Check whether the exact option combination
 * already exists for this product.
 */
async function ensureUniqueItemCombination({
  tx,
  productId,
  optionValues,
}: {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];

  productId: string;

  optionValues: Array<{
    optionId: string;
    optionValueId: string;
  }>;
}) {
  /*
   * Product without variant options should
   * normally have only one sellable item.
   */
  if (optionValues.length === 0) {
    const [existingItem] = await tx
      .select({
        id: productItems.id,
      })
      .from(productItems)
      .where(eq(productItems.productId, productId))
      .limit(1);

    if (existingItem) {
      throw new ProductItemServiceError(
        "This product already has an item",
        409
      );
    }

    return;
  }

  const selectedValueIds = optionValues.map((option) => option.optionValueId);

  /*
   * Fetch every existing item of this product
   * which contains at least one selected value.
   */
  const matchingRows = await tx
    .select({
      itemId: productItems.id,

      optionValueId: itemOptionValues.optionValueId,
    })
    .from(productItems)
    .innerJoin(itemOptionValues, eq(itemOptionValues.itemId, productItems.id))
    .where(
      and(
        eq(productItems.productId, productId),

        inArray(itemOptionValues.optionValueId, selectedValueIds)
      )
    );

  if (matchingRows.length === 0) {
    return;
  }

  const possibleItemIds = [...new Set(matchingRows.map((row) => row.itemId))];

  /*
   * Fetch all values for possible matching items.
   *
   * This avoids a false duplicate when one item
   * contains the requested values plus an extra option.
   */
  const allExistingValues = await tx
    .select({
      itemId: itemOptionValues.itemId,

      optionValueId: itemOptionValues.optionValueId,
    })
    .from(itemOptionValues)
    .where(inArray(itemOptionValues.itemId, possibleItemIds));

  const valuesByItem = new Map<string, Set<string>>();

  for (const row of allExistingValues) {
    const itemValues = valuesByItem.get(row.itemId) ?? new Set<string>();

    itemValues.add(row.optionValueId);

    valuesByItem.set(row.itemId, itemValues);
  }

  const requestedValues = new Set(selectedValueIds);

  for (const existingValues of valuesByItem.values()) {
    const isSameCombination =
      existingValues.size === requestedValues.size &&
      [...requestedValues].every((valueId) => existingValues.has(valueId));

    if (isSameCombination) {
      throw new ProductItemServiceError(
        "An item with the same option combination already exists",
        409
      );
    }
  }
}

/**
 * Update mutable fields on a product item.
 * SKU and barcode uniqueness are checked against OTHER items.
 *
 * Requirements: 3.1–3.3
 */
export async function updateProductItem(
  companyId: string,
  itemId: string,
  data: UpdateProductItemInput
) {
  // Verify the item belongs to this company
  const [existing] = await db
    .select({ id: productItems.id })
    .from(productItems)
    .innerJoin(products, eq(products.id, productItems.productId))
    .where(
      and(eq(productItems.id, itemId), eq(products.companyId, companyId))
    )
    .limit(1);

  if (!existing) {
    throw new ProductItemServiceError("Product item not found", 404);
  }

  // Check SKU uniqueness (against a DIFFERENT item)
  if (data.sku !== undefined) {
    const [skuConflict] = await db
      .select({ id: productItems.id })
      .from(productItems)
      .where(
        and(eq(productItems.sku, data.sku), ne(productItems.id, itemId))
      )
      .limit(1);

    if (skuConflict) {
      throw new ProductItemServiceError(
        "An item with this SKU already exists",
        409
      );
    }
  }

  // Check barcode uniqueness (against a DIFFERENT item)
  if (data.barcode !== undefined && data.barcode !== null) {
    const [barcodeConflict] = await db
      .select({ id: productItems.id })
      .from(productItems)
      .where(
        and(
          eq(productItems.barcode, data.barcode),
          ne(productItems.id, itemId)
        )
      )
      .limit(1);

    if (barcodeConflict) {
      throw new ProductItemServiceError(
        "An item with this barcode already exists",
        409
      );
    }
  }

  const [updated] = await db
    .update(productItems)
    .set({
      ...(data.sku !== undefined && { sku: data.sku }),
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      ...(data.purchasePrice !== undefined && {
        purchasePrice: data.purchasePrice.toFixed(2),
      }),
      ...(data.sellingPrice !== undefined && {
        sellingPrice: data.sellingPrice.toFixed(2),
      }),
      ...(data.mrp !== undefined && {
        mrp: data.mrp !== null ? data.mrp.toFixed(2) : null,
      }),
      ...(data.weight !== undefined && {
        weight: data.weight !== null ? data.weight.toFixed(2) : null,
      }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: new Date(),
    })
    .where(eq(productItems.id, itemId))
    .returning();

  return updated;
}

/**
 * Soft-delete a product item by setting its status to DISCONTINUED.
 *
 * Requirements: 3.4–3.6
 */
export async function deleteProductItem(companyId: string, itemId: string) {
  // Verify the item belongs to this company
  const [existing] = await db
    .select({ id: productItems.id })
    .from(productItems)
    .innerJoin(products, eq(products.id, productItems.productId))
    .where(
      and(eq(productItems.id, itemId), eq(products.companyId, companyId))
    )
    .limit(1);

  if (!existing) {
    throw new ProductItemServiceError("Product item not found", 404);
  }

  const [updated] = await db
    .update(productItems)
    .set({ status: "DISCONTINUED", updatedAt: new Date() })
    .where(eq(productItems.id, itemId))
    .returning();

  return updated;
}
