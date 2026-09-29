# Offline cache and missing key

The last good Linear snapshot is `data/cache/<workspaceId>.json`. Overlays live in a different file and still save when Linear is down.

## Sub-features

- Last sync. The header reads Last synced, then the local time of `lastSyncedAt`, or never.
- Stale banner. An amber note when the server marks the body stale and the rows are not the offline cache.
- Offline banner. The last successful cache, with the error text when a refresh failed.
- Missing key error. No workspace is configured.

## How to get to it (user POV)

1. With no `LINEAR_API_KEY` and no `data/workspaces.local.json`, open the app. The red banner tells you to copy `.env.example` to `.env.local`.
2. After one good refresh, stop Linear from answering and click Refresh. The board stays up, and the offline banner appears.
3. Read Last synced in the header. It follows `lastSyncedAt`.

## Driving it with HTTP and DOM

`GET /api/health` returns `{ "configured": false, "workspaceCount": 0 }` when no key is configured.

`GET /api/board` then returns `configured: false`, `ok: false`, an empty `issues` array, and an `error` that starts with `No Linear API key configured`. The page shows `[data-testid="missing-key-banner"]`.

`[data-testid="offline-banner"]` renders when `fromCache` is true. The copy starts with Showing the last successful local cache. When `error` is set, the banner includes that string.

`[data-testid="refresh"]` calls `GET /api/board?refresh=1`. A failed refresh that already has a cache file keeps the previous issues and sets `fromCache` to true.

`[data-testid="view-board"]` still lists `[data-testid="issue-row"]` from that cache. `[data-testid="search"]` filters those cached rows. `[data-testid="issue-drawer"]` and `[data-testid="focus-queue"]` still edit local overlays.

The cache file fields are `syncedAt`, `viewer`, `issues`, and `facets`. A reader returns null when `viewer` is missing or `issues` is not an array.

The 30 minute warning is a different banner. It has no test id. The copy starts with Cache is more than 30 minutes old.

`[data-testid="view-brief"]`, `[data-testid="view-focus"]`, `[data-testid="view-blockers"]`, `[data-testid="view-stale"]`, and `[data-testid="view-burn"]` keep working on cached issues. `[data-testid="wip-banner"]` still counts started issues in that cache. `PUT /api/overlays` is separate from the cache file.

## Gotchas

`stale` uses the cache file age from before the fetch. The first successful sync has no prior file, so `stale` is true even when `lastSyncedAt` is new. A refresh that replaces a cache older than 30 minutes does the same. Treat `fromCache` as the offline banner. Treat `lastSyncedAt` as the snapshot time.

An invalid key with no cache does not show `[data-testid="missing-key-banner"]`. `configured` stays true. The red banner has no test id and shows the Linear error.

An invalid key with a cache shows `[data-testid="offline-banner"]`, not the missing-key banner.

The client never receives the API key. Keep the key in server env only.

Overlay saves do not need a live Linear call. `PUT /api/overlays` still needs a configured workspace, so a missing key cannot save overlays through that route.
