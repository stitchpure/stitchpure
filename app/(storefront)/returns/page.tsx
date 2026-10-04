import type { Metadata } from "next";

import LegalPage, { LegalSection } from "@/components/storefront/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns & Refunds",
  description: `Returns, exchanges and refund policy for ${SITE_NAME} orders.`,
  alternates: { canonical: "/returns" },
};

export default function ReturnsPage() {
  return (
    <LegalPage
      title="Returns & Refunds"
      intro="We want you to love what you ordered. If something isn't right, here's how returns and refunds work."
      updated="January 2025"
    >
      <LegalSection heading="Return window">
        <p>
          You can request a return within 7 days of delivery. Items must be
          unused, unwashed, and returned with original tags and packaging
          intact.
        </p>
      </LegalSection>

      <LegalSection heading="How to start a return">
        <p>
          Message us on WhatsApp with your order details and the reason for the
          return. We will guide you through the pickup or return steps.
        </p>
      </LegalSection>

      <LegalSection heading="Exchanges">
        <p>
          Need a different size or colour? We&apos;re happy to exchange eligible
          items subject to stock availability. Reach out within the 7-day
          window.
        </p>
      </LegalSection>

      <LegalSection heading="Refunds">
        <p>
          Once we receive and inspect the returned item, approved refunds are
          processed to your original payment method or as store credit, usually
          within 5–7 working days.
        </p>
      </LegalSection>

      <LegalSection heading="Non-returnable items">
        <p>
          For hygiene reasons, certain items (such as innerwear) and items
          marked final sale cannot be returned unless they arrive damaged or
          defective.
        </p>
      </LegalSection>

      <LegalSection heading="Damaged or wrong item">
        <p>
          If you received a damaged, defective, or incorrect item, contact us
          within 48 hours of delivery with photos and we will make it right.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
