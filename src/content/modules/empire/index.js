// IkaKit — Empire Manager
// Modal overlay với 5 tab: Resources | Buildings | Research | Military | Espionage
// Inject button vào left menu của game, lưu tab active vào storage.

import storage  from '../../helpers/storage.js';
import gameData from '../../helpers/gameData.js';
import {
  getLanguage,
  onLanguageChange,
  setLanguage,
  supportedLocales,
  t,
} from '../../../shared/i18n/index.js';

const STORAGE_KEY = 'ika_empire_active_tab';

const TABS = ['resources', 'buildings', 'research', 'military', 'espionage'];
const TAB_LABEL_KEYS = {
  resources: 'empire.tab.resources',
  buildings: 'empire.tab.buildings',
  research: 'empire.tab.research',
  military: 'empire.tab.military',
  espionage: 'empire.tab.espionage',
};

let _modal = null;
let _activeTab = 'resources';
let _activeModule = null;
let _unsubscribeGameData = null;
let _unsubscribeScanStatus = null;
let _unsubscribeLanguage = null;
let _modalPosition = null;

function _injectStyles() {
  if (document.getElementById('ika-empire-style')) return;

  const link = document.createElement('link');
  link.id = 'ika-empire-style';
  link.rel = 'stylesheet';
  link.href = browser.runtime.getURL('css/ikaeasy.css');
  document.head.appendChild(link);
}

function _waitFor(selector, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[IkaKit] Timeout chờ "${selector}"`));
    }, timeout);
  });
}

function _createMenuButton() {
  const item = document.createElement('li');
  item.id = 'ika-empire-btn';
  item.className = 'slot ika-empire-btn';
  item.title = t('empire.title');

  const icon = document.createElement('div');
  icon.className = 'image ika-empire-icon';

  const label = document.createElement('div');
  const labelText = document.createElement('span');
  label.className = 'name';
  labelText.className = 'namebox ika-empire-label';
  labelText.textContent = t('empire.button');

  label.appendChild(labelText);
  item.append(icon, label);
  item.addEventListener('click', (event) => {
    event.preventDefault();
    empire.toggle();
  });

  return item;
}

async function _injectButton() {
  if (document.getElementById('ika-empire-btn')) return;

  try {
    const menu = await _waitFor('#js_viewCityMenu');
    let slots = menu.querySelector('.menu_slots');

    if (!slots) {
      slots = document.createElement('ul');
      slots.className = 'menu_slots';
      menu.appendChild(slots);
    }

    slots.prepend(_createMenuButton());
  } catch (_err) {
    console.warn('[IkaKit] Không tìm được #js_viewCityMenu, dùng FAB button.');

    const button = document.createElement('button');
    button.id = 'ika-empire-btn';
    button.className = 'ika-empire-fab';
    button.type = 'button';
    button.textContent = t('empire.button');
    button.addEventListener('click', () => empire.toggle());
    document.body.appendChild(button);
  }
}

function _createLoading() {
  const loading = document.createElement('div');
  loading.className = 'ika-loading';
  loading.textContent = t('empire.loading');

  return loading;
}

function _renderLanguageSelect() {
  const wrapper = document.createElement('div');
  const toggle = document.createElement('button');
  const popover = document.createElement('div');
  const field = document.createElement('label');
  const label = document.createElement('span');
  const select = document.createElement('select');

  wrapper.className = 'ika-language-setting';
  popover.className = 'ika-language-popover';
  field.className = 'ika-language-field';
  label.className = 'ika-language-label';
  label.textContent = t('empire.language.label');

  toggle.className = 'ika-language-toggle';
  toggle.type = 'button';
  toggle.title = t('empire.language.settingsTitle');
  toggle.setAttribute('aria-label', t('empire.language.settingsTitle'));
  toggle.textContent = '⚙';
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    wrapper.classList.toggle('ika-language-setting-open');
  });

  select.className = 'ika-language-select';
  select.title = t('empire.language.title');

  supportedLocales().forEach((locale) => {
    const option = document.createElement('option');
    option.value = locale.code;
    option.textContent = locale.label;
    option.selected = locale.code === getLanguage();
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    wrapper.classList.remove('ika-language-setting-open');
    setLanguage(select.value);
  });

  field.append(label, select);
  popover.appendChild(field);
  wrapper.append(toggle, popover);

  wrapper.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  return wrapper;
}

function _updateMenuButtonLabel() {
  const button = document.getElementById('ika-empire-btn');
  if (!button) return;

  if (button.matches('button')) {
    button.textContent = t('empire.button');
    return;
  }

  button.title = t('empire.title');
  const label = button.querySelector('.ika-empire-label');
  if (label) label.textContent = t('empire.button');
}

function _formatScanStatus(data) {
  const scan = data?.debug?.scan;
  const cityCount = data?.debug?.cityCount ?? data?.cities?.length ?? 0;

  if (!scan) {
    return cityCount ? t('empire.scan.cities', { count: cityCount }) : t('common.ready');
  }

  if (scan.inProgress) {
    const total = Number(scan.total) || cityCount;
    const fetched = Number(scan.fetched) || 0;
    return total ? t('empire.scan.scanningProgress', { fetched, total }) : t('empire.scan.scanning');
  }

  if (scan.lastError) {
    return t('empire.scan.warning');
  }

  if (scan.total) {
    const syncedAt = _formatTime(scan.lastCompleted);
    return syncedAt
      ? t('empire.scan.syncedAt', { count: scan.total, time: syncedAt })
      : t('empire.scan.synced', { count: scan.total });
  }

  return cityCount ? t('empire.scan.cities', { count: cityCount }) : t('common.ready');
}

function _formatTime(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return '';

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function _updateScanStatus(data = gameData.get()) {
  if (!_modal) return;

  const status = _modal.querySelector('#ika-scan-status');
  const refresh = _modal.querySelector('#ika-scan-refresh');
  const scan = data?.debug?.scan;

  if (status) {
    status.textContent = _formatScanStatus(data);
    status.classList.toggle('ika-scan-status-active', Boolean(scan?.inProgress));
    status.classList.toggle('ika-scan-status-warning', Boolean(scan?.lastError && !scan?.inProgress));
    status.title = scan?.lastError
      ? String(scan.lastError)
      : (_formatTime(scan?.lastCompleted) ? t('empire.scan.lastSyncedAt', { time: _formatTime(scan.lastCompleted) }) : '');
  }

  if (refresh) {
    refresh.disabled = Boolean(scan?.inProgress);
    refresh.classList.toggle('ika-loading-button', Boolean(scan?.inProgress));
  }
}

function _renderActiveModuleContent() {
  if (!_modal || !_activeModule || typeof _activeModule.render !== 'function') return;

  const content = _modal.querySelector('#ika-empire-content');
  if (!content) return;

  _activeModule.render(content, gameData.getCities());
}

function _refreshLanguageText() {
  _updateMenuButtonLabel();
  if (!_modal) return;

  const title = _modal.querySelector('.ika-modal-title');
  const refresh = _modal.querySelector('#ika-scan-refresh');
  const close = _modal.querySelector('.ika-modal-close');
  const languageSetting = _modal.querySelector('.ika-language-setting');

  if (title) title.textContent = t('empire.title');
  if (refresh) {
    refresh.title = t('empire.refreshTitle');
    refresh.textContent = t('empire.refresh');
  }
  if (close) close.title = t('common.close');

  _modal.querySelectorAll('.ika-tab').forEach((button) => {
    const tab = button.dataset.tab;
    if (TAB_LABEL_KEYS[tab]) button.textContent = t(TAB_LABEL_KEYS[tab]);
  });

  if (languageSetting) {
    languageSetting.replaceWith(_renderLanguageSelect());
  }

  _updateScanStatus();
  _renderActiveModuleContent();
}

function _clampModalPosition(left, top, windowEl) {
  const rect = windowEl.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);

  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

function _placeModalWindow(windowEl, left, top) {
  const position = _clampModalPosition(left, top, windowEl);

  windowEl.style.position = 'fixed';
  windowEl.style.left = `${position.left}px`;
  windowEl.style.top = `${position.top}px`;
  windowEl.style.margin = '0';
  _modalPosition = position;
}

function _enableModalDrag(windowEl, handle) {
  let drag = null;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button, a, input, select, textarea')) {
      return;
    }

    const rect = windowEl.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    _placeModalWindow(windowEl, rect.left, rect.top);
    handle.classList.add('ika-modal-header-dragging');
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    _placeModalWindow(windowEl, event.clientX - drag.offsetX, event.clientY - drag.offsetY);
  });

  const stopDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    handle.classList.remove('ika-modal-header-dragging');
    handle.releasePointerCapture(event.pointerId);
  };

  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
}

function _buildModal() {
  const modal = document.createElement('div');
  modal.id = 'ika-empire-modal';
  modal.className = 'ika-modal';
  modal.addEventListener('click', () => {
    modal.querySelectorAll('.ika-language-setting-open').forEach((element) => {
      element.classList.remove('ika-language-setting-open');
    });
  });

  const overlay = document.createElement('div');
  overlay.className = 'ika-modal-overlay';
  overlay.addEventListener('click', () => empire.close());

  const windowEl = document.createElement('div');
  windowEl.className = 'ika-modal-window';

  const header = document.createElement('div');
  header.className = 'ika-modal-header';

  const title = document.createElement('span');
  title.className = 'ika-modal-title';
  title.textContent = t('empire.title');

  const actions = document.createElement('div');
  actions.className = 'ika-modal-actions';

  const scanStatus = document.createElement('span');
  scanStatus.id = 'ika-scan-status';
  scanStatus.className = 'ika-scan-status';
  scanStatus.textContent = t('common.ready');

  const refresh = document.createElement('button');
  refresh.id = 'ika-scan-refresh';
  refresh.className = 'ika-scan-refresh';
  refresh.type = 'button';
  refresh.title = t('empire.refreshTitle');
  refresh.textContent = t('empire.refresh');
  refresh.addEventListener('click', () => {
    gameData.requestCityScan(true);
    gameData.requestResearchScan(true);
    _updateScanStatus({
      ...(gameData.get() ?? {}),
      debug: {
        ...((gameData.get() ?? {}).debug ?? {}),
        scan: {
          ...((gameData.get() ?? {}).debug?.scan ?? {}),
          inProgress: true,
        },
      },
    });
  });

  const close = document.createElement('button');
  close.className = 'ika-modal-close';
  close.type = 'button';
  close.title = t('common.close');
  close.innerHTML = '&times;';
  close.addEventListener('click', () => empire.close());

  const tabs = document.createElement('div');
  tabs.className = 'ika-modal-tabs';

  TABS.forEach((tab) => {
    const button = document.createElement('button');
    button.className = `ika-tab${tab === _activeTab ? ' ika-tab-active' : ''}`;
    button.type = 'button';
    button.dataset.tab = tab;
    button.textContent = t(TAB_LABEL_KEYS[tab]);
    button.addEventListener('click', () => _switchTab(tab));
    tabs.appendChild(button);
  });

  const content = document.createElement('div');
  content.className = 'ika-modal-content';
  content.id = 'ika-empire-content';
  content.appendChild(_createLoading());

  actions.append(scanStatus, _renderLanguageSelect(), refresh, close);
  header.append(title, actions);
  windowEl.append(header, tabs, content);
  modal.append(overlay, windowEl);
  _enableModalDrag(windowEl, header);

  return modal;
}

function _onKeyDown(event) {
  if (event.key === 'Escape') {
    empire.close();
  }
}

async function _open() {
  if (_modal) return;

  _modal = _buildModal();
  document.body.appendChild(_modal);
  if (_modalPosition) {
    const windowEl = _modal.querySelector('.ika-modal-window');
    _placeModalWindow(windowEl, _modalPosition.left, _modalPosition.top);
  }
  document.addEventListener('keydown', _onKeyDown);
  gameData.requestCityScan();
  gameData.requestResearchScan();
  _updateScanStatus();
  _unsubscribeScanStatus = gameData.onChange((data) => _updateScanStatus(data));
  _unsubscribeLanguage = onLanguageChange(() => {
    _refreshLanguageText();
  });

  await _switchTab(_activeTab);
}

async function _switchTab(tab) {
  if (!_modal) return;

  if (_activeModule && typeof _activeModule.destroy === 'function') {
    _activeModule.destroy();
  }
  _activeModule = null;
  if (_unsubscribeGameData) {
    _unsubscribeGameData();
    _unsubscribeGameData = null;
  }

  _modal.querySelectorAll('.ika-tab').forEach((button) => {
    button.classList.toggle('ika-tab-active', button.dataset.tab === tab);
  });

  const content = _modal.querySelector('#ika-empire-content');
  content.replaceChildren(_createLoading());

  _activeTab = tab;
  if (tab === 'research') {
    gameData.requestResearchScan();
  }
  storage.set(STORAGE_KEY, tab).catch((error) => {
    console.warn('[IkaKit] Không lưu được active empire tab:', error);
  });

  try {
    const { default: mod } = await import('./' + tab + '.js');
    _activeModule = mod;
    mod.render(content, gameData.getCities());
    _unsubscribeGameData = gameData.onChange((data) => {
      if (!_modal || _activeModule !== mod) return;
      mod.render(content, data?.cities ?? []);
    });
  } catch (err) {
    console.error('[IkaKit] Không load được module "' + tab + '":', err);

    const error = document.createElement('div');
    error.className = 'ika-error';
    error.textContent = t('empire.moduleUnavailable', { module: t(TAB_LABEL_KEYS[tab]) });
    content.replaceChildren(error);
  }
}

const empire = {
  async init() {
    _injectStyles();

    const saved = await storage.get(STORAGE_KEY);
    if (TABS.includes(saved)) _activeTab = saved;

    _injectButton().catch((err) => console.error('[IkaKit] _injectButton:', err));
  },

  ensureButton() {
    if (!document.getElementById('ika-empire-btn')) {
      _injectButton().catch(() => {});
    }
  },

  onPageChange(_pageName) {
    this.ensureButton();
  },

  toggle() {
    if (_modal) {
      this.close();
    } else {
      _open();
    }
  },

  open() {
    _open();
  },

  close() {
    if (!_modal) return;

    document.removeEventListener('keydown', _onKeyDown);
    _modal.remove();
    _modal = null;

    if (_activeModule && typeof _activeModule.destroy === 'function') {
      _activeModule.destroy();
    }
    _activeModule = null;
    if (_unsubscribeGameData) {
      _unsubscribeGameData();
      _unsubscribeGameData = null;
    }
    if (_unsubscribeScanStatus) {
      _unsubscribeScanStatus();
      _unsubscribeScanStatus = null;
    }
    if (_unsubscribeLanguage) {
      _unsubscribeLanguage();
      _unsubscribeLanguage = null;
    }
  },
};

export default empire;
