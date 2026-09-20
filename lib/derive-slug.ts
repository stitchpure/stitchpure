/**
 * Derives a URL-friendly slug from a product name.
 * Lowercases the string and replaces every space with a hyphen.
 *
 * @example
 * deriveSlug("Men EVA Slipper") // → "men-eva-slipper"
 */
export function deriveSlug(name: string): string {
  return name.toLowerCase().replace(/ /g, "-");
}
