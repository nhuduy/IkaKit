// IkaKit — Entry point
// Inject vào tất cả trang ikariam.gameforge.com

import navigation from './helpers/navigation.js';
import gameData   from './helpers/gameData.js';
import empire     from './modules/empire/index.js';
import transport  from './modules/transport/index.js';
import militaryAlerts from './modules/militaryAlerts/index.js';
import notificationAlerts from './modules/notificationAlerts/index.js';
import cityWatcher from './modules/cityWatcher/index.js';
import alerts from './modules/alerts/index.js';

function safeInit(name, callback) {
  try {
    callback();
  } catch (error) {
    console.error(`[IkaKit] ${name} init failed:`, error);
  }
}

function init() {
  console.log('[IkaKit] Đã khởi động. Trang hiện tại:', navigation.currentPage());

  // Khởi động Empire Manager
  safeInit('Empire Manager', () => empire.init());
  safeInit('Transport', () => transport.init(navigation.currentPage()));
  safeInit('Military Alerts', () => militaryAlerts.init());
  safeInit('Notification Alert', () => notificationAlerts.init());
  safeInit('Alerts', () => alerts.init());
  safeInit('City Watcher', () => cityWatcher.init());

  // Lắng nghe điều hướng — cập nhật UI khi user chuyển trang
  navigation.onChange((pageName) => {
    console.log('[IkaKit] Chuyển sang trang:', pageName);
    empire.onPageChange(pageName);
    transport.onPageChange(pageName);
    alerts.onPageChange(pageName);
  });
}

// Chờ DOM sẵn sàng rồi mới khởi động
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
