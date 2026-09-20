/**
 * lib/__tests__/numeric-formatting.property.test.ts
 *
 * Property-based test for numeric formatting precision.
 *
 * Feature: manufacturing-cost-frontend, Property 4: Numeric Formatting Precision
 *
 * **Validates: Requirements 6.2, 11.1**
 *
 * For any valid numeric value and any specified decimal precision (2 or 4),
 * the formatting function produces a string containing exactly the specified
 * number of digits after the decimal point, and parsing that formatted string
 * back to a number yields a value within epsilon of the original.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { formatCurrency } from "../format-currency";

describe("Property 4: Numeric Formatting Precision", () => {
  /**
   * Property 1: Formatted output always has exactly `precision` decimal places.
   *
   * For any valid finite number and precision of 2 or 4, the formatted string
   * must contain a decimal point followed by exactly `precision` digits.
   */
  it("formatted output has exactly the specified number of decimal places", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(2 as const, 4 as const),
        (value, precision) => {
          const formatted = formatCurrency(value, precision);

          // Verify the formatted string contains a decimal point
          const parts = formatted.split(".");
          expect(parts).toHaveLength(2);

          // Verify exactly `precision` digits after the decimal point
          expect(parts[1]).toHaveLength(precision);

          // Verify all characters after decimal are digits
          expect(parts[1]).toMatch(/^\d+$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Round-trip parsing stays within epsilon of the original.
   *
   * For precision 2: |parseFloat(formatted) - original| <= 0.005
   * For precision 4: |parseFloat(formatted) - original| <= 0.00005
   */
  it("round-trip (format then parse) stays within epsilon of the original", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(2 as const, 4 as const),
        (value, precision) => {
          const formatted = formatCurrency(value, precision);
          const parsed = parseFloat(formatted);

          const epsilon = precision === 2 ? 0.005 : 0.00005;
          const difference = Math.abs(parsed - value);

          expect(difference).toBeLessThanOrEqual(epsilon);
        }
      ),
      { numRuns: 100 }
    );
  });
});
