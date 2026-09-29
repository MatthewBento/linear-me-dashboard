import { NextResponse } from "next/server";
import { assessWebhook } from "@/lib/linear/webhook";
import { queueChangeNotice } from "@/lib/server/notices";
import { resolveActiveWorkspace } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.LINEAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "LINEAR_WEBHOOK_SECRET is not set" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const verdict = assessWebhook({
    rawBody,
    signature: request.headers.get("linear-signature"),
    secret,
    now: Date.now(),
  });
  if (!verdict.ok) {
    let error = "Invalid webhook payload.";
    if (verdict.reason === "bad-signature") error = "Invalid webhook signature.";
    if (verdict.reason === "stale-timestamp") error = "Stale webhook timestamp.";
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  if (verdict.type === "Issue" || verdict.type === "Comment") {
    const workspace = await resolveActiveWorkspace().catch(() => null);
    queueChangeNotice(workspace?.id ?? "env-default", {
      at: new Date().toISOString(),
      kind: verdict.type,
      issueId: verdict.issueId,
    });
  }

  return NextResponse.json({ ok: true });
}
