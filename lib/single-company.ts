/**
 * Single-company configuration.
 *
 * This application is a SINGLE-company (single-tenant) build. Instead of
 * resolving the active company from each user's JWT, every request is pinned
 * to one fixed company whose id is provided via the SINGLE_COMPANY_ID env var.
 *
 * The underlying schema still carries companyId columns (so services and
 * queries are unchanged), but there is only ever ONE company row and every
 * user belongs to it.
 *
 * Run `npm run db:seed` once to create the company + owner and print the id
 * you should paste into SINGLE_COMPANY_ID.
 */

/**
 * The id of the one and only company this deployment serves.
 * Throws at call time if it hasn't been configured, so misconfiguration
 * fails loudly rather than silently scoping data to the wrong place.
 */
export function getSingleCompanyId(): string {
  const id = process.env.SINGLE_COMPANY_ID;

  if (!id || id.trim().length === 0) {
    throw new Error(
      "SINGLE_COMPANY_ID is not set. Run `npm run db:seed` to create your company, " +
        "then add the printed id to .env.local as SINGLE_COMPANY_ID."
    );
  }

  return id.trim();
}
