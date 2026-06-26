# IkaKit

IkaKit is a community-built browser extension for Ikariam. It adds empire
management tools and small quality-of-life improvements directly inside the
game interface.

The extension supports Chrome/Chromium and Firefox through WebExtension
Manifest V3, content scripts, a background script, and `webextension-polyfill`.

Vietnamese documentation: [README.vi.md](README.vi.md)

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

The README currently documents 14 feature areas:

1. Empire Manager modal injected directly into the Ikariam interface.
2. Resources overview by city, including goods, housing, research, and
   corruption.
3. Buildings overview by city, including building levels, upgrade state, and
   next-level costs.
4. Military overview by city, including land units and ships.
5. Espionage overview by city, including hideout, academy, and workshop levels.
6. City data scanner for collecting city details from the game interface.
7. Local city data cache for faster empire overview rendering.
8. Quick action buttons for resource transport, army deployment, and fleet
   deployment.
9. Quick amount buttons on transport forms.
10. Click a city name in Empire Manager to jump directly to that city.
11. Construction Upgrade Watcher on the town map: shows per-building level
    circles, next-level cost/difference tooltips, and one-click upgrade when the
    city has enough resources.
12. SPA navigation tracking so the UI can refresh when Ikariam changes views.
13. Alerts panel with Military Alerts settings, incoming hostile severity,
    in-game warning panel, desktop notifications, extension badge count, and
    reminder controls.
14. Town News Notification Alert for detecting espionage and military reports
    that have already appeared in rendered Town News, with scan, clear, and test
    notification controls.

The extension also includes English and Vietnamese extension metadata.

This notification port does not include Automation Center, Route Schedule,
auto-send resource flows, or construction automation/Auto Builder features.

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
      alerts/         Standalone Alerts panel
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
available Ikariam data, merges it with cached city details, and notifies the UI
when the overview should refresh.

Desktop notifications are sent by the extension background script. If alerts are
detected but no system notification appears, check the browser and operating
system notification permissions for the extension.

## License

IkaKit is released under the GPL-3.0 license. See [LICENSE](LICENSE).

## Credits

Inspired by IkaEasy by vltansky.
