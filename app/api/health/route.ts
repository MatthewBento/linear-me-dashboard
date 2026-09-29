import { NextResponse } from "next/server";
import { loadWorkspaces } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const workspaces = await loadWorkspaces();
  return NextResponse.json({
    configured: workspaces.length > 0,
    workspaceCount: workspaces.length,
  });
}
