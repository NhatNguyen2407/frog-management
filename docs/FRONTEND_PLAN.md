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

| Step | Deliverable | Status |
| --- | --- | --- |
| 1.1 | Product Management: list, search, create, edit, archive/restore | Implemented |
| 1.2 | POS: item modifiers, stock and workshop-ticket rules | Next |
| 1.3 | Orders: open/unpaid, paid, cancellations/refunds | Planned |
| 1.4 | Receipts and ticket flow | Planned |
| 2.1 | Workshops: create/edit, capacity, registrations, check-in | Planned |
| 2.2 | Queue and inventory movements | Planned |
| 2.3 | Expenses and transaction-based dashboard | Planned |
| 3.1 | Reports, CSV export and customer history | Planned |
| 3.2 | Responsive/UX testing and code cleanup | Planned |
| 4 | Connect Supabase, authentication and deployment | Deferred |

## Step 1.1 - Acceptance

- Add a workshop/F&B product with a unique SKU, name, price and cost.
- Edit product details without changing its SKU.
- Archive/restore a product; archived items disappear from POS, not from past orders.
- Keep quantity changes in Inventory, not Product Management.
- An owner can edit the catalogue; staff preview cannot.
- Check both themes and mobile layout before calling visual QA complete.

## Run

Open `/prototype/index.html` and choose Products. Use Settings -> Reset demo data to discard browser-only changes. Run `npm test` to include product validation checks. No Supabase keys are required.

## Current limitations

This is a localStorage mock prototype, not a secured POS. Real login, multi-device sync and database integration are not yet in use.
