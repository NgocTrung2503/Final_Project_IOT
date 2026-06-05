// ============================================================
//  ADMIN JS
//  Quản lý phương tiện, routes và simulator
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG;

  // ─── Clock ──────────────────────────────────────────────
  const clockEl = document.getElementById("clock");
  const updateClock = () => { if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("vi-VN"); };
  updateClock(); setInterval(updateClock, 1000);

  // ─── Toast Notifications ─────────────────────────────────
  function toast(msg, type = "info") {
    const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${msg}</span>`;
    document.getElementById("toast-container").appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; el.style.transition = "0.3s"; setTimeout(() => el.remove(), 300); }, 3500);
  }

  // ─── Log Box ─────────────────────────────────────────────
  const logBox = document.getElementById("log-box");
  function log(msg, type = "") {
    if (!logBox) return;
    const el = document.createElement("div");
    el.className = "log-entry";
    el.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString("vi-VN")}]</span><span class="log-msg ${type}">${msg}</span>`;
    logBox.appendChild(el);
    logBox.scrollTop = logBox.scrollHeight;
    // Keep max 100 entries
    while (logBox.children.length > 100) logBox.removeChild(logBox.firstChild);
  }

  log("Hệ thống admin khởi động", "ok");
  log("Chế độ Demo đang bật - dữ liệu giả lập", "warn");

  // ─── Live Vehicles State ─────────────────────────────────
  let liveVehicles = [];

  // Start demo simulator
  const simulator = new DemoDataSimulator((vehicles) => {
    liveVehicles = vehicles;
    renderVehicleTable(vehicles);
    updateSimStats(vehicles);
  });
  simulator.start();
  window._simulator = simulator;

  // ─── Simulator Controls ───────────────────────────────────
  let simRunning = true;
  const simDot  = document.getElementById("sim-dot");
  const simText = document.getElementById("sim-text");

  document.getElementById("sim-start")?.addEventListener("click", () => {
    if (!simRunning) { simulator.start(); simRunning = true; }
    simDot.className = "sim-dot running";
    simText.textContent = "Đang chạy";
    log("▶ Simulator bắt đầu", "ok");
    toast("Simulator đã bắt đầu", "success");
  });

  document.getElementById("sim-stop")?.addEventListener("click", () => {
    simulator.stop(); simRunning = false;
    simDot.className = "sim-dot";
    simText.textContent = "Đã dừng";
    log("⏹ Simulator dừng", "warn");
    toast("Simulator đã dừng", "info");
  });

  document.getElementById("sim-speed")?.addEventListener("change", (e) => {
    const spd = parseFloat(e.target.value);
    simulator.vehicles.forEach(v => {
      v.speed = v.type === "metro" ? spd * 80 / 2 : spd * 30 / 2;
    });
    log(`⚡ Tốc độ giả lập: ${e.target.options[e.target.selectedIndex].text}`, "ok");
  });

  function updateSimStats(vehicles) {
    const active  = vehicles.filter(v => v.status !== "offline").length;
    const delayed = vehicles.filter(v => v.status === "delayed").length;
    const total   = vehicles.length;
    const el = document.getElementById("sim-stats");
    if (el) el.textContent = `${total} phương tiện | ${active} hoạt động | ${delayed} trễ`;
  }

  // ─── Vehicle Table ────────────────────────────────────────
  function renderVehicleTable(vehicles) {
    const tbody = document.getElementById("vehicle-tbody");
    if (!tbody) return;

    tbody.innerHTML = vehicles.map(v => {
      const pct = Math.round(((v.passengers || 0) / (v.capacity || 1)) * 100);
      const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e";
      const isDelayed = v.status === "delayed";

      return `<tr id="row-${v.id}">
        <td style="font-family:var(--font-mono); color:var(--accent); font-size:12px">${v.id}</td>
        <td><span class="type-badge ${v.type}">${v.type === "bus" ? "🚌 Bus" : "🚇 Metro"}</span></td>
        <td style="color:${v.routeColor || "#00d4ff"}; font-size:12px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${v.route || "—"}</td>
        <td style="font-size:12px; color:var(--text-secondary)">${v.currentStop || "—"}</td>
        <td style="font-family:var(--font-mono); font-size:13px; color:var(--accent)">${Math.round(v.speed || 0)}</td>
        <td>
          <div style="width:64px">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px">${v.passengers}/${v.capacity}</div>
            <div style="height:4px; background:var(--bg-base); border-radius:2px; overflow:hidden">
              <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.5s"></div>
            </div>
          </div>
        </td>
        <td>
          <span style="padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;
            background:${isDelayed ? "var(--red-dim)" : "var(--green-dim)"};
            color:${isDelayed ? "var(--red)" : "var(--green)"}">
            ${isDelayed ? "Trễ" : "Đúng giờ"}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px">
            <button class="btn btn-sm btn-ghost" onclick="editVehicle('${v.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteVehicle('${v.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  // ─── Edit Vehicle (pre-fill form) ─────────────────────────
  window.editVehicle = function(id) {
    const v = liveVehicles.find(x => x.id === id);
    if (!v) return;
    document.getElementById("f-id").value       = v.id;
    document.getElementById("f-name").value     = v.name || "";
    document.getElementById("f-type").value     = v.type;
    document.getElementById("f-route").value    = v.routeId || "";
    document.getElementById("f-capacity").value = v.capacity || 80;
    document.getElementById("f-status").value   = v.status || "on_time";
    document.getElementById("f-speed").value    = Math.round(v.speed || 0);
    document.getElementById("f-passengers").value = v.passengers || 0;
    document.getElementById("form-title").textContent = "✏️ Chỉnh sửa phương tiện";
    document.getElementById("vehicle-form").scrollIntoView({ behavior: "smooth" });
    toast(`Đang chỉnh sửa: ${v.name || v.id}`, "info");
    log(`Mở form chỉnh sửa: ${id}`);
  };

  // ─── Delete Vehicle ───────────────────────────────────────
  window.deleteVehicle = function(id) {
    if (!confirm(`Xóa phương tiện ${id}?`)) return;
    const idx = simulator.vehicles.findIndex(v => v.id === id);
    if (idx >= 0) simulator.vehicles.splice(idx, 1);
    document.getElementById(`row-${id}`)?.remove();
    toast(`Đã xóa ${id}`, "success");
    log(`🗑 Xóa phương tiện: ${id}`, "warn");
  };

  // ─── Vehicle Form ─────────────────────────────────────────
  const form = document.getElementById("vehicle-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id     = document.getElementById("f-id").value.trim();
    const name   = document.getElementById("f-name").value.trim();
    const type   = document.getElementById("f-type").value;
    const routeId= document.getElementById("f-route").value;
    const cap    = parseInt(document.getElementById("f-capacity").value) || 80;
    const status = document.getElementById("f-status").value;
    const speed  = parseFloat(document.getElementById("f-speed").value) || 30;
    const pass   = parseInt(document.getElementById("f-passengers").value) || 0;

    if (!id) { toast("ID không được để trống", "error"); return; }

    const route = DEMO_ROUTES.find(r => r.id === routeId);
    const existing = simulator.vehicles.findIndex(v => v.id === id);

    const vehicleObj = {
      id, name: name || id, type, routeId,
      stopIndex: 0, progress: 0, direction: 1,
      status, speed, passengers: pass, capacity: cap,
      route: route ? route.name : routeId,
      routeColor: route ? route.color : "#00d4ff",
    };

    if (existing >= 0) {
      simulator.vehicles[existing] = { ...simulator.vehicles[existing], ...vehicleObj };
      toast(`Cập nhật thành công: ${id}`, "success");
      log(`✅ Cập nhật phương tiện: ${id}`, "ok");
    } else {
      simulator.vehicles.push(vehicleObj);
      toast(`Thêm thành công: ${id}`, "success");
      log(`➕ Thêm phương tiện mới: ${id}`, "ok");
    }

    form.reset();
    document.getElementById("form-title").textContent = "➕ Thêm phương tiện mới";
  });

  // Populate route dropdown
  const routeSelect = document.getElementById("f-route");
  if (routeSelect) {
    DEMO_ROUTES.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      routeSelect.appendChild(opt);
    });
  }

  // ─── Firebase Seed ────────────────────────────────────────
  document.getElementById("btn-seed-firebase")?.addEventListener("click", async () => {
    if (cfg.DEMO_MODE || cfg.firebaseConfig.apiKey === "YOUR_API_KEY") {
      toast("Vui lòng cấu hình Firebase trong firebase-config.js trước", "error");
      log("❌ Firebase chưa cấu hình — tắt DEMO_MODE và điền API key", "error");
      return;
    }
    try {
      const fb = new FirebaseService();
      await fb.seedDemoData(liveVehicles, DEMO_ROUTES);
      toast("Đã đẩy dữ liệu lên Firebase!", "success");
      log("☁️ Seeded data lên Firebase thành công", "ok");
    } catch (err) {
      toast("Lỗi Firebase: " + err.message, "error");
      log("❌ " + err.message, "error");
    }
  });

  // Reset form
  document.getElementById("btn-reset-form")?.addEventListener("click", () => {
    form?.reset();
    document.getElementById("form-title").textContent = "➕ Thêm phương tiện mới";
  });

  // Export JSON
  document.getElementById("btn-export")?.addEventListener("click", () => {
    const data = JSON.stringify({ vehicles: liveVehicles, routes: DEMO_ROUTES }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `transport-data-${Date.now()}.json`;
    a.click();
    toast("Xuất dữ liệu thành công", "success");
    log("📥 Xuất JSON thành công", "ok");
  });

  log("✔ Admin panel sẵn sàng", "ok");
});
