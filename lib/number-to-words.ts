/**
 * Indian numbering system: number-to-words conversion.
 *
 * Converts a numeric amount to words following the Indian numbering system
 * (ones, tens, hundreds, thousands, lakhs, crores).
 * Supports up to 99,99,99,999.99 (99 crores).
 *
 * Output format: "Rupees [amount in words] and [paise] Paise Only"
 * If paise is 0, omits the paise part: "Rupees [amount in words] Only"
 *
 * Requirements: 4.8
 */

const ones: string[] = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens: string[] = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

/**
 * Convert a number from 0 to 99 into words.
 */
function twoDigitWords(n: number): string {
  if (n < 20) return ones[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one === 0 ? tens[ten] : `${tens[ten]} ${ones[one]}`;
}

/**
 * Convert a number from 0 to 999 into words.
 */
function threeDigitWords(n: number): string {
  if (n === 0) return "";
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  if (hundred === 0) return twoDigitWords(remainder);
  if (remainder === 0) return `${ones[hundred]} Hundred`;
  return `${ones[hundred]} Hundred ${twoDigitWords(remainder)}`;
}

/**
 * Convert an integer (0 to 99,99,99,999) to Indian numbering words.
 * Indian system groups: last 3 digits (hundreds), then pairs of 2 (thousands, lakhs, crores).
 */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";

  let result = "";
  // Extract groups from right to left: hundreds (3 digits), then thousands, lakhs, crores (2 digits each)
  const hundreds = n % 1000;
  n = Math.floor(n / 1000);

  const thousands = n % 100;
  n = Math.floor(n / 100);

  const lakhs = n % 100;
  n = Math.floor(n / 100);

  const crores = n % 100;

  const parts: string[] = [];

  if (crores > 0) {
    parts.push(`${twoDigitWords(crores)} Crore`);
  }
  if (lakhs > 0) {
    parts.push(`${twoDigitWords(lakhs)} Lakh`);
  }
  if (thousands > 0) {
    parts.push(`${twoDigitWords(thousands)} Thousand`);
  }
  if (hundreds > 0) {
    parts.push(threeDigitWords(hundreds));
  }

  result = parts.join(" ");
  return result;
}

/**
 * Convert a number to Indian numbering words.
 * Supports up to 99,99,99,999.99 (99 crores).
 * Returns format: "Rupees [amount in words] and [paise] Paise Only"
 * If paise is 0, omits the paise part.
 */
export function numberToIndianWords(amount: number): string {
  // Handle negative amounts by treating as absolute value
  const absAmount = Math.abs(amount);

  // Separate rupees and paise
  const rupees = Math.floor(absAmount);
  // Round paise to avoid floating point issues
  const paise = Math.round((absAmount - rupees) * 100);

  const rupeesInWords = integerToWords(rupees);

  if (paise === 0) {
    return `Rupees ${rupeesInWords} Only`;
  }

  const paiseInWords = integerToWords(paise);
  return `Rupees ${rupeesInWords} and ${paiseInWords} Paise Only`;
}
