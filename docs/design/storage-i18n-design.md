# Storage And I18n Design

IkaKit stores small user preferences, alert state, language selection, and
cached game overview data in `browser.storage.local`.

## Storage Wrapper

`content/helpers/storage.js` wraps `browser.storage.local` for content modules.
It supports promise-style `browser.*` APIs and callback-style `chrome.*` APIs
through the runtime helper layer.

The wrapper exposes:

- `get(key, fallback)`
- `set(key, value)` and object-style set calls
- `remove(key)`

Runtime failures caused by extension reloads or invalidated contexts are
handled defensively so stale content scripts do not spam errors.

## Storage Keys

Current keys:

```text
ika_empire_active_tab
ika_alerts_active_tab
ika_alerts_position
ika_ui_language
ika_game_data_cache:<hostname>
ika_military_alert_settings
ika_military_alert_events
ika_notification_alert_settings
ika_game_events:background
```

Storage key ownership:

- Empire Manager owns `ika_empire_active_tab`.
- Alerts panel owns `ika_alerts_active_tab` and `ika_alerts_position`.
- Shared i18n owns `ika_ui_language`.
- Game data owns `ika_game_data_cache:<hostname>`.
- Military Alerts and background own military settings/events.
- Notification Alerts owns notification alert settings.
- Background owns `ika_game_events:background`.

New storage keys should use the `ika_` prefix and should be documented here
before they become part of a stable user state contract.

## I18n Runtime

Shared i18n files live in `src/shared/i18n/`.

- `messages.js` defines supported locales and message catalogs.
- `index.js` loads the selected language, stores language preference, exposes
  translation helpers, and notifies listeners when language changes.

Public API:

- `supportedLocales()`
- `getLanguage()`
- `loadLanguage()`
- `setLanguage(locale)`
- `onLanguageChange(listener)`
- `t(key, params)`

Language selection is stored in:

```text
ika_ui_language
```

## Locale Files

Manifest metadata also lives under `src/_locales/`. The source tree currently
includes multiple locale folders, while the README states English and
Vietnamese are maintained as full documentation languages.

New user-facing strings should be added to the shared i18n catalog when used in
runtime UI and to manifest locale files when they affect extension metadata.

## Cross-Browser API Design

IkaKit prefers `browser.*` APIs through `webextension-polyfill`, but code must
continue to tolerate Chromium callback APIs where the polyfill is unavailable
or a background context exposes `chrome.*`.

Design rules:

- Use shared runtime/storage helpers from content modules.
- Keep direct browser API use in modules narrow and justified.
- Handle extension context invalidation gracefully.
- Keep background wrappers local to `background/index.js` unless shared
  background modules are introduced later.
