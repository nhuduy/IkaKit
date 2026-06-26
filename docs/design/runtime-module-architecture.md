# Runtime And Module Architecture

The content runtime is modular but intentionally simple. `content/init.js`
starts each feature with guarded initialization so one failing module does not
prevent the rest of IkaKit from loading.

## Initialization Flow

1. `content/loader.js` dynamically imports `content/init.js`.
2. `content/init.js` waits for the DOM when needed.
3. `loadLanguage()` initializes shared i18n state.
4. Feature modules initialize through `safeInit(name, callback)`.
5. The navigation helper notifies interested modules when Ikariam changes SPA
   views.

Current initialized modules:

- `gameData`
- `empire`
- `transport`
- `militaryAlerts`
- `notificationAlerts`
- `alerts`
- `cityWatcher`
- `navigation`

## Module Ownership

### Helpers

- `navigation.js` observes URL, hash, history, and DOM mutations to detect page
  changes.
- `gameData.js` injects the page bridge, merges live and cached game data, and
  exposes read and command helpers.
- `gameEvents.js` stores compact in-memory events and relays newly detected
  events to the background.
- `storage.js` wraps `browser.storage.local` and handles invalidated extension
  contexts.
- `runtime.js` wraps extension API access, runtime messaging, and extension URL
  generation.

### UI Modules

- `empire/` owns the Empire Manager modal and tabs.
- `alerts/` owns the Alerts modal and its tab shell.
- `militaryAlerts/` parses incoming military/advisor state and renders alert
  settings/status UI.
- `notificationAlerts/` parses Town News reports and renders notification
  alert settings/status UI.
- `cityWatcher/` owns town-map building overlays.
- `transport/` enhances transport forms with quick controls.

## Navigation Lifecycle

`navigation.onChange(callback)` is the main SPA lifecycle hook. The entry point
currently forwards page changes to:

- `empire.onPageChange(pageName)`
- `transport.onPageChange(pageName)`
- `alerts.onPageChange(pageName)`

City Watcher subscribes to navigation directly because it also coordinates with
game data updates and town-map DOM mutations.

## Failure Handling

Each top-level module is initialized through `safeInit`. A thrown error is
logged with the module name and does not stop later modules from starting.
Runtime helpers also treat invalidated extension context errors as expected
shutdown conditions so stale content scripts fail quietly after extension
reloads.

## Refresh Model

Feature modules refresh from three sources:

- Game data updates from the page bridge.
- SPA page changes from `navigation`.
- Local UI actions such as tab changes, scan buttons, or settings toggles.

Modules should prefer listening to shared helpers over creating duplicate
global observers. New modules should expose `init()` and, when page-specific,
`onPageChange(pageName)`.
