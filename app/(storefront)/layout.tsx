import Link from "next/link";
import { Outfit, Source_Sans_3 } from "next/font/google";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import CartButton from "@/components/storefront/CartButton";
import "./storefront.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sf-display",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sf-body",
  display: "swap",
});

const MARQUEE_ITEMS = [
  "Free shipping over ₹999",
  "New drops every week",
  "Made to stand out",
  "Easy 7-day returns",
];

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: `${SITE_NAME} — streetwear, drops and everyday essentials.`,
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className={`storefront-shell ${outfit.variable} ${sourceSans.variable}`}>
      <JsonLd data={orgJsonLd} />
      <JsonLd data={websiteJsonLd} />

      {/* Announcement marquee */}
      <div className="sp-marquee">
        <div className="sp-marquee__track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map(
            (item, i) => (
              <span key={i}>✦ {item}</span>
            )
          )}
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-[var(--sf-line)] bg-[var(--sp-paper)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label={SITE_NAME}
            className="sf-display flex items-center gap-2 text-lg font-extrabold uppercase tracking-[-0.04em] text-[var(--sp-ink)] sm:text-[1.4rem]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={SITE_NAME}
              className="h-9 w-auto sm:h-10"
            />
            <span>{SITE_NAME}</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-6 lg:flex" aria-label="Shop">
            <Link href="/" className="sp-nav-link">
              New
            </Link>
            <Link href="/#catalog" className="sp-nav-link">
              Shop all
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            {/* Mobile quick link to catalog */}
            <Link
              href="/#catalog"
              className="mr-1 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--sp-ink)] hover:bg-[var(--sf-accent-soft)] lg:hidden"
            >
              Shop
            </Link>
            <HeaderSearch />
            <CartButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {children}
      </main>

      <footer className="mt-8 border-t border-[var(--sf-line)] bg-[var(--sp-ink)] text-[var(--sp-paper)]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 py-10 sm:px-6 sm:py-12 lg:grid-cols-4 lg:px-8">
          <div className="col-span-2 lg:col-span-1">
            <p className="sf-display text-xl font-extrabold uppercase tracking-tight">
              {SITE_NAME}
            </p>
            <p className="mt-2 max-w-xs text-sm text-[color:rgba(244,241,234,0.6)]">
              Bold pieces, clean fits, limited runs. Made for people who stand
              out.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[color:rgba(244,241,234,0.5)]">
              Shop
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/" className="hover:text-[var(--sp-lime)]">New arrivals</Link></li>
              <li><Link href="/#catalog" className="hover:text-[var(--sp-lime)]">All products</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[color:rgba(244,241,234,0.5)]">
              Company
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-[var(--sp-lime)]">About</Link></li>
              <li><Link href="/contact" className="hover:text-[var(--sp-lime)]">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[color:rgba(244,241,234,0.5)]">
              Help
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/shipping" className="hover:text-[var(--sp-lime)]">Shipping</Link></li>
              <li><Link href="/returns" className="hover:text-[var(--sp-lime)]">Returns</Link></li>
              <li><Link href="/privacy" className="hover:text-[var(--sp-lime)]">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-[var(--sp-lime)]">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--sp-line-dark)]">
          <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-[color:rgba(244,241,234,0.5)] sm:px-6 lg:px-8">
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
