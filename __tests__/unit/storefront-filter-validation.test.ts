import { describe, expect, it } from "vitest";
import { storefrontQuerySchema } from "../../validators/storefront.validator";

describe("storefront product filters", () => {
  it("parses multiple category ids from a comma-separated query value", () => {
    const first = "550e8400-e29b-41d4-a716-446655440000";
    const second = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    const result = storefrontQuerySchema.parse({
      categoryIds: `${first},${second}`,
    });

    expect(result.categoryIds).toEqual([first, second]);
  });

  it("coerces valid minimum and maximum prices", () => {
    const result = storefrontQuerySchema.parse({
      minPrice: "100",
      maxPrice: "500.50",
    });

    expect(result.minPrice).toBe(100);
    expect(result.maxPrice).toBe(500.5);
  });

  it("rejects a minimum price above the maximum price", () => {
    const result = storefrontQuerySchema.safeParse({
      minPrice: "501",
      maxPrice: "500",
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative prices and invalid category ids", () => {
    expect(
      storefrontQuerySchema.safeParse({ minPrice: "-1" }).success
    ).toBe(false);
    expect(
      storefrontQuerySchema.safeParse({ categoryIds: "not-a-uuid" }).success
    ).toBe(false);
  });
});
