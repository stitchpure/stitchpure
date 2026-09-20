/**
 * lib/__tests__/required-field-validation.property.test.ts
 *
 * Property-based test: Required Field Validation Prevents Submission
 *
 * Generates random form states with 0+ empty required fields for batch,
 * expense, and cost sheet forms. Verifies each empty required field gets
 * an error; non-empty fields don't; overall result blocks submission.
 *
 * **Validates: Requirements 3.9, 8.13, 10.4, 12.1**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateRequired, validateForm } from "../form-validation";

/**
 * Arbitrary that produces an "empty" value: undefined, null, empty string,
 * or whitespace-only string.
 */
const emptyValueArb: fc.Arbitrary<string | undefined | null> = fc.oneof(
  fc.constant(undefined as string | undefined | null),
  fc.constant(null as string | undefined | null),
  fc.constant("" as string | undefined | null),
  fc.constantFrom("  ", " ", "   ", "\t", " \t ") as fc.Arbitrary<string | undefined | null>
);

/**
 * Arbitrary that produces a valid non-empty string (at least one non-whitespace char).
 */
const nonEmptyStringArb: fc.Arbitrary<string | undefined | null> = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0) as fc.Arbitrary<string | undefined | null>;

/**
 * Arbitrary for a single field value: either empty (should fail validation)
 * or non-empty (should pass validation).
 */
const fieldValueArb: fc.Arbitrary<{ value: string | undefined | null; shouldBeEmpty: boolean }> =
  fc.oneof(
    emptyValueArb.map((value) => ({ value, shouldBeEmpty: true })),
    nonEmptyStringArb.map((value) => ({ value, shouldBeEmpty: false }))
  );

// Form field definitions for the three forms
interface FormFieldDef {
  field: string;
  label: string;
}

const batchFormFields: FormFieldDef[] = [
  { field: "product", label: "Product" },
  { field: "sku", label: "SKU" },
  { field: "plannedQuantity", label: "Planned Quantity" },
  { field: "startDate", label: "Start Date" },
];

const expenseFormFields: FormFieldDef[] = [
  { field: "name", label: "Name" },
  { field: "amount", label: "Amount" },
  { field: "category", label: "Category" },
  { field: "expenseDate", label: "Expense Date" },
];

const costSheetFormFields: FormFieldDef[] = [
  { field: "batchId", label: "Batch" },
  { field: "effectiveDate", label: "Effective Date" },
];

/**
 * Creates an arbitrary that generates a form state for a given set of fields.
 * Each field is independently either a valid non-empty value or an empty value.
 */
function formStateArb(fields: FormFieldDef[]) {
  return fc.tuple(...fields.map(() => fieldValueArb)).map((values) =>
    fields.map((fieldDef, i) => ({
      ...fieldDef,
      value: values[i].value,
      shouldBeEmpty: values[i].shouldBeEmpty,
    }))
  );
}

describe("Property 2: Required Field Validation Prevents Submission", () => {
  const NUM_RUNS = 100;

  describe("Create Batch form", () => {
    it("validates all required fields correctly across random states", () => {
      fc.assert(
        fc.property(formStateArb(batchFormFields), (formState) => {
          const validators = formState.map((f) =>
            validateRequired(f.value, f.field, f.label)
          );
          const errors = validateForm(validators);

          // Each empty field must produce an error
          for (const f of formState) {
            const result = validateRequired(f.value, f.field, f.label);
            if (f.shouldBeEmpty) {
              expect(result).not.toBeNull();
              expect(result!.field).toBe(f.field);
            } else {
              expect(result).toBeNull();
            }
          }

          // Overall: if any field is empty, errors array is non-empty (blocks submission)
          const hasEmptyField = formState.some((f) => f.shouldBeEmpty);
          if (hasEmptyField) {
            expect(errors.length).toBeGreaterThan(0);
          } else {
            expect(errors).toHaveLength(0);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Create Expense form", () => {
    it("validates all required fields correctly across random states", () => {
      fc.assert(
        fc.property(formStateArb(expenseFormFields), (formState) => {
          const validators = formState.map((f) =>
            validateRequired(f.value, f.field, f.label)
          );
          const errors = validateForm(validators);

          // Each empty field must produce an error
          for (const f of formState) {
            const result = validateRequired(f.value, f.field, f.label);
            if (f.shouldBeEmpty) {
              expect(result).not.toBeNull();
              expect(result!.field).toBe(f.field);
            } else {
              expect(result).toBeNull();
            }
          }

          // Overall: if any field is empty, errors array is non-empty (blocks submission)
          const hasEmptyField = formState.some((f) => f.shouldBeEmpty);
          if (hasEmptyField) {
            expect(errors.length).toBeGreaterThan(0);
          } else {
            expect(errors).toHaveLength(0);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Create Cost Sheet form", () => {
    it("validates all required fields correctly across random states", () => {
      fc.assert(
        fc.property(formStateArb(costSheetFormFields), (formState) => {
          const validators = formState.map((f) =>
            validateRequired(f.value, f.field, f.label)
          );
          const errors = validateForm(validators);

          // Each empty field must produce an error
          for (const f of formState) {
            const result = validateRequired(f.value, f.field, f.label);
            if (f.shouldBeEmpty) {
              expect(result).not.toBeNull();
              expect(result!.field).toBe(f.field);
            } else {
              expect(result).toBeNull();
            }
          }

          // Overall: if any field is empty, errors array is non-empty (blocks submission)
          const hasEmptyField = formState.some((f) => f.shouldBeEmpty);
          if (hasEmptyField) {
            expect(errors.length).toBeGreaterThan(0);
          } else {
            expect(errors).toHaveLength(0);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
