// IkaKit - Town News Notification Alert.
// Watch rendered Town News rows and emit important occurred events.

import gameEvents from '../../helpers/gameEvents.js';
import { sendRuntimeMessage } from '../../helpers/runtime.js';
import storage from '../../helpers/storage.js';
import { onLanguageChange, t } from '../../../shared/i18n/index.js';

const STORAGE_KEY = 'ika_notification_alert_settings';
const SCAN_DELAY = 500;
const MAX_RECENT = 10;
const EVENT_TTL = 24 * 60 * 60 * 1000;
const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  notifications: true,
});

let settings = { ...DEFAULT_SETTINGS };
let loaded = false;
let observer = null;
let scanTimer = null;
let panelRenderTimer = null;
let panelContainer = null;
let lastScanAt = null;
let lastTestResult = null;
let detectedCount = 0;
let lastScanRows = 0;
let lastScanAlerts = 0;
let recentAlerts = [];
let unsubscribeLanguage = null;
const seenKeys = new Set();

function normalizeSettings(source) {
  const value = source && typeof source === 'object' ? source : {};
  return {
    ...DEFAULT_SETTINGS,
    ...value,
  };
}

async function loadSettings() {
  settings = normalizeSettings(await storage.get(STORAGE_KEY));
  loaded = true;
}

async function saveSettings(nextSettings) {
  settings = normalizeSettings(nextSettings);
  await storage.set(STORAGE_KEY, settings);
  scheduleScan();
  schedulePanelRender();
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeKeyPart(value) {
  return cleanText(value).toLowerCase();
}

function eventKey(event) {
  return [
    'townNews',
    normalizeKeyPart(event.category),
    normalizeKeyPart(event.location),
    normalizeKeyPart(event.gameDateText),
    normalizeKeyPart(event.subject),
  ].join(':');
}

function getNodeEvidence(node) {
  if (!node) return '';

  const parts = [
    node.className,
    node.id,
    node.getAttribute?.('title'),
    node.getAttribute?.('alt'),
    node.getAttribute?.('data-category'),
    node.getAttribute?.('data-type'),
  ];

  node.querySelectorAll?.('img, span, i, div').forEach((child) => {
    parts.push(
      child.className,
      child.id,
      child.getAttribute?.('title'),
      child.getAttribute?.('alt'),
      child.getAttribute?.('src'),
      child.getAttribute?.('data-category'),
      child.getAttribute?.('data-type'),
    );
  });

  return cleanText(parts.filter(Boolean).join(' ')).toLowerCase();
}

function inferCategory(row, cells, subject) {
  const iconEvidence = getNodeEvidence(cells[0]);
  const rowEvidence = getNodeEvidence(row);
  const subjectEvidence = cleanText(subject).toLowerCase();
  const evidence = `${iconEvidence} ${rowEvidence}`;

  if (/espionage|spy|spies|spionage|binocular/i.test(evidence)
    || /\b(spy|spies|espionage|spied)\b/i.test(subjectEvidence)) {
    return 'espionage';
  }

  if (/military|attack|blockade|occupation|plunder|battle|combat|troop/i.test(evidence)
    || /\b(attack|blockade|occupation|plunder|battle|combat|troops|military)\b/i.test(subjectEvidence)) {
    return 'military';
  }

  if (/diplomacy|diplomat|treaty/i.test(evidence)) return 'diplomacy';
  if (/piracy|pirate/i.test(evidence)) return 'piracy';
  if (/goods|trade|transport|resource/i.test(evidence) || /trade fleet|unloads/i.test(subjectEvidence)) return 'goods';
  if (/production|building|construct/i.test(evidence) || /building .* expanded|was expanded/i.test(subjectEvidence)) return 'production';
  if (/news/i.test(evidence)) return 'news';

  return 'townNews';
}

function findHeaderIndex(cells, pattern) {
  return cells.findIndex((cell) => pattern.test(cleanText(cell.textContent)));
}

function parseRow(row) {
  const cells = [...row.querySelectorAll(':scope > th, :scope > td')];
  if (cells.length < 3) return null;

  const cellTexts = cells.map((cell) => cleanText(cell.textContent));
  if (cellTexts.some((text) => /^(location|date|subject)$/i.test(text))) return null;

  let locationIndex = findHeaderIndex(cells, /\b(location|town|city)\b/i);
  let dateIndex = findHeaderIndex(cells, /\bdate\b/i);
  let subjectIndex = findHeaderIndex(cells, /\bsubject\b/i);

  if (locationIndex < 0 || dateIndex < 0 || subjectIndex < 0) {
    const offset = cells.length >= 4 ? 1 : 0;
    locationIndex = offset;
    dateIndex = offset + 1;
    subjectIndex = offset + 2;
  }

  const location = cellTexts[locationIndex];
  const gameDateText = cellTexts[dateIndex];
  const subject = cellTexts.slice(subjectIndex).join(' ');

  if (!location || !subject || !/\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}/.test(gameDateText)) {
    return null;
  }

  const category = inferCategory(row, cells, subject);
  return {
    category,
    location,
    gameDateText,
    subject,
  };
}

function looksLikeTownNewsContainer(container) {
  const text = cleanText(container.textContent).toLowerCase();
  return text.includes('town news')
    || text.includes('current events')
    || (text.includes('location') && text.includes('date') && text.includes('subject'));
}

function findTownNewsContainers(root = document) {
  const containers = new Set();

  root.querySelectorAll?.('table').forEach((table) => {
    if (looksLikeTownNewsContainer(table)) containers.add(table);
  });

  root.querySelectorAll?.('div, section, article').forEach((node) => {
    if (!looksLikeTownNewsContainer(node)) return;
    const table = node.querySelector('table');
    containers.add(table || node);
  });

  return [...containers];
}

function parseDocument(root = document) {
  const byKey = new Map();

  findTownNewsContainers(root).forEach((container) => {
    container.querySelectorAll?.('tr').forEach((row) => {
      const event = parseRow(row);
      if (!event) return;
      byKey.set(eventKey(event), event);
    });
  });

  return [...byKey.values()];
}

function shouldAlert(event) {
  return ['espionage', 'military'].includes(event.category);
}

function toGameEvent(event, key, isTest = false) {
  const now = Date.now();
  const type = `townNews.${event.category}`;
  const title = event.category === 'espionage'
    ? t('notificationAlerts.townNewsEspionage')
    : event.category === 'military'
      ? t('notificationAlerts.townNewsMilitary')
      : t('notificationAlerts.townNews');

  return {
    id: `${type}:${hashText(key)}`,
    type,
    category: event.category,
    severity: shouldAlert(event) ? 'high' : 'info',
    title,
    message: `${event.location}: ${event.subject}`,
    payload: {
      status: 'occurred',
      cityName: event.location,
      location: event.location,
      gameDateText: event.gameDateText,
      subject: event.subject,
      suppressNotification: !settings.notifications,
      isTest,
    },
    dedupeKey: key,
    observedAt: now,
    updatedAt: now,
    expiresAt: now + EVENT_TTL,
    source: 'notificationAlerts',
  };
}

function rememberRecent(event) {
  recentAlerts = [{ ...event, detectedAt: Date.now() }, ...recentAlerts]
    .slice(0, MAX_RECENT);
}

function handleDetectedEvents(events) {
  lastScanAt = Date.now();
  lastScanRows = events.length;
  lastScanAlerts = 0;

  if (!settings.enabled) {
    schedulePanelRender();
    return;
  }

  events.forEach((event) => {
    if (!shouldAlert(event)) return;

    const key = eventKey(event);
    if (seenKeys.has(key)) return;

    seenKeys.add(key);
    detectedCount += 1;
    lastScanAlerts += 1;
    rememberRecent(event);
    gameEvents.emit(toGameEvent(event, key));
  });

  schedulePanelRender();
}

function scheduleScan() {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    handleDetectedEvents(parseDocument(document));
  }, SCAN_DELAY);
}

function scanNow() {
  clearTimeout(scanTimer);
  scanTimer = null;
  handleDetectedEvents(parseDocument(document));
}

function mutationElement(target) {
  if (target instanceof Element) return target;
  return target?.parentElement ?? null;
}

function isOwnUiMutation(mutations) {
  return Array.from(mutations || []).every((mutation) => {
    const element = mutationElement(mutation.target);
    return Boolean(element?.closest?.([
      '#ika-alerts-modal',
      '.ika-military-alert-panel',
      '.ika-notification-alert-list',
    ].join(',')));
  });
}

function formatTime(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return t('notificationAlerts.time.never');
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function createButton(text, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
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

async function emitTestSpyNotification() {
  const event = {
    category: 'espionage',
    location: document.querySelector('#js_cityBread')?.textContent || t('notificationAlerts.currentCity'),
    gameDateText: new Date().toLocaleString(),
    subject: t('notificationAlerts.testSubject'),
  };
  const key = `townNews:test:espionage:${Date.now()}`;
  detectedCount += 1;
  rememberRecent(event);
  gameEvents.emit(toGameEvent(event, key, true));

  try {
    const response = await sendRuntimeMessage({ __ikakit: 'notificationAlertTest' });
    lastTestResult = response?.ok
      ? t('notificationAlerts.test.accepted', { time: formatTime(Date.now()) })
      : t('notificationAlerts.test.failed', { error: response?.error || t('notificationAlerts.test.noResponse') });
  } catch (error) {
    lastTestResult = t('notificationAlerts.test.failed', { error: String(error?.message || error) });
  }

  schedulePanelRender();
}

function clearDetectedTownNews() {
  seenKeys.clear();
  recentAlerts = [];
  detectedCount = 0;
  lastScanAlerts = 0;
  schedulePanelRender();
}

function renderRecentAlerts() {
  const list = document.createElement('div');
  list.className = 'ika-notification-alert-list';

  if (!recentAlerts.length) {
    const empty = document.createElement('div');
    empty.className = 'ika-alerts-empty';
    empty.textContent = t('notificationAlerts.empty');
    list.appendChild(empty);
    return list;
  }

  recentAlerts.forEach((event) => {
    const row = document.createElement('article');
    const meta = document.createElement('div');
    const message = document.createElement('div');
    const foot = document.createElement('div');

    row.className = `ika-notification-alert-row ika-notification-alert-${shouldAlert(event) ? 'high' : 'info'}`;
    meta.className = 'ika-notification-alert-meta';
    message.className = 'ika-notification-alert-message';
    foot.className = 'ika-notification-alert-foot';

    const badge = document.createElement('span');
    badge.className = 'ika-notification-alert-badge';
    badge.textContent = event.category;
    const location = document.createElement('strong');
    location.textContent = event.location;
    const date = document.createElement('span');
    date.textContent = event.gameDateText;

    meta.append(badge, location, date);
    message.textContent = event.subject;
    foot.textContent = t('notificationAlerts.detectedAt', { time: formatTime(event.detectedAt) });
    row.append(meta, message, foot);
    list.appendChild(row);
  });

  return list;
}

function renderPanel(container) {
  if (!container) return;
  panelContainer = container;

  const status = document.createElement('div');
  status.className = 'ika-alerts-status-card';
  const title = document.createElement('strong');
  title.textContent = t('notificationAlerts.title');
  const message = document.createElement('span');
  message.textContent = settings.enabled
    ? t('notificationAlerts.status.detectedWithScan', {
      count: detectedCount,
      alertLabel: t(detectedCount === 1 ? 'notificationAlerts.status.alertSingular' : 'notificationAlerts.status.alertPlural'),
      time: formatTime(lastScanAt),
    })
    : t('notificationAlerts.status.disabled');
  const scanMeta = document.createElement('small');
  scanMeta.textContent = t('notificationAlerts.scanMeta', {
    rows: lastScanRows,
    rowLabel: t(lastScanRows === 1 ? 'notificationAlerts.scanMeta.rowSingular' : 'notificationAlerts.scanMeta.rowPlural'),
    alerts: lastScanAlerts,
    alertLabel: t(lastScanAlerts === 1 ? 'notificationAlerts.status.alertSingular' : 'notificationAlerts.status.alertPlural'),
  });
  status.append(title, message, scanMeta);
  if (lastTestResult) {
    const testMeta = document.createElement('small');
    testMeta.textContent = lastTestResult;
    status.appendChild(testMeta);
  }

  const controls = document.createElement('div');
  controls.className = 'ika-alerts-settings-grid';
  controls.append(
    createSettingsCheckbox(t('notificationAlerts.setting.enable'), settings.enabled, (checked) => saveSettings({ ...settings, enabled: checked })),
    createSettingsCheckbox(t('notificationAlerts.setting.notifications'), settings.notifications, (checked) => saveSettings({ ...settings, notifications: checked })),
  );

  const actions = document.createElement('div');
  actions.className = 'ika-alerts-actions';
  actions.append(
    createButton(t('notificationAlerts.action.scan'), 'ika-alerts-button', scanNow),
    createButton(t('notificationAlerts.action.testSpy'), 'ika-alerts-button', emitTestSpyNotification),
    createButton(t('notificationAlerts.action.clearTownNews'), 'ika-alerts-button', clearDetectedTownNews),
  );

  container.replaceChildren(status, controls, actions, renderRecentAlerts());
}

function schedulePanelRender() {
  clearTimeout(panelRenderTimer);
  panelRenderTimer = setTimeout(() => {
    if (!panelContainer?.isConnected) {
      panelContainer = null;
      return;
    }
    renderPanel(panelContainer);
  }, 80);
}

const notificationAlerts = Object.freeze({
  init() {
    if (observer) return;

    loadSettings()
      .then(() => {
        scheduleScan();
      })
      .catch((error) => {
        loaded = true;
        console.warn('[IkaKit] Could not load Notification Alert settings:', error);
        scheduleScan();
      });

    observer = new MutationObserver((mutations) => {
      if (isOwnUiMutation(mutations)) return;
      scheduleScan();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    if (!unsubscribeLanguage) {
      unsubscribeLanguage = onLanguageChange(() => {
        if (panelContainer?.isConnected) renderPanel(panelContainer);
      });
    }
  },

  destroy() {
    observer?.disconnect();
    observer = null;
    clearTimeout(scanTimer);
    clearTimeout(panelRenderTimer);
    unsubscribeLanguage?.();
    unsubscribeLanguage = null;
    panelContainer = null;
  },

  renderPanel,

  getStatus() {
    return {
      title: t('notificationAlerts.title'),
      message: loaded && settings.enabled
        ? t('notificationAlerts.status.detected', {
          count: detectedCount,
          alertLabel: t(detectedCount === 1 ? 'notificationAlerts.status.alertSingular' : 'notificationAlerts.status.alertPlural'),
        })
        : t('notificationAlerts.status.disabled'),
    };
  },
});

export default notificationAlerts;
