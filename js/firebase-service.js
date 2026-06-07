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
    this.init();
  }

  _toBool(value) {
    return value === true || value === 1 || value === "1" || value === "true" || value === "alert";
  }

  _normalizeStops(stops) {
    if (!stops) return [];
    const list = Array.isArray(stops) ? stops : Object.values(stops);
    return list
      .map((s, index) => ({
        id: s.id || `stop_${index + 1}`,
        name: s.name || `Stop ${index + 1}`,
        lat: Number(s.lat ?? s.latitude),
        lng: Number(s.lng ?? s.lon ?? s.longitude),
      }))
      .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  }

  _normalizeSchedule(schedule) {
    if (!schedule) return [];
    return Array.isArray(schedule) ? schedule : Object.values(schedule);
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
          name: area.name,
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
            lat: Number(p.lat ?? p.latitude),
            lng: Number(p.lng ?? p.lon ?? p.longitude),
            speed: Number(p.speed || 0),
            passengers: Number(p.passengers || 0),
            createdAt: Number.isFinite(createdAt) ? createdAt : index + 1,
          };
        })
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .sort((a, b) => a.createdAt - b.createdAt);
      return [vehicleId, list];
    }));
  }

  _normalizeAutoStopsData(data) {
    if (!data) return {};
    return Object.fromEntries(Object.entries(data).map(([vehicleId, stops]) => {
      const list = (Array.isArray(stops) ? stops : Object.entries(stops || {}).map(([id, s]) => ({ id, ...s })))
        .map((s, index) => ({
          id: s.id || `stop_${index + 1}`,
          name: s.name || "Trạm GPS",
          baseName: s.baseName || s.name || "Trạm GPS",
          lat: Number(s.lat ?? s.latitude),
          lng: Number(s.lng ?? s.lon ?? s.longitude),
          createdAt: Number(s.createdAt || 0),
        }))
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
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
        const vehicles = Object.entries(data).map(([id, v]) => ({
          id,
          ...v,
          // Đảm bảo có các field tối thiểu
          name:       v.name      || `Xe ${id}`,
          type:       v.type      || "bus",
          status:     v.status    || "on_time",
          irIn:       Number(v.irIn ?? v.passengerIn ?? v.inCount ?? 0),
          irOut:      Number(v.irOut ?? v.passengerOut ?? v.outCount ?? 0),
          passengers: v.passengers != null ? Number(v.passengers) : Math.max(0, Number(v.irIn ?? v.passengerIn ?? v.inCount ?? 0) - Number(v.irOut ?? v.passengerOut ?? v.outCount ?? 0)),
          capacity:   v.capacity  || 80,
          speed:      (v.speed && v.speed < 5) ? 0 : (v.speed || 0),
          fireAlert:  this._toBool(v.fireAlert ?? v.fire ?? v.mq2Alert ?? v.smokeAlert ?? v.gasAlert ?? v.mq2Status),
        }));

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
    await this.db.ref(`vehicles/${vehicleId}`).update({
      lat, lng,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      ...extraData,
    });
  }

  // ─── Thêm / cập nhật xe ────────────────────────────────────
  async setVehicle(vehicleId, data) {
    if (!this.db) return;
    await this.db.ref(`vehicles/${vehicleId}`).set({
      ...data,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    });
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
          name: r.name || `Tuyen ${id}`,
          type: r.type || "bus",
          color: r.color || "#00d4ff",
          stops: this._normalizeStops(r.stops),
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
              speed:      Number(p.speed || 0),
              lat:        Number(p.lat || 0),
              lng:        Number(p.lng || 0),
              createdAt:  Number.isFinite(createdAt) ? createdAt : 0,
            };
          })
          .filter(p => p.createdAt > 0)   // chỉ cần có timestamp hợp lệ
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
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    
    // Sửa lỗi ESP32 gửi millis(): Nếu timestamp < năm 2001 (1e12), tự động dùng thời gian thực của web
    let createdAt = Number(vehicle.lastUpdated);
    if (!createdAt || createdAt < 1e12) {
      createdAt = Date.now();
    }

    const t = new Date(createdAt);
    const dateStr = String(t.getDate()).padStart(2, "0") + "/" + String(t.getMonth() + 1).padStart(2, "0") + "/" + t.getFullYear();
    const timeStr = t.toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit", second:"2-digit"});

    await this.db.ref(`vehicleHistory/${vehicle.id}/${createdAt}`).set({
      lat,
      lng,
      speed: Number(vehicle.speed || 0),
      passengers: Number(vehicle.passengers || 0),
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
      name: stop.name || "Trạm GPS",
      baseName: stop.baseName || stop.name || "Trạm GPS",
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
