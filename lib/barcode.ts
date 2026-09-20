/**
 * Barcode label generation utilities for thermal printer labels.
 * Client-side only — uses JsBarcode to render Code-128 barcodes as SVG data URLs.
 * Loaded only via the barcode-labels route (route-level code splitting).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3
 */

import JsBarcode from "jsbarcode";

export interface LabelData {
  sku: string;
  productName: string;
  variantInfo: string; // e.g., "Size 7" or "Red / XL"
}

/**
 * Generate a Code-128 barcode as a data URL (SVG serialized to base64).
 * Renders to a temporary SVG element in the DOM, serializes, then removes it.
 *
 * @param sku - The SKU string to encode as a barcode
 * @returns A data URL string (data:image/svg+xml;base64,...) of the barcode
 */
export function generateBarcodeDataUrl(sku: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  JsBarcode(svg, sku, {
    format: "CODE128",
    width: 2,
    height: 40,
    displayValue: false,
    margin: 0,
  });

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const base64 = btoa(svgString);

  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate HTML for a single 50mm × 25mm barcode label.
 * Includes: barcode image, SKU text, product name, and variant info.
 * Excludes: price information.
 *
 * @param data - Label data containing SKU, product name, and variant info
 * @returns HTML string for a single label
 */
export function generateLabelHtml(data: LabelData): string {
  const barcodeDataUrl = generateBarcodeDataUrl(data.sku);

  return `
    <div class="barcode-label" style="
      width: 50mm;
      height: 25mm;
      padding: 1.5mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      overflow: hidden;
      border: 0.5px solid #ccc;
    ">
      <img
        src="${barcodeDataUrl}"
        alt="Barcode for ${escapeHtml(data.sku)}"
        style="width: 42mm; height: 10mm; object-fit: contain;"
      />
      <div style="
        font-size: 7pt;
        font-weight: bold;
        margin-top: 1mm;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 46mm;
      ">${escapeHtml(data.sku)}</div>
      <div style="
        font-size: 6pt;
        margin-top: 0.5mm;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 46mm;
      ">${escapeHtml(data.productName)}</div>
      <div style="
        font-size: 6pt;
        color: #555;
        margin-top: 0.5mm;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 46mm;
      ">${escapeHtml(data.variantInfo)}</div>
    </div>
  `.trim();
}

/**
 * Generate HTML for multiple barcode labels in a printable batch layout.
 * Labels are arranged in a grid suitable for printing on thermal label rolls
 * or sheets. Includes CSS print media queries for 50mm × 25mm dimensions.
 *
 * @param items - Array of label data to generate
 * @returns Full HTML document string with all labels and print styles
 */
export function generateBatchLabelsHtml(items: LabelData[]): string {
  const labels = items.map((item) => generateLabelHtml(item)).join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Labels</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
    }

    .labels-container {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
      padding: 5mm;
    }

    .barcode-label {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
      @page {
        size: 50mm 25mm;
        margin: 0;
      }

      body {
        margin: 0;
        padding: 0;
      }

      .labels-container {
        padding: 0;
        gap: 0;
      }

      .barcode-label {
        width: 50mm !important;
        height: 25mm !important;
        border: none !important;
        page-break-after: always;
        break-after: page;
      }

      .barcode-label:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="labels-container">
    ${labels}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Open the browser print dialog with the provided label HTML.
 * Opens a new window with the HTML content and CSS print media queries
 * targeting 50mm × 25mm thermal printer label dimensions.
 *
 * @param html - The HTML content to print (from generateBatchLabelsHtml or generateLabelHtml)
 */
export function triggerPrint(html: string): void {
  const printWindow = window.open('', '_blank', 'width=600,height=400');

  if (!printWindow) {
    throw new Error('Unable to open print window. Please allow pop-ups for this site.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Use setTimeout to ensure the document is fully rendered before printing.
  // window.onload doesn't reliably fire for document.write() content.
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}

/**
 * Escape HTML special characters to prevent XSS in generated labels.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
