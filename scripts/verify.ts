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
];

for (const rel of requiredFiles) {
  if (!existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}
ok("required files present");

const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
if (!envExample.includes("LINEAR_API_KEY=")) fail(".env.example missing LINEAR_API_KEY");
if (!envExample.includes("LINEAR_USER_ID=")) fail(".env.example missing LINEAR_USER_ID");
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
];
for (const needle of featureNeedles) {
  if (!combined.includes(needle)) fail(`UI missing feature marker: ${needle}`);
}
ok("section A/B feature markers in UI");

if (/\blin_api_/.test(combined)) {
  fail("API key material must never appear in client UI source");
}
ok("client source does not contain lin_api_ material");

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

run("npx", ["tsx", "--test", "lib/board-logic.test.ts", "lib/server/store.test.ts"]);
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
  ok(`live board issues=${Array.isArray(payload.issues) ? payload.issues.length : "?"}`);
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
