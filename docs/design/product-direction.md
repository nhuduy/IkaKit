# Product Direction

IkaKit helps Ikariam players understand their empire faster without leaving the
game screen. It should feel like a native companion panel: useful, lightweight,
and respectful of player control.

## Target Users

- Active Ikariam players who manage several cities and need a quick overview of
  resources, buildings, research, military, and espionage.
- Returning players who want fewer clicks for common checks and transports.
- Contributors who need a clear boundary between quality-of-life tooling and
  automation-heavy features.

## Product Promise

- Bring empire-wide information into one in-game modal.
- Reduce repetitive navigation between cities and advisors.
- Keep important alerts visible through in-game panels, extension badges, and
  desktop notifications.
- Support Chrome/Chromium and Firefox from one WebExtension source tree.
- Keep advanced automation out of scope unless it receives an explicit design
  review.

## Core Experience

### Empire Manager

The Empire Manager is the main information surface. It prioritizes city-by-city
comparison across Resources, Buildings, Research, Military, and Espionage.

Expected behavior:

- Load from cached city data first when possible.
- Refresh when Ikariam changes SPA views or the game data layer emits updates.
- Let users jump directly to a city from city names.
- Keep table columns stable enough for quick comparison.

### City Watcher

The town-map watcher highlights building levels and upgrade readiness directly
on the city view.

Expected behavior:

- Show level circles on buildings.
- Show next-level cost and resource difference tooltips.
- Allow direct upgrade only when the selected city has enough resources.
- Avoid hiding or breaking the native Ikariam interface.

### Alerts

Alerts should help users notice important events without becoming noisy.

Current tabs:

- Military Alerts
- Town News
- Events

Expected behavior:

- Military and Town News alerts can surface in the in-game panel, extension
  badge, and desktop notifications.
- The Events tab is an in-memory view of active detected events.
- Clear and copy actions affect only the compact event store, not account-level
  automation state.

### Transport Helpers

Transport helpers reduce form friction while leaving final decisions to the
player.

Expected behavior:

- Quick amount buttons should be predictable.
- Resource, army, and fleet actions should open the relevant game flows.
- No background auto-send behavior is included in the current product boundary.

## Non-Goals

The current design intentionally excludes:

- Automation Center
- Route Schedule
- Auto-send resource flows
- Floating game-event launchers
- Construction automation and Auto Builder
- Account-scoped automation state

These exclusions keep IkaKit focused on visibility, reminders, and
player-driven actions. Any future automation proposal should start with a
design note, risk review, and clear user controls.

## Demo And Media Plan

The README should show the product quickly. Repository media belongs in
`docs/assets/`.

Planned or existing media:

- `docs/assets/demo.gif`: 10-20 second flow showing Empire Manager, Alerts, and
  a quick transport helper.
- `docs/assets/empire-manager.png`: screenshot of the main overview.
- `docs/assets/alerts.png`: screenshot of Military Alerts, Town News, or
  Events.
- `docs/assets/city-watcher.png`: screenshot of building level circles on the
  town map.

Media guidelines:

- Blur or crop player names, coordinates, alliance data, and server details.
- Prefer real UI screenshots over mockups.
- Keep images lightweight enough for GitHub README loading.
- Update README links only after files exist.

## Roadmap

### v2.2

- Fleet scheduler design and prototype.
- Better Alerts badge reset checks.
- README demo GIF and screenshots.

### v2.3

- Better notification diagnostics and permission guidance.
- More polished Events filtering and export.
- Improved empty states for missing city data.

### v2.4

- Plugin API exploration for optional modules.
- Contributor-facing module contract docs.
- Safer extension points for future features.

## Design Principles

- Player remains in control: IkaKit can shorten paths, but should not silently
  make strategic decisions.
- Native-feeling UI: injected controls should sit comfortably inside Ikariam.
- Fast first read: overviews should answer common questions at a glance.
- Narrow feature boundaries: new ports and major features need explicit scope
  and exclusions.
- Community-friendly documentation: README, roadmap, and starter issues should
  make the project feel active and approachable.
