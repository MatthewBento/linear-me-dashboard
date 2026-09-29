import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/server/board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspace");
  const refresh = url.searchParams.get("refresh") === "1";
  const payload = await buildBoard({ workspaceId, refresh });
  return NextResponse.json(payload);
}
