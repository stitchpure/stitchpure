/**
 * Invoice PDF Generation Service
 *
 * Generates GST-compliant tax invoice PDFs using pdf-lib (loaded on demand).
 * Professional layout with clean spacing, balanced sections.
 */

import { numberToIndianWords } from "@/lib/number-to-words";
import { generateQrCodeBuffer } from "@/lib/qr-generator";
import {
  formatAddress,
  getTaxColumnVisibility,
} from "@/lib/invoice-utils";
import type { InvoiceTemplateConfig } from "@/services/invoice-template.service";

// --- Interfaces ---

export interface InvoiceLineItem {
  sNo: number;
  description: string;
  hsnCode: string | null;
  quantity: number;
  unitRate: number;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalAmount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  sellerName: string;
  sellerGstin: string | null;
  sellerAddress: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  sellerLogo: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerGstin: string | null;
  buyerAddress: string | null;
  shippingAddress: string | null;
  placeOfSupply: string | null;
  salesChannel: string | null;
  orderReference: string | null;
  supplyType: "intra-state" | "inter-state";
  lineItems: InvoiceLineItem[];
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  grandTotal: number;
}

// --- Constants ---

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN_X;

// --- Helper Functions ---

function hexToRgb(
  hex: string,
  rgb: Awaited<typeof import("pdf-lib")>["rgb"]
) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function formatCurrency(value: number): string {
  return `Rs. ${value.toFixed(2)}`;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// --- Main PDF Generation ---

export async function generateInvoicePdf(
  data: InvoiceData,
  templateConfig: InvoiceTemplateConfig
): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Invoice ${data.invoiceNumber}`);
  pdfDoc.setSubject("GST Tax Invoice");
  pdfDoc.setCreator("Stock Management System");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const accent = hexToRgb(templateConfig.accentColor, rgb);
  const gray = rgb(0.4, 0.4, 0.4);
  const darkGray = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.92, 0.92, 0.92);
  const white = rgb(1, 1, 1);

  let y = A4_HEIGHT - MARGIN_TOP;

  // ═══════════════════════════════════════════════════════════════════════
  // HEADER — Company name + details on left, Invoice info on right
  // ═══════════════════════════════════════════════════════════════════════

  // Top accent bar
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 4,
    width: CONTENT_WIDTH,
    height: 4,
    color: accent,
  });
  y -= 24;

  // Company name
  page.drawText(data.sellerName.toUpperCase(), {
    x: MARGIN_X,
    y,
    size: 18,
    font: fontBold,
    color: accent,
  });
  y -= 16;

  // GSTIN
  const gstinText = data.sellerGstin
    ? `GSTIN: ${data.sellerGstin}`
    : "GSTIN: Not Registered";
  page.drawText(gstinText, { x: MARGIN_X, y, size: 9, font, color: gray });
  y -= 13;

  // Contact line
  const contactParts: string[] = [];
  if (data.sellerPhone) contactParts.push(data.sellerPhone);
  if (data.sellerEmail) contactParts.push(data.sellerEmail);
  if (contactParts.length > 0) {
    page.drawText(contactParts.join("  |  "), {
      x: MARGIN_X, y, size: 8, font, color: gray,
    });
    y -= 12;
  }

  // Address
  if (data.sellerAddress) {
    const addrLines = formatAddress(data.sellerAddress);
    page.drawText(addrLines.join(", "), {
      x: MARGIN_X, y, size: 8, font, color: gray, maxWidth: CONTENT_WIDTH * 0.55,
    });
    y -= 12;
  }

  // RIGHT side — Invoice details box
  const boxW = 180;
  const boxH = 65;
  const boxX = A4_WIDTH - MARGIN_X - boxW;
  const boxY = A4_HEIGHT - MARGIN_TOP - 24 - boxH;
  
  // Box outline
  page.drawRectangle({
    x: boxX, y: boxY, width: boxW, height: boxH,
    borderColor: accent, borderWidth: 1, color: white,
  });

  // "TAX INVOICE" label centered in box top
  const taxInvLabel = "TAX INVOICE";
  const taxInvW = fontBold.widthOfTextAtSize(taxInvLabel, 10);
  page.drawText(taxInvLabel, {
    x: boxX + (boxW - taxInvW) / 2,
    y: boxY + boxH - 15,
    size: 10, font: fontBold, color: accent,
  });

  // Invoice details inside box
  const detailX = boxX + 10;
  let detailY = boxY + boxH - 30;

  page.drawText(`No: ${data.invoiceNumber}`, {
    x: detailX, y: detailY, size: 9, font: fontBold, color: darkGray,
  });
  detailY -= 13;

  page.drawText(`Date: ${formatDate(data.invoiceDate)}`, {
    x: detailX, y: detailY, size: 9, font, color: darkGray,
  });
  detailY -= 13;

  if (data.orderReference) {
    page.drawText(`Ref: ${data.orderReference}`, {
      x: detailX, y: detailY, size: 8, font, color: gray,
    });
  }

  // Channel badge (small pill next to box)
  const channel = data.salesChannel || "Offline";
  const chW = fontBold.widthOfTextAtSize(channel, 7) + 10;
  page.drawRectangle({
    x: boxX + boxW - chW - 5,
    y: boxY + boxH + 4,
    width: chW, height: 13,
    color: accent,
  });
  page.drawText(channel, {
    x: boxX + boxW - chW,
    y: boxY + boxH + 7,
    size: 7, font: fontBold, color: white,
  });

  // Move y below header
  y = Math.min(y, boxY) - 20;

  // Separator line
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: A4_WIDTH - MARGIN_X, y },
    thickness: 0.75, color: lightGray,
  });
  y -= 20;

  // ═══════════════════════════════════════════════════════════════════════
  // BILL TO + SHIP TO sections (side by side)
  // ═══════════════════════════════════════════════════════════════════════

  const billToX = MARGIN_X;
  const shipToX = MARGIN_X + CONTENT_WIDTH * 0.5 + 10;
  const sectionStartY = y;

  // --- BILL TO (left side) ---
  let billY = sectionStartY;

  page.drawText("BILL TO", {
    x: billToX, y: billY, size: 9, font: fontBold, color: accent,
  });
  billY -= 15;

  if (data.buyerName) {
    page.drawText(data.buyerName, {
      x: billToX, y: billY, size: 11, font: fontBold, color: darkGray,
    });
    billY -= 15;
  }

  if (data.buyerGstin) {
    page.drawText(`GSTIN: ${data.buyerGstin}`, {
      x: billToX, y: billY, size: 9, font, color: gray,
    });
    billY -= 13;
  }

  if (data.buyerPhone) {
    page.drawText(`Phone: ${data.buyerPhone}`, {
      x: billToX, y: billY, size: 9, font, color: gray,
    });
    billY -= 13;
  }

  if (data.buyerAddress) {
    const addrLines = formatAddress(data.buyerAddress);
    for (const line of addrLines) {
      page.drawText(line, { x: billToX, y: billY, size: 9, font, color: gray, maxWidth: CONTENT_WIDTH * 0.45 });
      billY -= 12;
    }
  }

  if (data.placeOfSupply) {
    page.drawText(`Place of Supply: ${data.placeOfSupply}`, {
      x: billToX, y: billY, size: 8, font, color: gray,
    });
    billY -= 12;
  }

  // --- SHIP TO (right side) ---
  let shipY = sectionStartY;
  const shipAddress = data.shippingAddress ?? data.buyerAddress;

  page.drawText("SHIP TO", {
    x: shipToX, y: shipY, size: 9, font: fontBold, color: accent,
  });
  shipY -= 15;

  if (data.buyerName) {
    page.drawText(data.buyerName, {
      x: shipToX, y: shipY, size: 11, font: fontBold, color: darkGray,
    });
    shipY -= 15;
  }

  if (shipAddress) {
    const shipLines = formatAddress(shipAddress);
    for (const line of shipLines) {
      page.drawText(line, { x: shipToX, y: shipY, size: 9, font, color: gray, maxWidth: CONTENT_WIDTH * 0.45 });
      shipY -= 12;
    }
  }

  // Move y below whichever section is taller
  y = Math.min(billY, shipY) - 15;

  // ═══════════════════════════════════════════════════════════════════════
  // LINE ITEMS TABLE
  // ═══════════════════════════════════════════════════════════════════════

  const { showCgstSgst } = getTaxColumnVisibility(data.supplyType);
  const fontSize = 8;

  // Simplified columns for cleaner look
  type Col = { label: string; x: number; width: number; align: "left" | "right" };
  let columns: Col[];

  if (showCgstSgst) {
    columns = [
      { label: "#", x: MARGIN_X, width: 20, align: "left" },
      { label: "Item Description", x: MARGIN_X + 20, width: 140, align: "left" },
      { label: "HSN", x: MARGIN_X + 160, width: 50, align: "left" },
      { label: "Qty", x: MARGIN_X + 210, width: 30, align: "right" },
      { label: "Rate", x: MARGIN_X + 240, width: 55, align: "right" },
      { label: "CGST", x: MARGIN_X + 295, width: 50, align: "right" },
      { label: "SGST", x: MARGIN_X + 345, width: 50, align: "right" },
      { label: "Amount", x: MARGIN_X + 395, width: CONTENT_WIDTH - 395, align: "right" },
    ];
  } else {
    columns = [
      { label: "#", x: MARGIN_X, width: 20, align: "left" },
      { label: "Item Description", x: MARGIN_X + 20, width: 160, align: "left" },
      { label: "HSN", x: MARGIN_X + 180, width: 55, align: "left" },
      { label: "Qty", x: MARGIN_X + 235, width: 35, align: "right" },
      { label: "Rate", x: MARGIN_X + 270, width: 60, align: "right" },
      { label: "IGST", x: MARGIN_X + 330, width: 60, align: "right" },
      { label: "Amount", x: MARGIN_X + 390, width: CONTENT_WIDTH - 390, align: "right" },
    ];
  }

  // Table header row with accent background
  const headerHeight = 20;
  page.drawRectangle({
    x: MARGIN_X, y: y - headerHeight + 4,
    width: CONTENT_WIDTH, height: headerHeight,
    color: accent,
  });

  for (const col of columns) {
    const tw = fontBold.widthOfTextAtSize(col.label, fontSize);
    const tx = col.align === "right" ? col.x + col.width - tw - 4 : col.x + 4;
    page.drawText(col.label, {
      x: tx, y: y - 10, size: fontSize, font: fontBold, color: white,
    });
  }
  y -= headerHeight + 4;

  // Table data rows with alternating background
  const rowHeight = 18;
  for (let i = 0; i < data.lineItems.length; i++) {
    const item = data.lineItems[i];

    // Alternating row background
    if (i % 2 === 0) {
      page.drawRectangle({
        x: MARGIN_X, y: y - rowHeight + 5,
        width: CONTENT_WIDTH, height: rowHeight,
        color: rgb(0.97, 0.97, 0.97),
      });
    }

    const hsnDisplay = item.hsnCode || "N/A";
    let rowValues: string[];
    if (showCgstSgst) {
      rowValues = [
        String(item.sNo),
        item.description.length > 28 ? item.description.slice(0, 27) + "..." : item.description,
        hsnDisplay,
        String(item.quantity),
        formatMoney(item.unitRate),
        item.cgstAmount > 0 ? `${item.cgstRate}% / ${formatMoney(item.cgstAmount)}` : "0.00",
        item.sgstAmount > 0 ? `${item.sgstRate}% / ${formatMoney(item.sgstAmount)}` : "0.00",
        formatMoney(item.totalAmount),
      ];
    } else {
      rowValues = [
        String(item.sNo),
        item.description.length > 32 ? item.description.slice(0, 31) + "..." : item.description,
        hsnDisplay,
        String(item.quantity),
        formatMoney(item.unitRate),
        item.igstAmount > 0 ? `${item.igstRate}% / ${formatMoney(item.igstAmount)}` : "0.00",
        formatMoney(item.totalAmount),
      ];
    }

    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const val = rowValues[c];
      const tw = font.widthOfTextAtSize(val, fontSize);
      const tx = col.align === "right" ? col.x + col.width - tw - 4 : col.x + 4;
      page.drawText(val, {
        x: tx, y: y - 8, size: fontSize, font, color: darkGray,
      });
    }
    y -= rowHeight;
  }

  // Table bottom border
  y -= 4;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: A4_WIDTH - MARGIN_X, y },
    thickness: 1, color: accent,
  });
  y -= 20;

  // ═══════════════════════════════════════════════════════════════════════
  // TOTALS SECTION — right-aligned summary box
  // ═══════════════════════════════════════════════════════════════════════

  const totalsX = A4_WIDTH - MARGIN_X - 220;
  const labelCol = totalsX;
  const valueCol = A4_WIDTH - MARGIN_X - 10;

  // Taxable value
  page.drawText("Taxable Value:", {
    x: labelCol, y, size: 9, font, color: gray,
  });
  const tvStr = formatCurrency(data.totalTaxableValue);
  const tvW = font.widthOfTextAtSize(tvStr, 9);
  page.drawText(tvStr, { x: valueCol - tvW, y, size: 9, font, color: darkGray });
  y -= 14;

  // Tax rows
  if (showCgstSgst) {
    page.drawText("CGST:", { x: labelCol, y, size: 9, font, color: gray });
    const cs = formatCurrency(data.totalCgst);
    const cw = font.widthOfTextAtSize(cs, 9);
    page.drawText(cs, { x: valueCol - cw, y, size: 9, font, color: darkGray });
    y -= 14;

    page.drawText("SGST:", { x: labelCol, y, size: 9, font, color: gray });
    const ss = formatCurrency(data.totalSgst);
    const sw = font.widthOfTextAtSize(ss, 9);
    page.drawText(ss, { x: valueCol - sw, y, size: 9, font, color: darkGray });
    y -= 14;
  } else {
    page.drawText("IGST:", { x: labelCol, y, size: 9, font, color: gray });
    const is_ = formatCurrency(data.totalIgst);
    const iw = font.widthOfTextAtSize(is_, 9);
    page.drawText(is_, { x: valueCol - iw, y, size: 9, font, color: darkGray });
    y -= 14;
  }

  // Separator before grand total
  page.drawLine({
    start: { x: totalsX, y: y + 4 },
    end: { x: A4_WIDTH - MARGIN_X, y: y + 4 },
    thickness: 0.75, color: accent,
  });
  y -= 6;

  // Grand total — emphasized, right-aligned with values above
  page.drawText("GRAND TOTAL:", {
    x: labelCol, y, size: 11, font: fontBold, color: accent,
  });
  const gtStr = formatCurrency(data.grandTotal);
  const gtW = fontBold.widthOfTextAtSize(gtStr, 11);
  page.drawText(gtStr, { x: valueCol - gtW, y, size: 11, font: fontBold, color: accent });

  // Underline below grand total for emphasis
  page.drawLine({
    start: { x: totalsX, y: y - 5 },
    end: { x: A4_WIDTH - MARGIN_X, y: y - 5 },
    thickness: 1, color: accent,
  });
  y -= 25;

  // ═══════════════════════════════════════════════════════════════════════
  // AMOUNT IN WORDS
  // ═══════════════════════════════════════════════════════════════════════

  const amountWords = numberToIndianWords(data.grandTotal);
  page.drawText("Amount in Words:", {
    x: MARGIN_X, y, size: 8, font: fontBold, color: darkGray,
  });
  y -= 13;
  page.drawText(amountWords, {
    x: MARGIN_X, y, size: 9, font, color: gray, maxWidth: CONTENT_WIDTH - 100,
  });
  y -= 20;

  // Light separator
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: A4_WIDTH - MARGIN_X, y },
    thickness: 0.5, color: lightGray,
  });
  y -= 15;

  // ═══════════════════════════════════════════════════════════════════════
  // QR CODE — positioned above authorized signatory, right side
  // ═══════════════════════════════════════════════════════════════════════

  try {
    const qrBuf = await generateQrCodeBuffer(data.invoiceNumber);
    const qrImg = await pdfDoc.embedPng(qrBuf);
    const qrSize = 65;
    const qrX = A4_WIDTH - MARGIN_X - qrSize;
    const qrY = MARGIN_BOTTOM + 55; // above signatory line
    page.drawImage(qrImg, {
      x: qrX, y: qrY, width: qrSize, height: qrSize,
    });
    // Small label below QR
    const qrLabel = "Scan to verify";
    const qlW = font.widthOfTextAtSize(qrLabel, 6);
    page.drawText(qrLabel, {
      x: qrX + (qrSize - qlW) / 2,
      y: qrY - 9,
      size: 6, font, color: gray,
    });
  } catch {
    // QR generation failed — continue without it
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FOOTER — Bank details + Terms + Signature line
  // ═══════════════════════════════════════════════════════════════════════

  let footerY = MARGIN_BOTTOM + 100;

  if (templateConfig.bankDetails) {
    page.drawText("Bank Details:", {
      x: MARGIN_X, y: footerY, size: 8, font: fontBold, color: darkGray,
    });
    footerY -= 12;
    const bankLines = templateConfig.bankDetails.split("\n");
    for (const line of bankLines) {
      page.drawText(line.trim(), {
        x: MARGIN_X, y: footerY, size: 7, font, color: gray,
        maxWidth: CONTENT_WIDTH * 0.5,
      });
      footerY -= 10;
    }
    footerY -= 5;
  }

  if (templateConfig.termsAndConditions) {
    page.drawText("Terms & Conditions:", {
      x: MARGIN_X, y: footerY, size: 8, font: fontBold, color: darkGray,
    });
    footerY -= 12;
    page.drawText(templateConfig.termsAndConditions, {
      x: MARGIN_X, y: footerY, size: 7, font, color: gray,
      maxWidth: CONTENT_WIDTH * 0.55,
    });
  }

  // Authorized Signatory line (bottom right, below QR code)
  const sigY = MARGIN_BOTTOM + 30;
  page.drawLine({
    start: { x: A4_WIDTH - MARGIN_X - 130, y: sigY },
    end: { x: A4_WIDTH - MARGIN_X, y: sigY },
    thickness: 0.5, color: gray,
  });
  const sigLabel = "Authorized Signatory";
  const sigW = font.widthOfTextAtSize(sigLabel, 7);
  page.drawText(sigLabel, {
    x: A4_WIDTH - MARGIN_X - 65 - sigW / 2,
    y: sigY - 10,
    size: 7, font, color: gray,
  });

  // Bottom accent bar
  page.drawRectangle({
    x: MARGIN_X,
    y: MARGIN_BOTTOM - 5,
    width: CONTENT_WIDTH,
    height: 3,
    color: accent,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
