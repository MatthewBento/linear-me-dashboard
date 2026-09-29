import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/server/board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
  const payload = await buildBoard({
    workspaceId: body.workspaceId,
    refresh: true,
  });
  return NextResponse.json(payload);
}
