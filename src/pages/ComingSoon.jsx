import React from "react";
import { useNavigate } from "react-router-dom";

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-6">

      {/* 🔧 ICON */}
      <div className="text-7xl mb-6">
        🚧
      </div>

      {/* 📝 TITLE */}
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        ยังไม่พร้อมใช้งาน
      </h1>

      {/* 📄 DESCRIPTION */}
      <p className="text-gray-500 mb-6 max-w-sm">
        ระบบกำลังอยู่ในระหว่างการพัฒนาและปรับปรุง
        กรุณารอการอัปเดตในเร็ว ๆ นี้
      </p>

      {/* 🔙 BUTTON */}
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-green-600 text-white rounded-xl shadow hover:bg-green-700 transition"
      >
        เพิ่มข้อมูลผู้ใช้
      </button>

    </div>
  );
}