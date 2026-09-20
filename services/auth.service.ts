import { db } from "@/db";
import { companies, users } from "@/db/schema";
import { eq } from "drizzle-orm";

import { hashPassword, comparePassword } from "@/lib/password";
import { generateToken, generateRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { getSingleCompanyId } from "@/lib/single-company";

import type { RegisterInput } from "@/validators/auth.validator";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Single-company build: public "register a new company" is disabled.
 *
 * This deployment serves exactly ONE company (see SINGLE_COMPANY_ID / the seed
 * script). Anyone signing up is added as a STAFF member of that single company
 * — a brand new company is never created here. Only the `owner` fields of the
 * payload are used; the `company` fields are ignored.
 *
 * To create the initial company + owner, run `npm run db:seed`.
 */
export async function registerCompany(data: RegisterInput) {
  const companyId = getSingleCompanyId();

  // 1. Ensure the single company exists (must be seeded first)
  const companyRows = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));

  const company = companyRows[0];
  if (!company) {
    throw new Error(
      "Company is not set up yet. Run the seed script to create it."
    );
  }

  // 2. Check email not already registered
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, data.owner.email));

  if (existingUser.length > 0) {
    throw new Error("Email already registered");
  }

  // 3. Create the user under the single company (as STAFF, not a new owner)
  const hashedPassword = await hashPassword(data.owner.password);

  const [user] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: data.owner.name,
      email: data.owner.email,
      password: hashedPassword,
      role: "STAFF",
    })
    .returning();

  // 4. Generate tokens
  const accessToken = generateToken({
    userId: user.id,
    companyId: company.id,
    role: user.role,
  });

  const refreshToken = generateRefreshToken(user.id);

  return {
    token: accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
    },
  };
}

export async function loginUser(email: string, password: string) {
  // 1. Find User
  const result = await db
    .select({
      user: users,
      company: companies,
    })
    .from(users)
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.email, email));

  const data = result[0];

  if (!data) {
    throw new Error("Invalid email or password");
  }

  // 2. Check account lockout
  if (data.user.lockedUntil && new Date(data.user.lockedUntil) > new Date()) {
    const remainingMinutes = Math.ceil(
      (new Date(data.user.lockedUntil).getTime() - Date.now()) / 60000
    );
    throw new Error(
      `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`
    );
  }

  // 3. Check User Active
  if (!data.user.isActive) {
    throw new Error("User account is inactive");
  }

  // 4. Check Company Active
  if (!data.company.isActive) {
    throw new Error("Company account is inactive");
  }

  // 5. Verify Password
  const isPasswordValid = await comparePassword(password, data.user.password);

  if (!isPasswordValid) {
    // Increment failed attempts
    const newAttempts = (data.user.failedLoginAttempts ?? 0) + 1;
    const updateData: Record<string, unknown> = {
      failedLoginAttempts: newAttempts,
      updatedAt: new Date(),
    };

    // Lock account if max attempts reached
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await db.update(users).set(updateData).where(eq(users.id, data.user.id));

    const attemptsRemaining = MAX_FAILED_ATTEMPTS - newAttempts;
    if (attemptsRemaining > 0) {
      throw new Error(
        `Invalid email or password. ${attemptsRemaining} attempt(s) remaining before lockout.`
      );
    } else {
      throw new Error(
        "Account locked due to too many failed attempts. Try again in 30 minutes."
      );
    }
  }

  // 6. Reset failed attempts on successful login
  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, data.user.id));

  // 7. Generate tokens (companyId is pinned to the single company)
  const accessToken = generateToken({
    userId: data.user.id,
    companyId: getSingleCompanyId(),
    role: data.user.role,
  });

  const refreshToken = generateRefreshToken(data.user.id);

  return {
    token: accessToken,
    refreshToken,
    user: {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
    },
    company: {
      id: data.company.id,
      name: data.company.name,
      slug: data.company.slug,
    },
  };
}

/**
 * Refresh an access token using a valid refresh token.
 */
export async function refreshAccessToken(refreshToken: string) {
  const { userId } = verifyRefreshToken(refreshToken);

  // Fetch current user data
  const result = await db
    .select({
      user: users,
      company: companies,
    })
    .from(users)
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.id, userId));

  const data = result[0];
  if (!data) {
    throw new Error("User not found");
  }

  if (!data.user.isActive) {
    throw new Error("User account is inactive");
  }

  if (!data.company.isActive) {
    throw new Error("Company account is inactive");
  }

  // Generate new access token with fresh role data (companyId pinned)
  const accessToken = generateToken({
    userId: data.user.id,
    companyId: getSingleCompanyId(),
    role: data.user.role,
  });

  return {
    token: accessToken,
    user: {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
    },
  };
}
