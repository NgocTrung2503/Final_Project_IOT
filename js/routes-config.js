// ============================================================
//  ROUTES CONFIG - Định nghĩa tuyến đường và trạm dừng thật
//  Đây là dữ liệu thật của xe bus IoT
//  Thêm/sửa tuyến đường tại đây khi thay đổi lộ trình thực tế
// ============================================================

const BUS_ROUTES = [
  {
    id: "route_01",
    name: "Tuyến 01 - Bến Thành → Chợ Lớn",
    color: "#00d4ff",
    stops: [
      { id: "s01_1", name: "Bến Thành",      lat: 10.7734, lng: 106.6980 },
      { id: "s01_2", name: "Phạm Ngũ Lão",   lat: 10.7694, lng: 106.6943 },
      { id: "s01_3", name: "Nguyễn Trãi",    lat: 10.7649, lng: 106.6872 },
      { id: "s01_4", name: "Trần Hưng Đạo B",lat: 10.7598, lng: 106.6807 },
      { id: "s01_5", name: "Chợ Lớn",        lat: 10.7551, lng: 106.6638 },
    ],
    schedule: ["05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","14:00","14:30","17:00","17:30","18:00"],
  },
  // Thêm tuyến khác tại đây nếu cần:
  // {
  //   id: "route_02",
  //   name: "Tuyến 02 - ...",
  //   color: "#a855f7",
  //   stops: [...],
  // }
];

// ─── Hàm tính khoảng cách Haversine (đơn vị: mét) ──────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── Tự nhận biết tuyến đường + trạm gần nhất từ GPS ───────
// Trả về: { routeId, routeName, routeColor, currentStop, distToStop }
function detectRouteFromGPS(lat, lng) {
  let bestRoute   = null;
  let bestStop    = null;
  let bestDist    = Infinity;

  BUS_ROUTES.forEach(route => {
    route.stops.forEach(stop => {
      const dist = haversineDistance(lat, lng, stop.lat, stop.lng);
      if (dist < bestDist) {
        bestDist  = dist;
        bestStop  = stop;
        bestRoute = route;
      }
    });
  });

  if (!bestRoute) return null;

  return {
    routeId:    bestRoute.id,
    routeName:  bestRoute.name,
    routeColor: bestRoute.color,
    currentStop: bestStop.name,
    distToStop:  Math.round(bestDist),   // mét
  };
}

// Export ra global
window.BUS_ROUTES       = BUS_ROUTES;
window.detectRouteFromGPS = detectRouteFromGPS;
window.haversineDistance  = haversineDistance;
