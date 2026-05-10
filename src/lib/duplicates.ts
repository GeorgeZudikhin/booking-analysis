import type { BookingLine, DocumentSummary, DuplicateCandidate } from "./types";
import { normalizeText, similarity } from "./anomalies";

const TECHNICAL_ACCOUNTS = new Set([
  "100000",
  "100100",
  "140000",
  "160000",
  "157600",
  "177600",
]);

const INVOICE_TYPES = new Set<BookingLine["document_type"]>([
  "vendor_invoice",
  "customer_invoice",
]);

const MAX_DAYS_APART = 7;
const AMOUNT_ABS_TOLERANCE = 1; // EUR
const AMOUNT_REL_TOLERANCE = 0.01; // 1%
const TEXT_SIMILARITY_THRESHOLD = 0.85;
const MIN_CONFIDENCE = 65;
const HIGH_CONFIDENCE = 85;
const MAX_CANDIDATES = 20;

// ---------- document summaries ----------

function summarizeDocument(
  documentId: string,
  docLines: BookingLine[]
): DocumentSummary {
  const first = docLines[0];
  const vendorLine = docLines.find((l) => l.vendor_id != null);
  const customerLine = docLines.find((l) => l.customer_id != null);

  let party_id: string | null = null;
  let party_name: string | null = null;
  let party_type: "vendor" | "customer" | null = null;
  if (vendorLine) {
    party_id = vendorLine.vendor_id;
    party_name = vendorLine.vendor_name;
    party_type = "vendor";
  } else if (customerLine) {
    party_id = customerLine.customer_id;
    party_name = customerLine.customer_name;
    party_type = "customer";
  }

  const representative_text =
    docLines.find((l) => l.booking_text && l.booking_text.trim() !== "")
      ?.booking_text ?? "";

  const debit_total = docLines
    .filter((l) => l.amount > 0)
    .reduce((sum, l) => sum + l.amount, 0);

  const meaningful_gl_accounts = Array.from(
    new Set(
      docLines
        .filter((l) => !TECHNICAL_ACCOUNTS.has(l.gl_account))
        .map((l) => l.gl_account)
    )
  );

  return {
    document_id: documentId,
    posting_date: first.posting_date,
    company_code: first.company_code,
    currency: first.currency,
    document_type: first.document_type,
    lines: docLines,
    party_id,
    party_name,
    party_type,
    representative_text,
    debit_total,
    meaningful_gl_accounts,
  };
}

function summarizeAllDocuments(lines: BookingLine[]): DocumentSummary[] {
  const byDoc = new Map<string, BookingLine[]>();
  for (const l of lines) {
    let bucket = byDoc.get(l.document_id);
    if (!bucket) {
      bucket = [];
      byDoc.set(l.document_id, bucket);
    }
    bucket.push(l);
  }
  const summaries: DocumentSummary[] = [];
  for (const [id, docLines] of byDoc) {
    summaries.push(summarizeDocument(id, docLines));
  }
  return summaries;
}

// ---------- comparison helpers ----------

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(da - db) / 86_400_000;
}

function amountsClose(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  if (diff <= AMOUNT_ABS_TOLERANCE) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  if (denom === 0) return true;
  return diff / denom <= AMOUNT_REL_TOLERANCE;
}

function textsClose(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return similarity(na, nb) >= TEXT_SIMILARITY_THRESHOLD;
}

function isEligiblePair(a: DocumentSummary, b: DocumentSummary): boolean {
  if (a.document_id === b.document_id) return false;
  if (a.company_code !== b.company_code) return false;
  if (a.currency !== b.currency) return false;
  if (a.party_id == null || b.party_id == null) return false;
  if (a.party_id !== b.party_id) return false;
  if (!INVOICE_TYPES.has(a.document_type)) return false;
  if (!INVOICE_TYPES.has(b.document_type)) return false;
  if (daysBetween(a.posting_date, b.posting_date) > MAX_DAYS_APART) return false;
  return true;
}

function formatAmount(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function scorePair(
  a: DocumentSummary,
  b: DocumentSummary
): { score: number; criteria: string[] } {
  const criteria: string[] = [];
  let score = 0;

  // Same party (eligibility already enforced this; we score it explicitly).
  score += 35;
  criteria.push(
    `Same ${a.party_type ?? "party"}: ${a.party_name ?? a.party_id ?? "unknown"}`
  );

  if (amountsClose(a.debit_total, b.debit_total)) {
    score += 30;
    criteria.push(
      `Similar amount: ${formatAmount(a.debit_total, a.currency)} vs ${formatAmount(b.debit_total, b.currency)}`
    );
  }

  if (textsClose(a.representative_text, b.representative_text)) {
    score += 20;
    criteria.push(
      `Similar text: "${a.representative_text}" vs "${b.representative_text}"`
    );
  }

  const shared = a.meaningful_gl_accounts.filter((acc) =>
    b.meaningful_gl_accounts.includes(acc)
  );
  if (shared.length > 0) {
    score += 15;
    criteria.push(`Shared account: ${shared[0]}`);
  }

  return { score, criteria };
}

function orderPair(
  a: DocumentSummary,
  b: DocumentSummary
): [DocumentSummary, DocumentSummary] {
  return a.document_id < b.document_id ? [a, b] : [b, a];
}

// ---------- main entry point ----------

export function detectDuplicateBookings(
  lines: BookingLine[]
): DuplicateCandidate[] {
  const docs = summarizeAllDocuments(lines);
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < docs.length; i += 1) {
    for (let j = i + 1; j < docs.length; j += 1) {
      const a = docs[i];
      const b = docs[j];
      if (!isEligiblePair(a, b)) continue;
      const { score, criteria } = scorePair(a, b);
      if (score < MIN_CONFIDENCE) continue;
      const [first, second] = orderPair(a, b);
      candidates.push({
        id: `dup:${first.document_id}-${second.document_id}`,
        documentA: first,
        documentB: second,
        confidence: score,
        severity: score >= HIGH_CONFIDENCE ? "high" : "medium",
        criteria,
      });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, MAX_CANDIDATES);
}
