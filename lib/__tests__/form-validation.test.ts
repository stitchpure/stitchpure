/**
 * lib/__tests__/form-validation.test.ts
 *
 * Unit tests for lib/form-validation.ts
 *
 * Tests: validateRequired, validateNumericRange, validateQuantityMatch,
 *        validateForm, clearFieldError
 *
 * **Validates: Requirements 3.9, 5.3, 8.13, 10.4, 12.1, 12.2, 12.6**
 */

import { describe, it, expect } from "vitest";
import {
  validateRequired,
  validateNumericRange,
  validateQuantityMatch,
  validateForm,
  clearFieldError,
  ValidationError,
} from "../form-validation";

// ===========================================================================
// validateRequired
// ===========================================================================

describe("validateRequired", () => {
  it("returns null for a non-empty string", () => {
    expect(validateRequired("hello", "name", "Name")).toBeNull();
  });

  it("returns error for undefined", () => {
    const result = validateRequired(undefined, "name", "Name");
    expect(result).toEqual({ field: "name", message: "Name is required" });
  });

  it("returns error for null", () => {
    const result = validateRequired(null, "name", "Name");
    expect(result).toEqual({ field: "name", message: "Name is required" });
  });

  it("returns error for empty string", () => {
    const result = validateRequired("", "name", "Name");
    expect(result).toEqual({ field: "name", message: "Name is required" });
  });

  it("returns error for whitespace-only string", () => {
    const result = validateRequired("   ", "name", "Name");
    expect(result).toEqual({ field: "name", message: "Name is required" });
  });

  it("returns null for string with leading/trailing spaces but non-empty content", () => {
    expect(validateRequired("  hello  ", "name", "Name")).toBeNull();
  });

  it("uses the provided field and label in the error", () => {
    const result = validateRequired("", "startDate", "Start Date");
    expect(result).toEqual({
      field: "startDate",
      message: "Start Date is required",
    });
  });
});

// ===========================================================================
// validateNumericRange
// ===========================================================================

describe("validateNumericRange", () => {
  it("returns null for a number within range", () => {
    expect(validateNumericRange(50, "amount", "Amount", 1, 100)).toBeNull();
  });

  it("returns null for value at minimum boundary", () => {
    expect(validateNumericRange(1, "qty", "Quantity", 1, 999999)).toBeNull();
  });

  it("returns null for value at maximum boundary", () => {
    expect(validateNumericRange(999999, "qty", "Quantity", 1, 999999)).toBeNull();
  });

  it("returns null for valid string number", () => {
    expect(validateNumericRange("42.5", "amount", "Amount", 0.01, 100)).toBeNull();
  });

  it("returns error for undefined", () => {
    const result = validateNumericRange(undefined, "amount", "Amount", 1, 100);
    expect(result).toEqual({
      field: "amount",
      message: "Amount must be a valid number",
    });
  });

  it("returns error for null", () => {
    const result = validateNumericRange(null, "amount", "Amount", 1, 100);
    expect(result).toEqual({
      field: "amount",
      message: "Amount must be a valid number",
    });
  });

  it("returns error for empty string", () => {
    const result = validateNumericRange("", "amount", "Amount", 1, 100);
    expect(result).toEqual({
      field: "amount",
      message: "Amount must be a valid number",
    });
  });

  it("returns error for non-numeric string", () => {
    const result = validateNumericRange("abc", "amount", "Amount", 1, 100);
    expect(result).toEqual({
      field: "amount",
      message: "Amount must be a valid number",
    });
  });

  it("returns error for NaN number", () => {
    const result = validateNumericRange(NaN, "amount", "Amount", 1, 100);
    expect(result).toEqual({
      field: "amount",
      message: "Amount must be a valid number",
    });
  });

  it("returns error for value below minimum", () => {
    const result = validateNumericRange(0, "qty", "Quantity", 1, 999999);
    expect(result).toEqual({
      field: "qty",
      message: "Quantity must be between 1 and 999999",
    });
  });

  it("returns error for value above maximum", () => {
    const result = validateNumericRange(1000000, "qty", "Quantity", 1, 999999);
    expect(result).toEqual({
      field: "qty",
      message: "Quantity must be between 1 and 999999",
    });
  });

  it("returns error for negative value when min is positive", () => {
    const result = validateNumericRange(-5, "amount", "Amount", 0.01, 9999);
    expect(result).toEqual({
      field: "amount",
      message: "Amount must be between 0.01 and 9999",
    });
  });

  it("handles decimal ranges correctly", () => {
    expect(
      validateNumericRange("0.01", "amount", "Amount", 0.01, 9999999.99)
    ).toBeNull();
    expect(
      validateNumericRange("0.009", "amount", "Amount", 0.01, 9999999.99)
    ).toEqual({
      field: "amount",
      message: "Amount must be between 0.01 and 9999999.99",
    });
  });
});

// ===========================================================================
// validateQuantityMatch
// ===========================================================================

describe("validateQuantityMatch", () => {
  it("returns null when produced equals good + rejected", () => {
    expect(validateQuantityMatch(100, 80, 20)).toBeNull();
  });

  it("returns null when all quantities are zero", () => {
    expect(validateQuantityMatch(0, 0, 0)).toBeNull();
  });

  it("returns error when produced does not equal good + rejected", () => {
    const result = validateQuantityMatch(100, 80, 10);
    expect(result).toEqual({
      field: "producedQuantity",
      message:
        "Produced quantity must equal the sum of good quantity and rejected quantity",
    });
  });

  it("returns error when produced is less than good + rejected", () => {
    const result = validateQuantityMatch(50, 40, 20);
    expect(result).toEqual({
      field: "producedQuantity",
      message:
        "Produced quantity must equal the sum of good quantity and rejected quantity",
    });
  });

  it("returns null when produced is undefined (partial data)", () => {
    expect(validateQuantityMatch(undefined, 80, 20)).toBeNull();
  });

  it("returns null when good is undefined (partial data)", () => {
    expect(validateQuantityMatch(100, undefined, 20)).toBeNull();
  });

  it("returns null when rejected is undefined (partial data)", () => {
    expect(validateQuantityMatch(100, 80, undefined)).toBeNull();
  });

  it("returns null when all values are undefined", () => {
    expect(validateQuantityMatch(undefined, undefined, undefined)).toBeNull();
  });
});

// ===========================================================================
// validateForm
// ===========================================================================

describe("validateForm", () => {
  it("returns empty array when all validators pass", () => {
    const result = validateForm([null, null, null]);
    expect(result).toEqual([]);
  });

  it("filters out null values and returns only errors", () => {
    const error1: ValidationError = { field: "name", message: "Name is required" };
    const error2: ValidationError = { field: "amount", message: "Amount must be a valid number" };

    const result = validateForm([error1, null, error2, null]);
    expect(result).toEqual([error1, error2]);
  });

  it("returns all errors when all validators fail", () => {
    const errors: ValidationError[] = [
      { field: "name", message: "Name is required" },
      { field: "amount", message: "Amount is required" },
      { field: "date", message: "Date is required" },
    ];

    const result = validateForm(errors);
    expect(result).toEqual(errors);
  });

  it("returns empty array for empty input", () => {
    expect(validateForm([])).toEqual([]);
  });

  it("works with actual validator functions", () => {
    const result = validateForm([
      validateRequired("", "name", "Name"),
      validateRequired("hello", "desc", "Description"),
      validateNumericRange("abc", "amount", "Amount", 1, 100),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].field).toBe("name");
    expect(result[1].field).toBe("amount");
  });
});

// ===========================================================================
// clearFieldError
// ===========================================================================

describe("clearFieldError", () => {
  const errors: ValidationError[] = [
    { field: "name", message: "Name is required" },
    { field: "amount", message: "Amount must be a valid number" },
    { field: "date", message: "Date is required" },
  ];

  it("removes the specified field's error", () => {
    const result = clearFieldError(errors, "name");
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.field === "name")).toBeUndefined();
  });

  it("preserves errors for other fields", () => {
    const result = clearFieldError(errors, "amount");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ field: "name", message: "Name is required" });
    expect(result[1]).toEqual({ field: "date", message: "Date is required" });
  });

  it("returns original errors when field is not found", () => {
    const result = clearFieldError(errors, "nonexistent");
    expect(result).toEqual(errors);
  });

  it("returns empty array when clearing from single-error array", () => {
    const singleError: ValidationError[] = [
      { field: "name", message: "Name is required" },
    ];
    const result = clearFieldError(singleError, "name");
    expect(result).toEqual([]);
  });

  it("returns empty array when input is empty", () => {
    const result = clearFieldError([], "name");
    expect(result).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const original: ValidationError[] = [
      { field: "name", message: "Name is required" },
      { field: "amount", message: "Amount is required" },
    ];
    const originalCopy = [...original];

    clearFieldError(original, "name");
    expect(original).toEqual(originalCopy);
  });
});
