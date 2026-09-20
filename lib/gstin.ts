/**
 * GSTIN (Goods and Services Tax Identification Number) validation utility.
 *
 * GSTIN format: 15 alphanumeric characters
 * - Positions 1-2: State code (01-37)
 * - Positions 3-7: PAN (5 uppercase letters)
 * - Positions 8-11: Entity number (4 digits)
 * - Position 12: Alphabet (A-Z)
 * - Position 13: Alphanumeric (1-9 or A-Z)
 * - Position 14: Fixed "Z"
 * - Position 15: Check digit (0-9 or A-Z)
 */

export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const GSTIN_ERROR_MESSAGE =
  "GSTIN must be exactly 15 characters in format: 22AAAAA0000A1Z5 (2 digits, 5 letters, 4 digits, 1 letter, 1 alphanumeric, Z, 1 alphanumeric)";

export function isValidGstin(value: string): boolean {
  return GSTIN_REGEX.test(value);
}
