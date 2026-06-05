// ============================================================
//  MAP CONTROLLER - index.html
//  Khởi tạo bản đồ, quản lý giao diện chính
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG;

  // ─── Init Leaflet Map ────────────────────────────────────

  const map = L.map("map", {
    center: cfg.MAP_CENTER,
    zoom: cfg.MAP_ZOOM,
    zoomControl: false,
    attributionControl: false,
  });

  // Custom zoom control position
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Dark tile layer
  const darkTile = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, subdomains: "abcd" }
  );

  // OSM Standard
  const osmTile = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19 }
  );

  // Transit focused
  const transitTile = L.tileLayer(
    "https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=demo",
    { maxZoom: 19 }
  );

  darkTile.addTo(map);

  // Layer switcher
  const tileLayers = { "🌑 Dark": darkTile, "🗺️ OSM": osmTile };
  let currentTile = "dark";
  window._map = map;

  // ─── Attribution ─────────────────────────────────────────

  L.control.attribution({ position: "bottomleft", prefix: false })
    .addAttribution("© <a href='https://carto.com' style='color:#00d4ff'>CARTO</a> | <a href='https://leafletjs.com' style='color:#00d4ff'>Leaflet</a> | Public Transport Tracker")
    .addTo(map);

  // ─── Managers ─────────────────────────────────────────────

  const vehicleMgr = new VehicleManager(map);
  const routeMgr = new RouteManager(map);
  window._vehicleMgr = vehicleMgr;
  window._routeMgr = routeMgr;

  let activeRoutes = [];
  let allStops = [];
  let latestVehicles = [];

  function enrichVehiclesWithRoutes(vehicles) {
    return vehicles.map(v => {
      const route = activeRoutes.find(r => r.id === v.routeId);
      if (!route) return v;
      return {
        ...v,
        route: v.route || route.name,
        routeColor: v.routeColor || route.color,
      };
    });
  }

  function rebuildAllStops(routes) {
    allStops = [];
    routes.forEach(r => {
      (r.stops || []).forEach(s => {
        allStops.push({ ...s, routeName: r.name, routeColor: r.color || "#00d4ff" });
      });
    });
  }

  function renderRouteToggles(routes) {
    const routeListEl = document.getElementById("route-toggle-list");
    if (!routeListEl) return;
    routeListEl.innerHTML = "";

    routes.forEach(r => {
      const div = document.createElement("div");
      div.className = "route-toggle active";
      div.dataset.routeId = r.id;
      div.innerHTML = `
        <span class="rt-dot" style="background:${r.color || "#00d4ff"}"></span>
        <span class="rt-name">${(r.name || r.id).split(" - ")[0]}</span>
        <span class="rt-type">${r.type === "metro" ? "Metro" : "Bus"}</span>
      `;
      div.addEventListener("click", () => {
        const visible = routeMgr.toggleRoute(r);
        div.classList.toggle("active", visible);
      });
      routeListEl.appendChild(div);
    });
  }

  function setRoutes(routes, fallbackToDemo = false) {
    const validRoutes = (routes || []).filter(r => Array.isArray(r.stops) && r.stops.length >= 2);
    activeRoutes = validRoutes.length ? validRoutes : (fallbackToDemo ? DEMO_ROUTES : []);
    routeMgr.removeAll();
    activeRoutes.forEach(r => routeMgr.drawRoute(r));
    rebuildAllStops(activeRoutes);
    renderRouteToggles(activeRoutes);
    updateNearestStops();
  }

  // ─── Vehicle List Panel ───────────────────────────────────

  const listEl = document.getElementById("vehicle-list");
  const statsEl = document.getElementById("stats-bar");

  function renderVehicleList(vehicles) {
    const filtered = vehicleMgr.filterType === "all"
      ? vehicles
      : vehicles.filter(v => v.type === vehicleMgr.filterType);

    // Removed stats update since we removed the stats panel in index.html

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state">Không có phương tiện</div>`;
      return;
    }

    // Sort: delayed first
    filtered.sort((a, b) => {
      if (a.status === "delayed" && b.status !== "delayed") return -1;
      if (b.status === "delayed" && a.status !== "delayed") return 1;
      return 0;
    });

    listEl.innerHTML = filtered.map(v => {
      const pct = Math.round(((v.passengers || 0) / (v.capacity || 1)) * 100);
      const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e";
      const isDelayed = v.status === "delayed";
      const isFire = vehicleMgr.isFireAlert(v);
      const typeEmoji = v.type === "bus" ? "🚌" : "🚇";
      const color = v.routeColor || "#00d4ff";

      return `
        <div class="vehicle-item ${isDelayed ? "item-delayed" : ""} ${isFire ? "item-fire" : ""} ${vehicleMgr.selectedId === v.id ? "item-selected" : ''}"
             data-id="${v.id}" onclick="window._vehicleMgr.focusVehicle('${v.id}')">
          <div class="vi-left">
            <div class="vi-icon" style="background:${color}22; border-color:${color}44">${typeEmoji}</div>
            <div class="vi-info">
              <div class="vi-name">${v.name || v.id} ${isFire ? '<span class="vi-badge fire">CHAY</span>' : ''}</div>
              <div class="vi-route" style="color:${color}">${v.route || "—"}</div>
              <div class="vi-stop">📍 ${v.nextStop || "—"}</div>
            </div>
          </div>
          <div class="vi-right">
            <div class="vi-speed">${Math.round(v.speed || 0)}<span>km/h</span></div>
            <div class="vi-bar-wrap" title="${pct}% đầy">
              <div class="vi-bar" style="width:${pct}%; background:${barColor}"></div>
            </div>
            ${isDelayed ? '<div class="vi-badge delayed">Trễ</div>' : '<div class="vi-badge ok">OK</div>'}
          </div>
        </div>`;
    }).join("");
  }

  document.addEventListener("vehicles-updated", e => {
    renderVehicleList(e.detail);
    updateFireBanner(e.detail);
  });

  function updateFireBanner(vehicles) {
    const fireEl = document.getElementById("map-fire-alert");
    const fireText = document.getElementById("map-fire-text");
    if (!fireEl) return;

    const alertVehicles = vehicles.filter(v => vehicleMgr.isFireAlert(v));
    if (!alertVehicles.length) {
      fireEl.classList.remove("active");
      return;
    }

    const v = alertVehicles[0];
    fireEl.classList.add("active");
    if (fireText) {
      fireText.textContent = `${v.name || v.id}: phat hien khoi/khi MQ2 tai ${v.currentStop || v.nextStop || "vi tri hien tai"}.`;
    }
  }

  // ─── IR Sensor Widget ─────────────────────────────────────

  let irCountIn = 0;
  let irCountOut = 0;
  const irDot = document.getElementById("ir-dot");
  const irTotal = document.getElementById("ir-total");
  const irCountInEl = document.getElementById("ir-count-in");
  const irCountOutEl = document.getElementById("ir-count-out");
  const irBar = document.getElementById("ir-bar");
  const irPct = document.getElementById("ir-pct");

  function updateIrWidget(passengers, capacity) {
    if (!irTotal) return;
    const cap = capacity || 80;
    const pct = Math.min(100, Math.round((passengers / cap) * 100));
    irTotal.textContent = passengers;
    if (irBar) {
      irBar.style.width = pct + "%";
      irBar.style.background = pct > 80 ? "linear-gradient(90deg,#ef4444,#f59e0b)" :
                               pct > 50 ? "linear-gradient(90deg,#f59e0b,#00d4ff)" :
                               "linear-gradient(90deg,#22c55e,#00d4ff)";
    }
    if (irPct) irPct.textContent = pct + "% sức chứa";
  }

  // Simulate IR event: flash dot when passenger count changes
  let lastPassengers = -1;
  document.addEventListener("vehicles-updated", e => {
    const bus = e.detail.find(v => v.type === "bus");
    if (!bus) return;
    const cur = bus.passengers || 0;
    if (lastPassengers !== -1 && cur !== lastPassengers) {
      const diff = cur - lastPassengers;
      if (diff > 0) {
        irCountIn += diff;
        if (irCountInEl) irCountInEl.textContent = irCountIn;
        // Flash green
        if (irDot) { irDot.style.background = "#22c55e"; irDot.style.boxShadow = "0 0 12px #22c55e"; }
      } else {
        irCountOut += Math.abs(diff);
        if (irCountOutEl) irCountOutEl.textContent = irCountOut;
        // Flash red
        if (irDot) { irDot.style.background = "#ef4444"; irDot.style.boxShadow = "0 0 12px #ef4444"; }
      }
      // Restore dot after 800ms
      setTimeout(() => {
        if (irDot) { irDot.style.background = "#22c55e"; irDot.style.boxShadow = "0 0 6px #22c55e"; }
      }, 800);
    }
    lastPassengers = cur;
    updateIrWidget(cur, bus.capacity);
  });

  // ─── Filter Buttons ───────────────────────────────────────

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      vehicleMgr.setFilter(btn.dataset.filter);
    });
  });

  // ─── Route Toggle Panel ───────────────────────────────────

  // Routes are initialized after the location state is ready.

  // ─── Search Suggestions ───────────────────────────────────

  const searchInput = document.getElementById("search-input");
  const suggestionsBox = document.getElementById("search-suggestions");
  
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      suggestionsBox.style.display = "none";
      return;
    }
    
    const matches = allStops.filter(s => s.name.toLowerCase().includes(q));
    if (matches.length === 0) {
      suggestionsBox.innerHTML = `<div style="padding:12px; font-size:12px; color:var(--text-muted)">Không tìm thấy trạm</div>`;
      suggestionsBox.style.display = "block";
      return;
    }

    suggestionsBox.innerHTML = matches.slice(0, 5).map(s => `
      <div class="suggestion-item" style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; font-size:13px; display:flex; flex-direction:column; gap:4px;"
           onclick="window._map.flyTo([${s.lat}, ${s.lng}], 16, {animate:true}); document.getElementById('search-suggestions').style.display='none'; document.getElementById('search-input').value='${s.name}';">
        <div style="font-weight:600; color:var(--text-primary)">📍 ${s.name}</div>
        <div style="font-size:11px; color:${s.routeColor}">${s.routeName}</div>
      </div>
    `).join("");
    suggestionsBox.style.display = "block";
  });
  
  // Hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap") && !e.target.closest(".search-suggestions")) {
      suggestionsBox.style.display = "none";
    }
  });

  // ─── Map Tile Toggle ──────────────────────────────────────

  document.getElementById("tile-toggle")?.addEventListener("click", () => {
    if (map.hasLayer(darkTile)) {
      map.removeLayer(darkTile);
      osmTile.addTo(map);
    } else {
      map.removeLayer(osmTile);
      darkTile.addTo(map);
    }
  });

  // ─── Locate Me & Nearest Stops ────────────────────────────

  let userLocation = L.latLng(cfg.MAP_CENTER[0], cfg.MAP_CENTER[1]); // default to center
  let userMarker = null;

  function updateNearestStops() {
    const listEl = document.getElementById("nearest-stops-list");
    if (!listEl) return;

    if (!allStops.length) {
      listEl.innerHTML = `<div class="empty-state" style="font-size:12px; padding:10px 0;">Chua co du lieu tuyen/tram.</div>`;
      return;
    }
    
    // Calculate distance for all stops
    const stopsWithDist = allStops.map(s => {
      const dist = map.distance(userLocation, L.latLng(s.lat, s.lng)); // in meters
      return { ...s, dist };
    });
    
    // Sort by distance
    stopsWithDist.sort((a, b) => a.dist - b.dist);
    const nearest = stopsWithDist.slice(0, 3); // top 3 nearest
    
    listEl.innerHTML = nearest.map(s => {
      const km = (s.dist / 1000).toFixed(1);
      // Walking speed ~ 5km/h => 1km = 12 mins
      const walkMins = Math.max(1, Math.round(km * 12));
      return `
        <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--text-primary)">📍 ${s.name}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Cách bạn ${km} km</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px; font-weight:700; color:var(--accent)">🚶 ${walkMins} phút</div>
            <button onclick="window._map.flyTo([${s.lat}, ${s.lng}], 16)" style="margin-top:4px; font-size:10px; padding:2px 6px; background:rgba(0,212,255,0.1); border:1px solid var(--accent); color:var(--accent); border-radius:4px; cursor:pointer;">Xem</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // Initial routes and nearest stops with default center
  setRoutes(DEMO_ROUTES, true);

  let shouldOpenUserPopup = false;

  document.getElementById("btn-refresh-location")?.addEventListener("click", () => {
    shouldOpenUserPopup = false;
    map.locate({ setView: false, maxZoom: 16 });
  });

  document.getElementById("locate-btn")?.addEventListener("click", () => {
    shouldOpenUserPopup = true;
    map.locate({ setView: true, maxZoom: 16 });
  });

  map.on("locationfound", e => {
    userLocation = e.latlng;
    if (userMarker) {
      userMarker.setLatLng(userLocation);
    } else {
      userMarker = L.circleMarker(userLocation, { radius: 10, color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.4 })
        .addTo(map)
        .bindPopup("📍 Vị trí của bạn");
    }
    if (shouldOpenUserPopup) userMarker.openPopup();
    updateNearestStops();
  });

  // ─── Firebase Connection Status ───────────────────────────

  const connDot = document.getElementById("conn-dot");
  const connText = document.getElementById("conn-text");

  document.addEventListener("firebase-connection", e => {
    const ok = e.detail;
    connDot.className = ok ? "conn-dot connected" : "conn-dot disconnected";
    connText.textContent = ok ? "Firebase: Kết nối" : "Firebase: Mất kết nối";
  });

  // ─── Data Source ──────────────────────────────────────────

  if (cfg.DEMO_MODE) {
    // Demo mode — dữ liệu giả lập
    connDot.className = "conn-dot demo";
    connText.textContent = "Chế độ Demo";

    const simulator = new DemoDataSimulator((vehicles) => {
      vehicleMgr.update(enrichVehiclesWithRoutes(vehicles));
    });
    simulator.start();
    window._simulator = simulator;

  } else {
    // Firebase mode — kết nối thật
    try {
      const fbService = new FirebaseService();
      window._fbService = fbService;

      fbService.onRoutesUpdate((routes) => {
        setRoutes(routes, false);
        if (latestVehicles.length) {
          vehicleMgr.update(enrichVehiclesWithRoutes(latestVehicles));
        }
      });

      fbService.onVehiclesUpdate((vehicles) => {
        latestVehicles = vehicles;
        const enrichedVehicles = enrichVehiclesWithRoutes(vehicles);
        vehicleMgr.update(enrichedVehicles);

        if (vehicles.length === 0) {
          // Firebase rỗng — hiện trạng thái chờ
          listEl.innerHTML = `
            <div style="padding:24px 16px; text-align:center;">
              <div style="font-size:32px; margin-bottom:10px; animation:pulse 2s infinite;">📡</div>
              <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:4px;">Chờ thiết bị kết nối...</div>
              <div style="font-size:11px; color:var(--text-muted); line-height:1.6;">
                Firebase đang rỗng.<br/>
                Bật ESP32 để bắt đầu nhận dữ liệu.
              </div>
            </div>`;

          // Ẩn IR widget khi không có xe
          const irWidget = document.getElementById("ir-widget");
          if (irWidget) irWidget.style.opacity = "0.4";
        } else {
          const irWidget = document.getElementById("ir-widget");
          if (irWidget) irWidget.style.opacity = "1";
        }
      });
    } catch (e) {
      console.error("Firebase error:", e);
      connDot.className = "conn-dot disconnected";
      connText.textContent = "Lỗi Firebase";
      listEl.innerHTML = `
        <div style="padding:20px; text-align:center; color:var(--red); font-size:13px;">
          ⚠️ Không thể kết nối Firebase.<br/>
          <span style="font-size:11px; color:var(--text-muted);">Kiểm tra lại API Key trong firebase-config.js</span>
        </div>`;
    }
  }

  // ─── Sidebar Toggle (mobile) ─────────────────────────────

  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("collapsed");
  });

  // ─── Clock ────────────────────────────────────────────────

  const clockEl = document.getElementById("clock");
  const updateClock = () => {
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("vi-VN");
  };
  updateClock();
  setInterval(updateClock, 1000);
});
