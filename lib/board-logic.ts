import {
  effectiveEstimate,
  isCompletedStateType,
  type IssueOverlay,
  type LinearIssue,
  type OverlayStore,
  type SortDir,
  type SortKey,
} from "@/lib/types";

export type Filters = {
  projectId: string | null;
  stateId: string | null;
  priority: number | null;
  labelId: string | null;
  cycleId: string | null;
  energyTag: string | null;
  showCompleted: boolean;
  hideSnoozed: boolean;
  search: string;
};

export const DEFAULT_FILTERS: Filters = {
  projectId: null,
  stateId: null,
  priority: null,
  labelId: null,
  cycleId: null,
  energyTag: null,
  showCompleted: false,
  hideSnoozed: true,
  search: "",
};

export function todayISODate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isSnoozed(overlay: IssueOverlay | undefined, now = new Date()): boolean {
  if (!overlay?.snoozeUntil) return false;
  return overlay.snoozeUntil >= todayISODate(now);
}

export function isStale(
  issue: LinearIssue,
  staleDays: number,
  now = new Date(),
): boolean {
  const then = new Date(issue.updatedAt).getTime();
  const ms = staleDays * 24 * 60 * 60 * 1000;
  return now.getTime() - then >= ms && !isCompletedStateType(issue.state.type);
}

export function isOverdue(issue: LinearIssue, now = new Date()): boolean {
  if (!issue.dueDate) return false;
  if (isCompletedStateType(issue.state.type)) return false;
  return issue.dueDate < todayISODate(now);
}

export function isDueToday(issue: LinearIssue, now = new Date()): boolean {
  if (!issue.dueDate) return false;
  if (isCompletedStateType(issue.state.type)) return false;
  return issue.dueDate === todayISODate(now);
}

export function isCurrentCycle(cycle: LinearIssue["cycle"], now = new Date()): boolean {
  if (!cycle || cycle.completedAt) return false;
  const t = now.getTime();
  const start = cycle.startsAt ? new Date(cycle.startsAt).getTime() : -Infinity;
  const end = cycle.endsAt ? new Date(cycle.endsAt).getTime() : Infinity;
  return t >= start && t <= end;
}

export function applyFilters(
  issues: LinearIssue[],
  overlays: OverlayStore,
  filters: Filters,
  now = new Date(),
): LinearIssue[] {
  const q = filters.search.trim().toLowerCase();
  return issues.filter((issue) => {
    const overlay = overlays.issues[issue.id];
    if (!filters.showCompleted && isCompletedStateType(issue.state.type)) return false;
    if (filters.hideSnoozed && isSnoozed(overlay, now)) return false;
    if (filters.projectId && issue.project?.id !== filters.projectId) return false;
    if (filters.stateId && issue.state.id !== filters.stateId) return false;
    if (filters.priority != null && issue.priority !== filters.priority) return false;
    if (filters.labelId && !issue.labels.some((l) => l.id === filters.labelId)) {
      return false;
    }
    if (filters.cycleId && issue.cycle?.id !== filters.cycleId) return false;
    if (filters.energyTag && overlay?.energyTag !== filters.energyTag) return false;
    if (q) {
      const hay = `${issue.identifier} ${issue.title} ${issue.project?.name ?? ""} ${
        overlay?.scratch ?? ""
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortIssues(
  issues: LinearIssue[],
  key: SortKey,
  dir: SortDir,
): LinearIssue[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...issues].sort((a, b) => {
    let cmp = 0;
    if (key === "priority") {
      const ap = a.priority === 0 ? 99 : a.priority;
      const bp = b.priority === 0 ? 99 : b.priority;
      cmp = ap - bp;
    } else if (key === "updated") {
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    } else {
      const ad = a.dueDate ?? (dir === "asc" ? "9999-12-31" : "0000-01-01");
      const bd = b.dueDate ?? (dir === "asc" ? "9999-12-31" : "0000-01-01");
      cmp = ad.localeCompare(bd);
    }
    if (cmp === 0) return a.identifier.localeCompare(b.identifier);
    return cmp * mul;
  });
}

export type CycleBurn = {
  cycleId: string;
  cycleName: string;
  startsAt: string | null;
  endsAt: string | null;
  daysRemaining: number | null;
  remaining: number;
  burned: number;
  unestimatedRemaining: number;
};

export function cycleBurnStats(
  issues: LinearIssue[],
  overlays: OverlayStore,
  now = new Date(),
): CycleBurn[] {
  const byCycle = new Map<string, LinearIssue[]>();
  for (const issue of issues) {
    if (!issue.cycle) continue;
    const list = byCycle.get(issue.cycle.id) ?? [];
    list.push(issue);
    byCycle.set(issue.cycle.id, list);
  }

  const rows: CycleBurn[] = [];
  for (const [cycleId, list] of byCycle) {
    const cycle = list[0].cycle;
    if (!cycle) continue;
    let remaining = 0;
    let burned = 0;
    let unestimatedRemaining = 0;
    for (const issue of list) {
      const est = effectiveEstimate(issue, overlays.issues[issue.id]);
      const done = isCompletedStateType(issue.state.type);
      if (done) {
        burned += est ?? 0;
      } else if (est == null) {
        unestimatedRemaining += 1;
      } else {
        remaining += est;
      }
    }
    let daysRemaining: number | null = null;
    if (cycle.endsAt) {
      const end = new Date(cycle.endsAt).getTime();
      daysRemaining = Math.max(0, Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000)));
    }
    rows.push({
      cycleId,
      cycleName: cycle.name,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      daysRemaining,
      remaining,
      burned,
      unestimatedRemaining,
    });
  }

  return rows.sort((a, b) => {
    const ac = isCurrentCycle(
      issues.find((i) => i.cycle?.id === a.cycleId)?.cycle ?? null,
      now,
    );
    const bc = isCurrentCycle(
      issues.find((i) => i.cycle?.id === b.cycleId)?.cycle ?? null,
      now,
    );
    if (ac !== bc) return ac ? -1 : 1;
    return a.cycleName.localeCompare(b.cycleName);
  });
}
