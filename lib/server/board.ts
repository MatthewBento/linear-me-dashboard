import { LinearApiError, LinearConfigError } from "@/lib/linear/client";
import { syncMyIssues } from "@/lib/linear/queries";
import { isWebhookConfigured, readNotice } from "@/lib/server/notices";
import {
  getWorkspaceById,
  loadWorkspaces,
  readCache,
  readOverlays,
  resolveActiveWorkspace,
  setActiveWorkspace,
  toPublic,
  writeCache,
  writeOverlays,
} from "@/lib/server/store";
import {
  EMPTY_FACETS,
  EMPTY_OVERLAYS,
  type BoardPayload,
  type IssueOverlay,
  type OverlayStore,
  type WorkspaceSettings,
} from "@/lib/types";

const STALE_MS = 30 * 60 * 1000;

function publicError(err: unknown): string {
  if (err instanceof LinearConfigError || err instanceof LinearApiError) {
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error talking to Linear.";
}

export async function buildBoard(opts: {
  workspaceId?: string | null;
  refresh?: boolean;
}): Promise<BoardPayload> {
  const workspaces = await loadWorkspaces();
  const publicList = workspaces.map(toPublic);
  const webhookConfigured = isWebhookConfigured();
  const workspace = opts.workspaceId
    ? await getWorkspaceById(opts.workspaceId)
    : await resolveActiveWorkspace();

  if (!workspace) {
    return {
      ok: false,
      configured: false,
      live: false,
      fromCache: false,
      stale: false,
      error:
        "No Linear API key configured. Add LINEAR_API_KEY to .env.local (see .env.example).",
      lastSyncedAt: null,
      workspace: null,
      workspaces: publicList,
      viewer: null,
      issues: [],
      facets: EMPTY_FACETS,
      overlays: EMPTY_OVERLAYS,
      workflowStatesByTeamId: {},
      changeNotice: null,
      webhookConfigured,
    };
  }

  const changeNotice = await readNotice(workspace.id);

  await setActiveWorkspace(workspace.id);
  const overlays = await readOverlays(workspace.id);
  const cached = await readCache(workspace.id);

  let liveCache = cached;
  let live = false;
  let error: string | null = null;

  const cacheAge = cached ? Date.now() - new Date(cached.syncedAt).getTime() : Infinity;
  const shouldFetch = opts.refresh || !cached;

  if (shouldFetch) {
    try {
      liveCache = await syncMyIssues(workspace.apiKey, workspace.userIdOverride);
      await writeCache(workspace.id, liveCache);
      live = true;
      error = null;
    } catch (err) {
      error = publicError(err);
      live = false;
    }
  } else {
    live = Boolean(cached);
  }

  const fromCache = !live && Boolean(cached);
  const payloadCache = liveCache ?? cached;

  if (!payloadCache) {
    return {
      ok: false,
      configured: true,
      live: false,
      fromCache: false,
      stale: false,
      error: error ?? "No board data yet. Refresh after setting a valid API key.",
      lastSyncedAt: null,
      workspace: toPublic(workspace),
      workspaces: publicList,
      viewer: null,
      issues: [],
      facets: EMPTY_FACETS,
      overlays,
      workflowStatesByTeamId: {},
      changeNotice,
      webhookConfigured,
    };
  }

  const stale = fromCache || cacheAge > STALE_MS;

  return {
    ok: !error || Boolean(payloadCache),
    configured: true,
    live,
    fromCache,
    stale,
    error,
    lastSyncedAt: payloadCache.syncedAt,
    workspace: toPublic(workspace),
    workspaces: publicList,
    viewer: payloadCache.viewer,
    issues: payloadCache.issues,
    facets: payloadCache.facets,
    overlays,
    workflowStatesByTeamId: payloadCache.workflowStatesByTeamId ?? {},
    changeNotice,
    webhookConfigured,
  };
}

export async function saveOverlays(opts: {
  workspaceId?: string | null;
  issueId?: string;
  patch?: IssueOverlay;
  focusQueue?: string[];
  settings?: Partial<WorkspaceSettings>;
  extraEnergyTag?: string;
}): Promise<OverlayStore> {
  const workspace = await getWorkspaceById(opts.workspaceId);
  if (!workspace) {
    throw new LinearConfigError("No workspace configured.");
  }
  const current = await readOverlays(workspace.id);
  const next: OverlayStore = {
    issues: { ...current.issues },
    focusQueue: opts.focusQueue ?? current.focusQueue,
    settings: { ...current.settings, ...(opts.settings ?? {}) },
  };
  if (opts.extraEnergyTag?.trim()) {
    const tag = opts.extraEnergyTag.trim();
    if (!next.settings.extraEnergyTags.includes(tag)) {
      next.settings.extraEnergyTags = [...next.settings.extraEnergyTags, tag];
    }
  }
  if (opts.issueId && opts.patch) {
    next.issues[opts.issueId] = {
      ...(next.issues[opts.issueId] ?? {}),
      ...opts.patch,
    };
  }
  await writeOverlays(workspace.id, next);
  return next;
}
