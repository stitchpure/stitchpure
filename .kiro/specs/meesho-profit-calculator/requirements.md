# Requirements Document

## Introduction

The Meesho Profit Calculator is a tool that helps suppliers determine the ideal listing price on Meesho or verify the real profit on any order. It accounts for Meesho's commission and fees, GST (input tax credit), shipping costs by weight and zone, product returns, and product loss. The calculator operates in two modes: Listing Price Mode (recommends what price to set for a desired profit margin) and Profit Mode (shows real profit at a given selling price). It integrates with the existing product cost sheet data to auto-populate manufacturing costs.

## Glossary

- **Calculator**: The Meesho Profit Calculator module accessible from the dashboard sidebar
- **Listing_Price_Mode**: The calculator mode that computes the recommended selling price given a target profit margin
- **Profit_Mode**: The calculator mode that computes the net profit given a selling price
- **Manufacturing_Cost**: The total manufacturing cost per unit sourced from the product cost sheet (material + labour + packaging + overhead + transport + other costs)
- **Meesho_Commission**: The percentage-based commission Meesho charges on the selling price, varying by product category
- **Shipping_Fee**: The logistics cost charged by Meesho based on product weight slab and delivery zone (local, zonal, national)
- **GST_Rate**: The Goods and Services Tax rate applicable to the product category (5%, 12%, 18%, or 28%)
- **Input_Tax_Credit**: The GST paid on manufacturing inputs that can be offset against GST collected on sales
- **Return_Rate**: The estimated percentage of orders that will be returned by buyers
- **Return_Shipping_Cost**: The shipping cost the supplier bears when an order is returned
- **Product_Loss_Rate**: The estimated percentage of returned products that cannot be resold (damaged, missing, etc.)
- **Net_Profit**: The final profit after deducting all fees, taxes, shipping, and return-related losses from the selling price
- **Weight_Slab**: Meesho's product weight classification that determines shipping cost (0-500g, 500g-1kg, 1-2kg, 2-5kg, 5-10kg, 10-15kg)
- **Delivery_Zone**: The shipping distance category (local, zonal, national) that affects shipping fees
- **Effective_Selling_Price**: The selling price minus GST component that Meesho uses to calculate commission

## Requirements

### Requirement 1: Calculator Mode Selection

**User Story:** As a supplier, I want to choose between listing price mode and profit mode, so that I can either determine what price to set or check my profit at a given price.

#### Acceptance Criteria

1. WHEN the user opens the Calculator page, THE Calculator SHALL display a mode selector with two options: Listing_Price_Mode and Profit_Mode, with Listing_Price_Mode selected by default
2. WHEN the user selects Listing_Price_Mode, THE Calculator SHALL display input fields for target profit margin (accepting values from 0% to 999% inclusive) and target net profit per unit (accepting values from 0.01 to 99,999,999.99 in rupees)
3. WHEN the user selects Profit_Mode, THE Calculator SHALL display an input field for the selling price (accepting values from 0.01 to 99,999,999.99 in rupees)
4. THE Calculator SHALL retain the selected mode and all entered input values when switching between modes without navigating away from the Calculator page, restoring the previously entered values when switching back to a mode
5. IF the user enters a target profit margin, target net profit, or selling price value outside the accepted range, THEN THE Calculator SHALL display a validation error indicating the acceptable range

### Requirement 2: Product Cost Integration

**User Story:** As a supplier, I want the calculator to auto-populate my manufacturing cost from existing cost sheets, so that I do not have to re-enter cost data.

#### Acceptance Criteria

1. THE Calculator SHALL provide a product selector that lists all products belonging to the user's company, displaying a maximum of 50 products per page with pagination controls when more than 50 products exist
2. WHEN the user selects a product, THE Calculator SHALL fetch the active cost sheet (status = ACTIVE) for that product and populate the Manufacturing_Cost field with the totalManufacturingCostPerUnit value within 5 seconds
3. WHEN no active cost sheet exists for the selected product, THE Calculator SHALL allow manual entry of the Manufacturing_Cost value within the range 0.01 to 9999999999.9999 with up to 4 decimal places
4. THE Calculator SHALL allow the user to override the auto-populated Manufacturing_Cost value with a manual entry within the range 0.01 to 9999999999.9999 with up to 4 decimal places
5. IF the product cost sheet fetch fails due to network error or exceeds a 5-second timeout, THEN THE Calculator SHALL display an error message indicating the cost sheet could not be loaded and allow manual cost entry
6. WHEN the user overrides the auto-populated Manufacturing_Cost value, THE Calculator SHALL use the manually entered value for all subsequent calculations without modifying the underlying cost sheet

### Requirement 3: Meesho Commission Configuration

**User Story:** As a supplier, I want to configure Meesho's commission rate for my product category, so that the profit calculation accounts for platform fees.

#### Acceptance Criteria

1. THE Calculator SHALL provide an input field for Meesho_Commission percentage with a default value of 0%, accepting numeric values with up to 2 decimal places (e.g., 12.50%)
2. THE Calculator SHALL accept Meesho_Commission values between 0% and 50% inclusive
3. THE Calculator SHALL compute commission amount as: (Meesho_Commission / 100) × Effective_Selling_Price, where Effective_Selling_Price = Selling_Price × 100 / (100 + GST_Rate), rounded to 2 decimal places
4. IF the user enters a Meesho_Commission value outside the 0-50% range, THEN THE Calculator SHALL display a validation error message indicating the accepted range is 0% to 50%
5. IF the user enters a non-numeric value in the Meesho_Commission field, THEN THE Calculator SHALL prevent the input and retain the last valid value

### Requirement 4: GST Calculation

**User Story:** As a supplier, I want the calculator to account for GST and input tax credit, so that I see the accurate tax impact on my profit.

#### Acceptance Criteria

1. THE Calculator SHALL provide a GST_Rate selector with options: 5%, 12%, 18%, and 28%, defaulting to 18% when no selection has been made
2. THE Calculator SHALL compute GST on selling price as: Selling_Price × GST_Rate / (100 + GST_Rate) for GST-inclusive prices, rounded to 2 decimal places
3. THE Calculator SHALL compute Input_Tax_Credit as: Manufacturing_Cost × GST_Rate / (100 + GST_Rate), rounded to 2 decimal places
4. THE Calculator SHALL compute net GST liability as: GST on selling price minus Input_Tax_Credit, rounded to 2 decimal places
5. IF the net GST liability computation yields a negative value, THEN THE Calculator SHALL display the net GST liability as 0.00 for that transaction
6. THE Calculator SHALL display all GST computation results (GST on selling price, Input_Tax_Credit, and net GST liability) formatted to exactly 2 decimal places

### Requirement 5: Shipping Fee Calculation

**User Story:** As a supplier, I want the calculator to factor in Meesho's shipping charges by weight and zone, so that I know the true logistics cost.

#### Acceptance Criteria

1. THE Calculator SHALL provide a Weight_Slab selector with options: 0-500g, 500g-1kg, 1-2kg, 2-5kg, 5-10kg, 10-15kg, defaulting to 0-500g when no prior saved state exists
2. THE Calculator SHALL provide a Delivery_Zone selector with options: local, zonal, national, defaulting to local when no prior saved state exists
3. THE Calculator SHALL store a shipping fee lookup table mapping each of the 18 Weight_Slab and Delivery_Zone combinations to a shipping cost value in the range 0.00 to 99999.99 INR
4. WHEN the user selects a Weight_Slab and Delivery_Zone, THE Calculator SHALL look up and display the applicable Shipping_Fee from the lookup table within 200 milliseconds
5. THE Calculator SHALL allow the user to manually override the Shipping_Fee value, accepting values in the range 0.00 to 99999.99 INR with up to 2 decimal places
6. IF the user enters an override Shipping_Fee value outside the range 0.00 to 99999.99 or with more than 2 decimal places, THEN THE Calculator SHALL display a validation error and retain the previous valid Shipping_Fee value
7. WHEN the user clears the manual override field, THE Calculator SHALL revert the Shipping_Fee to the lookup table value for the currently selected Weight_Slab and Delivery_Zone combination

### Requirement 6: Return Cost and Loss Calculation

**User Story:** As a supplier, I want to account for return rates and product damage, so that the profit reflects real-world losses.

#### Acceptance Criteria

1. THE Calculator SHALL provide an input field for Return_Rate percentage with a default value of 0%, accepting values with up to 2 decimal places (e.g., 12.50%)
2. THE Calculator SHALL provide an input field for Product_Loss_Rate percentage with a default value of 0%, accepting values with up to 2 decimal places (e.g., 5.25%)
3. THE Calculator SHALL compute Return_Shipping_Cost as: Return_Rate × Shipping_Fee (the cost of return logistics per unit sold), rounded to 2 decimal places
4. THE Calculator SHALL compute Product_Loss_Cost as: Return_Rate × Product_Loss_Rate × Manufacturing_Cost (cost of unsalvageable returns per unit sold), rounded to 2 decimal places
5. THE Calculator SHALL accept Return_Rate values between 0% and 100% inclusive
6. THE Calculator SHALL accept Product_Loss_Rate values between 0% and 100% inclusive
7. IF the user enters a Return_Rate or Product_Loss_Rate outside the valid range, THEN THE Calculator SHALL display an inline validation error message indicating the accepted range (0% to 100%)
8. IF Shipping_Fee is zero or not yet configured when computing Return_Shipping_Cost, THEN THE Calculator SHALL treat Return_Shipping_Cost as 0.00
9. IF Manufacturing_Cost is zero or not yet configured when computing Product_Loss_Cost, THEN THE Calculator SHALL treat Product_Loss_Cost as 0.00

### Requirement 7: Profit Calculation in Profit Mode

**User Story:** As a supplier, I want to see a detailed profit breakdown when I enter a selling price, so that I understand exactly where my money goes.

#### Acceptance Criteria

1. WHEN the user is in Profit_Mode and all required inputs (Selling_Price, Manufacturing_Cost, Meesho_Commission percentage, GST_Rate, Weight_Slab, Delivery_Zone, Return_Rate, and Product_Loss_Rate) are provided, THE Calculator SHALL compute Net_Profit as: Selling_Price - Manufacturing_Cost - Meesho_Commission_Amount - Net_GST_Liability - Shipping_Fee - Return_Shipping_Cost - Product_Loss_Cost
2. THE Calculator SHALL display a breakdown showing each cost component (Manufacturing_Cost, Meesho_Commission_Amount, Net_GST_Liability, Shipping_Fee, Return_Shipping_Cost, Product_Loss_Cost) with its rupee value rounded to 2 decimal places
3. THE Calculator SHALL display the Net_Profit as both a rupee amount (rounded to 2 decimal places) and a percentage of the selling price (rounded to 2 decimal places)
4. THE Calculator SHALL display the Effective_Selling_Price (selling price minus GST component) rounded to 2 decimal places
5. WHEN the user modifies any input field, THE Calculator SHALL update the calculation results within 300 milliseconds of the last keystroke
6. IF one or more required inputs are missing or empty in Profit_Mode, THEN THE Calculator SHALL not display calculation results and SHALL indicate which inputs are still required
7. IF the computed Net_Profit is negative, THEN THE Calculator SHALL display the result as a loss amount with the same breakdown structure

### Requirement 8: Listing Price Calculation in Listing Price Mode

**User Story:** As a supplier, I want the calculator to recommend a selling price given my desired profit, so that I can set competitive prices on Meesho.

#### Acceptance Criteria

1. WHEN the user is in Listing_Price_Mode and provides a target profit margin percentage, THE Calculator SHALL compute the minimum selling price that achieves that margin after all deductions using the formula: Selling_Price = (Manufacturing_Cost + Shipping_Fee + Return_Shipping_Cost + Product_Loss_Cost) / (1 - Meesho_Commission/100 × 100/(100+GST_Rate) - GST_Rate/(100+GST_Rate) - Target_Margin/100), rounded to 2 decimal places
2. WHEN the user is in Listing_Price_Mode and provides a target net profit in rupees, THE Calculator SHALL compute the minimum selling price that achieves that absolute profit after all deductions, rounded to 2 decimal places
3. THE Calculator SHALL display the computed selling price along with the full cost breakdown at that price, showing each component rounded to 2 decimal places
4. WHEN the user modifies any input field, THE Calculator SHALL update the recommended selling price within 300 milliseconds of the last keystroke
5. IF the target profit is unachievable because the effective deduction rate (commission + GST + margin) equals or exceeds 100% of the selling price, THEN THE Calculator SHALL display a message: "Target not achievable with current cost and fee configuration"

### Requirement 9: Results Display and Breakdown

**User Story:** As a supplier, I want a clear visual breakdown of all cost components, so that I can identify areas to optimize.

#### Acceptance Criteria

1. THE Calculator SHALL display results in a structured breakdown with sections: Revenue (Selling_Price, Effective_Selling_Price), Platform Fees (Meesho_Commission_Amount), Taxes (GST on selling price, Input_Tax_Credit, Net_GST_Liability), Logistics (Shipping_Fee), Returns & Losses (Return_Shipping_Cost, Product_Loss_Cost), and Net Profit
2. THE Calculator SHALL display each cost component as both a rupee value (rounded to 2 decimal places) and a percentage of the selling price (rounded to 2 decimal places)
3. THE Calculator SHALL visually distinguish positive profit (green text or background) from negative profit/loss (red text or background)
4. THE Calculator SHALL display a summary card showing the final Net_Profit prominently at the top or bottom of the breakdown with larger font size than other values

### Requirement 10: Sidebar Navigation Integration

**User Story:** As a supplier, I want to access the Meesho Profit Calculator from the dashboard sidebar, so that it is easy to find alongside other tools.

#### Acceptance Criteria

1. THE Calculator SHALL be accessible via a navigation link labeled "Meesho Calculator" in the sidebar under the "Tools" section, which navigates to the calculator page when clicked
2. THE Calculator SHALL use the route path "/meesho-calculator"
3. THE Calculator SHALL be accessible to all user roles (OWNER, MANAGER, STAFF) without any role-based restriction on visibility
4. WHEN the user is on the "/meesho-calculator" route, THE Sidebar SHALL visually indicate the "Meesho Calculator" link as the active navigation item

### Requirement 11: Shipping Fee Configuration

**User Story:** As a supplier, I want to manage the shipping fee lookup table, so that I can keep it updated when Meesho changes rates.

#### Acceptance Criteria

1. THE Calculator SHALL include a shipping fee configuration panel accessible from the calculator page via a dedicated button or expandable section
2. WHEN the user opens the shipping fee configuration, THE Calculator SHALL display the current fee lookup table as a grid showing all 18 combinations of Weight_Slab (0-500g, 500g-1kg, 1-2kg, 2-5kg, 5-10kg, 10-15kg) and Delivery_Zone (local, zonal, national) with their current fee values in rupees
3. THE Calculator SHALL allow the user to edit individual shipping fee values in the lookup table, accepting numeric values in the range 0.00 to 9999.99 with up to 2 decimal places
4. IF the user enters a shipping fee value outside the range 0.00 to 9999.99 or with more than 2 decimal places, THEN THE Calculator SHALL display a validation error for that field and prevent saving until corrected
5. WHEN the user saves updated shipping fees, THE Calculator SHALL persist the changes to browser local storage scoped to the user's company and display a confirmation indicating the fees were saved successfully
6. THE Calculator SHALL provide default shipping fee values pre-populated for all 18 Weight_Slab and Delivery_Zone combinations when no previously saved fees exist in local storage
7. THE Calculator SHALL provide a "Restore Defaults" action that replaces all current fee values with the default shipping fee values and persists the reset to local storage

### Requirement 12: Calculation State Persistence

**User Story:** As a supplier, I want my last calculation inputs to be preserved, so that I do not have to re-enter data when I revisit the calculator.

#### Acceptance Criteria

1. WHEN the user navigates away from the Calculator page or the page unloads, THE Calculator SHALL save the following input values to browser local storage: selected mode (Listing_Price_Mode or Profit_Mode), selected product, Manufacturing_Cost, Meesho_Commission percentage, GST_Rate, Weight_Slab, Delivery_Zone, Shipping_Fee (if manually overridden), Return_Rate, Product_Loss_Rate, selling price (in Profit_Mode), target profit margin and target net profit per unit (in Listing_Price_Mode)
2. WHEN the user navigates to the Calculator page, THE Calculator SHALL read previously saved input values from local storage, populate all corresponding input fields with the saved values, and trigger a recalculation of results using the restored inputs
3. IF the saved local storage data is missing, corrupt, or fails JSON parsing, THEN THE Calculator SHALL discard the invalid data, remove the local storage entry, and initialize all inputs to their default values: mode set to Listing_Price_Mode, no product selected, Manufacturing_Cost empty, Meesho_Commission 0%, GST_Rate 18%, Weight_Slab 0-500g, Delivery_Zone local, Return_Rate 0%, Product_Loss_Rate 0%, and all price/profit fields empty
4. THE Calculator SHALL provide a "Reset" button visible at all times that, when activated, clears all input fields to the default values specified in criterion 3 and removes the saved state from local storage
5. IF the user selects a product from local storage that no longer exists or whose active cost sheet has changed, THEN THE Calculator SHALL retain the product selection and re-fetch the current active cost sheet, updating Manufacturing_Cost with the latest value
