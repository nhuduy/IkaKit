# Build And Release Design

IkaKit builds Chrome/Chromium and Firefox extension outputs from the same
`src/` tree.

## Build Commands

```bash
npm run build:chrome
npm run build:firefox
npm run build
```

Outputs:

```text
dist/chrome/
dist/firefox/
```

## Build Script

`scripts/build.js` accepts one argument:

```bash
node scripts/build.js <chrome|firefox>
```

Build behavior:

1. Remove the target `dist/<browser>/` directory.
2. Copy `src/` into the target output while excluding `src/manifests/`.
3. Copy the browser-specific manifest to `manifest.json`.
4. Copy `webextension-polyfill` to `libs/browser-polyfill.min.js` when present.

The build script does not bundle or transpile modules. Runtime files remain ES
modules loaded by the extension.

## Manifest Differences

Chrome/Chromium:

- Uses `background.service_worker`.
- Uses module service worker configuration.

Firefox:

- Uses `background.scripts`.
- Includes Gecko-specific extension settings and minimum version.

Both targets share permissions, host permissions, content scripts, assets,
content modules, CSS, and shared i18n files.

## Release Checks

Before packaging or publishing:

- Run `npm run build:chrome`.
- Run `npm run build:firefox`.
- Confirm README links point to existing docs and assets.
- Confirm manifests expose all dynamically imported content modules.
- Confirm no excluded automation modules or IkaLabs-branded user-facing strings
  are introduced.
- Confirm screenshots do not expose account names, server details, alliances,
  coordinates, or private game state.

## Documentation Checks

Design docs should stay aligned with code. When adding a feature that changes
runtime messages, storage keys, bridge commands, manifest permissions, or major
module ownership, update the relevant file in `docs/design/` in the same change.
