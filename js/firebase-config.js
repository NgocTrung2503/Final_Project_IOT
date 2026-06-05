// ============================================================
//  FIREBASE CONFIGURATION
//  ► Điền thông tin của bạn vào đây
//  ► Lấy từ: Firebase Console → Project Settings → Your apps
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ============================================================
//  CHẾ ĐỘ HOẠT ĐỘNG
//  DEMO_MODE = true  → Dùng dữ liệu giả lập (không cần Firebase)
//  DEMO_MODE = false → Kết nối Firebase thật (điền config ở trên)
// ============================================================
const DEMO_MODE = true;

// ============================================================
//  MAP CENTER - Tâm bản đồ mặc định (TP. Hồ Chí Minh)
// ============================================================
const MAP_CENTER = [10.7769, 106.7009];
const MAP_ZOOM = 13;

// Export
window.APP_CONFIG = {
  firebaseConfig,
  DEMO_MODE,
  MAP_CENTER,
  MAP_ZOOM
};
