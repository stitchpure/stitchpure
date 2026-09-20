/**
 * User service
 *
 * Handles user management scoped to a specific company.
 *
 * Requirements: 5.1–5.8
 */

import { db } from "@/db";

import { users } from "@/db/schema";

import { eq, and, count } from "drizzle-orm";

import { hashPassword } from "@/lib/password";

import { ServiceError } from "@/lib/service-error";

import type { PaginationParams } from "@/lib/pagination";

import type { CreateUserInput, UpdateUserInput } from "@/validators/user.validator";

// Columns returned for every user response — password is always excluded.
const userColumns = {
  id: users.id,
  companyId: users.companyId,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  lastLogin: users.lastLogin,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

/**
 * Return a paginated list of users for the given company.
 * Password is never included in the result set.
 *
 * Requirements: 5.1, 5.2
 */
export async function getUsers(companyId: string, params: PaginationParams) {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  const whereClause = eq(users.companyId, companyId);

  const [data, [{ total }]] = await Promise.all([
    db
      .select(userColumns)
      .from(users)
      .where(whereClause)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(users).where(whereClause),
  ]);

  return { data, total };
}

/**
 * Create a new user within the company.
 *
 * Throws 409 if the email is already in use within the same company.
 * Password is hashed before storage and excluded from the returned record.
 *
 * Requirements: 5.3, 5.4
 */
export async function createUser(companyId: string, data: CreateUserInput) {
  // Check email uniqueness within the company
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.email, data.email)));

  if (existing.length) {
    throw new ServiceError("A user with this email already exists", 409);
  }

  const hashedPassword = await hashPassword(data.password);

  const [created] = await db
    .insert(users)
    .values({
      companyId,
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role,
    })
    .returning(userColumns);

  return created;
}

/**
 * Get a single user by ID, scoped to the company.
 * Throws 404 if the user is not found.
 *
 * Requirements: 5.5
 */
export async function getUserById(companyId: string, id: string) {
  const result = await db
    .select(userColumns)
    .from(users)
    .where(and(eq(users.id, id), eq(users.companyId, companyId)));

  if (!result.length) {
    throw new ServiceError("User not found", 404);
  }

  return result[0];
}

/**
 * Partially update a user's name and/or role.
 *
 * Throws 400 if the actor is trying to modify their own account.
 * Throws 404 if the user is not found within the company.
 *
 * Requirements: 5.6, 5.7
 */
export async function updateUser(
  companyId: string,
  actorUserId: string,
  id: string,
  data: UpdateUserInput
) {
  if (actorUserId === id) {
    throw new ServiceError("Cannot modify your own account", 400);
  }

  const { name, role } = data;

  const result = await db
    .update(users)
    .set({
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, id), eq(users.companyId, companyId)))
    .returning(userColumns);

  if (!result.length) {
    throw new ServiceError("User not found", 404);
  }

  return result[0];
}

/**
 * Soft-delete a user by setting isActive to false.
 *
 * Throws 400 if the actor is trying to deactivate their own account.
 * Throws 404 if the user is not found within the company.
 *
 * Requirements: 5.8
 */
export async function softDeleteUser(
  companyId: string,
  actorUserId: string,
  id: string
) {
  if (actorUserId === id) {
    throw new ServiceError("Cannot deactivate your own account", 400);
  }

  const result = await db
    .update(users)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, id), eq(users.companyId, companyId)))
    .returning(userColumns);

  if (!result.length) {
    throw new ServiceError("User not found", 404);
  }

  return result[0];
}
