import { LinearApiError, LinearConfigError, linearGraphql } from "@/lib/linear/client";
import { LINEAR_MUTATIONS } from "@/lib/linear/mutations";
import { mapIssue, type GqlIssueNode } from "@/lib/linear/queries";
import { patchCachedIssue, type WorkspaceSecret } from "@/lib/server/store";
import type { LinearWrite, LinearWriteResult } from "@/lib/types";

type IssueUpdateData = {
  issueUpdate: { success: boolean; issue: GqlIssueNode | null };
};

type CommentCreateData = {
  commentCreate: { success: boolean; comment: { id: string; body: string; createdAt: string } | null };
};

type AttachmentLinkData = {
  attachmentLinkURL: {
    success: boolean;
    attachment: { id: string; url: string; title: string | null } | null;
  };
};

export async function applyLinearWrite(
  workspace: WorkspaceSecret,
  write: LinearWrite,
): Promise<LinearWriteResult> {
  switch (write.kind) {
    case "update-state":
      return updateState(workspace, write);
    case "create-comment":
      return createComment(workspace, write);
    case "link-attachment":
      return linkAttachment(workspace, write);
    default: {
      const unreachable: never = write;
      void unreachable;
      return { ok: false, error: "Unsupported write." };
    }
  }
}

async function updateState(
  workspace: WorkspaceSecret,
  write: Extract<LinearWrite, { kind: "update-state" }>,
): Promise<LinearWriteResult> {
  const data = await linearGraphql<IssueUpdateData>(
    workspace.apiKey,
    LINEAR_MUTATIONS["update-state"],
    { id: write.issueId, input: { stateId: write.stateId } },
  );
  if (!data.issueUpdate.success || !data.issueUpdate.issue) {
    return { ok: false, error: "Linear did not update the issue." };
  }
  const issue = mapIssue(data.issueUpdate.issue);
  await patchCachedIssue(workspace.id, issue);
  return { ok: true, error: null, issue };
}

async function createComment(
  workspace: WorkspaceSecret,
  write: Extract<LinearWrite, { kind: "create-comment" }>,
): Promise<LinearWriteResult> {
  const data = await linearGraphql<CommentCreateData>(
    workspace.apiKey,
    LINEAR_MUTATIONS["create-comment"],
    { input: { issueId: write.issueId, body: write.body } },
  );
  if (!data.commentCreate.success) {
    return { ok: false, error: "Linear did not create the comment." };
  }
  return { ok: true, error: null };
}

async function linkAttachment(
  workspace: WorkspaceSecret,
  write: Extract<LinearWrite, { kind: "link-attachment" }>,
): Promise<LinearWriteResult> {
  const data = await linearGraphql<AttachmentLinkData>(
    workspace.apiKey,
    LINEAR_MUTATIONS["link-attachment"],
    { issueId: write.issueId, url: write.url, title: write.title ?? null },
  );
  if (!data.attachmentLinkURL.success) {
    return { ok: false, error: "Linear did not link the attachment." };
  }
  return { ok: true, error: null };
}

export function linearWriteFailure(err: unknown): string {
  if (err instanceof LinearApiError || err instanceof LinearConfigError) return err.message;
  return "Linear write failed.";
}
