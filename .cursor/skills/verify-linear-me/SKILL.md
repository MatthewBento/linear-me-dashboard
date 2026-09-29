---
name: verify-linear-me
description: Verify Linear Me (Next.js personal Linear cockpit). Primary surface is the web UI on port 43147. Secondary surface is /api/health, /api/board, /api/overlays, /api/changes, /api/linear/write, /api/webhooks/linear. Use when checking this app, before merge, or when asked to verify Linear Me.
---

# Verify Linear Me

Next agent. Drive the real app. Do not write throwaway scripts. Use `npm run verify`.

## Interview (this repo)

- **Surface.** Web UI (`app/page.tsx` → `DashboardApp`). HTTP JSON under `app/api/*`, including `/api/changes`, `/api/linear/write`, and `/api/webhooks/linear`.
- **Run.** `npm run dev` binds **43147**. Needs `LINEAR_API_KEY` in `.env.local` for a live Linear board. Boots without a key and shows `data-testid="missing-key-banner"`.
- **Drive.** HTTP first (`/api/health`, `/api/board`, `PUT /api/overlays`). DOM via `data-testid` listed in `features/`. Optional browser pass after HTTP proof.
- **Observe.** Response JSON, `data/overlays/*.json`, `data/cache/*.json`, screenshots under `/tmp/cursor/linear-me-verify/` (create if missing). Proof artifacts survive cleanup.
- **Isolate.** One default data dir (`data/`). Do not run two verifiers against the same `data/` at once. A second instance needs another port and a copied tree.

## Launch

```bash
npm install
npm run dev
```

Ready when `http://127.0.0.1:43147/api/health` returns JSON. Teardown the process you started (the Next pid), never `pkill -f next`.

## Doctor

```bash
curl -sS http://127.0.0.1:43147/api/health
```

Worth driving if HTTP 200 and JSON includes `configured` (boolean) and `workspaceCount`. If the port refuses, launch first. `configured: false` is still worth driving (missing-key path).

## Drive

1. `npm run verify -- --skip-build` (or full `npm run verify`).
2. HTTP. `GET /api/board` must include `overlays` with `issues`, `focusQueue`, `settings`. Never includes `apiKey` or `LINEAR_API_KEY`.
3. Persist. `PUT /api/overlays` with `{ "issueId": "<id>", "patch": { "scratch": "verify-note" } }` then `GET /api/board` and confirm `overlays.issues[<id>].scratch` plus the file `data/overlays/<workspaceId>.json`.
4. DOM. Open `/`. Click `data-testid="view-board"` through `view-burn`. Missing key shows `missing-key-banner`. After a failed live sync with cache, `offline-banner`. Over WIP shows `wip-banner`. With a cached issue, open the drawer and confirm `linear-state`, `linear-comment`, and `linear-attachment-url` are present. Without an issue, skip the drawer and use the HTTP checks below.
5. Keyboard. Focus the page (not an input). `?` opens help. `/` focuses `data-testid="search"`. `r` refreshes.
6. Changes. `GET /api/changes` is 200 JSON with `notice`, `lastSyncedAt`, and `webhookConfigured`. The body has no API key.
7. Write. `POST /api/linear/write` with `{}` is 4xx JSON and does not echo `apiKey`.
8. Webhook. `POST /api/webhooks/linear` with no `LINEAR_WEBHOOK_SECRET` is 503 and `error` is `LINEAR_WEBHOOK_SECRET is not set`.

Selectors. `view-board`, `view-brief`, `view-focus`, `view-blockers`, `view-stale`, `view-burn`, `refresh`, `issue-row`, `focus-queue`, `missing-key-banner`, `offline-banner`, `wip-banner`, `issue-drawer`, `search`, `morning-brief`, `estimate-chart`, `linear-changed-banner`, `linear-state`, `linear-state-submit`, `linear-comment`, `linear-comment-submit`, `linear-attachment-url`, `linear-attachment-title`, `linear-attachment-submit`, `linear-write-error`.

## Evidence

Store under `/tmp/cursor/linear-me-verify/<utc-stamp>/`. Keep `health.json`, `board.json`, `overlays-after.json`, and one screenshot of the board if a browser ran. Proof is the action plus the resulting file or JSON, not a screenshot alone. Linear is mocked only by absence of a key or by serving cache after a failed refresh. Never invent `LINEAR_API_KEY`.

## Cleanup

Stop the `npm run dev` you launched. Leave `data/cache`, `data/overlays`, and `data/notices` unless the run created `verify-fixture` files. Delete those fixture ids only. Do not delete `/tmp/cursor/linear-me-verify/`.

## Helpers

```bash
npm run verify
npm run verify -- --skip-build
VERIFY_BASE_URL=http://127.0.0.1:43147 npm run verify -- --skip-build --live
npm test
```

`scripts/verify.ts` is the helper. Feature procedures live in `features/`.
