(function() {
  var TICK = 500;
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

  function asNumber(value, fallback) {
    var number = parseInt(value, 10);
    return Number.isFinite(number) ? number : fallback;
  }

  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
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
    if (!raw) return null;

    var type = String(raw)
      .replace(/^building_/, '')
      .replace(/^constructionSite/, '')
      .trim();

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
            entry.building || entry.type || entry.name,
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
            entry.building || entry.type || entry.name || key,
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

  function send() {
    try {
      if (typeof ikariam === 'undefined' || !ikariam.model) return;

      var model = ikariam.model;
      var parsed = readCities(model);
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
            })
          }
        }
      }, '*');
    } catch(e) {}
  }

  setInterval(send, TICK);
  send();
}());
