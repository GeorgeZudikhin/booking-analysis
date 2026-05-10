import type { BookingLine, BookingManualRule } from "./types";
import { normalizeText } from "./anomalies";
import { TECHNICAL_ACCOUNTS } from "@/common/constants";

const MIN_OCCURRENCES = 5;
const MIN_RATIO = 0.75;
const MAX_PER_TYPE = 4;
const MAX_RULES = 10;
const MAX_SUPPORT_EVIDENCE = 3;
const MAX_MISMATCH_EVIDENCE = 3;

function isMeaningful(line: BookingLine): boolean {
  return !TECHNICAL_ACCOUNTS.has(line.gl_account);
}

// Find the most common non-null value of `pickValue` across `lines`.
// Returns null if every line yields null.
function dominantValue(
  lines: BookingLine[],
  pickValue: (l: BookingLine) => string | null
): { value: string; count: number; totalNonNull: number } | null {
  const counts = new Map<string, number>();
  let totalNonNull = 0;
  for (const l of lines) {
    const v = pickValue(l);
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    totalNonNull += 1;
  }
  if (totalNonNull === 0) return null;
  let topValue = "";
  let topCount = 0;
  for (const [v, c] of counts) {
    if (c > topCount) {
      topValue = v;
      topCount = c;
    }
  }
  return { value: topValue, count: topCount, totalNonNull };
}

// Pick up to `n` representative lines, each from a distinct document.
function pickEvidence(lines: BookingLine[], n: number): BookingLine[] {
  const seen = new Set<string>();
  const out: BookingLine[] = [];
  for (const l of lines) {
    if (out.length >= n) break;
    if (seen.has(l.document_id)) continue;
    seen.add(l.document_id);
    out.push(l);
  }
  return out;
}

function lineKey(l: BookingLine): string {
  return `${l.document_id}#${l.line_id}`;
}

// Build the evidence list for a rule: a sample of lines that follow the
// dominant pattern *plus* a sample of lines that broke from it (mismatches).
// The mismatch keys come back so the card can highlight those rows.
function buildEvidence(
  allLines: BookingLine[],
  supportLines: BookingLine[],
  pickValue: (l: BookingLine) => string | null,
  dominantValue: string
): { evidence: BookingLine[]; mismatch_line_keys: string[] } {
  const support = pickEvidence(supportLines, MAX_SUPPORT_EVIDENCE);
  const mismatches = allLines.filter((l) => {
    const v = pickValue(l);
    return v != null && v !== dominantValue;
  });
  const mismatchSample = pickEvidence(mismatches, MAX_MISMATCH_EVIDENCE);
  return {
    evidence: [...support, ...mismatchSample],
    mismatch_line_keys: mismatchSample.map(lineKey),
  };
}

function groupBy<K>(
  lines: BookingLine[],
  key: (l: BookingLine) => K | null
): Map<K, BookingLine[]> {
  const out = new Map<K, BookingLine[]>();
  for (const l of lines) {
    const k = key(l);
    if (k === null) continue;
    let bucket = out.get(k);
    if (!bucket) {
      bucket = [];
      out.set(k, bucket);
    }
    bucket.push(l);
  }
  return out;
}

// ---------- rule generators ----------

function generateTextToAccountRules(lines: BookingLine[]): BookingManualRule[] {
  const business = lines.filter(isMeaningful);
  const groups = groupBy(business, (l) => normalizeText(l.booking_text) || null);
  const out: BookingManualRule[] = [];
  for (const ls of groups.values()) {
    if (ls.length < MIN_OCCURRENCES) continue;
    const dom = dominantValue(ls, (l) => l.gl_account);
    if (!dom) continue;
    const ratio = dom.count / ls.length;
    if (ratio < MIN_RATIO) continue;
    const supportLines = ls.filter((l) => l.gl_account === dom.value);
    const display = supportLines[0].booking_text;
    const accountName = supportLines[0].gl_account_name;
    const confidence = Math.round(ratio * 100);
    out.push({
      id: `text_to_account:${normalizeText(display)}->${dom.value}`,
      type: "text_to_account",
      title: `"${display}" usually uses ${dom.value} ${accountName}`,
      description: `${dom.count} of ${ls.length} matching business lines used this account.`,
      suggested_check: `Flag future postings with booking text "${display}" when the G/L account is not ${dom.value}.`,
      confidence,
      support_count: dom.count,
      total_count: ls.length,
      mismatch_count: ls.length - dom.count,
      ...buildEvidence(ls, supportLines, (l) => l.gl_account, dom.value),
    });
  }
  return out;
}

function generateTextToCostCenterRules(
  lines: BookingLine[]
): BookingManualRule[] {
  const business = lines.filter(isMeaningful);
  const groups = groupBy(business, (l) => normalizeText(l.booking_text) || null);
  const out: BookingManualRule[] = [];
  for (const ls of groups.values()) {
    if (ls.length < MIN_OCCURRENCES) continue;
    const dom = dominantValue(ls, (l) => l.cost_center);
    if (!dom) continue;
    const ratio = dom.count / dom.totalNonNull;
    if (ratio < MIN_RATIO) continue;
    const supportLines = ls.filter((l) => l.cost_center === dom.value);
    const display = supportLines[0].booking_text;
    const confidence = Math.round(ratio * 100);
    out.push({
      id: `text_to_cost_center:${normalizeText(display)}->${dom.value}`,
      type: "text_to_cost_center",
      title: `"${display}" usually uses cost center ${dom.value}`,
      description: `${dom.count} of ${dom.totalNonNull} bookings with a cost center used ${dom.value}.`,
      suggested_check: `Flag future postings with booking text "${display}" when the cost center is not ${dom.value}.`,
      confidence,
      support_count: dom.count,
      total_count: dom.totalNonNull,
      mismatch_count: dom.totalNonNull - dom.count,
      ...buildEvidence(ls, supportLines, (l) => l.cost_center, dom.value),
    });
  }
  return out;
}

function generateVendorToAccountRules(
  lines: BookingLine[]
): BookingManualRule[] {
  const business = lines.filter(isMeaningful);
  const groups = groupBy(business, (l) => l.vendor_id);
  const out: BookingManualRule[] = [];
  for (const ls of groups.values()) {
    if (ls.length < MIN_OCCURRENCES) continue;
    const dom = dominantValue(ls, (l) => l.gl_account);
    if (!dom) continue;
    const ratio = dom.count / ls.length;
    if (ratio < MIN_RATIO) continue;
    const supportLines = ls.filter((l) => l.gl_account === dom.value);
    const sample = supportLines[0];
    const vendorName = sample.vendor_name ?? sample.vendor_id ?? "Unknown vendor";
    const accountName = sample.gl_account_name;
    const confidence = Math.round(ratio * 100);
    out.push({
      id: `vendor_to_account:${sample.vendor_id ?? "unknown"}->${dom.value}`,
      type: "vendor_to_account",
      title: `${vendorName} usually posts to ${dom.value} ${accountName}`,
      description: `${dom.count} of ${ls.length} business lines for this vendor used this account.`,
      suggested_check: `Flag future postings from ${vendorName} when the G/L account is not ${dom.value}.`,
      confidence,
      support_count: dom.count,
      total_count: ls.length,
      mismatch_count: ls.length - dom.count,
      ...buildEvidence(ls, supportLines, (l) => l.gl_account, dom.value),
    });
  }
  return out;
}

function generateAccountToTaxCodeRules(
  lines: BookingLine[]
): BookingManualRule[] {
  const business = lines.filter(isMeaningful);
  const groups = groupBy(business, (l) => l.gl_account);
  const out: BookingManualRule[] = [];
  for (const ls of groups.values()) {
    if (ls.length < MIN_OCCURRENCES) continue;
    const dom = dominantValue(ls, (l) => l.tax_code);
    if (!dom) continue;
    const ratio = dom.count / dom.totalNonNull;
    if (ratio < MIN_RATIO) continue;
    const supportLines = ls.filter((l) => l.tax_code === dom.value);
    const sample = supportLines[0];
    const acc = sample.gl_account;
    const accountName = sample.gl_account_name;
    const confidence = Math.round(ratio * 100);
    out.push({
      id: `account_to_tax_code:${acc}->${dom.value}`,
      type: "account_to_tax_code",
      title: `${acc} ${accountName} usually uses tax code ${dom.value}`,
      description: `${dom.count} of ${dom.totalNonNull} bookings on this account with a tax code used ${dom.value}.`,
      suggested_check: `Flag future postings on account ${acc} when the tax code is not ${dom.value}.`,
      confidence,
      support_count: dom.count,
      total_count: dom.totalNonNull,
      mismatch_count: dom.totalNonNull - dom.count,
      ...buildEvidence(ls, supportLines, (l) => l.tax_code, dom.value),
    });
  }
  return out;
}

// ---------- composition ----------

// Rules with at least one violation come first — those are the actionable
// patterns where reality already broke from the suggested rule and a
// reviewer might want to look. Within each tier we then prefer rules with
// more supporting evidence (and higher confidence as a final tiebreaker).
function compareRules(a: BookingManualRule, b: BookingManualRule): number {
  const aHasMismatch = a.mismatch_count > 0 ? 1 : 0;
  const bHasMismatch = b.mismatch_count > 0 ? 1 : 0;
  if (aHasMismatch !== bHasMismatch) return bHasMismatch - aHasMismatch;
  if (b.support_count !== a.support_count) return b.support_count - a.support_count;
  return b.confidence - a.confidence;
}

// Soft diversity: cap each rule type so the top 10 isn't a single category.
function applyDiversityCap(
  ranked: BookingManualRule[],
  perType: number,
  total: number
): BookingManualRule[] {
  const capped: BookingManualRule[] = [];
  const counts = new Map<string, number>();
  for (const rule of ranked) {
    if (capped.length >= total) break;
    const c = counts.get(rule.type) ?? 0;
    if (c >= perType) continue;
    capped.push(rule);
    counts.set(rule.type, c + 1);
  }
  // If the cap left us short, top up from the remaining ranked list.
  if (capped.length < total) {
    const present = new Set(capped.map((r) => r.id));
    for (const rule of ranked) {
      if (capped.length >= total) break;
      if (present.has(rule.id)) continue;
      capped.push(rule);
    }
  }
  return capped;
}

export function generateBookingManualRules(
  lines: BookingLine[]
): BookingManualRule[] {
  const all = [
    ...generateTextToAccountRules(lines),
    ...generateTextToCostCenterRules(lines),
    ...generateVendorToAccountRules(lines),
    ...generateAccountToTaxCodeRules(lines),
  ];
  all.sort(compareRules);
  return applyDiversityCap(all, MAX_PER_TYPE, MAX_RULES);
}
