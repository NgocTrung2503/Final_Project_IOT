// ============================================================
//  ROUTE MANAGER
//  Vẽ tuyến đường và điểm dừng lên bản đồ Leaflet
// ============================================================

class RouteManager {
  constructor(map) {
    this.map = map;
    this.routeLayers = {};   // routeId → L.layerGroup
    this.stopMarkers = {};   // routeId → [L.marker]
    this.visibleRoutes = new Set();
  }

  // ─── Stop icon ────────────────────────────────────────────

  _stopIcon(color) {
    return L.divIcon({
      className: "",
      html: `<div class="stop-marker" style="background:${color}; border-color:${color}40"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  // ─── Draw a route ─────────────────────────────────────────

  drawRoute(route) {
    if (this.routeLayers[route.id]) this.removeRoute(route.id);

    const stops = Array.isArray(route.stops)
      ? route.stops.filter(s => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
      : [];
    if (stops.length < 2) return;

    const color = route.color || "#00d4ff";
    const group = L.layerGroup();
    const coords = stops.map(s => [Number(s.lat), Number(s.lng)]);

    // Outer glow line
    L.polyline(coords, {
      color,
      weight: 6,
      opacity: 0.25,
      lineJoin: "round",
    }).addTo(group);

    // Main line
    L.polyline(coords, {
      color,
      weight: 3,
      opacity: 0.9,
      lineJoin: "round",
      dashArray: route.type === "metro" ? null : "8 4",
    }).addTo(group);

    // Direction arrows using decorators-like pattern (CSS approach)
    const stopMarkers = [];
    stops.forEach((stop, idx) => {
      const m = L.marker([Number(stop.lat), Number(stop.lng)], { icon: this._stopIcon(color), zIndexOffset: -100 });
      m.bindTooltip(`
        <div class="stop-tooltip">
          <strong style="color:${color}">${stop.name || `Stop ${idx + 1}`}</strong>
          <br/><span style="color:#94a3b8; font-size:11px">${route.name}</span>
        </div>`, {
        className: "custom-tooltip",
        direction: "top",
        offset: [0, -8],
      });
      m.addTo(group);
      stopMarkers.push(m);
    });

    group.addTo(this.map);
    this.routeLayers[route.id] = group;
    this.stopMarkers[route.id] = stopMarkers;
    this.visibleRoutes.add(route.id);
  }

  removeRoute(id) {
    if (this.routeLayers[id]) {
      this.map.removeLayer(this.routeLayers[id]);
      delete this.routeLayers[id];
      delete this.stopMarkers[id];
      this.visibleRoutes.delete(id);
    }
  }

  toggleRoute(route) {
    if (this.visibleRoutes.has(route.id)) {
      this.removeRoute(route.id);
      return false;
    } else {
      this.drawRoute(route);
      return true;
    }
  }

  drawAll(routes) {
    routes.forEach(r => this.drawRoute(r));
  }

  removeAll() {
    Object.keys(this.routeLayers).forEach(id => this.removeRoute(id));
  }

  fitToRoute(route) {
    const stops = Array.isArray(route.stops) ? route.stops : [];
    if (!stops.length) return;
    const bounds = L.latLngBounds(stops.map(s => [Number(s.lat), Number(s.lng)]));
    this.map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1 });
  }
}

window.RouteManager = RouteManager;
