# Main-app acceptance checklist

Updated: 2026-11-20

I am testing the Next.js/Supabase application at `/vi`, using one counter computer. The standalone `/prototype/index.html` is a separate demo. Multi-device concurrency and cross-session Realtime acceptance are deferred.

## Accepted checks

| Case                                              | Result                                                                | Date       |
| ------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| TC01 - Rapid repeated checkout clicks             | PASS - one order/ticket and one stock deduction                       | 2026-11-20 |
| TC02 - Refresh/navigation after checkout          | PASS - no duplicate order or stock deduction; completed draft cleared | 2026-11-20 |
| TC03 - Offline before submit, reconnect and retry | PASS - failed checkout kept its draft; one successful retry           | 2026-11-20 |

These are owner-reported browser results. They do not prove recovery from a server-committed transaction whose response was lost, a full process restart or a hosted backup restore.

## Preparation for the remaining browser checks

- Pull the current main branch and restart the app. The ticket-workflow migration is applied to the dedicated Frog Art Space project by the maintainer.
- Use a separate active QA workshop and test products. Start with capacity 3; the capacity test below uses a second workshop with capacity 1.
- Use one workshop product priced at 100,000 VND with known unit cost 40,000 VND, and one F&B product priced at 25,000 VND with known unit cost 5,000 VND. Use new QA SKUs if existing sold-SKU prices are locked.
- Set each product's physical stock to 10 in each QA workshop using Inventory > Edit stock > Adjust. Record each case's starting stock and financial totals. New SKUs isolate the test from earlier sales.
- All cases below are pending until I report their actual browser results. Refresh the page to verify saved state; ordinary browser tests should not delete existing shop records.

## Remaining browser cases

| Case                                        | Action                                                                                                                                                                                                                                                                           | Expected result                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA04 - Complete workshop journey            | At Counter, select a new ticket and one workshop product, quantity 1, Unpaid. Check Tickets, then pay by cash. Print both order labels, check in, use Tickets to move to Waiting, then Queue to In progress and Completed. Refresh.                                              | Before payment, check-in and preparation advancement are unavailable. After payment they work. No third legacy ticket print is required. One order/ticket remains; total is 100,000 VND; stock falls by exactly 1. Printing, check-in and queue transitions do not deduct more stock or add revenue. Completion survives refresh.                             |
| QA05 - Refund lifecycle                     | Create another Paid workshop order and move its ticket to Waiting, then refund it. Also refund the completed order from QA04.                                                                                                                                                    | The unfinished refunded ticket becomes Cancelled and leaves the active queue. The completed ticket keeps Completed and its history. Each refunded order contributes no Paid revenue; neither refund restores physical stock automatically. Repeated refunds cannot apply again.                                                                               |
| QA06 - Edit an Unpaid order                 | Create an Unpaid no-ticket order with two separate product lines. Increase one quantity from 1 to 2, then reduce it to 1; remove the other line. Attempt an over-stock quantity and finally pay.                                                                                 | Only quantity differences affect stock; removing a line restores its recorded usage. The last remaining line cannot be removed. An over-stock edit is rejected without partial changes. The bill matches the saved lines/prices. Paid lines are locked against further editing.                                                                               |
| QA07 - Capacity, F&B and workshop isolation | In a second QA workshop with capacity 1, create one Unpaid ticket. Try a second ticket, then cancel the first order and retry. While that workshop is full, create a Paid F&B order with customer mode None. Switch between the two workshops.                                   | The second ticket is blocked until the first order/ticket is cancelled; cancelled stock is restored once. Paid F&B without a ticket succeeds without adding a queue entry or using a seat. Orders, tickets, stock and expenses follow the selected workshop.                                                                                                  |
| QA08 - Financial reconciliation             | In a clean QA workshop, create one Paid workshop order for 100,000 VND, one Paid F&B order for 25,000 VND, and one Unpaid order. Add an event expense of 10,000 VND. Compare Overview and the Revenue/Expenses CSVs for that workshop/date. Then refund only the Paid F&B order. | Before refund: Paid revenue 125,000 VND, known COGS 45,000 VND, event expense 10,000 VND, profit 70,000 VND. After refund: Paid revenue 100,000 VND, Paid-item COGS 40,000 VND, expense 10,000 VND, profit 50,000 VND. Unpaid sales stay outside revenue. Refund does not restore stock. Use payment date for Revenue and recorded expense date for Expenses. |
| QA09 - Long receipt content                 | Use a QA order with several separate customized lines and long allowed option text until its selected label no longer fits 76 x 130 mm. Open the saved-order print page and switch label modes.                                                                                  | A selected oversized label shows the overflow warning and disables the app's Print button. It must not silently clip content. A mode whose selected label fits can still print. No new order or stock deduction occurs while previewing/reprinting.                                                                                                           |

Refund here records an internal payment-state change; any actual cash/bank refund is handled at the counter.

## Readiness checks still open

- Restart the app process with an unfinished draft, then verify draft recovery and already-saved records on the same browser tab.
- Reconcile a checkout with an uncertain response before retrying. A network error alone does not prove the database rejected it.
- Demonstrate backup and restore of the Frog Management database in a separate disposable target, including the data/roles needed by the app. Do not restore over the live project. CSV reports are not a complete database backup.
- Run the production build/start workflow on the counter machine and verify sign-in, a QA checkout and printing. The existing `npm run dev` workflow is development mode.
- Review the dependency findings recorded in BACKEND_AUDIT.md and complete final automated checks before accepting Phase 4.

The automated SQL journey supports QA04-QA08. It does not validate the real browser layout, actual printer overflow, real password entry or backup recovery.
