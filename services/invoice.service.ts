/**
 * Invoice service
 *
 * Orchestrates invoice generation, listing, searching, and cancellation
 * scoped to a company.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { and, count, desc, eq, ilike, or, sql, SQL } from "drizzle-orm";

import { db } from "@/db";

import {
  invoices,
  sales,
  saleItems,
  companies,
  products,
  productItems,
} from "@/db/schema";

import { ServiceError } from "@/lib/service-error";
import { invoiceNumberToFilename } from "@/lib/invoice-utils";

import type { PaginationParams } from "@/lib/pagination";

import { assignInvoiceNumber } from "@/services/invoice-number.service";
import {
  generateInvoicePdf,
  type InvoiceData,
  type InvoiceLineItem,
} from "@/services/invoice-pdf.service";
import { getTemplateConfig } from "@/services/invoice-template.service";

import type { InvoiceListFilters } from "@/validators/invoice.validator";

// --- Interfaces ---

export interface GenerateInvoiceInput {
  saleId: string;
}

export interface GenerateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  pdfBuffer: Buffer;
  filename: string;
  warnings: string[];
}

// --- Generate Invoice ---

/**
 * Generate an invoice for a completed sale.
 * Validates sale status, assigns invoice number, gathers data,
 * renders PDF, and returns result with warnings.
 */
export async function generateInvoice(
  companyId: string,
  input: GenerateInvoiceInput
): Promise<GenerateInvoiceResult> {
  // 1. Fetch the sale by id + companyId
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, input.saleId), eq(sales.companyId, companyId)))
    .limit(1);

  if (!sale) {
    throw new ServiceError("Sale not found", 404);
  }

  // 2. Reject PENDING or CANCELLED sales
  if (sale.status === "PENDING") {
    throw new ServiceError(
      "Cannot generate invoice for a pending sale",
      400
    );
  }

  if (sale.status === "CANCELLED") {
    throw new ServiceError(
      "Cannot generate invoice for a cancelled sale",
      400
    );
  }

  // 3. Assign invoice number (idempotent)
  const { invoiceNumber } = await assignInvoiceNumber(
    companyId,
    input.saleId,
    sale.saleDate
  );

  // 4. Fetch company details for seller info
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new ServiceError("Company not found", 404);
  }

  // 5. Fetch sale items with product items and products
  const items = await db
    .select({
      saleItem: saleItems,
      productItem: productItems,
      product: products,
    })
    .from(saleItems)
    .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
    .innerJoin(products, eq(productItems.productId, products.id))
    .where(eq(saleItems.saleId, input.saleId));

  // 6. Build line items
  const lineItems: InvoiceLineItem[] = items.map((row, index) => {
    const unitPrice = parseFloat(row.saleItem.unitPrice);
    const totalPrice = parseFloat(row.saleItem.totalPrice);
    const quantity = row.saleItem.quantity;

    // Use totalPrice as taxableValue (GST columns not yet in schema)
    const taxableValue = totalPrice;

    return {
      sNo: index + 1,
      description: row.product.name,
      hsnCode: row.product.hsnCode || null,
      quantity,
      unitRate: unitPrice,
      taxableValue,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalAmount: totalPrice,
    };
  });

  // Calculate totals
  const totalTaxableValue = lineItems.reduce(
    (sum, item) => sum + item.taxableValue,
    0
  );
  const totalCgst = lineItems.reduce((sum, item) => sum + item.cgstAmount, 0);
  const totalSgst = lineItems.reduce((sum, item) => sum + item.sgstAmount, 0);
  const totalIgst = lineItems.reduce((sum, item) => sum + item.igstAmount, 0);
  const grandTotal = totalTaxableValue + totalCgst + totalSgst + totalIgst;

  // 7. Collect warnings
  const warnings: string[] = [];

  if (!company.registeredAddress) {
    warnings.push("Seller Address Missing");
  }

  if (!sale.buyerAddress) {
    warnings.push("Buyer Address Missing");
  }

  if (!company.gstin) {
    warnings.push("Seller GSTIN not configured");
  }

  // 8. Build InvoiceData
  const invoiceData: InvoiceData = {
    invoiceNumber,
    invoiceDate: sale.saleDate,
    // Seller
    sellerName: company.name,
    sellerGstin: company.gstin ?? null,
    sellerAddress: company.registeredAddress,
    sellerPhone: company.phone,
    sellerEmail: company.email,
    sellerLogo: company.logo,
    // Buyer
    buyerName: sale.customerName,
    buyerPhone: sale.customerPhone,
    buyerGstin: sale.buyerGstin ?? null,
    buyerAddress: sale.buyerAddress,
    shippingAddress: sale.shippingAddress ?? null,
    placeOfSupply: sale.placeOfSupply ?? null,
    // Sale details
    salesChannel: null,
    orderReference: sale.referenceNo,
    supplyType: "intra-state",
    // Line items
    lineItems,
    // Totals
    totalTaxableValue,
    totalCgst,
    totalSgst,
    totalIgst,
    grandTotal,
  };

  // 9. Get template config and generate PDF
  const templateConfig = await getTemplateConfig(companyId);
  const pdfBuffer = await generateInvoicePdf(invoiceData, templateConfig);

  // 10. Fetch the invoice record to get the id
  const [invoiceRecord] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.saleId, input.saleId),
        eq(invoices.companyId, companyId)
      )
    )
    .limit(1);

  const filename = invoiceNumberToFilename(invoiceNumber);

  return {
    invoiceId: invoiceRecord.id,
    invoiceNumber,
    pdfBuffer,
    filename,
    warnings,
  };
}

// --- List Invoices ---

/**
 * Return a paginated list of invoices for the company with optional filters.
 * Ordered by generatedAt descending.
 */
export async function listInvoices(
  companyId: string,
  params: PaginationParams,
  filters?: InvoiceListFilters
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [eq(invoices.companyId, companyId)];

  // Financial year filter
  if (filters?.financialYear) {
    conditions.push(eq(invoices.financialYear, filters.financialYear));
  }

  // Date range filters on generatedAt
  if (filters?.startDate) {
    conditions.push(
      sql`${invoices.generatedAt} >= ${filters.startDate}`
    );
  }

  if (filters?.endDate) {
    conditions.push(
      sql`${invoices.generatedAt} <= ${filters.endDate}`
    );
  }

  // Status filter
  if (filters?.status) {
    conditions.push(eq(invoices.status, filters.status));
  }

  const where = and(...conditions);

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        financialYear: invoices.financialYear,
        sequenceNumber: invoices.sequenceNumber,
        status: invoices.status,
        generatedAt: invoices.generatedAt,
        saleId: invoices.saleId,
        customerName: sales.customerName,
        totalAmount: sales.totalAmount,
      })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .where(where)
      .orderBy(desc(invoices.generatedAt))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(invoices).where(where),
  ]);

  return { data, total };
}

// --- Search Invoices ---

/**
 * Search invoices by invoice number, customer name, or buyer address.
 * Uses ILIKE for case-insensitive partial matching.
 */
export async function searchInvoices(
  companyId: string,
  query: string,
  params: PaginationParams
) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const searchPattern = `%${query}%`;

  const baseCondition = eq(invoices.companyId, companyId);

  const searchCondition = or(
    ilike(invoices.invoiceNumber, searchPattern),
    ilike(sales.customerName, searchPattern),
    ilike(sales.buyerAddress, searchPattern)
  );

  const where = and(baseCondition, searchCondition);

  const [data, [{ total }]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        financialYear: invoices.financialYear,
        sequenceNumber: invoices.sequenceNumber,
        status: invoices.status,
        generatedAt: invoices.generatedAt,
        saleId: invoices.saleId,
        customerName: sales.customerName,
        totalAmount: sales.totalAmount,
      })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .where(where)
      .orderBy(desc(invoices.generatedAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(invoices)
      .leftJoin(sales, eq(invoices.saleId, sales.id))
      .where(where),
  ]);

  return { data, total };
}

// --- Cancel Invoice ---

/**
 * Cancel an invoice. Marks status as CANCELLED but retains the record.
 * Throws 404 if not found.
 */
export async function cancelInvoice(companyId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
    .limit(1);

  if (!invoice) {
    throw new ServiceError("Invoice not found", 404);
  }

  const [updated] = await db
    .update(invoices)
    .set({
      status: "CANCELLED",
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
    .returning();

  return updated;
}
