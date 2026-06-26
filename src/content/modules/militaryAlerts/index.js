// IkaKit - Military attack notifications.
// Detect incoming hostile military events and hand them to the background script.

import gameEvents from '../../helpers/gameEvents.js';
import storage from '../../helpers/storage.js';
import { getExtensionApi } from '../../helpers/runtime.js';

const MILITARY_SETTINGS_KEY = 'ika_military_alert_settings';
const DEFAULT_MILITARY_SETTINGS = Object.freeze({
  enabled: true,
  panel: true,
  notifications: true,
  badge: true,
  reminders: {
    15: true,
    5: true,
    1: true,
  },
});
const SCAN_DELAY = 500;
const SEND_COOLDOWN = 1500;
const ADVISOR_POLL_INTERVAL = 60 * 1000;
const PANEL_REFRESH_INTERVAL = 30 * 1000;
const EVENT_RETENTION = 6 * 60 * 60 * 1000;
const EVENT_SELECTORS = [
  '[class*="eventMovement"]',
  '[class*="militaryEvent"]',
  '[id*="eventMovement"]',
  '[id*="militaryEvent"]',
  '.militaryAdvisor tr',
  '#militaryAdvisor tr',
  'tr[class*="mission"]',
  'li[class*="mission"]',
  'div[class*="mission"]',
];

const HOSTILE_PATTERNS = Object.freeze([
  /attack/i,
  /blockade/i,
  /occup/i,
  /plunder/i,
  /hostile/i,
  /enemy/i,
  /t[aấ]n c[oô]ng/i,
  /phong t[oỏ]a/i,
  /chi[eế]m/i,
  /c[uư][oơ]p/i,
  /[đd]ịch/i,
]);

const INCOMING_PATTERNS = Object.freeze([
  /incoming/i,
  /inbound/i,
  /arriv/i,
  /approach/i,
  /[đd]ang [đd][eế]n/i,
  /sắp [đd][eế]n/i,
  /[đd][eế]n trong/i,
  /[đd][eế]n nơi/i,
  /bị t[aấ]n c[oô]ng/i,
]);

let scanTimer = null;
let sendTimer = null;
let pollTimer = null;
let panelTimer = null;
let lastSignature = '';
let dismissedPanelSignature = '';
let observer = null;
let alertPanel = null;
let panelContainer = null;
let alertSettings = DEFAULT_MILITARY_SETTINGS;
const seenEvents = new Map();

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const reminders = source.reminders && typeof source.reminders === 'object'
    ? source.reminders
    : {};

  return {
    ...DEFAULT_MILITARY_SETTINGS,
    ...source,
    reminders: {
      ...DEFAULT_MILITARY_SETTINGS.reminders,
      ...reminders,
    },
  };
}

async function loadSettings() {
  alertSettings = normalizeSettings(await storage.get(MILITARY_SETTINGS_KEY));
}

async function saveSettings(nextSettings) {
  alertSettings = normalizeSettings(nextSettings);
  await storage.set(MILITARY_SETTINGS_KEY, alertSettings);

  if (!alertSettings.enabled || !alertSettings.panel) {
    alertPanel?.remove();
    alertPanel = null;
  } else {
    renderAlertPanel();
  }
}

function handleSettingsChange(changes, areaName) {
  if (areaName !== 'local' || !changes[MILITARY_SETTINGS_KEY]) return;

  alertSettings = normalizeSettings(changes[MILITARY_SETTINGS_KEY].newValue);

  if (!alertSettings.enabled || !alertSettings.panel) {
    alertPanel?.remove();
    alertPanel = null;
  } else {
    renderAlertPanel();
  }

  if (panelContainer?.isConnected) {
    renderPanel(panelContainer);
  }
}

function hashText(text) {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function hasPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function readDatasetNumber(element, names) {
  for (const name of names) {
    const value = element?.dataset?.[name] ?? element?.getAttribute?.(`data-${name}`);
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return null;
}

function parseColonDuration(text) {
  const match = text.match(/(?:^|[^0-9])(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[^0-9]|$)/);

  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3] ?? 0);

  if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(third)) {
    return null;
  }

  return match[3]
    ? ((first * 3600) + (second * 60) + third) * 1000
    : ((first * 60) + second) * 1000;
}

function parseWordDuration(text) {
  let totalSeconds = 0;
  let matched = false;
  const pattern = /(\d+)\s*(d|day|days|ng[aà]y|h|hr|hour|hours|gi[oờ]|m|min|minute|minutes|ph[uú]t|s|sec|second|seconds|gi[aâ]y)/gi;

  for (const match of text.matchAll(pattern)) {
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (!Number.isFinite(value)) continue;

    matched = true;

    if (/^(d|day|days|ng)/.test(unit)) {
      totalSeconds += value * 86400;
    } else if (/^(h|hr|hour|hours|gi[oờ])/.test(unit)) {
      totalSeconds += value * 3600;
    } else if (/^(m|min|minute|minutes|ph)/.test(unit)) {
      totalSeconds += value * 60;
    } else {
      totalSeconds += value;
    }
  }

  return matched ? totalSeconds * 1000 : null;
}

function readArrivalAt(element, text) {
  const timestamp = readDatasetNumber(element, [
    'arrival',
    'arrivalAt',
    'end',
    'endTime',
    'enddate',
    'endDate',
    'timestamp',
    'time',
  ]);

  if (timestamp) {
    return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  }

  const timer = element.querySelector?.('[class*="timer"], [id*="timer"], [data-end], [data-enddate], [data-time]');
  const timerTimestamp = readDatasetNumber(timer, [
    'arrival',
    'arrivalAt',
    'end',
    'endTime',
    'enddate',
    'endDate',
    'timestamp',
    'time',
  ]);

  if (timerTimestamp) {
    return timerTimestamp < 100000000000 ? timerTimestamp * 1000 : timerTimestamp;
  }

  const timerText = cleanText([
    timer?.textContent,
    timer?.getAttribute?.('title'),
    text,
  ].filter(Boolean).join(' '));
  const duration = parseColonDuration(timerText) ?? parseWordDuration(timerText);

  return duration ? Date.now() + duration : null;
}

function inferType(text) {
  if (/blockade|phong t[oỏ]a/i.test(text)) return 'blockade';
  if (/occup|chi[eế]m/i.test(text)) return 'occupation';
  return 'attack';
}

function classifySeverity(type, arrivalAt) {
  const remainingMs = Number(arrivalAt) - Date.now();
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  if (remainingMinutes <= 5) return 'critical';
  if (remainingMinutes <= 15 || type === 'occupation') return 'high';
  if (remainingMinutes <= 60 || type === 'blockade') return 'medium';
  return 'low';
}

function severityLabel(severity) {
  const labels = {
    critical: 'Khẩn cấp',
    high: 'Nguy hiểm',
    medium: 'Cần để ý',
    low: 'Theo dõi',
  };

  return labels[severity] ?? labels.low;
}

function typeLabel(type) {
  const labels = {
    attack: 'Tấn công',
    blockade: 'Phong tỏa',
    occupation: 'Chiếm đóng',
  };

  return labels[type] ?? 'Quân sự';
}

function formatTimeLeft(arrivalAt) {
  const remainingMs = Number(arrivalAt) - Date.now();

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 'đang tới nơi';
  }

  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours > 0 && rest > 0) return `${hours}h ${rest}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function readEndpoint(element, names) {
  for (const name of names) {
    const node = element.querySelector?.(`[class*="${name}"], [id*="${name}"], [data-${name}]`);
    const text = cleanText(node?.textContent ?? node?.getAttribute?.(`data-${name}`));

    if (text) return text;
  }

  return '';
}

function parseEventElement(element) {
  const text = cleanText([
    element.textContent,
    element.className,
    element.id,
    element.getAttribute?.('title'),
  ].filter(Boolean).join(' '));

  if (!text || !hasPattern(text, HOSTILE_PATTERNS)) return null;

  const isIncoming = hasPattern(text, INCOMING_PATTERNS)
    || element.classList?.contains('incoming')
    || element.querySelector?.('[class*="incoming"], [title*="incoming" i]');

  if (!isIncoming) return null;

  const arrivalAt = readArrivalAt(element, text);

  if (!arrivalAt || arrivalAt <= Date.now()) return null;

  const origin = readEndpoint(element, ['origin', 'source', 'from', 'startCity', 'start']);
  const target = readEndpoint(element, ['target', 'destination', 'to', 'endCity']);
  const type = inferType(text);
  const id = cleanText(element.getAttribute?.('data-event-id'))
    || cleanText(element.id)
    || `${type}:${hashText(`${text}:${arrivalAt}`)}`;
  const isTest = element.getAttribute?.('data-ika-test') === '1';

  return {
    id,
    type,
    direction: 'incoming',
    origin,
    target,
    arrivalAt,
    severity: classifySeverity(type, arrivalAt),
    isHostile: true,
    isTest,
  };
}

function eventKey(event) {
  return [
    event?.type ?? 'unknown',
    event?.direction ?? 'unknown',
    event?.origin ?? '',
    event?.target ?? '',
    event?.arrivalAt ?? '',
  ].join('|');
}

function parseDocument(root = document) {
  const elements = new Set();

  EVENT_SELECTORS.forEach((selector) => {
    root.querySelectorAll?.(selector).forEach((element) => elements.add(element));
  });

  return [...elements]
    .map(parseEventElement)
    .filter(Boolean);
}

function parseHtml(html) {
  if (!html || typeof DOMParser === 'undefined') return [];

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return parseDocument(doc);
  } catch (error) {
    console.warn('[IkaKit] Không parse được military advisor HTML:', error);
    return [];
  }
}

function uniqueEvents(events) {
  const byId = new Map();

  events.forEach((event) => {
    byId.set(eventKey(event), event);
  });

  return [...byId.values()];
}

function signature(events) {
  return events
    .map((event) => `${event.id}:${event.arrivalAt}`)
    .sort()
    .join('|');
}

function toGameEvent(event) {
  const target = event.target || 'Thành của bạn';
  const origin = event.origin || 'không rõ nguồn';

  return {
    id: `military:${event.id}`,
    type: 'military.incoming',
    category: 'military',
    severity: event.severity,
    title: typeLabel(event.type),
    message: `${target} từ ${origin}, còn ${formatTimeLeft(event.arrivalAt)}.`,
    payload: {
      militaryEvent: event,
    },
    dedupeKey: `military:${eventKey(event)}`,
    observedAt: event.firstSeenAt || Date.now(),
    expiresAt: Number(event.arrivalAt) + 60 * 1000,
    source: 'militaryAlerts',
  };
}

function sendEvents(events) {
  const unique = uniqueEvents(events);
  const nextSignature = signature(unique);

  if (!unique.length || nextSignature === lastSignature) return;

  lastSignature = nextSignature;

  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => {
    gameEvents.emitMany(unique.map(toGameEvent));
  }, SEND_COOLDOWN);
}

function getActiveEvents() {
  const now = Date.now();
  const cutoff = now - EVENT_RETENTION;

  for (const [key, event] of seenEvents.entries()) {
    const arrivalAt = Number(event.arrivalAt);
    const lastSeenAt = Number(event.lastSeenAt ?? 0);

    if (!Number.isFinite(arrivalAt) || arrivalAt <= now || lastSeenAt < cutoff) {
      seenEvents.delete(key);
    }
  }

  return [...seenEvents.values()]
    .map((event) => ({
      ...event,
      severity: classifySeverity(event.type, event.arrivalAt),
    }))
    .sort((left, right) => Number(left.arrivalAt) - Number(right.arrivalAt));
}

function rememberEvents(events) {
  const now = Date.now();

  uniqueEvents(events).forEach((event) => {
    const key = eventKey(event);
    const existing = seenEvents.get(key);

    seenEvents.set(key, {
      ...existing,
      ...event,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
      severity: classifySeverity(event.type, event.arrivalAt),
    });
  });

  return getActiveEvents();
}

function createAlertPanel() {
  const panel = document.createElement('section');
  const head = document.createElement('div');
  const title = document.createElement('div');
  const closeButton = document.createElement('button');
  const body = document.createElement('div');

  panel.className = 'ika-military-alert-panel';

  head.className = 'ika-military-alert-head';
  title.className = 'ika-military-alert-title';
  title.textContent = 'Military Alerts';

  closeButton.className = 'ika-military-alert-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Ẩn Military Alerts');
  closeButton.textContent = '×';

  body.className = 'ika-military-alert-body';

  closeButton.addEventListener('click', () => {
    dismissedPanelSignature = signature(getActiveEvents());
    panel.remove();
    alertPanel = null;
  });

  head.append(title, closeButton);
  panel.append(head, body);
  document.body.append(panel);
  return panel;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderAlertPanel() {
  if (!alertSettings.enabled || !alertSettings.panel) {
    alertPanel?.remove();
    alertPanel = null;
    return;
  }

  const events = getActiveEvents();
  const activeSignature = signature(events);

  if (!events.length) {
    alertPanel?.remove();
    alertPanel = null;
    dismissedPanelSignature = '';
    return;
  }

  if (!alertPanel && activeSignature === dismissedPanelSignature) return;

  if (!alertPanel || !document.body.contains(alertPanel)) {
    alertPanel = createAlertPanel();
  }

  const body = alertPanel.querySelector('.ika-military-alert-body');
  if (!body) return;

  body.replaceChildren(...events.slice(0, 5).map((event) => {
    const row = document.createElement('article');
    const meta = document.createElement('div');
    const route = document.createElement('div');
    const target = event.target || 'Thành của bạn';
    const origin = event.origin || 'không rõ nguồn';

    row.className = `ika-military-alert-row ika-military-alert-${event.severity}`;

    meta.className = 'ika-military-alert-meta';
    meta.append(
      createTextElement('span', 'ika-military-alert-badge', severityLabel(event.severity)),
      createTextElement('span', '', typeLabel(event.type)),
      createTextElement('strong', '', formatTimeLeft(event.arrivalAt)),
    );

    route.className = 'ika-military-alert-route';
    route.append(
      createTextElement('span', '', target),
      createTextElement('small', '', `từ ${origin}`),
    );

    row.append(meta, route);

    return row;
  }));
}

function getStatus() {
  const events = getActiveEvents();
  return {
    title: 'Military Alerts',
    message: alertSettings.enabled
      ? (events.length ? `${events.length} incoming hostile event${events.length === 1 ? '' : 's'}.` : 'Monitoring incoming hostile movements.')
      : 'Military alerts are disabled.',
  };
}

function createSettingsCheckbox(label, checked, onChange) {
  const wrapper = document.createElement('label');
  wrapper.className = 'ika-alerts-check';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onChange(input.checked));

  const text = document.createElement('span');
  text.textContent = label;

  wrapper.append(input, text);
  return wrapper;
}

function renderSettingsControls(container) {
  const settings = normalizeSettings(alertSettings);
  const controls = document.createElement('div');
  controls.className = 'ika-alerts-settings-grid';

  const update = async (patch) => {
    const next = normalizeSettings({
      ...alertSettings,
      ...patch,
      reminders: {
        ...alertSettings.reminders,
        ...(patch.reminders || {}),
      },
    });

    try {
      await saveSettings(next);
      renderPanel(container);
    } catch (error) {
      console.warn('[IkaKit] Không lưu được Military Alerts settings:', error);
      renderPanel(container);
    }
  };

  controls.append(
    createSettingsCheckbox('Enable Military Alerts', settings.enabled, (checked) => update({ enabled: checked })),
    createSettingsCheckbox('Show in-game panel', settings.panel, (checked) => update({ panel: checked })),
    createSettingsCheckbox('Desktop notifications', settings.notifications, (checked) => update({ notifications: checked })),
    createSettingsCheckbox('Extension badge count', settings.badge, (checked) => update({ badge: checked })),
  );

  const reminders = document.createElement('fieldset');
  reminders.className = 'ika-alerts-reminders';
  const legend = document.createElement('legend');
  legend.textContent = 'Reminders';
  reminders.append(
    legend,
    createSettingsCheckbox('15 minutes before arrival', settings.reminders[15], (checked) => update({ reminders: { 15: checked } })),
    createSettingsCheckbox('5 minutes before arrival', settings.reminders[5], (checked) => update({ reminders: { 5: checked } })),
    createSettingsCheckbox('1 minute before arrival', settings.reminders[1], (checked) => update({ reminders: { 1: checked } })),
  );

  return [controls, reminders];
}

function renderPanel(container) {
  if (!container) return;
  panelContainer = container;

  const events = getActiveEvents();
  const status = document.createElement('div');
  status.className = 'ika-alerts-status-card';
  const title = document.createElement('strong');
  title.textContent = 'Military Alerts';
  const message = document.createElement('span');
  message.textContent = getStatus().message;
  status.append(title, message);

  const actions = document.createElement('div');
  actions.className = 'ika-alerts-actions';
  const scan = document.createElement('button');
  scan.type = 'button';
  scan.className = 'ika-alerts-button';
  scan.textContent = 'Scan now';
  scan.addEventListener('click', () => {
    requestAdvisorScan();
    scheduleScan();
    renderPanel(container);
  });
  actions.appendChild(scan);

  const settingsControls = renderSettingsControls(container);

  const list = document.createElement('div');
  list.className = 'ika-military-alert-body ika-military-alert-body-embedded';
  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'ika-alerts-empty';
    empty.textContent = 'No incoming hostile movements.';
    list.appendChild(empty);
  } else {
    events.slice(0, 8).forEach((event) => {
      const row = document.createElement('article');
      row.className = `ika-military-alert-row ika-military-alert-${event.severity}`;
      row.append(
        createTextElement('div', 'ika-military-alert-meta', `${severityLabel(event.severity)} · ${typeLabel(event.type)} · ${formatTimeLeft(event.arrivalAt)}`),
        createTextElement('div', 'ika-military-alert-route', `${event.target || 'Thành của bạn'} từ ${event.origin || 'không rõ nguồn'}`),
      );
      list.appendChild(row);
    });
  }

  container.replaceChildren(status, ...settingsControls, actions, list);
}

function handleDetectedEvents(events) {
  if (!alertSettings.enabled) {
    alertPanel?.remove();
    alertPanel = null;
    return;
  }

  const activeEvents = rememberEvents(events);

  renderAlertPanel();
  sendEvents(activeEvents);
  if (panelContainer?.isConnected) renderPanel(panelContainer);
}

function clearTestEvents() {
  for (const [key, event] of seenEvents.entries()) {
    if (event.isTest) seenEvents.delete(key);
  }

  dismissedPanelSignature = '';
  renderAlertPanel();
  if (panelContainer?.isConnected) renderPanel(panelContainer);
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    handleDetectedEvents(parseDocument(document));
  }, SCAN_DELAY);
}

function requestAdvisorScan() {
  window.postMessage({
    __ikakit: 'requestMilitaryAdvisorScan',
  }, '*');
}

function scheduleAdvisorPoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    requestAdvisorScan();
    scheduleAdvisorPoll();
  }, ADVISOR_POLL_INTERVAL);
}

const militaryAlerts = Object.freeze({
  init() {
    if (observer) return;

    loadSettings()
      .then(renderAlertPanel)
      .catch((error) => console.warn('[IkaKit] Không load được Military Alerts settings:', error));
    getExtensionApi()?.storage?.onChanged?.addListener(handleSettingsChange);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!event.data) return;

      if (event.data.__ikakit === 'clearMilitaryAlertTests') {
        clearTestEvents();
        return;
      }

      if (event.data.__ikakit !== 'militaryAdvisorHtml') return;

      handleDetectedEvents(parseHtml(event.data.html));
    });

    requestAdvisorScan();
    scheduleAdvisorPoll();
    panelTimer = setInterval(renderAlertPanel, PANEL_REFRESH_INTERVAL);

    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    scheduleScan();
  },

  renderPanel,
  getStatus,
});

export default militaryAlerts;
