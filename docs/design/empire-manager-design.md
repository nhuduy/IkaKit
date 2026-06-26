# Empire Manager Design

Empire Manager is the primary IkaKit overview. It is an in-game modal injected
into Ikariam and backed by the shared game data layer.

## Tabs

Current tab order:

1. Resources
2. Buildings
3. Research
4. Military
5. Espionage

The active tab is stored under:

```text
ika_empire_active_tab
```

## Data Dependencies

Empire Manager consumes `gameData.get()` and `gameData.onChange(listener)`.
Each tab module renders from the current normalized city payload.

Tab responsibilities:

- `resources.js`: goods, housing, research, corruption, and resource transport
  actions.
- `buildings.js`: building levels, upgrade readiness, next-level cost, and
  resource differences.
- `research.js`: research summary, category progress, academy/scientist table,
  and Research Advisor or Academy actions.
- `military.js`: land units, ships, and deployment actions.
- `espionage.js`: hideout, academy, and workshop levels.

Shared helpers:

- `cityCell.js` renders city cells and city switching.
- `transportActions.js` renders resource, army, and fleet action buttons.
- `buildingCosts.js` contains local next-level cost data used by Buildings and
  City Watcher.

## UI Lifecycle

Empire Manager:

- Adds a menu button or fallback control.
- Loads shared CSS through `browser.runtime.getURL`.
- Opens and closes a modal overlay.
- Saves the active tab.
- Refreshes when game data changes.
- Reacts to navigation changes through `onPageChange(pageName)`.
- Supports scan controls for city and research data.

The modal should remain a compact operational surface, not a marketing page or
separate dashboard.

## City Actions

City names and action buttons call the game data bridge instead of duplicating
Ikariam navigation logic in the content module.

Current actions include:

- Change selected city.
- Open resource transport.
- Open army deployment.
- Open fleet deployment.
- Open Research Advisor or city Academy.
- Open building views through native Ikariam routing.

Actions are player-triggered. Empire Manager does not auto-send resources,
auto-upgrade buildings, or schedule background routes.

## Empty And Partial Data

Cached data can render before every city is fully scanned. Tab renderers should
handle missing city details gracefully and keep the interface usable while scans
are in progress.

## Extension Boundary

Empire Manager may shorten navigation and show upgrade readiness. It must not
make hidden choices for the player, maintain account-wide automation plans, or
start background game actions without an explicit user interaction.
