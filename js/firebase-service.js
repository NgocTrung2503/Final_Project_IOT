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
          passengers: v.passengers != null ? Number(v.passengers) : 0,
          capacity:   v.capacity  || 80,
          speed:      v.speed     || 0,
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

  // ─── Dọn dẹp listener ──────────────────────────────────────
  offAll() {
    Object.values(this.listeners).forEach(ref => ref.off());
    this.listeners = {};
  }
}

window.FirebaseService = FirebaseService;
