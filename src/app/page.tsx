import { AnomalyCard } from "@/components/AnomalyCard";
import { detectAnomalies } from "@/lib/anomalies";
import { bookings } from "@/lib/bookings";

function Stat({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

export default function Home() {
  const findings = detectAnomalies(bookings);
  const highCount = findings.filter((f) => f.severity === "high").length;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Booking Insights
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            These findings are review candidates, not definitive accounting errors.
          </p>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Total booking lines" value={bookings.length} />
          <Stat label="Total findings" value={findings.length} />
          <Stat label="High confidence" value={highCount} />
        </section>

        <section className="space-y-4">
          {findings.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              No anomalies detected.
            </p>
          ) : (
            findings.map((finding) => <AnomalyCard key={finding.id} finding={finding} />)
          )}
        </section>
      </div>
    </main>
  );
}
