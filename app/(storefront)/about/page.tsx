import type { Metadata } from "next";

import LegalPage, { LegalSection } from "@/components/storefront/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us",
  description: `About ${SITE_NAME} — bold streetwear, clean fits and limited runs.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <LegalPage
      title={`About ${SITE_NAME}`}
      intro="Bold pieces, clean fits, limited runs — made for people who stand out."
    >
      <LegalSection heading="Our story">
        <p>
          {SITE_NAME} started with a simple idea: everyday clothing that
          actually stands out. We design limited drops and everyday staples
          with a focus on quality fabric, clean fits and bold detailing.
        </p>
      </LegalSection>

      <LegalSection heading="What we make">
        <p>
          From graphic tees and hoodies to track sets and essentials, every
          piece is made to be worn loud and worn often. We keep our runs
          limited so our pieces stay fresh.
        </p>
      </LegalSection>

      <LegalSection heading="Quality first">
        <p>
          We care about how our clothes feel and last. Each product is checked
          before it ships, so what reaches you is what you expect — and better.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
