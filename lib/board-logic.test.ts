import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFilters,
  DEFAULT_FILTERS,
  isSnoozed,
  isStale,
  sortIssues,
} from "./board-logic";
import { EMPTY_OVERLAYS, type LinearIssue } from "./types";

function issue(partial: Partial<LinearIssue> & Pick<LinearIssue, "id" | "identifier">): LinearIssue {
  return {
    title: "Issue",
    url: "https://linear.app/acme/issue/ENG-1",
    priority: 3,
    priorityLabel: "Medium",
    dueDate: null,
    estimate: 2,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    completedAt: null,
    state: { id: "s1", name: "In Progress", type: "started", color: "#00f" },
    team: { id: "t1", name: "Eng", key: "ENG" },
    project: { id: "p1", name: "App" },
    cycle: null,
    labels: [],
    blockedBy: [],
    ...partial,
  };
}

test("hides completed by default", () => {
  const issues = [
    issue({ id: "1", identifier: "A-1" }),
    issue({
      id: "2",
      identifier: "A-2",
      state: { id: "done", name: "Done", type: "completed", color: "#0f0" },
    }),
  ];
  const shown = applyFilters(issues, EMPTY_OVERLAYS, DEFAULT_FILTERS);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].id, "1");
});

test("snooze hides from default active", () => {
  const issues = [issue({ id: "1", identifier: "A-1" })];
  const overlays = {
    ...EMPTY_OVERLAYS,
    issues: { "1": { snoozeUntil: "2099-01-01" } },
  };
  assert.equal(isSnoozed(overlays.issues["1"]), true);
  const shown = applyFilters(issues, overlays, DEFAULT_FILTERS);
  assert.equal(shown.length, 0);
  const withSnoozed = applyFilters(issues, overlays, {
    ...DEFAULT_FILTERS,
    hideSnoozed: false,
  });
  assert.equal(withSnoozed.length, 1);
});

test("combinable filters", () => {
  const issues = [
    issue({
      id: "1",
      identifier: "A-1",
      priority: 1,
      labels: [{ id: "l1", name: "bug", color: "#f00" }],
    }),
    issue({ id: "2", identifier: "A-2", priority: 2 }),
  ];
  const shown = applyFilters(issues, EMPTY_OVERLAYS, {
    ...DEFAULT_FILTERS,
    priority: 1,
    labelId: "l1",
  });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].id, "1");
});

test("sorts by priority with 0 last", () => {
  const issues = [
    issue({ id: "a", identifier: "Z-1", priority: 0, priorityLabel: "No priority" }),
    issue({ id: "b", identifier: "Z-2", priority: 2, priorityLabel: "High" }),
    issue({ id: "c", identifier: "Z-3", priority: 1, priorityLabel: "Urgent" }),
  ];
  const sorted = sortIssues(issues, "priority", "asc").map((i) => i.id);
  assert.deepEqual(sorted, ["c", "b", "a"]);
});

test("stale radar uses updatedAt", () => {
  const old = issue({
    id: "1",
    identifier: "A-1",
    updatedAt: "2020-01-01T00:00:00.000Z",
  });
  assert.equal(isStale(old, 7), true);
  const fresh = issue({ id: "2", identifier: "A-2" });
  assert.equal(isStale(fresh, 7), false);
});
