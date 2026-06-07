// ============================================================
//  AUTH SERVICE - Đăng nhập qua Firebase Authentication thật
//  Tạo tài khoản tại: Firebase Console → Authentication → Users
// ============================================================

class AuthService {
  constructor() {
    this.auth = null;
    this._ready = false;
    this.init();
  }

  init() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
      }
      this.auth = firebase.auth();
      this._ready = true;
      console.log("✅ Firebase Auth initialized");
    } catch (e) {
      console.warn("⚠️ Firebase Auth init failed:", e.message);
      this._ready = true;
    }
  }

  // ─── Đăng nhập ───────────────────────────────────────────
  async login(email, password) {
    // Firebase Authentication thật
    if (!this.auth) {
      return { success: false, msg: "Firebase chưa khởi động, thử lại!" };
    }
    try {
      await this.auth.signInWithEmailAndPassword(email, password);
      sessionStorage.setItem("is_admin", "true");
      return { success: true };
    } catch (e) {
      // Trả về thông báo lỗi rõ ràng
      let msg = "Đăng nhập thất bại!";
      if (e.code === "auth/user-not-found")      msg = "Email không tồn tại trong hệ thống!";
      if (e.code === "auth/wrong-password")       msg = "Mật khẩu không đúng!";
      if (e.code === "auth/invalid-email")        msg = "Email không hợp lệ!";
      if (e.code === "auth/too-many-requests")    msg = "Quá nhiều lần thử, thử lại sau!";
      if (e.code === "auth/invalid-credential")   msg = "Sai email hoặc mật khẩu!";
      if (e.code === "auth/network-request-failed") msg = "Lỗi mạng, kiểm tra kết nối internet!";
      console.error("Login error:", e.code, e.message);
      return { success: false, msg };
    }
  }

  // ─── Kiểm tra đã đăng nhập chưa ──────────────────────────
  isLoggedIn() {
    return sessionStorage.getItem("is_admin") === "true";
  }

  // ─── Chặn trang Admin ────────────────────────────────────
  requireAdmin() {
    // Kiểm tra sessionStorage trước (sync, không chờ Firebase)
    if (!sessionStorage.getItem("is_admin")) {
      // Chờ Firebase xác nhận
      if (!this.auth) {
        window.location.href = "login.html";
        return;
      }
      // Dùng onAuthStateChanged để kiểm tra Firebase session
      this.auth.onAuthStateChanged((user) => {
        if (!user) {
          window.location.href = "login.html";
        } else {
          // Cập nhật sessionStorage nếu Firebase vẫn còn session
          sessionStorage.setItem("is_admin", "true");
        }
      });
    }
  }

  // ─── Đăng xuất ───────────────────────────────────────────
  logout() {
    sessionStorage.removeItem("is_admin");
    if (this.auth) {
      this.auth.signOut();
    }
    window.location.href = "login.html";
  }
}

window.AppAuth = new AuthService();