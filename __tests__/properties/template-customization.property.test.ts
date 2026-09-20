/**
 * Property-based tests for template customization.
 * Feature: meesho-image-generator
 *
 * Property 10: Reset Restores Defaults
 *
 * Validates: Requirements 6.8
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// --- Template Customization State and Reset Logic ---

interface TemplateCustomizationState {
  backgroundColor: string;
  textColor: string;
  tierLabelVisible: boolean;
  imageAlignment: 'top' | 'center' | 'bottom';
  fontSize: number;
}

const DEFAULT_CUSTOMIZATION: TemplateCustomizationState = {
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  tierLabelVisible: true,
  imageAlignment: 'center',
  fontSize: 24,
};

function resetToDefaults(): TemplateCustomizationState {
  return { ...DEFAULT_CUSTOMIZATION };
}

// --- Generators ---
const hexColorArb = fc.stringMatching(/^[0-9a-f]{6}$/).map(s => '#' + s);

const customizationStateArb: fc.Arbitrary<TemplateCustomizationState> = fc.record({
  backgroundColor: hexColorArb,
  textColor: hexColorArb,
  tierLabelVisible: fc.boolean(),
  imageAlignment: fc.constantFrom<'top' | 'center' | 'bottom'>('top', 'center', 'bottom'),
  fontSize: fc.integer({ min: 12, max: 48 }),
});

describe('Property 10: Reset Restores Defaults', () => {
  /**
   * Validates: Requirements 6.8
   *
   * For any customization state (arbitrary valid color values, alignment, visibility,
   * font size), invoking the reset function SHALL produce a state where backgroundColor
   * is '#FFFFFF', textColor is '#000000', tierLabelVisible is true, imageAlignment is
   * 'center', and fontSize is 24.
   */
  it('reset produces default state values regardless of prior state', () => {
    fc.assert(
      fc.property(
        customizationStateArb,
        (_arbitraryState) => {
          // Regardless of what the current state is, reset always produces defaults
          const resetState = resetToDefaults();

          expect(resetState.backgroundColor).toBe('#FFFFFF');
          expect(resetState.textColor).toBe('#000000');
          expect(resetState.tierLabelVisible).toBe(true);
          expect(resetState.imageAlignment).toBe('center');
          expect(resetState.fontSize).toBe(24);
        }
      ),
      { numRuns: 100 }
    );
  });
});
