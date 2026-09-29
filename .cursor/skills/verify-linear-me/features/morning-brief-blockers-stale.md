# Morning brief, blockers, and stale radar

Three views read the same board body. The keys are `2`, `4`, and `5`.

## Sub-features

- Morning brief. Due today, overdue, unstarted work in the current cycle, and the top five focus items.
- Blockers. Issues tagged `blocked-on-others`, issues with Linear `blockedBy` links, or a status name that contains block.
- Waiting-on notes. A local string on the overlay. The row prints Waiting on, then the text you saved.
- Stale radar. Open issues whose `updatedAt` is at least `settings.staleDays` old. The default is 7 days.

## How to get to it (user POV)

1. Press `2`, or click Morning brief.
2. Press `4`, or click Blockers. Open a row and type a name in Waiting on.
3. Press `5`, or click Stale radar. Change Stale after in the left column when you want a different age.

## Driving it with HTTP and DOM

`GET /api/board` returns `issues` and `overlays`. These views filter that array in the browser. `GET /api/health` does not list issues.

- Click `[data-testid="view-brief"]`. The grid is `[data-testid="morning-brief"]`. The cards are Due today, Overdue, Unstarted in current cycle, and Focus queue top 5. Click a title to open `[data-testid="issue-drawer"]`.
- Click `[data-testid="view-blockers"]`. Rows are `[data-testid="issue-row"]`. A row with a waiting-on note includes the words Waiting on.
- Save a note with `PUT /api/overlays` and `patch.waitingOn`, or type into `#waitingOn` inside `[data-testid="issue-drawer"]`.
- Click `[data-testid="view-stale"]`. The age field is `#stale`. Saving it sends `settings.staleDays` to `PUT /api/overlays`.
- `[data-testid="view-board"]` is the filtered board, not these lists. `[data-testid="view-focus"]` and `[data-testid="view-burn"]` are the other views.
- `[data-testid="search"]` does not filter the brief, the blocker list, or the stale list.
- `[data-testid="focus-queue"]` still shows Doing today beside Blockers and Stale radar on a wide window.
- `[data-testid="refresh"]` reloads the issues those views read.
- `[data-testid="wip-banner"]`, `[data-testid="missing-key-banner"]`, and `[data-testid="offline-banner"]` can sit above all three views.

## Gotchas

A waiting-on note does not by itself put an issue on Blockers. Add the energy tag `blocked-on-others`, a Linear blocked-by link, or a status whose name contains block.

Stale radar and Blockers ignore the filter panel. Stale radar skips `completed` and `canceled`. Blockers do not apply the board's hide-completed rule.

Due today and overdue use UTC dates. Both skip completed and canceled issues. Morning brief does not apply snooze.

Unstarted in the current cycle means `state.type` is `unstarted`, `backlog`, or `triage`, and the cycle has started, has not ended, and is not completed. The focus card keeps the first five ids in `focusQueue`.

The stale badge on a board row uses the same day count. Stale radar is the full list. A `staleDays` value below 1 is saved as 1.
