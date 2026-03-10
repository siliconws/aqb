# Code Audit

| # | File | Location | Severity | Category | Description | Correct Fix |
|---|------|----------|----------|----------|-------------|-------------|
| 1 | app/api/v1/reconcile/route.ts | `POST` SQL insert | Critical | Security | Raw string interpolation in SQL (`notes`) allows injection risk. | Use parameterized queries or Drizzle query builder for insert values. |
| 2 | app/api/v1/reconcile/route.ts | `GET` SQL select by `id` | Critical | Security | Raw interpolation of `id` in SQL allows injection risk. | Use parameterized queries or typed `where(eq(...))` filters. |
| 3 | app/api/v1/reconcile/route.ts | `POST` error response | High | Compliance | Returns `error.stack` to client, leaking internals. | Return generic client-safe error; log detailed stack server-side only. |
| 4 | lib/services/reconciliation/reconciler.ts | `findMatch()` | High | Logic | Initial amount-only matching could pair wrong transactions with same amount. | Match on stable reference key (`externalRef` vs `reference`/`transactionId`) + currency + amount. |
| 5 | lib/services/reconciliation/reconciler.ts | totals/delta calculations | High | Logic | Float arithmetic for money can produce precision errors. | Convert money to integer cents for compare/aggregate, then convert to dollars for output. |
| 6 | lib/services/reconciliation/reconciler.ts | discrepancy handling loop | High | Logic | Discrepancies were not populated in initial implementation. | Detect mismatch candidates and push `Discrepancy` records with `amountDelta`. |
| 7 | lib/services/reconciliation/reconciler.ts | period totals source | Medium | Logic | Total bank amount could include out-of-period records if not consistently filtered. | Compute totals/unmatched using period-filtered bank records only. |
| 8 | lib/services/reconciliation/reconciler.ts | `parseBankDate()` | Medium | Logic | Timezone normalization for bank dates is not explicit. | Parse/normalize with agreed timezone policy before period check. |
| 9 | lib/services/reconciliation/reconciler.ts | reconciliation execution flow | High | Logic | Same-period parallel runs can race on updates (`markReconciled`). | Add transaction/locking or idempotent run guard per period. |
| 10 | components/reconciliation/ReconciliationDashboard.tsx | `useEffect()` polling | Medium | Performance | Interval cleanup was missing, risking memory leak/stale polling. | Return `clearInterval(interval)` on unmount. |
| 11 | components/reconciliation/ReconciliationDashboard.tsx | initial data load | Medium | API | Dashboard waited for first poll tick before showing data. | Fetch immediately on mount, then continue polling. |
| 12 | components/reconciliation/ReconciliationDashboard.tsx + app/api/v1/reconcile/route.ts | detail drill-down (`bankOnly`, `systemOnly`) | Medium | Logic | UI supports expandable details, but list API currently returns empty arrays for historical runs. | Persist and return per-run bank-only/local-only/discrepancy snapshots. |
| 13 | components/reconciliation/ReconciliationDashboard.tsx | top-level summary UI | Medium | API | Required summary card (runs this month, total discrepancy amount, trigger button) is still missing. | Add summary card above table per Task 3c requirements. |

## Notes

- Items #4, #5, #6, #7, #10, and #11 were addressed in current code changes.
- Items #1, #2, #3, #8, #9, #12, and #13 remain open and are partially tracked with TODO markers.
