# IkaKit

IkaKit is a community-built browser extension for Ikariam. It adds empire
management tools and small quality-of-life improvements directly inside the
game interface.

The extension supports Chrome/Chromium and Firefox through WebExtension
Manifest V3, content scripts, a background script, and `webextension-polyfill`.

Vietnamese documentation: [README.vi.md](README.vi.md)

## Features

- Empire Manager modal injected into Ikariam.
- City overview tabs for:
  - Resources: goods, housing, research, and corruption.
  - Buildings: building levels, upgrades, and next-level costs.
  - Military: land units and ships by city.
  - Espionage: hideout, academy, and workshop levels.
- City data scanner and local cache for faster empire overview rendering.
- Quick action buttons for resource transport, army deployment, and fleet
  deployment.
- Quick amount buttons on transport forms.
- SPA navigation tracking so the UI can refresh when Ikariam changes views.
- English and Vietnamese extension metadata.

## Requirements

- Node.js
- npm

Install dependencies:

```bash
npm install
```

## Build

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

Build output is written to:

```text
dist/chrome/
dist/firefox/
```

## Load The Extension Locally

### Chrome / Chromium

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `dist/chrome`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select `dist/firefox/manifest.json`.

## Project Structure

```text
src/
  manifests/          Browser-specific manifests
  background/         Background script
  content/            Content scripts injected into Ikariam
    helpers/          Storage, navigation, and game data bridge helpers
    modules/
      empire/         Empire Manager and overview tabs
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
main entry point starts the Empire Manager, transport helpers, navigation
watcher, and game data layer.

The game data layer injects a bridge script into the page context, reads
available Ikariam data, merges it with cached city details, and notifies the UI
when the overview should refresh.

## License

IkaKit is released under the GPL-3.0 license. See [LICENSE](LICENSE).

## Credits

Inspired by IkaEasy by vltansky.
