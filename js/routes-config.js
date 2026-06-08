// ============================================================
//  ROUTES CONFIG - Định nghĩa tuyến đường và trạm dừng thật
//  Đây là dữ liệu tuyến xe bus
//  Thêm/sửa tuyến đường tại đây khi thay đổi lộ trình thực tế
// ============================================================

const BUS_ROUTES = [
  {
    id: "route_02",
    name: "Tuyến 02",
    color: "#22c55e",
    stops: [
      { id: "r02_1", name: "KTX Khu A", lat: 10.8799, lng: 106.8069 },
      { id: "r02_2", name: "Hồ Đá", lat: 10.8794, lng: 106.8012 },
      { id: "r02_3", name: "ĐHQG Trung tâm", lat: 10.8760, lng: 106.7972 },
      { id: "r02_4", name: "UEL", lat: 10.8725, lng: 106.7898 },
      { id: "r02_5", name: "ĐH Bách Khoa", lat: 10.8802, lng: 106.7854 },
      { id: "r02_6", name: "Nhà văn hóa Sinh viên", lat: 10.8757, lng: 106.8058 },
    ],
    path: [
      { lat: 10.8799, lng: 106.8069 },
      { lat: 10.8790, lng: 106.8038 },
      { lat: 10.8794, lng: 106.8012 },
      { lat: 10.8776, lng: 106.7991 },
      { lat: 10.8760, lng: 106.7972 },
      { lat: 10.8741, lng: 106.7939 },
      { lat: 10.8725, lng: 106.7898 },
      { lat: 10.8756, lng: 106.7869 },
      { lat: 10.8802, lng: 106.7854 },
      { lat: 10.8788, lng: 106.7920 },
      { lat: 10.8757, lng: 106.8058 },
    ],
    schedule: ["06:10","06:40","07:10","07:40","08:10","08:40","16:10","16:40","17:10","17:40"],
  },
  {
    id: "route_03",
    name: "Tuyến 03",
    color: "#f59e0b",
    stops: [
      { id: "r03_1", name: "Hồ Đá", lat: 10.8793, lng: 106.8000 },
      { id: "r03_2", name: "Heart Lake", lat: 10.8755, lng: 106.8020 },
      { id: "r03_3", name: "Ngã tư ĐHQG", lat: 10.8708, lng: 106.8012 },
      { id: "r03_4", name: "Bến xe ĐHQG", lat: 10.8688, lng: 106.7970 },
      { id: "r03_5", name: "Khu Công nghệ Phần mềm", lat: 10.8657, lng: 106.8028 },
      { id: "r03_6", name: "ĐH Quốc tế", lat: 10.8782, lng: 106.8066 },
    ],
    path: [
      { lat: 10.8793, lng: 106.8000 },
      { lat: 10.8778, lng: 106.8010 },
      { lat: 10.8755, lng: 106.8020 },
      { lat: 10.8727, lng: 106.8018 },
      { lat: 10.8708, lng: 106.8012 },
      { lat: 10.8697, lng: 106.7990 },
      { lat: 10.8688, lng: 106.7970 },
      { lat: 10.8667, lng: 106.7996 },
      { lat: 10.8657, lng: 106.8028 },
      { lat: 10.8705, lng: 106.8050 },
      { lat: 10.8782, lng: 106.8066 },
    ],
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
      { id: "r04_4", name: "ĐH KHTN", lat: 10.8717, lng: 106.8033 },
      { id: "r04_5", name: "Suối Tiên", lat: 10.8703, lng: 106.8141 },
    ],
    path: [
      { lat: 10.8810, lng: 106.8101 },
      { lat: 10.8796, lng: 106.8087 },
      { lat: 10.8778, lng: 106.8062 },
      { lat: 10.8762, lng: 106.8069 },
      { lat: 10.8749, lng: 106.8074 },
      { lat: 10.8717, lng: 106.8033 },
      { lat: 10.8699, lng: 106.8079 },
      { lat: 10.8703, lng: 106.8141 },
    ],
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
    currentStop: "Hồ Đá",
    nextStop: "ĐHQG Trung tâm",
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
    nextStop: "Bến xe ĐHQG",
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
