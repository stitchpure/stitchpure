/**
 * Form validation utility
 *
 * Provides client-side validation helpers for manufacturing cost management
 * forms. Validators return `null` for valid input or a `ValidationError`
 * describing the issue. The `validateForm` helper collects all non-null
 * results and `clearFieldError` removes a specific field's error after
 * the user corrects it.
 *
 * Requirements: 3.9, 5.3, 8.13, 10.4, 12.1, 12.2, 12.6
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates that a string value is present and non-empty after trimming.
 * Returns an error if the value is undefined, null, empty, or whitespace-only.
 */
export function validateRequired(
  value: string | undefined | null,
  field: string,
  label: string
): ValidationError | null {
  if (!value || !value.trim()) {
    return { field, message: `${label} is required` };
  }
  return null;
}

/**
 * Validates that a numeric value falls within a specified range (inclusive).
 * Accepts both string and number inputs. Returns an error if the value
 * cannot be parsed as a number or is outside the [min, max] range.
 */
export function validateNumericRange(
  value: string | number | undefined | null,
  field: string,
  label: string,
  min: number,
  max: number
): ValidationError | null {
  if (value === undefined || value === null || value === "") {
    return { field, message: `${label} must be a valid number` };
  }

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { field, message: `${label} must be a valid number` };
  }

  if (num < min || num > max) {
    return { field, message: `${label} must be between ${min} and ${max}` };
  }

  return null;
}

/**
 * Validates the quantity cross-field constraint: produced must equal
 * good + rejected. Returns an error on the "producedQuantity" field
 * if the constraint is violated.
 *
 * Only validates when all three values are provided (non-undefined).
 */
export function validateQuantityMatch(
  produced: number | undefined,
  good: number | undefined,
  rejected: number | undefined
): ValidationError | null {
  if (produced === undefined || good === undefined || rejected === undefined) {
    return null;
  }

  if (produced !== good + rejected) {
    return {
      field: "producedQuantity",
      message:
        "Produced quantity must equal the sum of good quantity and rejected quantity",
    };
  }

  return null;
}

/**
 * Runs an array of validator results and returns only the non-null errors.
 * Use this to collect all validation errors from a form before submission.
 *
 * Example:
 *   const errors = validateForm([
 *     validateRequired(name, 'name', 'Name'),
 *     validateNumericRange(amount, 'amount', 'Amount', 0.01, 99999999.99),
 *   ]);
 */
export function validateForm(
  validators: (ValidationError | null)[]
): ValidationError[] {
  return validators.filter(
    (error): error is ValidationError => error !== null
  );
}

/**
 * Returns a new array with the specified field's error removed.
 * Used to clear inline validation messages when the user corrects a field.
 */
export function clearFieldError(
  errors: ValidationError[],
  field: string
): ValidationError[] {
  return errors.filter((error) => error.field !== field);
}
