export const DEFAULT_ENERGY_TAGS = [
  "deep-work",
  "quick",
  "blocked-on-others",
] as const;

export type DefaultEnergyTag = (typeof DEFAULT_ENERGY_TAGS)[number];

export type LinearStateType =
  | "triage"
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "canceled";

export type LinearViewer = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  organization: {
    id: string;
    name: string;
    urlKey: string;
  };
};

export type LinearLabel = { id: string; name: string; color: string };
export type LinearProject = { id: string; name: string };
export type LinearTeam = { id: string; name: string; key: string };
export type LinearCycle = {
  id: string;
  name: string;
  number: number | null;
  startsAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
};
export type LinearState = {
  id: string;
  name: string;
  type: LinearStateType | string;
  color: string;
};

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  dueDate: string | null;
  estimate: number | null;
  updatedAt: string;
  createdAt: string;
  completedAt: string | null;
  state: LinearState;
  team: LinearTeam | null;
  project: LinearProject | null;
  cycle: LinearCycle | null;
  labels: LinearLabel[];
  blockedBy: { id: string; identifier: string; title: string }[];
};

export type IssueOverlay = {
  energyTag?: string;
  waitingOn?: string;
  estimateOverride?: number | null;
  estimateUnit?: "points" | "hours";
  prUrl?: string;
  slackUrl?: string;
  meetingNote?: string;
  scratch?: string;
  snoozeUntil?: string | null;
};

export type WorkspaceSettings = {
  wipLimit: number;
  staleDays: number;
  extraEnergyTags: string[];
};

export type WorkspacePublic = {
  id: string;
  name: string;
  source: "env" | "file";
};

export type BoardFacets = {
  states: LinearState[];
  projects: LinearProject[];
  teams: LinearTeam[];
  labels: LinearLabel[];
  cycles: LinearCycle[];
};

export type BoardCache = {
  syncedAt: string;
  viewer: LinearViewer;
  issues: LinearIssue[];
  facets: BoardFacets;
  workflowStatesByTeamId: Record<string, LinearState[]>;
};

export type LinearWrite =
  | { kind: "update-state"; issueId: string; stateId: string }
  | { kind: "create-comment"; issueId: string; body: string }
  | { kind: "link-attachment"; issueId: string; url: string; title?: string };

export type LinearWriteResult = {
  ok: boolean;
  error: string | null;
  issue?: LinearIssue;
};

export type LinearChangeNotice = {
  updatedAt: string;
  kinds: string[];
  issueIds: string[];
  deliveryCount: number;
};

/** Local overlays keyed by Linear issue id. Linear remains source of truth for status. */
export type OverlayStore = {
  issues: Record<string, IssueOverlay>;
  focusQueue: string[];
  settings: WorkspaceSettings;
};

export type BoardPayload = {
  ok: boolean;
  configured: boolean;
  live: boolean;
  fromCache: boolean;
  stale: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  workspace: WorkspacePublic | null;
  workspaces: WorkspacePublic[];
  viewer: LinearViewer | null;
  issues: LinearIssue[];
  facets: BoardFacets;
  overlays: OverlayStore;
  workflowStatesByTeamId: Record<string, LinearState[]>;
  changeNotice: LinearChangeNotice | null;
  webhookConfigured: boolean;
};

export type SortKey = "priority" | "updated" | "due";
export type SortDir = "asc" | "desc";

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  wipLimit: 3,
  staleDays: 7,
  extraEnergyTags: [],
};

export const EMPTY_FACETS: BoardFacets = {
  states: [],
  projects: [],
  teams: [],
  labels: [],
  cycles: [],
};

export const EMPTY_ISSUES: LinearIssue[] = [];

export const EMPTY_OVERLAYS: OverlayStore = {
  issues: {},
  focusQueue: [],
  settings: DEFAULT_SETTINGS,
};

export function isCompletedStateType(type: string): boolean {
  return type === "completed" || type === "canceled";
}

export function isInProgressState(state: LinearState): boolean {
  return state.type === "started";
}

export function effectiveEstimate(
  issue: LinearIssue,
  overlay: IssueOverlay | undefined,
): number | null {
  if (overlay?.estimateOverride != null && overlay.estimateOverride !== 0) {
    return overlay.estimateOverride;
  }
  if (overlay?.estimateOverride === 0) return 0;
  return issue.estimate;
}
