import assert from "node:assert/strict";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readCache, readOverlays, writeCache, writeOverlays } from "./store";
import type { BoardCache, OverlayStore } from "../types";

const workspaceId = "verify-fixture";

function fixturePath(kind: "cache" | "overlays"): string {
  return path.join(process.cwd(), "data", kind, `${workspaceId}.json`);
}

async function removeFixture(kind: "cache" | "overlays") {
  await unlink(fixturePath(kind)).catch((err: unknown) => {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      return;
    }
    throw err;
  });
}

test("writeCache then readCache returns the saved board", async (t) => {
  t.after(() => removeFixture("cache"));

  const board: BoardCache = {
    syncedAt: "2026-09-29T15:04:00.000Z",
    viewer: {
      id: "viewer-verify",
      name: "Verify User",
      displayName: "Verify",
      email: "verify@example.com",
      organization: {
        id: "org-verify",
        name: "Verify Org",
        urlKey: "verify",
      },
    },
    issues: [
      {
        id: "issue-1",
        identifier: "ENG-41",
        title: "Ship filters",
        url: "https://linear.app/verify/issue/ENG-41",
        priority: 2,
        priorityLabel: "High",
        dueDate: "2026-10-02",
        estimate: 3,
        updatedAt: "2026-09-28T10:00:00.000Z",
        createdAt: "2026-09-01T10:00:00.000Z",
        completedAt: null,
        state: {
          id: "state-1",
          name: "In Progress",
          type: "started",
          color: "#f2c94c",
        },
        team: { id: "team-1", name: "Engineering", key: "ENG" },
        project: { id: "project-1", name: "App" },
        cycle: null,
        labels: [{ id: "label-1", name: "bug", color: "#eb5757" }],
        blockedBy: [],
      },
    ],
    facets: {
      states: [],
      projects: [{ id: "project-1", name: "App" }],
      teams: [],
      labels: [],
      cycles: [],
    },
    workflowStatesByTeamId: {
      "team-1": [
        {
          id: "state-1",
          name: "In Progress",
          type: "started",
          color: "#f2c94c",
        },
      ],
    },
  };

  await writeCache(workspaceId, board);
  const read = await readCache(workspaceId);

  assert.ok(read);
  assert.equal(read.syncedAt, "2026-09-29T15:04:00.000Z");
  assert.equal(read.viewer.id, "viewer-verify");
  assert.equal(read.viewer.email, "verify@example.com");
  assert.equal(read.viewer.organization.urlKey, "verify");
  assert.equal(read.issues.length, 1);
  assert.equal(read.issues[0].id, "issue-1");
  assert.equal(read.issues[0].identifier, "ENG-41");
  assert.equal(read.issues[0].title, "Ship filters");
  assert.equal(read.issues[0].priority, 2);
  assert.equal(read.issues[0].estimate, 3);
  assert.equal(read.issues[0].state.type, "started");
  assert.equal(read.issues[0].project?.name, "App");
  assert.equal(read.facets.projects[0].name, "App");
  assert.deepEqual(read.facets.states, []);
  assert.deepEqual(read.workflowStatesByTeamId["team-1"][0].name, "In Progress");
  assert.deepEqual(read, board);
});

test("readCache defaults workflowStatesByTeamId when the file omits it", async (t) => {
  const id = "verify-fixture-old-cache";
  const file = path.join(process.cwd(), "data", "cache", `${id}.json`);
  t.after(() =>
    unlink(file).catch((err: unknown) => {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return;
      throw err;
    }),
  );

  const legacy = {
    syncedAt: "2026-09-29T15:04:00.000Z",
    viewer: {
      id: "viewer-verify",
      name: "Verify User",
      displayName: "Verify",
      email: "verify@example.com",
      organization: { id: "org-verify", name: "Verify Org", urlKey: "verify" },
    },
    issues: [],
    facets: { states: [], projects: [], teams: [], labels: [], cycles: [] },
  };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(legacy));
  const read = await readCache(id);
  assert.ok(read);
  assert.deepEqual(read.workflowStatesByTeamId, {});
  assert.equal(read.syncedAt, "2026-09-29T15:04:00.000Z");
  assert.equal(read.viewer.id, "viewer-verify");
});

test("writeOverlays then readOverlays returns the saved fields", async (t) => {
  t.after(() => removeFixture("overlays"));

  const overlays: OverlayStore = {
    issues: {
      "issue-1": {
        energyTag: "deep-work",
        waitingOn: "design",
        estimateOverride: 3,
        estimateUnit: "points",
        prUrl: "https://example.com/pr/1",
        slackUrl: "https://example.com/slack/1",
        meetingNote: "Ship Friday",
        scratch: "private note",
        snoozeUntil: "2026-10-01",
      },
    },
    focusQueue: ["issue-1", "issue-2"],
    settings: {
      wipLimit: 4,
      staleDays: 9,
      extraEnergyTags: ["admin"],
    },
  };

  await writeOverlays(workspaceId, overlays);
  const read = await readOverlays(workspaceId);

  assert.equal(read.issues["issue-1"].energyTag, "deep-work");
  assert.equal(read.issues["issue-1"].waitingOn, "design");
  assert.equal(read.issues["issue-1"].estimateOverride, 3);
  assert.equal(read.issues["issue-1"].estimateUnit, "points");
  assert.equal(read.issues["issue-1"].prUrl, "https://example.com/pr/1");
  assert.equal(read.issues["issue-1"].slackUrl, "https://example.com/slack/1");
  assert.equal(read.issues["issue-1"].meetingNote, "Ship Friday");
  assert.equal(read.issues["issue-1"].scratch, "private note");
  assert.equal(read.issues["issue-1"].snoozeUntil, "2026-10-01");
  assert.deepEqual(read.focusQueue, ["issue-1", "issue-2"]);
  assert.equal(read.settings.wipLimit, 4);
  assert.equal(read.settings.staleDays, 9);
  assert.deepEqual(read.settings.extraEnergyTags, ["admin"]);
  assert.deepEqual(read, overlays);
});
