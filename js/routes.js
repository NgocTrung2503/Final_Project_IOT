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

  _normalizeRoutePath(route) {
    const source = route.path || route.trail || route.geometry || route.coords || [];
    const list = Array.isArray(source) ? source : Object.values(source || {});
    const coords = list
      .map(p => Array.isArray(p)
        ? [Number(p[0]), Number(p[1])]
        : [Number(p.lat ?? p.latitude), Number(p.lng ?? p.lon ?? p.longitude)]
      )
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    const first = coords[0];
    const last = coords[coords.length - 1];
    if (
      coords.length > 2 &&
      first &&
      last &&
      this.map.distance(L.latLng(first[0], first[1]), L.latLng(last[0], last[1])) < 10
    ) {
      coords.pop();
    }

    return coords;
  }

  _splitRouteSegments(coords, stops) {
    if (!coords.length) return [];

    const firstStop = stops[0]
      ? L.latLng(Number(stops[0].lat), Number(stops[0].lng))
      : null;
    const segments = [[coords[0]]];

    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const current = coords[i];
      const prevLatLng = L.latLng(prev[0], prev[1]);
      const currentLatLng = L.latLng(current[0], current[1]);
      const jumpDistance = this.map.distance(prevLatLng, currentLatLng);
      const returnsToFirstStop = firstStop && this.map.distance(currentLatLng, firstStop) < 80;

      if (i > 1 && returnsToFirstStop && jumpDistance > 500) {
        continue;
      }

      segments[segments.length - 1].push(current);
    }

    return segments.filter(segment => segment.length >= 2);
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
    const coords = this._normalizeRoutePath(route);
    const segments = this._splitRouteSegments(coords, stops);

    segments.forEach(segment => {
      L.polyline(segment, {
        color,
        weight: 6,
        opacity: 0.25,
        lineJoin: "round",
      }).addTo(group);

      L.polyline(segment, {
        color,
        weight: 3,
        opacity: 0.9,
        lineJoin: "round",
        dashArray: route.type === "metro" ? null : "8 4",
      }).addTo(group);
    });

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
