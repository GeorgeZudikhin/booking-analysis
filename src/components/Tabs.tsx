"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  key: string;
  label: string;
  count: number;
  content: ReactNode;
};

export function Tabs({ tabs }: Readonly<{ tabs: Tab[] }>) {
  const initialKey = tabs[0]?.key ?? "";
  const [activeKey, setActiveKey] = useState(initialKey);
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  if (!active) return null;

  return (
    <>
      <nav
        role="tablist"
        aria-label="Findings"
        className="mb-6 flex gap-6 border-b border-zinc-200 dark:border-zinc-800"
      >
        {tabs.map((t) => {
          const isActive = t.key === active.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveKey(t.key)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  isActive
                    ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </nav>
      <div role="tabpanel" aria-label={active.label}>
        {active.content}
      </div>
    </>
  );
}
