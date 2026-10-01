import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import "./globals.css";

// Google Analytics 4 measurement ID (e.g. "G-XXXXXXXXXX"). Configured via env
// so it can differ per environment and be omitted in local dev.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = SITE_URL;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — Shop our products`,
    template: `%s | ${SITE_NAME}`,
  },
  description: `Browse and shop the ${SITE_NAME} product collection. Discover our range and enquire or order directly.`,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} — Shop our products`,
    description: `Browse and shop the ${SITE_NAME} product collection.`,
    url: siteUrl,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Shop our products`,
    description: `Browse and shop the ${SITE_NAME} product collection.`,
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    // Google Search Console ownership verification. Next.js renders this as
    // <meta name="google-site-verification" ...> inside <head>.
    google: "M_JWTDBrS_6gGYN0ix8kPeAeCpNoSHIPplitv1f35MA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />

        {/* Google Analytics 4 — loaded after the page is interactive so it
            never blocks rendering. Only rendered when the ID is configured. */}
        {GA_MEASUREMENT_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
