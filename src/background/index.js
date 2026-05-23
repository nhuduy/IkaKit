// IkaKit — Background Service Worker (Chrome) / Background Script (Firefox)
// Dùng browser.* thay vì chrome.* — webextension-polyfill lo phần còn lại

const MILITARY_EVENTS_KEY = 'ika_military_alert_events';
const MILITARY_ALERT_PREFIX = 'ikakit:military:';
const REMINDER_OFFSETS = Object.freeze([15, 5, 1]);
const MAX_EVENT_AGE = 6 * 60 * 60 * 1000;
const extensionApi = globalThis.browser ?? globalThis.chrome;
const usesPromiseApi = Boolean(globalThis.browser);

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

extensionApi.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[IkaKit] Đã cài đặt thành công.');
  }

  if (reason === 'update') {
    console.log('[IkaKit] Đã cập nhật lên phiên bản mới.');
  }
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

function alarmName(event, minutesBefore) {
  return `${MILITARY_ALERT_PREFIX}${minutesBefore}:${event.id}`;
}

function notificationId(event, suffix = 'now') {
  return `${MILITARY_ALERT_PREFIX}${suffix}:${event.id}`;
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
  if (reminderMinutes !== null) {
    return `Ikariam: còn ${reminderMinutes} phút`;
  }

  if (event.type === 'blockade') {
    return 'Ikariam: có phong tỏa incoming';
  }

  if (event.type === 'occupation') {
    return 'Ikariam: có chiếm đóng incoming';
  }

  return 'Ikariam: bạn đang bị tấn công';
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
  return activeEvents;
}

async function createNotification(event, suffix = 'now', reminderMinutes = null) {
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

  await Promise.all(REMINDER_OFFSETS.map(async (minutesBefore) => {
    const when = arrivalAt - (minutesBefore * 60 * 1000);

    if (when <= Date.now()) {
      return;
    }

    await alarmCreate(alarmName(event, minutesBefore), { when });
  }));
}

async function handleMilitaryEvents(events) {
  const incomingEvents = (Array.isArray(events) ? events : [])
    .filter((event) => event?.isHostile && event?.direction === 'incoming' && event?.arrivalAt)
    .map((event) => ({
      ...event,
      id: event.id || eventKey(event),
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

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.__ikakit !== 'militaryEvents') {
    return false;
  }

  handleMilitaryEvents(message.events)
    .then(sendResponse)
    .catch((error) => {
      console.error('[IkaKit] Military alert error:', error);
      sendResponse({ ok: false, error: String(error?.message ?? error) });
    });

  return true;
});

extensionApi.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(MILITARY_ALERT_PREFIX)) {
    return;
  }

  const match = alarm.name.match(/^ikakit:military:(\d+):(.+)$/);
  if (!match) return;

  const reminderMinutes = Number(match[1]);
  const eventId = match[2];
  const events = await getStoredEvents();
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    return;
  }

  await createNotification(event, `reminder:${reminderMinutes}`, reminderMinutes);
});
