# Focus queue and overlays

Local notes sit beside Linear. The server stores them in `data/overlays/<workspaceId>.json`. Linear stays the source of truth for status.

## Sub-features

- Focus queue. An ordered list of issue ids for today.
- Energy tags. `deep-work`, `quick`, and `blocked-on-others`, plus any custom tags you add.
- Snooze. A date that hides the issue from the active board.
- Scratch. A private note. Board search includes it.
- PR and Slack glue. `prUrl`, `slackUrl`, and `meetingNote` stay on the overlay.
- Persist under `data/overlays`. `PUT /api/overlays` writes the file for the active workspace.

## How to get to it (user POV)

1. On the board, select an issue and press `f` to add it or remove it from Doing today.
2. On a wide window, the right rail is Doing today. Drag a row, or use the up and down buttons, to reorder.
3. Press `3`, or click Focus, to open the full queue. The hook is `data-testid="view-focus"`.
4. Press `o` to open the drawer. Set energy, snooze, scratch, PR URL, Slack URL, and the meeting note there.
5. Press `s` to snooze the selected issue until tomorrow. Press `x` to clear snooze. Press `e` to cycle the energy tag.

## Driving it with HTTP and DOM

Send `PUT /api/overlays` with `Content-Type: application/json`.

The body may include `workspaceId`, `issueId`, `patch`, `focusQueue`, `settings`, and `extraEnergyTag`.

`patch` fields are `energyTag`, `waitingOn`, `estimateOverride`, `estimateUnit`, `prUrl`, `slackUrl`, `meetingNote`, `scratch`, and `snoozeUntil`. `estimateUnit` is `points` or `hours`.

A saved file has this shape.

```json
{
  "issues": {
    "issue-1": {
      "energyTag": "deep-work",
      "waitingOn": "design",
      "estimateOverride": 3,
      "estimateUnit": "points",
      "prUrl": "https://example.com/pr/1",
      "slackUrl": "https://example.com/slack/1",
      "meetingNote": "Ship Friday",
      "scratch": "private note",
      "snoozeUntil": "2026-10-01"
    }
  },
  "focusQueue": ["issue-1", "issue-2"],
  "settings": {
    "wipLimit": 3,
    "staleDays": 7,
    "extraEnergyTags": ["admin"]
  }
}
```

A success response has `ok` set to true and `overlays` set to the saved store. A missing workspace returns HTTP 400, `ok` set to false, and `error` set to `No workspace configured.`

`GET /api/board` includes the current `overlays` object. `GET /api/health` only reports whether a workspace exists.

Drive the same state in the DOM.

- Click `[data-testid="view-focus"]` for the full queue.
- `[data-testid="focus-queue"]` is the Doing today rail on Board, Blockers, and Stale radar.
- `[data-testid="issue-row"]` is a board row. Select one, then press `f`.
- `[data-testid="issue-drawer"]` holds the fields. Waiting on is `#waitingOn`. Snooze is `#snooze`. Scratch is `#scratch`. PR is `#pr`. Slack is `#slack`. Meeting note is `#meet`.
- `[data-testid="search"]` on `[data-testid="view-board"]` matches scratch text.
- `[data-testid="refresh"]` reloads the board and the saved overlays.
- `[data-testid="view-brief"]`, `[data-testid="view-blockers"]`, `[data-testid="view-stale"]`, and `[data-testid="view-burn"]` are the other view buttons.
- `[data-testid="wip-banner"]`, `[data-testid="missing-key-banner"]`, and `[data-testid="offline-banner"]` are separate banners. Overlay edits still use the drawer.

## Gotchas

The drawer never writes status back to Linear.

Snooze dates compare with UTC today as `YYYY-MM-DD`. The board hides a snoozed issue while Show snoozed is off.

An empty `energyTag` clears the tag. The keyboard cycle starts at that empty value, then walks each tag.

`focusQueue` may list an id that is absent from `issues`. The UI skips ids that are not on the current board.

Custom tags go on `settings.extraEnergyTags`. They belong to the workspace, not to one issue.

`[data-testid="focus-queue"]` is hidden below the large breakpoint. The Focus view shows the queue at every width, and that full list does not use `data-testid="focus-queue"`.

`PUT /api/overlays` needs a configured workspace. A store roundtrip writes `data/overlays/<workspaceId>.json` and leaves Linear alone.
