import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

import Swal from "sweetalert2";

import {
  Activity,
  Heart,
  Droplets,
  Search,
  ChevronDown,
  RefreshCw,
  ChevronUp,
  Mars,
  Venus,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock3,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

import {
  getDashboardHealth,
  getDashboardVerification,
} from "../api/api";

import AdminSidebar from "../components/admin/AdminSidebar";

export default function AdminDashboard() {

  // ===============================
  // STATES
  // ===============================
  const [loading, setLoading] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [summary, setSummary] =
    useState({});

  const [verification, setVerification] =
    useState({});

  const [health, setHealth] =
    useState({
      records: [],
    });

  const [search, setSearch] =
    useState("");

  const [selectedType, setSelectedType] =
    useState("all");

  const [selectedStatus, setSelectedStatus] =
    useState("all");

  const [page, setPage] =
    useState(1);

  const [hasMore, setHasMore] =
    useState(true);

  const [activeMenu, setActiveMenu] =
    useState("dashboard");

  const [sortField, setSortField] =
    useState("createdAt");

  const [sortOrder, setSortOrder] =
    useState("desc");

  // ===============================
  // FETCH DASHBOARD
  // ===============================
  const fetchDashboard =
    useCallback(
      async (
        currentPage = 1,
        append = false,
        silent = false
      ) => {

        try {

          if (
            !append &&
            !silent
          ) {

            setLoading(true);

            Swal.fire({
              title:
                "Loading Dashboard",
              text:
                "Please wait...",
              allowOutsideClick:
                false,
              didOpen: () => {
                Swal.showLoading();
              },
            });
          }

          if (append) {
            setLoadingMore(true);
          }

          if (silent) {
            setRefreshing(true);
          }

          const [
            verificationRes,
            healthRes,
          ] = await Promise.all([
            getDashboardVerification(),

            getDashboardHealth(
              currentPage,
              100
            ),
          ]);

          setVerification(
            verificationRes?.data
              ?.data || {}
          );

          const responseData =
            healthRes?.data || {};

          const healthData =
            responseData?.data ||
            {};

          setSummary(
            healthData?.summary ||
              {}
          );

          const newRecords =
            healthData?.records ||
            [];

          if (append) {

            setHealth((prev) => ({
              ...prev,

              records: [
                ...new Map(
                  [
                    ...(prev?.records ||
                      []),

                    ...newRecords,
                  ].map((item) => [
                    item._id,
                    item,
                  ])
                ).values(),
              ],
            }));

          } else {

            setHealth({
              ...healthData,
              records:
                newRecords,
            });
          }

          setHasMore(
            responseData?.hasMore ||
              false
          );

        } catch (err) {

          console.error(err);

          Swal.fire({
            icon: "error",
            title:
              "โหลดข้อมูลไม่สำเร็จ",
            text:
              err?.response?.data
                ?.message ||
              "เกิดข้อผิดพลาด",
          });

        } finally {

          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);

          Swal.close();
        }
      },
      []
    );

  // ===============================
  // FIRST LOAD
  // ===============================
  useEffect(() => {

    fetchDashboard(1);

  }, [fetchDashboard]);

  // ===============================
  // AUTO REFRESH
  // ===============================
  useEffect(() => {

    const interval =
      setInterval(() => {

        fetchDashboard(
          1,
          false,
          true
        );

      }, 180000);

    return () =>
      clearInterval(interval);

  }, [fetchDashboard]);

  // ===============================
  // LOAD MORE
  // ===============================
  const handleLoadMore =
    async () => {

      if (
        loadingMore ||
        !hasMore
      ) {
        return;
      }

      const nextPage =
        page + 1;

      setPage(nextPage);

      await fetchDashboard(
        nextPage,
        true
      );
    };

  // ===============================
  // SORT
  // ===============================
  const handleSort =
    (field) => {

      if (
        sortField === field
      ) {

        setSortOrder(
          prev =>
            prev === "asc"
              ? "desc"
              : "asc"
        );

      } else {

        setSortField(field);

        setSortOrder("asc");
      }
    };

  // ===============================
  // ANALYZE HEALTH
  // ===============================
  const analyzeHealth =
    (item) => {

      if (!item) {

        return {
          status: "No Data",

          color:
            "bg-gray-100 text-gray-500",

          recommendation:
            "ไม่มีข้อมูล",

          icon:
            <Minus size={16} />,

          severity: 0,
        };
      }

      // =========================
      // BLOOD PRESSURE
      // =========================
      if (
        item.type ===
        "blood_pressure"
      ) {

        const sys =
          item?.value
            ?.systolic;

        const dia =
          item?.value
            ?.diastolic;

        if (
          sys >= 180 ||
          dia >= 120
        ) {

          return {
            status:
              "Critical",

            color:
              "bg-red-600 text-white",

            recommendation:
              "ควรพบแพทย์ทันที",

            icon:
              <AlertTriangle size={16} />,

            severity: 5,
          };
        }

        if (
          sys >= 140 ||
          dia >= 90
        ) {

          return {
            status:
              "High Risk",

            color:
              "bg-red-100 text-red-600",

            recommendation:
              "ลดเค็ม ออกกำลังกาย และพบแพทย์",

            icon:
              <TrendingUp size={16} />,

            severity: 4,
          };
        }

        if (
          sys >= 120 ||
          dia >= 80
        ) {

          return {
            status:
              "Warning",

            color:
              "bg-yellow-100 text-yellow-700",

            recommendation:
              "ควรควบคุมอาหาร",

            icon:
              <ShieldAlert size={16} />,

            severity: 3,
          };
        }

        if (
          sys < 90 ||
          dia < 60
        ) {

          return {
            status: "Low",

            color:
              "bg-blue-100 text-blue-600",

            recommendation:
              "พักผ่อนและดื่มน้ำ",

            icon:
              <TrendingDown size={16} />,

            severity: 2,
          };
        }

        return {
          status:
            "Normal",

          color:
            "bg-green-100 text-green-700",

          recommendation:
            "ค่าความดันปกติ",

          icon:
            <CheckCircle2 size={16} />,

          severity: 1,
        };
      }

      // =========================
      // SUGAR
      // =========================
      if (
        item.type ===
        "sugar"
      ) {

        const fbs =
          item?.value?.fbs;

        if (fbs >= 200) {

          return {
            status:
              "Critical",

            color:
              "bg-red-600 text-white",

            recommendation:
              "น้ำตาลสูงอันตราย",

            icon:
              <AlertTriangle size={16} />,

            severity: 5,
          };
        }

        if (fbs >= 126) {

          return {
            status:
              "Diabetes Risk",

            color:
              "bg-red-100 text-red-600",

            recommendation:
              "เสี่ยงเบาหวาน",

            icon:
              <TrendingUp size={16} />,

            severity: 4,
          };
        }

        if (fbs >= 100) {

          return {
            status:
              "Warning",

            color:
              "bg-yellow-100 text-yellow-700",

            recommendation:
              "ควรลดหวาน",

            icon:
              <ShieldAlert size={16} />,

            severity: 3,
          };
        }

        if (fbs < 70) {

          return {
            status:
              "Low",

            color:
              "bg-blue-100 text-blue-600",

            recommendation:
              "ควรรับประทานอาหาร",

            icon:
              <TrendingDown size={16} />,

            severity: 2,
          };
        }

        return {
          status:
            "Normal",

          color:
            "bg-green-100 text-green-700",

          recommendation:
            "ระดับน้ำตาลปกติ",

          icon:
            <CheckCircle2 size={16} />,

          severity: 1,
        };
      }

      // =========================
      // CHOLESTEROL
      // =========================
      if (
        item.type ===
        "cholesterol"
      ) {

        const total =
          item?.value
            ?.total;

        if (total >= 300) {

          return {
            status:
              "Critical",

            color:
              "bg-red-600 text-white",

            recommendation:
              "ไขมันสูงอันตราย",

            icon:
              <AlertTriangle size={16} />,

            severity: 5,
          };
        }

        if (total >= 240) {

          return {
            status:
              "High Risk",

            color:
              "bg-red-100 text-red-600",

            recommendation:
              "ควรลดของทอดและออกกำลังกาย",

            icon:
              <TrendingUp size={16} />,

            severity: 4,
          };
        }

        if (total >= 200) {

          return {
            status:
              "Warning",

            color:
              "bg-yellow-100 text-yellow-700",

            recommendation:
              "เริ่มมีความเสี่ยง",

            icon:
              <ShieldAlert size={16} />,

            severity: 3,
          };
        }

        return {
          status:
            "Normal",

          color:
            "bg-green-100 text-green-700",

          recommendation:
            "ระดับไขมันปกติ",

          icon:
            <CheckCircle2 size={16} />,

          severity: 1,
        };
      }

      return {
        status: "-",

        color:
          "bg-gray-100 text-gray-500",

        recommendation:
          "-",

        icon:
          <Minus size={16} />,

        severity: 0,
      };
    };

  // ===============================
  // FILTERED RECORDS
  // ===============================
  const filteredRecords =
    useMemo(() => {

      let records =
        health?.records?.filter(
          (item) => {

            const fullName =
              `${item?.user?.firstName || ""} ${item?.user?.lastName || ""}`;

            const analysis =
              analyzeHealth(
                item
              );

            const matchSearch =
              fullName
                .toLowerCase()
                .includes(
                  search.toLowerCase()
                ) ||

              item?.user?.citizenId
                ?.includes(
                  search
                ) ||

              item?.user?.province
                ?.toLowerCase()
                ?.includes(
                  search.toLowerCase()
                );

            const matchType =
              selectedType ===
                "all" ||
              item?.type ===
                selectedType;

            const matchStatus =
              selectedStatus ===
                "all" ||
              analysis.status ===
                selectedStatus;

            return (
              matchSearch &&
              matchType &&
              matchStatus
            );
          }
        ) || [];

      // ===============================
      // SORT
      // ===============================
      records.sort(
        (a, b) => {

          if (
            sortField ===
            "severity"
          ) {

            return (
              analyzeHealth(
                b
              ).severity -
              analyzeHealth(
                a
              ).severity
            );
          }

          let valueA;
          let valueB;

          switch (
            sortField
          ) {

            case "name":
              valueA =
                `${a?.user?.firstName || ""}`;

              valueB =
                `${b?.user?.firstName || ""}`;
              break;

            case "createdAt":
              valueA = new Date(
                a.createdAt
              );

              valueB = new Date(
                b.createdAt
              );
              break;

            default:
              valueA =
                a.createdAt;

              valueB =
                b.createdAt;
          }

          if (
            sortOrder === "asc"
          ) {

            return valueA >
              valueB
              ? 1
              : -1;
          }

          return valueA <
            valueB
            ? 1
            : -1;
        }
      );

      return records;

    }, [
      health,
      search,
      selectedType,
      selectedStatus,
      sortField,
      sortOrder,
    ]);

  // ===============================
  // TYPE LABEL
  // ===============================
  const getTypeLabel =
    (type) => {

      switch (type) {

        case "blood_pressure":
          return "Blood Pressure";

        case "sugar":
          return "Sugar";

        case "cholesterol":
          return "Cholesterol";

        default:
          return type;
      }
    };

  // ===============================
  // VALUE
  // ===============================
  const renderValue =
    (item) => {

      switch (item?.type) {

        case "blood_pressure":
          return (
            <>
              {
                item?.value
                  ?.systolic
              }
              /
              {
                item?.value
                  ?.diastolic
              }
              {" "}
              mmHg
            </>
          );

        case "sugar":
          return (
            <>
              FBS:{" "}
              {
                item?.value
                  ?.fbs
              }
            </>
          );

        case "cholesterol":
          return (
            <>
              Total:{" "}
              {
                item?.value
                  ?.total
              }
            </>
          );

        default:
          return "-";
      }
    };

  // ===============================
  // LOADING
  // ===============================
  if (loading) {

    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">

        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600" />

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* SIDEBAR */}
      <AdminSidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        verification={verification}
      />

      {/* MAIN */}
      <main className="flex-1 overflow-auto">

        <div className="p-6">

          {/* HEADER */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">

            <div>

              <h1 className="text-3xl font-bold text-gray-800">
                Health Dashboard
              </h1>

              <p className="text-gray-500 mt-2">
                Real-time health monitoring system
              </p>

            </div>

            <div className="flex items-center gap-3 mt-4 lg:mt-0">

              {refreshing && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                  Refreshing...
                </div>
              )}

              <button
                onClick={() =>
                  fetchDashboard(
                    1
                  )
                }
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-2xl font-medium transition-all flex items-center gap-2"
              >

                <RefreshCw size={18} />

                Refresh

              </button>

            </div>

          </div>

          {/* SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">

            <SummaryCard
              title="Blood Pressure"
              value={
                summary?.blood_pressure ||
                0
              }
              icon={
                <Heart className="text-red-500" />
              }
              bg="bg-red-100"
            />

            <SummaryCard
              title="Sugar"
              value={
                summary?.sugar ||
                0
              }
              icon={
                <Droplets className="text-blue-500" />
              }
              bg="bg-blue-100"
            />

            <SummaryCard
              title="Cholesterol"
              value={
                summary?.cholesterol ||
                0
              }
              icon={
                <Activity className="text-yellow-500" />
              }
              bg="bg-yellow-100"
            />

            <SummaryCard
              title="Verification"
              value={
                verification?.pending ||
                0
              }
              icon={
                <ShieldAlert className="text-purple-500" />
              }
              bg="bg-purple-100"
            />

          </div>

          {/* FILTER */}
          <div className="bg-white rounded-3xl p-6 shadow-sm mb-6">

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

              {/* SEARCH */}
              <div className="relative lg:col-span-2">

                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />

                <input
                  type="text"
                  placeholder="Search name, citizen ID, province..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                />

              </div>

              {/* TYPE */}
              <select
                value={selectedType}
                onChange={(e) =>
                  setSelectedType(
                    e.target.value
                  )
                }
                className="px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >

                <option value="all">
                  All Types
                </option>

                <option value="blood_pressure">
                  Blood Pressure
                </option>

                <option value="sugar">
                  Sugar
                </option>

                <option value="cholesterol">
                  Cholesterol
                </option>

              </select>

              {/* STATUS */}
              <select
                value={
                  selectedStatus
                }
                onChange={(e) =>
                  setSelectedStatus(
                    e.target.value
                  )
                }
                className="px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >

                <option value="all">
                  All Status
                </option>

                <option value="Critical">
                  Critical
                </option>

                <option value="High Risk">
                  High Risk
                </option>

                <option value="Warning">
                  Warning
                </option>

                <option value="Normal">
                  Normal
                </option>

                <option value="Low">
                  Low
                </option>

              </select>

            </div>

          </div>

          {/* TABLE */}
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1400px]">

                <thead className="bg-gray-50 border-b">

                  <tr>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      User
                    </th>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      Type
                    </th>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      Value
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "severity"
                        )
                      }
                      className="text-left p-5 font-semibold text-gray-600 cursor-pointer"
                    >

                      <div className="flex items-center gap-2">

                        Status

                        <ChevronDown size={16} />

                      </div>

                    </th>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      Recommendation
                    </th>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      BMI
                    </th>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      Province
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "createdAt"
                        )
                      }
                      className="text-left p-5 font-semibold text-gray-600 cursor-pointer"
                    >

                      <div className="flex items-center gap-2">

                        Date

                        {sortOrder ===
                        "asc" ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}

                      </div>

                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredRecords.map(
                    (item) => {

                      const analysis =
                        analyzeHealth(
                          item
                        );

                      return (

                        <tr
                          key={
                            item._id
                          }
                          className="border-b hover:bg-gray-50 transition-all"
                        >

                          {/* USER */}
                          <td className="p-5">

                            <div className="flex items-center gap-4">

                              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">

                                {item?.user
                                  ?.gender ===
                                "male" ? (

                                  <Mars className="text-blue-500" />

                                ) : (

                                  <Venus className="text-pink-500" />

                                )}

                              </div>

                              <div>

                                <div className="font-semibold text-gray-800">
                                  {
                                    item
                                      ?.user
                                      ?.firstName
                                  }{" "}
                                  {
                                    item
                                      ?.user
                                      ?.lastName
                                  }
                                </div>

                                <div className="text-sm text-gray-500 mt-1">
                                  {
                                    item
                                      ?.user
                                      ?.citizenId
                                  }
                                </div>

                              </div>

                            </div>

                          </td>

                          {/* TYPE */}
                          <td className="p-5">

                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">

                              {
                                getTypeLabel(
                                  item?.type
                                )
                              }

                            </span>

                          </td>

                          {/* VALUE */}
                          <td className="p-5 font-semibold text-gray-800">

                            {
                              renderValue(
                                item
                              )
                            }

                          </td>

                          {/* STATUS */}
                          <td className="p-5">

                            <div
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${analysis.color}`}
                            >

                              {
                                analysis.icon
                              }

                              {
                                analysis.status
                              }

                            </div>

                          </td>

                          {/* RECOMMEND */}
                          <td className="p-5 max-w-xs">

                            <p className="text-sm text-gray-600 leading-relaxed">
                              {
                                analysis.recommendation
                              }
                            </p>

                          </td>

                          {/* BMI */}
                          <td className="p-5">

                            {item?.bmi ? (

                              <div className="font-semibold text-gray-800">
                                {
                                  item.bmi
                                }
                              </div>

                            ) : (
                              "-"
                            )}

                          </td>

                          {/* PROVINCE */}
                          <td className="p-5 text-gray-600">

                            {
                              item?.user
                                ?.province ||
                              "-"
                            }

                          </td>

                          {/* DATE */}
                          <td className="p-5">

                            <div className="flex items-center gap-2 text-sm text-gray-500">

                              <Clock3 size={14} />

                              {new Date(
                                item?.createdAt
                              ).toLocaleString(
                                "th-TH"
                              )}

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

            {/* LOAD MORE */}
            {hasMore && (

              <div className="p-6 border-t flex justify-center">

                <button
                  onClick={
                    handleLoadMore
                  }
                  disabled={
                    loadingMore
                  }
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-medium transition-all"
                >

                  {loadingMore
                    ? "Loading..."
                    : "Load More"}

                </button>

              </div>
            )}

          </div>

        </div>

      </main>

    </div>
  );
}

// ===============================
// SUMMARY CARD
// ===============================
function SummaryCard({
  title,
  value,
  icon,
  bg,
}) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-gray-500 text-sm">
            {title}
          </p>

          <h2 className="text-4xl font-bold mt-3">
            {value}
          </h2>

        </div>

        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${bg}`}
        >

          {icon}

        </div>

      </div>

    </div>
  );
}