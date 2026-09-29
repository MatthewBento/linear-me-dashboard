import assert from "node:assert/strict";
import test from "node:test";
import { parseLinearWrite, parseWriteRequest } from "./mutations";

test("parseLinearWrite accepts state, comment, and attachment writes", () => {
  assert.deepEqual(
    parseLinearWrite({ kind: "update-state", issueId: "issue-1", stateId: "state-2" }),
    { kind: "update-state", issueId: "issue-1", stateId: "state-2" },
  );
  assert.deepEqual(
    parseLinearWrite({ kind: "create-comment", issueId: "issue-1", body: "Ship it" }),
    { kind: "create-comment", issueId: "issue-1", body: "Ship it" },
  );
  assert.deepEqual(
    parseLinearWrite({
      kind: "link-attachment",
      issueId: "issue-1",
      url: "https://example.com/pr/1",
      title: "PR",
    }),
    {
      kind: "link-attachment",
      issueId: "issue-1",
      url: "https://example.com/pr/1",
      title: "PR",
    },
  );
  assert.deepEqual(
    parseWriteRequest({
      workspaceId: "env-default",
      write: { kind: "update-state", issueId: "issue-1", stateId: "state-2" },
    }),
    {
      workspaceId: "env-default",
      write: { kind: "update-state", issueId: "issue-1", stateId: "state-2" },
    },
  );
});

test("parseLinearWrite rejects an apiKey field and does not echo the value", () => {
  const secret = "super-secret-value";
  for (const field of ["apiKey", "LINEAR_API_KEY", "authorization", "token"]) {
    assert.throws(
      () =>
        parseLinearWrite({
          kind: "update-state",
          issueId: "issue-1",
          stateId: "state-2",
          [field]: secret,
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "Request rejected.");
        assert.equal(err.message.includes(secret), false);
        return true;
      },
    );
  }
  assert.throws(
    () =>
      parseWriteRequest({
        workspaceId: "env-default",
        apiKey: secret,
        write: { kind: "update-state", issueId: "issue-1", stateId: "state-2" },
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, "Request rejected.");
      assert.equal(err.message.includes(secret), false);
      return true;
    },
  );
});

test("parseLinearWrite rejects an empty comment", () => {
  assert.throws(
    () => parseLinearWrite({ kind: "create-comment", issueId: "issue-1", body: "   " }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, "Comment body is empty.");
      return true;
    },
  );
});

test("parseLinearWrite rejects attachment URLs that are not http or https", () => {
  for (const url of ["javascript:alert(1)", "ftp://example.com/a", "notaurl", "/relative"]) {
    assert.throws(
      () => parseLinearWrite({ kind: "link-attachment", issueId: "issue-1", url }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "Attachment URL must be http or https.");
        return true;
      },
    );
  }
  assert.deepEqual(
    parseLinearWrite({
      kind: "link-attachment",
      issueId: "issue-1",
      url: "http://example.com/a",
    }),
    { kind: "link-attachment", issueId: "issue-1", url: "http://example.com/a" },
  );
});
