import { describe, it, expect } from "vitest";
import {
  truncateText,
  formatWholesalePrice,
  generateCallHref,
  generateQueryHref,
  generateWhatsAppHref,
  formatPageRange,
} from "../../lib/storefront-utils";

describe("truncateText", () => {
  it("returns original text when length is within limit", () => {
    expect(truncateText("Hello", 10)).toBe("Hello");
  });

  it("returns original text when length equals limit", () => {
    expect(truncateText("Hello", 5)).toBe("Hello");
  });

  it("truncates and appends ellipsis when text exceeds limit", () => {
    expect(truncateText("Hello World", 5)).toBe("Hello\u2026");
  });

  it("handles empty string", () => {
    expect(truncateText("", 10)).toBe("");
  });

  it("truncates product name at 60 chars", () => {
    const longName = "A".repeat(65);
    const result = truncateText(longName, 60);
    expect(result).toBe("A".repeat(60) + "\u2026");
  });

  it("truncates description at 120 chars", () => {
    const longDesc = "B".repeat(125);
    const result = truncateText(longDesc, 120);
    expect(result).toBe("B".repeat(120) + "\u2026");
  });
});

describe("formatWholesalePrice", () => {
  it("formats integer price with two decimals", () => {
    expect(formatWholesalePrice(150)).toBe("\u20B9150.00 per piece");
  });

  it("formats decimal price with two decimal places", () => {
    expect(formatWholesalePrice(99.5)).toBe("\u20B999.50 per piece");
  });

  it("formats small price", () => {
    expect(formatWholesalePrice(0.01)).toBe("\u20B90.01 per piece");
  });

  it("formats large price", () => {
    expect(formatWholesalePrice(9999999.99)).toBe("\u20B99999999.99 per piece");
  });
});

describe("generateCallHref", () => {
  it("generates tel: href with phone number", () => {
    expect(generateCallHref("+911234567890")).toBe("tel:+911234567890");
  });

  it("handles plain number without country code", () => {
    expect(generateCallHref("1234567890")).toBe("tel:1234567890");
  });
});

describe("generateWhatsAppHref", () => {
  it("returns null when phone is missing", () => {
    expect(generateWhatsAppHref(null, "Silk Saree")).toBeNull();
    expect(generateWhatsAppHref("", "Silk Saree")).toBeNull();
  });

  it("builds wa.me link with digits-only phone and encoded text", () => {
    const result = generateWhatsAppHref("+91 98765-43210", "Silk Saree");
    expect(result).toBe(
      "https://wa.me/919876543210?text=" +
        encodeURIComponent("Hi, I'm interested in wholesale pricing for: Silk Saree")
    );
  });
});

describe("generateQueryHref", () => {
  it("generates mailto href with encoded subject", () => {
    const result = generateQueryHref("seller@example.com", "Silk Saree");
    expect(result).toBe(
      "mailto:seller@example.com?subject=Wholesale%20Inquiry%3A%20Silk%20Saree"
    );
  });

  it("encodes special characters in product name", () => {
    const result = generateQueryHref("a@b.com", "T-Shirt (Red & Blue)");
    expect(result).toBe(
      "mailto:a@b.com?subject=Wholesale%20Inquiry%3A%20T-Shirt%20(Red%20%26%20Blue)"
    );
  });

  it("encodes spaces in product name", () => {
    const result = generateQueryHref("a@b.com", "Cotton Kurta Set");
    expect(result).toBe(
      "mailto:a@b.com?subject=Wholesale%20Inquiry%3A%20Cotton%20Kurta%20Set"
    );
  });
});

describe("formatPageRange", () => {
  it("returns empty string when total is 0", () => {
    expect(formatPageRange(1, 20, 0)).toBe("");
  });

  it("formats first page correctly", () => {
    expect(formatPageRange(1, 20, 85)).toBe("Showing 1\u201320 of 85 products");
  });

  it("formats middle page correctly", () => {
    expect(formatPageRange(2, 20, 85)).toBe("Showing 21\u201340 of 85 products");
  });

  it("formats last page with fewer items", () => {
    expect(formatPageRange(5, 20, 85)).toBe("Showing 81\u201385 of 85 products");
  });

  it("handles single page with fewer items than limit", () => {
    expect(formatPageRange(1, 20, 5)).toBe("Showing 1\u20135 of 5 products");
  });
});
