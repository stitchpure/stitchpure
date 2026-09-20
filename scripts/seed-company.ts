/**
 * Seed the single company + owner user for this single-tenant deployment.
 *
 * Usage:
 *   npm run db:seed
 *
 * It is idempotent: if a company with the configured slug already exists it
 * will reuse it instead of creating a duplicate. After it runs, copy the
 * printed company id into .env.local as SINGLE_COMPANY_ID.
 *
 * Company / owner values come from env vars (with sensible placeholders) so
 * you can customise them without editing this file:
 *   SEED_COMPANY_NAME, SEED_COMPANY_SLUG, SEED_COMPANY_EMAIL, SEED_COMPANY_PHONE, SEED_COMPANY_GSTIN
 *   SEED_OWNER_NAME, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD
 */

import { eq } from "drizzle-orm";

import { db, pool } from "../db";
import { companies, users } from "../db/schema";
import { hashPassword } from "../lib/password";

const companyInput = {
  name: process.env.SEED_COMPANY_NAME ?? "StitchPure",
  slug: process.env.SEED_COMPANY_SLUG ?? "stitchpure",
  email: process.env.SEED_COMPANY_EMAIL ?? "hello@stitchpure.example",
  phone: process.env.SEED_COMPANY_PHONE ?? "0000000000",
  gstin: process.env.SEED_COMPANY_GSTIN ?? null,
};

const ownerInput = {
  name: process.env.SEED_OWNER_NAME ?? "Owner",
  email: process.env.SEED_OWNER_EMAIL ?? "owner@stitchpure.example",
  password: process.env.SEED_OWNER_PASSWORD ?? "ChangeMe@123",
};

async function seed() {
  console.log("Seeding single company...\n");

  // 1. Reuse existing company by slug if present (idempotent)
  const existingCompany = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, companyInput.slug));

  let company = existingCompany[0];

  if (company) {
    console.log(`Company "${company.name}" already exists (slug: ${company.slug}).`);
  } else {
    [company] = await db
      .insert(companies)
      .values({
        name: companyInput.name,
        slug: companyInput.slug,
        email: companyInput.email,
        phone: companyInput.phone,
        gstin: companyInput.gstin,
      })
      .returning();
    console.log(`Created company "${company.name}".`);
  }

  // 2. Reuse existing owner by email if present (idempotent)
  const existingOwner = await db
    .select()
    .from(users)
    .where(eq(users.email, ownerInput.email));

  if (existingOwner[0]) {
    console.log(`Owner "${ownerInput.email}" already exists.`);
  } else {
    const hashedPassword = await hashPassword(ownerInput.password);
    await db.insert(users).values({
      companyId: company.id,
      name: ownerInput.name,
      email: ownerInput.email,
      password: hashedPassword,
      role: "OWNER",
    });
    console.log(`Created owner "${ownerInput.email}".`);
  }

  console.log("\n============================================================");
  console.log("  Add this line to your .env.local:");
  console.log(`  SINGLE_COMPANY_ID=${company.id}`);
  console.log("============================================================\n");
  console.log("Login with:");
  console.log(`  email:    ${ownerInput.email}`);
  console.log(`  password: ${ownerInput.password}`);
  console.log("  (change the password after first login)\n");
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
