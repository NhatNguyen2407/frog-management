# Frontend V1 - Plan and Progress

Updated: 2026-10-26

## Goal

Build a small internal POS for The Frog Art Space, starting with workshops and optional F&B. Complete the frontend using mock data before connecting the existing Supabase backend. Keep the code small and keep historical sales records intact.

## Working principles

- Use `main` for small, verified increments; create branches only when necessary.
- Keep the Dioxyzine Frog visual identity.
- Archive products instead of deleting sales history.
- Separate product prices from stock adjustments and order records.
- Add automated tests for business rules and update this plan after each increment.
- Mock data is not suitable for recording real transactions.

## Progress

| Step | Deliverable | Status | Implemented on |
| --- | --- | --- | --- |
| 1.1 | Product Management: list, search, create, edit, archive/restore | Code complete | 2026-10-26 |
| 1.2 | POS: per-line custom notes, stock validation, workshop-ticket rules | Code complete, manual QA pending | 2026-10-26 |
| 1.3 | Orders: open/unpaid, paid, cancellations/refunds | Next | - |
| 1.4 | Receipts and ticket flow | Planned | - |
| 2.1 | Workshops: create/edit, capacity, registrations, check-in | Planned | - |
| 2.2 | Queue and inventory movements | Planned | - |
| 2.3 | Expenses and transaction-based dashboard | Planned | - |
| 3.1 | Reports, CSV export and customer history | Planned | - |
| 3.2 | Responsive/UX testing and code cleanup | Planned | - |
| 4 | Connect Supabase, authentication and deployment | Deferred | - |

## Completed increments

- 2026-10-26 - Step 1.1: Product catalogue with create/edit/archive/restore, duplicate SKU checks and historical order snapshots.
- 2026-10-26 - Step 1.2: Separate customization note per cart line, prevent overselling across multiple lines of the same SKU, and issue a workshop ticket only when the order contains a workshop product. Check event ticket capacity.

## Remaining design decisions

- Free-text customization is intentional for V1; priced modifiers/variant definitions are not implemented yet.
- One workshop ticket per order is the current behavior. Multiple attendees in one order will be addressed alongside workshop registration in Step 2.1.
- Local mock data is not transactional or synchronized between devices.
- Each completed step requires browser acceptance; keep test instructions in chat, not in this document.

## Run

Open `/prototype/index.html` and choose Products. Use Settings -> Reset demo data to discard browser-only changes. Run `npm test` to include product validation checks. No Supabase keys are required.

## Current limitations

This is a localStorage mock prototype, not a secured POS. Real login, multi-device sync and database integration are not yet in use.
