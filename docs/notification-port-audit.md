# Notification Port Audit

This note tracks the IkaLabs notification port into IkaKit.

## Source And Target

- Target repository: IkaKit.
- Target branch: `main`.
- Reference repository: `../IkaLabs`.
- IkaLabs is read-only for this port.

## In Scope

- Runtime-safe browser helpers needed by notification code.
- Existing Military Alerts upgrade path.
- Town News Notification Alert.
- Standalone Alerts UI for notification controls.
- Background notification routing, reminders, badge count, and test notification.

## Out Of Scope

- Automation Center.
- autoSendResource.
- Route Schedule.
- Construction Overview, Auto Builder, Automate, and Super Automate.
- Game Event Monitor UI.

## Commit Strategy

Each phase is implemented as exactly three commits:

1. Preparation or audit commit.
2. Implementation commit.
3. Verification or docs commit.

## Phase 1 Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- No Automation Center, auto-send resource, route schedule, or construction
  module references were added to IkaKit entrypoints, manifests, or modules.

## Phase 2 Background Contracts

The notification background router must support these content-script messages:

- `militaryEvents`: existing backward-compatible incoming hostile event path.
- `gameEvents`: minimal event relay used by Town News and upgraded Military
  Alerts, without porting the Game Event Monitor UI.
- `notificationAlertTest`: diagnostic desktop notification for the Alerts UI.
- `clearMilitaryAlertTests`: optional cleanup for test Military Alerts.

The router must keep all visible strings branded as IkaKit and must not import or
initialize automation modules.
