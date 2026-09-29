import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  EMPTY_OVERLAYS,
  type BoardCache,
  type LinearIssue,
  type OverlayStore,
  type WorkspacePublic,
  type WorkspaceSettings,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

export type WorkspaceSecret = WorkspacePublic & {
  apiKey: string;
  userIdOverride?: string;
};

type WorkspacesFile = {
  workspaces: {
    id: string;
    name: string;
    apiKey: string;
    userIdOverride?: string;
  }[];
};

type GlobalState = {
  activeWorkspaceId: string | null;
};

export function safeWorkspaceId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await ensureDir(path.dirname(file));
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

export async function loadWorkspaces(): Promise<WorkspaceSecret[]> {
  const list: WorkspaceSecret[] = [];
  const envKey = process.env.LINEAR_API_KEY?.trim();
  if (envKey) {
    list.push({
      id: "env-default",
      name: process.env.LINEAR_WORKSPACE_NAME?.trim() || "Default (env)",
      source: "env",
      apiKey: envKey,
      userIdOverride: process.env.LINEAR_USER_ID?.trim() || undefined,
    });
  }

  const filePath = path.join(DATA_DIR, "workspaces.local.json");
  const file = await readJson<WorkspacesFile>(filePath, { workspaces: [] });
  for (const ws of file.workspaces ?? []) {
    if (!ws?.id || !ws.apiKey) continue;
    list.push({
      id: ws.id,
      name: ws.name || ws.id,
      source: "file",
      apiKey: ws.apiKey,
      userIdOverride: ws.userIdOverride?.trim() || undefined,
    });
  }

  return list;
}

export function toPublic(ws: WorkspaceSecret): WorkspacePublic {
  return { id: ws.id, name: ws.name, source: ws.source };
}

export async function getGlobalState(): Promise<GlobalState> {
  return readJson<GlobalState>(path.join(DATA_DIR, "global.json"), {
    activeWorkspaceId: null,
  });
}

export async function setActiveWorkspace(id: string) {
  await writeJson(path.join(DATA_DIR, "global.json"), { activeWorkspaceId: id });
}

export async function resolveActiveWorkspace(): Promise<WorkspaceSecret | null> {
  const all = await loadWorkspaces();
  if (all.length === 0) return null;
  const global = await getGlobalState();
  return all.find((w) => w.id === global.activeWorkspaceId) ?? all[0];
}

export async function getWorkspaceById(
  id: string | null | undefined,
): Promise<WorkspaceSecret | null> {
  const all = await loadWorkspaces();
  if (id) return all.find((w) => w.id === id) ?? null;
  return resolveActiveWorkspace();
}

export async function readCache(workspaceId: string): Promise<BoardCache | null> {
  const file = path.join(DATA_DIR, "cache", `${safeWorkspaceId(workspaceId)}.json`);
  const data = await readJson<
    (Omit<BoardCache, "workflowStatesByTeamId"> & {
      workflowStatesByTeamId?: BoardCache["workflowStatesByTeamId"];
    }) | null
  >(file, null);
  if (!data?.viewer || !Array.isArray(data.issues)) return null;
  const states = data.workflowStatesByTeamId;
  return {
    ...data,
    workflowStatesByTeamId:
      states && typeof states === "object" && !Array.isArray(states) ? states : {},
  };
}

export async function patchCachedIssue(workspaceId: string, issue: LinearIssue) {
  const cache = await readCache(workspaceId);
  if (!cache) return;
  const index = cache.issues.findIndex((item) => item.id === issue.id);
  if (index < 0) return;
  const issues = cache.issues.slice();
  issues[index] = issue;
  await writeCache(workspaceId, { ...cache, issues });
}

export async function writeCache(workspaceId: string, cache: BoardCache) {
  await writeJson(path.join(DATA_DIR, "cache", `${safeWorkspaceId(workspaceId)}.json`), cache);
}

export async function readOverlays(workspaceId: string): Promise<OverlayStore> {
  const file = path.join(DATA_DIR, "overlays", `${safeWorkspaceId(workspaceId)}.json`);
  const data = await readJson<OverlayStore>(file, EMPTY_OVERLAYS);
  return {
    issues: data.issues ?? {},
    focusQueue: data.focusQueue ?? [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data.settings ?? {}),
      extraEnergyTags: data.settings?.extraEnergyTags ?? [],
    } satisfies WorkspaceSettings,
  };
}

export async function writeOverlays(workspaceId: string, overlays: OverlayStore) {
  await writeJson(
    path.join(DATA_DIR, "overlays", `${safeWorkspaceId(workspaceId)}.json`),
    overlays,
  );
}
