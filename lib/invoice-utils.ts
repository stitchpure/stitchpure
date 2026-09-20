/**
 * Pure utility functions for Sales Invoice Generation.
 * Handles financial year calculation, invoice number formatting,
 * filename generation, address formatting, logo scaling,
 * tax column visibility, and bulk ZIP filename generation.
 *
 * Requirements: 1.1, 1.2, 4.2, 4.3, 7.3, 8.3, 9.2, 10.5
 */

export type SupplyType = "intra-state" | "inter-state";

/**
 * Determine the Indian financial year for a given date.
 * April-March cycle: dates in Jan-Mar belong to previous year's FY.
 * Returns format "YY-YY" (e.g., March 2025 → "24-25", April 2024 → "24-25")
 */
export function getFinancialYear(date: Date): string {
  const month = date.getMonth(); // 0-indexed: 0=Jan, 3=Apr
  const year = date.getFullYear();

  // April (month 3) to December (month 11) → FY starts in current year
  // January (month 0) to March (month 2) → FY started in previous year
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;

  const startYY = String(fyStartYear).slice(-2);
  const endYY = String(fyEndYear).slice(-2);

  return `${startYY}-${endYY}`;
}

/**
 * Format an invoice number from components.
 * Returns "INV/{financialYear}/{zeroPaddedSequence}"
 * Sequence is zero-padded to 4 digits.
 */
export function formatInvoiceNumber(
  financialYear: string,
  sequence: number
): string {
  const paddedSequence = String(sequence).padStart(4, "0");
  return `INV/${financialYear}/${paddedSequence}`;
}

/**
 * Generate PDF filename from invoice number.
 * Replaces "/" with "-" and appends ".pdf"
 * e.g., "INV/24-25/0001" → "INV-24-25-0001.pdf"
 */
export function invoiceNumberToFilename(invoiceNumber: string): string {
  return invoiceNumber.replace(/\//g, "-") + ".pdf";
}

/**
 * Format buyer/seller address into multiple lines.
 * Splits on commas and explicit newline characters, trims each line.
 * Filters out empty lines after trimming.
 */
export function formatAddress(address: string): string[] {
  return address
    .split(/[,\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Calculate scaled dimensions for logo to fit within maxWidth x maxHeight
 * while maintaining aspect ratio. Maximizes size so at least one dimension
 * touches the boundary.
 */
export function scaleLogo(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const widthRatio = maxWidth / originalWidth;
  const heightRatio = maxHeight / originalHeight;
  const scale = Math.min(widthRatio, heightRatio);

  return {
    width: originalWidth * scale,
    height: originalHeight * scale,
  };
}

/**
 * Determine which tax columns to show based on supply type.
 * Intra-state: show CGST + SGST, hide IGST
 * Inter-state: show IGST, hide CGST + SGST
 */
export function getTaxColumnVisibility(supplyType: SupplyType): {
  showCgstSgst: boolean;
  showIgst: boolean;
} {
  if (supplyType === "intra-state") {
    return { showCgstSgst: true, showIgst: false };
  }
  return { showCgstSgst: false, showIgst: true };
}

/**
 * Generate ZIP filename from date range.
 * Format: "invoices_YYYYMMDD_YYYYMMDD.zip"
 */
export function formatBulkZipFilename(startDate: Date, endDate: Date): string {
  const formatDate = (date: Date): string => {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  };

  return `invoices_${formatDate(startDate)}_${formatDate(endDate)}.zip`;
}
