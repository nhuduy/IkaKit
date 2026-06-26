# Research And Events Port Boundary

This note tracks the research tab and compact game events UI port into IkaKit.
It mirrors the notification port style: document the allowed surface first,
then keep each feature commit narrow and auditable.

## Reference Scope

- Reference repository: `../IkaLabs`.
- IkaLabs is read-only for this port.
- IkaKit remains the implementation target on `main`.

## Allowed Research Surface

- Empire Manager `Research` tab between `Buildings` and `Military`.
- Research overview UI with summary stats, four research categories, city
  academy/scientist table, `Open Advisor`, and per-city `Academy` action.
- Game data support for `data.research`.
- `requestResearchScan(force)` bridge message.
- Research advisor/category parsing and cache merge only.

## Research Exclusions

- Automation Center.
- Route Schedule.
- Auto-send resource flows.
- Construction Overview and Auto Builder code paths.
- Account-scoped automation state.
- Any IkaLabs-branded user-facing strings.

## Allowed Events Surface

- Lightweight in-memory `gameEvents` store.
- API: `emit`, `emitMany`, `on`, `getActiveEvents`, `clear`, and `toJSON`.
- Existing background relay behavior for desktop notifications.
- Compact `Alerts > Events` tab with filters for `all`, `military`,
  `townNews`, and `game`.
- `Refresh`, `Copy`, and `Clear` controls.

## Events Exclusions

- Floating Game Event launcher.
- Persistent account storage.
- Construction locks.
- Route support suggestions.
- Builder/resource support UI.
- Automation categories or automation wake behavior.

## Verification

- Build Chrome and Firefox bundles after each feature phase.
- Static audit for automation imports or manifest entries:
  `automationCenter`, `autoSendResource`, `routeSchedule`,
  `constructionOverview`.
- Static audit for IkaLabs user-facing strings.
- Confirm the Empire tab list is:
  `Resources`, `Buildings`, `Research`, `Military`, `Espionage`.
- Confirm Alerts tabs are:
  `Military Alerts`, `Town News`, `Events`.
