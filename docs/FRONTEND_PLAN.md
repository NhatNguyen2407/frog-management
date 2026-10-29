# Frontend V1 - Plan and Progress

Updated: 2026-10-29

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
| 1.2 | POS: per-line custom notes, stock validation, workshop-ticket rules | Accepted - 7/7 manual checks | 2026-10-26 |
| 1.3 | Orders: open/unpaid, paid, cancel/restock, refund, history | Accepted - 9/9 manual checks | 2026-10-26 |
| 1.4a | Compact customer bill, 76 x 130 mm label | Implemented - manual printer QA pending | 2026-10-28 |
| 1.4b | Staff preparation slip and dual-print flow | Implemented - manual QA pending | 2026-10-29 |
| 2.1 | Workshops: create/edit, capacity, registrations, check-in | Planned | - |
| 2.2 | Queue and inventory movements | Planned | - |
| 2.3 | Expenses and transaction-based dashboard | Planned | - |
| 3.1 | Reports, CSV export and customer history | Planned | - |
| 3.2 | Responsive/UX testing and code cleanup | Planned | - |
| 4 | Connect Supabase, authentication and deployment | Deferred | - |

## Completed increments

- 2026-10-26 - Step 1.1: Product catalogue with create/edit/archive/restore, duplicate SKU checks and historical order snapshots.
- 2026-10-26 - Step 1.2: Separate customization note per cart line, prevent overselling across multiple lines of the same SKU, and issue a workshop ticket only when the order contains a workshop product. Check event ticket capacity.
- 2026-10-26 - Step 1.2 accepted: 7/7 manual browser checks passed as reported by the project owner, covering per-item notes, stock limits, F&B-only and mixed orders, event capacity, data persistence and responsive/theme/language checks. Automated suite/build not independently verified in this review.

- 2026-10-26 - Step 1.3: Added payment confirmation, unpaid cancellation with stock restoration, refunds without restocking, order history/details, ticket updates and unit tests. Manual browser QA pending.
- 2026-10-26 - Step 1.3 accepted: 9/9 manual browser checks passed as reported by the project owner. Verified Unpaid to Paid, payment methods, unpaid cancellation/restocking, prevention of repeated cancellation, Paid refunds, prevention of repeated refunds, order details/history, ticket/queue handling, and UI/data persistence. Automated tests and full build were not independently rerun for this acceptance.

- 2026-10-27 - UI maintenance: Removed decorative backgrounds and borders around the official transparent Frog logo in sidebar, profile and Dashboard. Reformatted prototype stylesheets and normalized HTML asset grouping. Browser acceptance pending. No operational rules changed.

- 2026-10-28 - Step 1.4a: Added a compact customer bill preview for the 76 x 130 mm label, drawing on international cafe receipt conventions. Includes item snapshots, quantities, notes, line totals, payment state and order/workshop ID. Print preview does not mutate ticket status. Printer acceptance pending.

- 2026-10-29 - Step 1.4b: Built a staff preparation slip and two-page print preview for two 76 x 130 mm labels. Each label has the same order reference, but the staff slip excludes prices and financial details. Browser and device acceptance pending.
- 2026-10-29 - Formatting maintenance: Added a consistent Prettier configuration, npm formatting scripts and VS Code format-on-save settings. Historical TSX/JS source formatting remains pending until the formatter has run across the working tree.

## Remaining design decisions

- Free-text customization is intentional for V1; priced modifiers/variant definitions are not implemented yet.
- One workshop ticket per order is the current behavior. Multiple attendees in one order will be addressed alongside workshop registration in Step 2.1.
- V1 treats Unpaid as an open order. Cancelling is blocked after ticket work begins; refunds do not restock automatically and retain cost in mock profit.
- Local mock data is not transactional or synchronized between devices.
- Each completed step requires browser acceptance; keep test instructions in chat, not in this document.

## Run

Open `/prototype/index.html` and choose Products. Use Settings -> Reset demo data to discard browser-only changes. Run `npm test` to include product validation checks. No Supabase keys are required.

## Current limitations

This is a localStorage mock prototype, not a secured POS. Real login, multi-device sync and database integration are not yet in use.
