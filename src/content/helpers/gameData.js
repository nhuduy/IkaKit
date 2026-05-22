// IkaKit — Game Data Layer
// Đọc dữ liệu từ ikariam global object qua bridge script chạy trong page world.

let _data = null;

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
};

export default gameData;
