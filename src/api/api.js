import axios from "axios";
import Swal from "sweetalert2";

// ======================================================
// 🌐 API URL
// ======================================================

// USER API
const USER_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8080/api"
    : "https://carevigoapi.onrender.com/api";

// ADMIN API
const ADMIN_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8080/api"
    : "https://carevigoapi.onrender.com/api";
// ex https://carevigoapi2026-969172408065.asia-southeast3.run.app/api
// 🔥 ถ้า path เป็น /admin → ใช้ ADMIN API
const isAdminRoute =
  window.location.pathname.startsWith(
    "/admin"
  );

const BASE_URL = isAdminRoute
  ? ADMIN_API
  : USER_API;

console.log("🌐 BASE URL:", BASE_URL);
console.log("🌐 ADMIN ROUTE:", isAdminRoute);

// ======================================================
// 🚀 AXIOS INSTANCE
// ======================================================
const API = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ======================================================
// 🔐 REQUEST INTERCEPTOR
// ======================================================
API.interceptors.request.use(
  (config) => {
    console.log(
      "📤 REQUEST:",
      config.method?.toUpperCase(),
      config.url
    );

    // ===============================
    // 🔑 ADMIN TOKEN
    // ===============================
    const adminToken =
      localStorage.getItem(
        "adminAccessToken"
      );

    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ======================================================
// 🚨 RESPONSE INTERCEPTOR
// ======================================================
API.interceptors.response.use(
  (response) => {
    console.log(
      "📥 RESPONSE:",
      response.status,
      response.config.url
    );

    return response;
  },
  (error) => {
    console.error("❌ API ERROR:", error);

    if (!error.response) {
      alert(
        "❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"
      );
    } else {
      const status = error.response.status;

      if (status === 400) {
        alert("❌ ข้อมูลไม่ถูกต้อง");
      } else if (status === 401) {
        alert("❌ Unauthorized");
      } else if (status === 403) {
        alert("❌ Forbidden");
      } else if (status === 404) {
        alert("❌ ไม่พบข้อมูล");
      } else if (status === 500) {
        alert("❌ Server Error");
      }
    }

    return Promise.reject(error);
  }
);

// ======================================================
// 👤 USER APIs
// ======================================================

// 🔍 search user
export const searchUser = (
  citizenId
) =>
  API.get("/users/search", {
    params: { citizenId },
  });

// ➕ create user
export const createUser = (data) =>
  API.post("/users", data);

// 👤 get profile
export const getProfile = (
  citizenId
) =>
  API.get(
    `/public/profile/${citizenId}`
  );

// ======================================================
// ❤️ HEALTH APIs
// ======================================================

// ➕ add health
export const addHealth = (data) =>
  API.post("/public/health", data);

// 📊 get health by type
export const getHealthByType = (
  citizenId,
  type
) =>
  API.get("/public/health", {
    params: {
      citizenId,
      type,
    },
  });

// ======================================================
// 🔐 ADMIN AUTH APIs
// ======================================================

// 📩 request otp
export const requestAdminOTP = (
  email
) =>
  API.post(
    "/auth/admin/request-otp",
    {
      email,
    }
  );

// 🔑 verify otp
export const verifyAdminOTP = (
  email,
  otp
) =>
  API.post(
    "/auth/admin/verify-otp",
    {
      email,
      otp,
    }
  );

// 🚪 logout
export const adminLogout = async () => {
  const result = await Swal.fire({
    title: "ออกจากระบบ ?",
    text: "คุณต้องการออกจากระบบใช่หรือไม่",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#16a34a",
    cancelButtonColor: "#d33",
    confirmButtonText: "ออกจากระบบ",
    cancelButtonText: "ยกเลิก",
    reverseButtons: true,
  });

  if (!result.isConfirmed) return;

  // remove token
  localStorage.removeItem(
    "adminAccessToken"
  );

  localStorage.removeItem(
    "adminRefreshToken"
  );

  localStorage.removeItem(
    "adminProfile"
  );

  await Swal.fire({
    icon: "success",
    title: "ออกจากระบบสำเร็จ",
    timer: 1200,
    showConfirmButton: false,
  });

  window.location.href =
    "/admin/login";
};

// ======================================================
// 📊 DASHBOARD APIs
// ======================================================

// 📈 summary
export const getDashboardSummary =
  () =>
    API.get(
      "/dashboard/summary"
    );

// 👥 users
export const getDashboardUsers =
  () =>
    API.get(
      "/dashboard/users"
    );

// ❤️ health
// ❤️ dashboard health (รองรับ pagination / load more)
export const getDashboardHealth = (
  page = 1,
  limit = 100
) =>
  API.get("/dashboard/health", {
    params: {
      page,
      limit,
    },
  });
// ⚠️ risk
export const getDashboardRisk =
  () =>
    API.get(
      "/dashboard/risk"
    );

// 🪪 verification
export const getDashboardVerification =
  () =>
    API.get(
      "/dashboard/verification"
    );

// 🖥 system
export const getDashboardSystem =
  () =>
    API.get(
      "/dashboard/system"
    );

// 🏥 chronic diseases
export const getChronicDiseases =
  () =>
    API.get(
      "/dashboard/chronic-diseases"
    );

// 🌍 provinces
export const getRiskProvinces =
  () =>
    API.get(
      "/dashboard/risk/provinces"
    );

// ======================================================
// 🔧 EXPORT
// ======================================================
export default API;
