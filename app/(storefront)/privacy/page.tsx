import type { Metadata } from "next";

import LegalPage, { LegalSection } from "@/components/storefront/LegalPage";
import { SITE_NAME, SITE_CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses and protects your personal information.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`Your privacy matters to us. This policy explains what information ${SITE_NAME} collects and how we use it.`}
      updated="January 2025"
    >
      <LegalSection heading="Information we collect">
        <p>
          When you place an order or make an enquiry, we collect details you
          provide — such as your name, phone number, delivery address and any
          message. We also collect basic, anonymous usage data to understand how
          our site is used.
        </p>
      </LegalSection>

      <LegalSection heading="How we use your information">
        <p>
          We use your details to confirm and fulfil orders, respond to
          enquiries, arrange delivery, and provide customer support. We do not
          sell your personal information to third parties.
        </p>
      </LegalSection>

      <LegalSection heading="Sharing with service providers">
        <p>
          We may share necessary details with delivery partners and messaging
          services (such as WhatsApp) strictly to fulfil your order and
          communicate with you.
        </p>
      </LegalSection>

      <LegalSection heading="Analytics & cookies">
        <p>
          We use privacy-friendly analytics to measure traffic and improve the
          site. These tools may use cookies or similar technologies to collect
          anonymous, aggregated data.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <p>
          You can request access to, correction of, or deletion of the personal
          information you&apos;ve shared with us by contacting us at{" "}
          <a
            href={`mailto:${SITE_CONTACT.email}`}
            className="font-semibold text-[var(--sp-ink)] underline underline-offset-2"
          >
            {SITE_CONTACT.email}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about this policy? Email us at{" "}
          <a
            href={`mailto:${SITE_CONTACT.email}`}
            className="font-semibold text-[var(--sp-ink)] underline underline-offset-2"
          >
            {SITE_CONTACT.email}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
