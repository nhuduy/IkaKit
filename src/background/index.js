// IkaKit — Background Service Worker (Chrome) / Background Script (Firefox)
// Dùng browser.* thay vì chrome.* — webextension-polyfill lo phần còn lại

browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[IkaKit] Đã cài đặt thành công.');
  }

  if (reason === 'update') {
    console.log('[IkaKit] Đã cập nhật lên phiên bản mới.');
  }
});
