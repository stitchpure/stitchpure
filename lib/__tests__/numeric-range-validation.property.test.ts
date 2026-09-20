/**
 * lib/__tests__/numeric-range-validation.property.test.ts
 *
 * Property-based tests for validateNumericRange (numeric range validation).
 *
 * **Validates: Requirements 12.2**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateNumericRange } from "../form-validation";

describe("Property 5: Numeric Range Validation", () => {
  it("returns null for a number within [min, max]", () => {
    fc.assert(
      fc.property(
        // Generate two finite doubles for bounds, then derive min/max
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (a, b) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          // Generate a value within [min, max]
          const value = min + Math.random() * (max - min);
          const result = validateNumericRange(value, "field", "Field", min, max);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns null for a valid number within range (using fc for value)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (a, b, t) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          // Interpolate a value within [min, max]
          const value = min + t * (max - min);
          const result = validateNumericRange(value, "amount", "Amount", min, max);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns an error for a number below min", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: Number.MIN_VALUE, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (a, b, offset) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          // Value strictly below min
          const value = min - offset;
          fc.pre(value < min);
          const result = validateNumericRange(value, "amount", "Amount", min, max);
          expect(result).not.toBeNull();
          expect(result!.field).toBe("amount");
          expect(result!.message).toBe(`Amount must be between ${min} and ${max}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns an error for a number above max", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: Number.MIN_VALUE, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (a, b, offset) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          // Value strictly above max
          const value = max + offset;
          fc.pre(value > max);
          const result = validateNumericRange(value, "amount", "Amount", min, max);
          expect(result).not.toBeNull();
          expect(result!.field).toBe("amount");
          expect(result!.message).toBe(`Amount must be between ${min} and ${max}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns an error for non-numeric strings (NaN after parsing)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => isNaN(parseFloat(s))),
        (nonNumericStr) => {
          const result = validateNumericRange(nonNumericStr, "price", "Price", 0, 1000);
          expect(result).not.toBeNull();
          expect(result!.field).toBe("price");
          expect(result!.message).toBe("Price must be a valid number");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns an error for undefined, null, or empty string", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.constant("")
        ),
        (emptyValue) => {
          const result = validateNumericRange(
            emptyValue as string | number | undefined | null,
            "qty",
            "Quantity",
            1,
            999999
          );
          expect(result).not.toBeNull();
          expect(result!.field).toBe("qty");
          expect(result!.message).toBe("Quantity must be a valid number");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns null for valid numeric strings within range", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (num) => {
          const value = num.toString();
          const result = validateNumericRange(value, "amount", "Amount", 0, 1e6);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
