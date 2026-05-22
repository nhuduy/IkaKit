// IkaKit — Empire buildings table
// Render level công trình của từng thành phố theo danh sách Buildings.

import { Buildings } from '../../const.js';

const BUILDING_COLUMNS = Object.freeze(Object.entries(Buildings));
const BUILDING_SPRITE = 'assets/images/empire/buildingbutton_sprite.jpg';
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

function getBuildingData(city, buildingType) {
  const buildings = city?.buildings ?? {};

  return buildings[buildingType] ?? buildings[String(buildingType)] ?? null;
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

  return Boolean(
    buildingData.isUpgrading
      ?? buildingData.upgrading
      ?? buildingData.inUpgrade
      ?? buildingData.underConstruction
      ?? buildingData.upgradeEndTime
      ?? buildingData.upgradeFinishTime,
  );
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

function appendCell(row, tagName, text, className = '') {
  const cell = document.createElement(tagName);
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
}

function appendBuildingHeader(row, key, buildingType) {
  const th = document.createElement('th');
  const label = labelFromKey(key);
  const offset = BUILDING_ICON_POSITIONS[buildingType];

  th.className = 'ika-building-header';
  th.title = label;

  if (typeof offset === 'number') {
    const icon = document.createElement('span');
    icon.className = 'ika-building-icon';
    icon.style.backgroundImage = `url(${browser.runtime.getURL(BUILDING_SPRITE)})`;
    icon.style.backgroundPosition = `${offset}px 0`;
    th.appendChild(icon);
  }

  const span = document.createElement('span');
  span.className = 'ika-sr-label';
  span.textContent = label;
  th.appendChild(span);
  row.appendChild(th);
}

function createHeader() {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');

  appendCell(row, 'th', 'City');

  BUILDING_COLUMNS.forEach(([key, buildingType]) => {
    appendBuildingHeader(row, key, buildingType);
  });

  thead.appendChild(row);

  return thead;
}

function createBody(cities) {
  const tbody = document.createElement('tbody');

  cities.forEach((city) => {
    const row = document.createElement('tr');

    appendCell(row, 'td', city?.name ?? `City ${city?.id ?? ''}`.trim(), 'ika-city-name');

    BUILDING_COLUMNS.forEach(([, buildingType]) => {
      appendCell(row, 'td', formatBuilding(getBuildingData(city, buildingType)), 'ika-number');
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

    const table = document.createElement('table');
    table.className = 'ika-table ika-buildings-table';
    table.appendChild(createHeader());
    table.appendChild(createBody(Array.isArray(cities) ? cities : []));

    root.replaceChildren(table);
  },
});

export default buildings;
