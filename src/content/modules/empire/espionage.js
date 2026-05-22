// IkaKit — Empire espionage table
// Render các công trình liên quan đến gián điệp và nghiên cứu hỗ trợ.

import { Buildings } from '../../const.js';
import { appendResourceTransportCell, appendTransportHeader } from './transportActions.js';
import { appendCityCell, appendCityHeader } from './cityCell.js';

const ESPIONAGE_BUILDINGS = Object.freeze([
  ['Hideout/Safehouse', Buildings.HIDEOUT],
  ['Academy', Buildings.ACADEMY],
  ['Workshop', Buildings.WORKSHOP],
]);

function resolveContainer(container) {
  return typeof container === 'string' ? document.querySelector(container) : container;
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

  // Cùng quy tắc với bảng buildings: đang nâng cấp thì hiển thị level kế tiếp.
  return isUpgrading(buildingData) ? `${level} → ${level + 1}` : String(level);
}

function appendCell(row, tagName, text, className = '') {
  const cell = document.createElement(tagName);
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
}

function createHeader() {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');

  appendCityHeader(row);
  appendTransportHeader(row);

  ESPIONAGE_BUILDINGS.forEach(([label]) => {
    appendCell(row, 'th', label);
  });

  thead.appendChild(row);

  return thead;
}

function createBody(cities) {
  const tbody = document.createElement('tbody');

  cities.forEach((city) => {
    const row = document.createElement('tr');

    appendCityCell(row, city);
    appendResourceTransportCell(row, city);

    ESPIONAGE_BUILDINGS.forEach(([, buildingType]) => {
      appendCell(row, 'td', formatBuilding(getBuildingData(city, buildingType)), 'ika-number');
    });

    tbody.appendChild(row);
  });

  return tbody;
}

const espionage = Object.freeze({
  render(container, cities = []) {
    const root = resolveContainer(container);

    if (!root) {
      return;
    }

    const table = document.createElement('table');
    table.className = 'ika-table ika-espionage-table';
    table.appendChild(createHeader());
    table.appendChild(createBody(Array.isArray(cities) ? cities : []));

    root.replaceChildren(table);
  },
});

export default espionage;
