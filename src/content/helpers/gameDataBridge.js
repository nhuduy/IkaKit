(function() {
  var TICK = 500;
  var CACHE_TTL = 5 * 60 * 1000;
  var RESEARCH_CACHE_TTL = 24 * 60 * 60 * 1000;
  var cityCache = {};
  var researchCache = null;
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
  var MULTIPLE_BUILDINGS = {
    warehouse: true,
    port: true,
    shipyard: true
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
  var MAX_SCIENTISTS = [0, 8, 12, 16, 22, 28, 35, 43, 51, 60, 69, 79, 89, 100, 111, 122, 134, 146, 159, 172, 185, 198, 212, 227, 241, 256, 271, 287, 302, 318, 335, 351, 368];
  var RESEARCH_TYPES = ['economy', 'knowledge', 'seafaring', 'military'];

  function asNumber(value, fallback) {
    var number = parseInt(value, 10);
    return Number.isFinite(number) ? number : fallback;
  }

  function textNumber(value) {
    if (value === null || typeof value === 'undefined') return 0;
    var normalized = String(value).replace(/[^\d-]/g, '');
    return asNumber(normalized, 0);
  }

  function optionalTextNumber(value) {
    if (value === null || typeof value === 'undefined') return null;
    var normalized = String(value)
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '');
    var number = parseFloat(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function optionalNumber(value) {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'object') return null;
    return optionalTextNumber(value);
  }

  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
  }

  function asBoolean(value) {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
    if (typeof value === 'string') {
      var normalized = value.toLowerCase().trim();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }

    return Boolean(value);
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

  function firstNumber() {
    for (var i = 0; i < arguments.length; i++) {
      var number = optionalNumber(arguments[i]);
      if (number !== null) return number;
    }

    return null;
  }

  function readGoldFromDom() {
    var selectors = [
      '#js_GlobalMenu_gold',
      '#js_GlobalMenu_money',
      '#globalResources .gold',
      '#cityResources .gold',
      '.resource_icon.gold',
      '.gold'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      if (!element) continue;

      var text = element.getAttribute('title') || element.textContent;
      var number = optionalTextNumber(text);
      if (number !== null) return number;
    }

    return null;
  }

  function readAccountGold(model) {
    var fromModel = firstNumber(
      model.gold,
      model.money,
      model.accountGold,
      model.currentGold,
      model.playerGold,
      model.avatarGold,
      model.resources && model.resources.gold,
      model.currentResources && model.currentResources.gold
    );

    return fromModel !== null ? fromModel : readGoldFromDom();
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

  function normalizeMaxResources(source) {
    return normalizeResources(source);
  }

  function normalizeProduction(source) {
    if (!source || typeof source !== 'object') return null;

    var production = {};
    Object.keys(RESOURCE_KEYS).forEach(function(key) {
      if (!own(source, key)) return;
      production[RESOURCE_KEYS[key]] = asNumber(source[key], 0);
    });

    if (own(source, 'wineSpendings')) production.wineSpendings = asNumber(source.wineSpendings, 0);
    if (own(source, 'wineSpending')) production.wineSpendings = asNumber(source.wineSpending, 0);

    return Object.keys(production).length ? production : null;
  }

  function productionFromHeaderData(source) {
    if (!source || typeof source !== 'object') return null;

    var production = {};
    var woodPerSecond = optionalNumber(source.resourceProduction);
    var tradegoodPerSecond = optionalNumber(source.tradegoodProduction);
    var producedTradegood = firstDefined(source.producedTradegood, source.tradegood, source.tradeGood, source.islandResource);
    var islandResource = RESOURCE_KEYS[producedTradegood] || RESOURCE_KEYS[String(producedTradegood || '').toLowerCase()];
    var wineSpendings = firstNumber(source.wineSpendings, source.wineSpending);

    if (woodPerSecond !== null) production.wood = Math.floor(woodPerSecond * 3600);
    if (tradegoodPerSecond !== null && islandResource) production[islandResource] = Math.floor(tradegoodPerSecond * 3600);
    if (wineSpendings !== null) production.wineSpendings = wineSpendings;

    return Object.keys(production).length ? production : null;
  }

  function normalizeCityStats(source) {
    if (!source || typeof source !== 'object') return null;

    var stats = {};
    [
      ['scientists', 'scientists'],
      ['scientistCount', 'scientists'],
      ['happinessLargeValue', 'happiness'],
      ['happiness', 'happiness'],
      ['populationGrowthValue', 'populationGrowth'],
      ['populationGrowth', 'populationGrowth'],
      ['occupiedSpace', 'occupiedSpace'],
      ['maxInhabitants', 'maxInhabitants'],
      ['maxScientists', 'maxScientists']
    ].forEach(function(pair) {
      if (!own(source, pair[0])) return;
      var number = optionalNumber(source[pair[0]]);
      if (number !== null) stats[pair[1]] = number;
    });

    return Object.keys(stats).length ? stats : null;
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
      if (extra.position !== null && typeof extra.position !== 'undefined') {
        data.position = asNumber(extra.position, extra.position);
      }

      if (extra.canUpgrade !== null && typeof extra.canUpgrade !== 'undefined') {
        data.canUpgrade = asBoolean(extra.canUpgrade);
      }
      if (extra.isBusy !== null && typeof extra.isBusy !== 'undefined') {
        data.isBusy = asBoolean(extra.isBusy);
      }
      if (extra.isMaxLevel !== null && typeof extra.isMaxLevel !== 'undefined') {
        data.isMaxLevel = asBoolean(extra.isMaxLevel);
      }
      if (extra.completed !== null && typeof extra.completed !== 'undefined') {
        data.completed = asNumber(extra.completed, extra.completed);
      }
      if (extra.name !== null && typeof extra.name !== 'undefined') {
        data.name = String(extra.name);
      }

      data.isUpgrading = Boolean(
        asBoolean(extra.isUpgrading)
        || asBoolean(extra.upgrading)
        || asBoolean(extra.inUpgrade)
        || asBoolean(extra.underConstruction)
        || asNumber(extra.completed, 0) > 0
        || extra.upgradeEndTime
        || extra.upgradeFinishTime
      );
    }

    if (MULTIPLE_BUILDINGS[type]) {
      if (!Array.isArray(buildings[type])) buildings[type] = [];
      buildings[type].push(data);
      buildings[type].sort(function(left, right) {
        var leftPos = asNumber(left.position, Number.MAX_SAFE_INTEGER);
        var rightPos = asNumber(right.position, Number.MAX_SAFE_INTEGER);
        return leftPos - rightPos;
      });
      return;
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
        candidate.forEach(function(entry, index) {
          if (!entry || typeof entry !== 'object') return;
          addBuilding(
            buildings,
            firstDefined(entry.building, entry.type, entry.name),
            entry.level || entry.currentLevel || entry.buildingLevel,
            mergeObject({ position: index }, entry)
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
            mergeObject({ position: key }, entry)
          );
        } else {
          addBuilding(buildings, key, entry, { position: key });
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
    var maxResources = normalizeMaxResources(source.maxResources)
      || normalizeMaxResources(source.resourceCapacity)
      || normalizeMaxResources(source.storageCapacity);
    var production = normalizeProduction(source.production)
      || productionFromHeaderData(source);
    var buildings = normalizeBuildings(source);
    var military = normalizeMilitary(source);

    if (resources) city.resources = resources;
    if (maxResources) city.maxResources = maxResources;
    if (production) city.production = production;
    if (buildings) city.buildings = buildings;
    if (military) city.military = military;
    mergeObject(city, normalizeCityStats(source));
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
    if (cached.maxResources) city.maxResources = mergeObject(city.maxResources || {}, cached.maxResources);
    if (cached.production) city.production = mergeObject(city.production || {}, cached.production);
    if (cached.buildings) city.buildings = mergeObject(city.buildings || {}, cached.buildings);
    if (cached.military) city.military = mergeObject(city.military || {}, cached.military);
    [
      'scientists',
      'happiness',
      'populationGrowth',
      'occupiedSpace',
      'maxInhabitants',
      'maxScientists',
      'corruption',
      'research',
      'storageCapacity',
      'resourceSafe'
    ].forEach(function(key) {
      if (cached[key] !== null && typeof cached[key] !== 'undefined') {
        city[key] = cached[key];
      }
    });
    if (cached.updatedAt) city.updatedAt = cached.updatedAt;

    return city;
  }

  function cachePatch(cityId, patch) {
    var id = parseInt(cityId, 10);
    if (!Number.isFinite(id) || !patch || typeof patch !== 'object') return;

    var existing = cityCache[id] || { id: id };

    Object.keys(patch).forEach(function(key) {
      if (['resources', 'maxResources', 'production', 'buildings', 'military'].indexOf(key) !== -1) return;
      if (patch[key] !== null && typeof patch[key] !== 'undefined') {
        existing[key] = patch[key];
      }
    });

    if (patch.resources) {
      existing.resources = mergeObject(existing.resources || {}, patch.resources);
    }
    if (patch.maxResources) {
      existing.maxResources = mergeObject(existing.maxResources || {}, patch.maxResources);
    }
    if (patch.production) {
      existing.production = mergeObject(existing.production || {}, patch.production);
    }
    if (patch.buildings) {
      existing.buildings = mergeObject(existing.buildings || {}, patch.buildings);
    }
    if (patch.military) {
      existing.military = mergeObject(existing.military || {}, patch.military);
    }
    [
      'scientists',
      'happiness',
      'populationGrowth',
      'occupiedSpace',
      'maxInhabitants',
      'maxScientists',
      'corruption',
      'research',
      'storageCapacity',
      'resourceSafe'
    ].forEach(function(key) {
      if (patch[key] !== null && typeof patch[key] !== 'undefined') {
        existing[key] = patch[key];
      }
    });

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
        return key.indexOf('__ikakit') !== 0
          && params[key] !== null
          && typeof params[key] !== 'undefined';
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

  function readNewJsParams(item) {
    if (!item || !Array.isArray(item)) return null;

    function inspect(value) {
      if (!value || typeof value !== 'object') return null;
      if (value.viewScriptParams) return value.viewScriptParams;
      if (value.new_js_params) {
        try {
          return typeof value.new_js_params === 'string' ? JSON.parse(value.new_js_params) : value.new_js_params;
        } catch (_err) {
          return null;
        }
      }
      return null;
    }

    for (var i = 0; i < item.length; i++) {
      var direct = inspect(item[i]);
      if (direct) return direct;
      if (Array.isArray(item[i])) {
        for (var j = 0; j < item[i].length; j++) {
          var nested = inspect(item[i][j]);
          if (nested) return nested;
        }
      }
    }

    return null;
  }

  function readChangeViewHtml(item) {
    if (!item || item[0] !== 'changeView' || !Array.isArray(item[1])) return null;

    for (var i = 0; i < item[1].length; i++) {
      if (typeof item[1][i] === 'string' && item[1][i].indexOf('<') !== -1) {
        return item[1][i];
      }
    }

    return null;
  }

  function looksLikeHtml(value) {
    return typeof value === 'string'
      && value.indexOf('<') !== -1
      && /<\s*(div|ul|ol|table|form|input|span|section|script)\b/i.test(value);
  }

  function collectHtmlStrings(value, output, depth) {
    if (depth > 6 || value === null || typeof value === 'undefined') return;

    if (looksLikeHtml(value)) {
      if (output.indexOf(value) === -1) output.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(function(item) {
        collectHtmlStrings(item, output, depth + 1);
      });
      return;
    }

    if (typeof value === 'object') {
      Object.keys(value).forEach(function(key) {
        collectHtmlStrings(value[key], output, depth + 1);
      });
    }
  }

  function readAjaxHtmlStrings(item) {
    var output = [];
    var changeViewHtml = readChangeViewHtml(item);
    if (changeViewHtml) output.push(changeViewHtml);
    collectHtmlStrings(item, output, 0);
    return output;
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeResearchCategory(type, source) {
    var items = [];
    var current = null;
    var available = 0;
    var completed = 0;

    if (source && typeof source === 'object') {
      Object.keys(source).forEach(function(label) {
        var entry = source[label];
        if (!entry || typeof entry !== 'object') return;
        var href = String(entry.aHref || entry.href || entry.url || '');
        var idMatch = href.match(/(\d+)(?:\D*)$/);
        var state = String(entry.liClass || entry.className || entry.state || '').toLowerCase();
        var rawName = cleanText(entry.name || entry.title || label);
        var futureMatch = rawName.match(/\((\d+)\)/);
        var item = {
          id: idMatch ? parseInt(idMatch[1], 10) : null,
          name: rawName.replace(/\s*\(\d+\)\s*$/, ''),
          state: state.indexOf('explored') > -1 ? 'completed' : (state.indexOf('explorable') > -1 ? 'available' : 'locked'),
          futureLevel: futureMatch ? Math.max(0, parseInt(futureMatch[1], 10) - 1) : null
        };
        if (item.state === 'completed') completed += 1;
        if (item.state === 'available') available += 1;
        if (!current && item.state === 'available') current = item;
        items.push(item);
      });
    }

    return {
      type: type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      current: current,
      available: available,
      completed: completed,
      total: items.length,
      items: items
    };
  }

  function cacheResearchCategory(type, source) {
    if (RESEARCH_TYPES.indexOf(type) === -1) return;
    var cache = researchCache || { updatedAt: Date.now(), categories: {}, currentType: null };
    cache.categories = cache.categories || {};
    cache.categories[type] = normalizeResearchCategory(type, source);
    cache.currentType = type;
    cache.updatedAt = Date.now();
    cache.lastError = null;
    researchCache = cache;
    scanState.revision += 1;
  }

  function cacheResearchFromParams(params) {
    if (!params || typeof params !== 'object') return;
    var type = params.researchType || params.currentResearchType || params.currResearchCategory;
    var data = params.currResearchType || params.researches || params.research || params.items;
    if (!type && data && typeof data === 'object') {
      RESEARCH_TYPES.forEach(function(candidate) {
        if (data[candidate]) cacheResearchCategory(candidate, data[candidate]);
      });
      return;
    }
    if (type && data) cacheResearchCategory(String(type), data);
  }

  function cacheResearchFromHtml(html, fallbackType) {
    if (!html || typeof DOMParser === 'undefined') return;
    var doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (_err) {
      return;
    }

    var type = fallbackType || RESEARCH_TYPES.find(function(candidate) {
      return Boolean(doc.querySelector('[href*="researchType=' + candidate + '"], .research_' + candidate + ', #' + candidate));
    }) || null;
    if (!type) return;

    var source = {};
    Array.prototype.forEach.call(doc.querySelectorAll('li, tr, .researchItem, [class*="research"]'), function(node, index) {
      var text = cleanText(node.textContent);
      if (!text || text.length < 3) return;
      source[text.slice(0, 80) + ':' + index] = {
        name: text,
        aHref: node.querySelector('a[href]') && node.querySelector('a[href]').href,
        liClass: node.className || ''
      };
    });
    if (Object.keys(source).length) cacheResearchCategory(type, source);
  }

  function maybeSendMilitaryAdvisorHtml(html) {
    if (!html || typeof html !== 'string') return;

    var lower = html.toLowerCase();
    var looksMilitary =
      lower.indexOf('militaryadvisor') !== -1
      || lower.indexOf('eventmovement') !== -1
      || lower.indexOf('militaryevent') !== -1
      || lower.indexOf('military event') !== -1
      || lower.indexOf('combat') !== -1
      || lower.indexOf('attack') !== -1
      || lower.indexOf('blockade') !== -1
      || lower.indexOf('occupation') !== -1;

    if (!looksMilitary) return;

    window.postMessage({
      __ikakit: 'militaryAdvisorHtml',
      html: html
    }, '*');
  }

  function townNewsHtmlFragments(response) {
    var fragments = [];
    extractAjaxItems(response).forEach(function(item) {
      readAjaxHtmlStrings(item).forEach(function(fragment) {
        if (fragments.indexOf(fragment) === -1) fragments.push(fragment);
      });
    });
    return fragments;
  }

  function sendTownNewsScanResult(result) {
    window.postMessage(mergeObject({
      __ikakit: 'townNewsScanResult',
      ok: false,
      html: '',
      htmlFragments: [],
      responseLength: 0,
      fragmentCount: 0,
      error: null
    }, result), '*');
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
    var maxResources = normalizeMaxResources(headerData.maxResources)
      || normalizeMaxResources(data.maxResources);
    var production = productionFromHeaderData(headerData)
      || productionFromHeaderData(data)
      || normalizeProduction(headerData.production)
      || normalizeProduction(data.production);
    var buildings = normalizeBuildings({ position: backgroundData.position })
      || normalizeBuildings(backgroundData);
    var military = normalizeMilitary(backgroundData) || normalizeMilitary(headerData) || normalizeMilitary(data);
    var stats = normalizeCityStats(backgroundData) || normalizeCityStats(headerData) || normalizeCityStats(data);

    if (resources) patch.resources = resources;
    if (maxResources) patch.maxResources = maxResources;
    if (production) patch.production = production;
    if (buildings) patch.buildings = buildings;
    if (military) patch.military = military;
    if (stats) mergeObject(patch, stats);

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
    var maxResources = normalizeMaxResources(params.maxResources)
      || normalizeMaxResources(citySource.maxResources);
    var production = productionFromHeaderData(params)
      || productionFromHeaderData(citySource)
      || normalizeProduction(params.production)
      || normalizeProduction(citySource.production);
    var buildings = normalizeBuildings(citySource)
      || normalizeBuildings(params)
      || normalizeBuildings(candidate);
    var military = normalizeMilitary(citySource) || normalizeMilitary(params);
    var stats = normalizeCityStats(citySource) || normalizeCityStats(params);

    if (resources) patch.resources = resources;
    if (maxResources) patch.maxResources = maxResources;
    if (production) patch.production = production;
    if (buildings) patch.buildings = buildings;
    if (military) patch.military = military;
    if (stats) mergeObject(patch, stats);

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
    if (!html || html.indexOf('militaryList') === -1 || typeof DOMParser === 'undefined') return;

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

  function readDocNumber(doc, selector) {
    var element = doc.querySelector(selector);
    if (!element) return null;
    return optionalTextNumber(element.textContent);
  }

  function cacheFromTownHallHtml(html, fallbackCityId) {
    if (!html || html.indexOf('js_TownHall') === -1 || typeof DOMParser === 'undefined') return;

    var doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (_err) {
      return;
    }

    var cityInput = doc.querySelector('input[name="cityId"]');
    var cityId = parseInt(firstDefined(cityInput && cityInput.value, fallbackCityId), 10);
    if (!Number.isFinite(cityId)) return;

    var patch = {
      id: cityId,
      scientists: readDocNumber(doc, '#js_TownHallPopulationGraphScientistCount'),
      happiness: readDocNumber(doc, '#js_TownHallHappinessLargeValue'),
      populationGrowth: readDocNumber(doc, '#js_TownHallPopulationGrowthValue'),
      occupiedSpace: readDocNumber(doc, '#js_TownHallOccupiedSpace'),
      maxInhabitants: readDocNumber(doc, '#js_TownHallMaxInhabitants')
    };

    cachePatch(cityId, patch);
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
        cacheResearchFromParams(params);
      }

      var newParams = readNewJsParams(item);
      if (newParams) {
        cacheResearchFromParams(newParams);
      }

      var html = readChangeViewHtml(item);
      if (html) {
        cacheFromCityMilitaryHtml(html, fallbackCityId);
        cacheFromTownHallHtml(html, fallbackCityId);
        cacheResearchFromHtml(html, null);
        maybeSendMilitaryAdvisorHtml(html);
      }

      readAjaxHtmlStrings(item).forEach(function(fragment) {
        cacheResearchFromHtml(fragment, null);
      });
    });
  }

  function buildingLevel(city, type) {
    var building = city && city.buildings && city.buildings[type];
    if (!building) return 0;
    if (Array.isArray(building)) {
      return building.reduce(function(max, item) {
        return Math.max(max, asNumber(item && (item.level || item.currentLevel || item.buildingLevel), 0));
      }, 0);
    }
    if (typeof building === 'number') return building;
    if (typeof building === 'object') {
      return asNumber(building.level || building.currentLevel || building.buildingLevel, 0);
    }

    return 0;
  }

  function buildingItems(city, type) {
    var building = city && city.buildings && city.buildings[type];
    if (!building) return [];
    return Array.isArray(building) ? building : [building];
  }

  function calculateResourceSafe(city) {
    var safe = 100;
    var warehouses = buildingItems(city, 'warehouse');

    warehouses.forEach(function(warehouse) {
      safe += 480 * asNumber(warehouse && (warehouse.level || warehouse.currentLevel || warehouse.buildingLevel), 0);
    });

    return safe;
  }

  function calculateCorruption(city, cityCount) {
    if (!cityCount) return null;
    var residenceLevel = Math.max(
      buildingLevel(city, 'palace'),
      buildingLevel(city, 'palaceColony')
    );
    var corruption = 1 - (residenceLevel + 1) / cityCount;
    return Math.min(Math.max(corruption, 0), 1);
  }

  function enrichDerivedCityStats(cities) {
    var ownCount = getOwnCityIds(cities).length || cities.length || 0;

    cities.forEach(function(city) {
      var academyLevel = buildingLevel(city, 'academy');

      if (city.maxScientists === null || typeof city.maxScientists === 'undefined') {
        city.maxScientists = MAX_SCIENTISTS[academyLevel] || 0;
      }

      if (city.corruption === null || typeof city.corruption === 'undefined') {
        city.corruption = calculateCorruption(city, ownCount);
      }

      if (city.maxResources && typeof city.maxResources === 'object') {
        city.storageCapacity = firstNumber(
          city.maxResources.wood,
          city.maxResources.wine,
          city.maxResources.marble,
          city.maxResources.glass,
          city.maxResources.sulfur
        );
      }

      if (city.buildings || city.resourceSafe === null || typeof city.resourceSafe === 'undefined') {
        city.resourceSafe = calculateResourceSafe(city);
      }

      if (city.scientists !== null && typeof city.scientists !== 'undefined') {
        var corruptionMultiplier = city.corruption !== null && typeof city.corruption !== 'undefined'
          ? 1 - city.corruption
          : 1;
        city.research = Math.max(0, city.scientists * corruptionMultiplier);
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

  async function fetchMilitaryAdvisor() {
    if (typeof ikariam === 'undefined' || !ikariam.model) return;

    var selectedCityId = null;
    try {
      selectedCityId = readCities(ikariam.model).selectedCityId;
    } catch (_err) {}

    var response = await ikariamFetch({
      view: 'militaryAdvisor',
      backgroundView: 'city',
      currentCityId: selectedCityId
    });
    processAjaxResponse(response, selectedCityId);
  }

  async function fetchTownNewsAdvisor() {
    var selectedCityId = null;
    var urlParams = null;
    try {
      urlParams = new URLSearchParams(window.location.search);
      if (typeof ikariam !== 'undefined' && ikariam.model) {
        selectedCityId = readCities(ikariam.model).selectedCityId;
      }
    } catch (_err) {}
    if (!selectedCityId) {
      try {
        selectedCityId = urlParams && (urlParams.get('cityId') || urlParams.get('currentCityId'));
      } catch (_err2) {}
    }
    if (!selectedCityId) {
      var cityInput = document.querySelector('#js_cityIdOnChange, input[name="cityId"]');
      selectedCityId = cityInput && cityInput.value;
    }

    var response = await ikariamFetch({
      view: 'tradeAdvisor',
      oldView: 'city',
      oldBackgroundView: urlParams && urlParams.get('oldBackgroundView'),
      containerWidth: urlParams && urlParams.get('containerWidth'),
      containerHeight: urlParams && urlParams.get('containerHeight'),
      worldviewWidth: urlParams && urlParams.get('worldviewWidth'),
      worldviewHeight: urlParams && urlParams.get('worldviewHeight'),
      cityTop: urlParams && urlParams.get('cityTop'),
      cityLeft: urlParams && urlParams.get('cityLeft'),
      cityRight: urlParams && urlParams.get('cityRight'),
      cityWorldviewScale: urlParams && urlParams.get('cityWorldviewScale'),
      cityId: selectedCityId,
      backgroundView: 'city',
      currentCityId: selectedCityId
    });
    var fragments = townNewsHtmlFragments(response);
    sendTownNewsScanResult({
      ok: true,
      html: response,
      htmlFragments: fragments,
      responseLength: response.length,
      fragmentCount: fragments.length
    });
    processAjaxResponse(response, selectedCityId);
  }

  async function fetchResearchAdvisor(force) {
    if (!force && researchCache && researchCache.updatedAt && Date.now() - researchCache.updatedAt < RESEARCH_CACHE_TTL) return;

    for (var i = 0; i < RESEARCH_TYPES.length; i++) {
      var type = RESEARCH_TYPES[i];
      try {
        var response = await ikariamFetch({
          view: 'noViewChange',
          researchType: type,
          templateView: 'researchAdvisor'
        });
        processAjaxResponse(response, null);
        extractAjaxItems(response).forEach(function(item) {
          var params = readNewJsParams(item) || readChangeViewScriptParams(item);
          if (params && params.currResearchType) cacheResearchCategory(type, params.currResearchType);
        });
        cacheResearchFromHtml(response, type);
      } catch (error) {
        researchCache = mergeObject(researchCache || { categories: {} }, {
          updatedAt: Date.now(),
          lastError: String(error && error.message ? error.message : error)
        });
      }
    }
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
          send();
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
      var accountGold = readAccountGold(model);
      applyCache(parsed.cities);
      enrichCurrentCity(parsed.cities, parsed.selectedCityId, model);
      enrichDerivedCityStats(parsed.cities);

      if (accountGold !== null) {
        parsed.cities.forEach(function(city) {
          city.gold = accountGold;
        });
      }

      window.postMessage({
        __ikakit: 'gameData',
        payload: {
          playerName: model.ownerName || model.avatarName || model.name || null,
          playerId: model.avatarId ? parseInt(model.avatarId, 10) : null,
          accountGold: accountGold,
          selectedCityId: parsed.selectedCityId,
          cities: parsed.cities,
          research: researchCache,
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
              lastStarted: scanState.lastStarted,
              lastCompleted: scanState.lastCompleted,
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
    if (!event.data || event.data.__ikakit !== 'requestMilitaryAdvisorScan') return;

    fetchMilitaryAdvisor().catch(function() {});
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.__ikakit !== 'requestTownNewsScan') return;

    fetchTownNewsAdvisor().catch(function(error) {
      sendTownNewsScanResult({
        error: String(error && error.message ? error.message : error)
      });
    });
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.__ikakit !== 'requestResearchScan') return;

    fetchResearchAdvisor(Boolean(event.data.force)).then(send).catch(function(error) {
      researchCache = mergeObject(researchCache || { categories: {} }, {
        updatedAt: Date.now(),
        lastError: String(error && error.message ? error.message : error)
      });
      send();
    });
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.__ikakit !== 'openGameView') return;

    var params = event.data.params;
    if (!params || typeof params !== 'object') return;

    var query = '?' + toQuery(params);

    try {
      if (params.__ikakitMode !== 'location' && typeof ajaxHandlerCall === 'function') {
        ajaxHandlerCall(query);
        return;
      }
    } catch (_err) {}

    window.location.href = '/index.php' + query;
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.__ikakit !== 'changeCity') return;

    var cityId = event.data.cityId;
    if (!cityId) return;

    try {
      var cityInput = document.querySelector('#js_cityIdOnChange');
      var changeForm = document.querySelector('#changeCityForm');
      if (cityInput && changeForm && typeof ajaxHandlerCallFromForm === 'function') {
        cityInput.value = cityId;
        ajaxHandlerCallFromForm(changeForm);
        setTimeout(function() {
          try {
            var selectedCity = ikariam && ikariam.model && ikariam.model.relatedCityData && ikariam.model.relatedCityData.selectedCity;
            if (selectedCity && String(selectedCity).replace('city_', '') === String(cityId)) return;
          } catch (_err2) {}

          window.location.href = '/index.php?view=city&cityId=' + encodeURIComponent(cityId);
        }, 300);
        return;
      }
    } catch (_err) {}

    window.location.href = '/index.php?view=city&cityId=' + encodeURIComponent(cityId);
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.__ikakit !== 'upgradeBuilding') return;

    var params = event.data.params;
    if (!params || typeof params !== 'object') return;

    var actionRequest = params.actionRequest;
    try {
      if (!actionRequest && typeof ikariam !== 'undefined' && ikariam.model) {
        actionRequest = ikariam.model.actionRequest;
      }
    } catch (_err) {}

    var cityId = params.cityId || params.currentCityId;
    if (!cityId) {
      try {
        cityId = new URLSearchParams(window.location.search).get('cityId');
      } catch (_err3) {}
    }
    if (!cityId) {
      var cityInput = document.querySelector('#js_cityIdOnChange, input[name="cityId"]');
      cityId = cityInput && cityInput.value;
    }
    if (!cityId) {
      try {
        var cityLink = document.querySelector('a[href*="cityId="]');
        cityId = cityLink ? new URL(cityLink.href, window.location.href).searchParams.get('cityId') : cityId;
      } catch (_err5) {}
    }
    if (!cityId) {
      try {
        var selectedCity = ikariam && ikariam.model && ikariam.model.relatedCityData && ikariam.model.relatedCityData.selectedCity;
        cityId = selectedCity ? String(selectedCity).replace('city_', '') : cityId;
      } catch (_err4) {}
    }

    if (!cityId) return;

    var query = toQuery({
      action: 'UpgradeExistingBuilding',
      actionRequest: actionRequest,
      cityId: cityId,
      position: params.position,
      level: params.level
    });

    try {
      if (typeof ajaxHandlerCall === 'function') {
        ajaxHandlerCall('/index.php?' + query);
        return;
      }
    } catch (_err2) {}

    window.location.href = '/index.php?' + query;
  });

  installAjaxObserver();
  setInterval(send, TICK);
  send();
}());
