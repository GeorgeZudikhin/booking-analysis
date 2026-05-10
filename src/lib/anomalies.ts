import { TECHNICAL_ACCOUNTS } from "@/common/constants";
import type { BookingLine, AnomalyFinding } from "./types";

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const SEVERITY_RANK: Record<AnomalyFinding["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const TYPO_SIMILARITY_THRESHOLD = 0.85;
const RARE_DOC_COUNT = 2;
const COMMON_DOC_COUNT = 5;
const DOMINANT_ACCOUNT_RATIO = 0.75;

function severityFromConfidence(c: number): AnomalyFinding["severity"] {
  if (c >= 90) return "high";
  if (c >= 80) return "medium";
  return "low";
}

function lineKey(l: BookingLine): string {
  return `${l.document_id}#${l.line_id}`;
}

function pickRepresentativeLines(lines: BookingLine[], n: number): BookingLine[] {
  const sorted = [...lines].sort((a, b) => {
    const aTech = TECHNICAL_ACCOUNTS.has(a.gl_account) ? 1 : 0;
    const bTech = TECHNICAL_ACCOUNTS.has(b.gl_account) ? 1 : 0;
    return aTech - bTech;
  });
  const seen = new Set<string>();
  const out: BookingLine[] = [];
  for (const l of sorted) {
    if (out.length >= n) break;
    if (seen.has(l.document_id)) continue;
    seen.add(l.document_id);
    out.push(l);
  }
  return out;
}

type TextGroup = { key: string; lines: BookingLine[]; docCount: number };

function bucketByText(lines: BookingLine[]): Map<string, TextGroup> {
  const groups = new Map<string, TextGroup>();
  for (const l of lines) {
    const key = normalizeText(l.booking_text);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { key, lines: [], docCount: 0 };
      groups.set(key, g);
    }
    g.lines.push(l);
  }
  for (const g of groups.values()) {
    g.docCount = new Set(g.lines.map((l) => l.document_id)).size;
  }
  return groups;
}

function buildContextSummary(shown: number, total: number): string | undefined {
  return total > shown ? `Showing ${shown} of ${total} normal examples.` : undefined;
}

// ---------- Detector 1: possible typo / near-duplicate text ----------

function findBestCommonMatch(
  rare: TextGroup,
  common: TextGroup[]
): { group: TextGroup; sim: number } | null {
  let best: { group: TextGroup; sim: number } | null = null;
  for (const c of common) {
    if (c.key === rare.key) continue;
    const sim = similarity(rare.key, c.key);
    if (sim >= TYPO_SIMILARITY_THRESHOLD && (!best || sim > best.sim)) {
      best = { group: c, sim };
    }
  }
  return best;
}

function buildTypoFinding(
  rare: TextGroup,
  match: { group: TextGroup; sim: number }
): AnomalyFinding {
  const confidence = Math.round(match.sim * 100);
  const rareDisplay = rare.lines[0].booking_text;
  const commonDisplay = match.group.lines[0].booking_text;
  const commonExamples = pickRepresentativeLines(match.group.lines, 3);

  return {
    id: `typo:${rare.key}->${match.group.key}`,
    type: "possible_typo",
    severity: severityFromConfidence(confidence),
    confidence,
    title: `Possible typo: "${rareDisplay}"`,
    explanation:
      `"${rareDisplay}" appears ${rare.docCount} time${rare.docCount === 1 ? "" : "s"} ` +
      `and is ${confidence}% similar to the common text "${commonDisplay}", ` +
      `which appears ${match.group.docCount} times.`,
    evidence: [...rare.lines, ...commonExamples],
    anomalousLineKeys: rare.lines.map(lineKey),
    contextSummary: buildContextSummary(commonExamples.length, match.group.docCount),
  };
}

function findTypoAnomalies(groups: Map<string, TextGroup>): AnomalyFinding[] {
  const rare: TextGroup[] = [];
  const common: TextGroup[] = [];
  for (const g of groups.values()) {
    if (g.docCount <= RARE_DOC_COUNT) rare.push(g);
    if (g.docCount >= COMMON_DOC_COUNT) common.push(g);
  }
  const out: AnomalyFinding[] = [];
  for (const r of rare) {
    const match = findBestCommonMatch(r, common);
    if (match) out.push(buildTypoFinding(r, match));
  }
  return out;
}

// ---------- Detector 2: unusual G/L account for recurring text ----------

function dominantAccount(
  lines: BookingLine[]
): { acc: string; count: number } | null {
  if (lines.length === 0) return null;
  const counts = new Map<string, number>();
  for (const l of lines) {
    counts.set(l.gl_account, (counts.get(l.gl_account) ?? 0) + 1);
  }
  let topAcc = "";
  let topCount = 0;
  for (const [acc, c] of counts) {
    if (c > topCount) {
      topAcc = acc;
      topCount = c;
    }
  }
  return { acc: topAcc, count: topCount };
}

function buildUnusualAccountFindings(group: TextGroup): AnomalyFinding[] {
  const businessLines = group.lines.filter(
    (l) => !TECHNICAL_ACCOUNTS.has(l.gl_account)
  );
  if (businessLines.length < COMMON_DOC_COUNT) return [];

  const top = dominantAccount(businessLines);
  if (!top) return [];

  const ratio = top.count / businessLines.length;
  if (ratio < DOMINANT_ACCOUNT_RATIO) return [];

  const expectedName =
    businessLines.find((l) => l.gl_account === top.acc)?.gl_account_name ?? "";
  const topAccLines = businessLines.filter((l) => l.gl_account === top.acc);
  const normalExamples = pickRepresentativeLines(topAccLines, 3);
  const totalNormalDocs = new Set(topAccLines.map((l) => l.document_id)).size;
  const contextSummary = buildContextSummary(normalExamples.length, totalNormalDocs);
  const confidence = Math.round(ratio * 100);

  return businessLines
    .filter((l) => l.gl_account !== top.acc)
    .map((s): AnomalyFinding => ({
      id: `unusual_acc:${lineKey(s)}`,
      type: "unusual_account_for_text",
      severity: severityFromConfidence(confidence),
      confidence,
      title: `Unusual account for "${s.booking_text}"`,
      explanation:
        `Most "${s.booking_text}" postings use ${top.acc} ${expectedName}, ` +
        `but this line uses ${s.gl_account} ${s.gl_account_name}.`,
      evidence: [s, ...normalExamples],
      anomalousLineKeys: [lineKey(s)],
      contextSummary,
    }));
}

function findUnusualAccountAnomalies(
  groups: Map<string, TextGroup>
): AnomalyFinding[] {
  const out: AnomalyFinding[] = [];
  for (const g of groups.values()) {
    if (g.docCount < COMMON_DOC_COUNT) continue;
    out.push(...buildUnusualAccountFindings(g));
  }
  return out;
}

// ---------- composition ----------

function dedupeById(findings: AnomalyFinding[]): AnomalyFinding[] {
  const seen = new Set<string>();
  const out: AnomalyFinding[] = [];
  for (const f of findings) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

function compareFindings(a: AnomalyFinding, b: AnomalyFinding): number {
  const sevDelta = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (sevDelta !== 0) return sevDelta;
  return b.confidence - a.confidence;
}

export function detectAnomalies(lines: BookingLine[]): AnomalyFinding[] {
  const groups = bucketByText(lines);
  const findings = dedupeById([
    ...findTypoAnomalies(groups),
    ...findUnusualAccountAnomalies(groups),
  ]);
  return findings.sort(compareFindings);
}
