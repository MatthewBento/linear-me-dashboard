# Features

Index of user-facing features. Primary surface is the Next.js web UI at http://127.0.0.1:43147. Secondary surface is HTTP /api/board, /api/overlays, /api/health.

Start the app with `npm run dev`. The home page renders the dashboard. These notes say how to reach each feature and how to drive it.

## Feature files

- [Board filters](board-filters.md) covers the active board, hidden completed issues, combined filters, sort, and the Linear deep link.
- [Focus queue and overlays](overlays-focus.md) covers the focus queue, energy tags, snooze, scratch, PR and Slack glue, and `data/overlays`.
- [Morning brief, blockers, and stale radar](morning-brief-blockers-stale.md) covers views 2, 4, and 5, plus waiting-on notes.
- [WIP banner and estimate versus burn](estimate-burn-wip.md) covers the WIP banner and the estimate versus burn chart.
- [Offline cache and missing key](offline-cache.md) covers `data/cache`, last sync, the stale and offline banners, and the missing key error.
- [Refresh and write-back](refresh-writeback.md) covers the change banner, `GET /api/changes`, Linear webhooks, and drawer writes for status, comments, and attachments.

## Stable hooks

Use these attributes.

- `data-testid="view-board"`
- `data-testid="view-brief"`
- `data-testid="view-focus"`
- `data-testid="view-blockers"`
- `data-testid="view-stale"`
- `data-testid="view-burn"`
- `data-testid="refresh"`
- `data-testid="issue-row"`
- `data-testid="focus-queue"`
- `data-testid="missing-key-banner"`
- `data-testid="offline-banner"`
- `data-testid="wip-banner"`
- `data-testid="issue-drawer"`
- `data-testid="search"`
- `data-testid="linear-changed-banner"`
- `data-testid="linear-state"`
- `data-testid="linear-state-submit"`
- `data-testid="linear-comment"`
- `data-testid="linear-comment-submit"`
- `data-testid="linear-attachment-url"`
- `data-testid="linear-attachment-title"`
- `data-testid="linear-attachment-submit"`
- `data-testid="linear-write-error"`

`GET /api/health` returns `configured` and `workspaceCount`. `GET /api/board` returns the board, including `overlays`, `workflowStatesByTeamId`, `changeNotice`, and `webhookConfigured`. `PUT /api/overlays` writes local overlay JSON. `GET /api/changes` returns `{ notice, lastSyncedAt, webhookConfigured }`. `POST /api/linear/write` applies one Linear mutation. `POST /api/webhooks/linear` checks the signing secret. The API key stays on the server.
