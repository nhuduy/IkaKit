// IkaKit — Empire buildings table
// Render level công trình của từng thành phố theo danh sách Buildings.

import { Buildings } from '../../const.js';
import gameData from '../../helpers/gameData.js';
import BUILDING_COSTS from './buildingCosts.js';
import { appendResourceTransportCell, appendTransportHeader } from './transportActions.js';
import { appendCityCell, appendCityHeader } from './cityCell.js';

const BUILDING_COLUMNS = Object.freeze(Object.entries(Buildings));
const MULTIPLE_BUILDINGS = Object.freeze({
  warehouse: true,
  port: true,
  shipyard: true,
});
const BUILDING_SPRITE = 'assets/images/empire/buildingbutton_sprite.jpg';
const BUILDING_ICON_SCALE = 0.52;
const BUILDING_SPRITE_WIDTH = 1340;
const BUILDING_SPRITE_HEIGHT = 82;
const COST_REDUCERS = Object.freeze({
  wood: 'carpentering',
  marble: 'architect',
  wine: 'vineyard',
  glass: 'optician',
  sulfur: 'fireworker',
});
const BUILDING_ICON_POSITIONS = Object.freeze({
  townHall: 0,
  academy: -43,
  warehouse: -86,
  tavern: -129,
  palace: -172,
  palaceColony: -215,
  museum: -258,
  port: -301,
  shipyard: -345,
  barracks: -388,
  wall: -431,
  embassy: -474,
  branchOffice: -517,
  workshop: -560,
  safehouse: -603,
  forester: -646,
  glassblowing: -689,
  alchemist: -733,
  winegrower: -776,
  stonemason: -819,
  carpentering: -862,
  optician: -905,
  fireworker: -948,
  vineyard: -991,
  architect: -1034,
  temple: -1077,
  dump: -1121,
  pirateFortress: -1164,
  blackMarket: -1207,
  dockyard: -1250,
  marineChartArchive: -1297,
});

function resolveContainer(container) {
  return typeof container === 'string' ? document.querySelector(container) : container;
}

function labelFromKey(key) {
  return key
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getBuildingData(city, buildingType, index = 0) {
  const buildings = city?.buildings ?? {};
  const buildingData = buildings[buildingType] ?? buildings[String(buildingType)] ?? null;

  if (Array.isArray(buildingData)) {
    return buildingData[index] ?? null;
  }

  return index === 0 ? buildingData : null;
}

function getBuildingCount(city, buildingType) {
  const buildings = city?.buildings ?? {};
  const buildingData = buildings[buildingType] ?? buildings[String(buildingType)] ?? null;

  return Array.isArray(buildingData) ? buildingData.length : (buildingData ? 1 : 0);
}

function getColumnSlots(cities, buildingType) {
  if (!MULTIPLE_BUILDINGS[buildingType]) {
    return 1;
  }

  return Math.max(
    1,
    ...cities.map((city) => getBuildingCount(city, buildingType)),
  );
}

function getExpandedColumns(cities) {
  return BUILDING_COLUMNS.flatMap(([key, buildingType]) => {
    const slots = getColumnSlots(cities, buildingType);
    return Array.from({ length: slots }, (_, index) => ({
      key,
      buildingType,
      index,
    }));
  });
}

function getLevel(buildingData) {
  if (typeof buildingData === 'number') {
    return buildingData;
  }

  if (!buildingData || typeof buildingData !== 'object') {
    return null;
  }

  return buildingData.level ?? buildingData.currentLevel ?? buildingData.buildingLevel ?? null;
}

function isUpgrading(buildingData) {
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

function getPosition(buildingData) {
  if (!buildingData || typeof buildingData !== 'object') {
    return null;
  }

  const position = Number(buildingData.position);
  return Number.isFinite(position) ? position : null;
}

function getResourceAmount(city, key) {
  const value = city?.resources?.[key] ?? city?.[key];
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getDiscount(city, resource) {
  const reducer = getBuildingData(city, COST_REDUCERS[resource]);
  const reducerLevel = Number(getLevel(reducer));

  if (!Number.isFinite(reducerLevel) || reducerLevel <= 0) {
    return 1;
  }

  return Math.max(0, 1 - (reducerLevel / 100));
}

function getNextLevelCost(city, buildingType, buildingData) {
  const rawLevel = getLevel(buildingData);
  const level = Number(rawLevel);
  const costs = BUILDING_COSTS[buildingType];

  if (!Number.isFinite(level) || !Array.isArray(costs)) {
    return null;
  }

  const targetIndex = isUpgrading(buildingData) ? level + 1 : level;
  const rawCost = costs[targetIndex];

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

function getUpgradeState(city, buildingType, buildingData) {
  const cost = getNextLevelCost(city, buildingType, buildingData);
  const hasCostTable = Array.isArray(BUILDING_COSTS[buildingType]);

  if (isUpgrading(buildingData)) {
    return 'upgrading';
  }

  if (!hasCostTable) {
    if (buildingData?.canUpgrade === true) {
      return 'enough';
    }
    if (buildingData?.canUpgrade === false) {
      return 'missing';
    }
  }

  if (buildingData?.isMaxLevel || !cost || !Object.keys(cost).length) {
    return 'final';
  }

  return Object.entries(cost).every(([resource, amount]) => getResourceAmount(city, resource) >= amount)
    ? 'enough'
    : 'missing';
}

function formatBuilding(buildingData) {
  const rawLevel = getLevel(buildingData);
  if (rawLevel === null || typeof rawLevel === 'undefined' || rawLevel === '') {
    return '—';
  }

  const level = Number(rawLevel);

  if (!Number.isFinite(level)) {
    return '—';
  }

  // Nếu gameData đánh dấu đang upgrade, hiển thị level hiện tại sang level kế.
  return isUpgrading(buildingData) ? `${level} → ${level + 1}` : String(level);
}

function formatBuildingTitle(city, buildingType, buildingData) {
  const cost = getNextLevelCost(city, buildingType, buildingData);

  if (!cost || !Object.keys(cost).length) {
    return 'Max level';
  }

  return Object.entries(cost)
    .map(([resource, amount]) => `${resource}: ${amount.toLocaleString()}`)
    .join('\n');
}

function appendCell(row, tagName, text, className = '') {
  const cell = document.createElement(tagName);
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);

  return cell;
}

function appendBuildingHeader(row, key, buildingType, index = 0) {
  const th = document.createElement('th');
  const label = `${labelFromKey(key)}${index > 0 ? ` #${index + 1}` : ''}`;
  const offset = BUILDING_ICON_POSITIONS[buildingType];

  th.className = 'ika-building-header';
  th.title = label;

  if (typeof offset === 'number') {
    const icon = document.createElement('span');
    icon.className = 'ika-building-icon';
    icon.style.backgroundImage = `url(${browser.runtime.getURL(BUILDING_SPRITE)})`;
    icon.style.backgroundSize = `${Math.round(BUILDING_SPRITE_WIDTH * BUILDING_ICON_SCALE)}px ${Math.round(BUILDING_SPRITE_HEIGHT * BUILDING_ICON_SCALE)}px`;
    icon.style.backgroundPosition = `${Math.round(offset * BUILDING_ICON_SCALE)}px 0`;
    th.appendChild(icon);
  }

  const span = document.createElement('span');
  span.className = 'ika-sr-label';
  span.textContent = label;
  th.appendChild(span);
  row.appendChild(th);
}

function createHeader(columns) {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');

  appendCityHeader(row);
  appendTransportHeader(row);

  columns.forEach(({ key, buildingType, index }) => {
    appendBuildingHeader(row, key, buildingType, index);
  });

  thead.appendChild(row);

  return thead;
}

function createBody(cities, columns) {
  const tbody = document.createElement('tbody');

  cities.forEach((city) => {
    const row = document.createElement('tr');

    appendCityCell(row, city);
    appendResourceTransportCell(row, city);

    columns.forEach(({ buildingType, index }) => {
      const buildingData = getBuildingData(city, buildingType, index);
      const cell = appendCell(row, 'td', formatBuilding(buildingData), 'ika-number ika-building-level');
      const position = getPosition(buildingData);

      if (!buildingData) {
        cell.classList.add('ika-building-empty');
        return;
      }

      const state = getUpgradeState(city, buildingType, buildingData);
      cell.dataset.upgradeState = state;
      cell.title = formatBuildingTitle(city, buildingType, buildingData);

      if (city?.id && position !== null) {
        cell.classList.add('ika-building-clickable');
        cell.addEventListener('click', () => {
          gameData.openGameView({
            __ikakitMode: 'location',
            view: buildingType,
            cityId: city.id,
            position,
            backgroundView: 'city',
            currentCityId: city.id,
          });
          document.querySelector('#ika-empire-modal .ika-modal-close')?.click();
        });
      }
    });

    tbody.appendChild(row);
  });

  return tbody;
}

const buildings = Object.freeze({
  render(container, cities = []) {
    const root = resolveContainer(container);

    if (!root) {
      return;
    }

    const normalizedCities = Array.isArray(cities) ? cities : [];
    const columns = getExpandedColumns(normalizedCities);
    const table = document.createElement('table');
    table.className = 'ika-table ika-buildings-table';
    table.appendChild(createHeader(columns));
    table.appendChild(createBody(normalizedCities, columns));

    root.replaceChildren(table);
  },
});

export default buildings;
