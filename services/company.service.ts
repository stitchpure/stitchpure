/**
 * Company service
 *
 * Handles company retrieval and updates scoped to a specific company.
 *
 * Requirements: 4.1–4.5
 */

import { db } from "@/db";

import { companies } from "@/db/schema";

import { eq } from "drizzle-orm";

import { ServiceError } from "@/lib/service-error";

import type { UpdateCompanyInput } from "@/validators/company.validator";

/**
 * Get a company by its ID.
 *
 * Only the owner of the company (whose companyId matches) can fetch it.
 * Throws 403 if the requesting user belongs to a different company.
 * Throws 404 if the company does not exist.
 */
export async function getCompanyById(companyId: string, id: string) {
  if (id !== companyId) {
    throw new ServiceError("Forbidden", 403);
  }

  const result = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id));

  if (!result.length) {
    throw new ServiceError("Company not found", 404);
  }

  return result[0];
}

/**
 * Update a company's mutable fields: name, email, phone, logo.
 *
 * Only the owner of the company can perform this update.
 * Throws 403 if the requesting user belongs to a different company.
 * Throws 404 if the company does not exist.
 */
export async function updateCompany(
  companyId: string,
  id: string,
  data: UpdateCompanyInput
) {
  if (id !== companyId) {
    throw new ServiceError("Forbidden", 403);
  }

  const { name, email, phone, logo, gstin } = data;

  const result = await db
    .update(companies)
    .set({
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(logo !== undefined && { logo }),
      ...(gstin !== undefined && { gstin }),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, id))
    .returning();

  if (!result.length) {
    throw new ServiceError("Company not found", 404);
  }

  return result[0];
}
