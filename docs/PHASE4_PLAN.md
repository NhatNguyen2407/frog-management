# Phase 4 - Backend Integration Plan

Updated: 2026-11-09

## Goal

Move Frog Management from the accepted browser-only prototype to the existing Next.js application backed by PostgreSQL. Keep this system separate from the Dioxyzine Frog e-commerce database. Preserve the ability to move the PostgreSQL database to another provider later without rewriting the business rules.

## Status

- 4.1 - Backend audit: Complete. Four SQL migrations reviewed and the local PostgreSQL 17 database test passed.
- 4.2 - Dedicated Supabase setup: Preparing. The connected account does not yet have a separate The Frog Art Space organization or Frog Management project.
- 4.3 - Authentication and authorization: Not started on hosted infrastructure.
- 4.4 - Business feature integration: Not started against hosted infrastructure.
- 4.5 - Reliability and multi-device testing: Not started.
- 4.6 - Final manual acceptance: Not started.

## 4.2 - Dedicated Supabase setup

1. Create a separate Supabase organization named `The Frog Art Space`, using the Free plan if eligible. Do not change the existing `Dioxyzine Frog` organization.
2. Verify that the new organization appears in the connected Supabase account. Check the quoted project creation cost and get approval before any potentially billable action.
3. Create a project named `Frog Management` in Singapore (`ap-southeast-1`), only inside the new organization.
4. Confirm the project reference before linking any CLI, environment variables or migrations. Never deploy the workshop schema to either existing e-commerce project.
5. Review the migration dry run, apply the four existing migrations in order, and load the idempotent catalogue seed. Do not seed real customers or sales.
6. Verify actual migration history, table definitions, grants, RLS, functions, views and security/performance advisors on the new project.
7. Configure the application URL and browser-safe publishable key. Keep secrets out of GitHub and ensure `service_role` is never exposed to the browser.

**Acceptance:** A dedicated hosted PostgreSQL database exists, all four migrations and the catalogue seed are verified, database security checks are reviewed, and the e-commerce projects remain untouched.

## 4.3 - Authentication and authorization

- Set up hosted Google OAuth and the Before User Created Auth Hook.
- Create the initial owner allowlist entry, then test Owner, Staff and unapproved accounts.
- Verify permissions with direct database/API calls, not only hidden navigation controls.
- Do not treat successful sign-in as proof that RLS is correct.

**Acceptance:** Only approved users can sign in and read/write the records appropriate to their role.

## 4.4 - Business feature integration

- Connect Products, Workshops and the Counter to the database using the existing Next.js code.
- Verify Orders, payment transitions, Tickets, Queue, inventory movements, event expenses and reporting.
- Close gaps found in the audit: attendee check-in and undo, customer history, date-filtered CSV export, dual customer/staff labels (76 x 130 mm), and unfinished POS drafts.
- Preserve the prototype's accepted behavior, but use database transactions for inventory and orders rather than copying localStorage-based business state.
- Keep pricing, stock, event capacity and ticket numbering validations authoritative on the backend.

**Acceptance:** The Next.js workflow covers the agreed V1 functions without relying on prototype localStorage for business records.

## 4.5 - Reliability and multi-device consistency

- Test duplicate order submission and safe retries.
- Test simultaneous checkouts and inventory limits.
- Verify Realtime queue updates across sessions and recover gracefully from lost connections.
- Verify database backup and restore using a disposable environment.
- Retest receipt overflow, print preview and confirmed printer output before operating the shop.

**Acceptance:** Transactions remain consistent under retries and concurrent operations; backup recovery has been demonstrated.

## 4.6 - Final acceptance

Run automated unit, typecheck, format, build, database, security and integration checks after each relevant change. Collect one consolidated owner-led browser/manual QA session at the end, except where earlier real-device or OAuth input is necessary.

**Acceptance:** All mandatory checks pass, reported issues are fixed and retested, and Phase 4 can be closed.

## Database portability

- Maintain PostgreSQL schema and migrations in Git.
- Keep application data-access operations in dedicated modules, separated from presentation components.
- Keep business rules and tests independent from the Supabase client where practical.
- Document Supabase-specific dependencies (Auth Hooks, JWT/RLS, Realtime, privileged functions) before attempting a provider migration.
- Keep exports and restore drills possible without relying solely on Supabase project availability.
- Avoid building a second backend or migrating away from Supabase until there is a concrete operational need.

## Current blocker

The connected Supabase account still lists only the `Dioxyzine Frog` organization. Creating an organization is not exposed by the connected Supabase tools. The owner must create `The Frog Art Space` through the Supabase dashboard and choose the Free plan; after that, the new organization can be discovered through the connector. No new project or hosted migration should be created until its organization and cost are verified.
