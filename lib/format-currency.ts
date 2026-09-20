/**
 * Numeric formatting utility for manufacturing cost displays.
 *
 * Formats a number to a fixed number of decimal places:
 * - 2 decimal places: used for expenses and batch cost breakdown
 * - 4 decimal places: used for cost sheet per-unit breakdown
 *
 * Requirements: 6.2, 11.1
 */

/**
 * Formats a numeric value to the specified precision (2 or 4 decimal places).
 * Returns a string representation with exactly `precision` digits after the
 * decimal point.
 */
export function formatCurrency(value: number, precision: 2 | 4): string {
  return value.toFixed(precision);
}
