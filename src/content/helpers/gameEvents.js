// IkaKit - Minimal notification event relay.

import { sendRuntimeMessage } from './runtime.js';

const listeners = new Set();

function normalizeEvent(source) {
  if (!source || typeof source !== 'object') return null;

  const observedAt = Number(source.observedAt) || Date.now();
  const type = String(source.type || 'game.unknown');
  const category = String(source.category || type.split('.')[0] || 'game');
  const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
  const dedupeKey = String(source.dedupeKey || [
    category,
    type,
    source.cityId ?? '',
    source.id ?? '',
  ].join('|'));

  return {
    id: String(source.id || `${type}:${dedupeKey}`),
    type,
    category,
    severity: String(source.severity || 'info'),
    cityId: source.cityId ?? null,
    title: String(source.title || type),
    message: String(source.message || ''),
    payload,
    dedupeKey,
    observedAt,
    updatedAt: Number(source.updatedAt) || observedAt,
    expiresAt: Number(source.expiresAt) || observedAt + 6 * 60 * 60 * 1000,
    source: String(source.source || 'content'),
  };
}

function notify(events, isNew = true) {
  const payload = Object.freeze({ events, isNew });
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
    return gameEvents.emitMany([event]);
  },

  emitMany(events) {
    const normalized = (Array.isArray(events) ? events : [])
      .map(normalizeEvent)
      .filter(Boolean);

    if (!normalized.length) return [];

    notify(normalized, true);
    sendToBackground(normalized);
    return normalized;
  },

  onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
});

export default gameEvents;
