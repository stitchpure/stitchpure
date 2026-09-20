/**
 * Invoice Template service
 *
 * Handles retrieval and upsert of invoice template configuration
 * scoped to a company.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";

import { invoiceTemplates } from "@/db/schema";

export interface InvoiceTemplateConfig {
  headerColor: string; // hex, e.g. "#FFFFFF"
  accentColor: string; // hex, e.g. "#1a237e"
  font: "Roboto" | "Open Sans" | "Lato";
  termsAndConditions: string; // max 500 chars
  bankDetails: string; // max 300 chars
}

const DEFAULT_TEMPLATE_CONFIG: InvoiceTemplateConfig = {
  headerColor: "#FFFFFF",
  accentColor: "#1a237e",
  font: "Roboto",
  termsAndConditions: "",
  bankDetails: "",
};

/**
 * Get template config for a company. Returns defaults if not configured.
 */
export async function getTemplateConfig(
  companyId: string
): Promise<InvoiceTemplateConfig> {
  const [row] = await db
    .select()
    .from(invoiceTemplates)
    .where(eq(invoiceTemplates.companyId, companyId))
    .limit(1);

  if (!row) {
    return { ...DEFAULT_TEMPLATE_CONFIG };
  }

  return {
    headerColor: row.headerColor,
    accentColor: row.accentColor,
    font: row.font as InvoiceTemplateConfig["font"],
    termsAndConditions: row.termsAndConditions,
    bankDetails: row.bankDetails,
  };
}

/**
 * Update template config for a company. Creates if not exists (upsert).
 * Only updates provided fields; unspecified fields retain their current values.
 */
export async function updateTemplateConfig(
  companyId: string,
  config: Partial<InvoiceTemplateConfig>
): Promise<InvoiceTemplateConfig> {
  const [upserted] = await db
    .insert(invoiceTemplates)
    .values({
      companyId,
      headerColor: config.headerColor ?? DEFAULT_TEMPLATE_CONFIG.headerColor,
      accentColor: config.accentColor ?? DEFAULT_TEMPLATE_CONFIG.accentColor,
      font: config.font ?? DEFAULT_TEMPLATE_CONFIG.font,
      termsAndConditions:
        config.termsAndConditions ?? DEFAULT_TEMPLATE_CONFIG.termsAndConditions,
      bankDetails: config.bankDetails ?? DEFAULT_TEMPLATE_CONFIG.bankDetails,
    })
    .onConflictDoUpdate({
      target: invoiceTemplates.companyId,
      set: {
        ...(config.headerColor !== undefined && {
          headerColor: config.headerColor,
        }),
        ...(config.accentColor !== undefined && {
          accentColor: config.accentColor,
        }),
        ...(config.font !== undefined && { font: config.font }),
        ...(config.termsAndConditions !== undefined && {
          termsAndConditions: config.termsAndConditions,
        }),
        ...(config.bankDetails !== undefined && {
          bankDetails: config.bankDetails,
        }),
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    headerColor: upserted.headerColor,
    accentColor: upserted.accentColor,
    font: upserted.font as InvoiceTemplateConfig["font"],
    termsAndConditions: upserted.termsAndConditions,
    bankDetails: upserted.bankDetails,
  };
}
