// ============================================================
//  DASHBOARD JS
//  Thống kê và biểu đồ phương tiện giao thông
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG;

  // ─── Clock ───────────────────────────────────────────────
  const clockEl = document.getElementById("clock");
  const updateClock = () => { if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("vi-VN"); };
  updateClock(); setInterval(updateClock, 1000);

  // ─── State ───────────────────────────────────────────────
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

  // ─── Hourly Activity Chart ───────────────────────────────
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
  // ─── Type Doughnut Chart ─────────────────────────────────
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

  // ─── Schedule Table ──────────────────────────────────────
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

  // ─── Alert Feed ──────────────────────────────────────────
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
  const scheduleAdviceCooldown = {};
  const vehicleSamples = {};

  function addScheduleDecision(key, icon, title, msg) {
    const feed = document.getElementById("smart-feed");
    if (!feed) return;

    const now = Date.now();
    if (now - (scheduleAdviceCooldown[key] || 0) < 120000) return;
    scheduleAdviceCooldown[key] = now;

    const el = document.createElement("div");
    el.className = "alert-item";
    el.style.borderLeft = "3px solid var(--accent)";
    el.innerHTML = `
      <span class="alert-icon">${icon}</span>
      <div class="alert-body">
        <div class="alert-title">${title}</div>
        <div class="alert-msg">${msg}</div>
      </div>
      <span class="alert-time">${new Date().toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })}</span>`;

    feed.insertBefore(el, feed.firstChild);
    while (feed.children.length > 12) feed.removeChild(feed.lastChild);
  }
  function processScheduleOptimization(vehicles) {
    const now = Date.now();

    vehicles.forEach(v => {
      const id = v.id || v.name || "bus";
      if (!vehicleSamples[id]) vehicleSamples[id] = [];

      const samples = vehicleSamples[id];
      samples.push({
        time: now,
        passengers: Number(v.passengers || 0),
        capacity: Number(v.capacity || 80),
        speed: Number(v.speed || 0),
        stop: v.currentStop || v.nextStop || "vị trí hiện tại",
      });

      while (samples.length > 24) samples.shift();
      const recent = samples.slice(-6);
      if (recent.length < 3) return;

      const avgLoad = recent.reduce((sum, s) => sum + (s.passengers / Math.max(1, s.capacity)), 0) / recent.length;
      const avgSpeed = recent.reduce((sum, s) => sum + s.speed, 0) / recent.length;
      const passengerTrend = recent[recent.length - 1].passengers - recent[0].passengers;
      const stopLabel = recent[recent.length - 1].stop;
      const vehicleName = v.name || id;

      if (avgLoad >= 0.85) {
        addScheduleDecision(
          `${id}-increase-trip`,
          "👥",
          "Đề xuất tăng chuyến",
          `${vehicleName} đạt trung bình ${Math.round(avgLoad * 100)}% sức chứa gần ${stopLabel}. Nên tăng xe hoặc tăng tần suất cho khu vực này.`
        );
      } else if (avgLoad <= 0.2 && recent.length >= 5) {
        addScheduleDecision(
          `${id}-space-trip`,
          "⏱",
          "Đề xuất giãn chuyến",
          `${vehicleName} đang vắng khách (${Math.round(avgLoad * 100)}% sức chứa). Có thể giãn cách chuyến để tiết kiệm vận hành.`
        );
      }

      if (passengerTrend >= 8) {
        addScheduleDecision(
          `${id}-boarding-hotspot`,
          "📍",
          "Điểm đón khách tăng nhanh",
          `${vehicleName} tăng ${passengerTrend} khách trong thời gian ngắn gần ${stopLabel}. Nên ưu tiên thêm chuyến tại khu vực này.`
        );
      }

      if (avgSpeed > 0 && avgSpeed <= 8) {
        addScheduleDecision(
          `${id}-slow-zone`,
          "🚦",
          "Đề xuất điều chỉnh ETA",
          `${vehicleName} di chuyển chậm (${Math.round(avgSpeed)} km/h). Nên cộng thêm thời gian đến trạm và cảnh báo trễ.`
        );
      }
    });
  }

  function onVehicleData(vehicles) {
    vehicleData = vehicles;
    updateKPIs(vehicles);
    initTypeChart(
      vehicles.filter(v => v.status !== "delayed" && v.status !== "offline").length,
      vehicles.filter(v => v.status === "delayed").length
    );
    renderScheduleTable(window.BUS_ROUTES || [], vehicles);
    processAlerts(vehicles);
    processScheduleOptimization(vehicles);
  }
  // Initial render
  initHourlyChart();
  renderScheduleTable(window.BUS_ROUTES || [], []);
  addAlert("info", "ℹ️", "Hệ thống khởi động", "Đang tải dữ liệu phương tiện giao thông...");

  // ─── IR Sensor Dashboard ────────────────────────────────
  const irChartCtx = document.getElementById("ir-chart")?.getContext("2d");
  const irChartLabels = [];
  const irChartData = [];
  let irChartObj = null;
  let allHistoryPoints = []; // Lưu toàn bộ history từ Firebase

  function initIrChart() {
    if (!irChartCtx) return;
    irChartObj = new Chart(irChartCtx, {
      type: "line",
      data: {
        labels: irChartLabels,
        datasets: [{
          label: "H\u00E0nh kh\u00E1ch tr\u00EAn xe",
          data: irChartData,
          borderColor: "#00d4ff",
          backgroundColor: "rgba(0,212,255,0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
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
          x: { ticks: { color: "#4a5568", font:{size:10}, maxTicksLimit: 10 }, grid: { color: "rgba(255,255,255,0.04)" } },
          y: { ticks: { color: "#4a5568", font:{size:10} }, grid: { color: "rgba(255,255,255,0.04)" }, min: 0 }
        }
      }
    });
  }

  // Cập nhật KPI cards từ dữ liệu vehicles (live)
  function updateIrKPI(bus) {
    if (!bus) return;
    const passengers = bus.passengers || 0;
    const cap = bus.capacity || 80;
    const irIn = bus.irIn || 0;
    const irOut = bus.irOut || 0;
    const pct = Math.min(100, Math.round((passengers / cap) * 100));
    const barColor = pct > 80 ? "linear-gradient(90deg,#ef4444,#f59e0b)" :
                     pct > 50 ? "linear-gradient(90deg,#f59e0b,#00d4ff)" :
                     "linear-gradient(90deg,#22c55e,#00d4ff)";

    const el = (id) => document.getElementById(id);
    if (el("db-ir-in"))  el("db-ir-in").textContent = irIn;
    if (el("db-ir-out")) el("db-ir-out").textContent = irOut;
    if (el("db-ir-total")) el("db-ir-total").textContent = passengers;
    if (el("db-ir-pct")) el("db-ir-pct").textContent = pct + "%";
    if (el("db-ir-cap-label")) el("db-ir-cap-label").textContent = passengers + "/" + cap + " ch\u1ED7";
    if (el("db-ir-capbar")) { el("db-ir-capbar").style.width = pct + "%"; el("db-ir-capbar").style.background = barColor; }
  }

  // Render biểu đồ + nhật ký từ vehicleHistory theo ngày
  function renderIrFromHistory(points, dateStr) {
    const logEl = document.getElementById("ir-event-log");
    if (!points || points.length === 0) {
      if (logEl) logEl.innerHTML = '<div style="font-size:12px; color:#4a5568; padding:16px 0; text-align:center;">📡 Không có dữ liệu lịch sử trên Firebase</div>';
      if (irChartObj) { irChartLabels.length = 0; irChartData.length = 0; irChartObj.update(); }
      const countEl = document.getElementById("ir-event-count");
      if (countEl) countEl.textContent = "(0 sự kiện)";
      return;
    }

    // ── XỬ LÝ LỖI TIMESTAMP ESP32 (millis) ──
    // Nếu thiết bị gửi millis() thay vì Unix timestamp (giá trị < 1e12 tức là trước năm 2001)
    // Ta ước lượng thời gian thực tế bằng cách neo điểm cuối cùng vào thời điểm hiện tại (hoặc cuối ngày được chọn)
    const todayStr = new Date().toISOString().split("T")[0];
    const isToday = dateStr === todayStr;
    let anchorTime = Date.now();
    if (!isToday && dateStr) {
      anchorTime = new Date(dateStr + "T23:59:59").getTime();
    }

    const millisPoints = points.filter(p => p.createdAt < 1e12);
    const maxMillis = millisPoints.length > 0 ? millisPoints[millisPoints.length - 1].createdAt : 0;

    const normalizedPoints = points.map(p => {
      if (p.createdAt < 1e12) {
        return { ...p, estimatedTime: anchorTime - (maxMillis - p.createdAt) };
      }
      return { ...p, estimatedTime: p.createdAt };
    });

    // Lọc theo ngày (dựa trên thời gian đã ước lượng)
    let filtered = normalizedPoints;
    if (dateStr) {
      filtered = normalizedPoints.filter(p => {
        const d = new Date(p.estimatedTime);
        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, "0");
        const dd   = String(d.getDate()).padStart(2, "0");
        return (yyyy + "-" + mm + "-" + dd) === dateStr;
      });
    }

    // ── Biểu đồ ──
    irChartLabels.length = 0;
    irChartData.length = 0;
    filtered.forEach(p => {
      const t = new Date(p.estimatedTime);
      irChartLabels.push(t.toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"}));
      irChartData.push(p.passengers || 0);
    });
    if (irChartObj) irChartObj.update();

    // ── Nhật ký sự kiện ──
    if (!logEl) return;
    logEl.innerHTML = "";

    const events = [];
    let prev = 0;
    filtered.forEach((p, i) => {
      const cur = p.passengers || 0;
      const diff = cur - prev;
      if (i > 0 && diff !== 0) {
        events.push({
          type: diff > 0 ? "in" : "out",
          count: Math.abs(diff),
          total: cur,
          time: new Date(p.estimatedTime).toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit", second:"2-digit"}),
          speed: p.speed || 0,
        });
      }
      prev = cur;
    });

    const countEl = document.getElementById("ir-event-count");
    if (countEl) countEl.textContent = "(" + events.length + " sự kiện)";

    if (events.length === 0) {
      logEl.innerHTML = '<div style="font-size:12px; color:#4a5568; padding:16px 0; text-align:center;">' +
        (filtered.length === 0 ? "📅 Không có dữ liệu ngày này" : "✅ Không có thay đổi hành khách") + '</div>';
      return;
    }

    // Hiển thị sự kiện (mới nhất ở trên)
    events.reverse().forEach(ev => {
      const isIn = ev.type === "in";
      const item = document.createElement("div");
      item.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px;" +
        "background:" + (isIn ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)") + ";" +
        "border-left:3px solid " + (isIn ? "#22c55e" : "#ef4444") + "; font-size:12px;";
      item.innerHTML =
        '<span style="font-size:14px">' + (isIn ? "\u25B2" : "\u25BC") + '</span>' +
        '<div style="flex:1">' +
          '<span style="color:' + (isIn ? "#22c55e" : "#ef4444") + '; font-weight:600;">' +
            (isIn ? "+" + ev.count + " l\u00EAn xe" : "-" + ev.count + " xu\u1ED1ng xe") +
          '</span>' +
          '<span style="color:#4a5568; margin-left:4px;">\u2192 ' + ev.total + ' ng\u01B0\u1EDDi</span>' +
          (ev.speed > 0 ? '<span style="color:#64748b; margin-left:6px; font-size:10px;">(' + Math.round(ev.speed) + ' km/h)</span>' : '') +
        '</div>' +
        '<span style="color:#4a5568; font-size:10px; white-space:nowrap;">' + ev.time + '</span>';
      logEl.appendChild(item);
    });
  }

  initIrChart();

  // ─── Khởi động nguồn dữ liệu ─────────────────────────────
  addAlert("info", "\uD83D\uDCE1", "Firebase Mode", "\u0110ang k\u1EBFt n\u1ED1i Firebase... B\u1EADt thi\u1EBFt b\u1ECB ESP32 \u0111\u1EC3 xem d\u1EEF li\u1EC7u.");

    try {
      const fbService = new FirebaseService();
      window._fbService = fbService;

      // ── Live vehicles → cập nhật KPI ──
      fbService.onVehiclesUpdate((vehicles) => {
        onVehicleData(vehicles);
        const bus = vehicles.find(v => v.type === "bus");
        if (bus) {
          updateIrKPI(bus);
          // Tự động lưu history mỗi khi có dữ liệu live (để phòng trường hợp map chưa mở)
          if (typeof fbService.saveVehicleHistoryPoint === "function") {
            fbService.saveVehicleHistoryPoint(bus).catch(console.warn);
          }
        }

        if (vehicles.length === 0) {
          ["kpi-total","kpi-active","kpi-delayed","kpi-ontime","kpi-passengers"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "0";
          });
          const tbody = document.getElementById("schedule-tbody");
          if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">' +
            '\uD83D\uDCE1 Ch\u1EDD d\u1EEF li\u1EC7u t\u1EEB thi\u1EBFt b\u1ECB GPS / ESP32...</td></tr>';
        }
      });

      // ── Vehicle History → biểu đồ + nhật ký ──
      fbService.onPassengerHistoryUpdate((history) => {
        const busIds = Object.keys(history);
        if (busIds.length === 0) {
          document.getElementById("ir-event-log").innerHTML =
            '<div style="font-size:12px; color:#4a5568; padding:16px 0; text-align:center;">📡 Chưa có dữ liệu lịch sử trên Firebase</div>';
          return;
        }
        allHistoryPoints = history[busIds[0]] || [];
        console.log("📊 Lịch sử hành khách:", allHistoryPoints.length, "điểm");

        // Mặc định: hiển thị ngày hôm nay
        const datePicker = document.getElementById("ir-date-picker");
        const today = new Date().toISOString().split("T")[0];
        if (datePicker && !datePicker.value) datePicker.value = today;

        renderIrFromHistory(allHistoryPoints, datePicker ? datePicker.value : today);
      });

      // ── Date picker: khi đổi ngày → render lại ──
      const datePicker = document.getElementById("ir-date-picker");
      if (datePicker) {
        datePicker.value = new Date().toISOString().split("T")[0];
        datePicker.addEventListener("change", () => {
          renderIrFromHistory(allHistoryPoints, datePicker.value);
        });
      }

    } catch (err) {
      console.error("Firebase dashboard error:", err);
      addAlert("delay", "\u26A0\uFE0F", "L\u1ED7i Firebase", "Ki\u1EC3m tra l\u1EA1i API Key trong firebase-config.js");
    }

  // ─── Smart Scheduling Feed ──────────────────────────────
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