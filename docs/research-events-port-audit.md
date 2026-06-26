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

## Compact Event Store Contract

- `emit(event)` normalizes one event, stores it if active, notifies listeners,
  and relays only newly inserted events to the background notification path.
- `emitMany(events)` is the batch form of `emit`.
- `on(listener)` subscribes to store changes and returns an unsubscribe
  function. `onChange(listener)` remains as a compatibility alias.
- `getActiveEvents()` returns non-expired events sorted by expiry.
- `toJSON()` returns clone-safe active events for copy/export.
- `clear()` empties only the in-memory store and notifies listeners; it does not
  touch account storage or automation state.

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

## Phase 1 Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- Empire tab list is now `resources`, `buildings`, `research`, `military`,
  `espionage`.
- Static audit found no runtime imports or manifest entries for automation
  modules. The only `IkaLabs` and automation-scope strings are this audit
  document's boundary notes.

## Phase 2 Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- Military Alerts still emits through `gameEvents.emitMany(...)`.
- Town News Notification Alert still emits through `gameEvents.emit(...)`.
- The helper still relays new active events to the background with
  `__ikakit: 'gameEvents'`.
