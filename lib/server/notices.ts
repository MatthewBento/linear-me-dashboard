import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { coalesceChangeNotice, mergeChangeNotices } from "@/lib/linear/webhook";
import { safeWorkspaceId } from "@/lib/server/store";
import type { LinearChangeNotice } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "notices");
// One edit can arrive as several webhook deliveries. Flushing once keeps a single notice file.
const NOTICE_DEBOUNCE_MS = 1500;

type Burst = {
  timer: ReturnType<typeof setTimeout>;
  notice: LinearChangeNotice;
};

const bursts = new Map<string, Burst>();
const tails = new Map<string, Promise<void>>();

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.LINEAR_WEBHOOK_SECRET?.trim());
}

export async function readNotice(workspaceId: string): Promise<LinearChangeNotice | null> {
  try {
    const raw = await readFile(noticePath(workspaceId), "utf8");
    return normalizeNotice(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function writeNotice(workspaceId: string, notice: LinearChangeNotice) {
  const file = noticePath(workspaceId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(notice, null, 2), "utf8");
}

export function queueChangeNotice(
  workspaceId: string,
  event: { at: string; kind: string; issueId: string | null },
) {
  const current = bursts.get(workspaceId);
  const notice = coalesceChangeNotice(current?.notice ?? null, event);
  if (current) clearTimeout(current.timer);
  const timer = setTimeout(() => {
    bursts.delete(workspaceId);
    const prev = tails.get(workspaceId) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(() => flushNotice(workspaceId, notice));
    tails.set(workspaceId, next);
  }, NOTICE_DEBOUNCE_MS);
  bursts.set(workspaceId, { timer, notice });
}

export function noticeSettled(workspaceId: string): Promise<void> {
  return tails.get(workspaceId) ?? Promise.resolve();
}

async function flushNotice(workspaceId: string, incoming: LinearChangeNotice) {
  const previous = await readNotice(workspaceId);
  await writeNotice(workspaceId, mergeChangeNotices(previous, incoming));
}

function noticePath(workspaceId: string): string {
  return path.join(DATA_DIR, `${safeWorkspaceId(workspaceId)}.json`);
}

function normalizeNotice(value: unknown): LinearChangeNotice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.updatedAt !== "string" || typeof record.deliveryCount !== "number") {
    return null;
  }
  if (!Array.isArray(record.kinds) || !Array.isArray(record.issueIds)) return null;
  return {
    updatedAt: record.updatedAt,
    kinds: record.kinds.filter((kind): kind is string => typeof kind === "string"),
    issueIds: record.issueIds.filter((id): id is string => typeof id === "string"),
    deliveryCount: record.deliveryCount,
  };
}
