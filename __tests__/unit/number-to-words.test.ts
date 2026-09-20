import { describe, it, expect } from "vitest";
import { numberToIndianWords } from "../../lib/number-to-words";

describe("numberToIndianWords", () => {
  it("converts zero amount", () => {
    expect(numberToIndianWords(0)).toBe("Rupees Zero Only");
  });

  it("converts single digit amounts", () => {
    expect(numberToIndianWords(5)).toBe("Rupees Five Only");
    expect(numberToIndianWords(9)).toBe("Rupees Nine Only");
  });

  it("converts teens correctly", () => {
    expect(numberToIndianWords(11)).toBe("Rupees Eleven Only");
    expect(numberToIndianWords(19)).toBe("Rupees Nineteen Only");
  });

  it("converts tens correctly", () => {
    expect(numberToIndianWords(20)).toBe("Rupees Twenty Only");
    expect(numberToIndianWords(99)).toBe("Rupees Ninety Nine Only");
  });

  it("converts hundreds correctly", () => {
    expect(numberToIndianWords(100)).toBe("Rupees One Hundred Only");
    expect(numberToIndianWords(456)).toBe(
      "Rupees Four Hundred Fifty Six Only"
    );
  });

  it("converts thousands (Indian system)", () => {
    expect(numberToIndianWords(1000)).toBe("Rupees One Thousand Only");
    expect(numberToIndianWords(12345)).toBe(
      "Rupees Twelve Thousand Three Hundred Forty Five Only"
    );
    expect(numberToIndianWords(99999)).toBe(
      "Rupees Ninety Nine Thousand Nine Hundred Ninety Nine Only"
    );
  });

  it("converts lakhs (Indian system)", () => {
    expect(numberToIndianWords(100000)).toBe("Rupees One Lakh Only");
    expect(numberToIndianWords(123456)).toBe(
      "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only"
    );
    expect(numberToIndianWords(9900000)).toBe(
      "Rupees Ninety Nine Lakh Only"
    );
  });

  it("converts crores (Indian system)", () => {
    expect(numberToIndianWords(10000000)).toBe("Rupees One Crore Only");
    expect(numberToIndianWords(99_99_99_999)).toBe(
      "Rupees Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine Only"
    );
  });

  it("handles amount with paise", () => {
    expect(numberToIndianWords(100.5)).toBe(
      "Rupees One Hundred and Fifty Paise Only"
    );
    expect(numberToIndianWords(1234.56)).toBe(
      "Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only"
    );
  });

  it("handles zero rupees with paise", () => {
    expect(numberToIndianWords(0.75)).toBe(
      "Rupees Zero and Seventy Five Paise Only"
    );
  });

  it("omits paise when paise is zero", () => {
    expect(numberToIndianWords(500.0)).toBe("Rupees Five Hundred Only");
  });

  it("handles boundary value: 1 paisa", () => {
    expect(numberToIndianWords(0.01)).toBe(
      "Rupees Zero and One Paise Only"
    );
  });

  it("handles boundary value: 99 paise", () => {
    expect(numberToIndianWords(0.99)).toBe(
      "Rupees Zero and Ninety Nine Paise Only"
    );
  });

  it("handles max supported value (99 crores)", () => {
    const result = numberToIndianWords(99_99_99_999.99);
    expect(result).toContain("Rupees");
    expect(result).toContain("Ninety Nine Crore");
    expect(result).toContain("Paise Only");
  });
});
