// ======================================
// src/components/admin/AdminSidebar.jsx
// ======================================

import React from "react";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  LogOut,
} from "lucide-react";

import { adminLogout } from "../../api/api";
import logo from "../../logo.svg";

export default function AdminSidebar({
  activeMenu,
  setActiveMenu,
  verification,
}) {
  return (
    <aside className="w-72 bg-white border-r flex flex-col h-screen">

      {/* ======================================
          LOGO
      ====================================== */}
      <div className="flex items-center p-6 border-b">

        <img
          src={logo}
          alt="Save Stroke"
          className="w-14 h-14 object-contain"
        />

        <div className="ml-4">
          <h1 className="text-xl font-bold text-gray-800">
            CareVigo
          </h1>

          <p className="text-sm text-gray-500">
            Admin Panel
          </p>
        </div>

      </div>

      {/* ======================================
          MENU
      ====================================== */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">

        <button
          onClick={() => setActiveMenu("dashboard")}
          className={`w-full flex items-center px-4 py-4 rounded-2xl transition ${
            activeMenu === "dashboard"
              ? "bg-green-600 text-white shadow-lg"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <LayoutDashboard size={20} />

          <span className="ml-3 font-medium">
            Dashboard
          </span>
        </button>

        <button
          onClick={() => setActiveMenu("members")}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition ${
            activeMenu === "members"
              ? "bg-green-600 text-white shadow-lg"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center">
            <Users size={20} />

            <span className="ml-3 font-medium">
              Members
            </span>
          </div>

          {verification?.pending > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {verification.pending}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveMenu("verification")}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition ${
            activeMenu === "verification"
              ? "bg-green-600 text-white shadow-lg"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center">
            <ShieldAlert size={20} />

            <span className="ml-3 font-medium">
              Verification
            </span>
          </div>

          {verification?.pending > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {verification.pending}
            </span>
          )}
        </button>

      </div>

      {/* ======================================
          ADMIN INFO
      ====================================== */}

      <div className="px-5 py-4 border-t">

        {(() => {
          const profile = JSON.parse(
            localStorage.getItem("adminProfile") || "{}"
          );

          return (
            <>
              <p className="text-sm text-gray-500">
                Logged in
              </p>

              <p className="font-semibold text-gray-800 break-all">
                {profile.email}
              </p>

              <p className="text-xs text-green-600 uppercase mt-1">
                {profile.role}
              </p>
            </>
          );
        })()}

      </div>

      {/* ======================================
          LOGOUT
      ====================================== */}

      <div className="p-4 border-t">

        <button
          onClick={adminLogout}
          className="w-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-semibold transition"
        >
          <LogOut size={18} />

          <span className="ml-2">
            Logout
          </span>
        </button>

      </div>

    </aside>
  );
}