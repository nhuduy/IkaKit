# IkaKit v1.0.1

Release date: 2026-06-26

## Highlights

- Updated the extension icon set.
- Added and refreshed design documentation, release guidance, browser support notes, and README demo references.
- Added runtime i18n foundations and localized the Empire Manager, Alerts, Military Alerts, Notification Alerts, notifications, and smaller UI surfaces.
- Added language settings for the Empire Manager, including a settings popover and normalized locale storage.
- Improved the Empire Manager layout to better align with IkaLabs and restored Empire resource filters.
- Added active game event storage, event relay coverage, and an embedded events tab.
- Added the Empire research overview and documented port boundaries for research and events.
- Added verification coverage for alert events, game events, research, and release manifest resources.

## Verification

- Version numbers are consistent across `package.json`, `package-lock.json`, `src/manifests/chrome.json`, and `src/manifests/firefox.json`.
- Chrome and Firefox production extension builds were generated from source.
- Generated build output was validated for manifest version, required runtime files, icons, locales, content scripts, and the browser polyfill.

## Release Assets

- `ikakit-chrome-v1.0.1.zip`
- `ikakit-firefox-v1.0.1.zip`
- `SHA256SUMS.txt`

## Recent Commits

- `2bb42ee` Update extension icon
- `8baefde` docs: add design documentation set
- `e8437d8` docs: document translation strategy
- `85ba588` docs: update README demo and browser support
- `31200a2` Normalize UI language locale storage
- `618773b` Restore Empire resource filters
- `c8aaa22` Align Empire layout with IkaLabs
- `e81e65b` Add Empire language settings popover
- `b980635` Fix Empire language change freeze
- `6da0fea` Add i18n locales and verification
- `77a69b4` Localize notifications and small UI surfaces
- `d2fa87c` Localize Notification Alerts UI
- `e2e90d9` Localize Military Alerts UI
- `db382da` Localize Alerts shell and events
- `baff193` Localize Empire Manager UI
- `ee62844` Add Empire language setting
- `15b55eb` Add runtime i18n foundation
- `fddc5e3` docs: refresh README and design roadmap
- `238aa1d` test(alert-events): verify embedded events tab
- `b5e170a` feat(alert-events): add events tab
