// ============================================================
//  VEHICLE MANAGER
//  Quản lý markers, popups và animation của phương tiện trên bản đồ
// ============================================================

class VehicleManager {
  constructor(map) {
    this.map = map;
    this.markers = {};       // vehicleId → L.marker
    this.prevPositions = {}; // vehicleId → {lat, lng}
    this.selectedId = null;
    this.filterType = "all"; // "all" | "bus" | "metro"
    this.onSelectCallback = null;
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

  // ─── Icons ────────────────────────────────────────────────

  createIcon(vehicle) {
    const isBus = vehicle.type === "bus";
    const isDelayed = vehicle.status === "delayed";
    const isFire = this.isFireAlert(vehicle);
    const color = isFire ? "#ef4444" : (isDelayed ? "#ef4444" : (isBus ? "#00d4ff" : "#a855f7"));
    const emoji = isBus ? "🚌" : "🚇";
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

  // ─── Popup HTML ───────────────────────────────────────────

  buildPopup(v) {
    const pct = Math.round((v.passengers / v.capacity) * 100);
    const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e";
    const isFire = this.isFireAlert(v);
    const statusClass = v.status === "delayed" ? "status-delayed" : "status-ok";
    const statusLabel = v.status === "delayed" ? "⚠️ Trễ giờ" : "✅ Đúng giờ";
    const typeLabel = v.type === "bus" ? "🚌 Xe Buýt" : "🚇 Metro";
    const speedUnit = v.type === "metro" ? "km/h (tàu)" : "km/h";

    return `
      <div class="vehicle-popup">
        <div class="vp-header" style="border-color: ${v.routeColor || "#00d4ff"}">
          <span class="vp-type">${typeLabel}</span>
          <span class="vp-name">${v.name || v.id}</span>
          <span class="vp-status ${isFire ? "status-fire" : statusClass}">${isFire ? "CANH BAO CHAY" : statusLabel}</span>
        </div>
        <div class="vp-body">
          ${isFire ? `
          <div class="fire-alert-box">
            PHAT HIEN KHOI/KHI MQ2 - buzzer dang bao dong. Khu vuc xe tren ban do dang nhap nhay do.
          </div>` : ""}
          <div class="vp-row">
            <span class="vp-label">🛣️ Tuyến</span>
            <span class="vp-val" style="color:${v.routeColor || "#00d4ff"}">${v.route || "—"}</span>
          </div>
          <div class="vp-row">
            <span class="vp-label">📍 Điểm hiện tại</span>
            <span class="vp-val">${v.currentStop || "Đang di chuyển"}</span>
          </div>
          <div class="vp-row">
            <span class="vp-label">⏭️ Điểm tiếp theo</span>
            <span class="vp-val">${v.nextStop || "—"}</span>
          </div>
          <div class="vp-row">
            <span class="vp-label">⚡ Tốc độ</span>
            <span class="vp-val">${Math.round(v.speed || 0)} ${speedUnit}</span>
          </div>
          <div class="vp-row capacity-row">
            <span class="vp-label">👥 Hành khách</span>
            <span class="vp-val">${v.passengers || 0}/${v.capacity || "—"}</span>
          </div>
          <div class="vp-bar-wrap">
            <div class="vp-bar" style="width:${pct}%; background:${barColor}"></div>
          </div>
          <div class="vp-footer">
            <span>🕐 Cập nhật: ${new Date(v.lastUpdated || Date.now()).toLocaleTimeString("vi-VN")}</span>
          </div>
        </div>
      </div>`;
  }

  // ─── Update Vehicles ──────────────────────────────────────

  update(vehicles) {
    const seen = new Set();

    vehicles.forEach(v => {
      if (!v.lat || !v.lng) return;
      seen.add(v.id);

      const visible = this.filterType === "all" || this.filterType === v.type;

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
