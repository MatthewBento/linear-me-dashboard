# Board filters

The board is the default list of issues assigned to you. Filters and sort run in the browser on the body from `GET /api/board`.

## Sub-features

- Active board. View key `1`. The button label is Board.
- Hide completed. Done and Canceled stay hidden until you turn on Show completed.
- Combinable filters. Project, status, priority, label, cycle, energy tag, and search all apply together.
- Sort. Priority, updated, or due. Ascending or descending.
- Deep link. Enter, or the Linear control on a row, opens `issue.url` from the API.

## How to get to it (user POV)

1. Open http://127.0.0.1:43147.
2. Click Board, or press `1`. The hook is `data-testid="view-board"`.
3. Use the left column. Search is first. The checkboxes read Show completed and Show snoozed.
4. Click a row to select it. Press Enter, or click Linear on that row, to open Linear.

## Driving it with HTTP and DOM

`GET /api/board` returns every assigned issue. It does not take filter query params. `refresh=1` fetches Linear again. `workspace` picks a workspace id.

`GET /api/health` returns `configured` and `workspaceCount`. It does not return issues.

Drive the board in the DOM.

- Click `[data-testid="view-board"]`.
- Type in `[data-testid="search"]`. The query matches identifier, title, project name, and private scratch.
- Set the selects labeled Project, Status, Priority, Label, Cycle / sprint, and Energy tag. An empty value means all.
- Set the selects labeled Sort and Dir. Sort values are `priority`, `updated`, and `due`. Dir values are `asc` and `desc`.
- The Show completed checkbox maps to `showCompleted`. The default is off.
- Rows are `[data-testid="issue-row"]`. Each row also has `data-issue-id` set to the Linear issue id.
- The Linear control on a row opens `issue.url`. Enter does the same for the selected row.
- Double-click a row, click Overlay, or press `o` to open `[data-testid="issue-drawer"]`.

Press `c` to toggle Show completed. Press `/` to focus `[data-testid="search"]`. Press `r`, or click `[data-testid="refresh"]`, to reload.

Other hooks on this page stay present while you filter. `[data-testid="view-brief"]`, `[data-testid="view-focus"]`, `[data-testid="view-blockers"]`, `[data-testid="view-stale"]`, and `[data-testid="view-burn"]` switch views. `[data-testid="focus-queue"]` is the Doing today rail. `[data-testid="wip-banner"]` can show above the list. `[data-testid="missing-key-banner"]` and `[data-testid="offline-banner"]` replace a healthy board when the key or the network fails.

## Gotchas

Only the Board view uses these filters. Stale radar and Blockers draw the same panel and ignore it.

Completed means `state.type` is `completed` or `canceled`. A status named Done with another type still shows.

Priority `0` is No priority. An ascending priority sort places it after Urgent, High, Medium, and Low. Equal keys then sort by identifier.

A reload resets filters. They are not in the page URL. The deep link is `issue.url` on the issue, not a query string on this app.

Search does not match labels or the waiting-on note.

The energy filter matches the local overlay tag, not a Linear label.
