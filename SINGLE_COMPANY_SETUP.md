# StitchPure — Single-Company Setup

This is a single-company (single-tenant) build of the stock management app. It
serves exactly ONE company. The multi-company registration flow has been
removed: instead of each signup creating a new company, everyone belongs to the
one company you seed below.

## How the "single company" works

- `lib/single-company.ts` exposes `getSingleCompanyId()`, which reads the
  `SINGLE_COMPANY_ID` env var.
- `middleware/auth.ts` pins every authenticated request to that company id,
  regardless of what the JWT contains. All services and API routes stay
  unchanged and are automatically scoped to the one company.
- `services/auth.service.ts`:
  - `registerCompany()` no longer creates a company. New signups are added as
    `STAFF` users of the single company.
  - `loginUser()` / `refreshAccessToken()` always issue tokens with the pinned
    company id.
- The register page (`app/(auth)/register/page.tsx`) only asks for the user's
  own name/email/password.

## First-time setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure `.env.local`:
   - Set `DATABASE_URL` to your own **separate** Postgres database.
   - Set `JWT_SECRET` and `JWT_REFRESH_SECRET` to long random strings.
   - Optionally edit the `SEED_COMPANY_*` / `SEED_OWNER_*` values to your real
     company + owner details.
   - Leave `SINGLE_COMPANY_ID` blank for now.

3. Run the database migrations:

   ```bash
   npm run db:migrate
   ```

4. Seed your one company + owner user:

   ```bash
   npm run db:seed
   ```

   This prints a line like:

   ```
   SINGLE_COMPANY_ID=<uuid>
   ```

5. Copy that value into `.env.local` as `SINGLE_COMPANY_ID`.

6. Start the app:

   ```bash
   npm run dev
   ```

7. Log in with the seeded owner credentials (shown by the seed script) and
   change the password.

## Notes

- The `companies` table and `companyId` columns still exist in the schema; there
  is simply only ever one company row. This keeps the change small and reliable.
- To add more team members, use the register page or the Users admin — they all
  join the single company automatically.
