# Implementation Plan: Meesho Profit Calculator

## Overview

Client-side profit calculator integrated into the existing dashboard. Pure calculation engine with no new database tables or API routes. Uses localStorage for state and shipping fee persistence. Integrates with existing product/cost-sheet APIs for auto-populating manufacturing costs.

## Tasks

- [x] 1. Create utility modules (calculator engine, validators, shipping defaults)
  - [x] 1.1 Create `lib/shipping-defaults.ts` with default shipping fee lookup table
    - Export `ShippingFeeTable` type and `DEFAULT_SHIPPING_FEES` constant with all 18 weight-slab/zone combinations
    - Export `lookupShippingFee(table, weightSlab, zone)` pure function
    - Export `WeightSlab`, `DeliveryZone` types
    - _Requirements: 5.3, 5.4, 11.6_

  - [x] 1.2 Create `lib/calculator-validators.ts` with input validation logic
    - Export `ValidationRule` interface and `validateInput` function
    - Export `validateAllInputs(inputs)` returning `Record<string, string>` of field→error
    - Validation rules: commission 0-50, return rate 0-100, product loss 0-100, selling price 0.01-99999999.99, manufacturing cost 0.01-9999999999.9999, target margin 0-999, shipping fee override 0-99999.99
    - Return descriptive error strings for out-of-range values
    - _Requirements: 1.5, 3.2, 3.4, 5.6, 6.5, 6.6, 6.7_

  - [x] 1.3 Create `lib/calculator-engine.ts` with pure calculation functions
    - Export all types: `CalculatorMode`, `WeightSlab`, `DeliveryZone`, `GSTRate`, `CalculatorInputs`, `CostBreakdown`, `ProfitModeResult`, `ListingPriceModeResult`, `CalculationError`, `CalculationResult`
    - Implement `computeEffectiveSellingPrice`, `computeMeeshoCommission`, `computeGSTOnSellingPrice`, `computeInputTaxCredit`, `computeNetGSTLiability`, `computeReturnShippingCost`, `computeProductLossCost`
    - Implement `calculateProfitMode(inputs)` → profit breakdown with net profit formula
    - Implement `calculateListingPriceMode(inputs)` → recommended selling price with achievability check
    - All monetary outputs rounded to 2 decimal places
    - Return `CalculationError` with missing fields when inputs incomplete
    - Return `target-not-achievable` error when deduction rate ≥ 1
    - _Requirements: 3.3, 4.2, 4.3, 4.4, 4.5, 4.6, 6.3, 6.4, 7.1, 7.2, 7.4, 8.1, 8.2, 8.5_

  - [ ]* 1.4 Write property tests for calculator validators (`__tests__/properties/calculator-validators.property.test.ts`)
    - **Property 1: Input Validation Rejects Out-of-Range Values**
    - **Validates: Requirements 1.5, 3.2, 3.4, 5.6, 6.5, 6.6, 6.7**

  - [ ]* 1.5 Write property tests for shipping fee lookup (`__tests__/properties/calculator-engine.property.test.ts` — Property 5)
    - **Property 5: Shipping Fee Lookup Correctness**
    - **Validates: Requirements 5.4**

  - [ ]* 1.6 Write property tests for commission computation
    - **Property 3: Commission Computation Formula**
    - **Validates: Requirements 3.3**

  - [ ]* 1.7 Write property tests for GST computation chain
    - **Property 4: GST Computation Chain**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [ ]* 1.8 Write property tests for return and loss cost formulas
    - **Property 6: Return and Loss Cost Formulas**
    - **Validates: Requirements 6.3, 6.4, 6.8, 6.9**

- [x] 2. Checkpoint - Ensure calculation engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create property tests for profit mode and listing price mode
  - [x]* 3.1 Write property tests for profit mode net profit formula
    - **Property 7: Profit Mode Net Profit Formula**
    - **Validates: Requirements 7.1, 7.7**

  - [x]* 3.2 Write property tests for monetary output rounding
    - **Property 8: All Monetary Outputs Rounded to 2 Decimal Places**
    - **Validates: Requirements 4.6, 7.2, 7.4, 8.3**

  - [x]* 3.3 Write property tests for component percentage of selling price
    - **Property 9: Component Percentage of Selling Price**
    - **Validates: Requirements 7.3, 9.2**

  - [x]* 3.4 Write property tests for missing inputs error
    - **Property 10: Missing Inputs Produces Error with Field Names**
    - **Validates: Requirements 7.6**

  - [x]* 3.5 Write property tests for listing price mode margin round-trip
    - **Property 11: Listing Price Mode Margin Round-Trip**
    - **Validates: Requirements 8.1**

  - [x]* 3.6 Write property tests for listing price mode absolute profit round-trip
    - **Property 12: Listing Price Mode Absolute Profit Round-Trip**
    - **Validates: Requirements 8.2**

  - [x]* 3.7 Write property tests for unachievable target detection
    - **Property 13: Unachievable Target Detection**
    - **Validates: Requirements 8.5**

- [x] 4. Create custom hooks (useDebounce, useLocalStorage, useCalculator)
  - [x] 4.1 Create `hooks/useDebounce.ts` hook
    - Generic debounce hook with 300ms default delay
    - Returns debounced value that updates after specified delay of inactivity
    - _Requirements: 7.5, 8.4_

  - [x] 4.2 Create `hooks/useLocalStorage.ts` hook
    - Typed localStorage read/write with JSON parse error handling
    - On corrupt/invalid data: discard stored key and return default value
    - Scope storage keys by company ID pattern: `meesho-calc-{type}-{companyId}`
    - _Requirements: 11.5, 12.1, 12.2, 12.3_

  - [x] 4.3 Create `hooks/useCalculator.ts` hook
    - Manage calculator state: mode, all inputs, validation errors, result
    - Use `useDebounce` to trigger recalculation after 300ms of input inactivity
    - Use `useLocalStorage` to persist/restore calculator state
    - Mode switch preserves inputs per mode (separate state for each mode's specific fields)
    - Fetch product cost sheet via existing API client when product selected
    - Call `validateAllInputs` before calculation; store errors in state
    - Call `calculateProfitMode` or `calculateListingPriceMode` based on current mode
    - Expose `setMode`, `setInput`, `setProduct`, `reset` actions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 2.5, 2.6, 7.5, 7.6, 8.4, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 4.4 Write property tests for localStorage round-trip (`__tests__/properties/calculator-storage.property.test.ts`)
    - **Property 14: Shipping Fee Table LocalStorage Round-Trip**
    - **Validates: Requirements 11.5**

  - [ ]* 4.5 Write property tests for calculator state round-trip
    - **Property 15: Calculator State LocalStorage Round-Trip**
    - **Validates: Requirements 12.1, 12.2**

  - [ ]* 4.6 Write property tests for mode switch preservation (`__tests__/properties/calculator-state.property.test.ts`)
    - **Property 2: Mode Switch Preserves All Input Values**
    - **Validates: Requirements 1.4**

- [x] 5. Checkpoint - Ensure hooks and storage property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create UI components for the calculator
  - [x] 6.1 Create `components/calculator/ModeSelector.tsx`
    - Two-option toggle (Listing Price Mode / Profit Mode)
    - Keyboard navigable, aria-label on buttons
    - Default to Listing Price Mode
    - Calls `setMode` from useCalculator
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 6.2 Create `components/calculator/ProductSelector.tsx`
    - Dropdown listing products from `/api/products?page=N&limit=50`
    - Pagination controls when >50 products
    - On selection: fetch active cost sheet and populate manufacturing cost
    - Handle empty list, API error, and timeout (5s AbortController)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 6.3 Create `components/calculator/InputPanel.tsx`
    - Grouped input fields: Manufacturing Cost, Meesho Commission %, GST Rate selector, Weight Slab, Delivery Zone, Shipping Fee (with override), Return Rate %, Product Loss Rate %
    - Mode-specific fields: Selling Price (Profit Mode), Target Margin % / Target Net Profit ₹ (Listing Price Mode)
    - Inline validation error display below each field
    - Input type="number" with appropriate step/min/max attributes
    - Accessible labels for all fields
    - _Requirements: 1.2, 1.3, 2.4, 3.1, 3.4, 3.5, 4.1, 5.1, 5.2, 5.5, 5.6, 5.7, 6.1, 6.2, 6.5, 6.6, 6.7_

  - [x] 6.4 Create `components/calculator/ShippingFeeConfig.tsx`
    - Expandable panel/modal with 6×3 grid for all 18 weight/zone combinations
    - Editable cells with validation (0.00-9999.99, 2dp)
    - Save button persists to localStorage; disabled if any cell invalid
    - Restore Defaults button resets to `DEFAULT_SHIPPING_FEES`
    - Success confirmation on save
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 6.5 Create `components/calculator/ResultsBreakdown.tsx`
    - Structured breakdown sections: Revenue, Platform Fees, Taxes, Logistics, Returns & Losses, Net Profit
    - Each component shows rupee value (2dp) and percentage of selling price (2dp)
    - Summary card with prominent Net Profit display
    - Green/red styling for profit/loss plus text indicator (not color-only)
    - Shows recommended selling price in Listing Price Mode
    - Displays "Target not achievable" message when applicable
    - _Requirements: 7.2, 7.3, 7.7, 8.3, 8.5, 9.1, 9.2, 9.3, 9.4_

- [x] 7. Create calculator page and integrate sidebar navigation
  - [x] 7.1 Create `app/(dashboard)/meesho-calculator/page.tsx`
    - Client component ('use client') composing all calculator sub-components
    - Initialize `useCalculator` hook and pass state/actions to children
    - Include Reset button that calls `reset()` and clears localStorage
    - Layout: ModeSelector → ProductSelector → InputPanel → ShippingFeeConfig → ResultsBreakdown
    - _Requirements: 1.1, 10.2, 12.4_

  - [x] 7.2 Add "Meesho Calculator" link to sidebar under "Tools" section
    - Add `{ label: 'Meesho Calculator', href: '/meesho-calculator' }` to the Tools section in `components/layout/Sidebar.tsx`
    - No role restriction (all roles can access)
    - Active state highlighting when on `/meesho-calculator` route
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 8. Write unit tests for calculator engine and integration
  - [x]* 8.1 Write unit tests for calculator engine (`__tests__/unit/calculator-engine.test.ts`)
    - Known-answer tests for each formula with specific numeric examples
    - Edge cases: zero manufacturing cost, zero shipping fee, 0% commission, max GST rate
    - Negative profit scenario verification
    - _Requirements: 4.5, 6.8, 6.9, 7.1, 7.7_

  - [x]* 8.2 Write unit tests for validators (`__tests__/unit/calculator-validators.test.ts`)
    - Boundary value tests for each field (at min, at max, just below min, just above max)
    - Non-numeric rejection test
    - _Requirements: 1.5, 3.4, 5.6, 6.7_

  - [x]* 8.3 Write unit tests for shipping defaults (`__tests__/unit/shipping-defaults.test.ts`)
    - Default table has all 18 entries
    - All values are positive numbers with ≤ 2 decimal places
    - Lookup returns correct values for each combination
    - _Requirements: 5.3, 5.4, 11.6_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate 15 universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The calculator is entirely client-side; no new API routes or DB migrations needed
- The existing `apiClient` in `lib/api-client.ts` is used for product/cost-sheet fetches
- The sidebar nav link goes in the existing `NAV_SECTIONS` Tools section in `components/layout/Sidebar.tsx`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "1.7", "1.8", "4.1", "4.2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "4.3"] },
    { "id": 4, "tasks": ["4.4", "4.5", "4.6"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 6, "tasks": ["7.1", "7.2"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```
