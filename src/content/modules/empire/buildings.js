// IkaKit — Empire buildings table
// Render level công trình của từng thành phố theo danh sách Buildings.

import { Buildings } from '../../const.js';
import gameData from '../../helpers/gameData.js';
import BUILDING_COSTS from './buildingCosts.js';
import { appendResourceTransportCell, appendTransportHeader } from './transportActions.js';
import { appendCityCell, appendCityHeader } from './cityCell.js';
import { t } from '../../../shared/i18n/index.js';

let _activeBuildingFilter = null;

const BUILDING_COLUMNS = Object.freeze(Object.entries(Buildings));
const MULTIPLE_BUILDINGS = Object.freeze({
  warehouse: true,
  port: true,
  shipyard: true,
});
const BUILDING_SPRITE = 'assets/images/empire/buildingbutton_sprite.jpg';
const BUILDING_ICON_SCALE = 0.88;
const BUILDING_SPRITE_WIDTH = 1340;
const BUILDING_SPRITE_HEIGHT = 82;
const COST_REDUCERS = Object.freeze({
  wood: 'carpentering',
  marble: 'architect',
  wine: 'vineyard',
  glass: 'optician',
  sulfur: 'fireworker',
});
const RESOURCE_LABELS = Object.freeze({
  wood: 'empire.resource.wood',
  marble: 'empire.resource.marble',
  wine: 'empire.resource.wine',
  glass: 'empire.resource.glass',
  sulfur: 'empire.resource.sulfur',
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

function normalizeBuildingKey(key) {
  if (key === null || typeof key === 'undefined') {
    return null;
  }

  const type = String(key)
    .trim()
    .replace(/^building_/, '')
    .replace(/^constructionSite[\s_-]*/i, '')
    .replace(/[\s_-]+constructionSite$/i, '')
    .replace(/constructionSite$/i, '');

  if (!type || type.startsWith('buildingGround')) {
    return null;
  }

  return type;
}

function getBuildingItems(city, buildingType) {
  const buildings = city?.buildings ?? {};
  const items = [];
  const seenKeys = new Set();

  const pushValue = (key) => {
    if (seenKeys.has(key) || !Object.prototype.hasOwnProperty.call(buildings, key)) {
      return;
    }

    seenKeys.add(key);
    const value = buildings[key];
    if (Array.isArray(value)) {
      items.push(...value);
    } else if (value) {
      items.push(value);
    }
  };

  pushValue(buildingType);
  pushValue(String(buildingType));

  Object.keys(buildings).forEach((key) => {
    if (normalizeBuildingKey(key) === buildingType) {
      pushValue(key);
    }
  });

  return items;
}

function getBuildingData(city, buildingType, index = 0) {
  const items = getBuildingItems(city, buildingType);

  if (!items.length) {
    return null;
  }

  return displayBuildingSlots(items)[index] ?? null;
}

function mergeDisplayBuildingSlot(base, update) {
  if (!base || typeof base !== 'object') return update;
  if (!update || typeof update !== 'object') return base;

  const merged = { ...base, ...update };
  const basePosition = getPosition(base);
  if (basePosition !== null) merged.position = basePosition;

  const baseLevel = Number(getLevel(base));
  const updateTarget = Number(getTargetLevel(update));
  if (isUpgrading(update) && Number.isFinite(baseLevel) && Number.isFinite(updateTarget) && baseLevel < updateTarget) {
    merged.level = baseLevel;
    delete merged.currentLevel;
    delete merged.buildingLevel;
  }

  return merged;
}

function findDisplaySlotMatch(slots, item) {
  const position = getPosition(item);
  if (position !== null) {
    const byPosition = slots.findIndex((slot) => getPosition(slot) === position);
    if (byPosition !== -1) return byPosition;
  }

  if (!isUpgrading(item)) return -1;

  const level = Number(getLevel(item));
  const target = Number(getTargetLevel(item));

  return slots.findIndex((slot) => {
    const slotLevel = Number(getLevel(slot));
    const slotTarget = Number(getTargetLevel(slot));

    return (Number.isFinite(level) && Number.isFinite(slotLevel) && slotLevel === level)
      || (Number.isFinite(target) && Number.isFinite(slotLevel) && slotLevel + 1 === target)
      || (Number.isFinite(target) && Number.isFinite(slotTarget) && slotTarget === target);
  });
}

function coalesceBuildingSlots(items) {
  return items.reduce((slots, item) => {
    const index = findDisplaySlotMatch(slots, item);
    if (index === -1) {
      slots.push(item);
    } else {
      slots[index] = mergeDisplayBuildingSlot(slots[index], item);
    }

    return slots;
  }, []);
}

function displayBuildingSlots(items) {
  return sortBuildingSlots(coalesceBuildingSlots(items));
}

function sortBuildingSlots(items) {
  return [...items].sort((left, right) => {
    const leftLevel = getEffectiveLevel(left) ?? Number.MAX_SAFE_INTEGER;
    const rightLevel = getEffectiveLevel(right) ?? Number.MAX_SAFE_INTEGER;
    const leftPosition = getPosition(left) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = getPosition(right) ?? Number.MAX_SAFE_INTEGER;

    return leftLevel - rightLevel || leftPosition - rightPosition;
  });
}

function getBuildingCount(city, buildingType) {
  const items = getBuildingItems(city, buildingType);

  return items.length ? displayBuildingSlots(items).length : 0;
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

function normalizeTimestamp(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return number < 100000000000 ? number * 1000 : number;
}

function getUpgradeFinishTime(buildingData) {
  if (!buildingData || typeof buildingData !== 'object') {
    return null;
  }

  return [
    buildingData.completed,
    buildingData.upgradeEndTime,
    buildingData.upgradeFinishTime,
    buildingData.endTime,
    buildingData.finishTime,
  ].map(normalizeTimestamp).find((timestamp) => timestamp !== null) ?? null;
}

function isUpgradeFinished(buildingData) {
  const finishAt = getUpgradeFinishTime(buildingData);
  return finishAt !== null && finishAt <= Date.now();
}

function readLevel(buildingData, keys) {
  if (!buildingData || typeof buildingData !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = Number(buildingData[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getTargetLevel(buildingData) {
  const explicitTarget = readLevel(buildingData, [
    'targetLevel',
    'upgradeTargetLevel',
    'nextLevel',
    'levelTo',
    'toLevel',
  ]);

  if (explicitTarget !== null) {
    return explicitTarget;
  }

  const level = Number(getLevel(buildingData));
  if (!Number.isFinite(level)) {
    return null;
  }

  return isUpgrading(buildingData) || isUpgradeFinished(buildingData) ? level + 1 : level;
}

function getEffectiveLevel(buildingData) {
  const rawLevel = getLevel(buildingData);
  const level = Number(rawLevel);

  if (!Number.isFinite(level)) {
    return null;
  }

  return isUpgradeFinished(buildingData) ? getTargetLevel(buildingData) : level;
}

function isUpgrading(buildingData) {
  if (!buildingData || typeof buildingData !== 'object') {
    return false;
  }

  const finishAt = getUpgradeFinishTime(buildingData);
  if (finishAt !== null) {
    return finishAt > Date.now();
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
  const reducerLevel = Number(getEffectiveLevel(reducer));

  if (!Number.isFinite(reducerLevel) || reducerLevel <= 0) {
    return 1;
  }

  return Math.max(0, 1 - (reducerLevel / 100));
}

function getNextCostBaseLevel(buildingData) {
  return isUpgrading(buildingData) ? getTargetLevel(buildingData) : getEffectiveLevel(buildingData);
}

function getNextLevelCost(city, buildingType, buildingData) {
  const rawLevel = getNextCostBaseLevel(buildingData);
  const level = Number(rawLevel);
  const costs = BUILDING_COSTS[buildingType];

  if (!Number.isFinite(level) || !Array.isArray(costs)) {
    return null;
  }

  const rawCost = costs[level];

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

function buildingIsAbsent(buildingData) {
  if (!buildingData) {
    return true;
  }

  const level = Number(getEffectiveLevel(buildingData));
  return Number.isFinite(level) && level <= 0;
}

function buildingMatchesFilter(city, column, filterId) {
  const buildingData = getBuildingData(city, column.buildingType, column.index);

  if (filterId === 'upgrading') {
    return isUpgrading(buildingData);
  }

  if (buildingIsAbsent(buildingData)) {
    return filterId === 'absent';
  }

  if (!buildingData) {
    return false;
  }

  return getUpgradeState(city, column.buildingType, buildingData) === filterId;
}

function cityMatchesBuildingFilter(city, columns, filterId) {
  if (!filterId) {
    return true;
  }

  return columns.some((column) => buildingMatchesFilter(city, column, filterId));
}

function formatBuilding(buildingData) {
  const rawLevel = getEffectiveLevel(buildingData);
  if (rawLevel === null || typeof rawLevel === 'undefined' || rawLevel === '') {
    return '—';
  }

  const level = Number(rawLevel);

  if (!Number.isFinite(level)) {
    return '—';
  }

  return isUpgrading(buildingData) ? `${level} → ${getTargetLevel(buildingData) ?? level + 1}` : String(level);
}

function getBuildingLabel(buildingType, buildingData) {
  return buildingData?.name || labelFromKey(
    Object.entries(Buildings).find(([, type]) => type === buildingType)?.[0] || buildingType,
  );
}

function formatUpgradeRange(buildingData) {
  const fromLevel = Number(getLevel(buildingData));
  const targetLevel = Number(getTargetLevel(buildingData));

  if (!Number.isFinite(fromLevel)) {
    return null;
  }

  return `${fromLevel} → ${Number.isFinite(targetLevel) ? targetLevel : fromLevel + 1}`;
}

function formatBuildingTitle(city, buildingType, buildingData) {
  const cost = getNextLevelCost(city, buildingType, buildingData);

  if (isUpgrading(buildingData)) {
    const range = formatUpgradeRange(buildingData);
    return t('empire.building.titleUnderConstruction', {
      building: getBuildingLabel(buildingType, buildingData),
      range: range ? t('empire.building.titleRange', { range }) : '',
    });
  }

  if (isUpgrading(buildingData) && (!cost || !Object.keys(cost).length)) {
    return t('empire.building.upgradingToMax');
  }

  if (!cost || !Object.keys(cost).length) {
    return t('empire.building.maxLevel');
  }

  return Object.entries(cost)
    .map(([resource, amount]) => `${resource}: ${amount.toLocaleString()}`)
    .join('\n');
}

function appendTooltipRow(tooltip, city, resource, amount) {
  const available = getResourceAmount(city, resource);
  const row = document.createElement('div');
  row.className = 'ika-building-tooltip-cost-row';
  row.dataset.enough = String(available >= amount);

  const label = document.createElement('span');
  label.textContent = RESOURCE_LABELS[resource] ? t(RESOURCE_LABELS[resource]) : labelFromKey(resource);

  const value = document.createElement('span');
  value.textContent = `${available.toLocaleString()} / ${amount.toLocaleString()}`;

  row.append(label, value);
  tooltip.appendChild(row);
}

function createBuildingTooltip(city, buildingType, buildingData) {
  const tooltip = document.createElement('div');
  tooltip.className = 'ika-building-tooltip';
  tooltip.setAttribute('role', 'tooltip');

  const title = document.createElement('div');
  title.className = 'ika-building-tooltip-title';
  title.textContent = `${getBuildingLabel(buildingType, buildingData)} ${formatBuilding(buildingData)}`;
  tooltip.appendChild(title);

  const cost = getNextLevelCost(city, buildingType, buildingData);
  if (isUpgrading(buildingData)) {
    const state = document.createElement('div');
    state.className = 'ika-building-tooltip-state';
    state.textContent = t('empire.building.underConstruction', {
      range: formatUpgradeRange(buildingData) || t('empire.building.inProgress'),
    });
    tooltip.appendChild(state);
  }

  if (isUpgrading(buildingData) && (!cost || !Object.keys(cost).length)) {
    return tooltip;
  }

  if (!cost || !Object.keys(cost).length) {
    const state = document.createElement('div');
    state.className = 'ika-building-tooltip-state';
    state.textContent = t('empire.building.maxLevel');
    tooltip.appendChild(state);
    return tooltip;
  }

  const heading = document.createElement('div');
  heading.className = 'ika-building-tooltip-heading';
  heading.textContent = t('empire.building.nextLevel', { level: getNextCostBaseLevel(buildingData) + 1 });
  tooltip.appendChild(heading);

  Object.entries(cost).forEach(([resource, amount]) => appendTooltipRow(tooltip, city, resource, amount));
  return tooltip;
}

function appendCell(row, tagName, text, className = '') {
  const cell = document.createElement(tagName);
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);

  return cell;
}

function appendBuildingHeader(row, key, buildingType, index = 0, colIndex = 0) {
  const th = document.createElement('th');
  const label = `${labelFromKey(key)}${index > 0 ? ` #${index + 1}` : ''}`;
  const offset = BUILDING_ICON_POSITIONS[buildingType];

  th.className = 'ika-building-header';
  th.title = label;
  th.dataset.colIndex = String(colIndex);

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

  columns.forEach(({ key, buildingType, index }, colIndex) => {
    appendBuildingHeader(row, key, buildingType, index, colIndex);
  });

  thead.appendChild(row);

  return thead;
}

function createBody(cities, columns, activeFilter = null) {
  const tbody = document.createElement('tbody');

  cities.forEach((city) => {
    const row = document.createElement('tr');

    appendCityCell(row, city);
    appendResourceTransportCell(row, city);

    columns.forEach(({ buildingType, index }, colIndex) => {
      const column = columns[colIndex];
      const buildingData = getBuildingData(city, buildingType, index);
      const cell = appendCell(row, 'td', formatBuilding(buildingData), 'ika-number ika-building-level');
      const position = getPosition(buildingData);
      cell.dataset.colIndex = String(colIndex);

      if (activeFilter && buildingMatchesFilter(city, column, activeFilter)) {
        cell.dataset.buildingFilterMatch = 'true';
      }

      if (!buildingData) {
        cell.classList.add('ika-building-empty');
        return;
      }

      const state = getUpgradeState(city, buildingType, buildingData);
      cell.dataset.upgradeState = state;
      cell.title = formatBuildingTitle(city, buildingType, buildingData);
      cell.appendChild(createBuildingTooltip(city, buildingType, buildingData));

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

function enableColumnHover(table) {
  const setColumnHover = (colIndex, enabled) => {
    table.querySelectorAll(`[data-col-index="${colIndex}"]`).forEach((cell) => {
      cell.classList.toggle('ika-building-col-hover', enabled);
    });
  };

  table.querySelectorAll('[data-col-index]').forEach((cell) => {
    cell.addEventListener('mouseenter', () => setColumnHover(cell.dataset.colIndex, true));
    cell.addEventListener('mouseleave', () => setColumnHover(cell.dataset.colIndex, false));
  });
}

function createFilterChip({ bar, id, label, count, onFilterChange }) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `ika-filter-chip${_activeBuildingFilter === id ? ' ika-filter-chip-active' : ''}`;
  chip.textContent = `${label} (${count})`;
  chip.addEventListener('click', () => {
    _activeBuildingFilter = _activeBuildingFilter === id ? null : id;
    onFilterChange();
  });

  bar.appendChild(chip);
}

function createFilterBar(allCities, columns, onFilterChange) {
  const bar = document.createElement('div');
  bar.className = 'ika-filter-bar';

  [
    ['upgrading', 'empire.building.filter.upgrading'],
    ['enough', 'empire.building.filter.enough'],
    ['missing', 'empire.building.filter.missing'],
    ['absent', 'empire.building.filter.absent'],
  ].forEach(([id, labelKey]) => {
    createFilterChip({
      bar,
      id,
      label: t(labelKey),
      count: allCities.filter((city) => cityMatchesBuildingFilter(city, columns, id)).length,
      onFilterChange,
    });
  });

  return bar;
}

const buildings = Object.freeze({
  render(container, cities = []) {
    const root = resolveContainer(container);

    if (!root) {
      return;
    }

    const allCities = Array.isArray(cities) ? cities : [];
    const columns = getExpandedColumns(allCities);
    const filteredCities = _activeBuildingFilter
      ? allCities.filter((city) => cityMatchesBuildingFilter(city, columns, _activeBuildingFilter))
      : allCities;

    const table = document.createElement('table');
    table.className = 'ika-table ika-buildings-table';
    if (_activeBuildingFilter) {
      table.dataset.activeBuildingFilter = _activeBuildingFilter;
    }
    table.appendChild(createHeader(columns));
    table.appendChild(createBody(filteredCities, columns, _activeBuildingFilter));
    enableColumnHover(table);

    const filterBar = createFilterBar(allCities, columns, () => this.render(container, allCities));

    root.replaceChildren(filterBar, table);
  },
});

export default buildings;
