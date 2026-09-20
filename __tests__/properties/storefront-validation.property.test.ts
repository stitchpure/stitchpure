/**
 * Property-based tests for Product Storefront validation.
 * Tests Property 5: Wholesale Price Validation from the design document.
 *
 * Feature: product-storefront, Property 5: Wholesale price validation
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createStorefrontListingSchema,
  updateStorefrontListingSchema,
} from '../../validators/storefront.validator';

// --- Generators ---

/** Constrain a double to 2 decimal places */
function to2dp(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Valid wholesale prices: [0.01, 9999999999.99] */
const validWholesalePriceArb = fc
  .double({ min: 0.01, max: 9999999999.99, noNaN: true, noDefaultInfinity: true })
  .map(to2dp)
  .filter((v) => v >= 0.01 && v <= 9999999999.99);

/** Prices that are zero or negative (≤ 0) */
const zeroOrNegativePriceArb = fc
  .double({ min: -9999999999.99, max: 0, noNaN: true, noDefaultInfinity: true })
  .map(to2dp);

/** Prices that exceed the maximum (> 9999999999.99) */
const tooHighPriceArb = fc
  .double({ min: 10000000000, max: 99999999999.99, noNaN: true, noDefaultInfinity: true })
  .map(to2dp)
  .filter((v) => v > 9999999999.99);

/** Valid UUID for productId field */
const validUuidArb = fc.uuid();

// --- Property Tests ---

describe('Storefront Validation Property Tests', () => {
  // Feature: product-storefront, Property 5: Wholesale Price Validation
  describe('Property 5: Wholesale Price Validation', () => {
    it('accepts wholesale prices within [0.01, 9999999999.99] for create schema', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      fc.assert(
        fc.property(validWholesalePriceArb, validUuidArb, (price, productId) => {
          const result = createStorefrontListingSchema.safeParse({
            productId,
            wholesalePrice: price,
            isVisible: false,
          });
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('accepts wholesale prices within [0.01, 9999999999.99] for update schema', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      fc.assert(
        fc.property(validWholesalePriceArb, (price) => {
          const result = updateStorefrontListingSchema.safeParse({
            wholesalePrice: price,
          });
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects zero or negative wholesale prices for create schema', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      fc.assert(
        fc.property(zeroOrNegativePriceArb, validUuidArb, (price, productId) => {
          const result = createStorefrontListingSchema.safeParse({
            productId,
            wholesalePrice: price,
            isVisible: false,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects zero or negative wholesale prices for update schema', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      fc.assert(
        fc.property(zeroOrNegativePriceArb, (price) => {
          const result = updateStorefrontListingSchema.safeParse({
            wholesalePrice: price,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects wholesale prices exceeding 9999999999.99 for create schema', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      fc.assert(
        fc.property(tooHighPriceArb, validUuidArb, (price, productId) => {
          const result = createStorefrontListingSchema.safeParse({
            productId,
            wholesalePrice: price,
            isVisible: false,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects wholesale prices exceeding 9999999999.99 for update schema', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      fc.assert(
        fc.property(tooHighPriceArb, (price) => {
          const result = updateStorefrontListingSchema.safeParse({
            wholesalePrice: price,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects exactly zero as a wholesale price', () => {
      // **Validates: Requirements 4.3, 7.5**
      const createResult = createStorefrontListingSchema.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        wholesalePrice: 0,
        isVisible: false,
      });
      expect(createResult.success).toBe(false);

      const updateResult = updateStorefrontListingSchema.safeParse({
        wholesalePrice: 0,
      });
      expect(updateResult.success).toBe(false);
    });

    it('accepts boundary value 0.01 (minimum valid price)', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      const createResult = createStorefrontListingSchema.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        wholesalePrice: 0.01,
        isVisible: false,
      });
      expect(createResult.success).toBe(true);

      const updateResult = updateStorefrontListingSchema.safeParse({
        wholesalePrice: 0.01,
      });
      expect(updateResult.success).toBe(true);
    });

    it('accepts boundary value 9999999999.99 (maximum valid price)', () => {
      // **Validates: Requirements 4.3, 5.3, 7.5**
      const createResult = createStorefrontListingSchema.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        wholesalePrice: 9999999999.99,
        isVisible: false,
      });
      expect(createResult.success).toBe(true);

      const updateResult = updateStorefrontListingSchema.safeParse({
        wholesalePrice: 9999999999.99,
      });
      expect(updateResult.success).toBe(true);
    });
  });
});
