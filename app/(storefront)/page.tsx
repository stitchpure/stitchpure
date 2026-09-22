import type { Metadata } from "next";

import ProductGrid from "@/components/storefront/ProductGrid";
import EmptyState from "@/components/storefront/EmptyState";
import HeroCarousel, {
  type HeroSlide,
} from "@/components/storefront/HeroCarousel";
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

// Banner slides for the hero carousel. Drop new images into /public and point
// `image` at them (e.g. "/banners/drop-2.jpg"). Omit `image` to fall back to
// the branded gradient background.
const heroSlides: HeroSlide[] = [
  {
    image: "/hero-placeholder.svg",
    chip: "New season · Live now",
    titleTop: "Wear it",
    titleAccent: "loud.",
    subtitle: `Limited drops, everyday staples and pieces made to stand out. Built by ${SITE_NAME} for people who don't blend in.`,
    ctaLabel: "Shop now",
    ctaHref: "#catalog",
  },
  {
    chip: "Fresh drop",
    titleTop: "New arrivals",
    titleAccent: "in.",
    subtitle: "Just-landed styles and restocks. Grab them before they're gone.",
    ctaLabel: "Explore",
    ctaHref: "#catalog",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawSearch = Array.isArray(params.search)
    ? params.search[0]
    : params.search;
  const search = (rawSearch ?? "").trim();
  const isSearching = search.length >= 3;

  let products: Awaited<ReturnType<typeof getStorefrontProducts>>["data"] = [];
  let error: string | null = null;

  try {
    const result = await getStorefrontProducts({
      page: 1,
      limit: 50,
      search: isSearching ? search : undefined,
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
      {isSearching ? null : <HeroCarousel slides={heroSlides} />}

      <section id="catalog" className="scroll-mt-24 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="sp-section-title text-2xl sm:text-3xl">
            {isSearching ? (
              <>
                Results for{" "}
                <span className="text-[var(--sf-accent)]">“{search}”</span>
              </>
            ) : (
              "Shop all"
            )}
          </h2>
          {isSearching ? (
            <a
              href="/"
              className="text-sm font-semibold text-[var(--sf-soft)] underline-offset-4 hover:text-[var(--sp-ink)] hover:underline"
            >
              Clear search
            </a>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-6 text-center text-sm text-red-700">
            {error}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            message={
              isSearching
                ? `No products found for “${search}”.`
                : "No products are available yet."
            }
            hint={
              isSearching
                ? "Try a different search term or browse all products."
                : "New drops are on the way — check back soon."
            }
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </section>
    </div>
  );
}
