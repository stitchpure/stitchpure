import { z } from "zod";

export const generateInvoiceSchema = z.object({
  saleId: z.string().uuid("Invalid sale ID"),
});

export const bulkDownloadSchema = z.object({
  saleIds: z
    .array(z.string().uuid("Invalid sale ID"))
    .min(1, "At least one sale must be selected")
    .max(100, "Maximum 100 invoices per bulk download"),
});

export const invoiceTemplateSchema = z.object({
  headerColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
  font: z.enum(["Roboto", "Open Sans", "Lato"]).optional(),
  termsAndConditions: z
    .string()
    .max(500, "Terms & Conditions must be at most 500 characters")
    .optional(),
  bankDetails: z
    .string()
    .max(300, "Bank details must be at most 300 characters")
    .optional(),
});

export const invoiceListFiltersSchema = z.object({
  financialYear: z.string().regex(/^\d{2}-\d{2}$/).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  salesChannelId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  search: z.string().max(100).optional(),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type BulkDownloadInput = z.infer<typeof bulkDownloadSchema>;
export type InvoiceTemplateInput = z.infer<typeof invoiceTemplateSchema>;
export type InvoiceListFilters = z.infer<typeof invoiceListFiltersSchema>;
