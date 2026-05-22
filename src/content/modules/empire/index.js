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

let _modal       = null; // jQuery object của modal đang mở
let _activeTab   = 'resources';
let _activeModule = null; // module đang render trong tab

// ----------------------------------------------------------------
// Inject CSS — dùng web_accessible_resources nên cần getURL
// ----------------------------------------------------------------
function _injectStyles() {
  if (document.getElementById('ika-empire-style')) return;
  const link = document.createElement('link');
  link.id   = 'ika-empire-style';
  link.rel  = 'stylesheet';
  link.href = browser.runtime.getURL('css/ikaeasy.css');
  document.head.appendChild(link);
}

// ----------------------------------------------------------------
// Chờ một selector xuất hiện trong DOM (MutationObserver + timeout)
// ----------------------------------------------------------------
function _waitFor(selector, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) { resolve(existing); return; }

    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      reject(new Error(`[IkaKit] Timeout chờ "${selector}"`));
    }, timeout);
  });
}

// ----------------------------------------------------------------
// Inject button vào left menu của game (#js_viewCityMenu .menu_slots)
// Nếu không tìm thấy menu game → fallback nút nổi góc màn hình
// ----------------------------------------------------------------
async function _injectButton() {
  // Idempotent: không inject nếu đã có
  if ($('#ika-empire-btn').length) return;

  try {
    // Left menu của Ikariam xuất hiện sau khi game JS khởi động
    await _waitFor('#js_viewCityMenu');

    let $slots = $('#js_viewCityMenu .menu_slots');
    if (!$slots.length) {
      $slots = $('<ul class="menu_slots"></ul>');
      $('#js_viewCityMenu').append($slots);
    }

    const $btn = $(
      '<li id="ika-empire-btn" class="slot ika-empire-btn" title="Empire Manager">' +
        '<a href="javascript:void(0)">' +
          '<div class="ika-empire-icon">⚔</div>' +
          '<div class="ika-empire-label">Empire</div>' +
        '</a>' +
      '</li>'
    );

    $slots.prepend($btn);
    $btn.on('click', () => empire.toggle());

  } catch (_err) {
    // Fallback nút nổi — vẫn dùng được dù menu không tìm thấy
    console.warn('[IkaKit] Không tìm được #js_viewCityMenu, dùng FAB button.');
    const $fab = $('<button id="ika-empire-btn" class="ika-empire-fab">⚔ Empire</button>');
    $('body').append($fab);
    $fab.on('click', () => empire.toggle());
  }
}

// ----------------------------------------------------------------
// Tạo HTML cho modal
// ----------------------------------------------------------------
function _buildModalHtml() {
  const tabsHtml = TABS.map(tab =>
    '<button class="ika-tab' + (tab === _activeTab ? ' ika-tab-active' : '') +
    '" data-tab="' + tab + '">' + TAB_LABELS[tab] + '</button>'
  ).join('');

  return (
    '<div id="ika-empire-modal" class="ika-modal">' +
      '<div class="ika-modal-overlay"></div>' +
      '<div class="ika-modal-window">' +
        '<div class="ika-modal-header">' +
          '<span class="ika-modal-title">Empire Manager</span>' +
          '<button class="ika-modal-close" title="Close">&times;</button>' +
        '</div>' +
        '<div class="ika-modal-tabs">' + tabsHtml + '</div>' +
        '<div class="ika-modal-content" id="ika-empire-content">' +
          '<div class="ika-loading">Đang tải…</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ----------------------------------------------------------------
// Mở modal
// ----------------------------------------------------------------
async function _open() {
  if (_modal) return;

  $('body').append(_buildModalHtml());
  _modal = $('#ika-empire-modal');

  // Đóng khi click overlay hoặc nút ×
  _modal.find('.ika-modal-overlay').on('click', () => empire.close());
  _modal.find('.ika-modal-close').on('click',   () => empire.close());

  // Tab switching
  _modal.find('.ika-tab').on('click', function () {
    _switchTab($(this).data('tab'));
  });

  // Đóng bằng Escape (namespace để dễ unbind)
  $(document).on('keydown.ika-empire', (e) => {
    if (e.key === 'Escape') empire.close();
  });

  await _switchTab(_activeTab);
}

// ----------------------------------------------------------------
// Chuyển tab — hủy module cũ, load module mới qua dynamic import
// ----------------------------------------------------------------
async function _switchTab(tab) {
  if (!_modal) return;

  // Hủy module đang chạy nếu có
  if (_activeModule && typeof _activeModule.destroy === 'function') {
    _activeModule.destroy();
  }
  _activeModule = null;

  // Cập nhật trạng thái active trên tab bar
  _modal.find('.ika-tab').removeClass('ika-tab-active');
  _modal.find('.ika-tab[data-tab="' + tab + '"]').addClass('ika-tab-active');

  const $content = _modal.find('#ika-empire-content');
  $content.html('<div class="ika-loading">Đang tải…</div>');

  _activeTab = tab;
  await storage.set(STORAGE_KEY, tab);

  try {
    // Dynamic import — path tương đối từ file này
    const { default: mod } = await import('./' + tab + '.js');
    _activeModule = mod;

    // Lấy danh sách thành phố từ gameData (có thể null nếu game chưa sẵn)
    const cities = gameData.getCities();
    mod.render($content[0], cities);

  } catch (err) {
    console.error('[IkaKit] Không load được module "' + tab + '":', err);
    $content.html(
      '<div class="ika-error">Module "' + TAB_LABELS[tab] + '" chưa sẵn sàng.</div>'
    );
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------
const empire = {
  async init() {
    _injectStyles();

    // Restore tab đã lưu từ lần mở trước
    const saved = await storage.get(STORAGE_KEY);
    if (TABS.includes(saved)) _activeTab = saved;

    // Inject button — không block, chạy song song với phần còn lại của extension
    _injectButton().catch(err => console.error('[IkaKit] _injectButton:', err));
  },

  // Gọi lại khi navigation đổi trang, để re-inject nếu game xóa mất button
  ensureButton() {
    if (!$('#ika-empire-btn').length) {
      _injectButton().catch(() => {});
    }
  },

  // Gọi từ navigation.onChange khi user chuyển trang
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

    $(document).off('keydown.ika-empire');
    _modal.remove();
    _modal = null;

    if (_activeModule && typeof _activeModule.destroy === 'function') {
      _activeModule.destroy();
    }
    _activeModule = null;
  },
};

export default empire;
