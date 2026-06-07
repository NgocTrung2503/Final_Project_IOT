// ============================================================
//  ADMIN JS - Kết nối Firebase thật
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  // ─── Clock ────────────────────────────────────────────────
  const clockEl = document.getElementById("clock");
  const updateClock = () => { if (clockEl) clockEl.textContent = new Date().toLocaleTimeString("vi-VN"); };
  updateClock(); setInterval(updateClock, 1000);

  // ─── Toast ────────────────────────────────────────────────
  function toast(msg, type = "info") {
    const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${msg}</span>`;
    document.getElementById("toast-container").appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0"; el.style.transform = "translateY(8px)";
      el.style.transition = "0.3s"; setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  // ─── Log Box ──────────────────────────────────────────────
  const logBox = document.getElementById("log-box");
  function log(msg, type = "") {
    if (!logBox) return;
    const el = document.createElement("div");
    el.className = "log-entry";
    el.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString("vi-VN")}]</span><span class="log-msg ${type}">${msg}</span>`;
    logBox.appendChild(el);
    logBox.scrollTop = logBox.scrollHeight;
    while (logBox.children.length > 100) logBox.removeChild(logBox.firstChild);
  }

  log("Hệ thống admin khởi động", "ok");

  // ─── Firebase ─────────────────────────────────────────────
  let db;
  const fbDot  = document.getElementById("fb-dot");
  const fbText = document.getElementById("fb-text");

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    }
    db = firebase.database();

    // Monitor connection state
    db.ref(".info/connected").on("value", (snap) => {
      const connected = snap.val() === true;
      if (fbDot)  fbDot.className  = connected ? "sim-dot running" : "sim-dot";
      if (fbText) fbText.textContent = connected ? "Firebase: Đã kết nối ✅" : "Firebase: Mất kết nối ❌";
    });

    log("✅ Kết nối Firebase thành công", "ok");
  } catch (e) {
    if (fbDot)  fbDot.className  = "sim-dot";
    if (fbText) fbText.textContent = "Lỗi Firebase!";
    log("❌ Lỗi kết nối Firebase: " + e.message, "error");
    toast("Không kết nối được Firebase!", "error");
  }

  // ─── Dữ liệu xe thực tế (lắng nghe realtime) ─────────────
  let liveVehicles = [];

  if (db) {
    db.ref("vehicles").on("value", (snap) => {
      const data = snap.val();
      if (data) {
        liveVehicles = Object.entries(data).map(([id, v]) => ({ id, ...v }));
        renderVehicleTable(liveVehicles);
        updateStats(liveVehicles);
        log(`📡 Cập nhật: ${liveVehicles.length} phương tiện từ Firebase`, "ok");
      } else {
        liveVehicles = [];
        renderVehicleTable([]);
        updateStats([]);
        log("📭 Firebase chưa có dữ liệu xe nào", "warn");
      }
    });
  }

  // ─── Thống kê ─────────────────────────────────────────────
  function updateStats(vehicles) {
    const el = document.getElementById("sim-stats");
    if (!el) return;
    const active  = vehicles.filter(v => v.status !== "offline").length;
    const delayed = vehicles.filter(v => v.status === "delayed").length;
    el.textContent = `${vehicles.length} phương tiện | ${active} hoạt động | ${delayed} trễ`;
  }

  // ─── Bảng danh sách xe ────────────────────────────────────
  function renderVehicleTable(vehicles) {
    const tbody = document.getElementById("vehicle-tbody");
    if (!tbody) return;

    if (vehicles.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
          📭 Chưa có xe nào. Xe sẽ tự xuất hiện khi ESP32 gửi dữ liệu lên Firebase.
        </td></tr>`;
      return;
    }

    tbody.innerHTML = vehicles.map(v => {
      const pct      = Math.round(((v.passengers || 0) / (v.capacity || 1)) * 100);
      const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e";
      const isDelayed = v.status === "delayed";

      return `<tr id="row-${v.id}">
        <td style="font-family:var(--font-mono); color:var(--accent); font-size:12px">${v.id}</td>
        <td><span class="type-badge bus">🚌 Bus</span></td>
        <td style="color:#00d4ff; font-size:12px">${v.route || v.routeId || "—"}</td>
        <td style="font-size:12px; color:var(--text-secondary)">
          ${(v.lat && v.lng) ? `<i class='bx bx-map'></i> ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}` : (v.currentStop || "—")}
        </td>
        <td style="font-family:var(--font-mono); font-size:13px; color:var(--accent)">${Math.round(v.speed || 0)}</td>
        <td>
          <div style="width:64px">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px">${v.passengers || 0}/${v.capacity || 80}</div>
            <div style="height:4px; background:var(--bg-base); border-radius:2px; overflow:hidden">
              <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.5s"></div>
            </div>
          </div>
        </td>
        <td>
          <span style="padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;
            background:${isDelayed ? "var(--red-dim)" : "var(--green-dim)"};
            color:${isDelayed ? "var(--red)" : "var(--green)"}">
            ${isDelayed ? "⚠️ Trễ" : "✅ Đúng giờ"}
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

  // ─── Chỉnh sửa xe (điền form) ─────────────────────────────
  window.editVehicle = function(id) {
    const v = liveVehicles.find(x => x.id === id);
    if (!v) return;
    document.getElementById("f-id").value         = v.id;
    document.getElementById("f-name").value       = v.name || "";
    document.getElementById("f-type").value       = v.type || "bus";
    document.getElementById("f-route").value      = v.route || "";
    document.getElementById("f-capacity").value   = v.capacity || 80;
    document.getElementById("f-status").value     = v.status || "on_time";
    document.getElementById("f-speed").value      = Math.round(v.speed || 0);
    document.getElementById("f-passengers").value = v.passengers || 0;
    document.getElementById("form-title").textContent = "✏️ Chỉnh sửa phương tiện";
    document.getElementById("vehicle-form").scrollIntoView({ behavior: "smooth" });
    toast(`Đang chỉnh sửa: ${v.name || v.id}`, "info");
    log(`Mở form chỉnh sửa: ${id}`);
  };

  // ─── Xóa xe khỏi Firebase ─────────────────────────────────
  window.deleteVehicle = async function(id) {
    if (!confirm(`Xóa phương tiện "${id}" khỏi Firebase?`)) return;
    if (!db) { toast("Chưa kết nối Firebase!", "error"); return; }
    try {
      await db.ref(`vehicles/${id}`).remove();
      toast(`Đã xóa ${id}`, "success");
      log(`🗑 Xóa phương tiện: ${id}`, "warn");
    } catch (e) {
      toast("Lỗi khi xóa: " + e.message, "error");
      log("❌ " + e.message, "error");
    }
  };

  // ─── Form Thêm / Cập nhật xe ──────────────────────────────
  const form = document.getElementById("vehicle-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!db) { toast("Chưa kết nối Firebase!", "error"); return; }

    const id    = document.getElementById("f-id").value.trim();
    const name  = document.getElementById("f-name").value.trim();
    const type  = document.getElementById("f-type").value;
    const route = document.getElementById("f-route").value.trim();
    const cap   = parseInt(document.getElementById("f-capacity").value) || 80;
    const stat  = document.getElementById("f-status").value;
    const spd   = parseFloat(document.getElementById("f-speed").value) || 0;
    const pass  = parseInt(document.getElementById("f-passengers").value) || 0;

    if (!id) { toast("ID không được để trống!", "error"); return; }

    const vehicleData = {
      name: name || id,
      type: type || "bus",
      route: route || "",
      capacity: cap,
      status: stat,
      speed: spd,
      passengers: pass,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    };

    try {
      const existing = liveVehicles.find(v => v.id === id);
      if (existing) {
        // Cập nhật — giữ nguyên lat/lng thực tế
        await db.ref(`vehicles/${id}`).update(vehicleData);
        toast(`Cập nhật thành công: ${id}`, "success");
        log(`✅ Cập nhật phương tiện: ${id}`, "ok");
      } else {
        // Thêm mới — vị trí mặc định trung tâm TP.HCM
        await db.ref(`vehicles/${id}`).set({
          ...vehicleData,
          lat: 10.7769,
          lng: 106.7009,
        });
        toast(`Thêm thành công: ${id}`, "success");
        log(`➕ Thêm phương tiện mới: ${id}`, "ok");
      }
      form.reset();
      document.getElementById("form-title").textContent = "➕ Thêm phương tiện mới";
    } catch (err) {
      toast("Lỗi: " + err.message, "error");
      log("❌ " + err.message, "error");
    }
  });

  // ─── Reset Form ───────────────────────────────────────────
  document.getElementById("btn-reset-form")?.addEventListener("click", () => {
    form?.reset();
    document.getElementById("form-title").textContent = "➕ Thêm phương tiện mới";
  });

  // ─── Xuất JSON từ Firebase ────────────────────────────────
  document.getElementById("btn-export")?.addEventListener("click", () => {
    const data = JSON.stringify({ vehicles: liveVehicles }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `firebase-vehicles-${Date.now()}.json`;
    a.click();
    toast("Xuất dữ liệu thành công", "success");
    log("📥 Xuất JSON từ Firebase thành công", "ok");
  });

  log("✔ Admin panel sẵn sàng — dữ liệu thực từ Firebase", "ok");
});
