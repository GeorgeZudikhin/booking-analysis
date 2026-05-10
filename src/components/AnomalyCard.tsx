import type { AnomalyFinding, BookingLine } from "@/lib/types";

const SEVERITY_STYLES: Record<AnomalyFinding["severity"], string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  low: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
};

function formatAmount(line: BookingLine): string {
  return `${line.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${line.currency}`;
}

export function AnomalyCard({ finding }: Readonly<{ finding: AnomalyFinding }>) {
  const flagged = new Set(finding.anomalousLineKeys);
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${SEVERITY_STYLES[finding.severity]}`}
            >
              {finding.severity}
            </span>
            <span className="text-xs text-zinc-500">{finding.type}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {finding.title}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Confidence
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {finding.confidence}%
          </div>
        </div>
      </header>

      <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
        {finding.explanation}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-3 font-medium">Document</th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">G/L Account</th>
              <th className="py-2 pr-3 font-medium text-right">Amount</th>
              <th className="py-2 pr-3 font-medium">Booking text</th>
              <th className="py-2 pr-3 font-medium">Counterparty</th>
              <th className="py-2 pr-3 font-medium">Tax</th>
            </tr>
          </thead>
          <tbody>
            {finding.evidence.map((l) => {
              const isFlagged = flagged.has(`${l.document_id}#${l.line_id}`);
              const rowClass = isFlagged
                ? "bg-amber-50/70 border-y border-amber-300 dark:bg-amber-950/25 dark:border-amber-700"
                : "border-b border-zinc-100 dark:border-zinc-800";
              return (
                <tr key={`${l.document_id}-${l.line_id}`} className={rowClass}>
                  <td className="py-2 pr-3 font-mono">
                    {l.document_id}/{l.line_id}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{l.posting_date}</td>
                  <td className="py-2 pr-3">
                    <span className="font-mono">{l.gl_account}</span>{" "}
                    <span className="text-zinc-500">{l.gl_account_name}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatAmount(l)}
                  </td>
                  <td className="py-2 pr-3">{l.booking_text}</td>
                  <td className="py-2 pr-3">
                    {l.vendor_name ?? l.customer_name ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono">{l.tax_code ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {finding.contextSummary && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {finding.contextSummary}
          </p>
        )}
      </div>
    </article>
  );
}
