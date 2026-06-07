// ============================================================
//  FIREBASE CONFIGURATION
//  ► Điền thông tin của bạn vào đây
//  ► Lấy từ: Firebase Console → Project Settings → Your apps
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAg8GDtbWPhLOp2BfQQTyx_Snxfc2LR3jI",
  authDomain: "projectiot-final.firebaseapp.com",
  databaseURL: "https://projectiot-final-default-rtdb.firebaseio.com",
  projectId: "projectiot-final",
  storageBucket: "projectiot-final.firebasestorage.app",
  messagingSenderId: "426705295692",
  appId: "1:426705295692:web:d65aff9da0a4dbdca097e9",
  measurementId: "G-G73BMC0XKW"
};

// ============================================================
//  MAP CENTER - Tâm bản đồ mặc định (TP. Hồ Chí Minh)
// ============================================================
const MAP_CENTER = [10.7769, 106.7009];
const MAP_ZOOM = 13;

// Export
window.APP_CONFIG = {
  firebaseConfig,
  MAP_CENTER,
  MAP_ZOOM
};
