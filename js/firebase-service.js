// ============================================================
//  FIREBASE SERVICE LAYER
//  Kết nối và lắng nghe dữ liệu từ Firebase Realtime Database
//  Xử lý an toàn khi dữ liệu rỗng hoặc chưa có
// ============================================================

class FirebaseService {
  constructor() {
    this.db = null;
    this.connected = false;
    this.listeners = {};
    this.gpsRepairing = new Set();
    this.init();
  }

  _toBool(value) {
    return value === true || value === 1 || value === "1" || value === "true" || value === "alert";
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
      .replaceAll("ThÃ¡nh GiÃ³ng", "Thánh Gióng")
      .replaceAll("Th�nh Gi�ng", "Thánh Gióng")
      .replaceAll("Th�nh Giọng", "Thánh Gióng")
      .replaceAll("Ä", "Đ")
      .replaceAll("Ä‘", "đ")
      .replaceAll("â€“", "-")
      .replaceAll("â€”", "-")
      .replace(/^(Trạm\s+)+/i, "Trạm ")
      .trim();
  }

  _isValidGpsPoint(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  }

  _isZeroGpsPoint(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat === 0 && lng === 0;
  }

  _resolveVehicleCoords(v) {
    const lat = Number(v?.lat ?? v?.latitude);
    const lng = Number(v?.lng ?? v?.lon ?? v?.longitude);
    if (this._isValidGpsPoint(lat, lng)) {
      return { lat, lng, gpsValid: true };
    }

    const fallbackLat = Number(v?.lastValidLat ?? v?.prevLat);
    const fallbackLng = Number(v?.lastValidLng ?? v?.prevLng);
    if (this._isValidGpsPoint(fallbackLat, fallbackLng)) {
      return { lat: fallbackLat, lng: fallbackLng, gpsValid: false };
    }

    return { lat, lng, gpsValid: false };
  }

  _normalizeVehicle(id, v) {
    const { lat, lng, gpsValid } = this._resolveVehicleCoords(v);
    if (!this._isValidGpsPoint(lat, lng)) return null;

    return {
      id,
      ...v,
      lat,
      lng,
      gpsValid,
      name:       v.name      || `Xe ${id}`,
      type:       v.type      || "bus",
      status:     v.status    || "on_time",
      irIn:       Number(v.irIn ?? v.passengerIn ?? v.inCount ?? 0),
      irOut:      Number(v.irOut ?? v.passengerOut ?? v.outCount ?? 0),
      passengers: v.passengers != null ? Number(v.passengers) : Math.max(0, Number(v.irIn ?? v.passengerIn ?? v.inCount ?? 0) - Number(v.irOut ?? v.passengerOut ?? v.outCount ?? 0)),
      capacity:   v.capacity  || 80,
      speed:      (v.speed && v.speed < 5) ? 0 : (v.speed || 0),
      fireAlert:  this._toBool(v.fireAlert ?? v.fire ?? v.mq2Alert ?? v.smokeAlert ?? v.gasAlert ?? v.mq2Status),
    };
  }

  _hasInvalidRealtimeGps(v) {
    const lat = Number(v?.lat ?? v?.latitude);
    const lng = Number(v?.lng ?? v?.lon ?? v?.longitude);
    return !this._isValidGpsPoint(lat, lng);
  }

  _historyEntries(points) {
    if (!points) return [];
    return Array.isArray(points)
      ? points.map((p, index) => [p.id || String(index + 1), p])
      : Object.entries(points || {});
  }

  async _latestValidHistoryPoint(vehicleId) {
    if (!this.db || !vehicleId) return null;
    const snap = await this.db.ref(`vehicleHistory/${vehicleId}`).once("value");
    const points = this._historyEntries(snap.val())
      .map(([id, p], index) => {
        const createdAt = Number(p?.createdAt ?? p?.timestamp ?? id ?? index + 1);
        return {
          id,
          lat: Number(p?.lat ?? p?.latitude),
          lng: Number(p?.lng ?? p?.lon ?? p?.longitude),
          createdAt: Number.isFinite(createdAt) ? createdAt : index + 1,
          point: p,
        };
      })
      .filter(p => this._isValidGpsPoint(p.lat, p.lng))
      .sort((a, b) => b.createdAt - a.createdAt);

    return points[0] || null;
  }

  async _removeInvalidHistoryPoint(vehicleId, v) {
    if (!this.db || !vehicleId) return;
    const key = v?.createdAt ?? v?.lastUpdated ?? v?.timestamp;
    if (!key) return;

    const ref = this.db.ref(`vehicleHistory/${vehicleId}/${key}`);
    const snap = await ref.once("value");
    const point = snap.val();
    if (!point) return;

    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    if (!this._isValidGpsPoint(lat, lng)) {
      await ref.remove();
    }
  }

  async _repairRealtimeGpsPoint(vehicleId, v) {
    if (!this.db || !vehicleId || !this._hasInvalidRealtimeGps(v)) return;
    if (this.gpsRepairing.has(vehicleId)) return;
    this.gpsRepairing.add(vehicleId);

    try {
      await this._removeInvalidHistoryPoint(vehicleId, v);

      const fallbackLat = Number(v?.lastValidLat ?? v?.prevLat);
      const fallbackLng = Number(v?.lastValidLng ?? v?.prevLng);
      let nearest = this._isValidGpsPoint(fallbackLat, fallbackLng)
        ? { lat: fallbackLat, lng: fallbackLng, point: v }
        : await this._latestValidHistoryPoint(vehicleId);

      if (!nearest || !this._isValidGpsPoint(nearest.lat, nearest.lng)) {
        await this.db.ref(`vehicles/${vehicleId}`).update({
          lat: null,
          lng: null,
          latitude: null,
          longitude: null,
          lon: null,
          gpsValid: false,
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        });
        return;
      }

      await this.db.ref(`vehicles/${vehicleId}`).update({
        lat: nearest.lat,
        lng: nearest.lng,
        latitude: null,
        longitude: null,
        lon: null,
        lastValidLat: nearest.lat,
        lastValidLng: nearest.lng,
        gpsValid: false,
        speed: 0,
        currentStop: nearest.point?.currentStop || v.currentStop || "",
        nextStop: nearest.point?.nextStop || v.nextStop || "",
        routeId: nearest.point?.routeId || v.routeId || "",
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.warn("GPS repair failed:", vehicleId, err);
    } finally {
      this.gpsRepairing.delete(vehicleId);
    }
  }

  _normalizeStops(stops) {
    if (!stops) return [];
    const list = Array.isArray(stops) ? stops : Object.values(stops);
    return list
      .map((s, index) => ({
        id: s.id || `stop_${index + 1}`,
        name: this._fixText(s.name || `Stop ${index + 1}`),
        lat: Number(s.lat ?? s.latitude),
        lng: Number(s.lng ?? s.lon ?? s.longitude),
      }))
      .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  }

  _normalizeSchedule(schedule) {
    if (!schedule) return [];
    return Array.isArray(schedule) ? schedule : Object.values(schedule);
  }

  _normalizeRoutePath(path) {
    if (!path) return [];
    const list = Array.isArray(path) ? path : Object.values(path);
    return list
      .map(p => Array.isArray(p)
        ? { lat: Number(p[0]), lng: Number(p[1]) }
        : {
            lat: Number(p.lat ?? p.latitude),
            lng: Number(p.lng ?? p.lon ?? p.longitude),
          }
      )
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  _normalizeKnownAreas(data) {
    if (!data) return [];
    const list = Array.isArray(data) ? data : Object.entries(data).map(([id, area]) => ({ id, ...area }));
    return list
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
          name: this._fixText(area.name),
          polygon,
          priority: Number(area.priority || 90),
        };
      })
      .filter(area => area.name && area.polygon.length >= 3);
  }

  _normalizeHistory(data) {
    if (!data) return {};
    return Object.fromEntries(Object.entries(data).map(([vehicleId, points]) => {
      const entries = Array.isArray(points)
        ? points.map((p, index) => [p.id || String(index + 1), p])
        : Object.entries(points || {});

      const list = entries
        .map(([id, p], index) => {
          const createdAt = Number(p.createdAt ?? p.timestamp ?? id ?? index + 1);
          return {
            id: p.id || id || `point_${index + 1}`,
            name: this._fixText(p.name || vehicleId),
            routeId: p.routeId || "",
            lat: Number(p.lat ?? p.latitude),
            lng: Number(p.lng ?? p.lon ?? p.longitude),
            speed: Number(p.speed || 0),
            irIn: Number(p.irIn || 0),
            irOut: Number(p.irOut || 0),
            passengers: Number(p.passengers || 0),
            capacity: Number(p.capacity || 80),
            currentStop: this._fixText(p.currentStop || ""),
            nextStop: this._fixText(p.nextStop || ""),
            createdAt: Number.isFinite(createdAt) ? createdAt : index + 1,
          };
        })
        .filter(p => this._isValidGpsPoint(p.lat, p.lng));
      return [vehicleId, list];
    }));
  }

  _normalizeAutoStopsData(data) {
    if (!data) return {};
    return Object.fromEntries(Object.entries(data).map(([vehicleId, stops]) => {
      const list = (Array.isArray(stops) ? stops : Object.entries(stops || {}).map(([id, s]) => ({ id, ...s })))
        .map((s, index) => ({
          id: s.id || `stop_${index + 1}`,
          name: this._fixText(s.name || "Trạm GPS"),
          baseName: this._fixText(s.baseName || s.name || "Trạm GPS"),
          lat: Number(s.lat ?? s.latitude),
          lng: Number(s.lng ?? s.lon ?? s.longitude),
          createdAt: Number(s.createdAt || 0),
        }))
        .filter(s => this._isValidGpsPoint(s.lat, s.lng))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return [vehicleId, list];
    }));
  }

  init() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
      }
      this.db = firebase.database();
      this._monitorConnection();
      console.log("✅ Firebase initialized");
    } catch (e) {
      console.warn("⚠️ Firebase init failed:", e.message);
      this.connected = false;
      document.dispatchEvent(new CustomEvent("firebase-connection", { detail: false }));
    }
  }

  _monitorConnection() {
    if (!this.db) return;
    const connRef = this.db.ref(".info/connected");
    connRef.on("value", (snap) => {
      this.connected = snap.val() === true;
      document.dispatchEvent(new CustomEvent("firebase-connection", { detail: this.connected }));
    });
  }

  // ─── Lắng nghe dữ liệu xe (xử lý an toàn khi rỗng) ────────
  onVehiclesUpdate(callback) {
    if (!this.db) return;
    const ref = this.db.ref("vehicles");
    ref.on("value", (snap) => {
      const data = snap.val();
      if (data && typeof data === "object") {
        // Có dữ liệu → chuyển object thành mảng
        const vehicles = Object.entries(data)
          .map(([id, v]) => {
            if (this._hasInvalidRealtimeGps(v)) {
              this._repairRealtimeGpsPoint(id, v);
            }
            return this._normalizeVehicle(id, v);
          })
          .filter(Boolean);
          // Đảm bảo có các field tối thiểu

        callback(vehicles);
      } else {
        // Rỗng → trả về mảng rỗng, UI sẽ hiện "Chưa có dữ liệu"
        callback([]);
        console.log("ℹ️ Firebase /vehicles trống — đang chờ dữ liệu từ thiết bị...");
      }
    });
    this.listeners["vehicles"] = ref;
  }

  // ─── Cập nhật vị trí xe (từ ESP32 push lên) ────────────────
  async updateVehiclePosition(vehicleId, lat, lng, extraData = {}) {
    if (!this.db) return;
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    const updateData = {
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      ...extraData,
    };

    if (this._isValidGpsPoint(nextLat, nextLng)) {
      updateData.lat = nextLat;
      updateData.lng = nextLng;
      updateData.lastValidLat = nextLat;
      updateData.lastValidLng = nextLng;
      updateData.gpsValid = true;
    } else {
      updateData.lat = null;
      updateData.lng = null;
      updateData.latitude = null;
      updateData.longitude = null;
      updateData.lon = null;
      updateData.gpsValid = false;
    }

    await this.db.ref(`vehicles/${vehicleId}`).update(updateData);
  }

  // ─── Thêm / cập nhật xe ────────────────────────────────────
  async setVehicle(vehicleId, data) {
    if (!this.db) return;
    const lat = Number(data?.lat ?? data?.latitude);
    const lng = Number(data?.lng ?? data?.lon ?? data?.longitude);
    const nextData = {
      ...data,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    };

    if (this._isValidGpsPoint(lat, lng)) {
      nextData.lat = lat;
      nextData.lng = lng;
      nextData.lastValidLat = lat;
      nextData.lastValidLng = lng;
      nextData.gpsValid = true;
    } else {
      nextData.lat = null;
      nextData.lng = null;
      nextData.latitude = null;
      nextData.longitude = null;
      nextData.lon = null;
      nextData.gpsValid = false;
    }

    await this.db.ref(`vehicles/${vehicleId}`).update(nextData);
  }

  // ─── Xóa xe ────────────────────────────────────────────────
  async deleteVehicle(vehicleId) {
    if (!this.db) return;
    await this.db.ref(`vehicles/${vehicleId}`).remove();
  }

  // ─── Lắng nghe routes ──────────────────────────────────────
  onRoutesUpdate(callback) {
    if (!this.db) return;
    this.db.ref("routes").on("value", (snap) => {
      const data = snap.val();
      if (data && typeof data === "object") {
        const routes = Object.entries(data).map(([id, r]) => ({
          id: r.id || id,
          name: this._fixText(r.name || `Tuyến ${id}`),
          type: r.type || "bus",
          color: r.color || "#00d4ff",
          stops: this._normalizeStops(r.stops),
          path: this._normalizeRoutePath(r.path || r.trail || r.geometry || r.coords),
          schedule: this._normalizeSchedule(r.schedule),
        }));
        callback(routes);
      }
      else callback([]);
    });
  }

  async setRoute(routeId, data) {
    if (!this.db) return;
    await this.db.ref(`routes/${routeId}`).set(data);
  }

  onKnownAreasUpdate(callback) {
    if (!this.db) return;
    this.db.ref("knownAreas").on("value", (snap) => {
      callback(this._normalizeKnownAreas(snap.val()));
    });
  }

  onVehicleHistoryUpdate(callback) {
    if (!this.db) return;
    const ref = this.db.ref("vehicleHistory");
    ref.on("value", (snap) => callback(this._normalizeHistory(snap.val())));
    this.listeners["vehicleHistory"] = ref;
  }

  // Đọc lịch sử hành khách — KHÔNG filter theo lat/lng
  // Dùng cho biểu đồ và nhật ký IR trên Dashboard
  onPassengerHistoryUpdate(callback) {
    if (!this.db) return;
    const ref = this.db.ref("vehicleHistory");
    ref.on("value", (snap) => {
      const data = snap.val();
      if (!data) { callback({}); return; }
      const result = {};
      Object.entries(data).forEach(([vehicleId, points]) => {
        const entries = Array.isArray(points)
          ? points.map((p, i) => [p.id || String(i), p])
          : Object.entries(points || {});
        result[vehicleId] = entries
          .map(([id, p]) => {
            const createdAt = Number(p.createdAt ?? p.timestamp ?? id);
            return {
              passengers: Number(p.passengers || 0),
              irIn:       Number(p.irIn || 0),
              irOut:      Number(p.irOut || 0),
              capacity:   Number(p.capacity || 80),
              speed:      Number(p.speed || 0),
              lat:        Number(p.lat ?? p.latitude),
              lng:        Number(p.lng ?? p.lon ?? p.longitude),
              routeId:    p.routeId || "",
              name:       this._fixText(p.name || vehicleId),
              createdAt:  Number.isFinite(createdAt) ? createdAt : 0,
            };
          })
          .filter(p => p.createdAt > 0)   // chỉ cần có timestamp hợp lệ
          .filter(p => this._isValidGpsPoint(p.lat, p.lng))
          .sort((a, b) => a.createdAt - b.createdAt);
      });
      callback(result);
    });
    this.listeners["passengerHistory"] = ref;
  }

  onAutoStopsUpdate(callback) {
    if (!this.db) return;
    const ref = this.db.ref("autoStops");
    ref.on("value", (snap) => callback(this._normalizeAutoStopsData(snap.val())));
    this.listeners["autoStops"] = ref;
  }

  async saveVehicleHistoryPoint(vehicle) {
    if (!this.db || !vehicle?.id) return;
    const lat = Number(vehicle.lat);
    const lng = Number(vehicle.lng);
    if (!this._isValidGpsPoint(lat, lng)) return;
    
    // Sửa lỗi ESP32 gửi millis(): Nếu timestamp < năm 2001 (1e12), tự động dùng thời gian thực của web
    let createdAt = Number(vehicle.lastUpdated);
    const maxReasonableTimestamp = Date.now() + 24 * 60 * 60 * 1000;
    if (!createdAt || createdAt < 1e12 || createdAt > maxReasonableTimestamp) {
      createdAt = Date.now();
    }

    const t = new Date(createdAt);
    const dateStr = String(t.getDate()).padStart(2, "0") + "/" + String(t.getMonth() + 1).padStart(2, "0") + "/" + t.getFullYear();
    const timeStr = t.toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit", second:"2-digit"});

    await this.db.ref(`vehicleHistory/${vehicle.id}/${createdAt}`).set({
      vehicleId: vehicle.id,
      name: this._fixText(vehicle.name || vehicle.id),
      type: vehicle.type || "bus",
      routeId: vehicle.routeId || "",
      lat,
      lng,
      speed: Number(vehicle.speed || 0),
      irIn: Number(vehicle.irIn || 0),
      irOut: Number(vehicle.irOut || 0),
      passengers: Number(vehicle.passengers || 0),
      capacity: Number(vehicle.capacity || 80),
      currentStop: this._fixText(vehicle.currentStop || ""),
      nextStop: this._fixText(vehicle.nextStop || ""),
      isVirtual: vehicle.isVirtual === true,
      mq2Alert: vehicle.fireAlert === true || vehicle.mq2Alert === true || vehicle.mq2Alert === "true",
      date: dateStr,
      time: timeStr,
      createdAt,
    });
  }

  async saveAutoStop(vehicleId, stop) {
    if (!this.db || !vehicleId || !stop?.id) return;
    await this.db.ref(`autoStops/${vehicleId}/${stop.id}`).set({
      id: stop.id,
      name: this._fixText(stop.name || "Trạm GPS"),
      baseName: this._fixText(stop.baseName || stop.name || "Trạm GPS"),
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      createdAt: Number(stop.createdAt || Date.now()),
    });
  }

  // ─── Dọn dẹp listener ──────────────────────────────────────
  offAll() {
    Object.values(this.listeners).forEach(ref => ref.off());
    this.listeners = {};
  }
}

window.FirebaseService = FirebaseService;
