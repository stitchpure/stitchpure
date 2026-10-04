import type { Metadata } from "next";

import LegalPage, { LegalSection } from "@/components/storefront/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: `Shipping information, delivery timelines and charges for ${SITE_NAME} orders.`,
  alternates: { canonical: "/shipping" },
};

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping Policy"
      intro={`How and when ${SITE_NAME} ships your order.`}
      updated="January 2025"
    >
      <LegalSection heading="Order processing">
        <p>
          Orders are confirmed over WhatsApp after you place them. Once
          confirmed, orders are usually dispatched within 24–48 working hours.
          Orders placed on Sundays or public holidays are processed on the next
          working day.
        </p>
      </LegalSection>

      <LegalSection heading="Delivery time">
        <p>
          Standard delivery across India typically takes 4–7 working days after
          dispatch, depending on your location. Remote areas may take a little
          longer.
        </p>
      </LegalSection>

      <LegalSection heading="Shipping charges">
        <p>
          Shipping is free on orders over ₹999. For orders below ₹999, a flat
          shipping fee may apply, which will be confirmed on WhatsApp before
          dispatch.
        </p>
      </LegalSection>

      <LegalSection heading="Tracking">
        <p>
          Once your order ships, we will share tracking details with you on
          WhatsApp so you can follow your package until it arrives.
        </p>
      </LegalSection>

      <LegalSection heading="Delays">
        <p>
          Occasionally, delivery may be delayed due to courier issues, weather,
          or events beyond our control. If your order is delayed, reach out and
          we will help track it down.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
