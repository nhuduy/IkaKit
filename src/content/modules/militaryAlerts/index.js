// IkaKit — Military attack notifications
// Detect incoming hostile military events and hand them to the background script.

const SCAN_DELAY = 500;
const SEND_COOLDOWN = 1500;
const ADVISOR_POLL_INTERVAL = 60 * 1000;
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
let lastSignature = '';
let observer = null;

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

  if (!match) {
    return null;
  }

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

    if (!Number.isFinite(value)) {
      continue;
    }

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
  if (/blockade|phong t[oỏ]a/i.test(text)) {
    return 'blockade';
  }

  if (/occup|chi[eế]m/i.test(text)) {
    return 'occupation';
  }

  return 'attack';
}

function readEndpoint(element, names) {
  for (const name of names) {
    const node = element.querySelector?.(`[class*="${name}"], [id*="${name}"], [data-${name}]`);
    const text = cleanText(node?.textContent ?? node?.getAttribute?.(`data-${name}`));

    if (text) {
      return text;
    }
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

  if (!text || !hasPattern(text, HOSTILE_PATTERNS)) {
    return null;
  }

  const isIncoming = hasPattern(text, INCOMING_PATTERNS)
    || element.classList?.contains('incoming')
    || element.querySelector?.('[class*="incoming"], [title*="incoming" i]');

  if (!isIncoming) {
    return null;
  }

  const arrivalAt = readArrivalAt(element, text);

  if (!arrivalAt || arrivalAt <= Date.now()) {
    return null;
  }

  const origin = readEndpoint(element, ['origin', 'source', 'from', 'startCity', 'start']);
  const target = readEndpoint(element, ['target', 'destination', 'to', 'endCity']);
  const type = inferType(text);
  const id = cleanText(element.getAttribute?.('data-event-id'))
    || cleanText(element.id)
    || `${type}:${hashText(`${text}:${arrivalAt}`)}`;

  return {
    id,
    type,
    direction: 'incoming',
    origin,
    target,
    arrivalAt,
    isHostile: true,
  };
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
  if (!html || typeof DOMParser === 'undefined') {
    return [];
  }

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
    byId.set(event.id, event);
  });

  return [...byId.values()];
}

function signature(events) {
  return events
    .map((event) => `${event.id}:${event.arrivalAt}`)
    .sort()
    .join('|');
}

function sendEvents(events) {
  const unique = uniqueEvents(events);
  const nextSignature = signature(unique);

  if (!unique.length || nextSignature === lastSignature) {
    return;
  }

  lastSignature = nextSignature;

  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => {
    browser.runtime.sendMessage({
      __ikakit: 'militaryEvents',
      events: unique,
    }).catch((error) => {
      console.warn('[IkaKit] Không gửi được military alert:', error);
    });
  }, SEND_COOLDOWN);
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    sendEvents(parseDocument(document));
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
    if (observer) {
      return;
    }

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.__ikakit !== 'militaryAdvisorHtml') return;

      sendEvents(parseHtml(event.data.html));
    });

    requestAdvisorScan();
    scheduleAdvisorPoll();

    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    scheduleScan();
  },
});

export default militaryAlerts;
