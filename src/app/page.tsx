import { AnomalyCard } from "@/components/AnomalyCard";
import { DuplicateCard } from "@/components/DuplicateCard";
import { Tabs } from "@/components/Tabs";
import { detectAnomalies } from "@/lib/anomalies";
import { bookings } from "@/lib/bookings";
import { detectDuplicateBookings } from "@/lib/duplicates";

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

function StatRow({
  items,
}: Readonly<{ items: ReadonlyArray<{ label: string; value: number }> }>) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((s) => (
        <Stat key={s.label} label={s.label} value={s.value} />
      ))}
    </section>
  );
}

function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
      {message}
    </p>
  );
}

export default function Home() {
  const findings = detectAnomalies(bookings);
  const duplicates = detectDuplicateBookings(bookings);

  const highAnomalies = findings.filter((f) => f.severity === "high").length;
  const highDuplicates = duplicates.filter((d) => d.severity === "high").length;

  const anomaliesPanel = (
    <>
      <StatRow
        items={[
          { label: "Total booking lines", value: bookings.length },
          { label: "Anomaly findings", value: findings.length },
          { label: "High confidence", value: highAnomalies },
        ]}
      />
      <div className="space-y-4">
        {findings.length === 0 ? (
          <EmptyState message="No anomalies detected." />
        ) : (
          findings.map((finding) => (
            <AnomalyCard key={finding.id} finding={finding} />
          ))
        )}
      </div>
    </>
  );

  const duplicatesPanel = (
    <>
      <StatRow
        items={[
          { label: "Total booking lines", value: bookings.length },
          { label: "Duplicate candidates", value: duplicates.length },
          { label: "High confidence", value: highDuplicates },
        ]}
      />
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Duplicate findings are heuristic review candidates, not definitive
        duplicates.
      </p>
      <div className="space-y-4">
        {duplicates.length === 0 ? (
          <EmptyState message="No duplicate candidates found." />
        ) : (
          duplicates.map((candidate) => (
            <DuplicateCard key={candidate.id} candidate={candidate} />
          ))
        )}
      </div>
    </>
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Booking Insights
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            These findings are heuristic review candidates, not definitive
            accounting errors.
          </p>
        </header>

        <Tabs
          tabs={[
            {
              key: "anomalies",
              label: "Anomalies",
              count: findings.length,
              content: anomaliesPanel,
            },
            {
              key: "duplicates",
              label: "Duplicates",
              count: duplicates.length,
              content: duplicatesPanel,
            },
          ]}
        />
      </div>
    </main>
  );
}
