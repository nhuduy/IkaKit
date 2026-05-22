// IkaKit — Empire resources table
// Render tài nguyên hiện có của từng thành phố.

const RESOURCE_COLUMNS = Object.freeze([
  ['wood', 'Wood'],
  ['wine', 'Wine'],
  ['marble', 'Marble'],
  ['glass', 'Glass'],
  ['sulfur', 'Sulfur'],
  ['gold', 'Gold'],
  ['population', 'Population'],
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
  // gameData hiện đặt tài nguyên trong city.resources; gold/population có thể
  // được enrich trực tiếp trên city hoặc nằm chung trong resources tùy nguồn data.
  return city?.resources?.[key] ?? city?.[key] ?? null;
}

function appendCell(row, text, className = '') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
}

function createHeader() {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');
  const cityHeader = document.createElement('th');

  cityHeader.textContent = 'City';
  row.appendChild(cityHeader);

  RESOURCE_COLUMNS.forEach(([, label]) => {
    const th = document.createElement('th');
    th.textContent = label;
    row.appendChild(th);
  });

  thead.appendChild(row);

  return thead;
}

function createBody(cities) {
  const tbody = document.createElement('tbody');

  cities.forEach((city) => {
    const row = document.createElement('tr');

    appendCell(row, city?.name ?? `City ${city?.id ?? ''}`.trim(), 'ika-city-name');

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
