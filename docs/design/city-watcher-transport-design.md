# City Watcher And Transport Helpers Design

City Watcher and Transport Helpers are small quality-of-life modules. They add
visible controls to existing Ikariam screens while keeping the player in charge
of every action.

## City Watcher

`content/modules/cityWatcher/index.js` renders building level circles and
upgrade readiness information on the town map.

Dependencies:

- `gameData` for selected city, resources, and building data.
- `navigation` for SPA page changes.
- `buildingCosts.js` for next-level cost estimates.
- `css/ikaeasy.css` for injected UI styles.

Expected behavior:

- Render only when the current view has a town-map surface.
- Show stable level indicators over buildings.
- Show cost and resource difference details in tooltips.
- Offer upgrade actions only when the selected city has enough resources.
- Re-render on game data changes, navigation changes, and relevant DOM changes.

Upgrade actions are explicit user actions and flow through the game data bridge.
City Watcher does not run construction automation or Auto Builder behavior.

## Transport Helpers

`content/modules/transport/index.js` enhances native transport forms with quick
amount controls. It is initialized with the current page name and refreshed on
navigation changes.

Expected behavior:

- Detect transport-related forms through the live DOM.
- Add quick amount controls without replacing native Ikariam inputs.
- Re-run enhancement after relevant DOM mutations.
- Avoid duplicate controls on repeated SPA renders.

## Empire Action Buttons

Empire Manager also exposes quick actions through `transportActions.js`:

- Resource transport
- Army deployment
- Fleet deployment

These buttons open the relevant native game flow through `gameData.openGameView`
and do not submit final game actions automatically.

## Product Boundary

Allowed:

- Show readiness, levels, and costs.
- Open native game pages or forms.
- Fill or assist visible forms when the player is present.
- Trigger native actions only from visible user clicks.

Not allowed in the current design:

- Background route scheduling.
- Auto-send resource flows.
- Construction automation.
- Auto Builder or Super Automate behavior.
- Hidden strategic decisions.
