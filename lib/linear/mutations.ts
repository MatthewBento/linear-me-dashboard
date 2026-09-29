import type { LinearWrite } from "@/lib/types";
import { ISSUE_NODE_FIELDS } from "./queries";

export const LINEAR_MUTATIONS: Record<LinearWrite["kind"], string> = {
  "update-state": /* GraphQL */ `
    mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
${ISSUE_NODE_FIELDS}
        }
      }
    }
  `,
  "create-comment": /* GraphQL */ `
    mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment {
          id
          body
          createdAt
        }
      }
    }
  `,
  "link-attachment": /* GraphQL */ `
    mutation AttachmentLinkURL($issueId: String!, $url: String!, $title: String) {
      attachmentLinkURL(issueId: $issueId, url: $url, title: $title) {
        success
        attachment {
          id
          url
          title
        }
      }
    }
  `,
};

const SECRET_FIELDS = new Set(["apikey", "api_key", "linear_api_key", "authorization", "token"]);

const ALLOWED_FIELDS: Record<LinearWrite["kind"], readonly string[]> = {
  "update-state": ["kind", "issueId", "stateId"],
  "create-comment": ["kind", "issueId", "body"],
  "link-attachment": ["kind", "issueId", "url", "title"],
};

export class LinearWriteParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearWriteParseError";
  }
}

export function parseWriteRequest(input: unknown): { workspaceId: string; write: LinearWrite } {
  rejectSecretFields(input);
  if (!isRecord(input)) throw new LinearWriteParseError("Expected an object.");
  for (const key of Object.keys(input)) {
    if (key !== "workspaceId" && key !== "write") {
      throw new LinearWriteParseError("Unexpected field.");
    }
  }
  if (typeof input.workspaceId !== "string" || input.workspaceId.trim() === "") {
    throw new LinearWriteParseError("workspaceId is required.");
  }
  return {
    workspaceId: input.workspaceId.trim(),
    write: parseLinearWrite(input.write),
  };
}

export function parseLinearWrite(input: unknown): LinearWrite {
  rejectSecretFields(input);
  if (!isRecord(input)) throw new LinearWriteParseError("Expected an object.");
  const kind = input.kind;
  if (kind !== "update-state" && kind !== "create-comment" && kind !== "link-attachment") {
    throw new LinearWriteParseError("Write kind is not supported.");
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS[kind].includes(key)) {
      throw new LinearWriteParseError("Unexpected field.");
    }
  }

  const issueId = requiredString(input.issueId, "issueId is required.");
  switch (kind) {
    case "update-state":
      return {
        kind,
        issueId,
        stateId: requiredString(input.stateId, "stateId is required."),
      };
    case "create-comment":
      if (typeof input.body !== "string" || input.body.trim() === "") {
        throw new LinearWriteParseError("Comment body is empty.");
      }
      return { kind, issueId, body: input.body };
    case "link-attachment": {
      if (typeof input.url !== "string" || !isHttpUrl(input.url)) {
        throw new LinearWriteParseError("Attachment URL must be http or https.");
      }
      const write: LinearWrite = { kind, issueId, url: input.url };
      if (!("title" in input) || input.title == null || input.title === "") return write;
      if (typeof input.title !== "string") {
        throw new LinearWriteParseError("Attachment title must be a string.");
      }
      return { kind, issueId, url: input.url, title: input.title };
    }
    default: {
      const unreachable: never = kind;
      void unreachable;
      throw new LinearWriteParseError("Write kind is not supported.");
    }
  }
}

function rejectSecretFields(input: unknown) {
  if (!input || typeof input !== "object") return;
  if (Array.isArray(input)) {
    for (const item of input) rejectSecretFields(item);
    return;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_FIELDS.has(normalizeField(key))) {
      throw new LinearWriteParseError("Request rejected.");
    }
    rejectSecretFields(value);
  }
}

function normalizeField(key: string): string {
  return key.toLowerCase().replace(/-/g, "_");
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new LinearWriteParseError(message);
  }
  return value.trim();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
