# Alerts And Notifications Design

IkaKit alerts are split between content modules that detect and render events
and the background runtime that owns browser notifications, badges, persistence,
and alarms.

## Alert Surfaces

### Alerts Panel

`content/modules/alerts/index.js` owns the Alerts modal shell. Current tabs:

- Military Alerts
- Town News
- Events

Stored UI state:

```text
ika_alerts_active_tab
ika_alerts_position
```

### Military Alerts

`content/modules/militaryAlerts/index.js` detects incoming military activity,
normalizes settings, renders controls, and emits compact events.

Settings key:

```text
ika_military_alert_settings
```

Background event key:

```text
ika_military_alert_events
```

### Town News Notification Alert

`content/modules/notificationAlerts/index.js` scans rendered Town News reports,
deduplicates recent alerts, renders controls, and emits compact events.

Settings key:

```text
ika_notification_alert_settings
```

### Events Tab

`content/modules/alerts/events.js` renders active in-memory events from
`gameEvents.getActiveEvents()`.

Supported filters:

- `all`
- `military`
- `townNews`
- `game`

The Events tab can refresh, copy JSON, and clear the compact in-memory store.
It does not clear account-level game state or automation state.

## Content Event Store

`content/helpers/gameEvents.js` stores compact active events in memory.

Public API:

- `emit(event)`
- `emitMany(events)`
- `on(listener)`
- `onChange(listener)`
- `getActiveEvents()`
- `toJSON()`
- `clear()`

Only newly inserted active events are relayed to the background notification
path. The store prunes expired events and caps retained events.

## Runtime Message Contracts

Content-to-background messages use `runtime.sendMessage` with `__ikakit`.

Current background message types:

- `gameEvents`: relay newly detected compact game events.
- `clearGameEvents`: clear background game event state.
- `notificationAlertTest`: request a diagnostic desktop notification.
- `militaryEvents`: legacy-compatible military event path.
- `clearMilitaryAlertTests`: cleanup test Military Alerts.

Background persisted game events use:

```text
ika_game_events:background
```

## Badge And Alarm Behavior

The background runtime:

- Classifies military severity by remaining arrival time and event type.
- Sets extension badge text and color from active military events.
- Schedules reminder alarms at 15, 5, and 1 minutes before arrival when enabled.
- Schedules cleanup alarms for stale military events.
- Refreshes badge state on install, update, startup, alarm, and settings change.

## Notification Design

Desktop notifications should be useful and sparse. They are controlled by user
settings and browser/OS notification permissions.

Notification strings must be IkaKit-branded and loaded through i18n where they
are user-facing.

## Exclusions

This alert design does not include:

- Automation Center
- Floating Game Event launcher
- Route Schedule
- Construction locks
- Builder/resource support UI
- Automation wake behavior
- Account-scoped automation state
