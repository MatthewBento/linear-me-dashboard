"use client";

/* Initial Linear fetch stores payload. React Compiler flags setState-in-effect for that bootstrap. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CloudOff,
  HelpCircle,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  WifiOff,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { EstimateChart } from "@/components/dashboard/estimate-chart";
import { IssueDrawer } from "@/components/dashboard/issue-drawer";
import { KeyboardHelp } from "@/components/dashboard/keyboard-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  applyFilters,
  cycleBurnStats,
  DEFAULT_FILTERS,
  isCurrentCycle,
  isDueToday,
  isOverdue,
  isSnoozed,
  isStale,
  sortIssues,
  type Filters,
} from "@/lib/board-logic";
import {
  DEFAULT_ENERGY_TAGS,
  isInProgressState,
  type BoardPayload,
  type IssueOverlay,
  type LinearChangeNotice,
  type LinearIssue,
  type OverlayStore,
  type SortDir,
  type SortKey,
  EMPTY_OVERLAYS,
  EMPTY_ISSUES,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "board" | "brief" | "focus" | "blockers" | "stale" | "burn";

const VIEWS: { id: View; label: string; key: string }[] = [
  { id: "board", label: "Board", key: "1" },
  { id: "brief", label: "Morning brief", key: "2" },
  { id: "focus", label: "Focus", key: "3" },
  { id: "blockers", label: "Blockers", key: "4" },
  { id: "stale", label: "Stale radar", key: "5" },
  { id: "burn", label: "Estimate vs burn", key: "6" },
];

function formatSynced(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function tomorrowLabel(): string {
  return tomorrowISO();
}

export function DashboardApp() {
  const { resolvedTheme, setTheme } = useTheme();
  const [payload, setPayload] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("board");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const listRoot = useRef<HTMLDivElement>(null);

  const overlays: OverlayStore = payload?.overlays ?? EMPTY_OVERLAYS;

  const load = useCallback(async (opts: { refresh?: boolean; workspaceId?: string } = {}) => {
    const refreshingNow = Boolean(opts.refresh);
    if (refreshingNow) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.refresh) params.set("refresh", "1");
      if (opts.workspaceId) params.set("workspace", opts.workspaceId);
      const res = await fetch(`/api/board?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as BoardPayload;
      setPayload(data);
      if (data.error && !data.fromCache) toast.error(data.error);
      else if (data.fromCache && data.error) toast.message("Using local cache", { description: data.error });
    } catch {
      toast.error("Could not reach the local API. Is the dev server running?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Network bootstrap. setState lives in the fetch finally, not here.
    void load({ refresh: true });
  }, [load]);

  const workspaceId = payload?.workspace?.id ?? null;
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const params = new URLSearchParams();
      if (workspaceId) params.set("workspace", workspaceId);
      try {
        const query = params.toString();
        const res = await fetch(query ? `/api/changes?${query}` : "/api/changes", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          notice: LinearChangeNotice | null;
          webhookConfigured: boolean;
        };
        if (cancelled) return;
        setPayload((prev) =>
          prev
            ? {
                ...prev,
                changeNotice: data.notice,
                webhookConfigured: data.webhookConfigured,
              }
            : prev,
        );
      } catch {
        return;
      }
    };
    const id = window.setInterval(() => {
      void tick();
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [workspaceId]);

  const persist = useCallback(
    async (body: {
      issueId?: string;
      patch?: IssueOverlay;
      focusQueue?: string[];
      settings?: OverlayStore["settings"];
      extraEnergyTag?: string;
    }) => {
      if (!payload?.workspace) return;
      const res = await fetch("/api/overlays", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: payload.workspace.id, ...body }),
      });
      const data = (await res.json()) as { ok: boolean; overlays?: OverlayStore; error?: string };
      if (!data.ok || !data.overlays) {
        toast.error(data.error ?? "Failed to save local overlay");
        return;
      }
      setPayload((prev) => (prev ? { ...prev, overlays: data.overlays! } : prev));
    },
    [payload],
  );

  const issues = payload?.issues ?? EMPTY_ISSUES;
  const energyTags = [
    ...DEFAULT_ENERGY_TAGS,
    ...overlays.settings.extraEnergyTags,
  ];

  const filtered = useMemo(
    () => sortIssues(applyFilters(issues, overlays, filters), sortKey, sortDir),
    [issues, overlays, filters, sortKey, sortDir],
  );

  const visibleForView = useMemo(() => {
    if (view === "stale") {
      return issues.filter((i) => isStale(i, overlays.settings.staleDays));
    }
    if (view === "blockers") {
      return issues.filter((i) => {
        const ov = overlays.issues[i.id];
        return (
          ov?.energyTag === "blocked-on-others" ||
          i.blockedBy.length > 0 ||
          /block/i.test(i.state.name)
        );
      });
    }
    if (view === "focus") {
      const map = new Map(issues.map((i) => [i.id, i]));
      return overlays.focusQueue.map((id) => map.get(id)).filter(Boolean) as LinearIssue[];
    }
    return filtered;
  }, [view, issues, overlays, filtered]);

  const activeId =
    selectedId && visibleForView.some((i) => i.id === selectedId)
      ? selectedId
      : (visibleForView[0]?.id ?? null);
  const selected = visibleForView.find((i) => i.id === activeId) ?? null;
  const drawerIssue = issues.find((i) => i.id === drawerId) ?? null;

  const wipCount = issues.filter((i) => isInProgressState(i.state)).length;
  const wipOver = wipCount > overlays.settings.wipLimit;

  const brief = useMemo(() => {
    const dueToday = issues.filter((i) => isDueToday(i));
    const overdue = issues.filter((i) => isOverdue(i));
    const unstartedCycle = issues.filter(
      (i) =>
        isCurrentCycle(i.cycle) &&
        (i.state.type === "unstarted" ||
          i.state.type === "backlog" ||
          i.state.type === "triage"),
    );
    const map = new Map(issues.map((i) => [i.id, i]));
    const focusTop = overlays.focusQueue
      .map((id) => map.get(id))
      .filter(Boolean)
      .slice(0, 5) as LinearIssue[];
    return { dueToday, overdue, unstartedCycle, focusTop };
  }, [issues, overlays.focusQueue]);

  const burns = useMemo(() => cycleBurnStats(issues, overlays), [issues, overlays]);

  const patchIssue = (issueId: string, patch: IssueOverlay) => {
    setPayload((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        overlays: {
          ...prev.overlays,
          issues: {
            ...prev.overlays.issues,
            [issueId]: { ...prev.overlays.issues[issueId], ...patch },
          },
        },
      };
    });
    void persist({ issueId, patch });
  };

  const toggleFocus = (issueId: string) => {
    const has = overlays.focusQueue.includes(issueId);
    const focusQueue = has
      ? overlays.focusQueue.filter((id) => id !== issueId)
      : [...overlays.focusQueue, issueId];
    setPayload((prev) =>
      prev ? { ...prev, overlays: { ...prev.overlays, focusQueue } } : prev,
    );
    void persist({ focusQueue });
  };

  const moveFocus = (issueId: string, dir: -1 | 1) => {
    const idx = overlays.focusQueue.indexOf(issueId);
    if (idx < 0) return;
    const next = [...overlays.focusQueue];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setPayload((prev) =>
      prev ? { ...prev, overlays: { ...prev.overlays, focusQueue: next } } : prev,
    );
    void persist({ focusQueue: next });
  };

  const onFocusDrag = (fromId: string, toId: string) => {
    const next = [...overlays.focusQueue];
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    setPayload((prev) =>
      prev ? { ...prev, overlays: { ...prev.overlays, focusQueue: next } } : prev,
    );
    void persist({ focusQueue: next });
  };

  const cycleEnergy = (issue: LinearIssue) => {
    const tags = ["", ...energyTags];
    const current = overlays.issues[issue.id]?.energyTag ?? "";
    const idx = tags.indexOf(current);
    const next = tags[(idx + 1) % tags.length];
    patchIssue(issue.id, { energyTag: next });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) {
        if (e.key === "Escape") {
          (target as HTMLElement).blur();
          setHelpOpen(false);
        }
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setDrawerId(null);
        setHelpOpen(false);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchInput.current?.focus();
        return;
      }
      if (e.key === "r") {
        e.preventDefault();
        void load({ refresh: true });
        return;
      }
      if (e.key === "c") {
        e.preventDefault();
        setFilters((f) => ({ ...f, showCompleted: !f.showCompleted }));
        return;
      }
      if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
        const next = VIEWS.find((v) => v.key === e.key);
        if (next) setView(next.id);
        return;
      }
      if (!selected) return;
      if (e.key === "j") {
        e.preventDefault();
        const idx = visibleForView.findIndex((i) => i.id === selected.id);
        const n = visibleForView[Math.min(visibleForView.length - 1, idx + 1)];
        if (n) setSelectedId(n.id);
      } else if (e.key === "k") {
        e.preventDefault();
        const idx = visibleForView.findIndex((i) => i.id === selected.id);
        const n = visibleForView[Math.max(0, idx - 1)];
        if (n) setSelectedId(n.id);
      } else if (e.key === "Enter") {
        e.preventDefault();
        window.open(selected.url, "_blank", "noopener,noreferrer");
      } else if (e.key === "o") {
        e.preventDefault();
        setDrawerId(selected.id);
      } else if (e.key === "f") {
        e.preventDefault();
        toggleFocus(selected.id);
      } else if (e.key === "s") {
        e.preventDefault();
        patchIssue(selected.id, { snoozeUntil: tomorrowISO() });
        toast.message(`Snoozed ${selected.identifier} until ${tomorrowLabel()}`);
      } else if (e.key === "x") {
        e.preventDefault();
        patchIssue(selected.id, { snoozeUntil: null });
      } else if (e.key === "e") {
        e.preventDefault();
        cycleEnergy(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, visibleForView, overlays, load]);

  useEffect(() => {
    const el = listRoot.current?.querySelector(`[data-issue-id="${activeId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const switchWorkspace = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      const data = (await res.json()) as BoardPayload;
      setPayload(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p>Loading your Linear cockpit…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                Personal Linear cockpit
              </p>
              <h1 className="truncate text-lg font-semibold">
                {payload?.viewer
                  ? `${payload.viewer.displayName || payload.viewer.name}'s issues`
                  : "Linear Me"}
              </h1>
            </div>
            {payload?.workspaces && payload.workspaces.length > 0 ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Workspace</span>
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                  value={payload.workspace?.id ?? ""}
                  onChange={(e) => void switchWorkspace(e.target.value)}
                >
                  {payload.workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Last synced {formatSynced(payload?.lastSyncedAt ?? null)}
            </span>
            <Button
              size="sm"
              variant="outline"
              data-testid="refresh"
              onClick={() => void load({ refresh: true })}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setHelpOpen(true)}
              aria-label="Keyboard help"
            >
              <HelpCircle />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
          <nav className="flex flex-wrap gap-1">
            {VIEWS.map((v) => (
              <Button
                key={v.id}
                size="sm"
                variant={view === v.id ? "default" : "ghost"}
                data-testid={`view-${v.id}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
                <kbd className="ml-1 hidden font-mono text-[10px] opacity-60 sm:inline">
                  {v.key}
                </kbd>
              </Button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
        {payload?.changeNotice &&
        (!payload.lastSyncedAt ||
          Date.parse(payload.changeNotice.updatedAt) > Date.parse(payload.lastSyncedAt)) ? (
          <Banner
            tone="info"
            testId="linear-changed-banner"
            icon={<RefreshCw className="size-4" />}
          >
            Linear updated. Refresh to load.
            {payload.changeNotice.kinds.length > 0
              ? ` ${payload.changeNotice.kinds.join(", ")}.`
              : ""}
          </Banner>
        ) : null}
        {payload && !payload.configured ? (
          <Banner
            tone="danger"
            testId="missing-key-banner"
            icon={<AlertTriangle className="size-4" />}
          >
            No API key. Copy <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env.local</code>, set{" "}
            <code className="font-mono">LINEAR_API_KEY</code>, and restart{" "}
            <code className="font-mono">npm run dev</code>.
          </Banner>
        ) : null}
        {payload?.fromCache ? (
          <Banner
            tone="warn"
            testId="offline-banner"
            icon={<WifiOff className="size-4" />}
          >
            Showing the last successful local cache
            {payload.error ? ` (${payload.error})` : "."} Linear is source of
            truth; overlays still save locally.
          </Banner>
        ) : payload?.stale && payload.ok ? (
          <Banner tone="warn" icon={<CloudOff className="size-4" />}>
            Cache is more than 30 minutes old. Hit Refresh when you want a live
            pass.
          </Banner>
        ) : null}
        {payload?.error && payload.configured && !payload.fromCache && !payload.ok ? (
          <Banner tone="danger" icon={<AlertTriangle className="size-4" />}>
            {payload.error}
          </Banner>
        ) : null}
        {wipOver ? (
          <Banner
            tone="warn"
            testId="wip-banner"
            icon={<AlertTriangle className="size-4" />}
          >
            Personal WIP is {wipCount} In Progress (soft cap{" "}
            {overlays.settings.wipLimit}). Finish or park something before
            pulling more.
          </Banner>
        ) : null}

        {view === "board" || view === "stale" || view === "blockers" ? (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
            <FiltersPanel
              payload={payload}
              filters={filters}
              setFilters={setFilters}
              sortKey={sortKey}
              sortDir={sortDir}
              setSortKey={setSortKey}
              setSortDir={setSortDir}
              energyTags={energyTags}
              searchInput={searchInput}
              wipCount={wipCount}
              onSettings={(settings) => void persist({ settings })}
              overlays={overlays}
            />
            <IssueList
              listRoot={listRoot}
              issues={visibleForView}
              overlays={overlays}
              selectedId={activeId}
              staleDays={overlays.settings.staleDays}
              emptyTitle={
                view === "stale"
                  ? "Nothing stale"
                  : view === "blockers"
                    ? "No blockers"
                    : "No matching issues"
              }
              emptyBody={
                view === "stale"
                  ? `Nothing you own is older than ${overlays.settings.staleDays} days.`
                  : view === "blockers"
                    ? "Tag issues blocked-on-others or wait for Linear blocked-by links."
                    : filters.showCompleted
                      ? "Try clearing filters."
                      : "Empty active queue, or toggle Show completed."
              }
              onSelect={setSelectedId}
              onOpenDrawer={setDrawerId}
              onOpenLinear={(url) => window.open(url, "_blank", "noopener,noreferrer")}
            />
            <FocusRail
              issues={issues}
              overlays={overlays}
              onMove={moveFocus}
              onDrag={onFocusDrag}
              onSelect={(id) => {
                setView("focus");
                setSelectedId(id);
              }}
            />
          </div>
        ) : null}

        {view === "focus" ? (
          <FocusFull
            issues={issues}
            overlays={overlays}
            selectedId={activeId}
            onSelect={setSelectedId}
            onToggle={toggleFocus}
            onMove={moveFocus}
            onDrag={onFocusDrag}
            onOpenDrawer={setDrawerId}
          />
        ) : null}

        {view === "brief" ? (
          <MorningBrief
            brief={brief}
            onOpen={(issue) => {
              setDrawerId(issue.id);
              setSelectedId(issue.id);
            }}
          />
        ) : null}

        {view === "burn" ? (
          <Card>
            <CardHeader>
              <CardTitle>Estimate vs cycle remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Uses Linear estimates when present, otherwise your local override.
                Burned = completed issues in that cycle. Remaining days come from
                the cycle end date.
              </p>
              <EstimateChart rows={burns} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <IssueDrawer
        issue={drawerIssue}
        overlay={drawerIssue ? overlays.issues[drawerIssue.id] : undefined}
        energyTags={overlays.settings.extraEnergyTags}
        workflowStatesByTeamId={payload?.workflowStatesByTeamId ?? {}}
        fallbackStates={payload?.facets.states ?? []}
        workspaceId={payload?.workspace?.id ?? null}
        onClose={() => setDrawerId(null)}
        onPatch={patchIssue}
        onAddTag={(tag) => {
          void persist({ extraEnergyTag: tag });
        }}
        onReplaceIssue={(issue) => {
          setPayload((prev) =>
            prev
              ? {
                  ...prev,
                  issues: prev.issues.map((item) => (item.id === issue.id ? issue : item)),
                }
              : prev,
          );
        }}
      />
      <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function Banner({
  children,
  tone,
  icon,
  testId,
}: {
  children: React.ReactNode;
  tone: "warn" | "danger" | "info";
  icon: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        tone === "danger"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : tone === "info"
            ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
            : "border-amber-500/40 bg-amber-500/10 text-amber-200",
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function FiltersPanel({
  payload,
  filters,
  setFilters,
  sortKey,
  sortDir,
  setSortKey,
  setSortDir,
  energyTags,
  searchInput,
  wipCount,
  overlays,
  onSettings,
}: {
  payload: BoardPayload | null;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  sortKey: SortKey;
  sortDir: SortDir;
  setSortKey: (k: SortKey) => void;
  setSortDir: (d: SortDir) => void;
  energyTags: string[];
  searchInput: React.RefObject<HTMLInputElement | null>;
  wipCount: number;
  overlays: OverlayStore;
  onSettings: (settings: OverlayStore["settings"]) => void;
}) {
  const facets = payload?.facets;
  return (
    <aside className="space-y-4 rounded-xl border bg-card p-3">
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          ref={searchInput}
          value={filters.search}
          placeholder="Title, id, scratch…  (/)"
          data-testid="search"
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </div>
      <FilterSelect
        label="Project"
        value={filters.projectId ?? ""}
        onChange={(v) => setFilters((f) => ({ ...f, projectId: v || null }))}
        options={(facets?.projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
      />
      <FilterSelect
        label="Status"
        value={filters.stateId ?? ""}
        onChange={(v) => setFilters((f) => ({ ...f, stateId: v || null }))}
        options={(facets?.states ?? []).map((p) => ({ value: p.id, label: p.name }))}
      />
      <FilterSelect
        label="Priority"
        value={filters.priority == null ? "" : String(filters.priority)}
        onChange={(v) =>
          setFilters((f) => ({ ...f, priority: v === "" ? null : Number(v) }))
        }
        options={[
          { value: "1", label: "Urgent" },
          { value: "2", label: "High" },
          { value: "3", label: "Medium" },
          { value: "4", label: "Low" },
          { value: "0", label: "No priority" },
        ]}
      />
      <FilterSelect
        label="Label"
        value={filters.labelId ?? ""}
        onChange={(v) => setFilters((f) => ({ ...f, labelId: v || null }))}
        options={(facets?.labels ?? []).map((p) => ({ value: p.id, label: p.name }))}
      />
      <FilterSelect
        label="Cycle / sprint"
        value={filters.cycleId ?? ""}
        onChange={(v) => setFilters((f) => ({ ...f, cycleId: v || null }))}
        options={(facets?.cycles ?? []).map((p) => ({ value: p.id, label: p.name }))}
      />
      <FilterSelect
        label="Energy tag"
        value={filters.energyTag ?? ""}
        onChange={(v) => setFilters((f) => ({ ...f, energyTag: v || null }))}
        options={energyTags.map((t) => ({ value: t, label: t }))}
      />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={filters.showCompleted}
          onCheckedChange={(v) =>
            setFilters((f) => ({ ...f, showCompleted: Boolean(v) }))
          }
        />
        Show completed
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={!filters.hideSnoozed}
          onCheckedChange={(v) =>
            setFilters((f) => ({ ...f, hideSnoozed: !v }))
          }
        />
        Show snoozed
      </label>
      <Separator />
      <div className="grid grid-cols-2 gap-2">
        <FilterSelect
          label="Sort"
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          options={[
            { value: "priority", label: "Priority" },
            { value: "updated", label: "Updated" },
            { value: "due", label: "Due" },
          ]}
          allowAll={false}
        />
        <FilterSelect
          label="Dir"
          value={sortDir}
          onChange={(v) => setSortDir(v as SortDir)}
          options={[
            { value: "asc", label: "Asc" },
            { value: "desc", label: "Desc" },
          ]}
          allowAll={false}
        />
      </div>
      <Separator />
      <div className="space-y-2">
        <Label htmlFor="wip">WIP limit (In Progress)</Label>
        <Input
          id="wip"
          type="number"
          min={1}
          value={overlays.settings.wipLimit}
          onChange={(e) =>
            onSettings({
              ...overlays.settings,
              wipLimit: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
        <p className="text-xs text-muted-foreground">{wipCount} started now</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="stale">Stale after (days)</Label>
        <Input
          id="stale"
          type="number"
          min={1}
          value={overlays.settings.staleDays}
          onChange={(e) =>
            onSettings({
              ...overlays.settings,
              staleDays: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
      </div>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allowAll = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowAll?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowAll ? <option value="">All</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function IssueList({
  listRoot,
  issues,
  overlays,
  selectedId,
  staleDays,
  emptyTitle,
  emptyBody,
  onSelect,
  onOpenDrawer,
  onOpenLinear,
}: {
  listRoot: React.RefObject<HTMLDivElement | null>;
  issues: LinearIssue[];
  overlays: OverlayStore;
  selectedId: string | null;
  staleDays: number;
  emptyTitle: string;
  emptyBody: string;
  onSelect: (id: string) => void;
  onOpenDrawer: (id: string) => void;
  onOpenLinear: (url: string) => void;
}) {
  if (issues.length === 0) {
    return (
      <Card className="min-h-64">
        <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="font-medium">{emptyTitle}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{emptyBody}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <ScrollArea className="h-[min(70vh,820px)]">
        <div ref={listRoot} className="divide-y">
          {issues.map((issue) => {
            const ov = overlays.issues[issue.id];
            const focused = overlays.focusQueue.includes(issue.id);
            const stale = isStale(issue, staleDays);
            const selected = issue.id === selectedId;
            return (
              <button
                key={issue.id}
                type="button"
                data-issue-id={issue.id}
                data-testid="issue-row"
                onClick={() => onSelect(issue.id)}
                onDoubleClick={() => onOpenDrawer(issue.id)}
                className={cn(
                  "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                  selected && "bg-muted",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {issue.identifier}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      background: `${issue.state.color}22`,
                      color: issue.state.color,
                    }}
                  >
                    {issue.state.name}
                  </span>
                  {issue.priority > 0 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {issue.priorityLabel}
                    </Badge>
                  ) : null}
                  {focused ? (
                    <Badge className="text-[10px]">Focus</Badge>
                  ) : null}
                  {stale ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Stale
                    </Badge>
                  ) : null}
                  {isSnoozed(ov) ? (
                    <Badge variant="outline" className="text-[10px]">
                      Snoozed
                    </Badge>
                  ) : null}
                  {ov?.energyTag ? (
                    <Badge variant="outline" className="text-[10px]">
                      {ov.energyTag}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm font-medium">{issue.title}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {issue.project ? <span>{issue.project.name}</span> : null}
                  {issue.cycle ? <span>{issue.cycle.name}</span> : null}
                  {issue.dueDate ? (
                    <span className={isOverdue(issue) ? "text-destructive" : ""}>
                      Due {issue.dueDate}
                    </span>
                  ) : null}
                  {ov?.waitingOn ? (
                    <span>Waiting on {ov.waitingOn}</span>
                  ) : null}
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLinear(issue.url);
                    }}
                  >
                    Linear ↗
                  </button>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDrawer(issue.id);
                    }}
                  >
                    Overlay
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}

function FocusRail(props: {
  issues: LinearIssue[];
  overlays: OverlayStore;
  onMove: (id: string, dir: -1 | 1) => void;
  onDrag: (from: string, to: string) => void;
  onSelect: (id: string) => void;
}) {
  const map = new Map(props.issues.map((i) => [i.id, i]));
  const rows = props.overlays.focusQueue
    .map((id) => map.get(id))
    .filter(Boolean) as LinearIssue[];
  return (
    <aside
      className="hidden space-y-2 rounded-xl border bg-card p-3 lg:block"
      data-testid="focus-queue"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Doing today</h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Press <kbd className="font-mono">f</kbd> on an issue to rank it here.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((issue, idx) => (
            <li
              key={issue.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/issue-id", issue.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData("text/issue-id");
                if (from) props.onDrag(from, issue.id);
              }}
              className="flex items-center gap-1 rounded-md border px-2 py-1.5"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-xs"
                onClick={() => props.onSelect(issue.id)}
              >
                <span className="font-mono text-muted-foreground">{idx + 1}. </span>
                {issue.identifier}
              </button>
              <Button size="icon-xs" variant="ghost" onClick={() => props.onMove(issue.id, -1)}>
                <ArrowUp />
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => props.onMove(issue.id, 1)}>
                <ArrowDown />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function FocusFull(props: {
  issues: LinearIssue[];
  overlays: OverlayStore;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDrag: (from: string, to: string) => void;
  onOpenDrawer: (id: string) => void;
}) {
  const map = new Map(props.issues.map((i) => [i.id, i]));
  const rows = props.overlays.focusQueue
    .map((id) => map.get(id))
    .filter(Boolean) as LinearIssue[];
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Focus queue is empty. On the board, select an issue and press{" "}
          <kbd className="font-mono">f</kbd>.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <ul>
        {rows.map((issue, idx) => (
          <li
            key={issue.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/issue-id", issue.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData("text/issue-id");
              if (from) props.onDrag(from, issue.id);
            }}
            className={cn(
              "flex items-center gap-2 border-b px-3 py-2",
              issue.id === props.selectedId && "bg-muted",
            )}
          >
            <span className="w-6 font-mono text-xs text-muted-foreground">{idx + 1}</span>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => props.onSelect(issue.id)}
              onDoubleClick={() => props.onOpenDrawer(issue.id)}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {issue.identifier}
              </span>
              <span className="ml-2 text-sm">{issue.title}</span>
            </button>
            <Button size="icon-xs" variant="ghost" onClick={() => props.onMove(issue.id, -1)}>
              <ArrowUp />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => props.onMove(issue.id, 1)}>
              <ArrowDown />
            </Button>
            <Button size="xs" variant="outline" onClick={() => props.onToggle(issue.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MorningBrief({
  brief,
  onOpen,
}: {
  brief: {
    dueToday: LinearIssue[];
    overdue: LinearIssue[];
    unstartedCycle: LinearIssue[];
    focusTop: LinearIssue[];
  };
  onOpen: (issue: LinearIssue) => void;
}) {
  const sections: { title: string; items: LinearIssue[]; empty: string }[] = [
    { title: "Due today", items: brief.dueToday, empty: "Nothing due today." },
    { title: "Overdue", items: brief.overdue, empty: "No overdue work. Nice." },
    {
      title: "Unstarted in current cycle",
      items: brief.unstartedCycle,
      empty: "No unstarted issues in an active cycle.",
    },
    {
      title: "Focus queue top 5",
      items: brief.focusTop,
      empty: "Rank a doing-today list with f.",
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="morning-brief">
      {sections.map((sec) => (
        <Card key={sec.title}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {sec.title}
              <Badge variant="secondary">{sec.items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sec.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{sec.empty}</p>
            ) : (
              <ul className="space-y-2">
                {sec.items.map((issue) => (
                  <li key={issue.id}>
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => onOpen(issue)}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {issue.identifier}
                      </span>{" "}
                      {issue.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
