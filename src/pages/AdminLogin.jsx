// ======================================
// src/pages/AdminLogin.jsx
// ======================================

import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";

import { adminLogin } from "../api/api";

import logo from "../logo.svg";

export default function AdminLogin() {
  // ======================================
  // STATE
  // ======================================
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // ======================================
  // CHECK LOGIN
  // ======================================
  useEffect(() => {
    const token = localStorage.getItem("adminAccessToken");

    if (token) {
      window.location.href = "/admin";
    }
  }, []);

  // ======================================
  // LOGIN
  // ======================================
  const handleLogin = async () => {
    try {
      if (!email.trim()) {
        return Swal.fire({
          icon: "warning",
          title: "กรุณากรอก Email",
          confirmButtonColor: "#16a34a",
        });
      }

      if (!password) {
        return Swal.fire({
          icon: "warning",
          title: "กรุณากรอกรหัสผ่าน",
          confirmButtonColor: "#16a34a",
        });
      }

      setLoading(true);

      const res = await adminLogin(
        email.trim().toLowerCase(),
        password
      );

      const data = res.data.data;

      localStorage.setItem(
        "adminAccessToken",
        data.accessToken
      );

      localStorage.setItem(
        "adminRefreshToken",
        data.refreshToken
      );

      localStorage.setItem(
        "adminProfile",
        JSON.stringify(data.admin)
      );

      await Swal.fire({
        icon: "success",
        title: "เข้าสู่ระบบสำเร็จ",
        text: "กำลังเข้าสู่ระบบ...",
        timer: 1200,
        showConfirmButton: false,
      });

      window.location.href = "/admin";

    } catch (err) {
      console.error(err);

      Swal.fire({
        icon: "error",
        title: "เข้าสู่ระบบไม่สำเร็จ",
        text:
          err?.response?.data?.message ||
          "Email หรือ Password ไม่ถูกต้อง",
        confirmButtonColor: "#dc2626",
      });

    } finally {
      setLoading(false);
    }
  };

  // ======================================
  // ENTER LOGIN
  // ======================================
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  // ======================================
  // UI
  // ======================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-white to-green-50 flex items-center justify-center p-6">

      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-gray-100 p-8">

        {/* HEADER */}
        <div className="text-center mb-8">

          <div className="flex justify-center">

            <img
              src={logo}
              alt="Save Stroke"
              className="w-28 h-28 object-contain"
            />

          </div>

          <h1 className="text-4xl font-bold text-gray-800 mt-4">
            Admin Login
          </h1>

          <p className="text-gray-500 mt-2">
            Save Stroke Management System
          </p>

        </div>

        {/* EMAIL */}
        <div className="mb-5">

          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Email
          </label>

          <input
            type="email"
            placeholder="admin@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:ring-2 focus:ring-green-500 transition"
          />

        </div>

        {/* PASSWORD */}
        <div className="mb-8">

          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Password
          </label>

          <input
            type="password"
            placeholder="********"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:ring-2 focus:ring-green-500 transition"
          />

        </div>

        {/* LOGIN BUTTON */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white py-4 rounded-2xl font-semibold shadow-lg transition"
        >
          {loading
            ? "กำลังเข้าสู่ระบบ..."
            : "เข้าสู่ระบบ"}
        </button>

      </div>

    </div>
  );
}