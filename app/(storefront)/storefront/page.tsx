import { redirect } from "next/navigation";

/**
 * Single-company build: the old multi-company "company directory" is gone.
 * Redirect this legacy path to the brand homepage (products).
 */
export default function StorefrontIndexRedirect() {
  redirect("/");
}
