// IkaKit - Standalone Alerts panel.

import storage from '../../helpers/storage.js';
import { getRuntimeUrl } from '../../helpers/runtime.js';
import militaryAlerts from '../militaryAlerts/index.js';
import notificationAlerts from '../notificationAlerts/index.js';

const STORAGE_KEY = 'ika_alerts_active_tab';
const POSITION_STORAGE_KEY = 'ika_alerts_position';
const BUTTON_ID = 'ika-alerts-btn';

const TABS = Object.freeze([
  { id: 'military', label: 'Military Alerts', module: militaryAlerts },
  { id: 'townNews', label: 'Town News', module: notificationAlerts },
]);

let modal = null;
let activeTab = 'military';
let modalPosition = null;

function normalizePosition(value) {
  if (!value || typeof value !== 'object') return null;
  const left = Number(value.left);
  const top = Number(value.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { left, top };
}

function clampModalPosition(left, top, windowEl) {
  const rect = windowEl.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);

  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

function saveModalPosition(position) {
  storage.set(POSITION_STORAGE_KEY, position).catch((error) => {
    console.warn('[IkaKit] Could not save Alerts position:', error);
  });
}

function placeModalWindow(windowEl, left, top, { persist = true } = {}) {
  const position = clampModalPosition(left, top, windowEl);

  windowEl.style.position = 'fixed';
  windowEl.style.left = `${position.left}px`;
  windowEl.style.top = `${position.top}px`;
  windowEl.style.right = 'auto';
  windowEl.style.bottom = 'auto';
  windowEl.style.margin = '0';
  modalPosition = position;

  if (persist) saveModalPosition(position);
}

function enableModalDrag(windowEl, handle) {
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

    placeModalWindow(windowEl, rect.left, rect.top, { persist: false });
    handle.classList.add('ika-modal-header-dragging');
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    placeModalWindow(windowEl, event.clientX - drag.offsetX, event.clientY - drag.offsetY, { persist: false });
  });

  const stopDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    handle.classList.remove('ika-modal-header-dragging');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (modalPosition) saveModalPosition(modalPosition);
  };

  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
}

function keepModalInViewport() {
  if (!modal || !modalPosition) return;
  const windowEl = modal.querySelector('.ika-alerts-window');
  if (!windowEl) return;
  placeModalWindow(windowEl, modalPosition.left, modalPosition.top);
}

function injectStyles() {
  if (document.getElementById('ika-empire-style')) return;

  const link = document.createElement('link');
  link.id = 'ika-empire-style';
  link.rel = 'stylesheet';
  link.href = getRuntimeUrl('css/ikaeasy.css');
  if (!link.href) return;
  document.head.appendChild(link);
}

function createFallbackButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.className = 'ika-empire-fab ika-alerts-fab';
  button.type = 'button';
  button.textContent = 'Alerts';
  button.addEventListener('click', () => alerts.toggle());
  document.body.appendChild(button);
}

function waitForMenu(timeout = 3500) {
  const existing = document.querySelector('#js_viewCityMenu');
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const menu = document.querySelector('#js_viewCityMenu');
      if (!menu) return;
      observer.disconnect();
      clearTimeout(timer);
      resolve(menu);
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error('[IkaKit] Timeout waiting for #js_viewCityMenu'));
    }, timeout);

    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

function createMenuButton() {
  const item = document.createElement('li');
  item.id = BUTTON_ID;
  item.className = 'slot ika-alerts-btn';
  item.title = 'Alerts';

  const icon = document.createElement('div');
  icon.className = 'image ika-alerts-icon';

  const label = document.createElement('div');
  const labelText = document.createElement('span');
  label.className = 'name';
  labelText.className = 'namebox ika-alerts-label';
  labelText.textContent = 'Alerts';

  label.appendChild(labelText);
  item.append(icon, label);
  item.addEventListener('click', (event) => {
    event.preventDefault();
    alerts.toggle();
  });

  return item;
}

async function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  try {
    const menu = await waitForMenu();
    let slots = menu.querySelector('.menu_slots');

    if (!slots) {
      slots = document.createElement('ul');
      slots.className = 'menu_slots';
      menu.appendChild(slots);
    }

    const empireButton = document.getElementById('ika-empire-btn');
    if (empireButton?.parentElement === slots) {
      empireButton.after(createMenuButton());
    } else {
      slots.prepend(createMenuButton());
    }
  } catch (error) {
    console.warn('[IkaKit] Không inject được Alerts, dùng fallback:', error);
    createFallbackButton();
  }
}

function renderActiveTab() {
  if (!modal) return;

  modal.querySelectorAll('.ika-alerts-tab').forEach((button) => {
    button.classList.toggle('ika-alerts-tab-active', button.dataset.tab === activeTab);
  });

  const tab = TABS.find((item) => item.id === activeTab) || TABS[0];
  const content = modal.querySelector('#ika-alerts-content');
  content.replaceChildren();

  try {
    if (typeof tab.module?.renderPanel === 'function') {
      tab.module.renderPanel(content);
    } else {
      const status = tab.module?.getStatus?.();
      const empty = document.createElement('div');
      empty.className = 'ika-alerts-empty';
      empty.textContent = status?.message || 'This alert panel is not available.';
      content.appendChild(empty);
    }
  } catch (error) {
    console.warn('[IkaKit] Alerts panel render failed:', error);
    const message = document.createElement('div');
    message.className = 'ika-alerts-empty';
    message.textContent = 'This alert panel could not be rendered.';
    content.appendChild(message);
  }
}

function setActiveTab(tabId) {
  if (!TABS.some((tab) => tab.id === tabId)) return;

  activeTab = tabId;
  storage.set(STORAGE_KEY, activeTab).catch((error) => {
    console.warn('[IkaKit] Could not save Alerts tab:', error);
  });
  renderActiveTab();
}

function buildModal() {
  const wrapper = document.createElement('div');
  wrapper.id = 'ika-alerts-modal';
  wrapper.className = 'ika-modal ika-alerts-modal';

  const overlay = document.createElement('div');
  overlay.className = 'ika-modal-overlay';
  overlay.addEventListener('click', () => alerts.close());

  const windowEl = document.createElement('div');
  windowEl.className = 'ika-modal-window ika-alerts-window';

  const header = document.createElement('div');
  header.className = 'ika-modal-header';
  const title = document.createElement('span');
  title.className = 'ika-modal-title';
  title.textContent = 'Alerts';
  const close = document.createElement('button');
  close.className = 'ika-modal-close';
  close.type = 'button';
  close.title = 'Close';
  close.textContent = '×';
  close.addEventListener('click', () => alerts.close());
  header.append(title, close);

  const tabs = document.createElement('div');
  tabs.className = 'ika-alerts-tabs';
  TABS.forEach((tab) => {
    const button = document.createElement('button');
    button.className = 'ika-alerts-tab';
    button.type = 'button';
    button.dataset.tab = tab.id;
    button.textContent = tab.label;
    button.addEventListener('click', () => setActiveTab(tab.id));
    tabs.appendChild(button);
  });

  const content = document.createElement('div');
  content.id = 'ika-alerts-content';
  content.className = 'ika-modal-content ika-alerts-content';

  windowEl.append(header, tabs, content);
  wrapper.append(overlay, windowEl);
  document.body.appendChild(wrapper);
  enableModalDrag(windowEl, header);

  const defaultLeft = Math.max(12, Math.round((window.innerWidth - windowEl.getBoundingClientRect().width) / 2));
  const defaultTop = 48;
  const startPosition = modalPosition || { left: defaultLeft, top: defaultTop };
  placeModalWindow(windowEl, startPosition.left, startPosition.top, { persist: false });

  return wrapper;
}

const alerts = Object.freeze({
  init() {
    injectStyles();
    injectButton();
    storage.get(STORAGE_KEY).then((tab) => {
      if (TABS.some((item) => item.id === tab)) activeTab = tab;
    }).catch(() => {});
    storage.get(POSITION_STORAGE_KEY).then((position) => {
      modalPosition = normalizePosition(position);
    }).catch(() => {});
    window.addEventListener('resize', keepModalInViewport);
  },

  open() {
    injectStyles();
    if (!modal || !document.body.contains(modal)) {
      modal = buildModal();
    }
    modal.classList.add('ika-modal-open');
    renderActiveTab();
  },

  close() {
    modal?.remove();
    modal = null;
  },

  toggle() {
    if (modal && document.body.contains(modal)) {
      alerts.close();
      return;
    }

    alerts.open();
  },

  onPageChange() {
    injectButton();
  },
});

export default alerts;
