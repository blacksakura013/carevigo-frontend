import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";

import {
  requestAdminOTP,
  verifyAdminOTP,
} from "../api/api";

import logo from "../logo.svg";

export default function AdminLogin() {
  // ===============================
  // STATE
  // ===============================
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);

  // ===============================
  // 🔐 CHECK LOGIN
  // ===============================
  useEffect(() => {
    const token = localStorage.getItem(
      "adminAccessToken"
    );

    if (token) {
      window.location.href = "/admin";
    }
  }, []);

  // ===============================
  // 📩 REQUEST OTP
  // ===============================
  const handleRequestOTP = async () => {
    try {
      if (!email) {
        return Swal.fire({
          icon: "warning",
          title: "กรุณากรอก Email",
          text: "โปรดกรอก Email สำหรับรับ OTP",
          confirmButtonColor: "#16a34a",
        });
      }

      setLoading(true);

      const res = await requestAdminOTP(
        email
      );

      await Swal.fire({
        icon: "success",
        title: "ส่ง OTP สำเร็จ",
        text:
          res?.data?.message ||
          "OTP ถูกส่งไปยัง Email ของคุณแล้ว",
        confirmButtonColor: "#16a34a",
      });

      setStep(2);

    } catch (err) {
      console.error(err);

      Swal.fire({
        icon: "error",
        title: "ส่ง OTP ไม่สำเร็จ",
        text:
          err?.response?.data?.message ||
          "เกิดข้อผิดพลาด",
        confirmButtonColor: "#dc2626",
      });

    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // 🔐 VERIFY OTP
  // ===============================
  const handleVerifyOTP = async () => {
    try {
      if (!otp) {
        return Swal.fire({
          icon: "warning",
          title: "กรุณากรอก OTP",
          text: "โปรดกรอกรหัส OTP",
          confirmButtonColor: "#16a34a",
        });
      }

      setLoading(true);

      const res = await verifyAdminOTP(
        email,
        otp
      );

      const data = res?.data?.data;

      // ===============================
      // 💾 SAVE TOKEN
      // ===============================
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
        timer: 1500,
        showConfirmButton: false,
      });

      // ===============================
      // 🚀 REDIRECT
      // ===============================
      window.location.href = "/admin";

    } catch (err) {
      console.error(err);

      Swal.fire({
        icon: "error",
        title: "OTP ไม่ถูกต้อง",
        text:
          err?.response?.data?.message ||
          "กรุณาตรวจสอบ OTP อีกครั้ง",
        confirmButtonColor: "#dc2626",
      });

    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // UI
  // ===============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl p-8 border border-gray-100">

        {/* ===============================
            HEADER
        =============================== */}
        <div className="text-center mb-8">

          <div className="w-32 h-32 mx-auto flex items-center justify-center">

            <img
              src={logo}
              alt="Save Stroke Logo"
              className="w-32 h-32 object-contain"
            />

          </div>

          <h1 className="text-4xl font-bold text-gray-800 mt-4">
            Admin
          </h1>

          <p className="text-gray-500 mt-3 text-sm">
            ระบบจัดการผู้ดูแล Save Stroke
          </p>

        </div>

        {/* ===============================
            STEP 1
        =============================== */}
        {step === 1 && (
          <div className="space-y-6">

            {/* EMAIL */}
            <div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">

                Email

              </label>

              <input
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full border border-gray-300 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-green-500 transition-all"
              />

              <p className="text-sm text-gray-500 mt-2">
                ระบบจะส่ง OTP ไปยัง Email นี้
              </p>

            </div>

            {/* BUTTON */}
            <button
              onClick={handleRequestOTP}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-semibold transition-all shadow-lg disabled:opacity-50"
            >
              {loading
                ? "กำลังส่ง OTP..."
                : "ส่ง OTP"}
            </button>

          </div>
        )}

        {/* ===============================
            STEP 2
        =============================== */}
        {step === 2 && (
          <div className="space-y-6">

            {/* EMAIL INFO */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">

              <p className="text-sm text-green-700">
                OTP ถูกส่งไปยัง
              </p>

              <p className="font-bold text-green-900 mt-1 break-all">
                {email}
              </p>

            </div>

            {/* OTP */}
            <div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">

                OTP Code

              </label>

              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) =>
                  setOtp(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                maxLength={6}
                className="w-full border border-gray-300 rounded-2xl px-5 py-4 text-center text-3xl tracking-[10px] font-bold outline-none focus:ring-2 focus:ring-green-500 transition-all"
              />

              <p className="text-sm text-gray-500 mt-2">
                กรุณาตรวจสอบ Email ของคุณ
              </p>

            </div>

            {/* LOGIN BUTTON */}
            <button
              onClick={handleVerifyOTP}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-semibold transition-all shadow-lg disabled:opacity-50"
            >
              {loading
                ? "กำลังตรวจสอบ..."
                : "เข้าสู่ระบบ"}
            </button>

            {/* BACK */}
            <button
              onClick={() => setStep(1)}
              className="w-full border border-gray-300 hover:bg-gray-50 py-4 rounded-2xl font-medium text-gray-700 transition-all"
            >
              เปลี่ยน Email
            </button>

          </div>
        )}

      </div>

    </div>
  );
}