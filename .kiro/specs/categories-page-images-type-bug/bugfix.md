# Bugfix Requirements Document

## Introduction

The `categories/page.tsx` frontend component has TypeScript type errors caused by a mismatch between how the category image field is modeled in the UI versus the backend. The backend database schema, service layer, and validator all use a single `bannerImage: string` field. However, the frontend component was partially updated to reference `formData.images` (a `string[]` array) — a field that does not exist on the `CategoryFormData` interface or the `Category` type returned by the API. This causes TypeScript compile errors and prevents the page from rendering correctly.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the categories page component is compiled, THEN the TypeScript compiler reports "Property 'images' does not exist on type 'CategoryFormData'" on the `handleCreate` function where `formData.images` is accessed.

1.2 WHEN the categories page component is compiled, THEN the TypeScript compiler reports "Property 'images' does not exist on type 'CategoryFormData'" on the `handleEdit` function where `formData.images` is accessed.

1.3 WHEN the categories page component is compiled, THEN the TypeScript compiler reports "Property 'images' does not exist on type 'Category'" in the table row render where `category.images` is accessed.

1.4 WHEN a category is created or edited via the form, THEN `payload.images` is set to a filtered `formData.images` array — but this field does not exist on the form state, so the API receives `images: undefined` instead of the actual `bannerImage` value.

### Expected Behavior (Correct)

2.1 WHEN the categories page component is compiled, THEN there are no TypeScript errors related to image fields on `CategoryFormData` or `Category`.

2.2 WHEN a user creates a category with a banner image, THEN the `handleCreate` handler SHALL send `payload.bannerImage` with the URL string from `formData.bannerImage` to `POST /api/categories`.

2.3 WHEN a user edits a category's banner image, THEN the `handleEdit` handler SHALL send `payload.bannerImage` with the updated URL string from `formData.bannerImage` to `PATCH /api/categories/[id]`.

2.4 WHEN categories are listed in the table, THEN each row SHALL display the category's `bannerImage` (if set) as a single thumbnail image consistent with the single-image API contract.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the categories page loads, THEN the system SHALL CONTINUE TO fetch and display the paginated list of categories from `GET /api/categories`.

3.2 WHEN a user fills in the name, parent category, and description fields and submits the create form, THEN the system SHALL CONTINUE TO create the category via the API and refresh the list.

3.3 WHEN a user opens the edit modal for an existing category, THEN the system SHALL CONTINUE TO pre-populate the form with the category's existing `name`, `parentId`, `description`, and `bannerImage` values.

3.4 WHEN a user confirms deletion of a category, THEN the system SHALL CONTINUE TO call `DELETE /api/categories/[id]` and refresh the list.

3.5 WHEN the `ImageUpload` component is used in the create and edit forms, THEN the system SHALL CONTINUE TO support uploading and previewing a single banner image URL.

---

## Bug Condition Analysis

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CategoryFormData | Category
  OUTPUT: boolean

  // Returns true when the component accesses a non-existent 'images' property
  RETURN X accesses X.images instead of X.bannerImage
END FUNCTION
```

**Fix Checking Property:**
```pascal
// Property: Fix Checking — No images property references
FOR ALL X WHERE isBugCondition(X) DO
  result ← compiledCategoriesPage'(X)
  ASSERT no TypeScript error AND payload contains bannerImage field
END FOR
```

**Preservation Property:**
```pascal
// Property: Preservation Checking — All non-image functionality unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT categoriesPage(X) = categoriesPage'(X)
END FOR
```
