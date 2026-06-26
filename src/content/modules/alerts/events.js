// IkaKit - Compact Events tab for the Alerts panel.

import gameEvents from '../../helpers/gameEvents.js';

const FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'military', label: 'Military' },
  { id: 'townNews', label: 'Town News' },
  { id: 'game', label: 'Game' },
]);

let activeFilter = 'all';
let panelContainer = null;
let unsubscribe = null;
let renderTimer = null;
let copyStatus = '';

function bucketForEvent(event) {
  if (event?.source === 'notificationAlerts' || String(event?.type || '').startsWith('townNews.')) {
    return 'townNews';
  }

  if (event?.category === 'military' || String(event?.type || '').startsWith('military.')) {
    return 'military';
  }

  return 'game';
}

function bucketLabel(bucket) {
  return FILTERS.find((filter) => filter.id === bucket)?.label || 'Game';
}

function formatTime(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return 'Unknown';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatEventTime(event) {
  const observed = formatTime(event.observedAt);
  const expires = formatTime(event.expiresAt);
  return `Seen ${observed} · active until ${expires}`;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (!panelContainer?.isConnected) {
      panelContainer = null;
      return;
    }

    renderPanel(panelContainer);
  }, 80);
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.className = 'ika-game-event-copy-buffer';
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function copyEvents() {
  try {
    await writeClipboard(JSON.stringify(gameEvents.toJSON(), null, 2));
    copyStatus = `Copied ${gameEvents.getActiveEvents().length} event${gameEvents.getActiveEvents().length === 1 ? '' : 's'}.`;
  } catch (error) {
    copyStatus = `Copy failed: ${String(error?.message || error)}`;
  }

  scheduleRender();
}

function clearEvents() {
  gameEvents.clear();
  copyStatus = 'Events cleared.';
  scheduleRender();
}

function filteredEvents() {
  const events = gameEvents.getActiveEvents();
  if (activeFilter === 'all') return events;
  return events.filter((event) => bucketForEvent(event) === activeFilter);
}

function groupedEvents(events) {
  return events.reduce((groups, event) => {
    const bucket = bucketForEvent(event);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(event);
    return groups;
  }, new Map());
}

function renderFilters() {
  const filters = document.createElement('div');
  filters.className = 'ika-game-event-filters';

  FILTERS.forEach((filter) => {
    const button = createButton(filter.label, 'ika-game-event-filter', () => {
      activeFilter = filter.id;
      scheduleRender();
    });
    button.classList.toggle('ika-game-event-filter-active', activeFilter === filter.id);
    filters.appendChild(button);
  });

  return filters;
}

function renderEventRow(event) {
  const row = document.createElement('article');
  const meta = document.createElement('div');
  const title = document.createElement('strong');
  const badge = document.createElement('span');
  const message = document.createElement('div');
  const foot = document.createElement('div');

  row.className = `ika-game-event-row ika-game-event-${event.severity || 'info'}`;
  meta.className = 'ika-game-event-meta';
  title.textContent = event.title || event.type || 'Game Event';
  badge.className = 'ika-game-event-badge';
  badge.textContent = event.severity || 'info';
  message.className = 'ika-game-event-message';
  message.textContent = event.message || event.type || '-';
  foot.className = 'ika-game-event-foot';
  foot.textContent = `${event.type || 'game.unknown'} · ${formatEventTime(event)}`;

  meta.append(title, badge);
  row.append(meta, message, foot);
  return row;
}

function renderEventGroups(events) {
  const body = document.createElement('div');
  body.className = 'ika-game-event-body';

  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'ika-game-event-empty';
    empty.textContent = 'No active events.';
    body.appendChild(empty);
    return body;
  }

  groupedEvents(events).forEach((groupEvents, bucket) => {
    const group = document.createElement('section');
    const heading = document.createElement('h3');
    const list = document.createElement('div');
    group.className = 'ika-game-event-group';
    heading.textContent = bucketLabel(bucket);
    list.className = 'ika-game-event-list';
    groupEvents.forEach((event) => list.appendChild(renderEventRow(event)));
    group.append(heading, list);
    body.appendChild(group);
  });

  return body;
}

function renderPanel(container) {
  if (!container) return;
  panelContainer = container;

  if (!unsubscribe) {
    unsubscribe = gameEvents.on(scheduleRender);
  }

  const panel = document.createElement('div');
  const header = document.createElement('div');
  const title = document.createElement('strong');
  const meta = document.createElement('span');
  const actions = document.createElement('div');
  const filtersHost = document.createElement('div');
  const events = filteredEvents();

  panel.className = 'ika-game-event-panel ika-game-event-panel-embedded';
  header.className = 'ika-game-event-header';
  title.textContent = 'Events';
  meta.textContent = `${events.length} active`;
  header.append(title, meta);

  actions.className = 'ika-game-event-actions';
  actions.append(
    createButton('Refresh', 'ika-game-event-button', scheduleRender),
    createButton('Copy', 'ika-game-event-button', copyEvents),
    createButton('Clear', 'ika-game-event-button', clearEvents),
  );

  filtersHost.className = 'ika-game-event-filters-host';
  filtersHost.appendChild(renderFilters());

  panel.append(header, actions, filtersHost, renderEventGroups(events));

  if (copyStatus) {
    const status = document.createElement('div');
    status.className = 'ika-game-event-status';
    status.textContent = copyStatus;
    panel.appendChild(status);
  }

  container.replaceChildren(panel);
}

const alertEvents = Object.freeze({
  renderPanel,

  getStatus() {
    return {
      title: 'Events',
      message: `${gameEvents.getActiveEvents().length} active event${gameEvents.getActiveEvents().length === 1 ? '' : 's'}.`,
    };
  },
});

export default alertEvents;
