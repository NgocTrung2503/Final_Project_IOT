// ============================================================
//  DASHBOARD JS
//  Thống kê và biểu đồ phương tiện giao thông
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG;

  // ─── Clock ──────────────────────────────────────────────
  const clockEl = document.getElementById("clock");
  const updateClock = () => { if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("vi-VN"); };
  updateClock(); setInterval(updateClock, 1000);

  // ─── State ──────────────────────────────────────────────
  let vehicleData = [];
  let hourlyData  = Array(24).fill(0);
  let alertCount  = 0;

  // ─── KPI Elements ────────────────────────────────────────
  const kpiTotal    = document.getElementById("kpi-total");
  const kpiActive   = document.getElementById("kpi-active");
  const kpiDelayed  = document.getElementById("kpi-delayed");
  const kpiOnTime   = document.getElementById("kpi-ontime");
  const kpiPassengers = document.getElementById("kpi-passengers");

  function updateKPIs(vehicles) {
    const total     = vehicles.length;
    const active    = vehicles.filter(v => v.status !== "offline").length;
    const delayed   = vehicles.filter(v => v.status === "delayed").length;
    const onTime    = active - delayed;
    const passengers = vehicles.reduce((s, v) => s + (v.passengers || 0), 0);

    animateCount(kpiTotal,    total);
    animateCount(kpiActive,   active);
    animateCount(kpiDelayed,  delayed);
    animateCount(kpiOnTime,   onTime);
    animateCount(kpiPassengers, passengers);
  }

  function animateCount(el, target) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const diff  = target - start;
    const steps = 20;
    let i = 0;
    const tick = () => {
      i++;
      el.textContent = Math.round(start + diff * (i / steps));
      if (i < steps) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ─── Hourly Activity Chart ────────────────────────────────
  const chartCtx = document.getElementById("hourly-chart")?.getContext("2d");
  let hourlyChart = null;

  function initHourlyChart() {
    if (!chartCtx) return;
    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
    const sampleData = [2, 1, 1, 1, 2, 4, 7, 8, 8, 6, 5, 5, 6, 5, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2];
    const currentHour = new Date().getHours();

    hourlyChart = new Chart(chartCtx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Phương tiện hoạt động",
          data: sampleData,
          borderColor: "#00d4ff",
          backgroundColor: "rgba(0,212,255,0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.45,
          pointRadius: 3,
          pointBackgroundColor: "#00d4ff",
          pointBorderColor: "#080c14",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        }, {
          label: "Giờ hiện tại",
          data: labels.map((_, i) => i === currentHour ? sampleData[i] : null),
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b",
          borderWidth: 0,
          pointRadius: 8,
          pointBackgroundColor: "#f59e0b",
          showLine: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#94a3b8", font: { family: "Inter", size: 12 }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: "#0d1525",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            titleColor: "#f0f4ff",
            bodyColor: "#94a3b8",
            padding: 12,
          }
        },
        scales: {
          x: {
            ticks: { color: "#4a5568", font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
            grid:  { color: "rgba(255,255,255,0.04)" },
          },
          y: {
            ticks: { color: "#4a5568", font: { size: 11 }, stepSize: 2 },
            grid:  { color: "rgba(255,255,255,0.04)" },
            min: 0,
          }
        }
      }
    });
  }

  // ─── Type Doughnut Chart ──────────────────────────────────
  const typeCtx = document.getElementById("type-chart")?.getContext("2d");
  let typeChart = null;

  function initTypeChart(onTime, delayed) {
    if (!typeCtx) return;
    if (typeChart) typeChart.destroy();

    typeChart = new Chart(typeCtx, {
      type: "doughnut",
      data: {
        labels: ["✅ Đúng giờ", "⚠️ Trễ giờ"],
        datasets: [{
          data: [onTime, delayed],
          backgroundColor: ["rgba(34,197,94,0.8)", "rgba(239,68,68,0.8)"],
          borderColor: ["#22c55e", "#ef4444"],
          borderWidth: 2,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#94a3b8", font: { family: "Inter", size: 12 }, boxWidth: 12, padding: 16 }
          },
          tooltip: {
            backgroundColor: "#0d1525",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            titleColor: "#f0f4ff",
            bodyColor: "#94a3b8",
            padding: 12,
          }
        }
      }
    });
  }

  // ─── Schedule Table ───────────────────────────────────────
  function renderScheduleTable(routes, vehicles) {
    const tbody = document.getElementById("schedule-tbody");
    if (!tbody) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    tbody.innerHTML = routes.map(route => {
      const activeVehicles = vehicles.filter(v => v.routeId === route.id);
      const delayed = activeVehicles.filter(v => v.status === "delayed");
      const status = activeVehicles.length === 0 ? "inactive" : delayed.length > 0 ? "delayed" : "on-time";
      const statusLabel = { "inactive": "Ngưng hoạt động", "delayed": `Trễ (${delayed.length})`, "on-time": "Đúng giờ" }[status];
      const statusClass = { "inactive": "inactive", "delayed": "delayed", "on-time": "on-time" }[status];

      // Next departure
      const departures = route.schedule || [];
      const nextDep = departures.find(t => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m > nowMin;
      }) || departures[0] || "—";

      const typeEmoji = "🚌";

      return `<tr>
        <td>
          <span class="route-dot" style="background:${route.color}"></span>
          ${typeEmoji} ${route.name.split(" - ")[0]}
        </td>
        <td>${activeVehicles.length}</td>
        <td><span class="sch-status ${statusClass}">${statusLabel}</span></td>
        <td style="font-family:var(--font-mono); color:var(--accent)">${nextDep}</td>
        <td style="color:var(--text-muted)">${departures.length} chuyến/ngày</td>
      </tr>`;
    }).join("");
  }

  // ─── Alert Feed ───────────────────────────────────────────
  const alertFeed = document.getElementById("alert-feed");
  const addedAlerts = new Set();

  function addAlert(type, icon, title, msg) {
    const key = `${type}-${title}`;
    if (addedAlerts.has(key)) return;
    addedAlerts.add(key);

    const el = document.createElement("div");
    el.className = `alert-item alert-${type}`;
    el.innerHTML = `
      <span class="alert-icon">${icon}</span>
      <div class="alert-body">
        <div class="alert-title">${title}</div>
        <div class="alert-msg">${msg}</div>
      </div>
      <span class="alert-time">${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>`;

    alertFeed.insertBefore(el, alertFeed.firstChild);

    // Keep max 20 alerts
    while (alertFeed.children.length > 20) alertFeed.removeChild(alertFeed.lastChild);

    // Alert counter badge
    alertCount++;
    const badge = document.getElementById("alert-count");
    if (badge) { badge.textContent = alertCount; badge.style.display = ""; }
  }

  function processAlerts(vehicles) {
    vehicles.forEach(v => {
      if (v.status === "delayed") {
        addAlert("delay", "⚠️", `${v.name || v.id} trễ giờ`, `Tuyến: ${v.route || "—"} | Điểm tiếp theo: ${v.nextStop || "—"}`);
      }
      const pct = (v.passengers || 0) / (v.capacity || 1);
      if (pct > 0.9) {
        addAlert("delay", "👥", `${v.name || v.id} gần đầy`, `${v.passengers}/${v.capacity} hành khách (${Math.round(pct * 100)}%)`);
      }
    });
  }

  // ─── Data Source ─────────────────────────────────────────
  function onVehicleData(vehicles) {
    vehicleData = vehicles;
    updateKPIs(vehicles);
    initTypeChart(
      vehicles.filter(v => v.status !== "delayed" && v.status !== "offline").length,
      vehicles.filter(v => v.status === "delayed").length
    );
    renderScheduleTable(DEMO_ROUTES, vehicles);
    processAlerts(vehicles);
  }

  // Initial render
  initHourlyChart();
  renderScheduleTable(DEMO_ROUTES, []);
  addAlert("info", "ℹ️", "Hệ thống khởi động", "Đang tải dữ liệu phương tiện giao thông...");

  // ─── IR Sensor Dashboard ────────────────────────────────
  let dbIrIn = 0, dbIrOut = 0, dbIrLastPassengers = -1;
  const irChartCtx = document.getElementById("ir-chart")?.getContext("2d");
  const irChartLabels = [];
  const irChartData = [];
  let irChartObj = null;

  function initIrChart() {
    if (!irChartCtx) return;
    irChartObj = new Chart(irChartCtx, {
      type: "line",
      data: {
        labels: irChartLabels,
        datasets: [{
          label: "Hành khách trên xe",
          data: irChartData,
          borderColor: "#00d4ff",
          backgroundColor: "rgba(0,212,255,0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointBackgroundColor: "#00d4ff",
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0d1525", titleColor: "#f0f4ff",
            bodyColor: "#94a3b8", padding: 10,
          }
        },
        scales: {
          x: { ticks: { color: "#4a5568", font:{size:10}, maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,0.04)" } },
          y: { ticks: { color: "#4a5568", font:{size:10} }, grid: { color: "rgba(255,255,255,0.04)" }, min: 0, max: 80 }
        }
      }
    });
  }

  function addIrEvent(type, count, total) {
    const logEl = document.getElementById("ir-event-log");
    if (!logEl) return;
    const time = new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit", second:"2-digit"});
    const isIn = type === "in";
    const item = document.createElement("div");
    item.style.cssText = `display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:6px; 
      background:${isIn ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"};
      border-left:3px solid ${isIn ? "#22c55e" : "#ef4444"}; font-size:12px;`;
    item.innerHTML = `
      <span style="font-size:14px">${isIn ? "▲" : "▼"}</span>
      <div style="flex:1">
        <span style="color:${isIn ? "#22c55e" : "#ef4444"}; font-weight:600;">${isIn ? "+" + count + " lên xe" : "-" + count + " xuống xe"}</span>
        <span style="color:#4a5568; margin-left:4px;">→ ${total} người</span>
      </div>
      <span style="color:#4a5568; font-size:10px; white-space:nowrap;">${time}</span>`;
    // Remove placeholder if first event
    if (logEl.children.length === 1 && logEl.children[0].tagName === "DIV" && logEl.children[0].style.color === "#4a5568") {
      logEl.innerHTML = "";
    }
    logEl.insertBefore(item, logEl.firstChild);
    while (logEl.children.length > 15) logEl.removeChild(logEl.lastChild);
  }

  function updateIrDashboard(passengers, capacity) {
    const cap = capacity || 80;
    const pct = Math.min(100, Math.round((passengers / cap) * 100));
    const barColor = pct > 80 ? "linear-gradient(90deg,#ef4444,#f59e0b)" :
                     pct > 50 ? "linear-gradient(90deg,#f59e0b,#00d4ff)" :
                     "linear-gradient(90deg,#22c55e,#00d4ff)";

    const el = (id) => document.getElementById(id);
    if (el("db-ir-total")) el("db-ir-total").textContent = passengers;
    if (el("db-ir-pct")) el("db-ir-pct").textContent = pct + "%";
    if (el("db-ir-cap-label")) el("db-ir-cap-label").textContent = passengers + "/" + cap + " chỗ";
    if (el("db-ir-capbar")) { el("db-ir-capbar").style.width = pct + "%"; el("db-ir-capbar").style.background = barColor; }
    if (el("db-ir-in")) el("db-ir-in").textContent = dbIrIn;
    if (el("db-ir-out")) el("db-ir-out").textContent = dbIrOut;

    // Update chart
    if (irChartObj) {
      const timeLabel = new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit", second:"2-digit"});
      irChartLabels.push(timeLabel);
      irChartData.push(passengers);
      if (irChartLabels.length > 20) { irChartLabels.shift(); irChartData.shift(); }
      irChartObj.update("none");
    }
  }

  initIrChart();

  // ─── Khởi động nguồn dữ liệu ─────────────────────────────
  const cfg = window.APP_CONFIG;

  if (cfg.DEMO_MODE) {
    // Demo Mode — dùng simulator
    const simulator = new DemoDataSimulator(onVehicleData);
    simulator.start();
    window._simulator = simulator;

    addAlert("info", "🎮", "Chế độ Demo", "Đang chạy dữ liệu giả lập. Bật DEMO_MODE=false để dùng Firebase thật.");

  } else {
    // Firebase Mode — kết nối thật
    addAlert("info", "📡", "Firebase Mode", "Đang kết nối Firebase... Bật thiết bị ESP32 để xem dữ liệu.");

    try {
      const fbService = new FirebaseService();
      window._fbService = fbService;

      fbService.onVehiclesUpdate((vehicles) => {
        onVehicleData(vehicles);

        if (vehicles.length === 0) {
          // Firebase rỗng — reset KPI, hiện thông báo chờ
          ["kpi-total","kpi-active","kpi-delayed","kpi-ontime","kpi-passengers"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "0";
          });
          const tbody = document.getElementById("schedule-tbody");
          if (tbody) tbody.innerHTML = `
            <tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">
              📡 Chờ dữ liệu từ thiết bị GPS / ESP32...
            </td></tr>`;
        }
      });
    } catch (err) {
      console.error("Firebase dashboard error:", err);
      addAlert("delay", "⚠️", "Lỗi Firebase", "Kiểm tra lại API Key trong firebase-config.js");
    }
  }

  // Listen for vehicle updates to drive IR dashboard
  document.addEventListener("vehicles-updated", (e) => {
    const bus = e.detail.find(v => v.type === "bus");
    if (!bus) return;
    const cur = bus.passengers || 0;
    if (dbIrLastPassengers !== -1 && cur !== dbIrLastPassengers) {
      const diff = cur - dbIrLastPassengers;
      if (diff > 0) {
        dbIrIn += diff;
        addIrEvent("in", diff, cur);
        const dot = document.getElementById("ir-status-dot");
        if (dot) { dot.style.background = "#22c55e"; dot.style.boxShadow = "0 0 10px #22c55e"; }
      } else {
        dbIrOut += Math.abs(diff);
        addIrEvent("out", Math.abs(diff), cur);
        const dot = document.getElementById("ir-status-dot");
        if (dot) { dot.style.background = "#ef4444"; dot.style.boxShadow = "0 0 10px #ef4444"; }
        setTimeout(() => {
          const d = document.getElementById("ir-status-dot");
          if (d) { d.style.background = "#22c55e"; d.style.boxShadow = "0 0 6px #22c55e"; }
        }, 1000);
      }
    }
    dbIrLastPassengers = cur;
    updateIrDashboard(cur, bus.capacity);
  });

  // ─── Smart Scheduling Feed ────────────────────────────────
  const smartFeed = document.getElementById("smart-feed");
  document.addEventListener("smart-ai-decision", (e) => {
    if (!smartFeed) return;
    const { action, icon, title, msg, time } = e.detail;
    
    const el = document.createElement("div");
    el.className = `alert-item`;
    el.style.borderLeft = `3px solid var(--accent)`;
    el.innerHTML = `
      <span class="alert-icon">${icon}</span>
      <div class="alert-body">
        <div class="alert-title">${title}</div>
        <div class="alert-msg">${msg}</div>
      </div>
      <span class="alert-time">${time}</span>`;
      
    smartFeed.insertBefore(el, smartFeed.firstChild);
    while (smartFeed.children.length > 10) smartFeed.removeChild(smartFeed.lastChild);
  });
});
