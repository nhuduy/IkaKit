// IkaKit — Game Data Layer
// Đọc dữ liệu từ ikariam global object qua bridge script chạy trong page world.

let _data = null;
let _lastNotifyKey = null;
const _listeners = new Set();

function _injectBridge() {
  if (document.getElementById('ika-game-data-bridge')) return;

  const script = document.createElement('script');
  script.id = 'ika-game-data-bridge';
  script.src = browser.runtime.getURL('content/helpers/gameDataBridge.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (!event.data || event.data.__ikakit !== 'gameData') return;
  _data = event.data.payload;

  const scan = _data?.debug?.scan ?? {};
  const notifyKey = [
    _data?.selectedCityId ?? '',
    _data?.cities?.length ?? 0,
    scan.inProgress ? '1' : '0',
    scan.fetched ?? 0,
    scan.total ?? 0,
    scan.revision ?? 0,
  ].join(':');

  if (notifyKey === _lastNotifyKey) return;
  _lastNotifyKey = notifyKey;

  _listeners.forEach((listener) => {
    try {
      listener(_data);
    } catch (error) {
      console.error('[IkaKit] gameData listener error:', error);
    }
  });
});

_injectBridge();

const gameData = {
  get() {
    return _data;
  },

  getCities() {
    return _data ? _data.cities : null;
  },

  getSelectedCityId() {
    return _data ? _data.selectedCityId : null;
  },

  getPlayerName() {
    return _data ? _data.playerName : null;
  },

  getDebug() {
    return _data ? _data.debug : null;
  },

  onChange(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    _listeners.add(listener);
    if (_data) {
      try {
        listener(_data);
      } catch (error) {
        console.error('[IkaKit] gameData listener error:', error);
      }
    }

    return () => _listeners.delete(listener);
  },

  requestCityScan() {
    window.postMessage({ __ikakit: 'requestCityScan' }, '*');
  },
};

export default gameData;
