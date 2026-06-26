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
- Background notification routing, reminders, badge count, and test
  notification.

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

The router must keep all visible strings branded as IkaKit and must not import
or initialize automation modules.

## Phase 2 Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- Background routing now handles `militaryEvents`, `gameEvents`,
  `notificationAlertTest`, and `clearMilitaryAlertTests`.
- Background, entrypoint, and manifests contain no Automation Center,
  auto-send, route schedule, construction, or IkaLabs references.

## Phase 3 Military Alerts Dependencies

- Keep the Military Alerts DOM/advisor parser and incoming hostile behavior.
- Add local Military Alerts settings constants in the module instead of
  importing the IkaLabs settings panel.
- Use the minimal game event emitter helper, not the Game Event Monitor UI.
- Rename any reused `automation-*` panel classes to notification/alerts classes
  in IkaKit.

## Phase 3 Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- Military Alerts initializes without Automation Center or settings panel
  imports.
- Military Alerts, helpers, background, manifests, and alert CSS contain no
  IkaLabs or automation module references.

## Phase 4 Town News Extraction

- Port only the Town News parsing, dedupe, alert history, settings, and test
  notification behavior.
- Expose an independent module API: `init`, `renderPanel`, and `getStatus`.
- Remove Automation Center render hooks and rename automation-specific state or
  classes to Alerts panel equivalents.

## Phase 4 Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- Town News Notification Alert has dedupe via `seenKeys`, caps recent alerts at
  `MAX_RECENT`, and routes test notifications through `notificationAlertTest`.
- Town News mutation scanning ignores IkaKit alert UI mutations and contains no
  IkaLabs or automation module references.

## Phase 5 Standalone Alerts UI

- Add a standalone `Alerts` menu slot or fallback FAB.
- Host exactly two tabs for this port: Military Alerts and Town News.
- Use `renderPanel` from the two alert modules and avoid Automation Center.
- Keep modal selectors under `ika-alerts-*` so Town News can ignore its own UI
  mutations.

## Phase 5 Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- Alerts UI wires `Alerts` button/FAB, tab switching, and `ika-alerts-modal`.
- Alerts UI contains no IkaLabs or automation module references.
- Manifest web-accessible resource additions are intentionally left for Phase 6.

## Phase 6 Final Verification

- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
- Manifests expose the new Alerts and Notification Alert module paths while
  keeping IkaKit metadata.
- Source and README files contain no Automation Center, auto-send resource,
  route schedule, construction automation, or IkaLabs references.
- The port is represented by 18 commits on `main`.
