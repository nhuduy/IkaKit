# IkaKit Design Documentation

This folder is the official home for IkaKit design documentation. The docs here
describe the implementation that exists in the repository, the product boundary
for future work, and the audit notes that explain why some feature surfaces are
intentionally excluded.

## Design Index

- [Product Direction](product-direction.md): product promise, target users,
  current feature boundaries, non-goals, roadmap, and media guidelines.
- [WebExtension Architecture](webextension-architecture.md): manifests,
  content entry flow, background runtime, permissions, and build outputs.
- [Runtime And Module Architecture](runtime-module-architecture.md): content
  initialization, navigation lifecycle, module ownership, and UI refresh flow.
- [Game Data Design](game-data-design.md): page bridge, cache behavior,
  `window.postMessage` contracts, and scan flows.
- [Empire Manager Design](empire-manager-design.md): Empire tabs, data
  dependencies, city actions, and refresh behavior.
- [Alerts And Notifications Design](alerts-notifications-design.md): Military
  Alerts, Town News alerts, Events tab, background messages, badge and alarm
  behavior.
- [City Watcher And Transport Helpers](city-watcher-transport-design.md):
  town-map overlays, quick transport actions, and player-control boundaries.
- [Storage And I18n Design](storage-i18n-design.md): storage keys, language
  loading, message catalogs, and cross-browser API wrappers.
- [Build And Release Design](build-release-design.md): Chrome/Firefox build
  process, manifest differences, and release checks.
- [Notification Port Audit](notification-port-audit.md): phased audit of the
  notification port.
- [Research And Events Port Boundary](research-events-port-audit.md): research
  tab and compact events boundary.

## Code Audit Baseline

The design docs were audited against these current implementation facts:

- `content/loader.js` is the classic content-script entry point and dynamically
  imports `content/init.js`.
- `content/init.js` loads language data, starts the game data layer, and safely
  initializes Empire Manager, Transport, Military Alerts, Notification Alerts,
  Alerts panel, and City Watcher.
- The background runtime handles `gameEvents`, `clearGameEvents`,
  `notificationAlertTest`, `militaryEvents`, and `clearMilitaryAlertTests`.
- The page bridge handles `gameData`, `requestCityScan`,
  `requestResearchScan`, `requestMilitaryAdvisorScan`, `openGameView`,
  `changeCity`, and `upgradeBuilding`.
- Storage-backed state includes active Empire tab, active Alerts tab, Alerts
  modal position, language selection, game data cache, military settings and
  events, notification alert settings, and background game events.
- Current non-goals remain excluded: Automation Center, route schedule,
  auto-send resources, floating event launcher, construction automation,
  Auto Builder, and account-scoped automation state.

## Documentation Rules

- Keep design documentation in this folder.
- Keep images and screenshots in `docs/assets/`.
- Update this index whenever adding, renaming, or removing design documents.
- When adding a major feature, document the product boundary and runtime
  contract before wiring broad implementation paths.
