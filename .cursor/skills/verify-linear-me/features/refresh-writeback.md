# Refresh and write-back

The header keeps the last sync time and a Refresh button. Webhooks record a small notice on disk. The issue drawer can write status, comments, and attachments to Linear after you confirm. Mutations stay on the server.

## Sub-features

- Refresh. `[data-testid="refresh"]` and the `r` key call `GET /api/board?refresh=1`.
- Change banner. `[data-testid="linear-changed-banner"]` appears when `changeNotice.updatedAt` is newer than the loaded `lastSyncedAt`. The copy starts with Linear updated. Refresh to load. and lists the notice kinds.
- Changes poll. A visible tab calls `GET /api/changes` every 20 seconds. The route reads `data/notices/<workspaceId>.json` and does not call Linear.
- Workflow state. `[data-testid="linear-state"]` lists `workflowStatesByTeamId` for the issue team, or `facets.states` when that team has no list. `[data-testid="linear-state-submit"]` confirms, then POSTs an `update-state` write. The row updates immediately and rolls back if the request fails.
- Comment. `[data-testid="linear-comment"]` and `[data-testid="linear-comment-submit"]` confirm, then POST a `create-comment` write. The field clears only after the server accepts it.
- Attachment. `[data-testid="linear-attachment-url"]`, optional `[data-testid="linear-attachment-title"]`, and `[data-testid="linear-attachment-submit"]` confirm, then POST a `link-attachment` write. The server calls Linear `attachmentLinkURL`.
- Errors. `[data-testid="linear-write-error"]` shows the JSON `error` string. A success toast follows an accepted write. Open in Linear stays on the issue `url`.

## How to get to it (user POV)

1. Open the app. Read Last synced in the header. Press Refresh or `r` to reload from Linear.
2. With `LINEAR_WEBHOOK_SECRET` set, deliver an Issue or Comment webhook. Within about two seconds the notice file updates. On the next poll, or on the next board load, the banner asks you to refresh.
3. Open an issue with `o` or by clicking a row. The Write to Linear section sits above the local overlay fields.
4. Choose a workflow state and click Update status in Linear. Confirm the dialog. The row shows the new state. If Linear rejects it, the previous state returns and the error line appears.
5. Type a comment or an http or https URL, confirm, and wait for the toast. Those two actions do not change the row until you refresh.

## Driving it with HTTP and DOM

`[data-testid="missing-key-banner"]` still shows when no workspace is configured. Write controls render only inside `[data-testid="issue-drawer"]` after an issue exists. With no key and no cached issue, assert the routes from source and HTTP instead of the drawer.

`GET /api/changes` returns 200 JSON with `notice`, `lastSyncedAt`, and `webhookConfigured`. The body has no `apiKey`, no `LINEAR_API_KEY`, and no `lin_api_` value.

`POST /api/linear/write` with `{}` returns 4xx JSON `{ "ok": false, "error": "..." }`. The error text does not contain an API key. A real write body is `{ "workspaceId", "write" }` only. `write.kind` is `update-state`, `create-comment`, or `link-attachment`.

`POST /api/webhooks/linear` with no `LINEAR_WEBHOOK_SECRET` returns 503 and `{ "ok": false, "error": "LINEAR_WEBHOOK_SECRET is not set" }`. A bad signature or a timestamp more than 60 seconds off returns 401. The handler reads the raw body before it checks the HMAC. Issue and Comment events schedule one notice write about 1.5 seconds after the burst. The response is 200 and does not wait for GraphQL.

`GET /api/board` includes `workflowStatesByTeamId`, `changeNotice`, and `webhookConfigured`. `webhookConfigured` is true only when the secret is set. The secret itself is absent.

`[data-testid="refresh"]` remains the manual reload. `[data-testid="linear-state"]` is the state select. `[data-testid="linear-comment"]` is the comment field.

## Gotchas

The notice file lags the webhook response by the 1.5 second debounce. A poll can take up to 20 seconds to show the banner, and only while the tab is visible.

`changeNotice.updatedAt` is compared with the board `lastSyncedAt` already loaded in the browser. The poll does not replace `lastSyncedAt`. Refresh does.

Old cache files omit `workflowStatesByTeamId`. Readers fill `{}`. The state select then uses `facets.states`.

A failed team-states query during sync leaves that map empty and still saves the issues. The whole sync does not fail for that query.

Comments and attachments do not patch the cache and do not resync the board. Only `update-state` replaces the matching cached issue, and only when a cache file already exists.

The webhook path never calls Linear. It writes `data/notices/<workspaceId>.json` for the active workspace, or `env-default` when none is active. With no workspace, `GET /api/board` sets `changeNotice` to null. The poll can still load that `env-default` notice, and the banner shows because `lastSyncedAt` is null.

`POST /api/linear/write` requires `workspaceId` even if an env key is configured. An unknown id returns 400 `No workspace configured.`
