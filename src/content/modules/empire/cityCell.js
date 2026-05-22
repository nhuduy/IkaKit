const ISLAND_RESOURCE_ICONS = Object.freeze({
  1: 'icon_wine.png',
  wine: 'icon_wine.png',
  2: 'icon_marble.png',
  marble: 'icon_marble.png',
  3: 'icon_glass.png',
  crystal: 'icon_glass.png',
  glass: 'icon_glass.png',
  4: 'icon_sulfur.png',
  sulphur: 'icon_sulfur.png',
  sulfur: 'icon_sulfur.png',
});

function formatCoords(coords) {
  if (Array.isArray(coords) && coords.length >= 2) {
    return `[${coords[0]}:${coords[1]}]`;
  }

  if (coords && typeof coords === 'object') {
    const x = coords.x ?? coords[0] ?? coords.islandX ?? coords.coordX;
    const y = coords.y ?? coords[1] ?? coords.islandY ?? coords.coordY;

    if (x !== null && typeof x !== 'undefined' && y !== null && typeof y !== 'undefined') {
      return `[${x}:${y}]`;
    }
  }

  if (typeof coords === 'string') {
    const trimmed = coords.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('[') ? trimmed : `[${trimmed.replace(/\s+/g, '')}]`;
  }

  return '';
}

function islandIconPath(city) {
  const key = city?.tradegood ?? city?.tradeGood ?? city?.islandResource ?? city?.resource;
  const icon = ISLAND_RESOURCE_ICONS[String(key).toLowerCase()] ?? ISLAND_RESOURCE_ICONS[key];

  return icon ? browser.runtime.getURL(`assets/images/empire/resources/${icon}`) : '';
}

export function appendCityHeader(row) {
  const th = document.createElement('th');
  th.textContent = 'City';
  row.appendChild(th);

  return th;
}

export function appendCityCell(row, city, tagName = 'td') {
  const cell = document.createElement(tagName);
  const wrap = document.createElement('span');
  const coords = formatCoords(city?.coords);
  const iconPath = islandIconPath(city);
  const name = city?.name ?? `City ${city?.id ?? ''}`.trim();

  cell.className = 'ika-city-name';
  wrap.className = 'ika-city-cell';

  if (iconPath) {
    const icon = document.createElement('img');
    icon.className = 'ika-city-resource-icon';
    icon.alt = '';
    icon.src = iconPath;
    wrap.appendChild(icon);
  }

  if (coords) {
    const coordsEl = document.createElement('span');
    coordsEl.className = 'ika-city-coords';
    coordsEl.textContent = coords;
    wrap.appendChild(coordsEl);
  }

  const nameEl = document.createElement('span');
  nameEl.className = 'ika-city-label';
  nameEl.textContent = name;
  wrap.appendChild(nameEl);

  cell.title = coords ? `${coords} ${name}` : name;
  cell.appendChild(wrap);
  row.appendChild(cell);

  return cell;
}
