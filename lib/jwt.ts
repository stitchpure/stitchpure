import jwt from "jsonwebtoken";
import crypto from "crypto";

import type { AuthUser } from "@/types/auth";

const secret = process.env.JWT_SECRET!;
const refreshSecret = process.env.JWT_REFRESH_SECRET || secret + "_refresh";

// Access token — short-lived (1 hour)
const ACCESS_TOKEN_EXPIRY = "1h";

// Refresh token — longer-lived (7 days)
const REFRESH_TOKEN_EXPIRY = "7d";

/**
 * Generate a short-lived access token (1 hour).
 */
export function generateToken(payload: AuthUser): string {
  return jwt.sign(payload, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    jwtid: crypto.randomUUID(),
  });
}

/**
 * Generate a long-lived refresh token (7 days).
 * Contains only userId for minimal exposure.
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, refreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    jwtid: crypto.randomUUID(),
  });
}

/**
 * Verify an access token and return the decoded user payload.
 */
export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, secret);

  if (typeof decoded === "string") {
    throw new Error("Invalid token");
  }

  return decoded as AuthUser;
}

/**
 * Verify a refresh token and return the userId.
 */
export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, refreshSecret);

  if (typeof decoded === "string" || !('userId' in (decoded as object))) {
    throw new Error("Invalid refresh token");
  }

  const payload = decoded as { userId: string; type: string };
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  return { userId: payload.userId };
}
