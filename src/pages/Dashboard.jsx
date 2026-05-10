import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Bell,
  ShieldAlert,
  Activity,
  HeartPulse,
  Menu,
} from "lucide-react";

import API from "../api/api";

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [verification, setVerification] = useState(null);
  const [health, setHealth] = useState(null);

  const [loading, setLoading] = useState(true);

  const [activeMenu, setActiveMenu] =
    useState("dashboard");

  // ===============================
  // 📊 FETCH DASHBOARD
  // ===============================
  const fetchDashboard = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem(
        "adminAccessToken"
      );

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [
        summaryRes,
        verificationRes,
        healthRes,
      ] = await Promise.all([
        API.get("/dashboard/summary", {
          headers,
        }),
        API.get("/dashboard/verification", {
          headers,
        }),
        API.get("/dashboard/health", {
          headers,
        }),
      ]);

      setSummary(summaryRes.data.data);
      setVerification(
        verificationRes.data.data
      );
      setHealth(healthRes.data.data);

    } catch (err) {
      console.error(err);

      alert(
        err?.response?.data?.message ||
          "โหลด Dashboard ไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // 🚀 INIT
  // ===============================
  useEffect(() => {
    fetchDashboard();
  }, []);

  // ===============================
  // LOADING
  // ===============================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>

          <p className="mt-4 text-gray-600">
            กำลังโหลด Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* ===============================
          SIDEBAR
      =============================== */}
      <aside className="w-72 bg-white shadow-xl hidden md:flex flex-col">

        {/* LOGO */}
        <div className="h-24 border-b flex items-center px-6">

          <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
            S
          </div>

          <div className="ml-4">
            <h1 className="font-bold text-xl">
              Save Stroke
            </h1>

            <p className="text-sm text-gray-500">
              Admin Panel
            </p>
          </div>

        </div>

        {/* MENU */}
        <div className="flex-1 p-4 space-y-2">

          {/* DASHBOARD */}
          <button
            onClick={() =>
              setActiveMenu("dashboard")
            }
            className={`w-full flex items-center px-4 py-4 rounded-2xl transition-all ${
              activeMenu === "dashboard"
                ? "bg-green-600 text-white"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <LayoutDashboard size={20} />

            <span className="ml-3 font-medium">
              Dashboard
            </span>
          </button>

          {/* MEMBERS */}
          <button
            onClick={() =>
              setActiveMenu("members")
            }
            className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${
              activeMenu === "members"
                ? "bg-green-600 text-white"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <div className="flex items-center">
              <Users size={20} />

              <span className="ml-3 font-medium">
                Members
              </span>
            </div>

            {/* NOTI */}
            {verification?.pending > 0 && (
              <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {verification.pending}
              </div>
            )}
          </button>

          {/* VERIFICATION */}
          <button
            onClick={() =>
              setActiveMenu("verification")
            }
            className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${
              activeMenu === "verification"
                ? "bg-green-600 text-white"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <div className="flex items-center">
              <ShieldAlert size={20} />

              <span className="ml-3 font-medium">
                Verification Pending
              </span>
            </div>

            {verification?.pending > 0 && (
              <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {verification.pending}
              </div>
            )}
          </button>

        </div>

      </aside>

      {/* ===============================
          MAIN
      =============================== */}
      <main className="flex-1 p-6 overflow-auto">

        {/* MOBILE TOPBAR */}
        <div className="md:hidden flex items-center justify-between mb-6">

          <button className="w-12 h-12 bg-white rounded-2xl shadow flex items-center justify-center">
            <Menu />
          </button>

          <h1 className="text-xl font-bold">
            Save Stroke
          </h1>

          <button className="w-12 h-12 bg-white rounded-2xl shadow flex items-center justify-center relative">
            <Bell />

            {verification?.pending > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 rounded-full">
                {verification.pending}
              </span>
            )}
          </button>

        </div>

        {/* PAGE TITLE */}
        <div className="mb-8">

          <h1 className="text-3xl font-bold text-gray-800">
            Dashboard
          </h1>

          <p className="text-gray-500 mt-2">
            ภาพรวมระบบ Save Stroke
          </p>

        </div>

        {/* ===============================
            SUMMARY CARD
        =============================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

          {/* USERS */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-gray-500">
                  Total Members
                </p>

                <h2 className="text-4xl font-bold mt-2">
                  {summary?.totalUsers || 0}
                </h2>
              </div>

              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Users className="text-blue-600" />
              </div>

            </div>

          </div>

          {/* RECORDS */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-gray-500">
                  Health Records
                </p>

                <h2 className="text-4xl font-bold mt-2">
                  {summary?.totalHealthRecords ||
                    0}
                </h2>
              </div>

              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                <Activity className="text-green-600" />
              </div>

            </div>

          </div>

          {/* HIGH RISK */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-gray-500">
                  High Risk
                </p>

                <h2 className="text-4xl font-bold mt-2 text-red-500">
                  {summary?.highRiskUsers || 0}
                </h2>
              </div>

              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
                <HeartPulse className="text-red-600" />
              </div>

            </div>

          </div>

          {/* VERIFICATION */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-gray-500">
                  Verification Pending
                </p>

                <h2 className="text-4xl font-bold mt-2 text-orange-500">
                  {verification?.pending || 0}
                </h2>
              </div>

              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="text-orange-600" />
              </div>

            </div>

          </div>

        </div>

        {/* ===============================
            HEALTH SUMMARY
        =============================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

          {/* BLOOD PRESSURE */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <h3 className="font-bold text-lg">
              Blood Pressure
            </h3>

            <p className="text-5xl font-bold mt-6 text-blue-600">
              {health?.blood_pressure || 0}
            </p>

            <p className="text-gray-500 mt-2">
              records
            </p>

          </div>

          {/* SUGAR */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <h3 className="font-bold text-lg">
              Sugar
            </h3>

            <p className="text-5xl font-bold mt-6 text-green-600">
              {health?.sugar || 0}
            </p>

            <p className="text-gray-500 mt-2">
              records
            </p>

          </div>

          {/* CHOLESTEROL */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <h3 className="font-bold text-lg">
              Cholesterol
            </h3>

            <p className="text-5xl font-bold mt-6 text-red-600">
              {health?.cholesterol || 0}
            </p>

            <p className="text-gray-500 mt-2">
              records
            </p>

          </div>

        </div>

        {/* ===============================
            LATEST RECORDS
        =============================== */}
        <div className="bg-white rounded-3xl shadow overflow-hidden">

          <div className="p-6 border-b">

            <h2 className="text-2xl font-bold">
              Latest Health Records
            </h2>

            <p className="text-gray-500 mt-1">
              รายการล่าสุดในระบบ
            </p>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-gray-50">

                <tr>

                  <th className="text-left p-4">
                    Citizen ID
                  </th>

                  <th className="text-left p-4">
                    Type
                  </th>

                  <th className="text-left p-4">
                    BMI
                  </th>

                  <th className="text-left p-4">
                    Risk
                  </th>

                  <th className="text-left p-4">
                    Date
                  </th>

                </tr>

              </thead>

              <tbody>

                {health?.latestRecords?.map(
                  (item) => (
                    <tr
                      key={item._id}
                      className="border-t hover:bg-gray-50"
                    >

                      <td className="p-4 font-medium">
                        {item.citizenId}
                      </td>

                      <td className="p-4 capitalize">
                        {item.type}
                      </td>

                      <td className="p-4">
                        {item.bmi || "-"}
                      </td>

                      <td className="p-4">

                        <span className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-600">
                          {item?.cvdRisk?.label ||
                            "Normal"}
                        </span>

                      </td>

                      <td className="p-4 text-gray-500">
                        {new Date(
                          item.createdAt
                        ).toLocaleString()}
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

      </main>

    </div>
  );
}