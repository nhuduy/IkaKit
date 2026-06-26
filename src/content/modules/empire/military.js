// IkaKit — Empire military table
// Render quân đội theo 2 tab: lục quân và hải quân.

import { Buildings, Military } from '../../const.js';
import gameData from '../../helpers/gameData.js';
import { appendMilitaryTransportCell, appendTransportHeader } from './transportActions.js';
import { appendCityCell, appendCityHeader } from './cityCell.js';
import { t } from '../../../shared/i18n/index.js';

const UNIT_TYPES = Object.freeze(Object.values(Military).filter((type) => !type.startsWith('ship_')));
const SHIP_TYPES = Object.freeze(Object.values(Military).filter((type) => type.startsWith('ship_')));
const CITY_COLUMN_WIDTH = 144;
const ACTION_COLUMN_WIDTH = 94;
const UNIT_COLUMN_WIDTH = 42;

let activeMilitaryTab = 'units';

function resolveContainer(container) {
  return typeof container === 'string' ? document.querySelector(container) : container;
}

function formatNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '—';
  }

  const number = Number(value);

  return Number.isFinite(number) ? number.toLocaleString() : '—';
}

function getMilitaryCount(city, type) {
  const military = city?.military ?? {};

  if (
    !city?.military
    && !city?.units
    && !city?.ships
  ) {
    return null;
  }

  // Chấp nhận cả shape flat { phalanx: 10 } lẫn nested { units: {}, ships: {} }.
  return military[type]
    ?? military.units?.[type]
    ?? military.ships?.[type]
    ?? city?.units?.[type]
    ?? city?.ships?.[type]
    ?? 0;
}

function getBuildingData(city, buildingType) {
  const buildings = city?.buildings ?? {};
  const buildingData = buildings[buildingType] ?? buildings[String(buildingType)] ?? null;

  return Array.isArray(buildingData) ? buildingData[0] ?? null : buildingData;
}

function getPosition(buildingData) {
  if (!buildingData || typeof buildingData !== 'object') {
    return null;
  }

  const position = Number(buildingData.position);
  return Number.isFinite(position) ? position : null;
}

function getTrainingBuilding(kind) {
  return kind === 'ships' ? Buildings.SHIPYARD : Buildings.BARRACKS;
}

function iconPath(type, kind) {
  if (kind === 'ships') {
    return `/cdn/all/both/characters/fleet/60x60/${type}_faceright.png`;
  }

  return `/cdn/all/both/characters/military/x60_y60/y60_${type}_faceright.png`;
}

function makeTrainingShortcut(cell, city, kind) {
  const buildingType = getTrainingBuilding(kind);
  const buildingData = getBuildingData(city, buildingType);
  const position = getPosition(buildingData);

  if (!city?.id || position === null) {
    return;
  }

  cell.classList.add('ika-building-clickable', 'ika-military-training-clickable');
  cell.title = `${kind === 'ships' ? t('empire.military.shipyard') : t('empire.military.barracks')} - ${city.name ?? t('empire.military.town')}`;
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

function appendTextCell(row, tagName, text, className = '') {
  const cell = document.createElement(tagName);
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);

  return cell;
}

function appendUnitHeader(row, type, kind) {
  const th = document.createElement('th');
  th.className = 'ika-military-unit';
  th.title = type;

  const img = document.createElement('img');
  img.className = 'ika-military-icon';
  img.alt = type;
  img.loading = 'lazy';
  img.src = iconPath(type, kind);

  const label = document.createElement('span');
  label.className = 'ika-sr-label';
  label.textContent = type;

  th.append(img, label);
  row.appendChild(th);
}

function createTable(cities, types, kind) {
  const table = document.createElement('table');
  table.className = `ika-table ika-military-table ika-military-${kind}`;
  table.style.minWidth = `${CITY_COLUMN_WIDTH + ACTION_COLUMN_WIDTH + (types.length * UNIT_COLUMN_WIDTH)}px`;
  const colgroup = document.createElement('colgroup');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const tbody = document.createElement('tbody');
  const totals = Object.fromEntries(types.map((type) => [type, 0]));

  ['ika-col-city', 'ika-col-transport'].forEach((className) => {
    const col = document.createElement('col');
    col.className = className;
    colgroup.appendChild(col);
  });
  types.forEach(() => {
    const col = document.createElement('col');
    col.className = 'ika-col-unit';
    colgroup.appendChild(col);
  });

  appendCityHeader(headRow);
  appendTransportHeader(headRow);
  types.forEach((type) => appendUnitHeader(headRow, type, kind));
  thead.appendChild(headRow);

  cities.forEach((city) => {
    const row = document.createElement('tr');

    appendCityCell(row, city);
    appendMilitaryTransportCell(row, city);

    types.forEach((type) => {
      const rawCount = getMilitaryCount(city, type);
      const count = Number(rawCount);
      if (Number.isFinite(count)) {
        totals[type] += count;
      }
      makeTrainingShortcut(appendTextCell(row, 'td', formatNumber(rawCount), 'ika-number'), city, kind);
    });

    tbody.appendChild(row);
  });

  const totalRow = document.createElement('tr');
  totalRow.className = 'ika-total-row';
  const totalLabel = appendTextCell(totalRow, 'td', 'Σ', 'ika-city-name');
  totalLabel.colSpan = 2;

  types.forEach((type) => {
    appendTextCell(totalRow, 'td', formatNumber(totals[type]), 'ika-number');
  });

  tbody.appendChild(totalRow);
  table.append(colgroup, thead, tbody);

  return table;
}

function createTabButton(label, isActive) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `ika-tab-button${isActive ? ' ika-active' : ''}`;
  button.textContent = label;

  return button;
}

const military = Object.freeze({
  render(container, cities = []) {
    const root = resolveContainer(container);

    if (!root) {
      return;
    }

    const normalizedCities = Array.isArray(cities) ? cities : [];
    const wrapper = document.createElement('div');
    const tabBar = document.createElement('div');
    const content = document.createElement('div');
    const unitsButton = createTabButton(t('empire.military.units'), activeMilitaryTab === 'units');
    const shipsButton = createTabButton(t('empire.military.ships'), activeMilitaryTab === 'ships');

    wrapper.className = 'ika-military';
    tabBar.className = 'ika-tabs ika-military-tabs';
    content.className = 'ika-tab-content ika-military-content';

    // Tab con chỉ đổi nội dung bảng, không cần đọc lại cities từ gameData.
    const showTab = (kind) => {
      const isUnits = kind === 'units';
      activeMilitaryTab = isUnits ? 'units' : 'ships';
      unitsButton.classList.toggle('ika-active', isUnits);
      shipsButton.classList.toggle('ika-active', !isUnits);
      content.replaceChildren(createTable(
        normalizedCities,
        isUnits ? UNIT_TYPES : SHIP_TYPES,
        isUnits ? 'units' : 'ships',
      ));
    };

    unitsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTab('units');
    });
    shipsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTab('ships');
    });

    tabBar.append(unitsButton, shipsButton);
    wrapper.append(tabBar, content);
    root.replaceChildren(wrapper);

    showTab(activeMilitaryTab);
  },
});

export default military;
