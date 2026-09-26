# Implementation Plan: Meesho Image Generator

## Overview

Implement a client-side Meesho product listing image generator using HTML5 Canvas. The tool composites source images onto tier-specific templates (6 shipping weight slabs), overlays product name and pricing text, and outputs 1080×1080 PNG files. Supports batch generation with ZIP download and persists generation history in localStorage. All rendering is browser-side — no new API routes required.

## Tasks

- [x] 1. Set up utility modules and core interfaces
  - [x] 1.1 Create tier template definitions
    - Create `lib/tier-templates.ts` with `WeightSlab` type, `TierTemplate` interface, `TIER_TEMPLATES` config (layout positions, areas for 1080×1080 canvas), `WEIGHT_SLABS` array, and `TIER_COLORS` mapping for all 6 tiers
    - Define image area, text area, price area, and tier label area coordinates for each template
    - _Requirements: 1.1, 1.2, 4.3, 6.3_

  - [x] 1.2 Create image validation utilities
    - Create `lib/image-validators.ts` with `validateImageFile()`, `validateProductName()`, `validatePrice()`, and `validateGenerationInputs()` functions
    - Implement file size check (max 10MB), format check (PNG/JPEG/WebP), and resolution check (min 200×200)
    - Implement product name validation (1-80 chars), price validation (1-999999 range)
    - Export constants: `MAX_FILE_SIZE_BYTES`, `MIN_RESOLUTION`, `SUPPORTED_FORMATS`
    - _Requirements: 2.1, 2.6, 3.1, 3.7_

  - [x] 1.3 Create filename generator utilities
    - Create `lib/filename-generator.ts` with `sanitizeFilename()`, `generateFilename()`, and `deduplicateFilenames()` functions
    - Implement lowercase conversion, space-to-hyphen replacement, special character removal, 50-char truncation
    - Implement deduplication by appending numeric suffix starting at 2 for duplicates
    - _Requirements: 4.4, 5.4_

  - [x] 1.4 Create image compositor engine
    - Create `lib/image-compositor.ts` with `compositeImage()`, `truncateText()`, and `calculateCoverDimensions()` functions
    - Implement canvas creation at 1080×1080, background fill, source image placement with cover scaling, text rendering with truncation/ellipsis, price and MRP rendering, tier label badge rendering
    - Implement iterative quality reduction if output exceeds 2MB (0.9 → 0.7 → 0.5)
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 3.3, 3.4_

  - [x] 1.5 Create generation history manager
    - Create `lib/generation-history.ts` with `saveGenerationRecord()`, `getGenerationHistory()`, `clearHistory()`, `cleanupStorage()`, and `formatRelativeTime()` functions
    - Scope localStorage key by company ID: `meesho-images-history-{companyId}`
    - Implement max 20 records limit, 10MB storage limit with oldest-first cleanup
    - Implement relative time formatting (e.g., "2 hours ago")
    - _Requirements: 9.1, 9.2, 9.5, 9.6_

- [ ] 2. Checkpoint - Ensure utility modules compile and pass lint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement property-based tests for utility modules
  - [x]* 3.1 Write property tests for file validation (Properties 1, 3)
    - **Property 1: File Validation Correctness** — For any file metadata, validation accepts if and only if size ≤ 10MB AND type is supported AND dimensions ≥ 200×200
    - **Property 3: Text and Price Input Validation** — For any product name and price, validation accepts name iff length in [1,80] and price iff in [1, 999999]
    - **Validates: Requirements 2.1, 2.6, 3.1, 3.7**
    - Create `__tests__/properties/image-validators.property.test.ts`

  - [x]* 3.2 Write property tests for filename generator (Property 7)
    - **Property 7: Filename Sanitization and Deduplication** — Sanitized filenames are lowercase, spaces→hyphens, non-alphanumeric removed, max 50 chars; deduplication ensures uniqueness with numeric suffixes
    - **Validates: Requirements 4.4, 5.4**
    - Create `__tests__/properties/filename-generator.property.test.ts`

  - [x]* 3.3 Write property tests for image compositor (Properties 4, 5, 6, 8)
    - **Property 4: Text Truncation with Ellipsis** — If text exceeds max width, output ends with "…" and fits; if it fits, returned unchanged
    - **Property 5: Output Image Dimensions Invariant** — Output canvas always 1080×1080
    - **Property 6: Tier Color Uniqueness** — All 6 tier colors are distinct
    - **Property 8: Image Cover Scaling Calculation** — Cover dimensions fill target, maintain aspect ratio, don't exceed source
    - **Validates: Requirements 3.3, 4.2, 4.3, 4.6**
    - Create `__tests__/properties/image-compositor.property.test.ts`

  - [x]* 3.4 Write property tests for batch processing and history (Properties 2, 9, 10, 11, 12, 13)
    - **Property 2: Category Filtering** — Filters to categories with non-null, non-empty bannerImage, preserving order
    - **Property 9: Batch Generation Count** — N images × M templates = N×M tasks, never exceeds 120
    - **Property 10: Reset Restores Defaults** — Reset produces default state values
    - **Property 11: Generation History Round-Trip** — Save then retrieve returns identical record
    - **Property 12: Relative Time Formatting** — Returns human-readable past-tense string
    - **Property 13: Storage Cleanup Maintains Size Limit** — Removes oldest-first until under 10MB
    - **Validates: Requirements 2.2, 5.1, 5.5, 6.8, 7.1, 9.1, 9.2, 9.6**
    - Create `__tests__/properties/generation-history.property.test.ts` and `__tests__/properties/batch-processor.property.test.ts` and `__tests__/properties/template-customization.property.test.ts`

- [x] 4. Implement UI components
  - [x] 4.1 Create TemplateSelector component
    - Create `components/image-generator/TemplateSelector.tsx` with a grid of 6 tier template cards
    - Implement multi-select with visual border highlight on selected templates
    - Show preview thumbnail (min 120×120px) with layout structure, tier label position, and color scheme
    - Use `role="listbox"` with `aria-multiselectable="true"` for accessibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 4.2 Create SourceImageInput component
    - Create `components/image-generator/SourceImageInput.tsx` with drag-and-drop upload area
    - Support PNG, JPEG, WebP with validation on drop/select
    - Show category dropdown (filtered to categories with banner_image) using existing `/api/categories` endpoint
    - Display 300×300 preview area with object-fit contain behavior
    - Support multiple images (up to 20) with remove button per image
    - Handle banner image load failures with error message and manual upload prompt
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 4.3 Create TextOverlayConfig component
    - Create `components/image-generator/TextOverlayConfig.tsx` with product name input (required, max 80 chars), selling price input (required, numeric ₹1-₹9,99,999), optional MRP input
    - Display warning when selling price > MRP (non-blocking)
    - Include font size selector (12-48px range, default 24px)
    - All inputs have associated `<label>` elements
    - _Requirements: 3.1, 3.5, 3.6, 3.7_

  - [x] 4.4 Create TemplateCustomization component
    - Create `components/image-generator/TemplateCustomization.tsx` with color pickers for background (default #FFFFFF), text (default #000000), and tier label color (per-tier defaults)
    - Add tier label visibility toggle (default visible)
    - Add source image vertical alignment selector (top/center/bottom, default center)
    - Add "Reset to Defaults" button
    - Color pickers have text labels and hex value display
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8_

  - [x] 4.5 Create CanvasPreview component
    - Create `components/image-generator/CanvasPreview.tsx` with live preview canvas
    - Update preview within 500ms on text input changes and 300ms on color/position changes
    - Show the most recently selected template's layout when multiple are selected
    - Image previews have meaningful `alt` text
    - _Requirements: 1.4, 3.2, 6.4_

  - [x] 4.6 Create BatchControls component
    - Create `components/image-generator/BatchControls.tsx` with Generate button, progress indicator, Cancel button, and Download All button
    - Show progress as "5 / 24" format with `role="progressbar"` and `aria-valuenow`
    - Disable generate button and show message when batch exceeds 120 images
    - Package completed images into ZIP via JSZip on "Download All"
    - Cancel stops after current image, makes completed images available
    - Show failure summary on completion if any images failed
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 4.7 Create HistoryPanel component
    - Create `components/image-generator/HistoryPanel.tsx` showing last 20 generation records
    - Display thumbnail, product name, tier label, relative timestamp (full date on hover)
    - Click record to re-render using stored config; show download button after re-render
    - Handle missing source image with message and upload prompt
    - Add "Clear History" button with confirmation prompt
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 4.8 Create CategoryModePanel component
    - Create `components/image-generator/CategoryModePanel.tsx` with category list (banner_image thumbnails)
    - Fetch products from `/api/products` filtered by category (up to 100) with checkboxes
    - Show messages for empty categories or missing banner images
    - Validate at least one product and one template selected before generation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 5. Checkpoint - Ensure all components compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Assemble main page and integrate navigation
  - [x] 6.1 Create Meesho Images page
    - Create `app/(dashboard)/meesho-images/page.tsx` with mode tabs (Manual / Category)
    - Wire together all components: TemplateSelector, SourceImageInput, TextOverlayConfig, TemplateCustomization, CanvasPreview, BatchControls, HistoryPanel, CategoryModePanel
    - Implement state management connecting all components
    - Implement batch processing logic: sequential generation with memory cleanup between renders
    - Apply current customization uniformly to all batch images
    - _Requirements: 1.1, 4.1, 5.8, 6.7, 7.4_

  - [x] 6.2 Add sidebar navigation entry
    - Add "Meesho Images" link under "Tools" section in `components/layout/Sidebar.tsx`
    - Route to `/meesho-images`, accessible to all roles (OWNER, MANAGER, STAFF)
    - Apply active styling and `aria-current="page"` on active route
    - Auto-expand "Tools" section when Meesho Images is active
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 7. Write unit tests
  - [x]* 7.1 Write unit tests for tier templates and validators
    - Create `__tests__/unit/tier-templates.test.ts` — validate all 6 templates have valid layout definitions, non-overlapping areas
    - Create `__tests__/unit/image-validators.test.ts` — boundary tests: exactly 10MB, exactly 200×200, format edge cases
    - _Requirements: 1.1, 2.1, 2.6_

  - [x]* 7.2 Write unit tests for filename generator and history
    - Create `__tests__/unit/filename-generator.test.ts` — known-answer tests for specific product names, deduplication scenarios
    - Create `__tests__/unit/generation-history.test.ts` — max 20 records limit, clear history, corrupt data recovery
    - _Requirements: 4.4, 5.4, 9.1, 9.5, 9.6_

- [ ] 8. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All rendering is client-side using HTML5 Canvas — no new API routes needed
- Existing JSZip, apiClient, and category/product APIs are reused

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["4.5", "4.6", "4.7", "4.8"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["7.1", "7.2"] }
  ]
}
```
