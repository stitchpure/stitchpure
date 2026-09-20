import { redirect } from "next/navigation";

/**
 * Public self-registration is disabled for this single-company brand site.
 * Anyone hitting /register is sent to the login page.
 */
export default function RegisterPage() {
  redirect("/login");
}
