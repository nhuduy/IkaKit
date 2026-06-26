// IkaKit — Background Service Worker (Chrome) / Background Script (Firefox)
// Dùng browser.* thay vì chrome.* — webextension-polyfill lo phần còn lại

const MILITARY_EVENTS_KEY = 'ika_military_alert_events';
const MILITARY_SETTINGS_KEY = 'ika_military_alert_settings';
const GAME_EVENTS_KEY = 'ika_game_events:background';
const MILITARY_ALERT_PREFIX = 'ikakit:military:';
const MILITARY_CLEANUP_PREFIX = `${MILITARY_ALERT_PREFIX}cleanup:`;
const REMINDER_OFFSETS = Object.freeze([15, 5, 1]);
const MAX_EVENT_AGE = 6 * 60 * 60 * 1000;
const MAX_GAME_EVENTS = 300;
const extensionApi = globalThis.browser ?? globalThis.chrome;
const usesPromiseApi = Boolean(globalThis.browser);
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
const SEVERITY_LABELS = Object.freeze({
  critical: 'Khẩn cấp',
  high: 'Nguy hiểm',
  medium: 'Cần để ý',
  low: 'Theo dõi',
});

function promisify(callbackStyleCall) {
  return new Promise((resolve, reject) => {
    try {
      const result = callbackStyleCall((value) => {
        const error = extensionApi.runtime.lastError;

        if (error) {
          reject(error);
          return;
        }

        resolve(value);
      });

      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function storageGet(key) {
  if (usesPromiseApi) {
    return extensionApi.storage.local.get(key);
  }

  return promisify((done) => extensionApi.storage.local.get(key, done));
}

function storageSet(value) {
  if (usesPromiseApi) {
    return extensionApi.storage.local.set(value);
  }

  return promisify((done) => extensionApi.storage.local.set(value, done));
}

function notificationCreate(id, options) {
  if (usesPromiseApi) {
    return extensionApi.notifications.create(id, options);
  }

  return promisify((done) => extensionApi.notifications.create(id, options, done));
}

function alarmCreate(name, options) {
  if (usesPromiseApi) {
    return extensionApi.alarms.create(name, options);
  }

  return promisify((done) => {
    extensionApi.alarms.create(name, options);
    done();
  });
}

function actionSetBadgeText(details) {
  const actionApi = extensionApi.action ?? extensionApi.browserAction;
  if (!actionApi?.setBadgeText) return Promise.resolve();

  if (usesPromiseApi) {
    return actionApi.setBadgeText(details);
  }

  return promisify((done) => actionApi.setBadgeText(details, done));
}

function actionSetBadgeBackgroundColor(details) {
  const actionApi = extensionApi.action ?? extensionApi.browserAction;
  if (!actionApi?.setBadgeBackgroundColor) return Promise.resolve();

  if (usesPromiseApi) {
    return actionApi.setBadgeBackgroundColor(details);
  }

  return promisify((done) => actionApi.setBadgeBackgroundColor(details, done));
}

function normalizeMilitarySettings(value) {
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

async function getMilitarySettings() {
  const result = await storageGet(MILITARY_SETTINGS_KEY);
  return normalizeMilitarySettings(result[MILITARY_SETTINGS_KEY]);
}

extensionApi.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[IkaKit] Đã cài đặt thành công.');
  }

  if (reason === 'update') {
    console.log('[IkaKit] Đã cập nhật lên phiên bản mới.');
  }

  refreshMilitaryBadge().catch((error) => {
    console.warn('[IkaKit] Không cập nhật được badge quân sự:', error);
  });
});

extensionApi.runtime.onStartup?.addListener(() => {
  refreshMilitaryBadge().catch((error) => {
    console.warn('[IkaKit] Không cập nhật được badge quân sự:', error);
  });
});

function eventKey(event) {
  return [
    event?.type ?? 'unknown',
    event?.direction ?? 'unknown',
    event?.origin ?? '',
    event?.target ?? '',
    event?.arrivalAt ?? '',
  ].join('|');
}

function gameEventKey(event) {
  return String(event?.dedupeKey || [
    event?.category ?? 'game',
    event?.type ?? 'game.unknown',
    event?.cityId ?? '',
    event?.id ?? '',
  ].join('|'));
}

function normalizeGameEvent(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const observedAt = Number(event.observedAt) || Date.now();
  const expiresAt = Number(event.expiresAt) || observedAt + MAX_EVENT_AGE;

  if (expiresAt <= Date.now()) {
    return null;
  }

  return {
    id: String(event.id || gameEventKey(event)),
    type: String(event.type || 'game.unknown'),
    category: String(event.category || 'game'),
    severity: String(event.severity || 'info'),
    cityId: event.cityId ?? null,
    title: String(event.title || event.type || 'Game Event'),
    message: String(event.message || ''),
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
    dedupeKey: gameEventKey(event),
    observedAt,
    updatedAt: Number(event.updatedAt) || Date.now(),
    expiresAt,
    source: String(event.source || 'content'),
  };
}

function alarmName(event, minutesBefore) {
  return `${MILITARY_ALERT_PREFIX}${minutesBefore}:${event.id}`;
}

function cleanupAlarmName(event) {
  return `${MILITARY_CLEANUP_PREFIX}${event.id}`;
}

function notificationId(event, suffix = 'now') {
  return `${MILITARY_ALERT_PREFIX}${suffix}:${event.id}`;
}

function classifySeverity(type, arrivalAt) {
  const remainingMs = Number(arrivalAt) - Date.now();
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  if (remainingMinutes <= 5) {
    return 'critical';
  }

  if (remainingMinutes <= 15 || type === 'occupation') {
    return 'high';
  }

  if (remainingMinutes <= 60 || type === 'blockade') {
    return 'medium';
  }

  return 'low';
}

function severityRank(severity) {
  return {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }[severity] ?? 0;
}

function badgeColor(severity) {
  return {
    critical: '#9a2f1f',
    high: '#a8511f',
    medium: '#8a681d',
    low: '#627a27',
  }[severity] ?? '#627a27';
}

function formatRemaining(arrivalAt) {
  const remainingMs = Number(arrivalAt) - Date.now();

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 'sắp tới nơi';
  }

  const minutes = Math.max(1, Math.round(remainingMs / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours > 0 && rest > 0) {
    return `còn ${hours}h ${rest}m`;
  }

  if (hours > 0) {
    return `còn ${hours}h`;
  }

  return `còn ${minutes} phút`;
}

function eventTitle(event, reminderMinutes = null) {
  const severity = SEVERITY_LABELS[event.severity] ?? SEVERITY_LABELS.low;

  if (reminderMinutes !== null) {
    return `Ikariam: ${severity}, còn ${reminderMinutes} phút`;
  }

  if (event.type === 'blockade') {
    return `Ikariam: ${severity}, có phong tỏa incoming`;
  }

  if (event.type === 'occupation') {
    return `Ikariam: ${severity}, có chiếm đóng incoming`;
  }

  return `Ikariam: ${severity}, bạn đang bị tấn công`;
}

function eventMessage(event) {
  const target = event.target ? `Thành ${event.target}` : 'Thành của bạn';
  const origin = event.origin ? ` từ ${event.origin}` : '';

  return `${target}${origin}, ${formatRemaining(event.arrivalAt)}.`;
}

async function getStoredEvents() {
  const result = await storageGet(MILITARY_EVENTS_KEY);
  const events = result[MILITARY_EVENTS_KEY];

  return Array.isArray(events) ? events : [];
}

async function saveStoredEvents(events) {
  const cutoff = Date.now() - MAX_EVENT_AGE;
  const activeEvents = events.filter((event) => {
    const arrivalAt = Number(event.arrivalAt);

    return Number.isFinite(arrivalAt) && arrivalAt > cutoff;
  });

  await storageSet({ [MILITARY_EVENTS_KEY]: activeEvents });
  await updateActionBadge(activeEvents);
  return activeEvents;
}

async function refreshMilitaryBadge() {
  await saveStoredEvents(await getStoredEvents());
}

async function updateActionBadge(events) {
  const settings = await getMilitarySettings();

  if (!settings.enabled || !settings.badge) {
    await actionSetBadgeText({ text: '' });
    return;
  }

  const now = Date.now();
  const activeEvents = (Array.isArray(events) ? events : [])
    .filter((event) => Number(event.arrivalAt) > now);

  if (!activeEvents.length) {
    await actionSetBadgeText({ text: '' });
    return;
  }

  const worstSeverity = activeEvents
    .map((event) => event.severity ?? classifySeverity(event.type, event.arrivalAt))
    .sort((left, right) => severityRank(right) - severityRank(left))[0];

  await actionSetBadgeBackgroundColor({ color: badgeColor(worstSeverity) });
  await actionSetBadgeText({ text: String(Math.min(activeEvents.length, 99)) });
}

async function createNotification(event, suffix = 'now', reminderMinutes = null) {
  const settings = await getMilitarySettings();

  if (!settings.enabled || !settings.notifications) {
    return;
  }

  const options = {
    type: 'basic',
    iconUrl: extensionApi.runtime.getURL('assets/icon/128.png'),
    title: eventTitle(event, reminderMinutes),
    message: eventMessage(event),
  };

  if (globalThis.chrome) {
    options.priority = 2;
  }

  await notificationCreate(notificationId(event, suffix), options);
}

async function scheduleReminders(event) {
  const arrivalAt = Number(event.arrivalAt);
  if (!Number.isFinite(arrivalAt)) return;

  const settings = await getMilitarySettings();
  const reminderAlarms = REMINDER_OFFSETS
    .filter((minutesBefore) => settings.enabled && settings.reminders[minutesBefore])
    .map(async (minutesBefore) => {
      const when = arrivalAt - minutesBefore * 60 * 1000;

      if (when <= Date.now()) {
        return;
      }

      await alarmCreate(alarmName(event, minutesBefore), { when });
    });

  await Promise.all([
    ...reminderAlarms,
    alarmCreate(cleanupAlarmName(event), { when: arrivalAt + 1000 }),
  ]);
}

async function handleMilitaryEvents(events) {
  const settings = await getMilitarySettings();

  if (!settings.enabled) {
    await updateActionBadge([]);
    return { ok: true, notified: 0 };
  }

  const incomingEvents = (Array.isArray(events) ? events : [])
    .filter((event) => event?.isHostile && event?.direction === 'incoming' && event?.arrivalAt)
    .map((event) => ({
      ...event,
      id: event.id || eventKey(event),
      severity: event.severity ?? classifySeverity(event.type, event.arrivalAt),
      firstSeenAt: event.firstSeenAt || Date.now(),
      lastSeenAt: Date.now(),
    }));

  if (!incomingEvents.length) {
    return { ok: true, notified: 0 };
  }

  const storedEvents = await getStoredEvents();
  const knownKeys = new Set(storedEvents.map(eventKey));
  const mergedByKey = new Map(storedEvents.map((event) => [eventKey(event), event]));
  const newEvents = [];

  incomingEvents.forEach((event) => {
    const key = eventKey(event);
    const existing = mergedByKey.get(key);

    mergedByKey.set(key, {
      ...existing,
      ...event,
      firstSeenAt: existing?.firstSeenAt ?? event.firstSeenAt,
    });

    if (!knownKeys.has(key)) {
      newEvents.push(event);
    }
  });

  await saveStoredEvents([...mergedByKey.values()]);
  await Promise.all(newEvents.map(async (event) => {
    await createNotification(event);
    await scheduleReminders(event);
  }));

  return { ok: true, notified: newEvents.length };
}

async function clearMilitaryTestEvents() {
  const events = await getStoredEvents();
  const cleared = events.filter((event) => event.isTest).length;

  await saveStoredEvents(events.filter((event) => !event.isTest));

  return { ok: true, cleared };
}

async function getStoredGameEvents() {
  const result = await storageGet(GAME_EVENTS_KEY);
  const events = result[GAME_EVENTS_KEY];

  return Array.isArray(events) ? events : [];
}

async function saveStoredGameEvents(events) {
  const timestamp = Date.now();
  const activeEvents = (Array.isArray(events) ? events : [])
    .map(normalizeGameEvent)
    .filter(Boolean)
    .filter((event) => Number(event.expiresAt) > timestamp)
    .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt))
    .slice(0, MAX_GAME_EVENTS);

  await storageSet({ [GAME_EVENTS_KEY]: activeEvents });
  return activeEvents;
}

async function handleHighSeverityGameEvent(event) {
  if (event?.payload?.suppressNotification) return;

  if (event?.source !== 'notificationAlerts') {
    const settings = await getMilitarySettings();
    if (!settings.enabled || !settings.notifications) return;
  }

  const options = {
    type: 'basic',
    iconUrl: extensionApi.runtime.getURL('assets/icon/128.png'),
    title: `IkaKit: ${event.title || event.type}`,
    message: event.message || '',
  };

  if (globalThis.chrome) {
    options.priority = 2;
  }

  await notificationCreate(`ika:game-event:${event.dedupeKey || event.id}`, options);
}

async function createDiagnosticNotification() {
  const options = {
    type: 'basic',
    iconUrl: extensionApi.runtime.getURL('assets/icon/128.png'),
    title: 'IkaKit: Test notification',
    message: 'If you can see this, browser and OS notifications are working.',
  };

  if (globalThis.chrome) {
    options.priority = 2;
  }

  const id = `ika:notification-alert:test:${Date.now()}`;
  await notificationCreate(id, options);
  return { ok: true, id };
}

async function handleGameEvents(events) {
  const incomingEvents = (Array.isArray(events) ? events : [])
    .map(normalizeGameEvent)
    .filter(Boolean);

  if (!incomingEvents.length) {
    return { ok: true, stored: 0, routed: 0 };
  }

  const storedByKey = new Map((await getStoredGameEvents()).map((event) => [gameEventKey(event), event]));

  const newEvents = [];
  incomingEvents.forEach((event) => {
    const existing = storedByKey.get(event.dedupeKey);
    if (!existing) newEvents.push(event);

    storedByKey.set(event.dedupeKey, {
      ...existing,
      ...event,
      observedAt: existing?.observedAt ?? event.observedAt,
      updatedAt: Date.now(),
    });
  });

  await saveStoredGameEvents([...storedByKey.values()]);

  const militaryEvents = incomingEvents
    .filter((event) => event.type === 'military.incoming')
    .map((event) => event.payload?.militaryEvent)
    .filter(Boolean);

  if (militaryEvents.length) {
    await handleMilitaryEvents(militaryEvents);
  }

  const highSeverityEvents = newEvents.filter((event) => {
    if (!['critical', 'high'].includes(event.severity) || event.payload?.suppressNotification) {
      return false;
    }

    return event.category !== 'military' || event.type === 'townNews.military';
  });
  await Promise.all(highSeverityEvents.map(handleHighSeverityGameEvent));

  return {
    ok: true,
    stored: incomingEvents.length,
    routed: militaryEvents.length,
  };
}

async function clearGameEvents() {
  await storageSet({ [GAME_EVENTS_KEY]: [] });
  return { ok: true, cleared: true };
}

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.__ikakit) {
    return false;
  }

  if (message.__ikakit === 'gameEvents') {
    handleGameEvents(message.events)
      .then(sendResponse)
      .catch((error) => {
        console.error('[IkaKit] Game Event Layer error:', error);
        sendResponse({ ok: false, error: String(error?.message ?? error) });
      });

    return true;
  }

  if (message.__ikakit === 'clearGameEvents') {
    clearGameEvents()
      .then(sendResponse)
      .catch((error) => {
        console.error('[IkaKit] Game Event clear error:', error);
        sendResponse({ ok: false, error: String(error?.message ?? error) });
      });

    return true;
  }

  if (message.__ikakit === 'notificationAlertTest') {
    createDiagnosticNotification()
      .then(sendResponse)
      .catch((error) => {
        console.error('[IkaKit] Notification Alert test error:', error);
        sendResponse({ ok: false, error: String(error?.message ?? error) });
      });

    return true;
  }

  if (message.__ikakit === 'militaryEvents') {
    handleMilitaryEvents(message.events)
      .then(sendResponse)
      .catch((error) => {
        console.error('[IkaKit] Military alert error:', error);
        sendResponse({ ok: false, error: String(error?.message ?? error) });
      });

    return true;
  }

  if (message.__ikakit === 'clearMilitaryAlertTests') {
    clearMilitaryTestEvents()
      .then(sendResponse)
      .catch((error) => {
        console.error('[IkaKit] Military alert cleanup error:', error);
        sendResponse({ ok: false, error: String(error?.message ?? error) });
      });

    return true;
  }

  return false;
});

extensionApi.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(MILITARY_ALERT_PREFIX)) {
    return;
  }

  if (alarm.name.startsWith(MILITARY_CLEANUP_PREFIX)) {
    await refreshMilitaryBadge();
    return;
  }

  const match = alarm.name.match(/^ikakit:military:(\d+):(.+)$/);
  if (!match) return;

  const reminderMinutes = Number(match[1]);
  const eventId = match[2];
  const settings = await getMilitarySettings();

  if (!settings.enabled || !settings.reminders[reminderMinutes]) {
    return;
  }

  const events = await getStoredEvents();
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    return;
  }

  await createNotification(event, `reminder:${reminderMinutes}`, reminderMinutes);
});

extensionApi.storage.onChanged?.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[MILITARY_SETTINGS_KEY]) {
    return;
  }

  refreshMilitaryBadge().catch((error) => {
    console.warn('[IkaKit] Không refresh được badge sau khi đổi settings:', error);
  });
});
