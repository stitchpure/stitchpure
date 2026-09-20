/**
 * lib/__tests__/validation-error-clearing.property.test.ts
 *
 * Property-based test: Validation Error Clearing on Correction
 *
 * Generates random multi-field error states, then corrects one field.
 * Verifies only the corrected field's error is removed; other errors remain.
 *
 * **Validates: Requirements 12.6**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { clearFieldError, ValidationError } from "../form-validation";

/**
 * Arbitrary that generates a unique field name.
 */
const fieldNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

/**
 * Arbitrary that generates a non-empty error message.
 */
const messageArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/**
 * Arbitrary that generates an array of ValidationError objects with unique field names.
 * Produces 2–10 errors, each with a distinct field name.
 */
const uniqueErrorsArb: fc.Arbitrary<ValidationError[]> = fc
  .uniqueArray(
    fc.record({
      field: fieldNameArb,
      message: messageArb,
    }),
    {
      minLength: 2,
      maxLength: 10,
      selector: (e) => e.field,
    }
  );

/**
 * Arbitrary that generates a random error array and picks one field to correct.
 */
const errorStateWithCorrectedFieldArb = uniqueErrorsArb.chain((errors) =>
  fc.integer({ min: 0, max: errors.length - 1 }).map((index) => ({
    errors,
    correctedField: errors[index].field,
    correctedIndex: index,
  }))
);

describe("Property 6: Validation Error Clearing on Correction", () => {
  const NUM_RUNS = 100;

  it("after clearing, the corrected field's error is not in the result", () => {
    fc.assert(
      fc.property(errorStateWithCorrectedFieldArb, ({ errors, correctedField }) => {
        const result = clearFieldError(errors, correctedField);

        // Property 1: The corrected field should not appear in the result
        const hasField = result.some((e) => e.field === correctedField);
        expect(hasField).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("all other errors remain unchanged (same field + message)", () => {
    fc.assert(
      fc.property(errorStateWithCorrectedFieldArb, ({ errors, correctedField }) => {
        const result = clearFieldError(errors, correctedField);

        // Property 2: All errors for other fields remain with same field+message
        const expectedOthers = errors.filter((e) => e.field !== correctedField);
        expect(result).toEqual(expectedOthers);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("result length is exactly original.length minus count of errors with the corrected field", () => {
    fc.assert(
      fc.property(errorStateWithCorrectedFieldArb, ({ errors, correctedField }) => {
        const result = clearFieldError(errors, correctedField);

        // Property 3: Length is original - count of errors for that field
        const countForField = errors.filter((e) => e.field === correctedField).length;
        expect(result.length).toBe(errors.length - countForField);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("the original array is not mutated", () => {
    fc.assert(
      fc.property(errorStateWithCorrectedFieldArb, ({ errors, correctedField }) => {
        // Property 4: Deep-copy original to compare after operation
        const originalCopy = errors.map((e) => ({ ...e }));
        const originalLength = errors.length;

        clearFieldError(errors, correctedField);

        // The original array must not be mutated
        expect(errors.length).toBe(originalLength);
        expect(errors).toEqual(originalCopy);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
