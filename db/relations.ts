import { relations } from "drizzle-orm";

import { companies } from "./schema/company";
import { suppliers } from "./schema/supplier";
import { purchases, purchaseItems } from "./schema/purchase";
import { sales, saleItems } from "./schema/sale";
import { stockLedger } from "./schema/stock-ledger";
import { productItems } from "./schema/product-item";
import { productOptions } from "./schema/product-option";
import { productOptionValues } from "./schema/product-option-value";
import { itemOptionValues } from "./schema/item-option-value";

// ─── Existing relations ────────────────────────────────────────────────────────

export const itemOptionValuesRelations = relations(
  itemOptionValues,
  ({ one }) => ({
    item: one(productItems, {
      fields: [itemOptionValues.itemId],
      references: [productItems.id],
    }),

    option: one(productOptions, {
      fields: [itemOptionValues.optionId],
      references: [productOptions.id],
    }),

    optionValue: one(productOptionValues, {
      fields: [itemOptionValues.optionValueId],
      references: [productOptionValues.id],
    }),
  })
);

export const productOptionsRelations = relations(
  productOptions,
  ({ many }) => ({
    itemOptionValues: many(itemOptionValues),
  })
);

export const productOptionValuesRelations = relations(
  productOptionValues,
  ({ many }) => ({
    itemOptionValues: many(itemOptionValues),
  })
);

// ─── Extended productItemsRelations ───────────────────────────────────────────

export const productItemsRelations = relations(productItems, ({ many }) => ({
  optionValues: many(itemOptionValues),
  purchaseItems: many(purchaseItems),
  saleItems: many(saleItems),
  stockLedger: many(stockLedger),
}));

// ─── New relations ─────────────────────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({
  suppliers: many(suppliers),
  purchases: many(purchases),
  sales: many(sales),
  stockLedger: many(stockLedger),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  company: one(companies, {
    fields: [suppliers.companyId],
    references: [companies.id],
  }),
  purchases: many(purchases),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  company: one(companies, {
    fields: [purchases.companyId],
    references: [companies.id],
  }),
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  purchaseItems: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  productItem: one(productItems, {
    fields: [purchaseItems.productItemId],
    references: [productItems.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  company: one(companies, {
    fields: [sales.companyId],
    references: [companies.id],
  }),
  saleItems: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  productItem: one(productItems, {
    fields: [saleItems.productItemId],
    references: [productItems.id],
  }),
}));

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
  company: one(companies, {
    fields: [stockLedger.companyId],
    references: [companies.id],
  }),
  productItem: one(productItems, {
    fields: [stockLedger.productItemId],
    references: [productItems.id],
  }),
}));
