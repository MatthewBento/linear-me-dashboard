import { NextResponse } from "next/server";
import { LinearWriteParseError, parseWriteRequest } from "@/lib/linear/mutations";
import { applyLinearWrite, linearWriteFailure } from "@/lib/server/linear-write";
import { getWorkspaceById } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected JSON." }, { status: 400 });
  }

  let parsed: ReturnType<typeof parseWriteRequest>;
  try {
    parsed = parseWriteRequest(body);
  } catch (err) {
    const message = err instanceof LinearWriteParseError ? err.message : "Expected JSON.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const workspace = await getWorkspaceById(parsed.workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { ok: false, error: "No workspace configured." },
      { status: 400 },
    );
  }

  try {
    const result = await applyLinearWrite(workspace, parsed.write);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: linearWriteFailure(err) }, { status: 502 });
  }
}
