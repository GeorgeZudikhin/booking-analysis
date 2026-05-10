
import type { BookingLine, DocumentSummary, DuplicateCandidate } from "@/lib/types";

const SEVERITY_STYLES: Record<DuplicateCandidate["severity"], string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

function formatAmount(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLineAmount(line: BookingLine): string {
  return formatAmount(line.amount, line.currency);
}

function DocPanel({ doc, label }: Readonly<{ doc: DocumentSummary; label: string }>) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
        {doc.document_id}
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-zinc-500">Posting date</dt>
        <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
          {doc.posting_date}
        </dd>
        <dt className="text-zinc-500">Party</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">
          {doc.party_name ?? doc.party_id ?? "—"}
        </dd>
        <dt className="text-zinc-500">Debit total</dt>
        <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
          {formatAmount(doc.debit_total, doc.currency)}
        </dd>
        <dt className="text-zinc-500">Booking text</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">
          {doc.representative_text || "—"}
        </dd>
      </dl>
    </div>
  );
}

export function DuplicateCard({
  candidate,
}: Readonly<{ candidate: DuplicateCandidate }>) {
  const { documentA, documentB } = candidate;
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${SEVERITY_STYLES[candidate.severity]}`}
            >
              {candidate.severity}
            </span>
            <span className="text-xs text-zinc-500">
              possible_duplicate
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="font-mono">{documentA.document_id}</span>
            <span className="px-1.5 text-zinc-400">↔</span>
            <span className="font-mono">{documentB.document_id}</span>
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Confidence
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {candidate.confidence}%
          </div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DocPanel doc={documentA} label="Document A" />
        <DocPanel doc={documentB} label="Document B" />
      </div>

      <ul className="mt-4 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
        {candidate.criteria.map((c) => (
          <li key={c} className="flex gap-2">
            <span aria-hidden className="text-zinc-400">•</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-3 font-medium">Document</th>
              <th className="py-2 pr-3 font-medium">G/L Account</th>
              <th className="py-2 pr-3 font-medium text-right">Amount</th>
              <th className="py-2 pr-3 font-medium">Booking text</th>
            </tr>
          </thead>
          <tbody>
            {[...documentA.lines, ...documentB.lines].map((l) => (
              <tr
                key={`${l.document_id}-${l.line_id}`}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-2 pr-3 font-mono">
                  {l.document_id}/{l.line_id}
                </td>
                <td className="py-2 pr-3">
                  <span className="font-mono">{l.gl_account}</span>{" "}
                  <span className="text-zinc-500">{l.gl_account_name}</span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatLineAmount(l)}
                </td>
                <td className="py-2 pr-3">{l.booking_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
