import { redirect } from "next/navigation";

/**
 * Single-company build: the product catalog now lives at the site root ("/").
 * Redirect this legacy path there so old links keep working.
 */
export default function StorefrontProductsRedirect() {
  redirect("/");
}
