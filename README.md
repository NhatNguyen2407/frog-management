# Frog Management

A staff-only management app for The Frog Art Space. I'm building it to replace the workshop spreadsheets with one place to manage events, counter sales, tickets, the live queue, inventory, expenses and financial reporting.

The first business unit is a creative workshop with a small F&B catalogue. The data model supports additional business units later, but a coffee-specific workflow has not been built.

## Project status

**Phase 1 has been implemented in the repository, but live acceptance testing is still pending.**

The repository contains the screens, SQL migrations, seed catalogue and automated tests. The initial implementation reported passing local build and database tests. Those results have not been rerun as part of this documentation update.

A hosted Supabase connection, Google OAuth sign-in, Realtime updates on real devices and physical receipt printing still need to be verified before using the app for real sales. Without Supabase environment variables, the app shows a setup screen rather than a working demo.

This is an internal application, not an online store. There are no customer accounts, online payments or public registration pages in Phase 1.

## Features

| Area | What is implemented | Access |
| --- | --- | --- |
| Events | Create events, set capacity and ticket prefix, switch active context | Owner |
| Products | SKU catalogue, event availability, prices and unit costs | Owner |
| Counter | Create orders with workshop and F&B items, optional ticket registration | Owner, staff |
| Tickets | Sequential ticket numbers, status history, receipt printing | Owner, staff |
| Queue | Operational queue and a separate TV display with Supabase Realtime subscription | Owner, staff |
| Orders | Paid, Unpaid, Refunded and Cancelled statuses; cash or bank transfer | Owner, staff |
| Inventory | Prepared stock, product-to-supply mappings, usage movements and alerts | Owner |
| Costs | Record event expenses by category and date | Owner |
| Dashboard | Paid revenue, costs, profit, margin, category breakdown and charts | Owner |
| Operations dashboard | Queue and ticket counts without financial reporting | Staff |
| Settings | Allowlisted Google accounts and owner/staff roles | Owner |

The TV display requires an authenticated staff session. It is not a public screen.

## Stack

- Next.js 16 App Router, React 19 and TypeScript
- Tailwind CSS 4 and shadcn/ui-style components
- Supabase Postgres, Google Auth, RLS and Realtime
- next-intl for Vietnamese and English
- Recharts for reporting
- Vercel-ready Next.js deployment

## Run locally

Requirements: Node.js 24 or later and npm. Open the repository folder in VS Code. You do not need to create another Next.js app or install React separately.

```powershell
git clone https://github.com/NhatNguyen2407/frog-management.git
cd frog-management
npm ci
npm run dev
```

Open the local URL printed in the terminal, usually `http://localhost:3000`.

- `/vi` is the default Vietnamese route.
- `/en` uses English.
- `/vi/display` and `/en/display` are the queue display routes.

Without a configured database, the setup screen is expected. It does not mean the workshop data is available yet.

For a production-mode local check:

```powershell
npm run build
npm start
```

## Configure Supabase

Use a **new Supabase project for Frog Management**. Do not point these migrations at an existing Dioxyzine Frog database.

### 1. Environment variables

Copy `.env.example` to `.env.local` and fill in the relevant values.

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key |
| `NEXT_PUBLIC_SITE_URL` | App origin, e.g. `http://localhost:3000` |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Google OAuth for the local Supabase stack |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Google OAuth for the local Supabase stack |
| `INITIAL_OWNER_EMAIL` | Email used by the optional owner bootstrap script |
| `INITIAL_BUSINESS_UNIT_SLUG` | Initial unit, normally `workshop` |

The hosted Google OAuth credentials belong in Supabase Auth provider settings. Never commit `.env.local`, a service-role key or a Google client secret. The web app does not require a service-role key.

### 2. Apply the database

Install the Supabase CLI separately if needed, and check `supabase --version` and `supabase db --help` before running commands.

For a new hosted project:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push --include-seed
```

Review the target project and dry-run output first. The migrations create the tables, RLS policies, operations and reporting views. The seed inserts one Workshop unit, two categories and 11 products at their initial prices. It does not create orders, customers, event expenses, stock counts or staff accounts.

`--include-seed` is used here because the seed file contains multiple SQL statements. Avoid passing the entire seed file to `supabase db query` as a single prepared query.

For a fresh, disposable local Supabase environment with Docker:

```powershell
supabase start
supabase status
```

The configured local stack loads migrations and `supabase/seed.sql`. Use the local API URL and publishable key printed by `supabase status`. Do not run `supabase db reset` on a database containing data you need to keep.

### 3. Enable Google sign-in

- Enable Google as the Supabase Auth provider and configure its callback in Google Cloud.
- Set the Supabase Site URL to the app origin.
- Allow the app's `/auth/callback` URL locally and for each approved deployment origin.
- Enable the **Before User Created** Auth Hook, using `public.before_user_created`.
- Set up at least one approved owner email before the first Google sign-in.

For a new hosted project, the initial owner can be added using the Supabase SQL Editor after the seed is applied. Replace the placeholder with the intended Google account:

```sql
insert into public.staff_allowlist (business_unit_id, email, role, active)
select id, lower('YOUR_GOOGLE_EMAIL'), 'owner', true
from public.business_units
where slug = 'workshop'
on conflict (business_unit_id, email)
do update set role = 'owner', active = true;
```

The repository also includes an owner bootstrap script. Its CLI invocation should be checked against the installed CLI version before relying on it. Subsequent owner/staff accounts can be managed through Settings after sign-in.

## How the numbers work

- All money values are stored as integer VND, with locale-aware display formatting.
- Revenue includes **Paid** orders only. Unpaid, Refunded, Cancelled and soft-deleted orders contribute no revenue.
- Order items retain sale-time SKU, name, category, price and unit-cost snapshots. A price change to a sold SKU requires a new SKU.
- Profit = Paid revenue - cost of goods for Paid items - event operating costs. If a sold item's unit cost is missing, profit and margin are shown as unavailable.
- An order can contain both workshop and F&B items.
- Stock usage is recorded for non-cancelled orders, including Unpaid and Refunded orders. Cancelling, soft-deleting or voiding an item reverses the corresponding recorded usage. A refund does not imply a physical return.
- Ticket numbers are generated per event. Tickets move through Registered, Ticket printed, Waiting, In progress and Completed, with a separate Cancelled state.
- Printing records a print request and reprint count. The browser cannot confirm that paper was successfully printed.
- Events and operational data are associated with a business unit. The SQL migrations use RLS and restricted functions to enforce access.

Be careful not to count the same material purchase both as a product unit cost and as an event expense.

## Project structure

```text
src/app/                 Routes, layouts and auth callback
src/components/          Shared components and staff navigation
src/features/            Counter, tickets, orders, inventory, reports and settings
src/lib/domain/          Finance and inventory calculations
src/lib/permissions/     Authenticated workspace context
src/lib/supabase/        Supabase clients, queries and types
src/i18n/ + messages/    Vietnamese and English UI strings
supabase/migrations/     Four Phase 1 SQL migrations
supabase/seed.sql        Initial product catalogue
scripts/                 Owner bootstrap and database test runner
tests/                   Unit tests and SQL permission/operations assertions
```

## Tests

Run these from the repository root:

```powershell
npm test
npm run typecheck
npm run build
```

The current unit suite covers revenue, profit, stock calculations, formatting and translation-key parity.

Database tests require Docker and a locally available `postgres:17` image:

```powershell
docker pull postgres:17
npm run test:db
```

The database test runner starts an isolated PostgreSQL container, exercises migrations and permissions, and rolls back its test fixtures. It does not test Google OAuth, actual Supabase Realtime delivery or a real printer.

### Acceptance checks before live use

- Allowlisted Google accounts can sign in; unapproved accounts cannot access business data.
- Owner and staff restrictions work at the database level, not just in navigation.
- Registering, printing, advancing and cancelling tickets updates the authenticated TV display.
- An Unpaid order contributes no revenue; Paid contributes its amount; Refunded removes it.
- Inventory usage and reversal match an order's mapped supplies.
- Missing unit costs prevent misleading profit figures.
- Vietnamese, English, light/dark themes and 360px / desktop layouts work on real devices.
- Browser printing works with the actual receipt printer.
- Migrations, seed, backup and restore procedures have been tested against a disposable environment.

## Next priorities

Before opening the workshop, I want to focus on real Supabase integration, end-to-end acceptance tests, repeatable backups and CI checks. The current repository has tests but no committed GitHub Actions workflow.

Operational improvements to evaluate next are corrections to cost entries, explicit inventory adjustments/restocking, safer customer names on a public-facing TV and more robust event-level product controls.

Phase 2 can then cover customer history, exports, product-level cost analytics, cross-event comparisons and a separate public registration flow. The future coffee unit should be designed around its actual sales and shift workflow rather than assuming every coffee order is a workshop ticket.

## Deployment

The app is structured for Vercel with Next.js. Configure the three `NEXT_PUBLIC_*` values for each approved environment, update Supabase and Google OAuth redirect URLs, and run the acceptance checks above before enabling staff access.

No live deployment or operational readiness is claimed by this README.
