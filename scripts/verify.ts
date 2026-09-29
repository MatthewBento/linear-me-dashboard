#!/usr/bin/env npx tsx
/**
 * Linear Me verification CLI. Prefer this over throwaway curl/scripts.
 *
 *   npm run verify
 *   npm run verify -- --skip-build
 *   VERIFY_BASE_URL=http://127.0.0.1:43147 npm run verify -- --live
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipBuild = process.argv.includes("--skip-build");
const live = process.argv.includes("--live");

function fail(msg: string): never {
  console.error(`verify: FAIL ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`verify: ok  ${msg}`);
}

function run(cmd: string, args: string[]) {
  const res = spawnSync(cmd, args, { stdio: "inherit", cwd: root, env: process.env });
  if (res.status !== 0) fail(`${cmd} ${args.join(" ")} exited ${res.status}`);
}

const requiredFiles = [
  ".env.example",
  "data/workspaces.example.json",
  "README.md",
  "app/page.tsx",
  "lib/linear/client.ts",
  "lib/linear/queries.ts",
  "lib/server/store.ts",
  "lib/server/board.ts",
  "components/dashboard/dashboard-app.tsx",
  "components/dashboard/issue-drawer.tsx",
  "components/dashboard/keyboard-help.tsx",
  "components/dashboard/estimate-chart.tsx",
  ".cursor/skills/verify-linear-me/SKILL.md",
  ".cursor/skills/verify-linear-me/features/refresh-writeback.md",
  "lib/linear/mutations.ts",
  "lib/linear/webhook.ts",
  "lib/server/linear-write.ts",
  "lib/server/notices.ts",
  "app/api/linear/write/route.ts",
  "app/api/webhooks/linear/route.ts",
  "app/api/changes/route.ts",
];

for (const rel of requiredFiles) {
  if (!existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}
ok("required files present");

const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
if (!envExample.includes("LINEAR_API_KEY=")) fail(".env.example missing LINEAR_API_KEY");
if (!envExample.includes("LINEAR_USER_ID=")) fail(".env.example missing LINEAR_USER_ID");
if (!envExample.includes("LINEAR_WEBHOOK_SECRET=")) {
  fail(".env.example missing LINEAR_WEBHOOK_SECRET");
}
ok(".env.example documents env");

const dashboard = readFileSync(
  path.join(root, "components/dashboard/dashboard-app.tsx"),
  "utf8",
);
const drawer = readFileSync(
  path.join(root, "components/dashboard/issue-drawer.tsx"),
  "utf8",
);
const combined = dashboard + drawer;
const featureNeedles = [
  "focusQueue",
  "energyTag",
  "wipLimit",
  "staleDays",
  "blocked-on-others",
  "Estimate vs",
  "prUrl",
  "scratch",
  "snoozeUntil",
  "Morning brief",
  "Workspace",
  'keydown',
  'testId="linear-changed-banner"',
  'data-testid="linear-state"',
  'data-testid="linear-state-submit"',
  'data-testid="linear-comment"',
  'data-testid="linear-comment-submit"',
  'data-testid="linear-attachment-url"',
  'data-testid="linear-attachment-title"',
  'data-testid="linear-attachment-submit"',
  'data-testid="linear-write-error"',
];
for (const needle of featureNeedles) {
  if (!combined.includes(needle)) fail(`UI missing feature marker: ${needle}`);
}
ok("section A/B feature markers in UI");

if (/\blin_api_/.test(combined)) {
  fail("API key material must never appear in client UI source");
}
ok("client source does not contain lin_api_ material");

const readme = readFileSync(path.join(root, "README.md"), "utf8");
for (const needle of [
  "/api/webhooks/linear",
  "LINEAR_WEBHOOK_SECRET",
  "/api/linear/write",
  "/api/changes",
  "Issue and Comment",
]) {
  if (!readme.includes(needle)) fail(`README missing ${needle}`);
}
if (/never writes issues back/i.test(readme)) {
  fail("README still claims the app never writes issues back");
}
ok("README documents refresh, webhook, and write-back");

const webhookRoute = readFileSync(
  path.join(root, "app/api/webhooks/linear/route.ts"),
  "utf8",
);
if (!webhookRoute.includes("request.text()")) {
  fail("webhook route must read request.text() before JSON parsing");
}
const webhookLib = readFileSync(path.join(root, "lib/linear/webhook.ts"), "utf8");
if (!webhookLib.includes("timingSafeEqual")) fail("webhook HMAC must use timingSafeEqual");
ok("webhook route reads the raw body");

const queriesSrc = readFileSync(path.join(root, "lib/linear/queries.ts"), "utf8");
if (queriesSrc.includes("blockedBy {")) {
  fail("Linear issue selection must not query Issue.blockedBy");
}
if (!queriesSrc.includes("inverseRelations")) {
  fail("Linear issue selection must query inverseRelations for blockers");
}
ok("issue GraphQL uses inverseRelations, not Issue.blockedBy");

function sourceFiles(dir: string): string[] {
  return walk(dir).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

for (const file of [
  ...sourceFiles(path.join(root, "app")),
  ...sourceFiles(path.join(root, "components")),
]) {
  const text = readFileSync(file, "utf8");
  if (text.includes("LayoutProps") || text.includes('from ".next/') || text.includes("from '.next/")) {
    fail(`${path.relative(root, file)} must not use LayoutProps or .next type imports`);
  }
}
ok("app and components avoid LayoutProps and .next type imports");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const secretRe = /lin_api_[a-zA-Z0-9]{12,}/g;
for (const file of walk(root)) {
  if (file.endsWith("workspaces.example.json")) continue;
  const text = readFileSync(file, "utf8");
  const matches = text.match(secretRe);
  if (matches) fail(`possible Linear API key in ${path.relative(root, file)}`);
}
ok("no committed-looking lin_api_ secrets in tree (except example placeholder)");

run("npm", ["test"]);
ok("unit tests");

run("npx", ["tsc", "--noEmit"]);
ok("typecheck");

run("npx", ["eslint", "."]);
ok("lint");

if (!skipBuild) {
  run("npx", ["next", "build"]);
  ok("build");
}

async function liveCheck() {
  const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:43147";
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) fail(`live health ${health.status}`);
  const body = (await health.json()) as { configured: boolean };
  ok(`live health configured=${body.configured}`);
  const board = await fetch(`${base}/api/board`);
  if (!board.ok) fail(`live board ${board.status}`);
  const payload = (await board.json()) as {
    configured: boolean;
    overlays: unknown;
    issues: unknown[];
  };
  if (!payload.overlays) fail("live board missing overlays");
  const boardText = JSON.stringify(payload);
  if (/apiKey|LINEAR_API_KEY|lin_api_/.test(boardText)) fail("live board leaked a secret");
  ok(`live board issues=${Array.isArray(payload.issues) ? payload.issues.length : "?"}`);

  const changes = await fetch(`${base}/api/changes`);
  if (!changes.ok) fail(`live changes ${changes.status}`);
  const changesText = await changes.text();
  if (/apiKey|LINEAR_API_KEY|lin_api_/.test(changesText)) fail("live changes leaked a secret");
  const changesBody = JSON.parse(changesText) as {
    notice?: unknown;
    lastSyncedAt?: unknown;
    webhookConfigured?: unknown;
  };
  if (!("notice" in changesBody) || !("lastSyncedAt" in changesBody)) {
    fail("live changes missing notice fields");
  }
  if (typeof changesBody.webhookConfigured !== "boolean") {
    fail("live changes webhookConfigured must be boolean");
  }
  ok("live changes");

  const write = await fetch(`${base}/api/linear/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const writeText = await write.text();
  if (write.status < 400 || write.status >= 500) fail(`live write status ${write.status}`);
  if (/apiKey|LINEAR_API_KEY|lin_api_/.test(writeText)) fail("live write leaked a secret");
  ok("live write rejects an empty body");

  const hook = await fetch(`${base}/api/webhooks/linear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const hookText = await hook.text();
  if (hookText.includes("lin_api_")) fail("live webhook leaked a key");
  if (hook.status === 503) {
    const hookBody = JSON.parse(hookText) as { error?: string };
    if (hookBody.error !== "LINEAR_WEBHOOK_SECRET is not set") {
      fail(`live webhook 503 error was ${hookBody.error ?? ""}`);
    }
    ok("live webhook missing secret");
  } else if (hook.status === 401) {
    ok("live webhook rejected unsigned body");
  } else {
    fail(`live webhook ${hook.status}`);
  }
}

if (live) {
  liveCheck()
    .then(() => {
      console.log("verify: PASS");
    })
    .catch((err: unknown) => {
      fail(err instanceof Error ? err.message : "live check failed");
    });
} else {
  console.log("verify: PASS");
}
