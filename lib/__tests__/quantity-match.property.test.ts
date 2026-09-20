/**
 * lib/__tests__/quantity-match.property.test.ts
 *
 * Property-based tests for validateQuantityMatch (quantity cross-field constraint).
 *
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateQuantityMatch } from "../form-validation";

describe("Property 3: Quantity Cross-Field Constraint", () => {
  it("returns null when produced === good + rejected", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        (good, rejected) => {
          const produced = good + rejected;
          const result = validateQuantityMatch(produced, good, rejected);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns an error with field 'producedQuantity' when produced !== good + rejected", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer(),
        (produced, good, rejected) => {
          // Only test cases where the constraint is violated
          fc.pre(produced !== good + rejected);
          const result = validateQuantityMatch(produced, good, rejected);
          expect(result).not.toBeNull();
          expect(result!.field).toBe("producedQuantity");
          expect(result!.message).toBe(
            "Produced quantity must equal the sum of good quantity and rejected quantity"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns null when any value is undefined (skip validation)", () => {
    const maybeUndefined = fc.oneof(fc.integer(), fc.constant(undefined));

    fc.assert(
      fc.property(
        maybeUndefined,
        maybeUndefined,
        maybeUndefined,
        (produced, good, rejected) => {
          // Only test cases where at least one value is undefined
          fc.pre(
            produced === undefined ||
            good === undefined ||
            rejected === undefined
          );
          const result = validateQuantityMatch(produced, good, rejected);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
