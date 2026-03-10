# Clarifications

## 1) Ambiguities / unanswered questions from client brief

1. **Quote:** "Accept a batch of bank records (uploaded as JSON, representing a CSV import)"
   - **Interpretation / assumed answer:** The API receives pre-parsed JSON rows (not raw CSV), and CSV-to-JSON conversion happens before calling reconciliation logic.
   - **Why this interpretation:** It keeps the reconciler focused on business matching, and matches the provided schema (`bankData` array of typed records).

2. **Quote:** "Match them against internal payment records for a given period"
   - **Interpretation / assumed answer:** Both bank records and system payments are filtered by `periodStart` and `periodEnd` using half-open window `[start, end)`.
   - **Why this interpretation:** Half-open windows avoid double counting at boundaries and are standard for periodic reporting.

3. **Quote:** "Payments need to be properly matched against the bank records"
   - **Interpretation / assumed answer:** Primary match key is reference identity (`externalRef` vs bank `reference`/`transactionId`) plus currency and amount.
   - **Why this interpretation:** Amount-only matching is unsafe and causes false positives; reference-based matching reduces collision risk.

4. **Quote:** "Any discrepancies should be flagged so the team can review them"
   - **Interpretation / assumed answer:** A discrepancy means likely same transaction reference but non-equal amounts (or other meaningful mismatch), and must be returned in result payload.
   - **Why this interpretation:** Team review requires explicit discrepancy records, not just aggregate totals.

5. **Quote:** "Persist the reconciliation run to the database"
   - **Interpretation / assumed answer:** Persist run summary at minimum (period, counts, totals, status); details (bank-only/system-only/discrepancies) may also be needed for historical review.
   - **Why this interpretation:** Dashboard requirement to display past runs implies durable records; review workflows usually need detail snapshots.

6. **Quote:** "Display past reconciliation runs in a dashboard"
   - **Interpretation / assumed answer:** Dashboard should poll or fetch recent runs and show run-level metrics; drill-down details are expected if review is required.
   - **Why this interpretation:** A list-only table is insufficient for finance review without category detail context.

7. **Quote:** "The system should do reconciliation in real-time — we can't wait for a nightly job"
   - **Interpretation / assumed answer:** Reconciliation is synchronous/on-demand in request path (or near-real-time async), not delayed batch processing.
   - **Why this interpretation:** Verbatim note rejects nightly scheduling and implies immediate processing feedback.

8. **Quote:** "We handle multiple currencies but for now just focus on USD"
   - **Interpretation / assumed answer:** System should work with currency field, but production scope for this task is USD-only validation/enforcement.
   - **Why this interpretation:** Keeps implementation scoped while preserving future extension points.

9. **Quote:** "Compliance is critical — we're PCI DSS Level 1 and SOC 2 certified"
   - **Interpretation / assumed answer:** Avoid leaking internals in API errors, avoid SQL injection patterns, and keep auditable run records.
   - **Why this interpretation:** These are baseline controls directly relevant to reconciliation and sensitive finance operations.

## 2) Compliance-focused clarification question

- For PCI/SOC2 evidence, do you require immutable audit fields per run (actor id, source file hash/import id, and reconciliation algorithm version) so finance/compliance can reproduce exact outcomes?

## 3) One question I would NOT ask the client

- **Question I would not ask:** "Should period filtering use closed `[start, end]` or half-open `[start, end)` boundaries?"
- **Why this is engineering, not product:** Boundary semantics are technical consistency decisions. Product cares about report correctness; engineers choose stable time-window conventions and document them.
