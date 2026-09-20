import { NextRequest } from "next/server";

import { verifyToken } from "@/lib/jwt";
import { getSingleCompanyId } from "@/lib/single-company";

import type { AuthUser } from "@/types/auth";

export function authMiddleware(request: NextRequest): AuthUser {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Authorization header is missing");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Invalid authorization header");
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    throw new Error("JWT token is missing");
  }

  let user: AuthUser;
  try {
    user = verifyToken(token);
  } catch {
    throw new Error("Invalid or expired token");
  }

  // Single-company build: every request is pinned to the one fixed company,
  // regardless of what the token carries. This keeps all downstream services
  // and queries scoped to the single tenant without changing their code.
  return { ...user, companyId: getSingleCompanyId() };
}
