# Game Data Design

The game data layer reads Ikariam state by injecting a bridge script into the
page world. Content scripts cannot reliably inspect all page-owned globals from
the isolated extension world, so the bridge posts normalized payloads back to
the content runtime.

## Components

- `content/helpers/gameData.js`: content-world API, cache merge, subscriptions,
  and command helpers.
- `content/helpers/gameDataBridge.js`: page-world scanner and command receiver.
- `content/helpers/storage.js`: storage wrapper used for cached game data.

## Cache Behavior

`gameData.js` stores cached payloads under:

```text
ika_game_data_cache:<hostname>
```

Cache saves are delayed briefly to avoid writing on every small update. When a
cache exists, live payloads are merged with cached city details so overview
tables can render useful information before every city has been rescanned.

Merged city details include:

- Resources
- Buildings
- Military
- Gold
- Island metadata and trade goods
- Academy/scientist and research-related values
- Population, happiness, corruption, and growth values

## Page Bridge Message Contracts

The bridge and content runtime communicate through `window.postMessage` with
`__ikakit` message types.

Page-to-content messages:

- `gameData`: carries the normalized game payload.
- `militaryAdvisorHtml`: carries advisor HTML used by Military Alerts scanning.

Content-to-page messages:

- `requestCityScan`: asks the bridge to scan known cities; includes `force`.
- `requestResearchScan`: asks the bridge to scan research data; includes
  `force`.
- `requestMilitaryAdvisorScan`: asks the bridge to collect military advisor
  HTML.
- `openGameView`: opens a native Ikariam flow from structured params.
- `changeCity`: changes the selected city by city id.
- `upgradeBuilding`: requests a native building upgrade action.

Bridge messages are intentionally narrow. New message types should be named,
documented, and scoped to one feature contract.

## Public Content API

`gameData.js` exposes:

- `get()`
- `getCities()`
- `getSelectedCityId()`
- `getPlayerName()`
- `getDebug()`
- `onChange(listener)`
- `requestCityScan(force)`
- `requestResearchScan(force)`
- `openGameView(params)`
- `changeCity(cityId)`
- `upgradeBuilding(params)`

`onChange` immediately calls the listener when cached or live data already
exists.

## Scan Flow

City and research scans are user- or module-triggered. The bridge inspects page
state and relevant advisor data, posts `gameData`, and the content runtime then:

1. Merges live payload data with cached data.
2. Schedules cache persistence.
3. Computes a compact notification key.
4. Notifies subscribers only when meaningful data changed.

## Design Constraints

- Do not store account-scoped automation state in the game data cache.
- Do not use the bridge to make hidden strategic decisions.
- Avoid adding broad page commands when a narrow native action is enough.
- Any future bridge command that mutates game state needs explicit design
  review and visible user control.
