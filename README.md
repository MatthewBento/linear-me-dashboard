# Linear Me

Personal Linear cockpit. It shows issues assigned to you, then adds local overlays Linear does not give a solo operator. Linear stays the source of truth for status. This app never writes issues back. Deep-link into Linear to change work.

## Run in under five minutes

```bash
git clone <this-repo>
cd linear-me
npm install
cp .env.example .env.local
```

Put your Linear personal API key in `.env.local` as `LINEAR_API_KEY`. Optional `LINEAR_USER_ID` pins assignee if `viewer` / `isMe` is ambiguous. Optional `LINEAR_WORKSPACE_NAME` labels the env workspace in the switcher.

```bash
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). The key is read only on the server. It is never sent to the browser.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify
```

`npm run verify -- --skip-build` skips the production build. `VERIFY_BASE_URL=http://127.0.0.1:43147 npm run verify -- --skip-build --live` hits a running server.

## Persistence

JSON files under `data/` (gitignored except examples).

| What | Path |
| --- | --- |
| Linear snapshot (offline board) | `data/cache/<workspaceId>.json` |
| Overlays, focus queue, WIP/stale settings | `data/overlays/<workspaceId>.json` |
| Active workspace id | `data/global.json` |
| Extra API keys | `data/workspaces.local.json` |

Overlays are keyed by Linear issue id. Reload keeps them. A failed Linear call still serves the last successful cache and shows an offline banner.

## Multi-workspace

The env key is workspace `env-default`. Copy `data/workspaces.example.json` to `data/workspaces.local.json` and replace `lin_api_REPLACE_ME`. The header switcher lists every workspace. Keys never appear in API JSON to the client.

## Features

### Core (Linear)

1. **Key handling.** `.env.local` only. Health and board routes never echo the secret.
2. **Who I am.** GraphQL `viewer` plus issues with `assignee.isMe` (or `LINEAR_USER_ID`).
3. **Sync.** Issues, states, projects, teams, labels, cycles, priority, due date, `updatedAt`, estimates, blocked-by.
4. **Active board.** Done and Canceled hidden by default. Toggle Show completed.
5. **Filters.** Project, status, priority, label, cycle, energy tag. Combinable. Search with `/`.
6. **Sort.** Priority, updated, due. Asc or desc.
7. **Deep link.** Each row uses Linear's `url` (workspace-correct). Enter opens it. `o` opens the local overlay drawer.
8. **Refresh.** Header timestamp plus Refresh (`r`). Missing or rejected keys show a usable error.
9. **Empty / loading / error.** Spinner on first load. Empty copy per view. Cache banner when offline.

### Local overlays (never written to Linear)

1. **Focus queue.** Ranked doing-today list. `f` to add or remove. Drag or up/down. Persisted as `focusQueue`.
2. **Energy tags.** `deep-work`, `quick`, `blocked-on-others`, plus custom tags. Filter by tag. `e` cycles the selected issue.
3. **WIP limit.** Soft cap on In Progress (`state.type === started`). Banner when over. Editable in the filter rail.
4. **Stale radar.** View 5, plus a Stale badge. Window is `staleDays` (default 7).
5. **Blocker digest.** View 4. Energy tag `blocked-on-others`, Linear `blockedBy`, or a state name containing "block". Waiting-on note in the drawer and on the row.
6. **Estimate vs burn.** View 6. Linear estimate or local override vs burned completed estimates, with cycle days remaining.
7. **Meeting / PR glue.** Per issue PR URL, Slack/thread URL, meeting note.
8. **Private scratch.** Free text. Search includes scratch. Never sent to Linear.
9. **Keyboard triage.** `?` help. `j`/`k` move. Enter opens Linear. `f` focus. `s` snooze until tomorrow. `x` clears snooze. `c` completed toggle. `1`-`6` views. `r` refresh.
10. **Snooze.** Hide from the default active list until a date. Toggle Show snoozed.
11. **Morning brief.** View 2. Due today, overdue, unstarted in the current cycle, focus top 5.
12. **Workspace switch.** Env workspace plus `workspaces.local.json`.
13. **Offline cache.** Last successful sync on disk. Banner when serving cache or when it is older than 30 minutes.

## Stack

Next.js App Router, TypeScript strict, Tailwind, shadcn/ui. Server routes call `https://api.linear.app/graphql`.

## Verify skill

Agents should follow `.cursor/skills/verify-linear-me/SKILL.md` and run `npm run verify` instead of throwaway scripts.

## Non-goals

This is not a team board. Status is not forked. There is no mobile native app. `npm run dev` is enough.
