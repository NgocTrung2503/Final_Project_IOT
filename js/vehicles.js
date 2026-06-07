// ============================================================
//  VEHICLE MANAGER
//  Quáº£n lÃ½ markers, popups vÃ  animation cá»§a phÆ°Æ¡ng tiá»‡n trÃªn báº£n Ä‘á»“
// ============================================================

class VehicleManager {
  constructor(map) {
    this.map = map;
    this.markers = {};       // vehicleId â†’ L.marker
    this.prevPositions = {}; // vehicleId â†’ {lat, lng}
    this.pathHistory = {};
    this.trailLayers = {};
    this.trailSegmentLayers = {};
    this.autoStops = {};
    this.autoStopMarkers = {};
    this.reverseGeocodeCache = {};
    this.currentLocationCache = {};
    this.pendingGeocodes = new Set();
    this.pendingCurrentGeocodes = new Set();
    this.persistHistoryPoint = null;
    this.persistAutoStop = null;
    this.defaultKnownAreas = [
      {
        id: "ktx_khu_a_dhqg",
        name: "Ký túc xá Khu A ĐHQG TPHCM",
        priority: 100,
        polygon: [
          { lat: 10.8686, lng: 106.8002 },
          { lat: 10.8729, lng: 106.7989 },
          { lat: 10.8792, lng: 106.8028 },
          { lat: 10.8790, lng: 106.8098 },
          { lat: 10.8734, lng: 106.8112 },
          { lat: 10.8688, lng: 106.8067 },
        ],
      },
    ];
    this.knownAreas = [...this.defaultKnownAreas];
    this.selectedId = null;
    this.filterType = "all"; // "all" | "bus" | "metro"
    this.onSelectCallback = null;
  }

  setPersistenceHandlers({ saveHistoryPoint, saveAutoStop } = {}) {
    this.persistHistoryPoint = typeof saveHistoryPoint === "function" ? saveHistoryPoint : null;
    this.persistAutoStop = typeof saveAutoStop === "function" ? saveAutoStop : null;
  }

  isFireAlert(vehicle) {
    return vehicle.fireAlert === true ||
      vehicle.fire === true ||
      vehicle.mq2Alert === true ||
      vehicle.smokeAlert === true ||
      vehicle.gasAlert === true ||
      vehicle.fireStatus === "alert" ||
      vehicle.mq2Status === "alert";
  }

  _normalizePath(path) {
    if (!path) return [];
    const list = Array.isArray(path) ? path : Object.values(path);
    return list
      .map(p => [Number(p.lat ?? p.latitude), Number(p.lng ?? p.lon ?? p.longitude)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }

  _autoStopIcon(color) {
    return L.divIcon({
      className: "",
      html: `<div class="stop-marker auto-stop-marker" style="background:${color}; border-color:${color}66"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  _formatStopBaseName(name) {
    const clean = this._fixText(name || "Trạm GPS")
      .trim()
      .replace(/^(trạm\s+)+/i, "Trạm ");
    if (!clean) return "Trạm GPS";
    if (/^(tram|trạm)\s/i.test(clean)) return clean;
    return `Trạm ${clean}`;
  }

  _isBuildingCodeName(name) {
    const clean = String(name || "").trim();
    return /^[A-Z]\d{1,3}[A-Z]?$/i.test(clean) || /^H\d{1,3}$/i.test(clean);
  }

  _areaPriority(tags = {}) {
    const text = `${tags.name || ""} ${tags.amenity || ""} ${tags.building || ""} ${tags.landuse || ""} ${tags.office || ""} ${tags.operator || ""}`.toLowerCase();
    if (/ktx|ký túc|ky tuc|dorm|dormitory|hostel/.test(text)) return 100;
    if (/university|college|school|kindergarten|education|đại học|dai hoc|trường|truong/.test(text)) return 90;
    if (/company|corporate|office|công ty|cong ty|business/.test(text)) return 85;
    if (/government|administrative|public/.test(text)) return 80;
    return 0;
  }

  setKnownAreas(areas = []) {
    const normalized = (areas || [])
      .map((area, index) => {
        const polygonSource = area.polygon || area.points || area.boundary || [];
        const polygon = (Array.isArray(polygonSource) ? polygonSource : Object.values(polygonSource))
          .map(point => ({
            lat: Number(point.lat ?? point.latitude),
            lng: Number(point.lng ?? point.lon ?? point.longitude),
          }))
          .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));

        return {
          id: area.id || `known_area_${index + 1}`,
          name: area.name,
          polygon,
          priority: Number(area.priority || 90),
        };
      })
      .filter(area => area.name && area.polygon.length >= 3);

    this.knownAreas = [...this.defaultKnownAreas, ...normalized];
    this.reverseGeocodeCache = {};
    this.currentLocationCache = {};
    this._refreshAutoStopNames();
  }

  _pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;
      const intersects = ((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  _knownAreaName(lat, lng) {
    const matches = this.knownAreas
      .filter(area => this._pointInPolygon(lat, lng, area.polygon))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return matches[0]?.name || "";
  }

  async _containingAreaName(lat, lng, signal) {
    const query = `
      [out:json][timeout:8];
      is_in(${lat},${lng})->.areas;
      (
        area.areas["name"]["amenity"~"university|college|school|kindergarten|dormitory",i];
        area.areas["name"]["building"~"dormitory|school|university|college|yes",i];
        area.areas["name"]["landuse"~"education",i];
        area.areas["name"]["office"];
        area.areas["name"]["tourism"~"hostel",i];
      );
      out tags;
    `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      signal,
    });
    const data = await res.json();
    const areas = (data.elements || [])
      .filter(el => el.tags?.name)
      .filter(el => this._areaPriority(el.tags) > 0)
      .sort((a, b) => this._areaPriority(b.tags) - this._areaPriority(a.tags));

    return areas[0]?.tags?.name || "";
  }

  _roadNameFromAddress(address = {}, data = {}) {
    const roadName = address.road ||
      address.pedestrian ||
      address.footway ||
      address.cycleway ||
      address.path;
    if (roadName) return this._formatStopBaseName(roadName);

    return "Trạm GPS";
  }

  // â”€â”€â”€ Æ¯u tiÃªn tÃªn khu vá»±c (giÃ¡o dá»¥c / hÃ nh chÃ­nh / cÃ´ng ty) trÆ°á»›c tÃªn Ä‘Æ°á»ng â”€â”€
  // Tráº£ vá» null náº¿u khÃ´ng tÃ¬m tháº¥y khu vá»±c â†’ caller sáº½ thá»­ zoom=16 rá»“i Overpass
  _isGpsStopName(name) {
    const clean = this._fixText(name || "").trim().toLowerCase();
    return !clean || clean === "trạm gps" || clean === "tram gps";
  }

  _fixText(value) {
    let text = String(value ?? "");
    const score = s => (s.match(/[\u00c2\u00c3\u00c4\u00e1\u00e2\u00f0]/g) || []).length;
    const decodeOnce = s => {
      if (!/[\u00c2\u00c3\u00c4\u00e1\u00e2\u00f0]/.test(s) || typeof TextDecoder === "undefined") return s;
      const bytes = [];
      const cp1252 = {
        0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
        0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
        0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
        0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
        0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
        0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
      };
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code <= 255) bytes.push(code);
        else if (cp1252[code]) bytes.push(cp1252[code]);
        else return s;
      }
      try {
        return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
      } catch (_) {
        return s;
      }
    };

    for (let i = 0; i < 2; i++) {
      const decoded = decodeOnce(text);
      if (decoded === text || score(decoded) > score(text)) break;
      text = decoded;
    }

    return text
      .replaceAll("Tr\u00e1\u00ba\u00a1m", "Trạm")
      .replaceAll("tr\u00e1\u00ba\u00a1m", "trạm")
      .replaceAll("\u00f0\u0178\u0161\u0152", "&#128652;")
      .replaceAll("\u00f0\u0178\u0161\u2021", "&#128647;")
      .replaceAll("🚌", "&#128652;")
      .replaceAll("🚇", "&#128647;")
      .replaceAll("—", "-")
      .replace(/^(Trạm\s+)+/i, "Trạm ");
  }

  _smartNameFromAddress(address = {}, data = {}) {
    const category = data.category || "";
    const poiType  = data.type     || "";
    const poiName  = data.name     || "";
    const building      = address.building      || "";
    const neighbourhood = address.neighbourhood || address.quarter || address.suburb || "";
    const KW = /ktx|ký\s*túc|ky\s*tuc|dorm|\bktx\b|đại\s*học|dai\s*hoc|trường|truong|bệnh\s*viện|benh\s*vien|công\s*ty|cong\s*ty|văn\s*phòng|van\s*phong|trụ\s*sở|tru\s*so|ủy\s*ban|uy\s*ban/i;

    // 1. LUÃ”N check address hierarchy â€” ká»ƒ cáº£ khi category=highway
    //    (GPS trÃªn Ä‘Æ°á»ng TRONG campus váº«n cÃ³ address.university)
    const eduName = address.university || address.college ||
                    address.school     || address.kindergarten;
    if (eduName) return this._formatStopBaseName(eduName);

    // 2. Neighbourhood / quarter / suburb chá»©a tá»« khÃ³a (ráº¥t phá»• biáº¿n á»Ÿ Viá»‡t Nam)
    //    VÃ­ dá»¥: neighbourhood = "KTX Khu A", quarter = "KÃ½ tÃºc xÃ¡"
    if (neighbourhood && KW.test(neighbourhood)) return this._formatStopBaseName(neighbourhood);

    // 3. TÃªn tÃ²a nhÃ  trong address chá»©a tá»« khÃ³a
    if (building && KW.test(building)) return this._formatStopBaseName(building);

    // 4. Náº¿u lÃ  highway/place vÃ  khÃ´ng cÃ³ context khu vá»±c â†’ null Ä‘á»ƒ thá»­ zoom=16
    if (category === "highway" || category === "place") return null;

    // 5. TÃªn POI Nominatim khi category/type lÃ  khu vá»±c cá»¥ thá»ƒ
    const AREA_CATEGORIES = new Set(["amenity", "office", "building", "landuse", "leisure"]);
    const AREA_TYPES = new Set([
      "university", "college", "school", "kindergarten",
      "dormitory", "hostel", "hospital",
      "government", "public_building", "office", "company",
      "commercial", "retail", "industrial",
    ]);
    if (poiName && AREA_CATEGORIES.has(category) && AREA_TYPES.has(poiType)) {
      return this._formatStopBaseName(poiName);
    }

    // 6. TÃªn POI báº¥t ká»³ chá»©a tá»« khÃ³a khu vá»±c
    if (poiName && KW.test(poiName)) return this._formatStopBaseName(poiName);

    // 7. TÃ²a nhÃ  cÃ³ tÃªn cá»¥ thá»ƒ (khÃ´ng pháº£i "yes")
    if (building && building !== "yes" && building.length > 3) {
      return this._formatStopBaseName(building);
    }

    // KhÃ´ng tÃ¬m tháº¥y khu vá»±c â†’ null Ä‘á»ƒ caller thá»­ zoom=16 rá»“i Overpass
    return null;
  }

  _renumberAutoStops(vehicleId) {
    const stops = this.autoStops[vehicleId] || [];
    const counts = {};

    stops.forEach(stop => {
      const base = this._formatStopBaseName(stop.baseName || "Trạm GPS");
      counts[base] = (counts[base] || 0) + 1;
      stop.name = counts[base] === 1 ? base : `${base} ${counts[base]}`;

      const marker = this.autoStopMarkers[vehicleId]?.[stop.id];
      if (marker) {
        marker.bindTooltip(stop.name, {
          className: "custom-tooltip",
          direction: "top",
          offset: [0, -8],
        });
      }
    });
    this._notifyAutoStopsUpdated();
  }

  _notifyAutoStopsUpdated() {
    const stops = Object.entries(this.autoStops).flatMap(([vehicleId, stops]) =>
      (stops || []).map(stop => ({
        ...stop,
        vehicleId,
        routeName: "Tuyen GPS thuc te",
        routeColor: "#00d4ff",
        isAutoStop: true,
      }))
    );

    document.dispatchEvent(new CustomEvent("auto-stops-updated", { detail: stops }));
  }

  _refreshAutoStopNames() {
    Object.entries(this.autoStops || {}).forEach(([vehicleId, stops]) => {
      (stops || []).forEach(stop => {
        stop.baseName = "Trạm GPS";
        stop.name = "Trạm GPS";
        this._resolveStopRoadName(vehicleId, stop);
      });
      this._renumberAutoStops(vehicleId);
    });
  }

  _renderAutoStopMarker(vehicleId, stop, color) {
    if (!this.autoStopMarkers[vehicleId]) this.autoStopMarkers[vehicleId] = {};
    if (this.autoStopMarkers[vehicleId][stop.id]) return;

    const marker = L.marker([stop.lat, stop.lng], {
      icon: this._autoStopIcon(color),
      zIndexOffset: -80,
    }).addTo(this.map);

    marker.bindTooltip(stop.name, {
      className: "custom-tooltip",
      direction: "top",
      offset: [0, -8],
    });

    this.autoStopMarkers[vehicleId][stop.id] = marker;
  }

  loadPersistedHistory(historyByVehicle = {}) {
    Object.entries(historyByVehicle || {}).forEach(([vehicleId, points]) => {
      const seen = new Set();
      const normalized = (points || [])
        .map((p, index) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
          createdAt: Number(p.createdAt || index + 1),
        }))
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .sort((a, b) => a.createdAt - b.createdAt)
        .filter(p => {
          const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(p => [p.lat, p.lng]);
      if (!normalized.length) return;

      this.pathHistory[vehicleId] = normalized;
      const color = this.markers[vehicleId]?._vehicleData?.routeColor || "#00d4ff";

      if (this.trailSegmentLayers[vehicleId]) {
        this.trailSegmentLayers[vehicleId].forEach(layer => {
          if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
        });
      }

      const segments = [];
      normalized.forEach(point => {
        const current = segments[segments.length - 1];
        if (!current) {
          segments.push([point]);
        } else {
          current.push(point);
        }
      });

      this.trailSegmentLayers[vehicleId] = segments
        .filter(segment => segment.length >= 2)
        .map(segment => L.polyline(segment, {
          color,
          weight: 6,
          opacity: 0.95,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(this.map));

      this.trailLayers[vehicleId] = this.trailSegmentLayers[vehicleId][0] || null;
    });
  }

  loadPersistedAutoStops(stopsByVehicle = {}) {
    Object.entries(stopsByVehicle || {}).forEach(([vehicleId, stops]) => {
      this.autoStops[vehicleId] = (stops || []).map((stop, index) => ({
        id: stop.id || `${vehicleId}_auto_stop_${index + 1}`,
        lat: Number(stop.lat),
        lng: Number(stop.lng),
        baseName: stop.baseName || stop.name || "Trạm GPS",
        name: stop.name || stop.baseName || "Trạm GPS",
        createdAt: Number(stop.createdAt || Date.now()),
      })).filter(stop => Number.isFinite(stop.lat) && Number.isFinite(stop.lng));

      const color = this.markers[vehicleId]?._vehicleData?.routeColor || "#00d4ff";
      this.autoStops[vehicleId].forEach(stop => this._renderAutoStopMarker(vehicleId, stop, color));
      this._renumberAutoStops(vehicleId);
    });
  }

  async _resolveStopRoadName(vehicleId, stop) {
    const key = `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
    if (this.reverseGeocodeCache[key]) {
      stop.baseName = this.reverseGeocodeCache[key];
      this._renumberAutoStops(vehicleId);
      return;
    }

    if (this.pendingGeocodes.has(key)) return;
    this.pendingGeocodes.add(key);

    // Sau khi resolve xong â†’ cáº­p nháº­t cáº£ popup láº«n sidebar vehicle list
    const updateVehiclePopup = () => {
      const marker = this.markers[vehicleId];
      if (marker?._vehicleData) {
        const stopInfo = this._getAutoStopInfo(vehicleId, marker._vehicleData, false);
        Object.assign(marker._vehicleData, stopInfo);
        if (marker.isPopupOpen()) marker.setPopupContent(this.buildPopup(marker._vehicleData));
      }
      // Re-dispatch Ä‘á»ƒ sidebar cáº­p nháº­t "Äiá»ƒm hiá»‡n táº¡i" ngay láº­p tá»©c
      const allData = this.getAllData();
      if (allData.length > 0) {
        document.dispatchEvent(new CustomEvent("vehicles-updated", { detail: allData }));
      }
    };

    try {
      // â”€â”€ Phase 1: knownAreas polygon (nhanh, local) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const knownAreaName = this._knownAreaName(stop.lat, stop.lng);
      if (knownAreaName) {
        const baseName = this._formatStopBaseName(knownAreaName);
        this.reverseGeocodeCache[key] = baseName;
        stop.baseName = baseName;
        this._renumberAutoStops(vehicleId);
        if (this.persistAutoStop) this.persistAutoStop(vehicleId, stop);
        updateVehiclePopup();
        return;
      }

      // â”€â”€ Phase 2: Nominatim zoom=18 (building / road level) â”€â”€â”€â”€â”€â”€
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const url18 = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&namedetails=1&zoom=18&lat=${stop.lat}&lon=${stop.lng}`;
      const res18 = await fetch(url18, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data18 = await res18.json();
      console.log("[StopName] zoom=18 â†’", data18.category, data18.type, data18.name, data18.address);

      let stopName = null;

      // â”€â”€ Phase 2b: Nominatim zoom=16 (campus / area level) â”€â”€â”€â”€â”€â”€â”€â”€
      // zoom=18 thÆ°á»ng tráº£ vá» building/road; zoom=16 tráº£ vá» khu vá»±c rá»™ng hÆ¡n
      // (university campus, bá»‡nh viá»‡n, KTX complex...)
      if (stopName === null) {
        try {
          const ctrl16 = new AbortController();
          setTimeout(() => ctrl16.abort(), 8000);
          const url16 = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&namedetails=1&zoom=16&lat=${stop.lat}&lon=${stop.lng}`;
          const res16 = await fetch(url16, { signal: ctrl16.signal });
          const data16 = await res16.json();
          console.log("[StopName] zoom=16 â†’", data16.category, data16.type, data16.name, data16.address);
          stopName = null;
          // Náº¿u zoom=16 tráº£ vá» tÃªn POI cÃ³ Ã½ nghÄ©a (khÃ´ng pháº£i road/null)
          const allowedAreaText = `${data16.name || ""} ${data16.category || ""} ${data16.type || ""}`.toLowerCase();
          const isAllowedArea = /ktx|ký túc|ky tuc|dorm|dormitory|hostel|university|college|school|kindergarten|education|đại học|dai hoc|trường|truong|company|office|công ty|cong ty|government|administrative|public/.test(allowedAreaText);
          if (stopName === null && data16.category !== "highway" && isAllowedArea) {
            const name16 = data16.name || "";
            if (name16 && name16.length > 2) stopName = this._formatStopBaseName(name16);
          }
        } catch (_) { /* ignore */ }
      }

      // â”€â”€ Phase 3: Overpass is_in (polygon containment check) â”€â”€â”€â”€â”€â”€
      // Kiá»ƒm tra GPS cÃ³ náº±m trong polygon KTX/trÆ°á»ng/cÃ´ng ty khÃ´ng
      if (stopName === null) {
        try {
          const ctrl2 = new AbortController();
          setTimeout(() => ctrl2.abort(), 8000);
          const areaName = await this._containingAreaName(stop.lat, stop.lng, ctrl2.signal);
          console.log("[StopName] Overpass is_in â†’", areaName);
          stopName = areaName
            ? this._formatStopBaseName(areaName)
            : this._roadNameFromAddress(data18.address || {}, data18);
        } catch (_) {
          stopName = this._roadNameFromAddress(data18.address || {}, data18);
        }
      }

      this.reverseGeocodeCache[key] = stopName;
      stop.baseName = stopName;
      this._renumberAutoStops(vehicleId);
      if (this.persistAutoStop) this.persistAutoStop(vehicleId, stop);
      updateVehiclePopup();
    } catch (err) {
      stop.baseName = "Trạm GPS";
      this._renumberAutoStops(vehicleId);
      updateVehiclePopup();
    } finally {
      this.pendingGeocodes.delete(key);
    }
  }

  _ensureAutoStops(vehicle, lat, lng) {
    const vehicleId = vehicle.id;
    const color = vehicle.routeColor || "#00d4ff";
    if (!this.autoStops[vehicleId]) this.autoStops[vehicleId] = [];

    const stops = this.autoStops[vehicleId];
    const lastStop = stops[stops.length - 1];
    const shouldCreate = !lastStop ||
      this.map.distance(L.latLng(lastStop.lat, lastStop.lng), L.latLng(lat, lng)) >= 2000;

    if (!shouldCreate) return;

    const stop = {
      id: `${vehicleId}_auto_stop_${stops.length + 1}`,
      lat,
      lng,
      baseName: "Trạm GPS",
      name: "Trạm GPS",
    };

    stops.push(stop);
    this._renderAutoStopMarker(vehicleId, stop, color);
    this._renumberAutoStops(vehicleId);
    if (this.persistAutoStop) this.persistAutoStop(vehicleId, stop);
    this._resolveStopRoadName(vehicleId, stop);
  }

  _getAutoStopInfo(vehicleId, vehicle, preferExisting = true) {
    const stops = this.autoStops[vehicleId] || [];
    if (!stops.length) return {};

    const latlng = L.latLng(Number(vehicle.lat), Number(vehicle.lng));
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    stops.forEach((stop, index) => {
      const distance = this.map.distance(latlng, L.latLng(stop.lat, stop.lng));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const current = stops[nearestIndex];
    const next = stops[nearestIndex + 1] || null;
    const keepExisting = false;

    return {
      currentStop: keepExisting && vehicle.currentStop ? vehicle.currentStop : current.name,
      nextStop: keepExisting && vehicle.nextStop ? vehicle.nextStop : (next ? next.name : "Đang cập nhật"),
      _autoStopGenerated: !keepExisting,
    };
  }

  _refreshVehicleCurrentLocation(vehicleId, vehicle) {
    const lat = Number(vehicle.lat);
    const lng = Number(vehicle.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const knownAreaName = this._knownAreaName(lat, lng);
    if (knownAreaName) {
      vehicle.currentStop = this._formatStopBaseName(knownAreaName);
      this.currentLocationCache[key] = vehicle.currentStop;
      return;
    }

    if (this.currentLocationCache[key] && !this._isGpsStopName(this.currentLocationCache[key])) {
      vehicle.currentStop = this.currentLocationCache[key];
      return;
    }

    if (this.pendingCurrentGeocodes.has(key)) return;
    this.pendingCurrentGeocodes.add(key);

    const previousName = vehicle.currentStop;
    const updateVehicle = (name) => {
      if (this._isGpsStopName(name) && !this._isGpsStopName(previousName)) return;
      const marker = this.markers[vehicleId];
      if (marker?._vehicleData) {
        marker._vehicleData.currentStop = name;
        if (marker.isPopupOpen()) marker.setPopupContent(this.buildPopup(marker._vehicleData));
      }
      const allData = this.getAllData();
      if (allData.length > 0) {
        document.dispatchEvent(new CustomEvent("vehicles-updated", { detail: allData }));
      }
    };

    (async () => {
      try {
        let stopName = "";

        try {
          const ctrlArea = new AbortController();
          setTimeout(() => ctrlArea.abort(), 8000);
          const areaName = await this._containingAreaName(lat, lng, ctrlArea.signal);
          if (areaName) stopName = this._formatStopBaseName(areaName);
        } catch (_) { /* ignore */ }

        if (!stopName) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 9000);
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&namedetails=1&zoom=18&lat=${lat}&lon=${lng}`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          const data = await res.json();
          stopName = this._roadNameFromAddress(data.address || {}, data);
        }

        if (!this._isGpsStopName(stopName)) {
          this.currentLocationCache[key] = stopName;
          updateVehicle(stopName);
        } else if (this._isGpsStopName(previousName)) {
          updateVehicle(stopName);
        }
      } catch (_) {
        this.currentLocationCache[key] = "Trạm GPS";
        updateVehicle("Trạm GPS");
      } finally {
        this.pendingCurrentGeocodes.delete(key);
      }
    })();
  }

  _updateLiveTrail(vehicle) {
    const lat = Number(vehicle.lat);
    const lng = Number(vehicle.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const id = vehicle.id;
    const firebasePath = this._normalizePath(vehicle.path || vehicle.trail || vehicle.history);
    if (firebasePath.length) {
      this.pathHistory[id] = firebasePath;
    } else {
      if (!this.pathHistory[id]) this.pathHistory[id] = [];
      const points = this.pathHistory[id];
      const last = points[points.length - 1];
      const hasCurrentPoint = points.some(([pLat, pLng]) =>
        Math.abs(pLat - lat) < 0.000001 && Math.abs(pLng - lng) < 0.000001
      );

      if (!hasCurrentPoint && (!last || this.map.distance(L.latLng(last[0], last[1]), L.latLng(lat, lng)) >= 5)) {
        points.push([lat, lng]);
        if (this.persistHistoryPoint) this.persistHistoryPoint(vehicle);
      }

      while (points.length > 5000) points.shift();
    }

    this._ensureAutoStops(vehicle, lat, lng);

    const points = this.pathHistory[id];
    if (!points || points.length < 2) return;

    const color = vehicle.routeColor || "#00d4ff";
    if (this.trailSegmentLayers[id]?.length) {
      this.trailSegmentLayers[id].forEach(layer => {
        if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
      });
      delete this.trailSegmentLayers[id];
      this.trailLayers[id] = null;
    }

    if (!this.trailLayers[id]) {
      this.trailLayers[id] = L.polyline(points, {
        color,
        weight: 6,
        opacity: 0.95,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(this.map);
    } else {
      this.trailLayers[id].setLatLngs(points);
      this.trailLayers[id].setStyle({ color });
      if (!this.map.hasLayer(this.trailLayers[id])) this.trailLayers[id].addTo(this.map);
    }
  }

  // â”€â”€â”€ Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  createIcon(vehicle) {
    const isBus = vehicle.type === "bus";
    const isDelayed = vehicle.status === "delayed";
    const isFire = this.isFireAlert(vehicle);
    const color = isFire ? "#ef4444" : (isDelayed ? "#ef4444" : (isBus ? "#00d4ff" : "#a855f7"));
    const emoji = isBus ? "&#128652;" : "&#128647;";
    const size = isBus ? 36 : 42;

    return L.divIcon({
      className: "",
      html: `
        <div class="vehicle-marker ${vehicle.type} ${isDelayed ? "delayed" : ""} ${isFire ? "fire-alert" : ""}"
             style="--route-color: ${color}; width:${size}px; height:${size}px;">
          <span class="v-emoji">${emoji}</span>
          <span class="v-pulse" style="background:${color}"></span>
        </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  // â”€â”€â”€ Popup HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  buildPopup(v) {
    const pct = Math.round((v.passengers / v.capacity) * 100);
    const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e";
    const isFire = this.isFireAlert(v);
    const statusClass = v.status === "delayed" ? "status-delayed" : "status-ok";
    const statusLabel = v.status === "delayed" ? "Trễ giờ" : "Đúng giờ";
    const typeLabel = v.type === "bus" ? "&#128652; Xe Buýt" : "&#128647; Metro";
    const speedUnit = v.type === "metro" ? "km/h (tàu)" : "km/h";

    return this._fixText(`
      <div class="vehicle-popup">
        <div class="vp-header" style="border-color: ${v.routeColor || "#00d4ff"}">
          <span class="vp-type">${typeLabel}</span>
          <span class="vp-name">${v.name || v.id}</span>
          <span class="vp-status ${isFire ? "status-fire" : statusClass}">${isFire ? "CẢNH BÁO CHÁY" : statusLabel}</span>
        </div>
        <div class="vp-body">
          ${isFire ? `
          <div class="fire-alert-box">
            Phát hiện khói/khí MQ2 - buzzer đang báo động. Khu vực xe trên bản đồ đang nhấp nháy đỏ.
          </div>` : ""}
          <div class="vp-row">
            <span class="vp-label">Tuyến</span>
            <span class="vp-val" style="color:${v.routeColor || "#00d4ff"}">${v.route || "-"}</span>
          </div>
          <div class="vp-row">
            <span class="vp-label">Điểm hiện tại</span>
            <span class="vp-val">${v.currentStop || "Đang di chuyển"}</span>
          </div>
          <div class="vp-row">
            <span class="vp-label">Điểm tiếp theo</span>
            <span class="vp-val">${v.nextStop || "-"}</span>
          </div>
          <div class="vp-row">
            <span class="vp-label">Tốc độ</span>
            <span class="vp-val">${Math.round(v.speed || 0)} ${speedUnit}</span>
          </div>
          <div class="vp-row capacity-row">
            <span class="vp-label">Hành khách</span>
            <span class="vp-val">${v.passengers || 0}/${v.capacity || "-"}</span>
          </div>
          <div class="vp-bar-wrap">
            <div class="vp-bar" style="width:${pct}%; background:${barColor}"></div>
          </div>
          <div class="vp-footer">
            <span>Cập nhật: ${new Date(v.lastUpdated || Date.now()).toLocaleTimeString("vi-VN")}</span>
          </div>
        </div>
      </div>`);
  }

  // Update Vehicles

  update(vehicles) {
    const seen = new Set();

    vehicles.forEach(v => {
      if (!v.lat || !v.lng) return;
      seen.add(v.id);

      const visible = this.filterType === "all" || this.filterType === v.type;
      this._updateLiveTrail(v);
      Object.assign(v, this._getAutoStopInfo(v.id, v));

      if (this.markers[v.id]) {
        // Animate movement
        this._animateMarker(v.id, v.lat, v.lng);
        this.markers[v.id].setIcon(this.createIcon(v));
        this.markers[v.id]._vehicleData = v;

        // Update popup if open
        if (this.markers[v.id].isPopupOpen()) {
          this.markers[v.id].setPopupContent(this.buildPopup(v));
        }

        if (visible) this.markers[v.id].addTo(this.map);
        else if (this.map.hasLayer(this.markers[v.id])) this.map.removeLayer(this.markers[v.id]);

      } else {
        // Create new marker
        const marker = L.marker([v.lat, v.lng], { icon: this.createIcon(v) });
        marker._vehicleData = v;
        marker.bindPopup(this.buildPopup(v), {
          maxWidth: 300,
          className: "custom-popup",
        });
        marker.on("click", () => {
          this.selectedId = v.id;
          if (this.onSelectCallback) this.onSelectCallback(v);
        });

        if (visible) marker.addTo(this.map);
        this.markers[v.id] = marker;
      }

      this.prevPositions[v.id] = { lat: v.lat, lng: v.lng };
    });

    // Remove stale markers
    Object.keys(this.markers).forEach(id => {
      if (!seen.has(id)) {
        if (this.map.hasLayer(this.markers[id])) this.map.removeLayer(this.markers[id]);
        delete this.markers[id];
        delete this.prevPositions[id];
        if (this.trailLayers[id]) {
          if (this.map.hasLayer(this.trailLayers[id])) this.map.removeLayer(this.trailLayers[id]);
          delete this.trailLayers[id];
        }
        if (this.trailSegmentLayers[id]) {
          this.trailSegmentLayers[id].forEach(layer => {
            if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
          });
          delete this.trailSegmentLayers[id];
        }
        if (this.autoStopMarkers[id]) {
          Object.values(this.autoStopMarkers[id]).forEach(marker => {
            if (this.map.hasLayer(marker)) this.map.removeLayer(marker);
          });
          delete this.autoStopMarkers[id];
        }
        delete this.pathHistory[id];
        delete this.autoStops[id];
      }
    });

    // Notify list panel
    document.dispatchEvent(new CustomEvent("vehicles-updated", { detail: vehicles }));
  }

  _animateMarker(id, targetLat, targetLng) {
    const marker = this.markers[id];
    if (!marker) return;
    const current = marker.getLatLng();
    const frames = 20;
    let frame = 0;
    const dLat = (targetLat - current.lat) / frames;
    const dLng = (targetLng - current.lng) / frames;

    const step = () => {
      if (frame >= frames) return;
      marker.setLatLng([current.lat + dLat * frame, current.lng + dLng * frame]);
      frame++;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  setFilter(type) {
    this.filterType = type;
    Object.values(this.markers).forEach(m => {
      const v = m._vehicleData;
      if (!v) return;
      const visible = type === "all" || type === v.type;
      if (visible) m.addTo(this.map);
      else if (this.map.hasLayer(m)) this.map.removeLayer(m);

      const trail = this.trailLayers[v.id];
      if (trail) {
        if (visible) trail.addTo(this.map);
        else if (this.map.hasLayer(trail)) this.map.removeLayer(trail);
      }

      Object.values(this.autoStopMarkers[v.id] || {}).forEach(marker => {
        if (visible) marker.addTo(this.map);
        else if (this.map.hasLayer(marker)) this.map.removeLayer(marker);
      });
    });
  }

  focusVehicle(id) {
    const m = this.markers[id];
    if (!m) return;
    this.map.flyTo(m.getLatLng(), 16, { animate: true, duration: 1 });
    m.openPopup();
  }

  getAllData() {
    return Object.values(this.markers).map(m => m._vehicleData).filter(Boolean);
  }
}

window.VehicleManager = VehicleManager;
