// IkaKit — Game Data Layer
// Đọc dữ liệu từ ikariam global object qua bridge script inject vào page world.
// Content script chạy trong isolated world nên không thể trực tiếp đọc ikariam.model.

let _data = null;

// Bridge chạy trong page world, đọc ikariam.model rồi postMessage về.
function _injectBridge() {
  const script = document.createElement('script');
  script.textContent = `(function() {
    var TICK = 500; // ms

    function readCities(model) {
      var raw = model.relatedCityData || {};
      var selectedKey = raw.selectedCity || '';
      var selectedCityId = selectedKey ? parseInt(selectedKey.replace('city_', ''), 10) : null;

      var cities = Object.keys(raw)
        .filter(function(k) { return k.startsWith('city_'); })
        .map(function(k) {
          var c = raw[k];
          return {
            id:        parseInt(k.replace('city_', ''), 10),
            name:      c.name || null,
            islandId:  c.islandId || null,
            isCapital: c.isCapital || false,
            resources: null,
            buildings: null,
            military:  null,
          };
        });

      return { cities: cities, selectedCityId: selectedCityId };
    }

    function enrichCurrentCity(cities, selectedCityId, model) {
      var city = cities.find(function(c) { return c.id === selectedCityId; });
      if (!city) return;

      // Tài nguyên thành phố hiện tại
      var res = model.currentResources;
      if (res) {
        city.resources = {
          wood:   res.resource   || 0,
          wine:   res[1]         || 0,
          marble: res[2]         || 0,
          glass:  res[3]         || 0,
          sulfur: res[4]         || 0,
        };
      }

      // Công trình — chỉ có khi đang ở city background view
      try {
        var bg = ikariam.backgroundView;
        if (bg && bg.id === 'city' && bg.screen && bg.screen.data) {
          var positions = bg.screen.data.position;
          if (Array.isArray(positions)) {
            var buildings = {};
            positions.forEach(function(b) {
              if (!b.name) return;
              var type = b.building.replace('constructionSite', '').trim();
              if (!type) return;
              var lvl = parseInt(b.level, 10) || 0;
              // Một city có thể có nhiều warehouse — lấy level cao nhất
              if (!buildings[type] || lvl > buildings[type]) {
                buildings[type] = lvl;
              }
            });
            city.buildings = buildings;
          }
        }
      } catch(e) {}
    }

    function send() {
      try {
        if (typeof ikariam === 'undefined' || !ikariam.model) return;
        var m = ikariam.model;

        var parsed = readCities(m);
        enrichCurrentCity(parsed.cities, parsed.selectedCityId, m);

        // Tên người chơi — thử nhiều trường khác nhau theo version game
        var playerName = m.ownerName || m.avatarName || m.name || null;
        var playerId   = m.avatarId ? parseInt(m.avatarId, 10) : null;

        window.postMessage({
          __ikakit: 'gameData',
          payload: {
            playerName:     playerName,
            playerId:       playerId,
            selectedCityId: parsed.selectedCityId,
            cities:         parsed.cities,
          }
        }, '*');
      } catch(e) {}
    }

    setInterval(send, TICK);
    send();
  })();`;

  document.documentElement.appendChild(script);
  script.remove();
}

// Lắng nghe data từ bridge
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (!event.data || event.data.__ikakit !== 'gameData') return;
  _data = event.data.payload;
});

_injectBridge();

const gameData = {
  // Trả về toàn bộ snapshot game, null nếu chưa có data
  get() {
    return _data;
  },

  // Danh sách thành phố của player
  getCities() {
    return _data ? _data.cities : null;
  },

  // ID thành phố đang được chọn
  getSelectedCityId() {
    return _data ? _data.selectedCityId : null;
  },

  // Tên người chơi
  getPlayerName() {
    return _data ? _data.playerName : null;
  },
};

export default gameData;
