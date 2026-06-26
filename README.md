# IkaKit

IkaKit is a community-built browser extension for Ikariam. It adds empire
management, alerting, and quality-of-life tools directly inside the game
interface so players can understand their cities faster and click less.

IkaKit is inspired by the ideas behind IkaEasy v3, but it is a ground-up
reimplementation focused on a modular architecture, cross-browser
compatibility, extensibility, and long-term maintainability.

The extension supports Chrome/Chromium and Firefox through WebExtension
Manifest V3, content scripts, a background script, and `webextension-polyfill`.
It has been tested on multiple Chromium-based browsers, including Google
Chrome, Microsoft Edge, Brave, Opera, Vivaldi, SRWare Iron, and Cốc Cốc (Gang
Jing Browser), as well as Mozilla Firefox.

## Documentation

- Full English documentation: [README.md](README.md)
- Full Vietnamese documentation: [README.vi.md](README.vi.md)
- Community summaries: [繁體中文](README.zh-Hant.md),
  [Deutsch](README.de.md), [Français](README.fr.md),
  [Русский](README.ru.md), [Ελληνικά](README.el.md),
  [Polski](README.pl.md), [Español](README.es.md), and
  [Türkçe](README.tr.md)

English and Vietnamese README files are maintained as full documentation.
Future translations should be shorter community summaries with Installation,
Features, FAQ, and a link back to this English README for complete details.

## Demo

### Empire Manager

![IkaKit Empire Manager demo](docs/assets/empire-manager.png)

### Buildings Overview

![IkaKit Empire Manager Buildings overview](docs/assets/2.png)

The demo image has been sanitized before publishing: coordinates, town names,
and selected in-game values were edited so the account owner who helped test
the extension is not exposed.

Future demo media planned for this README:

- GIF demo: `docs/assets/demo.gif`
- Alerts screenshot: `docs/assets/alerts.png`
- City Watcher screenshot: `docs/assets/city-watcher.png`

See [docs/design/README.md](docs/design/README.md) before adding more
screenshots so account, server, and coordinate details are not exposed.

## Why IkaKit

- See resources, buildings, research, military, and espionage across cities in
  one in-game Empire Manager.
- Jump between cities and common game flows with fewer clicks.
- Track building upgrade readiness directly on the town map.
- Receive Military and Town News alerts through in-game UI, extension badge
  count, and desktop notifications.
- Build once for Chrome/Chromium and Firefox from the same WebExtension source.
- Keep the current product focused on visibility and player-driven actions
  instead of background automation.

## Warning

This source code is shared for community use and learning. Use it at your own
discretion and responsibility.

The author is not responsible for any issues, losses, account actions, or other
consequences that may happen when you modify, build, distribute, or use this
source code for your own purposes.

Ikariam rules, publisher policies, and paid-feature restrictions may change over
time. Before adding or using advanced features, especially features that may
overlap with premium or paid functionality offered by the game publisher, please
review the current game rules and decide carefully.

## Features

- Empire Manager modal injected directly into the Ikariam interface.
- City-by-city Resources overview for goods, housing, research, and corruption.
- Buildings overview with levels, upgrade state, next-level costs, and resource
  differences.
- Research tab with advisor sync, category overview, academy/scientist table,
  and direct Research Advisor/Academy actions.
- Military overview for land units and ships.
- Espionage overview for hideout, academy, and workshop levels.
- City data scanner and local cache for faster overview rendering.
- Quick actions for resource transport, army deployment, and fleet deployment.
- Quick amount buttons on transport forms.
- Clickable city names that jump directly to the selected city.
- Town-map Construction Upgrade Watcher with level circles, cost tooltips, and
  one-click upgrade when the city has enough resources.
- SPA navigation tracking so IkaKit refreshes when Ikariam changes views.
- Alerts panel with Military Alerts settings, incoming hostile severity,
  in-game warning panel, desktop notifications, extension badge count, and
  reminder controls.
- Town News Notification Alert for rendered espionage and military reports, with
  scan, clear, and test notification controls.
- Events tab inside Alerts for active Military, Town News, and game events, with
  filter, copy, refresh, and clear controls.
- English and Vietnamese extension metadata.

This notification port does not include Automation Center, Route Schedule,
auto-send resource flows, floating game-event launchers, or construction
automation/Auto Builder features.

## Roadmap

### v2.2

- Fleet scheduler design and prototype.
- Better Alerts badge reset checks.
- More README demo GIFs and screenshots.

### v2.3

- Better notification diagnostics and permission guidance.
- More polished Events filtering and export.
- Improved empty states for missing city data.

### v2.4

- Plugin API exploration for optional modules.
- Contributor-facing module contract docs.
- Safer extension points for future features.

More context lives in [docs/design/README.md](docs/design/README.md).

## Starter Issues

If the GitHub issue list is empty, seed a few approachable tasks so the project
looks active and contributors know where to begin:

- `good first issue`: Capture and add README demo screenshots.
- `good first issue`: Add empty-state copy for Empire Manager tables.
- `enhancement`: Improve notification permission diagnostics.
- `enhancement`: Write the fleet scheduler design proposal for v2.2.
- `bug`: Verify Alerts badge reset behavior after clearing all events.

## Requirements

- Node.js
- npm

## Install From Source

Clone the repository, install dependencies, then build the extension:

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

After the build finishes, output is written to:

```text
dist/chrome/
dist/firefox/
```

Load the extension into your browser from the matching build directory.

### Chrome / Chromium

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `dist/chrome`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select `dist/firefox/manifest.json`.

## Build Commands

Build for Chrome/Chromium:

```bash
npm run build:chrome
```

Build for Firefox:

```bash
npm run build:firefox
```

Build both targets:

```bash
npm run build
```

## Project Structure

```text
src/
  manifests/          Browser-specific manifests
  background/         Background script
  content/            Content scripts injected into Ikariam
    helpers/          Storage, navigation, and game data bridge helpers
    modules/
      alerts/         Standalone Alerts panel with alert settings and Events
      cityWatcher/    Town-map construction upgrade circles
      empire/         Empire Manager and overview tabs
      militaryAlerts/ Incoming military event notifications
      notificationAlerts/ Town News espionage/military alerts
      transport/      Quick controls for transport forms
  css/                Styles injected into the game
  assets/             Icons and UI images
  _locales/           English and Vietnamese metadata

scripts/
  build.js            Browser-specific build script

dist/
  chrome/             Chrome/Chromium build output
  firefox/            Firefox build output
```

## How It Works

IkaKit runs on Ikariam pages matching:

```text
*.ikariam.gameforge.com
```

`content/loader.js` loads the main module graph from `content/init.js`. The
main entry point starts the Empire Manager, Alerts panel, transport helpers,
Military Alerts, Notification Alert, navigation watcher, and game data layer.

The game data layer injects a bridge script into the page context, reads
available Ikariam data, scans Research Advisor data when requested, merges it
with cached city details, and notifies the UI when the overview should refresh.

Desktop notifications are sent by the extension background script. If alerts are
detected but no system notification appears, check the browser and operating
system notification permissions for the extension.

The Alerts Events tab uses an in-memory active event store. It shows events
detected during the current content-script session and does not persist
automation state.

## Design Docs

- [Design documentation](docs/design/README.md)
- [Notification port audit](docs/design/notification-port-audit.md)
- [Research and Events port boundary](docs/design/research-events-port-audit.md)

## License

IkaKit is released under the GPL-3.0 license. See [LICENSE](LICENSE).

## Credits

Inspired by IkaEasy by vltansky.
