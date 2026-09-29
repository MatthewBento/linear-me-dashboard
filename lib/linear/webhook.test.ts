import assert from "node:assert/strict";
import test from "node:test";
import {
  assessWebhook,
  coalesceChangeNotice,
  signWebhookBody,
  webhookSignaturesEqual,
} from "./webhook";
import type { LinearChangeNotice } from "../types";

const SECRET = "test-webhook-secret";
const ISSUE_BODY =
  '{"action":"update","type":"Issue","webhookTimestamp":1700000000000,"data":{"id":"issue-1"}}';
const ISSUE_SIGNATURE =
  "cc37d7aebe1596b2b2287667cd9a8167bf4d7f959f52e511bb56084326e47786";
const COMMENT_BODY =
  '{"action":"create","type":"Comment","webhookTimestamp":1700000000000,"data":{"id":"comment-1","issueId":"issue-9"}}';
const COMMENT_SIGNATURE =
  "dafb0a943995a31a06c55bb739a616ec7481bf73d0db0096b69e3f3eefc45300";

test("signWebhookBody matches the known HMAC of the raw body", () => {
  assert.equal(signWebhookBody(SECRET, ISSUE_BODY), ISSUE_SIGNATURE);
  assert.equal(webhookSignaturesEqual(ISSUE_SIGNATURE, ISSUE_SIGNATURE), true);
  assert.equal(signWebhookBody(SECRET, COMMENT_BODY), COMMENT_SIGNATURE);
});

test("a tampered body fails the signature check", () => {
  const tampered = ISSUE_BODY.replace("issue-1", "issue-2");
  assert.equal(webhookSignaturesEqual(ISSUE_SIGNATURE, "abc"), false);
  assert.deepEqual(
    assessWebhook({
      rawBody: tampered,
      signature: ISSUE_SIGNATURE,
      secret: SECRET,
      now: 1_700_000_000_000,
    }),
    { ok: false, reason: "bad-signature" },
  );
});

test("a stale webhook timestamp fails and the 60 second boundary still passes", () => {
  assert.deepEqual(
    assessWebhook({
      rawBody: ISSUE_BODY,
      signature: ISSUE_SIGNATURE,
      secret: SECRET,
      now: 1_700_000_060_001,
    }),
    { ok: false, reason: "stale-timestamp" },
  );
  assert.deepEqual(
    assessWebhook({
      rawBody: ISSUE_BODY,
      signature: ISSUE_SIGNATURE,
      secret: SECRET,
      now: 1_700_000_060_000,
    }),
    {
      ok: true,
      type: "Issue",
      issueId: "issue-1",
      webhookTimestamp: 1_700_000_000_000,
    },
  );
});

test("coalesceChangeNotice merges issue ids and kinds", () => {
  const first = coalesceChangeNotice(null, {
    at: "2026-09-29T12:00:00.000Z",
    kind: "Issue",
    issueId: "issue-1",
  });
  const expectedFirst: LinearChangeNotice = {
    updatedAt: "2026-09-29T12:00:00.000Z",
    kinds: ["Issue"],
    issueIds: ["issue-1"],
    deliveryCount: 1,
  };
  assert.deepEqual(first, expectedFirst);

  const second = coalesceChangeNotice(first, {
    at: "2026-09-29T12:00:01.000Z",
    kind: "Comment",
    issueId: "issue-2",
  });
  assert.deepEqual(second, {
    updatedAt: "2026-09-29T12:00:01.000Z",
    kinds: ["Issue", "Comment"],
    issueIds: ["issue-1", "issue-2"],
    deliveryCount: 2,
  });

  assert.deepEqual(
    coalesceChangeNotice(second, {
      at: "2026-09-29T13:00:00.000Z",
      kind: "Project",
      issueId: "proj-1",
    }),
    second,
  );

  assert.deepEqual(
    assessWebhook({
      rawBody: COMMENT_BODY,
      signature: COMMENT_SIGNATURE,
      secret: SECRET,
      now: 1_700_000_000_000,
    }),
    {
      ok: true,
      type: "Comment",
      issueId: "issue-9",
      webhookTimestamp: 1_700_000_000_000,
    },
  );
});
