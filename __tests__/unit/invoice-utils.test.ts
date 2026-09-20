import { describe, it, expect } from "vitest";
import {
  getFinancialYear,
  formatInvoiceNumber,
  invoiceNumberToFilename,
  formatAddress,
  scaleLogo,
  getTaxColumnVisibility,
  formatBulkZipFilename,
} from "../../lib/invoice-utils";

describe("getFinancialYear", () => {
  it("returns '24-25' for April 2024", () => {
    expect(getFinancialYear(new Date(2024, 3, 1))).toBe("24-25");
  });

  it("returns '24-25' for March 2025 (belongs to previous FY)", () => {
    expect(getFinancialYear(new Date(2025, 2, 31))).toBe("24-25");
  });

  it("returns '24-25' for January 2025", () => {
    expect(getFinancialYear(new Date(2025, 0, 15))).toBe("24-25");
  });

  it("returns '25-26' for April 2025", () => {
    expect(getFinancialYear(new Date(2025, 3, 1))).toBe("25-26");
  });

  it("returns '24-25' for December 2024", () => {
    expect(getFinancialYear(new Date(2024, 11, 31))).toBe("24-25");
  });

  it("returns '23-24' for February 2024", () => {
    expect(getFinancialYear(new Date(2024, 1, 29))).toBe("23-24");
  });
});

describe("formatInvoiceNumber", () => {
  it("formats with zero-padded sequence", () => {
    expect(formatInvoiceNumber("24-25", 1)).toBe("INV/24-25/0001");
  });

  it("handles sequence above 4 digits", () => {
    expect(formatInvoiceNumber("24-25", 10000)).toBe("INV/24-25/10000");
  });

  it("pads sequence to 4 digits", () => {
    expect(formatInvoiceNumber("24-25", 42)).toBe("INV/24-25/0042");
  });

  it("handles max 4-digit sequence", () => {
    expect(formatInvoiceNumber("24-25", 9999)).toBe("INV/24-25/9999");
  });
});

describe("invoiceNumberToFilename", () => {
  it("replaces slashes with hyphens and appends .pdf", () => {
    expect(invoiceNumberToFilename("INV/24-25/0001")).toBe("INV-24-25-0001.pdf");
  });

  it("handles invoice number without slashes", () => {
    expect(invoiceNumberToFilename("INV-24-25-0001")).toBe("INV-24-25-0001.pdf");
  });
});

describe("formatAddress", () => {
  it("splits on commas", () => {
    expect(formatAddress("123 Street, City, State 12345")).toEqual([
      "123 Street",
      "City",
      "State 12345",
    ]);
  });

  it("splits on newlines", () => {
    expect(formatAddress("123 Street\nCity\nState 12345")).toEqual([
      "123 Street",
      "City",
      "State 12345",
    ]);
  });

  it("splits on mixed commas and newlines", () => {
    expect(formatAddress("123 Street, City\nState 12345")).toEqual([
      "123 Street",
      "City",
      "State 12345",
    ]);
  });

  it("trims whitespace from each line", () => {
    expect(formatAddress("  123 Street ,  City , State  ")).toEqual([
      "123 Street",
      "City",
      "State",
    ]);
  });

  it("filters out empty lines", () => {
    expect(formatAddress("123 Street,,City")).toEqual(["123 Street", "City"]);
  });
});

describe("scaleLogo", () => {
  it("scales down wide image to fit within bounds", () => {
    const result = scaleLogo(300, 60, 150, 60);
    expect(result.width).toBe(150);
    expect(result.height).toBe(30);
  });

  it("scales down tall image to fit within bounds", () => {
    const result = scaleLogo(60, 120, 150, 60);
    expect(result.width).toBe(30);
    expect(result.height).toBe(60);
  });

  it("scales up image to maximize size within bounds", () => {
    const result = scaleLogo(100, 40, 150, 60);
    // Scale factor: min(150/100, 60/40) = min(1.5, 1.5) = 1.5
    expect(result.width).toBe(150);
    expect(result.height).toBe(60);
  });

  it("preserves aspect ratio", () => {
    const result = scaleLogo(200, 100, 150, 60);
    const originalRatio = 200 / 100;
    const scaledRatio = result.width / result.height;
    expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.001);
  });

  it("at least one dimension touches the boundary", () => {
    const result = scaleLogo(200, 100, 150, 60);
    expect(result.width === 150 || result.height === 60).toBe(true);
  });

  it("returns zero dimensions for zero-size input", () => {
    expect(scaleLogo(0, 100, 150, 60)).toEqual({ width: 0, height: 0 });
    expect(scaleLogo(100, 0, 150, 60)).toEqual({ width: 0, height: 0 });
  });
});

describe("getTaxColumnVisibility", () => {
  it("shows CGST+SGST for intra-state", () => {
    expect(getTaxColumnVisibility("intra-state")).toEqual({
      showCgstSgst: true,
      showIgst: false,
    });
  });

  it("shows IGST for inter-state", () => {
    expect(getTaxColumnVisibility("inter-state")).toEqual({
      showCgstSgst: false,
      showIgst: true,
    });
  });
});

describe("formatBulkZipFilename", () => {
  it("formats date range as YYYYMMDD", () => {
    const start = new Date(2024, 3, 1); // April 1, 2024
    const end = new Date(2024, 3, 30); // April 30, 2024
    expect(formatBulkZipFilename(start, end)).toBe(
      "invoices_20240401_20240430.zip"
    );
  });

  it("pads single-digit months and days", () => {
    const start = new Date(2024, 0, 5); // Jan 5, 2024
    const end = new Date(2024, 8, 9); // Sep 9, 2024
    expect(formatBulkZipFilename(start, end)).toBe(
      "invoices_20240105_20240909.zip"
    );
  });
});
