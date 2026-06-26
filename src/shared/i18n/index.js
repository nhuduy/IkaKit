import { DEFAULT_LOCALE, LOCALES, MESSAGES } from './messages.js';

export const LANGUAGE_STORAGE_KEY = 'ika_ui_language';

const localeCodes = new Set(LOCALES.map((locale) => locale.code));
const localeLabels = new Map(LOCALES.map((locale) => [locale.label.toLowerCase(), locale.code]));
const legacyLocaleNames = new Map([
  ['english', 'en'],
  ['french', 'fr'],
  ['vietnamese', 'vi'],
]);
const listeners = new Set();

let currentLanguage = DEFAULT_LOCALE;
let loaded = false;

function getExtensionApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome;
  return null;
}

function usesPromiseApi(api) {
  return typeof browser !== 'undefined' && api === browser;
}

function withCallback(apiCall) {
  return new Promise((resolve, reject) => {
    try {
      const result = apiCall((value) => {
        const api = getExtensionApi();
        const error = api?.runtime?.lastError;
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

function resolveLocale(locale) {
  const value = String(locale || '').trim();
  if (!value) return null;

  const normalized = value.replace(/_/g, '-');
  if (localeCodes.has(normalized)) return normalized;

  const lowerCaseValue = value.toLowerCase();
  const legacyLocale = localeLabels.get(lowerCaseValue) ?? legacyLocaleNames.get(lowerCaseValue);
  if (legacyLocale) return legacyLocale;

  const lowerCaseLocale = normalized.toLowerCase();
  if (lowerCaseLocale === 'zh' || lowerCaseLocale.startsWith('zh-')) return 'zh-TW';

  const baseLocale = normalized.split('-')[0];
  return localeCodes.has(baseLocale) ? baseLocale : null;
}

function normalizeLocale(locale) {
  return resolveLocale(locale) ?? DEFAULT_LOCALE;
}

function getBrowserLocales() {
  if (typeof navigator === 'undefined') return [];

  return [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean);
}

function detectBrowserLocale() {
  const browserLocale = getBrowserLocales()
    .map((locale) => resolveLocale(locale))
    .find(Boolean);

  return browserLocale || DEFAULT_LOCALE;
}

async function storageGet(key) {
  const api = getExtensionApi();
  if (!api?.storage?.local) return {};

  if (usesPromiseApi(api)) {
    return api.storage.local.get(key);
  }

  return withCallback((done) => api.storage.local.get(key, done));
}

async function storageSet(value) {
  const api = getExtensionApi();
  if (!api?.storage?.local) return;

  if (usesPromiseApi(api)) {
    await api.storage.local.set(value);
    return;
  }

  await withCallback((done) => api.storage.local.set(value, done));
}

function notifyLanguageChange() {
  listeners.forEach((listener) => {
    try {
      listener(currentLanguage);
    } catch (error) {
      console.warn('[IkaKit] i18n listener failed:', error);
    }
  });
}

function applyLanguage(locale, { notify = true } = {}) {
  const nextLanguage = normalizeLocale(locale);
  if (nextLanguage === currentLanguage) return currentLanguage;

  currentLanguage = nextLanguage;
  if (notify) notifyLanguageChange();
  return currentLanguage;
}

function interpolate(message, params = {}) {
  return String(message).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const value = params[key];
    return value === null || typeof value === 'undefined' ? match : String(value);
  });
}

export function supportedLocales() {
  return LOCALES;
}

export function getLanguage() {
  return currentLanguage;
}

export async function loadLanguage() {
  if (loaded) return currentLanguage;

  try {
    const result = await storageGet(LANGUAGE_STORAGE_KEY);
    const storedLanguage = result[LANGUAGE_STORAGE_KEY];
    const nextLanguage = storedLanguage ? normalizeLocale(storedLanguage) : detectBrowserLocale();
    applyLanguage(nextLanguage, { notify: false });

    if (storedLanguage && storedLanguage !== nextLanguage) {
      await storageSet({ [LANGUAGE_STORAGE_KEY]: nextLanguage });
    }
  } catch (error) {
    console.warn('[IkaKit] Could not load UI language:', error);
    applyLanguage(detectBrowserLocale(), { notify: false });
  }

  loaded = true;
  return currentLanguage;
}

export async function setLanguage(locale) {
  const previousLanguage = currentLanguage;
  const nextLanguage = normalizeLocale(locale);
  loaded = true;

  if (nextLanguage === previousLanguage) {
    return currentLanguage;
  }

  try {
    await storageSet({ [LANGUAGE_STORAGE_KEY]: nextLanguage });
  } catch (error) {
    console.warn('[IkaKit] Could not save UI language:', error);
  }

  if (currentLanguage === previousLanguage) {
    applyLanguage(nextLanguage);
  }

  return nextLanguage;
}

export function onLanguageChange(listener) {
  if (typeof listener !== 'function') return () => {};

  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key, params = {}) {
  const fallback = MESSAGES[DEFAULT_LOCALE]?.[key] ?? key;
  const message = MESSAGES[currentLanguage]?.[key] ?? fallback;
  return interpolate(message, params);
}

const api = getExtensionApi();
api?.storage?.onChanged?.addListener?.((changes, areaName) => {
  if (areaName !== 'local' || !changes[LANGUAGE_STORAGE_KEY]) return;
  loaded = true;
  applyLanguage(changes[LANGUAGE_STORAGE_KEY].newValue);
});
