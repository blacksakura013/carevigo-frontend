import React from "react";

import { LayoutDashboard, Users, ShieldAlert, LogOut } from "lucide-react";

import { adminLogout } from "../../api/api";
import logo from "../../logo.svg";
export default function AdminSidebar({
  activeMenu,
  setActiveMenu,
  verification,
}) {
  return (
    <aside className="w-72 h-screen sticky top-0 bg-white shadow-xl hidden md:flex flex-col border-r">
      {/* ===============================
          LOGO
      =============================== */}
      <div className="h-24 min-h-[96px] border-b flex items-center px-6">
        <img
          src={logo}
          alt="Save Stroke Logo"
          className="w-12 h-12 object-contain"
        />

        <div className="ml-4">
          <h1 className="font-bold text-xl">Save Stroke</h1>

          <p className="text-sm text-gray-500">Admin Panel</p>
        </div>
      </div>

      {/* ===============================
          MENU
      =============================== */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* DASHBOARD */}
        <button
          onClick={() => setActiveMenu("dashboard")}
          className={`w-full flex items-center px-4 py-4 rounded-2xl transition-all ${
            activeMenu === "dashboard"
              ? "bg-green-600 text-white shadow-lg"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          <LayoutDashboard size={20} />

          <span className="ml-3 font-medium">Dashboard</span>
        </button>

        {/* MEMBERS */}
        <button
          onClick={() => setActiveMenu("members")}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${
            activeMenu === "members"
              ? "bg-green-600 text-white shadow-lg"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          <div className="flex items-center">
            <Users size={20} />

            <span className="ml-3 font-medium">Members</span>
          </div>

          {verification?.pending > 0 && (
            <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
              {verification.pending}
            </div>
          )}
        </button>

        {/* VERIFICATION */}
        <button
          onClick={() => setActiveMenu("verification")}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${
            activeMenu === "verification"
              ? "bg-green-600 text-white shadow-lg"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          <div className="flex items-center">
            <ShieldAlert size={20} />

            <span className="ml-3 font-medium">Verification</span>
          </div>

          {verification?.pending > 0 && (
            <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
              {verification.pending}
            </div>
          )}
        </button>
      </div>

      {/* ===============================
          FOOTER
      =============================== */}
      <div className="p-4 border-t bg-white">
        <button
          onClick={adminLogout}
          className="w-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-semibold transition-all"
        >
          <LogOut size={18} />

          <span className="ml-2">Logout</span>
        </button>
      </div>
    </aside>
  );
}
