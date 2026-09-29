"use client";

import { useState } from "react";
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
import { DEFAULT_ENERGY_TAGS, type IssueOverlay, type LinearIssue } from "@/lib/types";

type Props = {
  issue: LinearIssue | null;
  overlay: IssueOverlay | undefined;
  energyTags: string[];
  onClose: () => void;
  onPatch: (issueId: string, patch: IssueOverlay) => void;
  onAddTag: (tag: string) => void;
};

export function IssueDrawer({
  issue,
  overlay,
  energyTags,
  onClose,
  onPatch,
  onAddTag,
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
            onPatch={onPatch}
            onAddTag={onAddTag}
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
  onPatch,
  onAddTag,
}: {
  issue: LinearIssue;
  overlay: IssueOverlay | undefined;
  energyTags: string[];
  onPatch: (issueId: string, patch: IssueOverlay) => void;
  onAddTag: (tag: string) => void;
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
            Local overlays only. Status lives in Linear. This drawer never writes
            back.
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
