import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { getStorefrontProducts } from "@/services/storefront.service";

// Revalidate the sitemap hourly so newly listed products appear without a
// redeploy, while keeping the DB query out of the hot path.
export const revalidate = 3600;

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap → up to 5000 products

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static, always-public entry point: the brand homepage (product catalog).
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const productEntries: MetadataRoute.Sitemap = [];

  try {
    // Walk through all visible storefront products.
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, total } = await getStorefrontProducts({
        page,
        limit: PAGE_SIZE,
      });

      for (const product of data) {
        productEntries.push({
          url: `${SITE_URL}/storefront/p/${product.productId}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }

      if (page * PAGE_SIZE >= total || data.length === 0) break;
    }
  } catch {
    // If the DB is unreachable at build/request time, still return static
    // entries rather than failing the whole sitemap.
  }

  return [...staticEntries, ...productEntries];
}
