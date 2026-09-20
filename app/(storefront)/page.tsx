import type { Metadata } from "next";
import Link from "next/link";

import ProductGrid from "@/components/storefront/ProductGrid";
import EmptyState from "@/components/storefront/EmptyState";
import { getStorefrontProducts } from "@/services/storefront.service";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Streetwear, drops & essentials`,
  description: `Shop the latest ${SITE_NAME} drops. Bold pieces, clean fits, limited runs.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — Streetwear, drops & essentials`,
    description: `Shop the latest ${SITE_NAME} drops.`,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/hero-placeholder.svg" }],
  },
};

function Hero() {
  return (
    <section className="sp-hero sf-animate-in px-5 py-12 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
      <div className="sp-hero__bg" />
      <div className="sp-hero__noise" />
      <div className="relative max-w-2xl">
        <span className="sp-chip">New season · Live now</span>
        <h1 className="sp-hero__title mt-5 text-4xl sm:mt-6 sm:text-7xl lg:text-[5.5rem]">
          Wear it
          <br />
          <span className="sp-outline-text">loud.</span>
        </h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-[color:rgba(244,241,234,0.72)] sm:mt-6 sm:text-base sm:leading-7">
          Limited drops, everyday staples and pieces made to stand out. Built by{" "}
          {SITE_NAME} for people who don&apos;t blend in.
        </p>
        <div className="mt-7 sm:mt-8">
          <Link href="#catalog" className="sp-btn sp-btn--lime">
            Shop now
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof getStorefrontProducts>>["data"] = [];
  let error: string | null = null;

  try {
    const result = await getStorefrontProducts({
      page: 1,
      limit: 50,
      search: undefined,
      categoryId: undefined,
      categoryIds: undefined,
      minPrice: undefined,
      maxPrice: undefined,
    });
    products = result.data;
  } catch {
    error = "Failed to load products";
  }

  return (
    <div className="space-y-12 sm:space-y-16">
      <Hero />

      <section id="catalog" className="scroll-mt-24 space-y-6">
        <h2 className="sp-section-title text-2xl sm:text-3xl">Shop all</h2>

        {error ? (
          <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-6 text-center text-sm text-red-700">
            {error}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            message="No products are available yet."
            hint="New drops are on the way — check back soon."
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </section>
    </div>
  );
}
