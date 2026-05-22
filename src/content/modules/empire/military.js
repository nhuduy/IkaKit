// IkaKit — Empire military table
// Render quân đội theo 2 tab: lục quân và hải quân.

import { Military } from '../../const.js';
import gameData from '../../helpers/gameData.js';

const UNIT_TYPES = Object.freeze(Object.values(Military).filter((type) => !type.startsWith('ship_')));
const SHIP_TYPES = Object.freeze(Object.values(Military).filter((type) => type.startsWith('ship_')));

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

function iconPath(type, kind) {
  if (kind === 'ships') {
    return `/cdn/all/both/characters/fleet/60x60/${type}_faceright.png`;
  }

  return `/cdn/all/both/characters/military/x60_y60/y60_${type}_faceright.png`;
}

function appendTextCell(row, tagName, text, className = '') {
  const cell = document.createElement(tagName);
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);

  return cell;
}

function appendTransportHeader(row) {
  const th = document.createElement('th');
  th.className = 'ika-transport-header';
  th.title = 'Actions';
  row.appendChild(th);
}

function createActionButton(label, title, params) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ika-transport-button';
  button.textContent = label;
  button.title = title;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    gameData.openGameView(params);
  });

  return button;
}

function appendTransportCell(row, city) {
  const cell = document.createElement('td');
  const inner = document.createElement('div');
  const cityId = city?.id;

  cell.className = 'ika-transport-cell';
  inner.className = 'ika-transport-actions';

  if (cityId) {
    inner.append(
      createActionButton('R', 'Transport resources', {
        view: 'transport',
        destinationCityId: cityId,
      }),
      createActionButton('F', 'Deploy fleet', {
        view: 'deployment',
        deploymentType: 'fleet',
        destinationCityId: cityId,
      }),
      createActionButton('A', 'Deploy army', {
        view: 'deployment',
        deploymentType: 'army',
        destinationCityId: cityId,
      }),
    );
  }

  cell.appendChild(inner);
  row.appendChild(cell);
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
  label.textContent = type;

  th.append(img, label);
  row.appendChild(th);
}

function createTable(cities, types, kind) {
  const table = document.createElement('table');
  table.className = `ika-table ika-military-table ika-military-${kind}`;
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

  appendTextCell(headRow, 'th', 'City');
  appendTransportHeader(headRow);
  types.forEach((type) => appendUnitHeader(headRow, type, kind));
  thead.appendChild(headRow);

  cities.forEach((city) => {
    const row = document.createElement('tr');

    appendTextCell(row, 'td', city?.name ?? `City ${city?.id ?? ''}`.trim(), 'ika-city-name');
    appendTransportCell(row, city);

    types.forEach((type) => {
      const rawCount = getMilitaryCount(city, type);
      const count = Number(rawCount);
      if (Number.isFinite(count)) {
        totals[type] += count;
      }
      appendTextCell(row, 'td', formatNumber(rawCount), 'ika-number');
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
    const unitsButton = createTabButton('Units', true);
    const shipsButton = createTabButton('Ships', false);

    wrapper.className = 'ika-military';
    tabBar.className = 'ika-tabs ika-military-tabs';
    content.className = 'ika-tab-content ika-military-content';

    // Tab con chỉ đổi nội dung bảng, không cần đọc lại cities từ gameData.
    const showTab = (kind) => {
      const isUnits = kind === 'units';
      unitsButton.classList.toggle('ika-active', isUnits);
      shipsButton.classList.toggle('ika-active', !isUnits);
      content.replaceChildren(createTable(
        normalizedCities,
        isUnits ? UNIT_TYPES : SHIP_TYPES,
        isUnits ? 'units' : 'ships',
      ));
    };

    unitsButton.addEventListener('click', () => showTab('units'));
    shipsButton.addEventListener('click', () => showTab('ships'));

    tabBar.append(unitsButton, shipsButton);
    wrapper.append(tabBar, content);
    root.replaceChildren(wrapper);

    showTab('units');
  },
});

export default military;
