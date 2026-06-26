// IkaKit — Game Data Layer
// Đọc dữ liệu từ ikariam global object qua bridge script chạy trong page world.

import storage from './storage.js';

const CACHE_KEY = `ika_game_data_cache:${window.location.hostname}`;
const CACHE_SAVE_DELAY = 300;

let _data = null;
let _lastNotifyKey = null;
let _saveTimer = null;
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
  _data = _mergeCachedPayload(event.data.payload, _data);
  _scheduleCacheSave(_data);
  _notify();
});

function _notify() {
  const scan = _data?.debug?.scan ?? {};
  const notifyKey = [
    _data?.selectedCityId ?? '',
    _data?.cities?.length ?? 0,
    _detailCount(_data?.cities),
    scan.inProgress ? '1' : '0',
    scan.fetched ?? 0,
    scan.total ?? 0,
    scan.revision ?? 0,
    _data?.research?.updatedAt ?? 0,
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
}

function _mergeObject(live, cached) {
  if (!cached || typeof cached !== 'object') {
    return live ?? null;
  }

  if (!live || typeof live !== 'object') {
    return { ...cached };
  }

  return { ...cached, ...live };
}

function _hasDetail(city) {
  return Boolean(city?.resources || city?.buildings || city?.military);
}

function _detailCount(cities) {
  return Array.isArray(cities) ? cities.filter(_hasDetail).length : 0;
}

function _mergeCity(liveCity, cachedCity) {
  if (!cachedCity) return liveCity;
  if (!liveCity) return cachedCity;

  const merged = {
    ...cachedCity,
    ...liveCity,
  };

  merged.resources = _mergeObject(liveCity.resources, cachedCity.resources);
  merged.buildings = _mergeObject(liveCity.buildings, cachedCity.buildings);
  merged.military = _mergeObject(liveCity.military, cachedCity.military);
  merged.gold = liveCity.gold ?? cachedCity.gold ?? null;
  [
    'islandId',
    'coords',
    'tradegood',
    'tradeGood',
    'islandResource',
    'resource',
    'isCapital',
    'relationship',
  ].forEach((key) => {
    merged[key] = liveCity[key] ?? cachedCity[key] ?? null;
  });
  [
    'scientists',
    'maxScientists',
    'research',
    'corruption',
    'happiness',
    'populationGrowth',
    'occupiedSpace',
    'maxInhabitants',
  ].forEach((key) => {
    merged[key] = liveCity[key] ?? cachedCity[key] ?? null;
  });
  merged.updatedAt = liveCity.updatedAt ?? cachedCity.updatedAt ?? null;

  return merged;
}

function _mergeCachedPayload(livePayload, cachedPayload) {
  if (!livePayload || typeof livePayload !== 'object') {
    return cachedPayload ?? livePayload;
  }

  if (!cachedPayload?.cities?.length) {
    return livePayload;
  }

  const cachedById = new Map(
    cachedPayload.cities
      .filter((city) => city?.id)
      .map((city) => [Number(city.id), city]),
  );

  const liveCities = Array.isArray(livePayload.cities) ? livePayload.cities : [];
  const mergedCities = liveCities.map((city) => _mergeCity(city, cachedById.get(Number(city?.id))));
  const liveIds = new Set(mergedCities.map((city) => Number(city?.id)));

  cachedById.forEach((city, cityId) => {
    if (!liveIds.has(cityId)) {
      mergedCities.push(city);
    }
  });

  return {
    ...cachedPayload,
    ...livePayload,
    cities: mergedCities,
    research: _mergeObject(livePayload.research, cachedPayload.research),
    debug: {
      ...(cachedPayload.debug ?? {}),
      ...(livePayload.debug ?? {}),
      cache: {
        loaded: true,
        detailedCities: mergedCities.filter(_hasDetail).length,
      },
    },
  };
}

function _scheduleCacheSave(data) {
  if (!data?.cities?.length) return;

  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    storage.set(CACHE_KEY, {
      savedAt: Date.now(),
      payload: data,
    }).catch((error) => {
      console.warn('[IkaKit] Không lưu được empire cache:', error);
    });
  }, CACHE_SAVE_DELAY);
}

storage.get(CACHE_KEY).then((cached) => {
  if (!cached?.payload?.cities?.length) return;

  _data = _mergeCachedPayload(_data, cached.payload);
  _notify();
}).catch((error) => {
  console.warn('[IkaKit] Không đọc được empire cache:', error);
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

  requestCityScan(force = false) {
    window.postMessage({ __ikakit: 'requestCityScan', force: Boolean(force) }, '*');
  },

  requestResearchScan(force = false) {
    window.postMessage({ __ikakit: 'requestResearchScan', force: Boolean(force) }, '*');
  },

  openGameView(params) {
    window.postMessage({ __ikakit: 'openGameView', params }, '*');
  },

  changeCity(cityId) {
    window.postMessage({ __ikakit: 'changeCity', cityId }, '*');
  },

  upgradeBuilding(params) {
    window.postMessage({ __ikakit: 'upgradeBuilding', params }, '*');
  },
};

export default gameData;
