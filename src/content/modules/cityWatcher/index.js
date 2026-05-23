// IkaKit — city building level watcher.
// Adds IkaEasy-style upgrade circles directly on the town map.

import { Buildings } from '../../const.js';
import gameData from '../../helpers/gameData.js';
import navigation from '../../helpers/navigation.js';
import BUILDING_COSTS from '../empire/buildingCosts.js';

const WATCHER_ID = 'ika-city-watchers';
const UPDATE_DELAY = 80;
const BUILDING_TYPES = Object.freeze(new Set(Object.values(Buildings)));

const BUILDING_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(Buildings).map(([label, type]) => [type, labelFromKey(label)])),
);

const COST_REDUCERS = Object.freeze({
  wood: 'carpentering',
  marble: 'architect',
  wine: 'vineyard',
  glass: 'optician',
  sulfur: 'fireworker',
});

const BUILDING_OFFSETS = Object.freeze({
  palace: [40, 20],
  palaceColony: [40, 30],
  academy: [50, 20],
  townHall: [50, 30],
  architect: [40, 25],
  safehouse: [40, 25],
  wall: [90, 0],
  shipyard: [60, 40],
  port: [85, 42],
  glassblowing: [50, 20],
  warehouse: [40, 25],
  museum: [45, 20],
  workshop: [30, 25],
  forester: [10, 20],
  optician: [43, 20],
  barracks: [50, 20],
  carpentering: [50, 20],
  embassy: [40, 20],
  stonemason: [50, 23],
  fireworker: [50, 25],
  winegrower: [50, 30],
  vineyard: [50, 30],
  tavern: [40, 20],
  alchemist: [50, 20],
  branchOffice: [50, 30],
  temple: [26, 30],
  dump: [37, 20],
  pirateFortress: [32, 73],
  blackMarket: [50, 20],
  marineChartArchive: [55, 20],
  dockyard: [240, 118],
  shrineOfOlympus: [55, 20],
  constructionSite: [65, 20],
});

const BUILDING_TEXT_ALIASES = Object.freeze({
  townhall: 'townHall',
  town: 'townHall',
  palace: 'palace',
  governorsresidence: 'palaceColony',
  governorresidence: 'palaceColony',
  tavern: 'tavern',
  museum: 'museum',
  academy: 'academy',
  workshop: 'workshop',
  temple: 'temple',
  embassy: 'embassy',
  warehouse: 'warehouse',
  depot: 'dump',
  dump: 'dump',
  tradingport: 'port',
  port: 'port',
  tradingpost: 'branchOffice',
  branchoffice: 'branchOffice',
  blackmarket: 'blackMarket',
  marinechartarchive: 'marineChartArchive',
  dockyard: 'dockyard',
  townwall: 'wall',
  wall: 'wall',
  hideout: 'safehouse',
  safehouse: 'safehouse',
  barracks: 'barracks',
  shipyard: 'shipyard',
  piratefortress: 'pirateFortress',
  forester: 'forester',
  forestershouse: 'forester',
  carpenter: 'carpentering',
  carpentershouse: 'carpentering',
  winery: 'winegrower',
  winegrower: 'winegrower',
  winepress: 'vineyard',
  stonemason: 'stonemason',
  architect: 'architect',
  architectsoffice: 'architect',
  glassblower: 'glassblowing',
  glassblowing: 'glassblowing',
  optician: 'optician',
  alchemiststower: 'alchemist',
  fireworktestarea: 'fireworker',
});

let _started = false;
let _timer = null;
let _observer = null;
let _lastRenderKey = '';

function injectStyles() {
  if (document.getElementById('ika-city-watcher-style') || document.getElementById('ika-empire-style')) {
    return;
  }

  const link = document.createElement('link');
  link.id = 'ika-city-watcher-style';
  link.rel = 'stylesheet';
  link.href = browser.runtime.getURL('css/ikaeasy.css');
  document.head.appendChild(link);
}

function labelFromKey(key) {
  return key
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getSelectedCity(data) {
  const selectedCityId = Number(data?.selectedCityId ?? gameData.getSelectedCityId());
  const cities = Array.isArray(data?.cities) ? data.cities : gameData.getCities();

  if (!Number.isFinite(selectedCityId) || !Array.isArray(cities)) {
    return null;
  }

  return cities.find((city) => Number(city?.id) === selectedCityId) ?? null;
}

function getCurrentPageCityId() {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('cityId'));
  if (Number.isFinite(fromUrl) && fromUrl > 0) {
    return fromUrl;
  }

  const fromChangeForm = Number(document.querySelector('#js_cityIdOnChange, input[name="cityId"]')?.value);
  if (Number.isFinite(fromChangeForm) && fromChangeForm > 0) {
    return fromChangeForm;
  }

  const cityLink = document.querySelector('a[href*="cityId="]');
  const fromCityLink = Number(cityLink ? new URL(cityLink.href, window.location.href).searchParams.get('cityId') : null);
  return Number.isFinite(fromCityLink) && fromCityLink > 0 ? fromCityLink : null;
}

function parseAmount(value) {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  const match = raw.match(/-?\d+(?:\.\d+)?\s*([kmb])?/i);

  if (!match) {
    return null;
  }

  const number = Number(match[0].replace(/[kmb]/i, ''));
  const suffix = (match[1] || '').toLowerCase();
  const multiplier = suffix === 'b' ? 1000000000 : suffix === 'm' ? 1000000 : suffix === 'k' ? 1000 : 1;

  return Number.isFinite(number) ? Math.floor(number * multiplier) : null;
}

function readDomResource(resource, selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const amount = parseAmount(element?.getAttribute?.('title') || element?.textContent);

    if (amount !== null) {
      return [resource, amount];
    }
  }

  return null;
}

function readDomResources() {
  const entries = [
    readDomResource('wood', ['#resources_wood', '#resource_wood', '.resources .wood']),
    readDomResource('wine', ['#resources_wine', '#resource_wine', '.resources .wine']),
    readDomResource('marble', ['#resources_marble', '#resource_marble', '.resources .marble']),
    readDomResource('glass', ['#resources_crystal', '#resources_glass', '#resource_crystal', '#resource_glass', '.resources .crystal', '.resources .glass']),
    readDomResource('sulfur', ['#resources_sulfur', '#resource_sulfur', '.resources .sulfur']),
  ].filter(Boolean);

  return entries.length ? Object.fromEntries(entries) : null;
}

function getBuildingLevel(buildingData) {
  if (typeof buildingData === 'number') {
    return buildingData;
  }

  if (!buildingData || typeof buildingData !== 'object') {
    return null;
  }

  const level = Number(buildingData.level ?? buildingData.currentLevel ?? buildingData.buildingLevel);
  return Number.isFinite(level) ? level : null;
}

function isBuildingUpgrading(buildingData) {
  if (!buildingData || typeof buildingData !== 'object') {
    return false;
  }

  const completed = Number(buildingData.completed);
  if (Number.isFinite(completed) && completed > 0) {
    return completed * 1000 > Date.now();
  }

  return Boolean(
    buildingData.isUpgrading
      ?? buildingData.upgrading
      ?? buildingData.inUpgrade
      ?? buildingData.underConstruction
      ?? buildingData.upgradeEndTime
      ?? buildingData.upgradeFinishTime,
  );
}

function getBuildingPosition(buildingData) {
  if (!buildingData || typeof buildingData !== 'object') {
    return null;
  }

  const position = Number(buildingData.position);
  return Number.isFinite(position) ? position : null;
}

function getBuildingName(type, buildingData) {
  return buildingData?.name || BUILDING_LABELS[type] || labelFromKey(type);
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function typeFromPositionElement(element) {
  const tokens = String(element?.className ?? '')
    .split(/\s+/)
    .map((token) => token.replace(/^building_/, '').replace(/^building-/, ''));

  for (const token of tokens) {
    if (BUILDING_TYPES.has(token)) {
      return token;
    }
  }

  const textType = BUILDING_TEXT_ALIASES[normalizeText([
    element?.getAttribute?.('title'),
    element?.getAttribute?.('aria-label'),
    element?.textContent,
  ].filter(Boolean).join(' '))];

  if (textType) {
    return textType;
  }

  const text = normalizeText([
    element?.getAttribute?.('title'),
    element?.getAttribute?.('aria-label'),
    element?.textContent,
  ].filter(Boolean).join(' '));

  return Object.entries(BUILDING_TEXT_ALIASES).find(([alias]) => text.includes(alias))?.[1] ?? null;
}

function levelFromPositionElement(element) {
  const text = [
    element?.getAttribute?.('title'),
    element?.getAttribute?.('aria-label'),
    element?.textContent,
    element?.className,
  ].filter(Boolean).join(' ');
  const parenthetical = text.match(/\((\d+)\)/);
  const classLevel = text.match(/(?:level|lvl)[_-]?(\d+)/i);
  const loose = text.match(/(?:^|[^0-9])(\d{1,3})(?:[^0-9]|$)/);
  const level = Number(parenthetical?.[1] ?? classLevel?.[1] ?? loose?.[1]);

  return Number.isFinite(level) && level > 0 ? level : null;
}

function getBuildingData(city, buildingType) {
  const buildingData = city?.buildings?.[buildingType] ?? null;
  return Array.isArray(buildingData) ? buildingData[0] ?? null : buildingData;
}

function getResourceAmount(city, key) {
  const value = city?.resources?.[key] ?? city?.[key];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getDiscount(city, resource) {
  const reducer = getBuildingData(city, COST_REDUCERS[resource]);
  const reducerLevel = getBuildingLevel(reducer);

  if (!Number.isFinite(reducerLevel) || reducerLevel <= 0) {
    return 1;
  }

  return Math.max(0, 1 - reducerLevel / 100);
}

function getNextLevelCost(city, type, buildingData) {
  const level = getBuildingLevel(buildingData);
  const costs = BUILDING_COSTS[type];

  if (!Number.isFinite(level) || !Array.isArray(costs)) {
    return null;
  }

  const targetLevel = isBuildingUpgrading(buildingData) ? level + 1 : level;
  const rawCost = costs[targetLevel];

  if (!rawCost) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(rawCost)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([resource, amount]) => [
        resource,
        Math.floor(Number(amount) * getDiscount(city, resource)),
      ]),
  );
}

function getCostRows(city, type, buildingData) {
  const cost = getNextLevelCost(city, type, buildingData);

  if (!cost || !Object.keys(cost).length) {
    return [];
  }

  return Object.entries(cost).map(([resource, amount]) => {
    const current = getResourceAmount(city, resource);
    return {
      resource,
      amount,
      difference: current - amount,
      enough: current >= amount,
    };
  });
}

function flattenBuildings(city) {
  const buildings = city?.buildings ?? {};
  const result = [];

  Object.entries(buildings).forEach(([type, value]) => {
    const entries = Array.isArray(value) ? value : [value];
    entries.forEach((buildingData) => {
      const level = getBuildingLevel(buildingData);
      const position = getBuildingPosition(buildingData);

      if (!Number.isFinite(level) || position === null) {
        return;
      }

      result.push({ type, buildingData, level, position });
    });
  });

  return result;
}

function flattenDomBuildings() {
  return Array.from(document.querySelectorAll('#locations [id^="position"]'))
    .map((element) => {
      const position = Number(String(element.id).replace('position', ''));
      const type = typeFromPositionElement(element);
      const level = levelFromPositionElement(element);

      if (!Number.isFinite(position) || !type || !Number.isFinite(level)) {
        return null;
      }

      return {
        type,
        level,
        position,
        buildingData: {
          level,
          position,
          building: type,
          name: getBuildingName(type, null),
        },
      };
    })
    .filter(Boolean);
}

function number(value) {
  return Number(value).toLocaleString();
}

function makeEl(tagName, className, text = '') {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function createTooltip(city, item, rows, canUpgrade) {
  const tooltip = makeEl('div', 'ika-city-watcher-tooltip');
  const title = makeEl('button', 'ika-city-watcher-title', `${getBuildingName(item.type, item.buildingData)} ${item.level}`);
  const buttons = makeEl('div', 'ika-city-watcher-buttons');
  const upgrade = makeEl('button', 'ika-city-watcher-upgrade');
  const downgrade = makeEl('button', 'ika-city-watcher-downgrade');
  const table = makeEl('table', rows.some((row) => !row.enough) ? 'ika-city-watcher-insufficient' : '');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const header = document.createElement('tr');

  title.type = 'button';
  title.addEventListener('click', () => openBuilding(city, item));

  upgrade.type = 'button';
  upgrade.title = canUpgrade ? 'Upgrade' : 'Not enough resources';
  upgrade.disabled = !canUpgrade;
  upgrade.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!canUpgrade) return;
    gameData.upgradeBuilding({
      cityId: city.id,
      currentCityId: city.id,
      position: item.position,
      level: item.level,
      backgroundView: 'city',
    });
  });

  downgrade.type = 'button';
  downgrade.title = 'Downgrade';
  downgrade.disabled = true;

  buttons.append(upgrade, downgrade);
  ['', 'Cost', 'Difference'].forEach((text) => header.appendChild(makeEl('th', '', text)));
  thead.appendChild(header);

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    if (!row.enough) tr.className = 'ika-city-watcher-missing';

    const iconCell = document.createElement('td');
    iconCell.appendChild(makeEl('span', `ika-city-watcher-resource ika-city-watcher-resource-${row.resource}`));
    tr.append(
      iconCell,
      makeEl('td', '', number(row.amount)),
      makeEl('td', '', number(row.difference)),
    );
    tbody.appendChild(tr);
  });

  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = makeEl('td', 'ika-city-watcher-final', 'Max level');
    cell.colSpan = 3;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  table.append(thead, tbody);
  tooltip.append(title, buttons, table);

  return tooltip;
}

function openBuilding(city, item) {
  gameData.openGameView({
    view: item.type,
    cityId: city.id,
    position: item.position,
    backgroundView: 'city',
    currentCityId: city.id,
  });
}

function createWatcher(city, item, cityIsBusy) {
  const positionEl = document.querySelector(`#position${item.position}`);

  if (!positionEl) {
    return null;
  }

  const rows = getCostRows(city, item.type, item.buildingData);
  const isUpgrading = isBuildingUpgrading(item.buildingData);
  const canUpgrade = rows.length > 0 && rows.every((row) => row.enough) && !isUpgrading;
  const state = isUpgrading
    ? 'upgrading'
    : (!rows.length ? 'final' : (canUpgrade ? (cityIsBusy ? 'queued' : 'enough') : 'missing'));
  const offset = BUILDING_OFFSETS[isUpgrading ? 'constructionSite' : item.type] ?? [40, 20];
  const watcher = makeEl('div', 'ika-city-watcher');
  const circle = makeEl('button', 'ika-city-watcher-circle', String(item.level));

  watcher.dataset.state = state;
  watcher.style.left = `${positionEl.offsetLeft + offset[0]}px`;
  watcher.style.top = `${positionEl.offsetTop + offset[1]}px`;
  circle.type = 'button';
  circle.addEventListener('click', () => openBuilding(city, item));

  watcher.append(circle, createTooltip(city, item, rows, canUpgrade));
  return watcher;
}

function render(data = gameData.get()) {
  clearTimeout(_timer);

  const worldmap = document.getElementById('worldmap');
  const locations = document.getElementById('locations');
  const selectedCity = getSelectedCity(data);

  if (!worldmap || !locations) {
    document.getElementById(WATCHER_ID)?.remove();
    _lastRenderKey = '';
    return;
  }

  const domBuildings = flattenDomBuildings();
  const pageCityId = getCurrentPageCityId();
  const city = {
    ...(selectedCity ?? {}),
    id: pageCityId ?? selectedCity?.id ?? gameData.getSelectedCityId(),
    resources: readDomResources(),
  };
  city.resources = {
    ...(readDomResources() ?? {}),
    ...(city.resources ?? {}),
  };
  const buildings = city?.buildings ? flattenBuildings(city) : domBuildings;

  const renderKey = JSON.stringify({
    cityId: city.id,
    updatedAt: city.updatedAt,
    buildings: city.buildings ?? domBuildings,
    resources: city.resources,
    left: locations.offsetLeft,
    top: locations.offsetTop,
    width: locations.offsetWidth,
    height: locations.offsetHeight,
    busy: Boolean(locations.querySelector('.constructionSite')),
  });

  if (renderKey === _lastRenderKey && document.getElementById(WATCHER_ID)) {
    return;
  }

  _lastRenderKey = renderKey;

  const overlay = makeEl('div', '');
  overlay.id = WATCHER_ID;
  overlay.style.left = `${locations.offsetLeft}px`;
  overlay.style.top = `${locations.offsetTop}px`;
  overlay.style.width = `${locations.offsetWidth}px`;
  overlay.style.height = `${locations.offsetHeight}px`;

  const cityIsBusy = Boolean(locations.querySelector('.constructionSite'));
  buildings.forEach((item) => {
    const watcher = createWatcher(city, item, cityIsBusy);
    if (watcher) overlay.appendChild(watcher);
  });

  document.getElementById(WATCHER_ID)?.remove();

  if (overlay.childElementCount) {
    worldmap.appendChild(overlay);
  }
}

function scheduleRender(data) {
  clearTimeout(_timer);
  _timer = setTimeout(() => render(data), UPDATE_DELAY);
}

const cityWatcher = Object.freeze({
  init() {
    if (_started) return;
    _started = true;

    injectStyles();
    gameData.onChange(scheduleRender);
    navigation.onChange(() => scheduleRender(gameData.get()));

    _observer = new MutationObserver(() => scheduleRender(gameData.get()));
    _observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleRender(gameData.get());
  },
});

export default cityWatcher;
