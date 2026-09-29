import { createHmac, timingSafeEqual } from "node:crypto";
import type { LinearChangeNotice } from "@/lib/types";

export const WEBHOOK_MAX_SKEW_MS = 60_000;

const NOTICE_KINDS = new Set(["Issue", "Comment"]);

export type WebhookVerdict =
  | {
      ok: true;
      type: string;
      issueId: string | null;
      webhookTimestamp: number;
    }
  | { ok: false; reason: "bad-signature" | "stale-timestamp" | "invalid-payload" };

export function signWebhookBody(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function webhookSignaturesEqual(expectedHex: string, provided: string | null): boolean {
  if (!provided) return false;
  const actual = Buffer.from(provided.trim(), "utf8");
  const expected = Buffer.from(expectedHex, "utf8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function webhookTimestampFresh(webhookTimestamp: number, now: number): boolean {
  return Math.abs(now - webhookTimestamp) <= WEBHOOK_MAX_SKEW_MS;
}

export function assessWebhook(opts: {
  rawBody: string;
  signature: string | null;
  secret: string;
  now: number;
}): WebhookVerdict {
  const expected = signWebhookBody(opts.secret, opts.rawBody);
  if (!webhookSignaturesEqual(expected, opts.signature)) {
    return { ok: false, reason: "bad-signature" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(opts.rawBody) as unknown;
  } catch {
    return { ok: false, reason: "invalid-payload" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "invalid-payload" };
  }

  const record = parsed as Record<string, unknown>;
  const webhookTimestamp = record.webhookTimestamp;
  if (typeof webhookTimestamp !== "number" || !Number.isFinite(webhookTimestamp)) {
    return { ok: false, reason: "stale-timestamp" };
  }
  if (!webhookTimestampFresh(webhookTimestamp, opts.now)) {
    return { ok: false, reason: "stale-timestamp" };
  }

  const type = typeof record.type === "string" ? record.type : "";
  return {
    ok: true,
    type,
    issueId: issueIdFromEvent(type, record.data),
    webhookTimestamp,
  };
}

export function coalesceChangeNotice(
  previous: LinearChangeNotice | null,
  event: { at: string; kind: string; issueId: string | null },
): LinearChangeNotice {
  if (!NOTICE_KINDS.has(event.kind)) {
    return (
      previous ?? {
        updatedAt: event.at,
        kinds: [],
        issueIds: [],
        deliveryCount: 0,
      }
    );
  }

  const kinds = [...(previous?.kinds ?? [])];
  if (!kinds.includes(event.kind)) kinds.push(event.kind);
  const issueIds = [...(previous?.issueIds ?? [])];
  if (event.issueId && !issueIds.includes(event.issueId)) issueIds.push(event.issueId);
  return {
    updatedAt: event.at,
    kinds,
    issueIds,
    deliveryCount: (previous?.deliveryCount ?? 0) + 1,
  };
}

export function mergeChangeNotices(
  previous: LinearChangeNotice | null,
  incoming: LinearChangeNotice,
): LinearChangeNotice {
  if (!previous) return incoming;
  return coalesceListed(previous, incoming);
}

function coalesceListed(
  previous: LinearChangeNotice,
  incoming: LinearChangeNotice,
): LinearChangeNotice {
  const kinds = [...previous.kinds];
  for (const kind of incoming.kinds) {
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  const issueIds = [...previous.issueIds];
  for (const issueId of incoming.issueIds) {
    if (!issueIds.includes(issueId)) issueIds.push(issueId);
  }
  return {
    updatedAt: incoming.updatedAt > previous.updatedAt ? incoming.updatedAt : previous.updatedAt,
    kinds,
    issueIds,
    deliveryCount: previous.deliveryCount + incoming.deliveryCount,
  };
}

function issueIdFromEvent(type: string, data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (type === "Issue" && typeof record.id === "string") return record.id;
  if (type === "Comment") {
    if (typeof record.issueId === "string") return record.issueId;
    const issue = record.issue;
    if (issue && typeof issue === "object" && !Array.isArray(issue)) {
      const id = (issue as Record<string, unknown>).id;
      if (typeof id === "string") return id;
    }
  }
  return null;
}
