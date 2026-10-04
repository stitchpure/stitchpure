import type { Metadata } from "next";

import LegalPage, { LegalSection } from "@/components/storefront/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and conditions for using the ${SITE_NAME} website and placing orders.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro={`By using ${SITE_NAME} and placing an order, you agree to the following terms.`}
      updated="January 2025"
    >
      <LegalSection heading="Orders">
        <p>
          Placing an order is an offer to purchase. Orders are confirmed over
          WhatsApp. We reserve the right to accept or decline any order, for
          example if an item is out of stock or a pricing error occurs.
        </p>
      </LegalSection>

      <LegalSection heading="Pricing">
        <p>
          All prices are listed in Indian Rupees (₹) and are inclusive of
          applicable taxes unless stated otherwise. Prices and product
          availability may change without notice.
        </p>
      </LegalSection>

      <LegalSection heading="Product information">
        <p>
          We try to display products as accurately as possible. Actual colours
          may vary slightly due to screen settings and lighting.
        </p>
      </LegalSection>

      <LegalSection heading="Returns & refunds">
        <p>
          Returns, exchanges and refunds are governed by our Returns &amp;
          Refunds policy. Please review it before placing an order.
        </p>
      </LegalSection>

      <LegalSection heading="Intellectual property">
        <p>
          All content on this site — including logos, designs, images and text —
          belongs to {SITE_NAME} and may not be used without permission.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          {SITE_NAME} is not liable for indirect or incidental damages arising
          from the use of this site or products, to the extent permitted by
          law.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
