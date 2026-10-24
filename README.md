# The Frog Operations — Phase 1

Private staff operations for events, counter orders, tickets, a live queue, inventory, costs and owner reporting. Built with Next.js App Router, TypeScript, Tailwind CSS, owned shadcn/ui components, Supabase, next-intl and Recharts.

## Delivery status

- All Phase 1 screens and database migrations are implemented.
- The production build, calculation/formatting/translation tests, and isolated Postgres database assertions have passed.
- No hosted Supabase project has been connected, linked or modified. This was intentionally deferred by the owner.
- Live Google OAuth, Supabase Realtime delivery, physical receipt printing and authenticated device acceptance tests remain to be verified after the new project is configured. Database tests use actual Postgres RLS with minimal test-only Auth interfaces; they do not simulate a successful Google login.
- Without environment settings the app renders a translated, private workspace setup screen. There is no demo login, seeded staff account or authentication bypass.

## Run the app now

Requirements: Node.js 24+, npm, and the approved packages in `package-lock.json`.

```powershell
npm ci --ignore-scripts
npm run dev
```

Open http://localhost:3000. Vietnamese is the default (`/vi`); English uses `/en`. `/display` redirects to the Vietnamese TV route, and the language-aware navigation opens the selected locale's display route.

The connection-pending screen works without Supabase configuration. To run the operational screens, complete the connection steps below.

```powershell
npm run build
npm start
```

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local` or put secret/service-role keys in browser code. The application does not require a service-role key: user requests retain their own RLS permissions.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | New project's Supabase API URL, or local URL reported by the CLI |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key; never a secret or service-role key |
| `NEXT_PUBLIC_SITE_URL` | Exact app origin; `http://localhost:3000` locally, deployed HTTPS origin on Vercel |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Google OAuth client ID for local Supabase CLI |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Google OAuth secret for local Supabase CLI only |
| `INITIAL_OWNER_EMAIL` | Google email used by the explicit owner bootstrap command |
| `INITIAL_BUSINESS_UNIT_SLUG` | Bootstrap unit; `workshop` after seeding |

The intended initial owner is `john.bibibi@gmail.com`, as supplied during setup planning. It has **not** been inserted into any hosted database. Set `INITIAL_OWNER_EMAIL` when ready; further team emails can be managed by an owner in Settings.

## Connect a new hosted Supabase project later

Use a new project chosen for this app. Do not run these commands against either existing Dioxyzine Frog project without a separate instruction.

1. Create/select the new Supabase project, then authenticate the installed Supabase CLI and link this folder using that project's reference:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_NEW_PROJECT_REFERENCE
   supabase db push
   ```

2. Run `supabase/seed.sql` with the new project's SQL Editor, or through the linked CLI:

   ```powershell
   supabase db query --linked --file supabase/seed.sql
   ```

   The seed is idempotent and includes one Workshop business unit, Workshop/F&B categories and exactly the requested 11 products and prices. Unknown unit costs are null. It includes no costs, stock counts, events, customers or staff accounts.

3. In Supabase Auth, enable **Google only**. Disable email/password, anonymous sign-ins and other identity providers. In Google Cloud create a web OAuth client and add the Supabase callback URL shown by the provider configuration. Store the Google credentials in Supabase's provider settings.
4. Set Supabase Auth's Site URL to the app origin and allow the exact app callback URL: `http://localhost:3000/auth/callback` locally, plus the deployed origin's `/auth/callback` when deploying. The app callback accepts a locale query parameter.
5. In Auth Hooks, enable **Before User Created** and select `public.before_user_created`. This rejects accounts outside the active email allowlist before account creation. Ongoing RLS also checks active membership, including for already-issued tokens.
6. Fill in the project URL, publishable key and app origin in `.env.local`.
7. Bootstrap the initial owner only after verifying the linked project:

   ```powershell
   npm run db:bootstrap -- --linked
   ```

   This inserts an owner allowlist entry. It does not create a Google account. Then sign in normally with that approved account.
8. Check that `queue_entries` is in the `supabase_realtime` publication. The security migration adds it. No customer phone numbers, item options, financial ledgers or audit payloads are published.
9. Run the new project's Supabase security/performance advisors and the acceptance checklist below before staff use.

After migrations have been applied, do not edit those migration files. Schema changes need approval and a new migration.

## Optional full local Supabase

Requires Docker Desktop, the Supabase CLI, and Google's local OAuth configuration. Supply the Google variables to the shell/CLI environment. In PowerShell you can set them for the current session; do not paste them into source files or commit them.

```powershell
supabase start
supabase status
```

Use the local API URL and browser-safe key reported by `supabase status` in `.env.local`. The CLI applies the migrations and catalogue seed to the new local stack on first start. Its configured Google signup hook is enabled by `supabase/config.toml`.

```powershell
npm run db:seed
npm run db:bootstrap
npm run dev
```

`db:seed` re-runs only the catalogue seed; it does not reset a database. Do not use `supabase db reset` against a database whose data you need to preserve.

## First event

1. Sign in as owner and enter known unit costs in Products **before creating test sales**.
2. Create an event in Events. Set its date, capacity and ticket prefix. New events start active and include all currently active products.
3. Select the event in the global header. The chosen business unit and event are validated on each request.
4. Add inventory items, enter preparation counts and thresholds, then connect products to the supplies they consume. No material usage is guessed from workshop-specific product names.
5. Add any staff Google emails through Settings. Choose the staff role when they should only use counter operations, orders, tickets and the queue.
6. Use Counter to combine Workshop and F&B items. Optional details are stored as JSONB on each order item. A new ticket and its Unpaid or Paid order are created in one transaction.

## Operational rules

- Money is stored as integer VND. Vietnamese displays `1.000.000 ₫`, English `1,000,000 ₫`. Dates display `dd/MM/yyyy`; timestamps and reporting buckets use `Asia/Ho_Chi_Minh`.
- Revenue includes only Paid orders that are not soft-deleted, and only non-voided items. Unpaid, Refunded and Cancelled orders contribute no revenue.
- Prices, SKU, product name, category and unit cost are snapshotted at order creation. Sold SKU prices are database-locked; use a new SKU for a new price. Updating current unit cost does not rewrite historical cost snapshots.
- Profit = Paid revenue − snapshotted costs of Paid items − event operating costs. Missing sold-item unit costs leave profit/margin incomplete. Event costs should not repeat purchases already represented in unit costs.
- Unpaid, Paid and Refunded orders consume mapped physical stock. Payment alone does not consume stock again. Cancelled orders, soft-deleted orders and voided items reverse their usage. Quantity edits apply only the difference.
- A refund records money being returned; it does not imply a physical stock return. The confirmation dialog explains this.
- Null stock preparation means **not entered**; zero means **none prepared**. Negative remaining stock is visible as Out rather than silently clamped to zero.
- Stock mappings are snapshotted per order item. Editing a mapping affects future items; it does not recalculate old orders.
- Ticket flow is Registered → Ticket printed → Waiting → In progress → Completed. Any non-terminal ticket can be Cancelled. Ticket cancellation and order/payment cancellation are separate, important for mixed Workshop/F&B orders.
- The first print request changes Registered to Ticket printed. Reprints increase the print counter. Browser print APIs cannot confirm physical printer success, so the counter records print requests.
- Orders are archived with `deleted_at`; application roles have no hard-delete grant.
- Staff can see current sale prices and the checkout amount for an Unpaid order, or the immediate result of an order they just create. They cannot query the protected historical financial ledger, unit costs, cost rows, owner reports or financial audit data. The staff dashboard contains operational counts only. As in any counter system, staff may infer business activity from operational information they are allowed to handle.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

The Node test suite covers revenue inclusion/exclusion, mixed categories, profit, unknown unit costs, zero revenue, negative profit, safe integer money, stock deductions/reversals, idempotent adjustments, missing-versus-zero stock, fractional supplies, exact VND formatting, Vietnam date boundaries and translation-key parity.

### Isolated database tests

Requires Docker and the standard `postgres:17` image. The runner refuses to download an image implicitly; if it is not already available, explicitly obtain it first:

```powershell
docker pull postgres:17
npm run test:db
```

The runner uses an isolated container named `frog-operations-phase1-tests`, no published ports, and no container network. It loads minimal test-only Supabase Auth interfaces, the real migration SQL and disposable fixtures inside one transaction. Every schema/data change is rolled back, and the container is stopped. It does not apply migration history or modify a hosted project.

Assertions exercise actual Postgres permissions/RLS as owner, staff, non-allowlisted, revoked and anonymous users. They cover private financial tables/views, mutation restrictions, cross-unit access, signup allowlist, last-owner protection, ticket transitions/printing, duplicate-submit protection, SKU/cost snapshots, stock edits/reversals and Paid-only reports.

### Acceptance checklist after connecting the new project

| Done item | How to verify |
| --- | --- |
| Approved staff signs in, outsider is blocked | Bootstrap owner, add a second Google email as staff, sign in with it. Try a third non-allowlisted account; expect rejection. Remove staff access and confirm existing tokens can no longer read records. |
| Ticket → print → full queue flow | Open `/display` in another authenticated window with the same event selected. Register a ticket, open Print, request printing, then move it through Waiting, In progress and Completed. Check the TV updates without reloading. Cancel another ticket and verify it disappears. |
| Payment controls revenue | Create a known-price Unpaid order. Confirm zero contribution to the owner report. Mark it Paid, verify its exact total, then mark Refunded and verify that contribution disappears. Cancel another Unpaid order and verify zero contribution. |
| Database role restrictions | Run `npm run test:db`. In the configured project, use a staff session's publishable-key client to query `product_costs`, `order_item_financials`, `costs`, `audit_log`, `event_financials`, `product_revenue` and `revenue_over_time`; expect zero rows. Attempt owner mutations; expect denial. Do not test with service-role credentials. |
| Inventory | Prepare 10 units, map one unit per product, and create an Unpaid order for two. Remaining stock becomes 8; paying keeps 8. Cancelling an Unpaid order restores its usage, while refunding retains physical usage. Test blank, zero and low-threshold counts. |
| Vietnamese/English and responsive layouts | Use browser device tools at 360px and 1920px. Check Counter, ticket actions, Orders, navigation, forms, the owner/staff dashboards and TV display in both languages and both themes. Confirm no page-wide horizontal overflow and keyboard focus visibility. |
| Receipt | Use 80mm paper in the browser's print settings, print at 100% scale and inspect the 72mm content width. Test first print, reprint and cancelling the browser dialog; counters represent requests. |
| Local setup | Follow the steps above from a fresh dependency install; `.env.local` remains ignored and the seed creates no customers or costs. |
| Calculations | `npm test` passes; compare a known Paid order, its snapshotted costs and one operating expense with the owner dashboard. |

## Vercel deployment

Import this folder as a Next.js project. Use Node.js 24 and the `npm run build` command. Set the three `NEXT_PUBLIC_*` values separately for Preview and Production. Configure Google/Supabase redirect URLs for each approved deployment origin; do not put Google OAuth secrets into public environment variables. No deployment has been created by this task.

## Files

```text
src/app/                     App Router pages, auth callback, global styles
src/components/ui/           Owned shadcn/ui components using Radix and Tailwind
src/components/layout/       Responsive staff shell and event selector
src/features/                Counter, catalogue, tickets, queue, orders,
                             inventory, costs, settings and dashboard
src/lib/domain/              Pure finance and stock calculations
src/lib/supabase/            Typed clients and queries
src/lib/permissions/         Validated request context
src/i18n/ + messages/        Vietnamese/English routing and all UI copy
supabase/migrations/         Four ordered Phase 1 SQL migrations
supabase/seed.sql            Exact supplied product catalogue
tests/ + scripts/            Calculation/RLS tests and explicit owner bootstrap
```

## Phase 2 — not implemented

Product cost analytics, customer history, exports, multi-event comparisons and a public registration page, subject to separate scope and access review. No online payment, customer account, public storefront, messaging integration or coffee-specific module is included in Phase 1.
