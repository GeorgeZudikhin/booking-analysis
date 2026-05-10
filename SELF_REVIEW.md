# Self-review

Short review of the AI-assisted implementation pass for the Booking Insights take-home, covering the data generator, anomaly detector, duplicate detector, and booking-manual rule generator.

## 5 improvement opportunities

### 1. Rule evidence excluded the actual mismatching rows
The `RuleCard` evidence table only rendered lines that **followed** the dominant pattern. The card said e.g. "1 mismatch" but the reviewer couldn't see which row that mismatch was — they had to leave the manual tab and dig through the anomaly tab to find it. Since the anomaly detector and the rule generator share the same dominant-pattern math, the same row that is "the seeded AWS-to-Meals anomaly" in tab 1 is "the 1 mismatch under the AWS rule" in tab 3. Including those rows in the rule evidence and visually distinguishing them, the same way `AnomalyCard` already did with `anomalousLineKeys`, was the missing piece.

### 2. `violations_count` was over-strong wording
The page disclaimer correctly says these are **descriptive** patterns ("not authoritative accounting policy"). Calling the counter `violations_count` and labelling the badge "1 violation" contradicted that — a descriptive rule cannot be "violated". `mismatch_count` reads more honestly and stays consistent with the disclaimer.

### 3. Duplicate detector was a naive O(N²) pair scan
`detectDuplicateBookings` iterated every document pair and *then* applied `isEligiblePair`. At 193 docs that's 18 528 pair comparisons, mostly to reject. The eligibility predicate already encoded the keys we'd bucket on (`company_code`, `currency`, `party_id`, both must be invoice-like). Pre-bucketing and only comparing within buckets drops the loop to roughly N×k where k is the average bucket size. For real accounting data the buckets are tiny (one vendor doesn't have 20 000 invoices in 7 days). On the current dataset this is a 73× reduction in pair comparisons; the asymptotic improvement matters far more on real volumes.

### 4. Duplicate detector emits pair findings, not cluster findings
If three near-identical AWS invoices land within a 7-day window, the reviewer gets 3 cards (A↔B, A↔C, B↔C) for what is actually one cluster of 3. As the dataset grows this gets worse fast — N near-duplicates of the same invoice produce N(N−1)/2 cards. A union-find pass over the candidate graph would group connected components and emit one card per cluster of N members instead. This is a meaningful correctness limitation, not just an aesthetic one: the pair view forces the reviewer to mentally re-cluster what the algorithm already knew.

### 5. Duplicate pair members ordered lexicographically by `document_id`
`orderPair` sorts by the document_id string, which is meaningless to a reviewer. "Document A" should be the earlier-posted document (the candidate "original") and "Document B" should be the later one (the candidate "duplicate"). With the current ordering, on a real dataset where document IDs are not date-sortable, the labels carry no signal. Switching to `posting_date` ascending (with `document_id` as a tiebreaker) would make the cards self-explanatory: "this earlier invoice has a near-duplicate posted N days later".

## Implemented fixes

### Fix A — show mismatching rows in rule evidence (addresses #1)

`buildEvidence(allLines, supportLines, pickValue, dominantValue)` in [src/lib/manual.ts](src/lib/manual.ts) now returns both an `evidence` array and a `mismatch_line_keys` array. Each rule generator delegates to it, so the resulting card sees a small representative sample of *supporting* rows (≤ 3, one per distinct document) followed by a small sample of *mismatching* rows (≤ 3) with their `${document_id}#${line_id}` keys recorded.

[src/components/RuleCard.tsx](src/components/RuleCard.tsx) builds a `Set` from `mismatch_line_keys` at render time and applies the same `bg-amber-50/70 border-y border-amber-300` treatment that `AnomalyCard` uses for flagged rows. Result: the AWS rule card now visibly contains the AWS-to-Meals row (highlighted), so the reviewer can see *which* posting broke from the pattern without leaving the tab.

### Fix B — rename `violations_count` → `mismatch_count` (addresses #2)

Renamed end-to-end: type field, generator output, sort comparator, card text & pill label. The amber pill now reads "**N mismatch / mismatches**" instead of "**N violations**", consistent with the page's "descriptive patterns, not authoritative accounting policy" disclaimer. No behavior change.

### Fix C — bucket-based duplicate scan (addresses #3)

[src/lib/duplicates.ts](src/lib/duplicates.ts) now groups documents by `${company_code}|${currency}|${party_id}` before pair-scanning, and only compares documents within the same bucket. Documents that fail eligibility on their own (no party, not invoice-like) are dropped at bucketing time and never enter any bucket. `isEligiblePair` is still called inside the inner loop as a defensive check (it now collapses to "are postings within 7 days?" since the bucketing already enforces the other clauses).

Output is identical to the previous implementation — same 20 candidates with the same confidence scores. The work goes from 18 528 pair comparisons to 252, a 73× reduction on this dataset, and grows roughly linearly rather than quadratically as document count increases. The pair-finding logic is also factored out into `buildCandidate` for clarity.

## Not done in this pass

- **Cluster detection (#4)** — the right next step after bucketing. Would replace the `(documentA, documentB)` pair shape with a `documents: DocumentSummary[]` cluster shape via union-find on the candidate graph, and update `DuplicateCard` to render N members. Bigger surface-area change (type + generator + UI), so deferred.
- **Pair member ordering by posting_date (#5)** — small, but would touch `orderPair` plus card labels (rename "Document A/B" to something like "Earlier / Later" or annotate with the day delta). Worth doing alongside #4.
