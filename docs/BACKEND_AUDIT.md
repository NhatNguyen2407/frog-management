# Sprint 4.1 - Backend Audit

Updated: 2026-11-10

## Scope and status

The initial backend audit was read-only. Phase 4.2 provisioned a dedicated Supabase project, deployed the migrations and seeded the catalogue. Phase 4.3 added approved accounts and verified database roles; the owner reports regular successful app testing. Phase 4.4a adds ticket attendance without seeding sales or tickets.

**Result: Authentication and check-in/undo have owner-reported acceptance plus independent database checks. Customer history and CSV exports are implemented and SQL-tested with deployed read models; their browser acceptance and remaining business integrations are pending.**

## Connected Supabase projects

- Dioxyzine Frog Database - active. Belongs to the existing e-commerce website.
- Dioxyzine Frog Staging - inactive. Belongs to the e-commerce testing environment.
- Frog Management - dedicated project `swkbnkazjxgvnhkwrcyx` is active in The Frog Art Space organization. Its current display name is `NhatNguyen2407's Project`.

I will not point Frog Management migrations at either Dioxyzine Frog project. A separate project avoids mixing the workshop POS with the online store.

## Existing repository implementation

- The standalone `public/prototype/` is the accepted browser-only UI. It uses localStorage and is not authenticated or connected to Postgres.
- The Next.js application in `src/` is a separate, database-oriented implementation. It uses Supabase SSR clients, a server-side workspace context, owner/staff permissions, data queries and server actions. Staff email/password has replaced social login.
- Seven SQL migrations exist under `supabase/migrations/`: core schema, security, operations, reporting, staff password authentication, ticket check-in and customer history/report read models. All seven versions match hosted migration history.
- Core schema defines 20 business tables, including units, staff allowlist, events, products, tickets, queue, orders, inventory movements, costs and audit log.
- Security migration defines row-level security, the staff allowlist Auth Hook, unit membership checks, role-based policies, guarded writes and audit triggers.
- Operations migration implements database functions for creating events, products and orders, ticket status/printing, payment transitions, inventory and checkout.
- Reporting migration defines six `security_invoker` views for paid sales, event financials, product revenue, revenue over time, inventory and operational status.
- `supabase/seed.sql` seeds one workshop business unit, two product categories and 11 sample products. It does not create events, accounts, order history or stock quantities.
- `.env.example` identifies the required public Supabase configuration, app URL and first-owner bootstrap settings. No social provider credentials are needed.

Hosted migration history and the deployed password authorization helpers were checked separately. Application behavior still needs end-to-end acceptance.

## Prototype-to-backend gaps to review

- **Check-in:** Phase 4.4a adds `tickets.checked_in_at`, a scoped registration view and guarded check-in/undo RPC. Automated SQL checks and owner-reported browser acceptance passed.
- **Customer history and exports:** Phase 4.4b adds cross-workshop Owner history/search and Orders/Revenue/Expenses CSV downloads with date/workshop filters. Read models, role isolation, CSV protection and pagination are tested. Browser acceptance of the new pages/downloads is pending.
- **Printing:** The prototype passed customer and staff dual-label testing on 76 x 130 mm paper. The separate Next.js receipt component provides a ticket print view, but not the same two-label customer/staff flow.
- **Inventory:** The prototype models product stock directly. The database has a more detailed materials model with event stock and product-to-supply mappings. This requires an explicit mapping of business rules rather than copying localStorage records.
- **Drafts:** The prototype saves unfinished POS orders by workshop. The Next.js Counter currently holds its cart in component state; draft persistence must be designed separately when migrating that workflow.

I will use the accepted prototype as the UX/functional reference while keeping the existing transactional schema and code where appropriate.

## Verification and security boundaries

- Owner-reported local checks for Sprint 3: 96/96 unit tests, TypeScript, Prettier and Next.js build passed.
- **4.1a accepted - 2026-11-09:** The project owner ran `npm run test:db` locally with the existing Docker PostgreSQL 17 container. The SQL suite returned `All Phase 1 database assertions passed`, followed by `ROLLBACK` and `Database schema and permission assertions passed; all test changes were rolled back.` This verifies the local schema/permission/operations assertions, not the hosted Supabase environment.
- Hosted schema, RLS, migration history, catalogue seed and advisors have been inspected. The owner configured Auth and accepts regular email/password sign-in and role behavior. The agent independently checked the three accounts and their database permissions, without using their passwords. Actual Realtime delivery still needs multi-device testing.
- The SQL includes scoped RLS and `security_invoker` views. Direct database checks covered Owner, Staff, unapproved access and spoofed role claims. New check-in behavior passed disposable PostgreSQL 17.5 tests; hosted browser acceptance remains pending.
- The browser-only prototype is not safe to use for real transactions. Two browser tabs updating localStorage are not a substitute for transaction-safe multi-device checkout.

## Execution plan

1. **4.1a - Local database test:** Run `npm run test:db` against the isolated Docker PostgreSQL 17 test environment. Investigate any failing migrations or assertions without touching the e-commerce databases.
2. **4.2 - Dedicated hosted project:** Choose the Supabase organization and check the project's quoted cost before creating a Frog Management project. Do not reuse either Dioxyzine Frog project.
3. **4.2b - Database bring-up:** Verify target, migration dry-run, apply the four migrations and catalogue seed, then inspect actual tables, RLS policies, functions, grants, migration history and database advisors.
4. **4.3 - Auth acceptance:** Disable public signups, activate the Before User Created Auth Hook, bootstrap the owner allowlist, provision confirmed email/password accounts and test Owner, Staff and unapproved access against real RLS.
5. **4.4 - Functional integration:** Compare Next.js business flows to the accepted prototype; prioritize missing check-in, customer history/export, two-label printing, draft recovery and inventory semantics without rebuilding working code.
6. **4.5 - Operational readiness:** Exercise concurrent orders and stock updates, Realtime across devices, printer output, backup/restore and deployment.

## Next action

Phases 4.3 and 4.4a are accepted based on owner-reported app testing and independent database checks. Phase 4.4b history/CSV is implemented with a deployed migration. Verify the new pages/downloads after the application update, then continue dual-label printing and POS drafts. Refer to `docs/PHASE4_PLAN.md` for the verification record.
