import type { AuthUser } from "@/types/auth";
import { Roles } from "@/types/role";

export function requireRole(user: AuthUser, ...allowedRoles: string[]): void {
  if (user.role === Roles.SUPER_ADMIN) return;
  if (!allowedRoles.includes(user.role)) {
    const error = new Error("Forbidden");
    (error as any).statusCode = 403;
    throw error;
  }
}
