/**
 * Bulk Invoice Download service
 *
 * Generates multiple invoice PDFs and packages them into a ZIP archive.
 * Skips non-COMPLETED sales, continues on individual failures,
 * and assigns invoice numbers in sale date order.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { sales } from "@/db/schema";

import { ServiceError } from "@/lib/service-error";
import { formatBulkZipFilename } from "@/lib/invoice-utils";

import {
  generateInvoice,
  type GenerateInvoiceResult,
} from "@/services/invoice.service";

// --- Interfaces ---

export interface BulkDownloadInput {
  saleIds: string[];
}

export interface BulkDownloadResult {
  zipBuffer: Buffer;
  filename: string;
  generated: number;
  skipped: { saleId: string; reason: string }[];
  failed: { saleId: string; error: string }[];
}

// --- Bulk Download ---

/**
 * Generate multiple invoice PDFs and package them into a ZIP file.
 *
 * - Validates saleIds count ≤ 100
 * - Skips non-COMPLETED sales
 * - Assigns invoice numbers in sale date order for new invoices
 * - Continues on individual generation failures
 * - Returns ZIP buffer with all successfully generated PDFs
 */
export async function bulkDownloadInvoices(
  companyId: string,
  input: BulkDownloadInput
): Promise<BulkDownloadResult> {
  // 1. Validate saleIds count
  if (input.saleIds.length > 100) {
    throw new ServiceError(
      "Maximum 100 invoices per bulk download",
      400
    );
  }

  // 2. Fetch all sales by IDs + companyId
  const fetchedSales = await db
    .select({
      id: sales.id,
      status: sales.status,
      saleDate: sales.saleDate,
    })
    .from(sales)
    .where(
      and(
        inArray(sales.id, input.saleIds),
        eq(sales.companyId, companyId)
      )
    );

  // Build a lookup map for quick access
  const salesMap = new Map(fetchedSales.map((s) => [s.id, s]));

  // 3. Categorize sales: skip non-COMPLETED, collect completed
  const skipped: { saleId: string; reason: string }[] = [];
  const completedSales: { id: string; saleDate: Date }[] = [];

  for (const saleId of input.saleIds) {
    const sale = salesMap.get(saleId);

    if (!sale) {
      skipped.push({ saleId, reason: "Sale not found" });
      continue;
    }

    if (sale.status !== "COMPLETED") {
      skipped.push({
        saleId,
        reason: `Sale status is ${sale.status}`,
      });
      continue;
    }

    completedSales.push({ id: sale.id, saleDate: sale.saleDate });
  }

  // 4. Sort completed sales by saleDate ascending (for sequential invoice number assignment)
  completedSales.sort(
    (a, b) => a.saleDate.getTime() - b.saleDate.getTime()
  );

  // 5. Generate invoices for each completed sale in date order
  const failed: { saleId: string; error: string }[] = [];
  const generatedPdfs: { filename: string; buffer: Buffer }[] = [];

  for (const sale of completedSales) {
    try {
      const result: GenerateInvoiceResult = await generateInvoice(
        companyId,
        { saleId: sale.id }
      );
      generatedPdfs.push({
        filename: result.filename,
        buffer: result.pdfBuffer,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      failed.push({ saleId: sale.id, error: errorMessage });
    }
  }

  // 6. Create ZIP archive with all generated PDFs
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const pdf of generatedPdfs) {
    zip.file(pdf.filename, pdf.buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  // 7. Determine date range for ZIP filename
  let filename: string;

  if (completedSales.length > 0) {
    const startDate = completedSales[0].saleDate;
    const endDate = completedSales[completedSales.length - 1].saleDate;
    filename = formatBulkZipFilename(startDate, endDate);
  } else {
    // Fallback when no completed sales exist
    const now = new Date();
    filename = formatBulkZipFilename(now, now);
  }

  // 8. Return result
  return {
    zipBuffer: Buffer.from(zipBuffer),
    filename,
    generated: generatedPdfs.length,
    skipped,
    failed,
  };
}
