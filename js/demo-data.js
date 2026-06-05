// ============================================================
//  DEMO DATA - Dữ liệu giả lập cho chế độ Demo
//  Mô phỏng xe buýt và tàu di chuyển theo tuyến TP.HCM
// ============================================================

const DEMO_ROUTES = [
  {
    id: "route_01",
    name: "Tuyến 01 - Bến Thành → Chợ Lớn",
    type: "bus",
    color: "#00d4ff",
    stops: [
      { id: "s01_1", name: "Bến Thành", lat: 10.7734, lng: 106.6980 },
      { id: "s01_2", name: "Phạm Ngũ Lão", lat: 10.7694, lng: 106.6943 },
      { id: "s01_3", name: "Nguyễn Trãi", lat: 10.7649, lng: 106.6872 },
      { id: "s01_4", name: "Trần Hưng Đạo B", lat: 10.7598, lng: 106.6807 },
      { id: "s01_5", name: "Chợ Lớn", lat: 10.7551, lng: 106.6638 },
    ],
    schedule: ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "14:00", "14:30", "17:00", "17:30", "18:00"],
  },
];

const DEMO_VEHICLES_INIT = [
  { id: "bus_001", type: "bus", routeId: "route_01", name: "Xe Bus IoT (Test)", stopIndex: 0, progress: 0, direction: 1, status: "on_time", passengers: 10, capacity: 80, speed: 28, fireAlert: false },
];

class DemoDataSimulator {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.vehicles = JSON.parse(JSON.stringify(DEMO_VEHICLES_INIT));
    this.running = false;
    this.interval = null;
  }

  getRouteById(id) {
    return DEMO_ROUTES.find(r => r.id === id);
  }

  interpolate(lat1, lng1, lat2, lng2, t) {
    return {
      lat: lat1 + (lat2 - lat1) * t,
      lng: lng1 + (lng2 - lng1) * t,
    };
  }

  getVehiclePosition(vehicle) {
    const route = this.getRouteById(vehicle.routeId);
    if (!route) return { lat: MAP_CENTER[0], lng: MAP_CENTER[1] };

    const stops = route.stops;
    const idx = vehicle.stopIndex;
    const nextIdx = idx + vehicle.direction;

    if (nextIdx < 0 || nextIdx >= stops.length) {
      return { lat: stops[idx].lat, lng: stops[idx].lng };
    }

    const from = stops[idx];
    const to = stops[nextIdx];
    return this.interpolate(from.lat, from.lng, to.lat, to.lng, vehicle.progress);
  }

  tick() {
    this.vehicles.forEach(v => {
      const route = this.getRouteById(v.routeId);
      if (!route) return;
      const stops = route.stops;

      const speedFactor = v.speed / 60 / 60 * 3;
      v.progress += speedFactor * (0.8 + Math.random() * 0.4);

      if (v.progress >= 1) {
        v.progress = 0;
        let nextIndex = v.stopIndex + v.direction;
        
        // Smart AI: Skip stop logic (randomize wait list)
        if (nextIndex > 0 && nextIndex < stops.length - 1) {
          const waitingPeople = Math.floor(Math.random() * 10);
          if (waitingPeople === 0 && v.passengers < v.capacity * 0.8) {
            // Skip the stop
            const stopName = stops[nextIndex].name;
            document.dispatchEvent(new CustomEvent("smart-ai-decision", { detail: {
              action: "skip",
              icon: "⏭️",
              title: "Bỏ qua trạm",
              msg: `Xe ${v.name} bỏ qua trạm ${stopName} do không có người chờ.`,
              time: new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"})
            }}));
            nextIndex += v.direction; // skip to next
          }
        }
        
        v.stopIndex = nextIndex;

        // Check bounds and reverse direction
        if (v.stopIndex >= stops.length - 1) {
          v.direction = -1;
          v.stopIndex = stops.length - 1;
          
          // Smart AI: Dynamic Scheduling logic check at end of trip
          if (v.passengers < 15) {
            document.dispatchEvent(new CustomEvent("smart-ai-decision", { detail: {
              action: "schedule",
              icon: "⏱️",
              title: "Giãn thời gian chuyến",
              msg: `Tuyến vắng khách, tự động tăng giãn cách chuyến lên 30 phút.`,
              time: new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"})
            }}));
          }
        } else if (v.stopIndex <= 0) {
          v.direction = 1;
          v.stopIndex = 0;
        }
      }

      // Slight speed variation
      v.speed = Math.max(10, Math.min(45,
        v.speed + (Math.random() - 0.5) * 3));

      // Passenger fluctuation at stops
      if (v.progress < 0.05) {
        v.passengers = Math.max(0, Math.min(v.capacity,
          v.passengers + Math.floor((Math.random() - 0.3) * 10)));
      }

      // Demo MQ2 fire alert: flashes for 6 seconds every 30 seconds.
      v.fireAlert = (Math.floor(Date.now() / 1000) % 30) >= 18 &&
        (Math.floor(Date.now() / 1000) % 30) <= 24;

      const pos = this.getVehiclePosition(v);
      const nextStopIdx = Math.min(v.stopIndex + Math.max(v.direction, 0), stops.length - 1);
      const nextStop = stops[nextStopIdx];
      const currentStop = stops[v.stopIndex];

      v._computed = {
        lat: pos.lat,
        lng: pos.lng,
        nextStop: nextStop ? nextStop.name : currentStop.name,
        currentStop: currentStop.name,
        route: route.name,
        routeColor: route.color,
        lastUpdated: Date.now(),
      };
    });

    this.onUpdate(this.vehicles.map(v => ({
      ...v,
      ...(v._computed || {}),
    })));
  }

  start() {
    this.running = true;
    this.tick();
    this.interval = setInterval(() => this.tick(), 2500);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
  }
}

window.DEMO_ROUTES = DEMO_ROUTES;
window.DemoDataSimulator = DemoDataSimulator;
