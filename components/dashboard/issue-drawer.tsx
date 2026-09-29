"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DEFAULT_ENERGY_TAGS,
  type IssueOverlay,
  type LinearIssue,
  type LinearState,
  type LinearWrite,
  type LinearWriteResult,
} from "@/lib/types";

type Props = {
  issue: LinearIssue | null;
  overlay: IssueOverlay | undefined;
  energyTags: string[];
  workflowStatesByTeamId: Record<string, LinearState[]>;
  fallbackStates: LinearState[];
  workspaceId: string | null;
  onClose: () => void;
  onPatch: (issueId: string, patch: IssueOverlay) => void;
  onAddTag: (tag: string) => void;
  onReplaceIssue: (issue: LinearIssue) => void;
};

export function IssueDrawer({
  issue,
  overlay,
  energyTags,
  workflowStatesByTeamId,
  fallbackStates,
  workspaceId,
  onClose,
  onPatch,
  onAddTag,
  onReplaceIssue,
}: Props) {
  const open = Boolean(issue);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-md"
        data-testid="issue-drawer"
      >
        {issue ? (
          <DrawerBody
            key={issue.id}
            issue={issue}
            overlay={overlay}
            energyTags={energyTags}
            workflowStatesByTeamId={workflowStatesByTeamId}
            fallbackStates={fallbackStates}
            workspaceId={workspaceId}
            onPatch={onPatch}
            onAddTag={onAddTag}
            onReplaceIssue={onReplaceIssue}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  issue,
  overlay,
  energyTags,
  workflowStatesByTeamId,
  fallbackStates,
  workspaceId,
  onPatch,
  onAddTag,
  onReplaceIssue,
}: {
  issue: LinearIssue;
  overlay: IssueOverlay | undefined;
  energyTags: string[];
  workflowStatesByTeamId: Record<string, LinearState[]>;
  fallbackStates: LinearState[];
  workspaceId: string | null;
  onPatch: (issueId: string, patch: IssueOverlay) => void;
  onAddTag: (tag: string) => void;
  onReplaceIssue: (issue: LinearIssue) => void;
}) {
  const [newTag, setNewTag] = useState("");
  const patch = (partial: IssueOverlay) => onPatch(issue.id, partial);
  const tags = [...new Set([...DEFAULT_ENERGY_TAGS, ...energyTags])];

  return (
    <>
        <SheetHeader>
          <SheetTitle className="pr-8">
            <span className="font-mono text-sm text-muted-foreground">
              {issue.identifier}
            </span>
            <span className="mt-1 block text-base">{issue.title}</span>
          </SheetTitle>
          <SheetDescription>
            Local notes stay on this machine. Confirmed actions under Write to
            Linear update status, comments, and attachments on the server.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{issue.state.name}</span>
            <span>· {issue.priorityLabel}</span>
            {issue.project ? <span>· {issue.project.name}</span> : null}
            {issue.cycle ? <span>· {issue.cycle.name}</span> : null}
            {issue.dueDate ? <span>· due {issue.dueDate}</span> : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={issue.url} target="_blank" rel="noreferrer">
              Open in Linear
            </a>
          </Button>
          <LinearWriteSection
            issue={issue}
            states={statesForIssue(issue, workflowStatesByTeamId, fallbackStates)}
            workspaceId={workspaceId}
            onReplaceIssue={onReplaceIssue}
          />
          <Separator />
          <fieldset className="space-y-2">
            <Label>Energy / context</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = overlay?.energyTag === tag;
                return (
                  <Button
                    key={tag}
                    type="button"
                    size="xs"
                    variant={active ? "default" : "outline"}
                    onClick={() =>
                      patch({ energyTag: active ? "" : tag })
                    }
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const tag = newTag.trim();
                if (!tag) return;
                onAddTag(tag);
                patch({ energyTag: tag });
                setNewTag("");
              }}
            >
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add custom tag"
                className="h-8"
              />
              <Button type="submit" size="sm" variant="secondary">
                Add
              </Button>
            </form>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="waitingOn">Waiting on (blocker digest)</Label>
            <Input
              id="waitingOn"
              value={overlay?.waitingOn ?? ""}
              onChange={(e) => patch({ waitingOn: e.target.value })}
              placeholder="Name, team, or ticket…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="est">Local estimate override</Label>
              <Input
                id="est"
                type="number"
                min={0}
                step="0.5"
                value={overlay?.estimateOverride ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  patch({
                    estimateOverride: v === "" ? null : Number(v),
                  });
                }}
                placeholder={issue.estimate != null ? String(issue.estimate) : "-"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                value={overlay?.estimateUnit ?? "points"}
                onChange={(e) =>
                  patch({
                    estimateUnit: e.target.value as "points" | "hours",
                  })
                }
              >
                <option value="points">Points</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="snooze">Snooze until</Label>
            <Input
              id="snooze"
              type="date"
              value={overlay?.snoozeUntil ?? ""}
              onChange={(e) =>
                patch({ snoozeUntil: e.target.value || null })
              }
            />
          </div>
          <Separator />
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Meeting / PR glue
          </p>
          <div className="space-y-2">
            <Label htmlFor="pr">PR URL</Label>
            <Input
              id="pr"
              value={overlay?.prUrl ?? ""}
              onChange={(e) => patch({ prUrl: e.target.value })}
              placeholder="https://github.com/…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slack">Slack / thread URL</Label>
            <Input
              id="slack"
              value={overlay?.slackUrl ?? ""}
              onChange={(e) => patch({ slackUrl: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meet">Meeting note</Label>
            <textarea
              id="meet"
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
              value={overlay?.meetingNote ?? ""}
              onChange={(e) => patch({ meetingNote: e.target.value })}
              placeholder="Decisions, attendees, follow-ups…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scratch">Private scratch</Label>
            <textarea
              id="scratch"
              className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
              value={overlay?.scratch ?? ""}
              onChange={(e) => patch({ scratch: e.target.value })}
              placeholder="Never written to Linear."
            />
          </div>
        </div>
    </>
  );
}

function statesForIssue(
  issue: LinearIssue,
  byTeam: Record<string, LinearState[]>,
  fallback: LinearState[],
): LinearState[] {
  const teamStates = issue.team ? byTeam[issue.team.id] : undefined;
  const base = teamStates && teamStates.length > 0 ? teamStates : fallback;
  if (base.some((state) => state.id === issue.state.id)) return base;
  return [issue.state, ...base];
}

function LinearWriteSection({
  issue,
  states,
  workspaceId,
  onReplaceIssue,
}: {
  issue: LinearIssue;
  states: LinearState[];
  workspaceId: string | null;
  onReplaceIssue: (issue: LinearIssue) => void;
}) {
  const [stateId, setStateId] = useState(issue.state.id);
  const [comment, setComment] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(write: LinearWrite, confirmText: string, onSuccess: () => void) {
    if (!workspaceId) {
      setError("No workspace configured.");
      return;
    }
    if (write.kind === "create-comment" && write.body.trim() === "") {
      setError("Comment body is empty.");
      return;
    }
    if (write.kind === "link-attachment" && !isHttpUrl(write.url)) {
      setError("Attachment URL must be http or https.");
      return;
    }
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const previous = issue;
    if (write.kind === "update-state") {
      const next = states.find((state) => state.id === write.stateId);
      if (next) onReplaceIssue({ ...issue, state: next });
    }
    try {
      const res = await fetch("/api/linear/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, write }),
      });
      const data = (await res.json()) as LinearWriteResult;
      if (!res.ok || !data.ok) {
        if (write.kind === "update-state") onReplaceIssue(previous);
        setError(data.error ?? "Linear write failed.");
        return;
      }
      if (data.issue) {
        onReplaceIssue(data.issue);
        if (write.kind === "update-state") setStateId(data.issue.state.id);
      }
      onSuccess();
      toast.success(successCopy(write.kind));
    } catch {
      if (write.kind === "update-state") onReplaceIssue(previous);
      setError("Could not reach the local API.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Write to Linear
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          These buttons update Linear after you confirm. Fields below stay on this
          machine.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="linear-state">Workflow state</Label>
        <select
          id="linear-state"
          data-testid="linear-state"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          value={stateId}
          onChange={(e) => setStateId(e.target.value)}
        >
          {states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          data-testid="linear-state-submit"
          disabled={busy}
          onClick={() =>
            void submit(
              { kind: "update-state", issueId: issue.id, stateId },
              `Update ${issue.identifier} status in Linear?`,
              () => undefined,
            )
          }
        >
          Update status in Linear
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="linear-comment">Comment</Label>
        <textarea
          id="linear-comment"
          data-testid="linear-comment"
          className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment on this issue"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid="linear-comment-submit"
          disabled={busy}
          onClick={() =>
            void submit(
              { kind: "create-comment", issueId: issue.id, body: comment },
              `Post a comment on ${issue.identifier} in Linear?`,
              () => setComment(""),
            )
          }
        >
          Post comment to Linear
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="linear-attachment-url">Attachment URL</Label>
        <Input
          id="linear-attachment-url"
          data-testid="linear-attachment-url"
          value={attachmentUrl}
          onChange={(e) => setAttachmentUrl(e.target.value)}
          placeholder="https://example.com/pull/1"
        />
        <Label htmlFor="linear-attachment-title">Attachment title</Label>
        <Input
          id="linear-attachment-title"
          data-testid="linear-attachment-title"
          value={attachmentTitle}
          onChange={(e) => setAttachmentTitle(e.target.value)}
          placeholder="Optional title"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid="linear-attachment-submit"
          disabled={busy}
          onClick={() =>
            void submit(
              {
                kind: "link-attachment",
                issueId: issue.id,
                url: attachmentUrl,
                ...(attachmentTitle.trim() ? { title: attachmentTitle.trim() } : {}),
              },
              `Link an attachment on ${issue.identifier} in Linear?`,
              () => {
                setAttachmentUrl("");
                setAttachmentTitle("");
              },
            )
          }
        >
          Link attachment in Linear
        </Button>
      </div>
      {error ? (
        <p data-testid="linear-write-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function successCopy(kind: LinearWrite["kind"]): string {
  switch (kind) {
    case "update-state":
      return "Updated status in Linear.";
    case "create-comment":
      return "Posted the comment to Linear.";
    case "link-attachment":
      return "Linked the attachment in Linear.";
    default: {
      const unreachable: never = kind;
      void unreachable;
      return "Saved to Linear.";
    }
  }
}
