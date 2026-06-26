# WebExtension Architecture

IkaKit is a Manifest V3 WebExtension built from one source tree into Chrome and
Firefox outputs. Runtime code uses `webextension-polyfill` where possible and
falls back to callback-style browser APIs where needed.

## Source Layout

- `src/manifests/chrome.json`: Chrome/Chromium manifest.
- `src/manifests/firefox.json`: Firefox manifest.
- `src/content/loader.js`: classic content-script entry point.
- `src/content/init.js`: ES module content runtime.
- `src/background/index.js`: background service worker for Chrome and module
  background script for Firefox.
- `src/shared/i18n/`: shared language catalog and translation helper.
- `src/css/ikaeasy.css`: injected UI styles.
- `src/assets/`: extension icons and UI images.

## Manifest Design

Both manifests match Ikariam pages under:

```text
http://*.ikariam.gameforge.com/*
https://*.ikariam.gameforge.com/*
```

Both manifests declare:

- `storage` for settings, language, cached game data, and event state.
- `tabs` for opening or focusing game flows when needed.
- `notifications` for desktop alert delivery.
- `alarms` for military reminders and cleanup.
- `host_permissions` for Ikariam hosts.
- `web_accessible_resources` for content modules, shared i18n files, images,
  icons, styles, and bridge scripts.

The Chrome manifest uses:

- `background.service_worker`
- `background.type = "module"`

The Firefox manifest uses:

- `background.scripts`
- `background.type = "module"`
- `browser_specific_settings.gecko`

## Content Entry Flow

Chromium content scripts are not reliable as direct ES modules in this project,
so `content/loader.js` is intentionally classic JavaScript. It loads the real
module graph through:

```js
import(browser.runtime.getURL('content/init.js'))
```

This keeps the manifest simple while allowing the implementation to use ES
modules after the loader starts.

## Background Runtime

`background/index.js` owns browser-level behavior that should not run directly
in the page:

- Desktop notification creation.
- Extension badge text and badge color.
- Alarm scheduling for military reminders and cleanup.
- Background persistence for military and game events.
- Cross-browser wrapper functions for promise and callback APIs.

The background runtime accepts only IkaKit-scoped runtime messages. Current
message contracts are documented in
[Alerts And Notifications Design](alerts-notifications-design.md).

## Web Accessible Resources

The manifests expose content modules and helper files as web accessible because
the loader dynamically imports them through extension URLs. The game data bridge
also needs to be loadable into the page world so it can inspect Ikariam page
state that isolated content scripts cannot access directly.

## Security Boundary

- Extension code should not expose privileged browser APIs to the page context.
- Page-world bridge communication must use explicit `__ikakit` message types.
- User-facing strings should be loaded through the shared i18n layer.
- Future features that require broader host access or persistent account state
  need a design review before manifest permissions are expanded.
