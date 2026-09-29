"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "j / k", action: "Move selection down / up" },
  { keys: "Enter", action: "Open selected issue in Linear" },
  { keys: "o", action: "Open issue drawer (scratch, glue, tags)" },
  { keys: "f", action: "Add / remove selected from focus queue" },
  { keys: "s", action: "Snooze selected until tomorrow" },
  { keys: "x", action: "Clear snooze on selected" },
  { keys: "e", action: "Cycle energy tag (deep work → quick → blocked)" },
  { keys: "/", action: "Focus search" },
  { keys: "c", action: "Toggle show completed" },
  { keys: "1-4", action: "Jump to Board / Brief / Focus / Blockers" },
  { keys: "5 / 6", action: "Stale radar / estimate vs burn" },
  { keys: "r", action: "Refresh from Linear" },
  { keys: "?", action: "Toggle this help" },
  { keys: "Esc", action: "Close drawer / help" },
];

export function KeyboardHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard triage</DialogTitle>
          <DialogDescription>
            Designed for a fast personal pass over your Linear queue. Linear remains
            the source of truth. Enter always deep-links there.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {SHORTCUTS.map((row) => (
            <li key={row.keys} className="flex items-start justify-between gap-4">
              <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs">
                {row.keys}
              </kbd>
              <span className="flex-1 text-muted-foreground">{row.action}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
