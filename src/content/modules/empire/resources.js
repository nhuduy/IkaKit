// IkaKit — Empire resources table
// Render tài nguyên hiện có của từng thành phố.

import { appendResourceTransportCell, appendTransportHeader } from './transportActions.js';
import { appendCityCell, appendCityHeader } from './cityCell.js';

const RESOURCE_COLUMNS = Object.freeze([
  ['wood', 'Wood', 'icon_wood.png'],
  ['wine', 'Wine', 'icon_wine.png'],
  ['marble', 'Marble', 'icon_marble.png'],
  ['glass', 'Glass', 'icon_glass.png'],
  ['sulfur', 'Sulfur', 'icon_sulfur.png'],
]);

function resolveContainer(container) {
  return typeof container === 'string' ? document.querySelector(container) : container;
}

function formatNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '—';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return number.toLocaleString();
}

function getCityValue(city, key) {
  return city?.resources?.[key] ?? null;
}

function formatDecimal(value, digits = 2) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '—';
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '—';
  }

  return number.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function appendCell(row, text, className = '') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);

  return cell;
}

function createProgress(percent, className = '') {
  const progress = document.createElement('div');
  const bar = document.createElement('span');
  const value = Number(percent);

  progress.className = `ika-progress${className ? ` ${className}` : ''}`;
  bar.style.width = `${Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100)}%`;
  progress.appendChild(bar);

  return progress;
}

function appendCorruptionCell(row, city) {
  const corruption = city?.corruption;
  const number = Number(corruption);
  const text = Number.isFinite(number) ? `${Math.floor(number * 100)}%` : '—';
  const cell = appendCell(row, text, Number.isFinite(number) && number === 0 ? 'ika-good' : 'ika-bad');

  cell.classList.add('ika-resource-corruption-cell');
  cell.title = 'Corruption';
}

function appendHousingCell(row, city) {
  const occupied = Number(city?.occupiedSpace);
  const max = Number(city?.maxInhabitants);
  const growth = Number(city?.populationGrowth);
  const hasHousing = Number.isFinite(occupied) && Number.isFinite(max) && max > 0;
  const cell = document.createElement('td');
  const line = document.createElement('div');
  const growthEl = document.createElement('span');

  cell.className = 'ika-resource-combo ika-resource-housing-cell';
  line.className = 'ika-resource-line';
  line.textContent = hasHousing
    ? `${formatNumber(Math.floor(occupied))} / ${formatNumber(Math.floor(max))}`
    : '—';

  if (Number.isFinite(growth)) {
    growthEl.className = growth >= 0 ? 'ika-good' : 'ika-bad';
    growthEl.textContent = formatDecimal(growth);
    line.appendChild(growthEl);
  }

  cell.appendChild(line);
  if (hasHousing) {
    cell.appendChild(createProgress((occupied / max) * 100, occupied >= max ? 'ika-progress-full' : ''));
  }

  row.appendChild(cell);
}

function appendResearchCell(row, city) {
  const research = Number(city?.research);
  const scientists = Number(city?.scientists);
  const maxScientists = Number(city?.maxScientists);
  const cell = document.createElement('td');
  const line = document.createElement('div');

  cell.className = 'ika-resource-combo ika-resource-research-cell';
  line.className = 'ika-resource-line';
  line.textContent = Number.isFinite(research) ? formatNumber(Math.floor(research)) : '—';

  if (Number.isFinite(scientists) && Number.isFinite(maxScientists)) {
    const meta = document.createElement('span');
    meta.textContent = `${formatNumber(Math.floor(scientists))}/${formatNumber(Math.floor(maxScientists))}`;
    line.appendChild(meta);
    cell.appendChild(line);
    cell.appendChild(createProgress(maxScientists > 0 ? (scientists / maxScientists) * 100 : 0));
  } else {
    cell.appendChild(line);
  }

  row.appendChild(cell);
}

function createHeader() {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');

  appendCityHeader(row);
  appendTransportHeader(row);

  [
    ['Corruption', null, '%', 'ika-resource-corruption-cell'],
    ['Housing space', 'icon_population.png', 'Housing', 'ika-resource-housing-cell'],
    ['Research per hour', 'icon_research.png', 'Research', 'ika-resource-research-cell'],
  ].forEach(([label, icon, fallback, className]) => {
    const th = document.createElement('th');
    th.className = `ika-resource-header ika-resource-meta-header ${className}`;
    th.title = label;

    if (icon) {
      const img = document.createElement('img');
      img.className = 'ika-resource-icon';
      img.alt = '';
      img.src = browser.runtime.getURL(`assets/images/empire/resources/${icon}`);
      th.appendChild(img);
    } else {
      th.textContent = fallback;
    }

    row.appendChild(th);
  });

  RESOURCE_COLUMNS.forEach(([key, label, icon]) => {
    const th = document.createElement('th');
    th.className = 'ika-resource-header';
    th.title = label;

    if (icon) {
      const img = document.createElement('img');
      img.className = 'ika-resource-icon';
      img.alt = '';
      img.src = browser.runtime.getURL(`assets/images/empire/resources/${icon}`);
      th.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = '';
    span.className = icon ? 'ika-sr-label' : '';
    th.appendChild(span);
    row.appendChild(th);
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
    appendCorruptionCell(row, city);
    appendHousingCell(row, city);
    appendResearchCell(row, city);

    RESOURCE_COLUMNS.forEach(([key]) => {
      appendCell(row, formatNumber(getCityValue(city, key)), 'ika-number');
    });

    tbody.appendChild(row);
  });

  return tbody;
}

const resources = Object.freeze({
  render(container, cities = []) {
    const root = resolveContainer(container);

    if (!root) {
      return;
    }

    const table = document.createElement('table');
    table.className = 'ika-table ika-resources-table';
    table.appendChild(createHeader());
    table.appendChild(createBody(Array.isArray(cities) ? cities : []));

    root.replaceChildren(table);
  },
});

export default resources;
