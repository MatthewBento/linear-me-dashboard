import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/server/board";
import { setActiveWorkspace } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { workspaceId?: string };
  if (!body.workspaceId) {
    return NextResponse.json({ ok: false, error: "workspaceId required" }, { status: 400 });
  }
  await setActiveWorkspace(body.workspaceId);
  const payload = await buildBoard({ workspaceId: body.workspaceId, refresh: true });
  return NextResponse.json(payload);
}
