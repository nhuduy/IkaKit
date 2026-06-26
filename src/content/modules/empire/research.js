// IkaKit - Empire research overview.

import { Buildings } from '../../const.js';
import gameData from '../../helpers/gameData.js';
import { appendCityCell, appendCityHeader } from './cityCell.js';
import { t } from '../../../shared/i18n/index.js';

const RESEARCH_TYPES = Object.freeze(['economy', 'knowledge', 'seafaring', 'military']);

function resolveContainer(container) {
  return typeof container === 'string' ? document.querySelector(container) : container;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : '-';
}

function formatTime(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return t('empire.research.neverSynced');
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getBuildingData(city, buildingType) {
  const buildingData = city?.buildings?.[buildingType] ?? null;
  return Array.isArray(buildingData) ? buildingData[0] ?? null : buildingData;
}

function getPosition(buildingData) {
  const position = Number(buildingData?.position);
  return Number.isFinite(position) ? position : null;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function openResearchAdvisor() {
  gameData.openGameView({ view: 'researchAdvisor' });
  document.querySelector('#ika-empire-modal .ika-modal-close')?.click();
}

function openAcademy(city) {
  const position = getPosition(getBuildingData(city, Buildings.ACADEMY));
  if (!city?.id || position === null) return;

  gameData.openGameView({
    __ikakitMode: 'location',
    view: Buildings.ACADEMY,
    cityId: city.id,
    position,
    backgroundView: 'city',
    currentCityId: city.id,
  });
  document.querySelector('#ika-empire-modal .ika-modal-close')?.click();
}

function createStat(label, value) {
  const item = document.createElement('div');
  const strong = document.createElement('strong');
  const span = document.createElement('span');
  item.className = 'ika-research-stat';
  strong.textContent = value;
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function renderSummary(root, research, cities) {
  const summary = document.createElement('section');
  summary.className = 'ika-research-summary';

  const totalScientists = cities.reduce((sum, city) => sum + (Number(city?.scientists) || 0), 0);
  const totalResearch = cities.reduce((sum, city) => sum + (Number(city?.research) || 0), 0);

  const status = document.createElement('div');
  status.className = 'ika-research-status';
  status.textContent = research?.lastError
    ? t('empire.research.scanWarning', { error: research.lastError })
    : t('empire.research.synced', { time: formatTime(research?.updatedAt) });

  const stats = document.createElement('div');
  stats.className = 'ika-research-stats';
  stats.append(
    createStat(t('empire.research.scientists'), formatNumber(Math.floor(totalScientists))),
    createStat(t('empire.research.researchPerHour'), formatNumber(Math.floor(totalResearch))),
    createButton(t('empire.research.openAdvisor'), 'ika-research-action', openResearchAdvisor),
  );

  summary.append(status, stats);
  root.appendChild(summary);
}

function renderCategories(root, research) {
  const grid = document.createElement('section');
  grid.className = 'ika-research-grid';
  const categories = research?.categories ?? {};

  RESEARCH_TYPES.forEach((type) => {
    const category = categories[type] ?? { type, label: type, total: 0, completed: 0, available: 0, current: null, items: [] };
    const card = document.createElement('article');
    const title = document.createElement('h3');
    const meta = document.createElement('div');
    const current = document.createElement('div');
    const list = document.createElement('div');

    card.className = 'ika-research-card';
    title.textContent = category.label || type;
    meta.className = 'ika-research-meta';
    meta.textContent = [
      t('empire.research.completed', { count: formatNumber(category.completed) }),
      t('empire.research.available', { count: formatNumber(category.available) }),
      t('empire.research.total', { count: formatNumber(category.total) }),
    ].join(' · ');
    current.className = 'ika-research-current';
    current.textContent = category.current?.name
      ? t('empire.research.next', {
        name: category.current.name,
        level: category.current.futureLevel ? ` (${category.current.futureLevel})` : '',
      })
      : t('empire.research.noAvailable');

    list.className = 'ika-research-items';
    (category.items || []).slice(0, 5).forEach((item) => {
      const row = document.createElement('span');
      row.className = `ika-research-item ika-research-item-${item.state || 'unknown'}`;
      row.textContent = item.name || item.id || '-';
      list.appendChild(row);
    });

    card.append(title, meta, current, list);
    grid.appendChild(card);
  });

  root.appendChild(grid);
}

function appendCell(row, text, className = '') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
}

function renderCityScientists(root, cities) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const head = document.createElement('tr');
  const tbody = document.createElement('tbody');

  table.className = 'ika-table ika-research-city-table';
  appendCityHeader(head);
  [
    t('empire.research.academy'),
    t('empire.research.scientists'),
    t('empire.research.researchPerHour'),
    t('empire.research.action'),
  ].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  });
  thead.appendChild(head);

  cities.forEach((city) => {
    const row = document.createElement('tr');
    const academy = getBuildingData(city, Buildings.ACADEMY);
    const level = Number(academy?.level ?? academy?.currentLevel ?? academy?.buildingLevel);
    appendCityCell(row, city);
    appendCell(row, Number.isFinite(level) ? String(level) : '-', 'ika-number');
    appendCell(row, `${formatNumber(city?.scientists)} / ${formatNumber(city?.maxScientists)}`, 'ika-number');
    appendCell(row, formatNumber(Math.floor(Number(city?.research) || 0)), 'ika-number');

    const actionCell = document.createElement('td');
    const position = getPosition(academy);
    if (position !== null) {
      actionCell.appendChild(createButton(t('empire.research.academy'), 'ika-research-action', () => openAcademy(city)));
    } else {
      actionCell.textContent = '-';
    }
    row.appendChild(actionCell);
    tbody.appendChild(row);
  });

  table.append(thead, tbody);
  root.appendChild(table);
}

const research = Object.freeze({
  render(container, cities = []) {
    const root = resolveContainer(container);
    if (!root) return;

    const data = gameData.get() ?? {};
    const cityList = Array.isArray(cities) ? cities : [];
    const wrapper = document.createElement('div');
    wrapper.className = 'ika-research';

    renderSummary(wrapper, data.research, cityList);
    renderCategories(wrapper, data.research);
    renderCityScientists(wrapper, cityList);
    root.replaceChildren(wrapper);
  },
});

export default research;
