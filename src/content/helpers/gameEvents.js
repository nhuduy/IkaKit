// IkaKit - Lightweight notification event store.

import { sendRuntimeMessage } from './runtime.js';

const DEFAULT_TTL = 6 * 60 * 60 * 1000;
const MAX_EVENTS = 100;

let eventsByKey = new Map();
const listeners = new Set();

function now() {
  return Date.now();
}

function cleanString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeSeverity(value) {
  return ['critical', 'high', 'medium', 'low', 'info'].includes(value) ? value : 'info';
}

function normalizeEvent(source) {
  if (!source || typeof source !== 'object') return null;

  const observedAt = Number(source.observedAt) || now();
  const type = cleanString(source.type, 'game.unknown');
  const category = cleanString(source.category, type.split('.')[0] || 'game');
  const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
  const dedupeKey = cleanString(
    source.dedupeKey,
    [
      category,
      type,
      source.cityId ?? '',
      source.id ?? '',
      source.title ?? '',
      source.expiresAt ?? '',
    ].join('|'),
  );

  return {
    id: cleanString(source.id, `${type}:${dedupeKey}`),
    type,
    category,
    severity: normalizeSeverity(source.severity),
    cityId: source.cityId ?? null,
    title: cleanString(source.title, type),
    message: cleanString(source.message),
    payload,
    dedupeKey,
    observedAt,
    updatedAt: Number(source.updatedAt) || observedAt,
    expiresAt: Number(source.expiresAt) || observedAt + DEFAULT_TTL,
    source: cleanString(source.source, 'content'),
  };
}

function isActive(event, timestamp = now()) {
  return Number(event?.expiresAt) > timestamp;
}

function prune(timestamp = now()) {
  for (const [key, event] of eventsByKey.entries()) {
    if (!isActive(event, timestamp)) {
      eventsByKey.delete(key);
    }
  }

  const events = [...eventsByKey.values()]
    .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));

  events.slice(MAX_EVENTS).forEach((event) => {
    eventsByKey.delete(event.dedupeKey);
  });
}

function notify(events, isNew = true) {
  const payload = Object.freeze({
    events,
    isNew,
    activeEvents: gameEvents.getActiveEvents(),
  });

  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('[IkaKit] Game event listener error:', error);
    }
  });
  window.dispatchEvent(new CustomEvent('ikakit:game-events', { detail: payload }));
}

function sendToBackground(events) {
  if (!events.length) return;

  sendRuntimeMessage({
    __ikakit: 'gameEvents',
    events,
  }).catch((error) => {
    console.warn('[IkaKit] Không gửi được notification events:', error);
  });
}

const gameEvents = Object.freeze({
  emit(event) {
    return this.emitMany([event]);
  },

  emitMany(sources) {
    const timestamp = now();
    const incoming = (Array.isArray(sources) ? sources : [])
      .map(normalizeEvent)
      .filter(Boolean)
      .filter((event) => isActive(event, timestamp));

    if (!incoming.length) return [];

    prune(timestamp);

    const newEvents = [];
    const changedEvents = [];

    incoming.forEach((event) => {
      const existing = eventsByKey.get(event.dedupeKey);
      const merged = {
        ...existing,
        ...event,
        observedAt: existing?.observedAt ?? event.observedAt,
        updatedAt: timestamp,
      };

      eventsByKey.set(event.dedupeKey, merged);
      changedEvents.push(merged);

      if (!existing) {
        newEvents.push(merged);
      }
    });

    notify(changedEvents, Boolean(newEvents.length));
    sendToBackground(newEvents);
    return newEvents;
  },

  on(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);

    return () => listeners.delete(listener);
  },

  onChange(listener) {
    return this.on(listener);
  },

  getActiveEvents() {
    prune();
    return [...eventsByKey.values()]
      .sort((left, right) => Number(left.expiresAt) - Number(right.expiresAt));
  },

  toJSON() {
    return this.getActiveEvents().map((event) => ({
      ...event,
      payload: event.payload && typeof event.payload === 'object' ? { ...event.payload } : {},
    }));
  },

  clear() {
    eventsByKey = new Map();
    notify([], false);
  },
});

export default gameEvents;
