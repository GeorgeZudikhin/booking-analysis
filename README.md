# Booking Insights

A mini web app that analyzes SAP-like journal-entry / booking data and surfaces three things:

- **suspicious postings** (typos and unusual G/L accounts),
- **possible duplicate documents**, and
- **suggested booking rules** inferred from recurring patterns.

This is a timeboxed MVP. It works only on **generated** local JSON data ([data/bookings.json](data/bookings.json)) and runs all analysis in memory — no database, no real SAP integration, no ML at runtime.

## Setup

```bash
npm install
npm run generate:data   # rewrites data/bookings.json (seeded, deterministic)
npm run dev             # http://localhost:3000
```

The data file is committed, so `npm run dev` works without regenerating. Use `generate:data` when you want to refresh or change the dataset. The dataset Generated booking dataset ([scripts/generateBookings.mjs](scripts/generateBookings.mjs)) represents:
  - SAP-like journal-entry line items, multiple lines per document.
  - Documents are balanced (signed amounts sum to 0).
  - Includes intentionally seeded suspicious cases (typos, mis-bookings, near-duplicates) so the detectors can be evaluated end-to-end.
  - Built-in validation: line count in `[480, 520]`, every doc balances, ≥ 20 distinct G/L accounts.

## Implemented features

The UI has three tabs (instant client-side switching):

- **Anomaly / typo detection** ([src/lib/anomalies.ts](src/lib/anomalies.ts))
  - Rare booking texts that look similar to common ones (Levenshtein-based, threshold 0.85).
  - Unusual G/L account for a recurring booking text (dominant-account ≥ 75 %, deviating lines flagged).
  - Each finding carries severity, confidence, plain-language explanation, and an evidence table; flagged rows are highlighted.

- **Duplicate booking detection** ([src/lib/duplicates.ts](src/lib/duplicates.ts))
  - Document-level pair comparison gated by `(company_code, currency, party_id, invoice-like, ≤ 7 days)`.
  - Score from same party (35) + similar amount (30) + similar text (20) + shared meaningful account (15); reports criteria and a confidence.
  - Bucketed scan — only documents in the same `company|currency|party` bucket are compared (~73× fewer comparisons on the current dataset, asymptotically much better).

- **Booking manual / rule suggestions** ([src/lib/manual.ts](src/lib/manual.ts))
  - Frequency-based rules: `text → account`, `text → cost center`, `vendor → account`, `account → tax code`.
  - Each rule shows support / total counts, a suggested check, and an evidence table that **includes** the mismatching rows (highlighted) so the reviewer can see what broke from the pattern.
  - Rules with mismatches are surfaced first because they're the actionable ones.

- **Self-review** — see [SELF_REVIEW.md](SELF_REVIEW.md) for the 5 findings and the 3 fixes implemented from them (mismatch rows in evidence, `violations_count` → `mismatch_count` rename, and bucketed duplicate scan).

- **Context engineering sketch** — see the section at the bottom of this README. Documentation only; not implemented.

## Data assumptions

- The app analyzes **generated** booking data only — not real SAP data, not a real chart of accounts, not real customer/vendor records.
- A **booking document** is a group of journal-entry lines that share the same `document_id`. `document_id` is the grouping key; `line_id` identifies an individual line within a document.
- Every document has **≥ 2 lines** and is **balanced**: the sum of signed `amount` values for one `document_id` equals 0.
- Amounts are **signed** — debit lines positive, credit lines negative. `debit_credit` (`"D"` / `"C"`) is included because ERPs typically store the direction explicitly, but in this dataset it is derived from the sign of `amount`.
- The chart of accounts is simplified and demo-only. G/L accounts are treated as **posting categories** (e.g. `640000` = Software / Cloud Subscriptions, `660010` = Office Supplies, `670000` = Marketing / Ads Expense, `400000` = Software Revenue).
- Six accounts are treated as **generic accounting mechanics** — `100000` Bank, `100100` Secondary Bank, `140000` Customer Receivables, `160000` Vendor Payables, `157600` Input VAT, `177600` Output VAT. They appear in many documents and don't describe the business category, so they are excluded from heuristics that try to identify "what was this booking about" (single source of truth: [src/common/constants.ts](src/common/constants.ts)).
- All findings are **review candidates**, not definitive accounting errors.
- No cash flow, revenue KPI, profit KPI, or other business KPI is computed. Those would require assumptions beyond what posting data alone supports.
- Currency is uniformly EUR; multi-currency is not handled.
- Cost centers are treated as posting metadata; null is acceptable on technical lines (bank/AR/AP/VAT) and is filtered out before dominance checks.

## Design decisions and trade-offs

How the assumptions above shape the implementation:

- **Documents balance to 0**, so duplicate detection cannot compare document sums (they're all 0). Instead it compares the **debit total** (`Σ positive amounts`), party, posting-date distance, text similarity, and shared meaningful G/L accounts.
- **Generic accounting accounts appear in every invoice**, so they're excluded before dominant-account math. Otherwise VAT and Payables would tie or win every "most common account" check and bury the actual signal.
- **The dataset is small** (~500 lines), so analysis runs in memory from local JSON. No database, no caching layer, no API surface — the page is a server component that runs the detectors at request time.
- **Timeboxed MVP**, so heuristics are deterministic and explainable rather than ML-based. Every finding has a written explanation and a citable evidence table; nothing is opaque.
- **Seeded suspicious cases are pattern-shaped, not document-id-shaped.** Detectors find patterns generically; if you regenerate the dataset with a different seed they still find the equivalents. The seeds make the test scenarios reliable; they don't drive the detector code.
- **Booking-manual rules are descriptive, not prescriptive.** They are inferred from history — if history is wrong, the rule is wrong. They should be reviewed before being promoted to hard validation. The card wording (`mismatch`, not `violation`) reflects this.
- **Tabs are client-side state** so switching is instant, but the heavy detection work runs once on the server. The client never sees the full booking JSON, only the rendered findings.

## Context engineering / knowledge graph sketch

> **Future architecture, not implemented.** Today's MVP analyzes generated booking lines in memory from `data/bookings.json` only. It does not connect to any external context source. The notes below are a sketch of how this app could grow to answer questions like *"Why was this discount granted?"* or *"Why is this KPI calculated this way?"*.

- **Sources to connect.** Accounting policies and the actual booking manual; SOPs for invoicing, approvals, and discounts; CRM notes and opportunity records; contract PDFs; approval emails or ticket threads; the data dictionary; dbt/BI transformation code with KPI definitions; and owner / approver metadata. Each is a different shape (PDF, structured table, free text) so they need different connectors but the same target graph.

- **Core entities & relations (the why).** Potential useful traversals: 
  - `Booking document → vendor/customer → contract → approval → policy section` (lets you justify *why a posting was made*); 
  - `Discount → customer → CRM opportunity → approval note → discount policy` (lets you justify *why a discount was granted*); 
  - `KPI → definition → source tables → transformation → owner → approval` (lets you justify *why a metric is calculated this way*); 
  - `G/L account → suggested rule → tax code → cost center → policy` (lets you justify *why a booking should land here*). 

- **Retrieval — hybrid.** Vector search for the soft stuff (policy paragraphs, CRM notes, approval emails). Graph traversal once you've located an entity — e.g. start at a `Booking`, walk to its customer, contract, and the approval thread that authorized it.

- **Evidence-first answers.** Surface cited snippets and source document IDs *before* the natural-language explanation. The user should be able to scan citations alone and decide if the answer is trustworthy. If retrieval returns nothing relevant, say "insufficient evidence", don't let the model fill the gap.

- **Confidence handling.** Low-confidence retrieval should degrade visibly (greyed out, or "based on partial evidence"), not silently. Track which fields of the answer came from which source; if any required source is missing, mark the answer incomplete rather than guessing.

- **Risks & mitigations.**
  - *Hallucinated explanations* — require every claim to point at a citation; refuse to answer when none exists.
  - *Stale or conflicting policies* — version every policy document; prefer the current approved version; surface conflicts rather than picking one silently.
  - *Permissions and privacy* — enforce source-level ACLs at retrieval time, not at presentation time. CRM notes and approval emails are sensitive; the model shouldn't see what the user can't.
  - *Noisy CRM/email context* — rank by recency, owner relevance, and direct entity match; deprioritize generic threads that mention the customer in passing.
