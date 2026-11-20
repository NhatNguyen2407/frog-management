# Frog Management

A staff-only management app for The Frog Art Space. I'm building it to replace the workshop spreadsheets with one place to manage events, counter sales, tickets, the live queue, inventory, expenses and financial reporting.

The first business unit is a creative workshop with a small F&B catalogue. The data model supports additional business units later, but a coffee-specific workflow has not been built.

## Project status

**The browser-only frontend prototype has completed Sprint 3 acceptance testing. The separate Next.js/Supabase backend implementation has not yet passed hosted end-to-end acceptance.**

The repository contains Next.js screens, SQL migrations, a seed catalogue and automated tests, alongside the standalone mock POS prototype. The Sprint 3 prototype review recorded 96/96 automated tests and 5/5 follow-up edge cases passing. Those recorded results are not a fresh execution of the suite, nor proof of backend or live multi-device readiness.

The dedicated The Frog Art Space Supabase project has aligned migrations and a seeded catalogue. The main app has owner-reported acceptance for email/password roles, ticket check-in/undo, customer history/live search/CSV, physical dual-label printing/reprinting, Counter draft recovery and the five-step order/stock flow. Single-machine duplicate submission, post-checkout refresh and offline/retry checks were accepted on 2026-11-20. The current operating scope is one counter computer; multi-device concurrency and cross-session Realtime acceptance are deferred. Final linked-workflow browser QA, receipt overflow, backup/restore and production-mode startup remain open. The standalone prototype works without Supabase but is not suitable for real sales. Without Supabase environment variables, the Next.js app shows a setup screen.

This is an internal application, not an online store. There are no customer accounts, online payments or public registration pages in Phase 1.

## Features

| Area                 | What is implemented                                                             | Access       |
| -------------------- | ------------------------------------------------------------------------------- | ------------ |
| Events               | Create events, set capacity and ticket prefix, switch active context            | Owner        |
| Products             | SKU catalogue, event availability, prices and unit costs                        | Owner        |
| Counter              | Create orders with workshop and F&B items, optional ticket registration         | Owner, staff |
| Tickets              | Sequential numbers, status history, paid-ticket check-in/undo, receipt printing | Owner, staff |
| Queue                | Operational queue and a separate TV display with Supabase Realtime subscription | Owner, staff |
| Orders               | Paid, Unpaid, Refunded and Cancelled statuses; cash or bank transfer            | Owner, staff |
| Inventory            | Product stock in/out/adjust, thresholds and movement history; advanced recipes  | Owner        |
| Costs                | Record event expenses by category and date                                      | Owner        |
| Customer history     | Search separate orders across workshops by name, phone, order or ticket         | Owner        |
| CSV reports          | Orders, paid revenue and expenses with workshop and Vietnam-date filters        | Owner        |
| Dashboard            | Paid revenue, costs, profit, margin, category breakdown and charts              | Owner        |
| Operations dashboard | Queue and ticket counts without financial reporting                             | Staff        |
| Settings             | Allowlisted staff email accounts and owner/staff roles                          | Owner        |

The TV display requires an authenticated staff session. It is not a public screen.

## Stack

- Next.js 16 App Router, React 19 and TypeScript
- Tailwind CSS 4 and shadcn/ui-style components
- Supabase Postgres, Email/Password Auth, RLS and Realtime
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

| Variable                               | Used for                                          |
| -------------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project API URL                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key                      |
| `NEXT_PUBLIC_SITE_URL`                 | App origin, e.g. `http://localhost:3000`          |
| `INITIAL_OWNER_EMAIL`                  | Email used by the optional owner bootstrap script |
| `INITIAL_BUSINESS_UNIT_SLUG`           | Initial unit, normally `workshop`                 |

Staff credentials are provisioned in Supabase Authentication. Never commit `.env.local`, passwords or a service-role key. The web app does not require a service-role key.

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

### 3. Provision email/password staff accounts

- Enable the Email provider and disable public signups in Supabase Auth. Keep social providers disabled.
- Add the first owner email to `staff_allowlist`, then create the matching confirmed email/password user in Supabase Authentication > Users.
- Add staff emails through Settings and provision their login accounts separately in Supabase Auth > Users. The allowlist does not create authentication users.
- Enable the Before User Created Auth Hook using `public.before_user_created` to enforce the approved email list.
- See [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md) for the complete onboarding and testing procedure.

For a new hosted project, add the initial owner email using the Supabase SQL Editor:

```sql
insert into public.staff_allowlist (business_unit_id, email, role, active)
select id, lower('YOUR_OWNER_EMAIL'), 'owner', true
from public.business_units
where slug = 'workshop'
on conflict (business_unit_id, email)
do update set role = 'owner', active = true;
```

The repository also includes an owner allowlist bootstrap script, but it does not create an Auth user. See the onboarding guide before provisioning passwords.

## How the numbers work

- All money values are stored as integer VND, with locale-aware display formatting.
- Revenue includes **Paid** orders only. Unpaid, Refunded, Cancelled and soft-deleted orders contribute no revenue.
- Order items retain sale-time SKU, name, category, price and unit-cost snapshots. A price change to a sold SKU requires a new SKU.
- Profit = Paid revenue - cost of goods for Paid items - event operating costs. If a sold item's unit cost is missing, profit and margin are shown as unavailable.
- An order can contain both workshop and F&B items.
- Stock usage is recorded for non-cancelled orders, including Unpaid and Refunded orders. Cancelling, soft-deleting or voiding an item reverses the corresponding recorded usage. A refund does not imply a physical return.
- Ticket numbers are generated per event. Paid tickets can move from Registered or Ticket printed to Waiting, then In progress and Completed. All live linked orders must be Paid to advance preparation. Attendance remains a separate paid-ticket check-in/undo operation.
- Cancelling/refunding or archiving a linked order cancels its unfinished ticket and queue entry; completed preparation history is retained. Cancelling an Unpaid order after preparation started is rejected.
- Saved-order customer/preparation labels are read-only and do not advance the queue or count ticket prints. The separate legacy workshop-ticket print action records print requests/reprints. The browser cannot confirm physical paper output.
- Events and operational data are associated with a business unit. The SQL migrations use RLS and restricted functions to enforce access.

Be careful not to count the same material purchase both as a product unit cost and as an event expense.

## Project structure

```text
src/app/                 Routes, layouts and login
src/components/          Shared components and staff navigation
src/features/            Counter, tickets, orders, inventory, reports and settings
src/lib/domain/          Finance and inventory calculations
src/lib/permissions/     Authenticated workspace context
src/lib/supabase/        Supabase clients, queries and types
src/i18n/ + messages/    Vietnamese and English UI strings
supabase/migrations/     Versioned SQL migrations
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

The current unit suite covers revenue, profit, stock calculations, formatting, report dates, CSV safety/pagination and translation-key parity. The separate SQL suites exercise database operations, permissions, check-in and report read models.

Database tests require Docker and a locally available `postgres:17` image:

```powershell
docker pull postgres:17
npm run test:db
```

The database test runner starts an isolated PostgreSQL container, exercises migrations and permissions, and rolls back its test fixtures. It does not test hosted password sign-in, actual Supabase Realtime delivery or a real printer.

### Acceptance checks before live use

- Approved email/password accounts can sign in; unapproved accounts cannot access business data.
- Owner and staff restrictions work at the database level, not just in navigation.
- Registering, printing, advancing and cancelling tickets updates the authenticated TV display.
- An Unpaid order contributes no revenue; Paid contributes its amount; Refunded removes it.
- Inventory usage and reversal match an order's mapped supplies.
- Missing unit costs prevent misleading profit figures.
- Vietnamese, English, light/dark themes and 360px / desktop layouts work on real devices.
- Browser printing works with the actual receipt printer.
- Migrations, seed, backup and restore procedures have been tested against a disposable environment.

## Next priorities

The next check is the linked main-app business workflow: Counter, payment, ticket/check-in, queue and completion, followed by refund/item edits, capacity/workshop isolation and expense/report reconciliation. The paid-production/cancellation guards have automated SQL coverage; their browser acceptance is pending. See [docs/MAIN_APP_QA.md](docs/MAIN_APP_QA.md) for the remaining checklist.

After that, verify long-label handling, backup/restore and production-mode startup on the counter computer. Multi-device acceptance is deferred. Review the tracked dependency security findings before release. The current repository has tests but no committed GitHub Actions workflow.

Future work may add expense correction controls, product-level cost analytics, cross-event comparisons and a separate public registration flow. A coffee-specific workflow remains out of scope.

For the current backend audit, see [docs/BACKEND_AUDIT.md](docs/BACKEND_AUDIT.md). It distinguishes code already in the repository from the database and hosting checks still pending.

## Deployment

The app is structured for Vercel with Next.js. Configure the three `NEXT_PUBLIC_*` values for each approved environment, configure Supabase email/password and project settings, and run the acceptance checks above before enabling staff access.

No live deployment or operational readiness is claimed by this README.

## Frontend-first prototype

The visual POS prototype is available at **/vi/prototype** (or **/en/prototype**) after starting Next.js with `npm run dev`. The standalone static entry is `/prototype/index.html`.

- No Supabase credentials or login are needed for the prototype.
- Explore Dashboard, Register, Orders, Workshops, Ticket Queue / TV mode, Inventory, Reports and Settings.
- Add products to a mock cart, create sample orders and workshop tickets, advance the queue, refund sample orders and edit mock stock.
- Toggle Vietnamese/English and light/dark themes. The color tokens follow Dioxyzine Frog's cream, mint, lilac and grape palette.
- Mock changes are kept in your browser's `localStorage`. Use Settings -> Reset demo data to restore initial values.
- The prototype is a standalone, dependency-free UI experiment; existing production-focused app screens and Supabase migrations remain unchanged. It is **not** secured by Supabase RLS, and should **never** be used to record real sales or customer information.

Phase 4 backend work is tracked in [docs/PHASE4_PLAN.md](docs/PHASE4_PLAN.md).

Frontend V1 is tracked in [docs/FRONTEND_PLAN.md](docs/FRONTEND_PLAN.md). The accepted Sprint 3 prototype includes product management, line-level customization, stock limits, order/payment transitions, workshop registration and check-in, queue and inventory movements, expenses, workshop-scoped reports, CSV export, customer history, responsive UX, and per-workshop draft autosave. Those are browser-local features, not verified Supabase transactions.
