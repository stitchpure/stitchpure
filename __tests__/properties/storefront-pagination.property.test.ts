/**
 * Property-based tests for Product Storefront pagination.
 * Tests Property 7: Pagination Parameter Clamping from the design document.
 *
 * Feature: product-storefront, Property 7: Pagination clamping
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { storefrontQuerySchema } from '../../validators/storefront.validator';

// --- Generators ---

/** Valid page values: integers >= 1 */
const validPageArb = fc.integer({ min: 1, max: 10000 });

/** Valid limit values: integers in [1, 50] */
const validLimitArb = fc.integer({ min: 1, max: 50 });

/** Page values below minimum (< 1) */
const belowMinPageArb = fc.integer({ min: -10000, max: 0 });

/** Limit values below minimum (< 1) */
const belowMinLimitArb = fc.integer({ min: -10000, max: 0 });

/** Limit values above maximum (> 50) */
const aboveMaxLimitArb = fc.integer({ min: 51, max: 10000 });

/** Non-numeric strings that cannot be coerced to valid numbers */
const nonNumericStringArb = fc
  .string({ minLength: 1 })
  .filter((s) => isNaN(Number(s)) && s.trim().length > 0);

// --- Property Tests ---

describe('Storefront Pagination Property Tests', () => {
  // Feature: product-storefront, Property 7: Pagination Parameter Clamping
  describe('Property 7: Pagination Parameter Clamping', () => {
    it('accepts valid page values (integers >= 1)', () => {
      // **Validates: Requirements 6.5, 9.1, 9.6**
      fc.assert(
        fc.property(validPageArb, (page) => {
          const result = storefrontQuerySchema.safeParse({ page: String(page) });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.page).toBe(page);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('accepts valid limit values (integers in [1, 50])', () => {
      // **Validates: Requirements 6.5, 9.1, 9.6**
      fc.assert(
        fc.property(validLimitArb, (limit) => {
          const result = storefrontQuerySchema.safeParse({ limit: String(limit) });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.limit).toBe(limit);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('accepts combined valid page and limit values', () => {
      // **Validates: Requirements 6.5, 9.1, 9.6**
      fc.assert(
        fc.property(validPageArb, validLimitArb, (page, limit) => {
          const result = storefrontQuerySchema.safeParse({
            page: String(page),
            limit: String(limit),
          });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.page).toBe(page);
            expect(result.data.limit).toBe(limit);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('defaults page to 1 when not provided', () => {
      // **Validates: Requirements 6.5, 9.6**
      const result = storefrontQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('defaults limit to 20 when not provided', () => {
      // **Validates: Requirements 6.5, 9.1**
      const result = storefrontQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('rejects limit values above maximum (> 50)', () => {
      // **Validates: Requirements 6.5, 9.1, 9.6**
      fc.assert(
        fc.property(aboveMaxLimitArb, (limit) => {
          const result = storefrontQuerySchema.safeParse({ limit: String(limit) });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects page values below minimum (< 1)', () => {
      // **Validates: Requirements 6.5, 9.6**
      fc.assert(
        fc.property(belowMinPageArb, (page) => {
          const result = storefrontQuerySchema.safeParse({ page: String(page) });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects limit values below minimum (< 1)', () => {
      // **Validates: Requirements 6.5, 9.1**
      fc.assert(
        fc.property(belowMinLimitArb, (limit) => {
          const result = storefrontQuerySchema.safeParse({ limit: String(limit) });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects non-numeric string inputs for page', () => {
      // **Validates: Requirements 6.5, 9.6**
      fc.assert(
        fc.property(nonNumericStringArb, (page) => {
          const result = storefrontQuerySchema.safeParse({ page });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects non-numeric string inputs for limit', () => {
      // **Validates: Requirements 6.5, 9.1**
      fc.assert(
        fc.property(nonNumericStringArb, (limit) => {
          const result = storefrontQuerySchema.safeParse({ limit });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('parsed limit never exceeds 50 for any valid input', () => {
      // **Validates: Requirements 6.5, 9.1**
      fc.assert(
        fc.property(validLimitArb, (limit) => {
          const result = storefrontQuerySchema.safeParse({ limit: String(limit) });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.limit).toBeLessThanOrEqual(50);
            expect(result.data.limit).toBeGreaterThanOrEqual(1);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('parsed page is always >= 1 for any valid input', () => {
      // **Validates: Requirements 6.5, 9.6**
      fc.assert(
        fc.property(validPageArb, (page) => {
          const result = storefrontQuerySchema.safeParse({ page: String(page) });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.page).toBeGreaterThanOrEqual(1);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('rejects floating point (non-integer) values for page', () => {
      // **Validates: Requirements 6.5, 9.6**
      fc.assert(
        fc.property(
          fc.double({ min: 1.01, max: 100, noNaN: true, noDefaultInfinity: true }).filter(
            (v) => !Number.isInteger(v)
          ),
          (page) => {
            const result = storefrontQuerySchema.safeParse({ page: String(page) });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects floating point (non-integer) values for limit', () => {
      // **Validates: Requirements 6.5, 9.1**
      fc.assert(
        fc.property(
          fc.double({ min: 1.01, max: 50, noNaN: true, noDefaultInfinity: true }).filter(
            (v) => !Number.isInteger(v)
          ),
          (limit) => {
            const result = storefrontQuerySchema.safeParse({ limit: String(limit) });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
