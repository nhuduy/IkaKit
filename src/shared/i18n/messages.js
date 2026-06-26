export const DEFAULT_LOCALE = 'en';

export const LOCALES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'pl', label: 'Polski' },
  { code: 'es', label: 'Español' },
  { code: 'tr', label: 'Türkçe' },
]);

export const MESSAGES = Object.freeze({
  en: Object.freeze({
    'common.close': 'Close',
    'common.language': 'Language',
    'common.settings': 'Settings',
    'empire.language.label': 'Language',
    'empire.language.title': 'Change UI language',
  }),
});
