import { NextResponse } from "next/server";
import { saveOverlays } from "@/lib/server/board";
import type { IssueOverlay, WorkspaceSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    workspaceId?: string;
    issueId?: string;
    patch?: IssueOverlay;
    focusQueue?: string[];
    settings?: Partial<WorkspaceSettings>;
    extraEnergyTag?: string;
  };
  try {
    const overlays = await saveOverlays(body);
    return NextResponse.json({ ok: true, overlays });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save overlays";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
