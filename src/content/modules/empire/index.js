// IkaKit — Empire Manager
// Modal overlay với 4 tab: Resources | Buildings | Military | Espionage
// Inject button vào left menu của game, lưu tab active vào storage.

import storage  from '../../helpers/storage.js';
import gameData from '../../helpers/gameData.js';

const STORAGE_KEY = 'ika_empire_active_tab';

const TABS = ['resources', 'buildings', 'military', 'espionage'];
const TAB_LABELS = {
  resources: 'Resources',
  buildings: 'Buildings',
  military:  'Military',
  espionage: 'Espionage',
};

let _modal = null;
let _activeTab = 'resources';
let _activeModule = null;

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
  item.title = 'Empire Manager';

  const link = document.createElement('a');
  link.href = 'javascript:void(0)';

  const icon = document.createElement('div');
  icon.className = 'ika-empire-icon';
  icon.textContent = 'E';

  const label = document.createElement('div');
  label.className = 'ika-empire-label';
  label.textContent = 'Empire';

  link.append(icon, label);
  item.appendChild(link);
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
    button.textContent = 'Empire';
    button.addEventListener('click', () => empire.toggle());
    document.body.appendChild(button);
  }
}

function _createLoading() {
  const loading = document.createElement('div');
  loading.className = 'ika-loading';
  loading.textContent = 'Đang tải...';

  return loading;
}

function _buildModal() {
  const modal = document.createElement('div');
  modal.id = 'ika-empire-modal';
  modal.className = 'ika-modal';

  const overlay = document.createElement('div');
  overlay.className = 'ika-modal-overlay';
  overlay.addEventListener('click', () => empire.close());

  const windowEl = document.createElement('div');
  windowEl.className = 'ika-modal-window';

  const header = document.createElement('div');
  header.className = 'ika-modal-header';

  const title = document.createElement('span');
  title.className = 'ika-modal-title';
  title.textContent = 'Empire Manager';

  const close = document.createElement('button');
  close.className = 'ika-modal-close';
  close.type = 'button';
  close.title = 'Close';
  close.innerHTML = '&times;';
  close.addEventListener('click', () => empire.close());

  const tabs = document.createElement('div');
  tabs.className = 'ika-modal-tabs';

  TABS.forEach((tab) => {
    const button = document.createElement('button');
    button.className = `ika-tab${tab === _activeTab ? ' ika-tab-active' : ''}`;
    button.type = 'button';
    button.dataset.tab = tab;
    button.textContent = TAB_LABELS[tab];
    button.addEventListener('click', () => _switchTab(tab));
    tabs.appendChild(button);
  });

  const content = document.createElement('div');
  content.className = 'ika-modal-content';
  content.id = 'ika-empire-content';
  content.appendChild(_createLoading());

  header.append(title, close);
  windowEl.append(header, tabs, content);
  modal.append(overlay, windowEl);

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
  document.addEventListener('keydown', _onKeyDown);

  await _switchTab(_activeTab);
}

async function _switchTab(tab) {
  if (!_modal) return;

  if (_activeModule && typeof _activeModule.destroy === 'function') {
    _activeModule.destroy();
  }
  _activeModule = null;

  _modal.querySelectorAll('.ika-tab').forEach((button) => {
    button.classList.toggle('ika-tab-active', button.dataset.tab === tab);
  });

  const content = _modal.querySelector('#ika-empire-content');
  content.replaceChildren(_createLoading());

  _activeTab = tab;
  await storage.set(STORAGE_KEY, tab);

  try {
    const { default: mod } = await import('./' + tab + '.js');
    _activeModule = mod;
    mod.render(content, gameData.getCities());
  } catch (err) {
    console.error('[IkaKit] Không load được module "' + tab + '":', err);

    const error = document.createElement('div');
    error.className = 'ika-error';
    error.textContent = `Module "${TAB_LABELS[tab]}" chưa sẵn sàng.`;
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

  close() {
    if (!_modal) return;

    document.removeEventListener('keydown', _onKeyDown);
    _modal.remove();
    _modal = null;

    if (_activeModule && typeof _activeModule.destroy === 'function') {
      _activeModule.destroy();
    }
    _activeModule = null;
  },
};

export default empire;
