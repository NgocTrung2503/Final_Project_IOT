// ============================================================
//  ROUTES CONFIG - Định nghĩa tuyến đường và trạm dừng thật
//  Đây là dữ liệu tuyến xe bus
//  Thêm/sửa tuyến đường tại đây khi thay đổi lộ trình thực tế
// ============================================================

function densifyRoutePath(points, maxSegmentMeters = 28) {
  const distance = (a, b) => {
    const lat1 = Number(a.lat) * Math.PI / 180;
    const lat2 = Number(b.lat) * Math.PI / 180;
    const dLat = lat2 - lat1;
    const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  return points.flatMap((point, index) => {
    const next = points[index + 1];
    if (!next) return [point];

    const steps = Math.max(1, Math.ceil(distance(point, next) / maxSegmentMeters));
    return Array.from({ length: steps }, (_, step) => {
      const t = step / steps;
      return {
        lat: Number((point.lat + (next.lat - point.lat) * t).toFixed(6)),
        lng: Number((point.lng + (next.lng - point.lng) * t).toFixed(6)),
      };
    });
  });
}

const BUS_ROUTES = [
  {
    id: "route_02",
    name: "Tuyến 02",
    color: "#22c55e",
    stops: [
      { id: "r02_1", name: "ĐH Bách Khoa", lat: 10.8802, lng: 106.7854 },
      { id: "r02_2", name: "UEL", lat: 10.8725, lng: 106.7898 },
      { id: "r02_3", name: "ĐHQG Trung tâm", lat: 10.8760, lng: 106.7972 },
      { id: "r02_4", name: "Hồ Đá", lat: 10.8794, lng: 106.8012 },
    ],
    path: densifyRoutePath([
      { lat: 10.8802, lng: 106.7854 },
      { lat: 10.8799, lng: 106.7862 },
      { lat: 10.8794, lng: 106.7871 },
      { lat: 10.8787, lng: 106.7880 },
      { lat: 10.8779, lng: 106.7887 },
      { lat: 10.8769, lng: 106.7892 },
      { lat: 10.8757, lng: 106.7895 },
      { lat: 10.8745, lng: 106.7897 },
      { lat: 10.8734, lng: 106.7898 },
      { lat: 10.8725, lng: 106.7898 },
      { lat: 10.8724, lng: 106.7907 },
      { lat: 10.8728, lng: 106.7918 },
      { lat: 10.8734, lng: 106.7929 },
      { lat: 10.8740, lng: 106.7941 },
      { lat: 10.8746, lng: 106.7953 },
      { lat: 10.8752, lng: 106.7964 },
      { lat: 10.8760, lng: 106.7972 },
      { lat: 10.8768, lng: 106.7980 },
      { lat: 10.8775, lng: 106.7988 },
      { lat: 10.8781, lng: 106.7996 },
      { lat: 10.8787, lng: 106.8004 },
      { lat: 10.8794, lng: 106.8012 },
    ]),
    schedule: ["06:10","06:40","07:10","07:40","08:10","08:40","16:10","16:40","17:10","17:40"],
  },
  {
    id: "route_03",
    name: "Tuyến 03",
    color: "#f59e0b",
    stops: [
      { id: "r03_1", name: "ĐH Quốc tế", lat: 10.8782, lng: 106.8066 },
      { id: "r03_2", name: "Nhà văn hóa Sinh viên", lat: 10.8757, lng: 106.8058 },
      { id: "r03_3", name: "ĐH KHTN", lat: 10.8717, lng: 106.8033 },
      { id: "r03_4", name: "Ngã tư ĐHQG", lat: 10.8708, lng: 106.8012 },
      { id: "r03_5", name: "Khu Công nghệ Phần mềm", lat: 10.8657, lng: 106.8028 },
    ],
    path: densifyRoutePath([
      { lat: 10.8782, lng: 106.8066 },
      { lat: 10.8776, lng: 106.8064 },
      { lat: 10.8769, lng: 106.8061 },
      { lat: 10.8763, lng: 106.8059 },
      { lat: 10.8757, lng: 106.8058 },
      { lat: 10.8750, lng: 106.8054 },
      { lat: 10.8743, lng: 106.8051 },
      { lat: 10.8736, lng: 106.8047 },
      { lat: 10.8728, lng: 106.8042 },
      { lat: 10.8722, lng: 106.8038 },
      { lat: 10.8717, lng: 106.8033 },
      { lat: 10.8712, lng: 106.8026 },
      { lat: 10.8708, lng: 106.8012 },
      { lat: 10.8701, lng: 106.8004 },
      { lat: 10.8694, lng: 106.7998 },
      { lat: 10.8688, lng: 106.7991 },
      { lat: 10.8682, lng: 106.7995 },
      { lat: 10.8676, lng: 106.8001 },
      { lat: 10.8670, lng: 106.8008 },
      { lat: 10.8664, lng: 106.8015 },
      { lat: 10.8660, lng: 106.8021 },
      { lat: 10.8657, lng: 106.8028 },
    ]),
    schedule: ["05:45","06:15","06:45","07:15","07:45","08:15","15:45","16:15","16:45","17:15"],
  },
  {
    id: "route_04",
    name: "Tuyến 04",
    color: "#a855f7",
    stops: [
      { id: "r04_1", name: "Nguyễn Du", lat: 10.8810, lng: 106.8101 },
      { id: "r04_2", name: "Hồ Quốc Phòng", lat: 10.8778, lng: 106.8062 },
      { id: "r04_3", name: "KTX Khu A", lat: 10.8749, lng: 106.8074 },
      { id: "r04_4", name: "Suối Tiên", lat: 10.8703, lng: 106.8141 },
      { id: "r04_5", name: "Cổng Đông", lat: 10.8768, lng: 106.8173 },
    ],
    path: densifyRoutePath([
      { lat: 10.8810, lng: 106.8101 },
      { lat: 10.8804, lng: 106.8100 },
      { lat: 10.8797, lng: 106.8097 },
      { lat: 10.8789, lng: 106.8092 },
      { lat: 10.8783, lng: 106.8084 },
      { lat: 10.8778, lng: 106.8062 },
      { lat: 10.8772, lng: 106.8067 },
      { lat: 10.8765, lng: 106.8068 },
      { lat: 10.8757, lng: 106.8070 },
      { lat: 10.8749, lng: 106.8074 },
      { lat: 10.8739, lng: 106.8081 },
      { lat: 10.8730, lng: 106.8090 },
      { lat: 10.8722, lng: 106.8101 },
      { lat: 10.8716, lng: 106.8111 },
      { lat: 10.8710, lng: 106.8125 },
      { lat: 10.8703, lng: 106.8141 },
      { lat: 10.8718, lng: 106.8148 },
      { lat: 10.8734, lng: 106.8156 },
      { lat: 10.8751, lng: 106.8165 },
      { lat: 10.8768, lng: 106.8173 },
    ]),
    schedule: ["06:20","06:50","07:20","07:50","08:20","16:20","16:50","17:20","17:50"],
  },
];

const REALTIME_VEHICLE_ID = "bus_001";

const VIRTUAL_BUSES = [
  {
    id: "bus_002",
    name: "Xe 02",
    type: "bus",
    routeId: "route_02",
    lat: 10.8776,
    lng: 106.7991,
    speed: 28,
    irIn: 44,
    irOut: 13,
    passengers: 31,
    capacity: 60,
    status: "on_time",
    currentStop: "ĐHQG Trung tâm",
    nextStop: "Hồ Đá",
    isVirtual: true,
  },
  {
    id: "bus_003",
    name: "Xe 03",
    type: "bus",
    routeId: "route_03",
    lat: 10.8708,
    lng: 106.8012,
    speed: 18,
    irIn: 62,
    irOut: 14,
    passengers: 48,
    capacity: 60,
    status: "delayed",
    currentStop: "Ngã tư ĐHQG",
    nextStop: "Khu Công nghệ Phần mềm",
    isVirtual: true,
  },
  {
    id: "bus_004",
    name: "Xe 04",
    type: "bus",
    routeId: "route_04",
    lat: 10.8778,
    lng: 106.8062,
    speed: 24,
    irIn: 27,
    irOut: 8,
    passengers: 19,
    capacity: 50,
    status: "on_time",
    currentStop: "Hồ Quốc Phòng",
    nextStop: "KTX Khu A",
    isVirtual: true,
  },
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
window.REALTIME_VEHICLE_ID = REALTIME_VEHICLE_ID;
window.VIRTUAL_BUSES = VIRTUAL_BUSES;
window.detectRouteFromGPS = detectRouteFromGPS;
window.haversineDistance  = haversineDistance;
