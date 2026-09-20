import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/storefront"],
      // Keep private/authenticated and machine-only routes out of the index.
      disallow: [
        "/api/",
        "/login",
        "/register",
        "/dashboard",
        "/products",
        "/categories",
        "/company",
        "/purchases",
        "/sales",
        "/expenses",
        "/cost-sheets",
        "/production-batches",
        "/stock-count",
        "/barcode-labels",
        "/storefront-manager",
        "/storefront-inquiries",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
