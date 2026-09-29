"use client";

import type { CycleBurn } from "@/lib/board-logic";

export function EstimateChart({ rows }: { rows: CycleBurn[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cycle data on your issues yet. Estimates (Linear or a local override) will
        chart here once a cycle is attached.
      </p>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.remaining + r.burned));

  return (
    <div className="space-y-4" data-testid="estimate-chart">
      {rows.map((row) => {
        const remainPct = (row.remaining / max) * 100;
        const burnedPct = (row.burned / max) * 100;
        return (
          <div key={row.cycleId} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{row.cycleName}</span>
              <span className="text-muted-foreground">
                {row.daysRemaining == null
                  ? "No end date"
                  : `${row.daysRemaining}d remaining`}
                {" · "}
                remaining {row.remaining}
                {" / burned "}
                {row.burned}
                {row.unestimatedRemaining
                  ? ` · ${row.unestimatedRemaining} unestimated`
                  : ""}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-primary/80"
                style={{ width: `${remainPct}%` }}
                title="Remaining estimate"
              />
              <div
                className="bg-emerald-500/70"
                style={{ width: `${burnedPct}%` }}
                title="Burned (completed estimates)"
              />
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/80" /> Remaining
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500/70" /> Burned
        </span>
      </div>
    </div>
  );
}
