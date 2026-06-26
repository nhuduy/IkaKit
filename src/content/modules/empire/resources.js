// IkaKit — Empire resources table
// Render tài nguyên hiện có của từng thành phố.

import gameEvents from '../../helpers/gameEvents.js';
import { getRuntimeUrl } from '../../helpers/runtime.js';
import { appendResourceTransportCell, appendTransportHeader } from './transportActions.js';
import { appendCityCell, appendCityHeader } from './cityCell.js';
import { t } from '../../../shared/i18n/index.js';

let _activeResourceFilter = null;

const RESOURCE_COLUMNS = Object.freeze([
  ['wood', 'empire.resource.wood', 'icon_wood.png'],
  ['wine', 'empire.resource.wine', 'icon_wine.png'],
  ['marble', 'empire.resource.marble', 'icon_marble.png'],
  ['glass', 'empire.resource.glass', 'icon_glass.png'],
  ['sulfur', 'empire.resource.sulfur', 'icon_sulfur.png'],
]);
const HIGH_RESOURCE_THRESHOLD = 2000000;
const LOW_WINE_THRESHOLD = 1000;

function resolveContainer(container) {
  return typeof container === 'string' ? document.querySelector(container) : container;
}

function getAttackedCityNames() {
  const events = gameEvents.getActiveEvents().filter((event) => event.category === 'military');
  const names = new Set();
  events.forEach((event) => {
    const target = event?.payload?.militaryEvent?.target;
    if (target) names.add(target);
  });
  return names;
}

function cityIsUnderAttack(city, attackedNames) {
  return attackedNames.has(city?.name ?? '');
}

function cityHasNegativePopulation(city) {
  const growth = Number(city?.populationGrowth);
  return Number.isFinite(growth) && growth < 0;
}

function cityHasFullPopulation(city) {
  const occupied = Number(city?.occupiedSpace);
  const max = Number(city?.maxInhabitants);
  return Number.isFinite(occupied) && Number.isFinite(max) && max > 0 && occupied >= max;
}

function cityHasCorruption(city) {
  const corruption = Number(city?.corruption);
  return Number.isFinite(corruption) && corruption > 0;
}

function cityHasHighResources(city) {
  return RESOURCE_COLUMNS.some(([key]) => {
    const amount = Number(getCityValue(city, key));
    return Number.isFinite(amount) && amount >= HIGH_RESOURCE_THRESHOLD;
  });
}

function cityHasLowWine(city) {
  const wine = Number(getCityValue(city, 'wine'));
  return Number.isFinite(wine) && wine <= LOW_WINE_THRESHOLD;
}

function cityHasAcademySlots(city) {
  const scientists = Number(city?.scientists);
  const maxScientists = Number(city?.maxScientists);
  return Number.isFinite(scientists)
    && Number.isFinite(maxScientists)
    && maxScientists > 0
    && scientists < maxScientists;
}

function cityMatchesResourceFilter(city, attackedNames, filterId) {
  if (!filterId) return true;

  const underAttack = cityIsUnderAttack(city, attackedNames);
  if (filterId === 'underAttack') return underAttack;
  if (filterId === 'safe') return !underAttack;
  if (filterId === 'negativePopulation') return cityHasNegativePopulation(city);
  if (filterId === 'fullPopulation') return cityHasFullPopulation(city);
  if (filterId === 'corruption') return cityHasCorruption(city);
  if (filterId === 'highResources') return cityHasHighResources(city);
  if (filterId === 'lowWine') return cityHasLowWine(city);
  if (filterId === 'academySlots') return cityHasAcademySlots(city);

  return true;
}

function createFilterChip({ bar, id, label, count, onFilterChange }) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `ika-filter-chip${_activeResourceFilter === id ? ' ika-filter-chip-active' : ''}`;
  chip.textContent = `${label} (${count})`;
  chip.addEventListener('click', () => {
    _activeResourceFilter = _activeResourceFilter === id ? null : id;
    onFilterChange();
  });

  bar.appendChild(chip);
}

function createFilterBar(allCities, attackedNames, onFilterChange) {
  const bar = document.createElement('div');
  bar.className = 'ika-filter-bar';

  [
    ['underAttack', 'empire.resource.filter.underAttack'],
    ['safe', 'empire.resource.filter.safe'],
    ['negativePopulation', 'empire.resource.filter.negativePopulation'],
    ['fullPopulation', 'empire.resource.filter.fullPopulation'],
    ['corruption', 'empire.resource.filter.corruption'],
    ['highResources', 'empire.resource.filter.highResources'],
    ['lowWine', 'empire.resource.filter.lowWine'],
    ['academySlots', 'empire.resource.filter.academySlots'],
  ].forEach(([id, labelKey]) => {
    createFilterChip({
      bar,
      id,
      label: t(labelKey),
      count: allCities.filter((city) => cityMatchesResourceFilter(city, attackedNames, id)).length,
      onFilterChange,
    });
  });

  return bar;
}

function formatNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') return '—';

  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : '—';
}

function getCityValue(city, key) {
  return city?.resources?.[key] ?? null;
}

function getCityProduction(city, key) {
  const value = Number(city?.production?.[key]);
  return Number.isFinite(value) ? value : null;
}

function getWineSpending(city) {
  const value = Number(city?.production?.wineSpendings);
  return Number.isFinite(value) ? value : null;
}

function getStorageCapacity(city, key) {
  const value = Number(city?.maxResources?.[key] ?? city?.storageCapacity);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getResourceSafe(city) {
  const value = Number(city?.resourceSafe);
  return Number.isFinite(value) ? value : null;
}

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number > 0) return `+${formatNumber(number)}`;
  if (number < 0) return `-${formatNumber(Math.abs(number))}`;
  return '0';
}

function formatDurationFromHours(hours) {
  const value = Number(hours);
  if (!Number.isFinite(value) || value < 0) return null;

  let minutes = Math.max(value > 0 ? 1 : 0, Math.floor(value * 60));
  const units = [
    [t('common.duration.yearShort'), 365 * 24 * 60],
    [t('common.duration.monthShort'), 30 * 24 * 60],
    [t('common.duration.dayShort'), 24 * 60],
    [t('common.duration.hourShort'), 60],
    [t('common.duration.minuteShort'), 1],
  ];
  const parts = [];

  units.forEach(([label, size]) => {
    const amount = Math.floor(minutes / size);
    if (amount > 0) parts.push(`${amount}${label}`);
    minutes -= amount * size;
  });

  return parts.length ? parts.join(' ') : '0m';
}

function getFullInText(amount, capacity, production) {
  if (production === null || production <= 0 || capacity === null) return null;
  if (amount >= capacity) return t('empire.resource.tooltip.full');
  return formatDurationFromHours((capacity - amount) / production);
}

function formatDecimal(value, digits = 2) {
  if (value === null || typeof value === 'undefined' || value === '') return '—';

  const number = Number(value);
  if (!Number.isFinite(number)) return '—';

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

function sumCityNumber(cities, getter) {
  return cities.reduce((total, city) => {
    const value = Number(getter(city));
    return Number.isFinite(value) ? total + value : total;
  }, 0);
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

function createResourceProgress(amount, capacity, safe) {
  const progress = document.createElement('div');
  const value = Number(amount);
  const max = Number(capacity);
  const safeAmount = Number(safe);

  progress.className = 'ika-progress ika-resource-progress';

  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    const bar = document.createElement('span');
    bar.style.width = '0%';
    progress.appendChild(bar);
    return progress;
  }

  const percent = Math.min(Math.max((value / max) * 100, 0), 100);
  if (Number.isFinite(safeAmount) && safeAmount < value) {
    const safePercent = Math.min(Math.max((safeAmount / max) * 100, 0), 100);
    const unsafePercent = Math.max(percent - safePercent, 0);
    const safeBar = document.createElement('span');
    const unsafeBar = document.createElement('span');

    safeBar.className = 'ika-progress-safe';
    safeBar.style.width = `${safePercent}%`;
    unsafeBar.className = 'ika-progress-unsafe';
    unsafeBar.style.width = `${unsafePercent}%`;
    progress.append(safeBar, unsafeBar);
  } else {
    const bar = document.createElement('span');
    bar.style.width = `${percent}%`;
    progress.appendChild(bar);
  }

  progress.classList.toggle('ika-progress-full', value >= max);
  return progress;
}

function appendTooltipRow(tooltip, label, value, className = '') {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('strong');

  row.className = 'ika-resource-tooltip-row';
  labelEl.textContent = `${label}:`;
  valueEl.textContent = value;
  if (className) valueEl.className = className;
  row.append(labelEl, valueEl);
  tooltip.appendChild(row);
}

function createResourceTooltip({ label, amount, production, wineSpending, capacity, safe, fullIn }) {
  const tooltip = document.createElement('div');
  const title = document.createElement('div');

  tooltip.className = 'ika-resource-tooltip';
  title.className = 'ika-resource-tooltip-title';
  title.textContent = label.toLowerCase();
  tooltip.appendChild(title);

  appendTooltipRow(tooltip, t('empire.resource.tooltip.inWarehouse'), formatNumber(amount));

  if (production !== null && production > 0) {
    appendTooltipRow(tooltip, t('empire.resource.tooltip.hourlyProduction'), formatSignedNumber(production), 'ika-good');
    appendTooltipRow(tooltip, t('empire.resource.tooltip.dailyProduction'), formatSignedNumber(production * 24), 'ika-good');
    if (fullIn) appendTooltipRow(tooltip, t('empire.resource.tooltip.fullIn'), fullIn, fullIn === t('empire.resource.tooltip.full') ? 'ika-bad' : '');
  }

  if (wineSpending !== null && wineSpending > 0) {
    appendTooltipRow(tooltip, t('empire.resource.tooltip.endsIn'), formatDurationFromHours(amount / wineSpending), 'ika-bad');
    appendTooltipRow(tooltip, t('empire.resource.tooltip.expensesHour'), formatSignedNumber(-wineSpending), 'ika-bad');
    appendTooltipRow(tooltip, t('empire.resource.tooltip.expensesDay'), formatSignedNumber(-wineSpending * 24), 'ika-bad');
    appendTooltipRow(tooltip, t('empire.resource.tooltip.expensesWeek'), formatSignedNumber(-wineSpending * 168), 'ika-bad');
    appendTooltipRow(tooltip, t('empire.resource.tooltip.expensesMonth'), formatSignedNumber(-wineSpending * 730), 'ika-bad');
  }

  appendTooltipRow(tooltip, t('empire.resource.tooltip.storageCapacity'), capacity === null ? '—' : formatNumber(capacity));
  appendTooltipRow(tooltip, t('empire.resource.tooltip.safe'), safe === null ? '—' : formatNumber(safe));
  return tooltip;
}

function appendResourceCell(row, city, key, label) {
  const amount = Number(getCityValue(city, key));
  const production = getCityProduction(city, key);
  const wineSpending = key === 'wine' ? getWineSpending(city) : null;
  const capacity = getStorageCapacity(city, key);
  const safe = getResourceSafe(city);
  const fullIn = getFullInText(Number.isFinite(amount) ? amount : 0, capacity, production);
  const cell = document.createElement('td');
  const content = document.createElement('div');
  const amountEl = document.createElement('div');
  const productionEl = document.createElement('div');

  cell.className = 'ika-number ika-resource-storage-cell';
  cell.tabIndex = 0;
  content.className = 'ika-resource-storage-content';
  amountEl.className = 'ika-resource-amount';
  amountEl.textContent = Number.isFinite(amount) ? formatNumber(amount) : '—';

  if (safe !== null && Number.isFinite(amount) && amount > safe) {
    amountEl.classList.add('ika-bad');
  }

  productionEl.className = 'ika-resource-production';
  if (key === 'wine' && wineSpending !== null && wineSpending > 0) {
    if (production !== null && production > 0) {
      const gain = document.createElement('span');
      gain.className = 'ika-good';
      gain.textContent = formatSignedNumber(production);
      productionEl.appendChild(gain);
    }

    const spend = document.createElement('span');
    spend.className = 'ika-bad';
    spend.textContent = formatSignedNumber(-wineSpending);
    productionEl.appendChild(spend);
  } else if (production !== null && production > 0) {
    const gain = document.createElement('span');
    gain.className = 'ika-good';
    gain.textContent = formatSignedNumber(production);
    productionEl.appendChild(gain);
  }

  content.append(amountEl, productionEl);
  cell.append(content, createResourceProgress(Number.isFinite(amount) ? amount : 0, capacity, safe));
  cell.appendChild(createResourceTooltip({
    label,
    amount: Number.isFinite(amount) ? amount : null,
    production,
    wineSpending,
    capacity,
    safe,
    fullIn,
  }));
  row.appendChild(cell);
}

function appendCorruptionCell(row, city) {
  const corruption = city?.corruption;
  const number = Number(corruption);
  const text = Number.isFinite(number) ? `${Math.floor(number * 100)}%` : '—';
  const cell = appendCell(row, text, Number.isFinite(number) && number === 0 ? 'ika-good' : 'ika-bad');

  cell.classList.add('ika-resource-corruption-cell');
  cell.title = t('empire.resource.corruption');
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

function appendTotalHousingCell(row, cities) {
  const occupied = sumCityNumber(cities, (city) => city?.occupiedSpace);
  const max = sumCityNumber(cities, (city) => city?.maxInhabitants);
  const growth = sumCityNumber(cities, (city) => city?.populationGrowth);
  const cell = document.createElement('td');
  const line = document.createElement('div');
  const growthEl = document.createElement('span');

  cell.className = 'ika-resource-combo ika-resource-housing-cell';
  line.className = 'ika-resource-line';
  line.textContent = max > 0
    ? `${formatNumber(Math.floor(occupied))} / ${formatNumber(Math.floor(max))}`
    : '—';

  growthEl.className = growth >= 0 ? 'ika-good' : 'ika-bad';
  growthEl.textContent = formatDecimal(growth);
  line.appendChild(growthEl);
  cell.appendChild(line);
  row.appendChild(cell);
}

function appendTotalResearchCell(row, cities) {
  const research = sumCityNumber(cities, (city) => city?.research);
  const scientists = sumCityNumber(cities, (city) => city?.scientists);
  const maxScientists = sumCityNumber(cities, (city) => city?.maxScientists);
  const cell = document.createElement('td');
  const line = document.createElement('div');
  const meta = document.createElement('span');

  cell.className = 'ika-resource-combo ika-resource-research-cell';
  line.className = 'ika-resource-line';
  line.textContent = formatNumber(Math.floor(research));
  meta.textContent = `${formatNumber(Math.floor(scientists))}/${formatNumber(Math.floor(maxScientists))}`;
  line.appendChild(meta);
  cell.appendChild(line);
  row.appendChild(cell);
}

function appendTotalRow(tbody, cities) {
  const row = document.createElement('tr');
  row.className = 'ika-total-row';

  const label = appendCell(row, 'Σ', 'ika-city-name');
  label.colSpan = 2;
  appendCell(row, '—', 'ika-resource-corruption-cell');
  appendTotalHousingCell(row, cities);
  appendTotalResearchCell(row, cities);

  RESOURCE_COLUMNS.forEach(([key]) => {
    appendCell(row, formatNumber(sumCityNumber(cities, (city) => getCityValue(city, key))), 'ika-number');
  });

  tbody.appendChild(row);
}

function appendIconHeader(row, { label, icon, fallback, className }) {
  const th = document.createElement('th');
  th.className = className;
  th.title = label;

  if (icon) {
    const iconUrl = getRuntimeUrl(`assets/images/empire/resources/${icon}`);
    const img = document.createElement('img');
    img.className = 'ika-resource-icon';
    img.alt = '';
    if (iconUrl) {
      img.src = iconUrl;
      th.appendChild(img);
    } else {
      th.textContent = fallback;
    }
  } else {
    th.textContent = fallback;
  }

  row.appendChild(th);
  return th;
}

function createHeader() {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');

  appendCityHeader(row);
  appendTransportHeader(row);

  [
    [t('empire.resource.corruption'), 'corruption_24x24.png', t('empire.resource.corruption'), 'ika-resource-corruption-cell'],
    [t('empire.resource.housingSpace'), 'icon_population.png', t('empire.resource.housing'), 'ika-resource-housing-cell'],
    [t('empire.resource.researchPerHour'), 'icon_research.png', t('empire.resource.research'), 'ika-resource-research-cell'],
  ].forEach(([label, icon, fallback, className]) => {
    appendIconHeader(row, {
      label,
      icon,
      fallback,
      className: `ika-resource-header ika-resource-meta-header ${className}`,
    });
  });

  RESOURCE_COLUMNS.forEach(([, labelKey, icon]) => {
    const label = t(labelKey);
    const th = appendIconHeader(row, {
      label,
      icon,
      fallback: label,
      className: 'ika-resource-header',
    });
    const span = document.createElement('span');
    span.textContent = icon ? label : '';
    span.className = icon ? 'ika-sr-label' : '';
    th.appendChild(span);
  });

  thead.appendChild(row);
  return thead;
}

function createBody(cities, attackedNames) {
  const tbody = document.createElement('tbody');

  cities.forEach((city) => {
    const row = document.createElement('tr');
    if (cityIsUnderAttack(city, attackedNames)) row.classList.add('ika-row-under-attack');

    appendCityCell(row, city);
    appendResourceTransportCell(row, city);
    appendCorruptionCell(row, city);
    appendHousingCell(row, city);
    appendResearchCell(row, city);

    RESOURCE_COLUMNS.forEach(([key, labelKey]) => {
      appendResourceCell(row, city, key, t(labelKey));
    });

    tbody.appendChild(row);
  });

  appendTotalRow(tbody, cities);
  return tbody;
}

const resources = Object.freeze({
  render(container, cities = []) {
    const root = resolveContainer(container);
    if (!root) return;

    const allCities = Array.isArray(cities) ? cities : [];
    const attackedNames = getAttackedCityNames();
    const filteredCities = _activeResourceFilter
      ? allCities.filter((city) => cityMatchesResourceFilter(city, attackedNames, _activeResourceFilter))
      : allCities;

    const table = document.createElement('table');
    table.className = 'ika-table ika-resources-table';
    table.appendChild(createHeader());
    table.appendChild(createBody(filteredCities, attackedNames));

    const filterBar = createFilterBar(allCities, attackedNames, () => this.render(container, allCities));
    root.replaceChildren(filterBar, table);
  },
});

export default resources;
