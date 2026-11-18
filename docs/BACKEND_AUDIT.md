# Sprint 4.1 - Backend Audit

Updated: 2026-11-18

## Scope and status

The initial backend audit was read-only. Phase 4.2 provisioned a dedicated Supabase project, deployed the migrations and seeded the catalogue. Phase 4.3 added approved accounts and verified database roles; the owner reports regular successful app testing. Phase 4.4a adds ticket attendance without seeding sales or tickets.

**Result: Authentication, check-in/undo and customer history/live search/CSV have browser acceptance alongside the recorded database checks. Phase 4.4b was accepted on 2026-11-15. Phase 4.4c saved-order labels/reprinting and Counter draft recovery are accepted on the main application as of 2026-11-18. Order/inventory parity remains open.**

## Connected Supabase projects

- Dioxyzine Frog Database - active. Belongs to the existing e-commerce website.
- Dioxyzine Frog Staging - inactive. Belongs to the e-commerce testing environment.
- Frog Management - dedicated project `swkbnkazjxgvnhkwrcyx` is active in The Frog Art Space organization. Its current display name is `NhatNguyen2407's Project`.

I will not point Frog Management migrations at either Dioxyzine Frog project. A separate project avoids mixing the workshop POS with the online store.

## Existing repository implementation

- The standalone `public/prototype/` is the accepted browser-only UI. It uses localStorage and is not authenticated or connected to Postgres.
- The Next.js application in `src/` is a separate, database-oriented implementation. It uses Supabase SSR clients, a server-side workspace context, owner/staff permissions, data queries and server actions. Staff email/password has replaced social login.
- Eight SQL migrations exist under `supabase/migrations/`: core schema, security, operations, reporting, staff password authentication, ticket check-in, customer history/report read models and scoped receipt selling prices. All eight versions match hosted migration history.
- Core schema defines 20 business tables, including units, staff allowlist, events, products, tickets, queue, orders, inventory movements, costs and audit log.
- Security migration defines row-level security, the staff allowlist Auth Hook, unit membership checks, role-based policies, guarded writes and audit triggers.
- Operations migration implements database functions for creating events, products and orders, ticket status/printing, payment transitions, inventory and checkout.
- Reporting migration defines six `security_invoker` views for paid sales, event financials, product revenue, revenue over time, inventory and operational status.
- `supabase/seed.sql` seeds one workshop business unit, two product categories and 11 sample products. It does not create events, accounts, order history or stock quantities.
- `.env.example` identifies the required public Supabase configuration, app URL and first-owner bootstrap settings. No social provider credentials are needed.

Hosted migration history and the deployed password authorization helpers were checked separately. Application behavior still needs end-to-end acceptance.

## Prototype-to-backend gaps to review

- **Check-in:** Phase 4.4a adds `tickets.checked_in_at`, a scoped registration view and guarded check-in/undo RPC. Automated SQL checks and owner-reported browser acceptance passed.
- **Customer history and exports:** Phase 4.4b adds cross-workshop Owner history/live search and Orders/Revenue/Expenses CSV downloads with date/workshop filters. Read models, role isolation, CSV protection and pagination are tested. Browser acceptance passed on 2026-11-15, including exported test data, invalid-date handling and Staff denial on both new pages.
- **Printing:** Phase 4.4c adds saved-order customer/preparation labels on named 76 x 130 mm pages, including F&B orders without tickets. Both Owner and Staff can print both copies or either separately. A membership-checked receipt RPC exposes saved selling prices per order without granting access to cost prices or financial reports. The preparation slip remains price-free. The path is read-only and retains the separate workshop-ticket print action. Unit, SQL permission, hosted Staff access, static-render, TypeScript and build checks passed. Staff printing both labels and read-only reprinting were accepted in the main application; oversized-label edge cases remain for final operational QA.
- **Inventory:** The prototype models product stock directly. The database has a more detailed materials model with event stock and product-to-supply mappings. This requires an explicit mapping of business rules rather than copying localStorage records.
- **Drafts:** The Next.js Counter now saves products, quantities, options, customer details, ticket selection and payment choices in sessionStorage, scoped by account, business unit and workshop in the current tab. Reload/navigation recovery and the operational draft workflow were accepted on 2026-11-18. Confirmed checkout clears the draft; closing the tab ends the draft session. Cross-account/workshop isolation and failure/retry scenarios remain in Phase 4.5.

I will use the accepted prototype as the UX/functional reference while keeping the existing transactional schema and code where appropriate.

## Verification and security boundaries

- Owner-reported local checks for Sprint 3: 96/96 unit tests, TypeScript, Prettier and Next.js build passed.
- **4.1a accepted - 2026-11-09:** The project owner ran `npm run test:db` locally with the existing Docker PostgreSQL 17 container. The SQL suite returned `All Phase 1 database assertions passed`, followed by `ROLLBACK` and `Database schema and permission assertions passed; all test changes were rolled back.` This verifies the local schema/permission/operations assertions, not the hosted Supabase environment.
- Hosted schema, RLS, migration history, catalogue seed and advisors have been inspected. The owner configured Auth and accepts regular email/password sign-in and role behavior. The agent independently checked the three accounts and their database permissions, without using their passwords. Actual Realtime delivery still needs multi-device testing.
- The SQL includes scoped RLS and `security_invoker` views. Direct database checks covered Owner, Staff, unapproved access and spoofed role claims. Check-in and history/reporting assertions passed on disposable PostgreSQL 17.5. Check-in browser acceptance is recorded under 4.4a; history/live search/CSV browser acceptance closed under 4.4b on 2026-11-15.
- The browser-only prototype is not safe to use for real transactions. Two browser tabs updating localStorage are not a substitute for transaction-safe multi-device checkout.

## Execution plan

1. **4.1a - Local database test:** Run `npm run test:db` against the isolated Docker PostgreSQL 17 test environment. Investigate any failing migrations or assertions without touching the e-commerce databases.
2. **4.2 - Dedicated hosted project:** Choose the Supabase organization and check the project's quoted cost before creating a Frog Management project. Do not reuse either Dioxyzine Frog project.
3. **4.2b - Database bring-up:** Verify target, migration dry-run, apply the four migrations and catalogue seed, then inspect actual tables, RLS policies, functions, grants, migration history and database advisors.
4. **4.3 - Auth acceptance:** Disable public signups, activate the Before User Created Auth Hook, bootstrap the owner allowlist, provision confirmed email/password accounts and test Owner, Staff and unapproved access against real RLS.
5. **4.4 - Functional integration:** Compare Next.js business flows to the accepted prototype; prioritize missing check-in, customer history/export, two-label printing, draft recovery and inventory semantics without rebuilding working code.
6. **4.5 - Operational readiness:** Exercise concurrent orders and stock updates, Realtime across devices, printer output, backup/restore and deployment.

## Next action

Authentication, check-in, customer history/CSV, dual-label printing/reprinting and Counter draft recovery are accepted based on the recorded checks and owner feedback. Review order/inventory parity, then continue with Phase 4.5 reliability, multi-device and backup/restore verification. Phase 4 remains in progress. Refer to `docs/PHASE4_PLAN.md` for the verification record.

## Dependency security maintenance - 2026-11-18

- Upgraded the pinned Next.js version from 16.4.3 to 16.4.6, including the matching environment/SWC packages in the lockfile. This includes the 16.4.5 security fixes and subsequent stable bug fixes. React and other application dependencies are unchanged.
- Upstream references: [16.4.5 security release](https://github.com/vercel/next.js/releases/tag/v16.4.5) and [16.4.6 release](https://github.com/vercel/next.js/releases/tag/v16.4.6).
- Post-upgrade npm audit no longer reports Next.js. It still reports two High dependency entries for one underlying [picomatch ReDoS advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), through next-intl > @parcel/watcher > picomatch 4.0.7. The advisory lists no patched version, and the registry still lists 4.0.7 as latest. This is an unresolved upstream dependency finding; it is not evidence that this application's customer inputs can exploit it. No forced dependency downgrade or security-warning suppression was applied.
- Verification passed: 113/113 tests, TypeScript, production build on Next.js 16.4.6 and repository formatting. HTTP smoke checks passed for Vietnamese/English sign-in pages, unauthenticated Counter/Orders/export/print redirects, private no-store caching and response security headers. These HTTP checks did not use a signed-in browser or repeat database transaction tests.
