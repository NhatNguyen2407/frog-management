# Sprint 4.1 - Backend Audit

Updated: 2026-11-09

## Scope and status

I reviewed the current GitHub repository and the Supabase projects accessible through the connected account. This is a read-only audit. I have not created a project, run hosted migrations, changed credentials or touched production data.

**Result: Repository backend exists and local database assertions passed; dedicated hosted infrastructure and end-to-end verification are still pending.**

## Connected Supabase projects

- Dioxyzine Frog Database - active. Belongs to the existing e-commerce website.
- Dioxyzine Frog Staging - inactive. Belongs to the e-commerce testing environment.
- Frog Management - no dedicated Supabase project is currently listed.

I will not point Frog Management migrations at either Dioxyzine Frog project. A separate project avoids mixing the workshop POS with the online store.

## Existing repository implementation

- The standalone `public/prototype/` is the accepted browser-only UI. It uses localStorage and is not authenticated or connected to Postgres.
- The Next.js application in `src/` is a separate, database-oriented implementation. It already uses Supabase SSR clients, Google sign-in, a server-side workspace context, owner/staff permissions, data queries and server actions.
- Four SQL migrations exist under `supabase/migrations/`: core schema, security, operations and reporting.
- Core schema defines 20 business tables, including units, staff allowlist, events, products, tickets, queue, orders, inventory movements, costs and audit log.
- Security migration defines row-level security, the Google allowlist Auth Hook, unit membership checks, role-based policies, guarded writes and audit triggers.
- Operations migration implements database functions for creating events, products and orders, ticket status/printing, payment transitions, inventory and checkout.
- Reporting migration defines six `security_invoker` views for paid sales, event financials, product revenue, revenue over time, inventory and operational status.
- `supabase/seed.sql` seeds one workshop business unit, two product categories and 11 sample products. It does not create events, accounts, order history or stock quantities.
- `.env.example` identifies the required public Supabase configuration, app URL, Google OAuth settings and first-owner bootstrap settings.

These are source-code findings, not proof that the migrations have been deployed successfully.

## Prototype-to-backend gaps to review

- **Check-in:** The accepted prototype tracks attendee check-in and undo independently of ticket preparation. The current SQL ticket schema has no check-in timestamp or dedicated check-in record.
- **Customer history and exports:** The prototype provides cross-workshop history, date-scoped reports and CSV exports. The Next.js sections currently reviewed do not provide equivalent functionality, so their scope must be checked before declaring feature parity.
- **Printing:** The prototype passed customer and staff dual-label testing on 76 x 130 mm paper. The separate Next.js receipt component provides a ticket print view, but not the same two-label customer/staff flow.
- **Inventory:** The prototype models product stock directly. The database has a more detailed materials model with event stock and product-to-supply mappings. This requires an explicit mapping of business rules rather than copying localStorage records.
- **Drafts:** The prototype saves unfinished POS orders by workshop. The Next.js Counter currently holds its cart in component state; draft persistence must be designed separately when migrating that workflow.

I will use the accepted prototype as the UX/functional reference while keeping the existing transactional schema and code where appropriate.

## Verification and security boundaries

- Owner-reported local checks for Sprint 3: 96/96 unit tests, TypeScript, Prettier and Next.js build passed.
- **4.1a accepted - 2026-11-09:** The project owner ran `npm run test:db` locally with the existing Docker PostgreSQL 17 container. The SQL suite returned `All Phase 1 database assertions passed`, followed by `ROLLBACK` and `Database schema and permission assertions passed; all test changes were rolled back.` This verifies the local schema/permission/operations assertions, not the hosted Supabase environment.
- A dedicated hosted project now exists, and its base schema, RLS enablement, migration history, catalogue seed and Security/Health Advisors have been inspected. Live Auth Hook activation, Google OAuth, role-based API access and actual Realtime delivery remain unverified.
- The SQL includes scoped RLS and `security_invoker` reporting views, but privileged functions and policies still require live security testing with owner, staff and unauthorized accounts.
- The browser-only prototype is not safe to use for real transactions. Two browser tabs updating localStorage are not a substitute for transaction-safe multi-device checkout.

## Execution plan

1. **4.1a - Local database test:** Run `npm run test:db` against the isolated Docker PostgreSQL 17 test environment. Investigate any failing migrations or assertions without touching the e-commerce databases.
2. **4.2 - Dedicated hosted project:** Choose the Supabase organization and check the project's quoted cost before creating a Frog Management project. Do not reuse either Dioxyzine Frog project.
3. **4.2b - Database bring-up:** Verify target, migration dry-run, apply the four migrations and catalogue seed, then inspect actual tables, RLS policies, functions, grants, migration history and database advisors.
4. **4.3 - Auth acceptance:** Configure Google OAuth and the Before User Created Auth Hook, bootstrap the owner allowlist, and test approved owner, staff and unapproved sign-ins against real RLS.
5. **4.4 - Functional integration:** Compare Next.js business flows to the accepted prototype; prioritize missing check-in, customer history/export, two-label printing, draft recovery and inventory semantics without rebuilding working code.
6. **4.5 - Operational readiness:** Exercise concurrent orders and stock updates, Realtime across devices, printer output, backup/restore and deployment.

## Next action

The new The_Frog_Art_Space project `swkbnkazjxgvnhkwrcyx` has been provisioned, migrated and seeded. The next action is migration history reconciliation and Phase 4.3 Google OAuth/owner allowlist testing. Refer to `docs/PHASE4_PLAN.md` for exact hosted migration versions and remaining security checks.
