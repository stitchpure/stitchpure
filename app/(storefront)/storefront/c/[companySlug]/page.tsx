import { redirect } from "next/navigation";

/**
 * Single-company build: there is only one company, so the per-company profile
 * page is redundant. Redirect to the brand homepage (products).
 */
export default function CompanyProfileRedirect() {
  redirect("/");
}
