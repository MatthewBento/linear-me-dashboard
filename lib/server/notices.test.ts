import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { noticeSettled, queueChangeNotice, readNotice, writeNotice } from "./notices";
import type { LinearChangeNotice } from "../types";

const workspaceId = "verify-fixture";

function noticeFile(): string {
  return path.join(process.cwd(), "data", "notices", `${workspaceId}.json`);
}

async function removeNotice() {
  await unlink(noticeFile()).catch((err: unknown) => {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return;
    throw err;
  });
}

describe("notice files", { concurrency: 1 }, () => {
  test("writeNotice then readNotice returns the saved notice", async (t) => {
    t.after(removeNotice);
    const notice: LinearChangeNotice = {
      updatedAt: "2026-09-29T16:00:00.000Z",
      kinds: ["Issue", "Comment"],
      issueIds: ["issue-1", "issue-2"],
      deliveryCount: 2,
    };
    await writeNotice(workspaceId, notice);
    assert.deepEqual(await readNotice(workspaceId), notice);
  });

  test("a burst of notices becomes one file and the next burst merges into it", async (t) => {
    t.after(removeNotice);
    await removeNotice();

    queueChangeNotice(workspaceId, {
      at: "2026-09-29T16:01:00.000Z",
      kind: "Issue",
      issueId: "issue-1",
    });
    queueChangeNotice(workspaceId, {
      at: "2026-09-29T16:01:01.000Z",
      kind: "Comment",
      issueId: "issue-2",
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await noticeSettled(workspaceId);
    assert.deepEqual(await readNotice(workspaceId), {
      updatedAt: "2026-09-29T16:01:01.000Z",
      kinds: ["Issue", "Comment"],
      issueIds: ["issue-1", "issue-2"],
      deliveryCount: 2,
    });

    queueChangeNotice(workspaceId, {
      at: "2026-09-29T16:02:00.000Z",
      kind: "Issue",
      issueId: "issue-3",
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await noticeSettled(workspaceId);
    assert.deepEqual(await readNotice(workspaceId), {
      updatedAt: "2026-09-29T16:02:00.000Z",
      kinds: ["Issue", "Comment"],
      issueIds: ["issue-1", "issue-2", "issue-3"],
      deliveryCount: 3,
    });
  });
});
