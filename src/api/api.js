import axios from "axios";

// ===============================
// 🌐 BASE URL (fix ปัญหา network error)
// ===============================
const BASE_URL =
  process.env.REACT_APP_API_URL || "https://carevigoapi.onrender.com/api";

console.log("🌐 API BASE URL:", BASE_URL);

// ===============================
// 🚀 AXIOS INSTANCE
// ===============================
const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ===============================
// 🔐 REQUEST INTERCEPTOR
// ===============================
API.interceptors.request.use(
  (config) => {
    console.log("📤 REQUEST:", config.method?.toUpperCase(), config.url);

    // future: token
    // const token = localStorage.getItem("token");
    // if (token) config.headers.Authorization = `Bearer ${token}`;

    return config;
  },
  (error) => Promise.reject(error)
);

// ===============================
// 🚨 RESPONSE INTERCEPTOR
// ===============================
API.interceptors.response.use(
  (response) => {
    console.log("📥 RESPONSE:", response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error("❌ API ERROR:", error);

    // 🔥 network error (ตัวที่คุณเจอ)
    if (!error.response) {
      alert("❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } else {
      const status = error.response.status;

      if (status === 400) alert("❌ ข้อมูลไม่ถูกต้อง");
      else if (status === 401) alert("❌ Unauthorized");
      else if (status === 404) alert("❌ ไม่พบข้อมูล");
      else if (status === 500) alert("❌ Server error");
    }

    return Promise.reject(error);
  }
);

// ===============================
// 👤 USER APIs
// ===============================

// 🔍 search user
export const searchUser = (citizenId) =>
  API.get("/users/search", {
    params: { citizenId },
  });

// ➕ create user
export const createUser = (data) =>
  API.post("/users", data);

// 👤 get profile (รวม health)
export const getProfile = (citizenId) =>
  API.get(`/public/profile/${citizenId}`);

// ===============================
// ❤️ HEALTH APIs
// ===============================

// ➕ add health
export const addHealth = (data) =>
  API.post("/public/health", data);

// 📊 get health by type
export const getHealthByType = (citizenId, type) =>
  API.get("/public/health", {
    params: { citizenId, type },
  });

// ===============================
// 🔧 EXPORT
// ===============================
export default API;