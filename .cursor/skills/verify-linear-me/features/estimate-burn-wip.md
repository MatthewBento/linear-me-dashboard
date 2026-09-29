# WIP banner and estimate versus burn

The WIP banner is global. The chart is view key `6`.

## Sub-features

- WIP banner. It shows when the number of In Progress issues is above the soft cap.
- Estimate versus burn chart. For each cycle, remaining estimate against burned estimate, plus days left.

## How to get to it (user POV)

1. Leave more issues In Progress than the WIP limit. The default limit is 3. The banner appears above every view.
2. Change WIP limit in the left column on Board, Blockers, or Stale radar.
3. Press `6`, or click Estimate vs burn, to open the chart.

## Driving it with HTTP and DOM

Count issues whose `state.type` is `started`. When that count is greater than `overlays.settings.wipLimit`, `[data-testid="wip-banner"]` is on the page. The banner is absent when the count equals the cap.

Click `[data-testid="view-burn"]`. The chart root is `[data-testid="estimate-chart"]`. Each cycle row shows days remaining, remaining points, burned points, and an unestimated count when an open issue has no estimate.

`PUT /api/overlays` with `settings.wipLimit` saves the cap. The input is `#wip`. Values below 1 become 1. `GET /api/board` returns the settings inside `overlays`. `GET /api/health` does not return the cap.

A local `estimateOverride` replaces the Linear estimate, and `0` counts as zero. If the override is absent, the chart uses `issue.estimate`. Completed and canceled issues add to burned. Other issues add to remaining. A null estimate on an open issue increments the unestimated count and adds nothing to remaining.

`[data-testid="issue-row"]` on `[data-testid="view-board"]` still lists the issues. The chart groups by `issue.cycle` and does not render rows.

The view buttons `[data-testid="view-brief"]`, `[data-testid="view-focus"]`, `[data-testid="view-blockers"]`, and `[data-testid="view-stale"]` leave the banner in place when the cap is exceeded. `[data-testid="refresh"]` reloads the counts. `[data-testid="search"]` does not change the WIP count. `[data-testid="focus-queue"]` and `[data-testid="issue-drawer"]` are unchanged by the chart. `[data-testid="missing-key-banner"]` and `[data-testid="offline-banner"]` appear only for key and cache failures.

## Gotchas

The banner counts every started issue on the board body, including snoozed ones. Filters do not change the count.

Issues with no cycle are left off the chart.

Burned includes completed and canceled issues in that cycle, including issues the board hides.

`estimateUnit` is stored on the overlay. The chart adds the raw numbers and does not convert hours to points.

An empty chart says there is no cycle data. That empty state does not use `[data-testid="wip-banner"]`.
