import assert from "node:assert/strict";
import test from "node:test";
import { blockedByFromInverse, type GqlIssueNode } from "./queries";

test("blockedByFromInverse keeps incoming blocks edges and drops the rest", () => {
  const node: Pick<GqlIssueNode, "inverseRelations"> = {
    inverseRelations: {
      nodes: [
        {
          type: "blocks",
          issue: { id: "b1", identifier: "ENG-1", title: "Blocker" },
        },
        {
          type: "related",
          issue: { id: "r1", identifier: "ENG-2", title: "Related" },
        },
        { type: "blocks", issue: null },
      ],
    },
  };
  assert.deepEqual(blockedByFromInverse(node), [
    { id: "b1", identifier: "ENG-1", title: "Blocker" },
  ]);
  assert.deepEqual(blockedByFromInverse({}), []);
});
