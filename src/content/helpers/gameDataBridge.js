(function() {
  var TICK = 500;
  var CACHE_TTL = 5 * 60 * 1000;
  var cityCache = {};
  var scanState = {
    inProgress: false,
    requested: false,
    fetched: 0,
    total: 0,
    lastStarted: null,
    lastCompleted: null,
    lastError: null,
    revision: 0
  };
  var RESOURCE_KEYS = {
    resource: 'wood',
    wood: 'wood',
    1: 'wine',
    wine: 'wine',
    2: 'marble',
    marble: 'marble',
    3: 'glass',
    crystal: 'glass',
    glass: 'glass',
    4: 'sulfur',
    sulphur: 'sulfur',
    sulfur: 'sulfur'
  };
  // Mapping numeric building ID → tên building (inverted từ BuildingsId trong const.js).
  // Cần thiết vì Ikariam có thể trả về {building: 0, level: 3} thay vì {building: 'townHall', level: 3}.
  var BUILDINGS_ID = {
    0:  'townHall',
    3:  'port',
    4:  'academy',
    5:  'shipyard',
    6:  'barracks',
    7:  'warehouse',
    8:  'wall',
    9:  'tavern',
    10: 'museum',
    11: 'palace',
    12: 'embassy',
    13: 'branchOffice',
    15: 'workshop',
    16: 'safehouse',
    17: 'palaceColony',
    18: 'forester',
    19: 'stonemason',
    20: 'glassblowing',
    21: 'winegrower',
    22: 'alchemist',
    23: 'carpentering',
    24: 'architect',
    25: 'optician',
    26: 'vineyard',
    27: 'fireworker',
    28: 'temple',
    29: 'dump',
    30: 'pirateFortress',
    31: 'blackMarket',
    32: 'marineChartArchive',
    33: 'dockyard'
  };

  var UNIT_IDS = {
    301: 'slinger',
    302: 'swordsman',
    303: 'phalanx',
    304: 'marksman',
    305: 'mortar',
    306: 'catapult',
    307: 'ram',
    308: 'steamgiant',
    309: 'bombardier',
    310: 'cook',
    311: 'medic',
    312: 'gyrocopter',
    313: 'archer',
    315: 'spearman',
    319: 'spartan',
    210: 'ship_ram',
    211: 'ship_flamethrower',
    212: 'ship_submarine',
    213: 'ship_ballista',
    214: 'ship_catapult',
    215: 'ship_mortar',
    216: 'ship_steamboat',
    217: 'ship_rocketship',
    218: 'ship_paddlespeedship',
    219: 'ship_ballooncarrier',
    220: 'ship_tender'
  };
  var CITY_MILITARY_UNITS = [
    null,
    'phalanx',
    'steamgiant',
    'spearman',
    'swordsman',
    'slinger',
    'archer',
    'marksman',
    'ram',
    null,
    'catapult',
    'mortar',
    'gyrocopter',
    'bombardier',
    'cook',
    'medic',
    'spartan'
  ];
  var CITY_MILITARY_SHIPS = [
    null,
    'ship_flamethrower',
    'ship_steamboat',
    'ship_ram',
    'ship_catapult',
    'ship_ballista',
    'ship_mortar',
    'ship_rocketship',
    'ship_submarine',
    null,
    'ship_paddlespeedship',
    'ship_ballooncarrier',
    'ship_tender'
  ];

  function asNumber(value, fallback) {
    var number = parseInt(value, 10);
    return Number.isFinite(number) ? number : fallback;
  }

  function textNumber(value) {
    if (value === null || typeof value === 'undefined') return 0;
    var normalized = String(value).replace(/[^\d-]/g, '');
    return asNumber(normalized, 0);
  }

  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
  }

  // Trả về argument đầu tiên != null/undefined (khác || vốn bỏ qua giá trị falsy như 0).
  function firstDefined() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] != null) return arguments[i];
    }
    return null;
  }

  function mergeObject(target, source) {
    if (!source || typeof source !== 'object') return target;

    Object.keys(source).forEach(function(key) {
      if (source[key] !== null && typeof source[key] !== 'undefined') {
        target[key] = source[key];
      }
    });

    return target;
  }

  function normalizeResources(source) {
    if (!source || typeof source !== 'object') return null;

    var resources = {};
    Object.keys(RESOURCE_KEYS).forEach(function(key) {
      if (!own(source, key)) return;
      resources[RESOURCE_KEYS[key]] = asNumber(source[key], 0);
    });

    if (own(source, 'gold')) resources.gold = asNumber(source.gold, 0);
    if (own(source, 'population')) resources.population = asNumber(source.population, 0);
    if (own(source, 'citizens')) resources.population = asNumber(source.citizens, 0);

    return Object.keys(resources).length ? resources : null;
  }

  function normalizeBuildingType(raw) {
    if (raw === null || typeof raw === 'undefined') return null;

    // Numeric building ID (e.g. 0 → 'townHall', 33 → 'dockyard').
    // Phải check trước vì `if (!raw)` sẽ bỏ qua ID 0 (townHall).
    var str = String(raw).trim();
    if (/^\d+$/.test(str)) {
      var numId = parseInt(str, 10);
      return own(BUILDINGS_ID, numId) ? BUILDINGS_ID[numId] : null;
    }

    var type = str
      .replace(/^building_/, '')
      .replace(/^constructionSite/, '');

    return type && !type.startsWith('buildingGround') ? type : null;
  }

  function addBuilding(buildings, rawType, rawLevel, extra) {
    var type = normalizeBuildingType(rawType);
    var level = asNumber(rawLevel, 0);
    if (!type || level <= 0) return;

    var data = {
      level: level
    };

    if (extra && typeof extra === 'object') {
      data.isUpgrading = Boolean(
        extra.isUpgrading
        || extra.upgrading
        || extra.inUpgrade
        || extra.underConstruction
        || extra.upgradeEndTime
        || extra.upgradeFinishTime
      );
    }

    if (!buildings[type] || level > buildings[type].level) {
      buildings[type] = data;
    }
  }

  function normalizeBuildings(source) {
    if (!source || typeof source !== 'object') return null;

    var buildings = {};
    [
      source.buildings,
      source.buildingLevels,
      source.buildingLevel,
      source.position,
      source.positions,
      source.buildingPositions
    ].forEach(function(candidate) {
      if (!candidate || typeof candidate !== 'object') return;

      if (Array.isArray(candidate)) {
        candidate.forEach(function(entry) {
          if (!entry || typeof entry !== 'object') return;
          addBuilding(
            buildings,
            firstDefined(entry.building, entry.type, entry.name),
            entry.level || entry.currentLevel || entry.buildingLevel,
            entry
          );
        });
        return;
      }

      Object.keys(candidate).forEach(function(key) {
        var entry = candidate[key];
        if (entry && typeof entry === 'object') {
          addBuilding(
            buildings,
            firstDefined(entry.building, entry.type, entry.name, key),
            entry.level || entry.currentLevel || entry.buildingLevel,
            entry
          );
        } else {
          addBuilding(buildings, key, entry, null);
        }
      });
    });

    return Object.keys(buildings).length ? buildings : null;
  }

  function normalizeUnitType(raw) {
    if (raw === null || typeof raw === 'undefined') return null;
    var key = String(raw);
    return UNIT_IDS[key] || key;
  }

  function addMilitaryCount(military, rawType, rawCount) {
    var type = normalizeUnitType(rawType);
    var count = asNumber(rawCount, 0);
    if (!type || count <= 0) return;
    military[type] = (military[type] || 0) + count;
  }

  function readMilitaryCollection(military, collection) {
    if (!collection || typeof collection !== 'object') return;

    if (Array.isArray(collection)) {
      collection.forEach(function(entry) {
        if (!entry || typeof entry !== 'object') return;
        addMilitaryCount(
          military,
          entry.type || entry.unitType || entry.unit || entry.unitId || entry.id,
          entry.count || entry.amount || entry.value || entry.quantity
        );
      });
      return;
    }

    Object.keys(collection).forEach(function(key) {
      var entry = collection[key];
      if (entry && typeof entry === 'object') {
        addMilitaryCount(
          military,
          entry.type || entry.unitType || entry.unit || entry.unitId || entry.id || key,
          entry.count || entry.amount || entry.value || entry.quantity
        );
      } else {
        addMilitaryCount(military, key, entry);
      }
    });
  }

  function normalizeMilitary(source) {
    if (!source || typeof source !== 'object') return null;

    var military = {};
    [
      source.military,
      source.units,
      source.ships,
      source.unitCounts,
      source.shipCounts,
      source.army,
      source.fleet,
      source.garrison
    ].forEach(function(collection) {
      readMilitaryCollection(military, collection);
    });

    return Object.keys(military).length ? military : null;
  }

  function enrichCity(city, source) {
    if (!source || typeof source !== 'object') return city;

    var resources = normalizeResources(source.resources)
      || normalizeResources(source.currentResources)
      || normalizeResources(source);
    var buildings = normalizeBuildings(source);
    var military = normalizeMilitary(source);

    if (resources) city.resources = resources;
    if (buildings) city.buildings = buildings;
    if (military) city.military = military;
    city.gold = source.gold || source.money || city.gold || null;
    city.population = source.population || source.citizens || city.population || null;

    return city;
  }

  function mergeCachedCity(city, cached) {
    if (!cached || typeof cached !== 'object') return city;

    [
      'name',
      'islandId',
      'coords',
      'tradegood',
      'isCapital',
      'relationship',
      'gold',
      'population'
    ].forEach(function(key) {
      if (cached[key] !== null && typeof cached[key] !== 'undefined') {
        city[key] = cached[key];
      }
    });

    if (cached.resources) city.resources = mergeObject(city.resources || {}, cached.resources);
    if (cached.buildings) city.buildings = mergeObject(city.buildings || {}, cached.buildings);
    if (cached.military) city.military = mergeObject(city.military || {}, cached.military);
    if (cached.updatedAt) city.updatedAt = cached.updatedAt;

    return city;
  }

  function cachePatch(cityId, patch) {
    var id = parseInt(cityId, 10);
    if (!Number.isFinite(id) || !patch || typeof patch !== 'object') return;

    var existing = cityCache[id] || { id: id };
    mergeObject(existing, patch);

    if (patch.resources) {
      existing.resources = mergeObject(existing.resources || {}, patch.resources);
    }
    if (patch.buildings) {
      existing.buildings = mergeObject(existing.buildings || {}, patch.buildings);
    }
    if (patch.military) {
      existing.military = mergeObject(existing.military || {}, patch.military);
    }

    existing.updatedAt = Date.now();
    cityCache[id] = existing;
    scanState.revision += 1;
  }

  function readCities(model) {
    var raw = model.relatedCityData || {};
    var selectedKey = raw.selectedCity || '';
    var selectedCityId = selectedKey ? parseInt(String(selectedKey).replace('city_', ''), 10) : null;

    var cities = Object.keys(raw)
      .filter(function(k) { return k.startsWith('city_'); })
      .map(function(k) {
        var c = raw[k] || {};
        return enrichCity({
          id: parseInt(k.replace('city_', ''), 10),
          name: c.name || null,
          islandId: c.islandId || null,
          coords: c.coords || null,
          tradegood: c.tradegood || null,
          isCapital: Boolean(c.isCapital),
          relationship: c.relationship || null,
          resources: null,
          buildings: null,
          military: null
        }, c);
      });

    return { cities: cities, selectedCityId: selectedCityId };
  }

  function enrichCurrentCity(cities, selectedCityId, model) {
    var city = cities.find(function(c) { return c.id === selectedCityId; });
    if (!city) return;

    if (model.currentResources) {
      city.resources = normalizeResources(model.currentResources) || city.resources;
    }

    try {
      var bg = ikariam.backgroundView;
      if (bg && bg.id === 'city' && bg.screen && bg.screen.data) {
        enrichCity(city, bg.screen.data);
      }
    } catch(e) {}
  }

  function applyCache(cities) {
    cities.forEach(function(city) {
      mergeCachedCity(city, cityCache[city.id]);
    });
  }

  function toQuery(params) {
    return Object.keys(params)
      .filter(function(key) {
        return params[key] !== null && typeof params[key] !== 'undefined';
      })
      .map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      })
      .join('&');
  }

  function extractAjaxItems(response) {
    if (Array.isArray(response)) return response;
    if (typeof response === 'string') {
      try {
        var parsed = JSON.parse(response);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_err) {
        return [];
      }
    }
    return [];
  }

  function readChangeViewScriptParams(item) {
    if (!item || item[0] !== 'changeView' || !Array.isArray(item[1])) return null;

    var meta = item[1][2];
    if (meta && typeof meta === 'object' && meta.viewScriptParams) {
      return meta.viewScriptParams;
    }

    return null;
  }

  function readChangeViewHtml(item) {
    if (!item || item[0] !== 'changeView' || !Array.isArray(item[1])) return null;

    for (var i = 0; i < item[1].length; i++) {
      if (typeof item[1][i] === 'string' && item[1][i].indexOf('militaryList') !== -1) {
        return item[1][i];
      }
    }

    return null;
  }

  function findDeepObject(root, predicate, depth) {
    if (!root || typeof root !== 'object' || depth > 5) return null;
    if (predicate(root)) return root;

    var keys = Object.keys(root);
    for (var i = 0; i < keys.length; i++) {
      var found = findDeepObject(root[keys[i]], predicate, depth + 1);
      if (found) return found;
    }

    return null;
  }

  function cacheFromGlobalData(data, fallbackCityId) {
    if (!data || typeof data !== 'object') return;

    if (data.actionRequest && typeof ikariam !== 'undefined' && ikariam.model) {
      ikariam.model.actionRequest = data.actionRequest;
    }

    var backgroundData = data.backgroundData || {};
    var headerData = data.headerData || {};
    var cityId = parseInt(firstDefined(backgroundData.id, headerData.id, fallbackCityId), 10);
    if (!Number.isFinite(cityId)) return;

    var patch = {
      id: cityId,
      name: firstDefined(backgroundData.name, headerData.name),
      islandId: firstDefined(backgroundData.islandId, headerData.islandId),
      isCapital: firstDefined(backgroundData.isCapital, headerData.isCapital)
    };

    var resources = normalizeResources(headerData.currentResources)
      || normalizeResources(headerData.resources)
      || normalizeResources(data.currentResources)
      || normalizeResources(data.resources);
    var buildings = normalizeBuildings({ position: backgroundData.position })
      || normalizeBuildings(backgroundData);
    var military = normalizeMilitary(backgroundData) || normalizeMilitary(headerData) || normalizeMilitary(data);

    if (resources) patch.resources = resources;
    if (buildings) patch.buildings = buildings;
    if (military) patch.military = military;

    cachePatch(cityId, patch);
  }

  function cacheFromViewScriptParams(params, fallbackCityId) {
    if (!params || typeof params !== 'object') return;

    var citySource = params.city || params.backgroundData || params;
    var candidate = findDeepObject(params, function(value) {
      return Array.isArray(value.position) || Array.isArray(value.positions);
    }, 0);

    var cityId = parseInt(firstDefined(
      citySource.id,
      citySource.cityId,
      params.cityId,
      fallbackCityId
    ), 10);
    if (!Number.isFinite(cityId)) return;

    var patch = {
      id: cityId,
      name: firstDefined(citySource.name, params.name),
      islandId: firstDefined(citySource.islandId, params.islandId),
      isCapital: firstDefined(citySource.isCapital, params.isCapital)
    };

    var resources = normalizeResources(params.currentResources)
      || normalizeResources(params.resources)
      || normalizeResources(citySource.resources)
      || normalizeResources(citySource);
    var buildings = normalizeBuildings(citySource)
      || normalizeBuildings(params)
      || normalizeBuildings(candidate);
    var military = normalizeMilitary(citySource) || normalizeMilitary(params);

    if (resources) patch.resources = resources;
    if (buildings) patch.buildings = buildings;
    if (military) patch.military = military;

    cachePatch(cityId, patch);
  }

  function readMilitaryCountTable(doc, selector, types) {
    var cells = doc.querySelectorAll(selector + ' .militaryList .count td');
    var military = {};

    types.forEach(function(type, index) {
      if (!type || !cells[index]) return;
      var count = textNumber(cells[index].textContent);
      if (count > 0) military[type] = count;
    });

    return military;
  }

  function cacheFromCityMilitaryHtml(html, fallbackCityId) {
    if (!html || typeof DOMParser === 'undefined') return;

    var doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (_err) {
      return;
    }

    var cityInput = doc.querySelector('input[name="cityId"]');
    var cityId = parseInt(firstDefined(cityInput && cityInput.value, fallbackCityId), 10);
    if (!Number.isFinite(cityId)) return;

    var military = mergeObject(
      readMilitaryCountTable(doc, '#tabUnits', CITY_MILITARY_UNITS),
      readMilitaryCountTable(doc, '#tabShips', CITY_MILITARY_SHIPS)
    );

    cachePatch(cityId, {
      id: cityId,
      military: military
    });
  }

  function processAjaxResponse(response, fallbackCityId) {
    var items = extractAjaxItems(response);

    items.forEach(function(item) {
      if (!Array.isArray(item)) return;

      if (item[0] === 'updateGlobalData') {
        cacheFromGlobalData(item[1], fallbackCityId);
        return;
      }

      var params = readChangeViewScriptParams(item);
      if (params) {
        cacheFromViewScriptParams(params, fallbackCityId);
      }

      var html = readChangeViewHtml(item);
      if (html) {
        cacheFromCityMilitaryHtml(html, fallbackCityId);
      }
    });
  }

  function fallbackCityIdFromUrl(rawUrl) {
    if (!rawUrl) return null;

    try {
      var url = new URL(String(rawUrl), window.location.href);
      return firstDefined(
        url.searchParams.get('cityId'),
        url.searchParams.get('currentCityId'),
        url.searchParams.get('destinationCityId')
      );
    } catch (_err) {
      return null;
    }
  }

  function shouldInspectAjaxUrl(rawUrl) {
    if (!rawUrl) return true;

    try {
      var url = new URL(String(rawUrl), window.location.href);
      if (url.origin !== window.location.origin) return false;
      return url.pathname.indexOf('/index.php') > -1 || url.searchParams.get('ajax') === '1';
    } catch (_err) {
      return true;
    }
  }

  function inspectAjaxText(text, rawUrl) {
    if (!text || typeof text !== 'string') return;
    if (text.indexOf('changeView') === -1 && text.indexOf('updateGlobalData') === -1) return;

    processAjaxResponse(text, fallbackCityIdFromUrl(rawUrl));
    send();
  }

  function installAjaxObserver() {
    if (window.__ikakitAjaxObserverInstalled) return;
    window.__ikakitAjaxObserverInstalled = true;

    if (typeof window.fetch === 'function') {
      var originalFetch = window.fetch;
      window.fetch = function() {
        var input = arguments[0];
        var rawUrl = input && input.url ? input.url : input;

        return originalFetch.apply(this, arguments).then(function(response) {
          try {
            var responseUrl = response && response.url ? response.url : rawUrl;
            if (response && shouldInspectAjaxUrl(responseUrl)) {
              response.clone().text().then(function(text) {
                inspectAjaxText(text, responseUrl);
              }).catch(function() {});
            }
          } catch (_err) {}

          return response;
        });
      };
    }

    if (typeof window.XMLHttpRequest === 'function') {
      var originalOpen = window.XMLHttpRequest.prototype.open;
      var originalSend = window.XMLHttpRequest.prototype.send;

      window.XMLHttpRequest.prototype.open = function(method, url) {
        this.__ikakitUrl = url;
        return originalOpen.apply(this, arguments);
      };

      window.XMLHttpRequest.prototype.send = function() {
        try {
          this.addEventListener('loadend', function() {
            try {
              if (!shouldInspectAjaxUrl(this.__ikakitUrl || this.responseURL)) return;
              inspectAjaxText(this.responseText, this.__ikakitUrl || this.responseURL);
            } catch (_err) {}
          });
        } catch (_err) {}

        return originalSend.apply(this, arguments);
      };
    }
  }

  function ikariamFetch(params) {
    var actionRequest = params.actionRequest;

    try {
      if (!actionRequest && typeof ikariam !== 'undefined' && ikariam.model) {
        actionRequest = ikariam.model.actionRequest;
      }
    } catch (_err) {}

    var query = toQuery(mergeObject({
      ajax: 1,
      actionRequest: actionRequest
    }, params));

    return fetch('/index.php?' + query, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }).then(function(response) {
      return response.text();
    });
  }

  function getOwnCityIds(cities) {
    return cities
      .filter(function(city) {
        return city.relationship === 'ownCity' || city.relationship === 'own' || city.relationship === 'self';
      })
      .map(function(city) { return city.id; });
  }

  function cacheStillFresh(cityId) {
    var cached = cityCache[cityId];
    if (!cached || !cached.updatedAt) return false;
    return Date.now() - cached.updatedAt < CACHE_TTL;
  }

  async function fetchCityOverview(cityId) {
    var response = await ikariamFetch({
      view: 'townHall',
      cityId: cityId,
      position: 0,
      backgroundView: 'city',
      currentCityId: cityId
    });
    processAjaxResponse(response, cityId);
  }

  async function fetchCityMilitary(cityId) {
    var response = await ikariamFetch({
      view: 'cityMilitary',
      cityId: cityId,
      backgroundView: 'city',
      currentCityId: cityId
    });
    processAjaxResponse(response, cityId);
  }

  async function scanAllCities(force) {
    if (scanState.inProgress) {
      scanState.requested = true;
      return;
    }

    try {
      if (typeof ikariam === 'undefined' || !ikariam.model) return;

      var parsed = readCities(ikariam.model);
      var ids = getOwnCityIds(parsed.cities);
      scanState.inProgress = true;
      scanState.requested = false;
      scanState.fetched = 0;
      scanState.total = ids.length;
      scanState.lastStarted = Date.now();
      scanState.lastError = null;
      scanState.revision += 1;
      send();

      for (var i = 0; i < ids.length; i++) {
        var cityId = ids[i];
        if (!force && cacheStillFresh(cityId)) {
          scanState.fetched += 1;
          continue;
        }

        try {
          await fetchCityOverview(cityId);
          await fetchCityMilitary(cityId);
        } catch (error) {
          scanState.lastError = String(error && error.message ? error.message : error);
        }

        scanState.fetched += 1;
        send();
      }
    } finally {
      scanState.inProgress = false;
      scanState.lastCompleted = Date.now();
      scanState.revision += 1;
      send();

      if (scanState.requested) {
        scanAllCities(false);
      }
    }
  }

  function send() {
    try {
      if (typeof ikariam === 'undefined' || !ikariam.model) return;

      var model = ikariam.model;
      var parsed = readCities(model);
      applyCache(parsed.cities);
      enrichCurrentCity(parsed.cities, parsed.selectedCityId, model);

      window.postMessage({
        __ikakit: 'gameData',
        payload: {
          playerName: model.ownerName || model.avatarName || model.name || null,
          playerId: model.avatarId ? parseInt(model.avatarId, 10) : null,
          selectedCityId: parsed.selectedCityId,
          cities: parsed.cities,
          debug: {
            source: 'ikariam.model',
            cityCount: parsed.cities.length,
            hasSelectedBuildings: parsed.cities.some(function(city) {
              return city.id === parsed.selectedCityId && !!city.buildings;
            }),
            hasMilitary: parsed.cities.some(function(city) {
              return !!city.military;
            }),
            scan: {
              inProgress: scanState.inProgress,
              fetched: scanState.fetched,
              total: scanState.total,
              lastError: scanState.lastError,
              revision: scanState.revision
            }
          }
        }
      }, '*');
    } catch(e) {}
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.__ikakit !== 'requestCityScan') return;
    scanAllCities(Boolean(event.data.force));
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.__ikakit !== 'openGameView') return;

    var params = event.data.params;
    if (!params || typeof params !== 'object') return;

    var query = '?' + toQuery(params);

    try {
      if (typeof ajaxHandlerCall === 'function') {
        ajaxHandlerCall(query);
        return;
      }
    } catch (_err) {}

    window.location.href = '/index.php' + query;
  });

  installAjaxObserver();
  setInterval(send, TICK);
  send();
}());
