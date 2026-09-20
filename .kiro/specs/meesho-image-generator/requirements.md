# Requirements Document

## Introduction

The Meesho Image Generator is a tool that produces product listing images tailored for the Meesho marketplace. It generates images based on Meesho's shipping tier templates (weight slabs: 0-500g, 500g-1kg, 1-2kg, 2-5kg, 5-10kg, 10-15kg), overlaying product information such as category, price, and shipping details onto predefined tier-specific templates. The tool supports batch generation — producing images for multiple products or tiers in a single operation — and leverages existing category banner images as source assets. It integrates with the existing product catalog and category structure within the stock management application.

## Glossary

- **Image_Generator**: The Meesho Image Generator module accessible from the dashboard sidebar for creating tier-based product listing images
- **Tier_Template**: A predefined image layout corresponding to a specific Meesho shipping weight slab, containing placeholders for product image, product name, price, and tier label
- **Weight_Slab**: Meesho's product weight classification that determines the shipping tier (0-500g, 500g-1kg, 1-2kg, 2-5kg, 5-10kg, 10-15kg)
- **Batch_Generation**: The process of generating multiple images in a single operation, either across multiple products or multiple tiers
- **Source_Image**: The product or category image used as the primary visual element in the generated listing image
- **Template_Canvas**: The HTML5 Canvas element used to render and compose the final listing image from template layout, source image, and text overlays
- **Text_Overlay**: Product information (name, price, tier label) rendered onto the template at designated positions
- **Output_Image**: The final generated image file in PNG or JPEG format ready for upload to Meesho

## Requirements

### Requirement 1: Tier Template Selection

**User Story:** As a supplier, I want to select a shipping tier template for image generation, so that my listing images match Meesho's weight-based categorization.

#### Acceptance Criteria

1. WHEN the user opens the Image_Generator page, THE Image_Generator SHALL display a template selector with six Tier_Template options corresponding to Weight_Slabs: 0-500g, 500g-1kg, 1-2kg, 2-5kg, 5-10kg, 10-15kg, with no template selected by default
2. THE Image_Generator SHALL display a visual preview thumbnail (minimum 120×120 pixels) of each Tier_Template showing the layout structure, tier label position, and color scheme
3. WHEN the user selects a Tier_Template, THE Image_Generator SHALL indicate the selected template with a visible border distinguishing it from unselected templates and load its layout configuration into the Template_Canvas
4. THE Image_Generator SHALL allow the user to select multiple Tier_Templates simultaneously for Batch_Generation, and WHEN multiple templates are selected, THE Image_Generator SHALL display the most recently selected template's layout in the Template_Canvas
5. IF no Tier_Template is selected when the user attempts to generate an image, THEN THE Image_Generator SHALL display a validation message indicating at least one template must be selected and SHALL prevent the generation process from starting

### Requirement 2: Source Image Input

**User Story:** As a supplier, I want to provide product images for the template, so that the generated listing images feature my actual products.

#### Acceptance Criteria

1. THE Image_Generator SHALL provide an image upload area accepting files in PNG, JPEG, and WebP formats with a maximum file size of 10 MB and a minimum resolution of 200×200 pixels per image
2. THE Image_Generator SHALL display a category dropdown populated from the user's existing category list, showing only categories that have a banner_image assigned
3. WHEN the user selects a category from the dropdown, THE Image_Generator SHALL load that category's banner_image as the Source_Image
4. WHEN the user uploads or selects a Source_Image, THE Image_Generator SHALL display a preview of the image scaled using object-fit contain behavior (showing the full image without cropping) within a 300×300 pixel preview area
5. THE Image_Generator SHALL allow the user to upload multiple Source_Images (up to 20 images) for Batch_Generation across multiple products
6. IF the uploaded file exceeds 10 MB, is not a supported image format (PNG, JPEG, WebP), or has a resolution below 200×200 pixels, THEN THE Image_Generator SHALL display a validation error indicating the specific reason for rejection (file too large, unsupported format, or resolution too low) and reject the file
7. THE Image_Generator SHALL allow the user to remove a previously added Source_Image from the batch queue
8. IF a category's banner_image fails to load due to a missing or inaccessible image URL, THEN THE Image_Generator SHALL display an error message indicating the banner image is unavailable and prompt the user to upload an image manually instead

### Requirement 3: Text Overlay Configuration

**User Story:** As a supplier, I want to customize the text displayed on my listing images, so that each image shows the correct product name and pricing information.

#### Acceptance Criteria

1. THE Image_Generator SHALL provide input fields for: product name (required, maximum 80 characters, minimum 1 character), selling price (required, numeric, in rupees, range 1 to 9,99,999), and optional MRP/strike-through price (numeric, in rupees, range 1 to 9,99,999)
2. WHEN the user enters text values, THE Image_Generator SHALL render a live preview on the Template_Canvas showing the text at its designated template position within 500 milliseconds
3. IF the rendered product name text exceeds the template's text area width, THEN THE Image_Generator SHALL truncate the displayed text and append an ellipsis character ("…") at the truncation point
4. WHEN the user provides both a selling price and an MRP, THE Image_Generator SHALL display the MRP with a strike-through style to the right of the selling price on the template
5. IF the selling price exceeds the MRP value, THEN THE Image_Generator SHALL display a warning message indicating the selling price is higher than MRP and allow the user to proceed without blocking generation
6. THE Image_Generator SHALL allow the user to configure font size for the product name within a range of 12px to 48px in 1px increments, defaulting to 24px
7. IF the user attempts to generate an image with the product name field empty or the selling price field empty, THEN THE Image_Generator SHALL display a validation message indicating the required fields must be filled and SHALL NOT proceed with generation

### Requirement 4: Image Generation and Rendering

**User Story:** As a supplier, I want the tool to generate a final composite image, so that I can download and upload it to Meesho.

#### Acceptance Criteria

1. WHEN the user triggers generation with a valid Source_Image and selected Tier_Template, THE Image_Generator SHALL render the composite Output_Image on the Template_Canvas combining the template background, Source_Image, and Text_Overlay within 5 seconds
2. THE Image_Generator SHALL produce Output_Images at a resolution of 1080×1080 pixels (Meesho's recommended listing image dimensions)
3. THE Image_Generator SHALL render the tier label (Weight_Slab text) at the top-right corner of the template with a distinct background color per tier, where each of the six tiers has a unique pre-assigned color distinguishable from the others
4. WHEN rendering is complete, THE Image_Generator SHALL display the Output_Image in a preview area and enable a download button that saves the file using the naming pattern `{product-name}_{weight-slab}.png`
5. THE Image_Generator SHALL generate Output_Images in PNG format with a file size not exceeding 2 MB; IF the rendered Output_Image exceeds 2 MB, THEN THE Image_Generator SHALL reduce the image quality iteratively until the file size is within 2 MB or a minimum quality threshold is reached
6. IF the Source_Image aspect ratio does not match the template's image area, THEN THE Image_Generator SHALL scale the image using object-fit cover behavior, cropping edges equally on the shorter dimension
7. IF rendering fails due to a canvas error or resource limitation, THEN THE Image_Generator SHALL display an error message indicating the rendering failure reason and preserve the user's current input configuration

### Requirement 5: Batch Generation

**User Story:** As a supplier, I want to generate images for multiple products and tiers at once, so that I can quickly prepare listings for my entire catalog.

#### Acceptance Criteria

1. WHEN the user has selected multiple Source_Images and multiple Tier_Templates, THE Image_Generator SHALL generate an Output_Image for each Source_Image × Tier_Template combination, applying the text overlay values (product name, selling price) configured for each respective Source_Image
2. WHILE Batch_Generation is in progress, THE Image_Generator SHALL display a progress indicator showing the number of images generated out of the total count (e.g., "5 / 24")
3. WHEN Batch_Generation completes, THE Image_Generator SHALL provide a "Download All" button that packages all successfully generated Output_Images into a single ZIP file for download
4. THE Image_Generator SHALL name each file in the ZIP using the pattern: `{product-name}_{weight-slab}.png` where product-name is limited to 50 characters, lowercased, with spaces replaced by hyphens and special characters (non-alphanumeric except hyphens) removed (e.g., `cotton-kurta_0-500g.png`). IF two or more files would produce an identical filename, THEN THE Image_Generator SHALL append a numeric suffix starting at 2 (e.g., `cotton-kurta_0-500g_2.png`)
5. THE Image_Generator SHALL limit Batch_Generation to a maximum of 120 images (20 source images × 6 tiers) per operation
6. IF the selected Source_Image × Tier_Template combination count exceeds 120, THEN THE Image_Generator SHALL disable the generate button and display a validation message indicating the maximum batch size of 120 images has been exceeded
7. IF any individual image fails to render during Batch_Generation, THEN THE Image_Generator SHALL skip the failed image, continue processing remaining images, and upon completion display a summary listing which images failed with the reason
8. THE Image_Generator SHALL process batch images sequentially, generating one image at a time with memory cleanup between each render
9. WHILE Batch_Generation is in progress, THE Image_Generator SHALL display a "Cancel" button that, when clicked, stops processing after the current image completes, and makes all images generated up to that point available for download

### Requirement 6: Template Customization

**User Story:** As a supplier, I want to adjust template colors and layout, so that my listing images match my brand style.

#### Acceptance Criteria

1. THE Image_Generator SHALL provide a color picker for the template background color, defaulting to white (#FFFFFF)
2. THE Image_Generator SHALL provide a color picker for the text overlay color, defaulting to black (#000000)
3. THE Image_Generator SHALL provide a color picker for the tier label background color, with each tier pre-assigned a distinct default color matching the tier color scheme defined in the Tier_Template layout
4. WHEN the user changes a color or position setting, THE Image_Generator SHALL update the Template_Canvas preview within 300 milliseconds and retain the customization when the user switches between Tier_Templates during the same session
5. THE Image_Generator SHALL allow the user to toggle the tier label visibility on or off, defaulting to visible
6. THE Image_Generator SHALL allow the user to select the Source_Image vertical alignment within the template from options: top (image aligned to top edge of image area), center (image centered vertically in image area), or bottom (image aligned to bottom edge of image area), defaulting to center
7. WHEN Batch_Generation is triggered, THE Image_Generator SHALL apply the current color and position customizations uniformly to all Output_Images in the batch
8. THE Image_Generator SHALL provide a "Reset to Defaults" control that reverts all color pickers and position settings to their original default values

### Requirement 7: Category-Based Batch Generation

**User Story:** As a supplier, I want to generate images for all products in a category using the category banner, so that I can bulk-create consistent listings.

#### Acceptance Criteria

1. THE Image_Generator SHALL provide a "Generate by Category" mode that lists all categories with a banner_image from the user's company, displaying the category name and a thumbnail of the banner_image for each entry
2. WHEN the user selects a category in "Generate by Category" mode, THE Image_Generator SHALL use the category's banner_image as the Source_Image and fetch the list of active products (up to 100) belonging to the selected category, displaying them with checkboxes for selection
3. IF the selected category contains no active products, THEN THE Image_Generator SHALL display a message indicating that no active products are available in this category for image generation
4. WHEN the user confirms generation with at least one product and at least one Tier_Template selected, THE Image_Generator SHALL generate Output_Images for each selected product × selected Tier_Template combination (subject to the 120-image batch limit), using the category banner_image as the Source_Image and each product's name as the text overlay
5. IF the user confirms generation without selecting at least one product or at least one Tier_Template, THEN THE Image_Generator SHALL display a validation message indicating the missing selection
6. IF the selected category has no banner_image, THEN THE Image_Generator SHALL display a message indicating that a banner image must be uploaded to the category before using this mode

### Requirement 8: Sidebar Navigation Integration

**User Story:** As a supplier, I want to access the Meesho Image Generator from the dashboard sidebar, so that it is easy to find alongside other tools.

#### Acceptance Criteria

1. THE Image_Generator SHALL be accessible via a navigation link labeled "Meesho Images" in the sidebar under the "Tools" section, which navigates to the "/meesho-images" route when clicked
2. THE Image_Generator SHALL use the route path "/meesho-images"
3. THE Image_Generator SHALL be accessible to all user roles (OWNER, MANAGER, STAFF) without any role-based restriction on visibility
4. WHILE the user is on the "/meesho-images" route or any sub-route starting with "/meesho-images/", THE Sidebar SHALL visually distinguish the "Meesho Images" link from inactive items using active styling and set `aria-current="page"` on the link element
5. WHILE the "Meesho Images" link is the active navigation item, THE Sidebar SHALL auto-expand the "Tools" section so that the active link is visible without manual interaction

### Requirement 9: Generation History and Re-download

**User Story:** As a supplier, I want to access my previously generated images, so that I can re-download them without regenerating.

#### Acceptance Criteria

1. WHEN an Output_Image or batch ZIP is generated, THE Image_Generator SHALL store a record in browser local storage containing: ISO 8601 timestamp, product name(s), tier(s) selected, a thumbnail preview (base64, max 50KB), and the full generation configuration (selected Tier_Template ID(s), product name text, selling price, MRP, font size, background color, text color, tier label color, tier label visibility, image position, and Source_Image as a base64-encoded string scaled down to a maximum of 200KB)
2. THE Image_Generator SHALL display a "Recent Generations" section on the Image_Generator page showing the last 20 generation records, each displaying: thumbnail, product name, tier label, and timestamp formatted as relative time (e.g., "2 hours ago") with full date on hover
3. WHEN the user clicks on a recent generation record, THE Image_Generator SHALL re-render the Output_Image using the stored generation configuration (template, text values, colors, and stored Source_Image) and enable a download button for the re-rendered image
4. IF the user clicks on a recent generation record whose stored Source_Image data is missing or unreadable, THEN THE Image_Generator SHALL display a message indicating the source image is unavailable and prompt the user to upload a replacement image before re-rendering
5. THE Image_Generator SHALL provide a "Clear History" button that, upon click, displays a confirmation prompt before removing all stored generation records from local storage
6. IF stored generation data fails JSON parsing or exceeds 10 MB total local storage usage, THEN THE Image_Generator SHALL remove the oldest records one at a time until the remaining data parses successfully and total usage is under 10 MB
