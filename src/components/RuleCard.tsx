import type { BookingManualRule } from "@/lib/types";

const TYPE_LABELS: Record<BookingManualRule["type"], string> = {
  text_to_account: "Text → Account",
  text_to_cost_center: "Text → Cost Center",
  vendor_to_account: "Vendor → Account",
  account_to_tax_code: "Account → Tax Code",
};

export function RuleCard({ rule }: Readonly<{ rule: BookingManualRule }>) {
  const hasMismatches = rule.mismatch_count > 0;
  const mismatchKeys = new Set(rule.mismatch_line_keys);
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {TYPE_LABELS[rule.type]}
            </span>
            <span className="text-xs tabular-nums text-zinc-500">
              {rule.support_count} / {rule.total_count} matches
            </span>
            {hasMismatches && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {rule.mismatch_count} mismatch
                {rule.mismatch_count === 1 ? "" : "es"}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {rule.title}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Confidence
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {rule.confidence}%
          </div>
        </div>
      </header>

      <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
        {rule.description}
      </p>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Suggested check
        </div>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
          {rule.suggested_check}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-3 font-medium">Document</th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Booking text</th>
              <th className="py-2 pr-3 font-medium">G/L Account</th>
              <th className="py-2 pr-3 font-medium">Cost ctr</th>
              <th className="py-2 pr-3 font-medium">Counterparty</th>
              <th className="py-2 pr-3 font-medium">Tax</th>
            </tr>
          </thead>
          <tbody>
            {rule.evidence.map((l) => {
              const isMismatch = mismatchKeys.has(`${l.document_id}#${l.line_id}`);
              const rowClass = isMismatch
                ? "bg-amber-50/70 border-y border-amber-300 dark:bg-amber-950/25 dark:border-amber-700"
                : "border-b border-zinc-100 dark:border-zinc-800";
              return (
              <tr
                key={`${l.document_id}-${l.line_id}`}
                className={rowClass}
              >
                <td className="py-2 pr-3 font-mono">
                  {l.document_id}/{l.line_id}
                </td>
                <td className="py-2 pr-3 tabular-nums">{l.posting_date}</td>
                <td className="py-2 pr-3">{l.booking_text}</td>
                <td className="py-2 pr-3">
                  <span className="font-mono">{l.gl_account}</span>{" "}
                  <span className="text-zinc-500">{l.gl_account_name}</span>
                </td>
                <td className="py-2 pr-3 font-mono">{l.cost_center ?? "—"}</td>
                <td className="py-2 pr-3">
                  {l.vendor_name ?? l.customer_name ?? "—"}
                </td>
                <td className="py-2 pr-3 font-mono">{l.tax_code ?? "—"}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
