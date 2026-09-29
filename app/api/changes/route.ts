import { NextResponse } from "next/server";
import { isWebhookConfigured, readNotice } from "@/lib/server/notices";
import { getWorkspaceById, readCache } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("workspace");
  const workspace = await getWorkspaceById(requested);
  const workspaceId = workspace?.id ?? (requested?.trim() || "env-default");
  const [notice, cache] = await Promise.all([
    readNotice(workspaceId),
    workspace ? readCache(workspace.id) : Promise.resolve(null),
  ]);
  return NextResponse.json({
    notice,
    lastSyncedAt: cache?.syncedAt ?? null,
    webhookConfigured: isWebhookConfigured(),
  });
}
