// ============================================================
//  AUTH SERVICE - Chỉ có 1 tài khoản Admin
//  Demo: admin@iot.com / admin123
// ============================================================

class AuthService {
  constructor() {
    this.auth = null;
    this.init();
  }

  init() {
    if (window.APP_CONFIG.DEMO_MODE) return;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
      }
      this.auth = firebase.auth();
    } catch (e) {
      console.warn("⚠️ Firebase Auth init failed:", e.message);
    }
  }

  // ─── Đăng nhập ───────────────────────────────────────────
  async login(email, password) {
    if (window.APP_CONFIG.DEMO_MODE) {
      if (email === "admin@iot.com" && password === "admin123") {
        sessionStorage.setItem("is_admin", "true");
        return true;
      }
      return false;
    }
    try {
      if (!this.auth) return false;
      await this.auth.signInWithEmailAndPassword(email, password);
      sessionStorage.setItem("is_admin", "true");
      return true;
    } catch (e) {
      return false;
    }
  }

  // ─── Kiểm tra đã đăng nhập chưa ─────────────────────────
  isLoggedIn() {
    if (window.APP_CONFIG.DEMO_MODE) {
      return sessionStorage.getItem("is_admin") === "true";
    }
    return !!this.auth?.currentUser || sessionStorage.getItem("is_admin") === "true";
  }

  // ─── Chặn trang Admin — redirect về login nếu chưa đăng nhập
  requireAdmin() {
    if (window.APP_CONFIG.DEMO_MODE) {
      if (!this.isLoggedIn()) {
        window.location.href = "login.html";
      }
      return;
    }
    if (!this.auth) {
      if (!this.isLoggedIn()) window.location.href = "login.html";
      return;
    }
    this.auth.onAuthStateChanged((user) => {
      if (!user && !this.isLoggedIn()) {
        window.location.href = "login.html";
      }
    });
  }

  // ─── Đăng xuất ───────────────────────────────────────────
  logout() {
    sessionStorage.removeItem("is_admin");
    if (!window.APP_CONFIG.DEMO_MODE && this.auth) {
      this.auth.signOut();
    }
    window.location.href = "login.html";
  }
}

window.AppAuth = new AuthService();
