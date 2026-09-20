import { describe, it, expect } from "vitest";
import { GSTIN_REGEX, GSTIN_ERROR_MESSAGE, isValidGstin } from "../../lib/gstin";

describe("GSTIN_REGEX", () => {
  it("matches a valid GSTIN", () => {
    expect(GSTIN_REGEX.test("22AAAAA0000A1Z5")).toBe(true);
  });

  it("matches valid GSTIN with different state code", () => {
    expect(GSTIN_REGEX.test("07BBBBB1234B2ZA")).toBe(true);
  });

  it("rejects lowercase letters", () => {
    expect(GSTIN_REGEX.test("22aaaaa0000a1z5")).toBe(false);
  });

  it("rejects strings shorter than 15 characters", () => {
    expect(GSTIN_REGEX.test("22AAAAA0000A1Z")).toBe(false);
  });

  it("rejects strings longer than 15 characters", () => {
    expect(GSTIN_REGEX.test("22AAAAA0000A1Z55")).toBe(false);
  });

  it("rejects zero in position 13 (1-9A-Z only)", () => {
    expect(GSTIN_REGEX.test("22AAAAA0000A0Z5")).toBe(false);
  });

  it("rejects non-Z in position 14", () => {
    expect(GSTIN_REGEX.test("22AAAAA0000A1A5")).toBe(false);
  });
});

describe("GSTIN_ERROR_MESSAGE", () => {
  it("is a non-empty descriptive string", () => {
    expect(GSTIN_ERROR_MESSAGE).toBeTruthy();
    expect(GSTIN_ERROR_MESSAGE.length).toBeGreaterThan(0);
  });
});

describe("isValidGstin", () => {
  it("returns true for valid GSTIN", () => {
    expect(isValidGstin("22AAAAA0000A1Z5")).toBe(true);
  });

  it("returns true for another valid GSTIN", () => {
    expect(isValidGstin("29ABCDE1234F9ZG")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidGstin("")).toBe(false);
  });

  it("returns false for random string", () => {
    expect(isValidGstin("INVALIDGSTIN123")).toBe(false);
  });

  it("returns false for almost-valid GSTIN with wrong position 14", () => {
    expect(isValidGstin("22AAAAA0000A1X5")).toBe(false);
  });
});
