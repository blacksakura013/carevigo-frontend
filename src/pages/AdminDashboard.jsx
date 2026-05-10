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
  ArrowUpDown,
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

          // ===============================
          // API
          // ===============================
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

          // ===============================
          // VERIFICATION
          // ===============================
          setVerification(
            verificationRes?.data
              ?.data || {}
          );

          // ===============================
          // HEALTH
          // ===============================
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
  // FILTER + SEARCH + SORT
  // ===============================
  const filteredRecords =
    useMemo(() => {

      let records =
        health?.records?.filter(
          (item) => {

            const fullName =
              `${item?.user?.firstName || ""} ${item?.user?.lastName || ""}`;

            const matchSearch =
              fullName
                .toLowerCase()
                .includes(
                  search.toLowerCase()
                ) ||

              item?.user?.citizenId
                ?.toLowerCase()
                ?.includes(
                  search.toLowerCase()
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

            return (
              matchSearch &&
              matchType
            );
          }
        ) || [];

      // ===============================
      // SORT
      // ===============================
      records.sort(
        (a, b) => {

          let valueA;
          let valueB;

          switch (
            sortField
          ) {

            case "name":
              valueA =
                `${a?.user?.firstName || ""} ${a?.user?.lastName || ""}`;

              valueB =
                `${b?.user?.firstName || ""} ${b?.user?.lastName || ""}`;
              break;

            case "gender":
              valueA =
                a?.user?.gender ||
                "";

              valueB =
                b?.user?.gender ||
                "";
              break;

            case "province":
              valueA =
                a?.user
                  ?.province ||
                "";

              valueB =
                b?.user
                  ?.province ||
                "";
              break;

            case "createdAt":
              valueA = new Date(
                a?.createdAt
              );

              valueB = new Date(
                b?.createdAt
              );
              break;

            default:
              valueA =
                a?.createdAt;

              valueB =
                b?.createdAt;
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
                Dashboard
              </h1>

              <p className="text-gray-500 mt-2">
                Health Monitoring Analytics
              </p>

            </div>

            <button
              onClick={() =>
                fetchDashboard(1)
              }
              className="mt-4 lg:mt-0 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-2xl font-medium transition-all flex items-center gap-2"
            >

              <RefreshCw size={18} />

              Refresh

            </button>

          </div>

          {/* SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">

            <div className="bg-white rounded-3xl p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-gray-500 text-sm">
                    Blood Pressure
                  </p>

                  <h2 className="text-4xl font-bold mt-3">
                    {
                      summary?.blood_pressure || 0
                    }
                  </h2>

                </div>

                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">

                  <Heart className="text-red-500" />

                </div>

              </div>

            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-gray-500 text-sm">
                    Sugar
                  </p>

                  <h2 className="text-4xl font-bold mt-3">
                    {
                      summary?.sugar || 0
                    }
                  </h2>

                </div>

                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">

                  <Droplets className="text-blue-500" />

                </div>

              </div>

            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-gray-500 text-sm">
                    Cholesterol
                  </p>

                  <h2 className="text-4xl font-bold mt-3">
                    {
                      summary?.cholesterol || 0
                    }
                  </h2>

                </div>

                <div className="w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center">

                  <Activity className="text-yellow-500" />

                </div>

              </div>

            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-gray-500 text-sm">
                    Verification
                  </p>

                  <h2 className="text-4xl font-bold mt-3">
                    {
                      verification?.pending || 0
                    }
                  </h2>

                </div>

                <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">

                  <Activity className="text-purple-500" />

                </div>

              </div>

            </div>

          </div>

          {/* FILTER */}
          <div className="bg-white rounded-3xl p-6 shadow-sm mb-6">

            <div className="flex flex-col lg:flex-row gap-4">

              {/* SEARCH */}
              <div className="flex-1 relative">

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

              {/* FILTER TYPE */}
              <div className="relative">

                <select
                  value={selectedType}
                  onChange={(e) =>
                    setSelectedType(
                      e.target.value
                    )
                  }
                  className="appearance-none px-5 py-4 rounded-2xl border border-gray-200 bg-white pr-12 focus:outline-none focus:ring-2 focus:ring-green-500"
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

                <ChevronDown
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />

              </div>

            </div>

          </div>

          {/* TABLE */}
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50 border-b">

                  <tr>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      Citizen ID
                    </th>

                    <th
                      onClick={() =>
                        handleSort(
                          "name"
                        )
                      }
                      className="text-left p-5 font-semibold text-gray-600 cursor-pointer"
                    >

                      <div className="flex items-center gap-2">

                        Name

                        <ArrowUpDown size={16} />

                      </div>

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
                          "province"
                        )
                      }
                      className="text-left p-5 font-semibold text-gray-600 cursor-pointer"
                    >

                      <div className="flex items-center gap-2">

                        Province

                        <ArrowUpDown size={16} />

                      </div>

                    </th>

                    <th className="text-left p-5 font-semibold text-gray-600">
                      Risk
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

                        {sortField ===
                        "createdAt" ? (
                          sortOrder ===
                          "asc" ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )
                        ) : (
                          <ArrowUpDown size={16} />
                        )}

                      </div>

                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredRecords.map(
                    (item) => (

                      <tr
                        key={item._id}
                        className="border-b hover:bg-gray-50 transition-all"
                      >

                        <td className="p-5">
                          {
                            item?.user
                              ?.citizenId
                          }
                        </td>

                        <td className="p-5">

                          <p className="font-semibold text-gray-800">
                            {
                              item?.user
                                ?.firstName
                            }{" "}
                            {
                              item?.user
                                ?.lastName
                            }
                          </p>

                          {/* GENDER */}
                          <div className="flex items-center gap-2 mt-2">

                            {item?.user
                              ?.gender ===
                            "male" ? (

                              <div className="flex items-center gap-1 text-blue-500 text-sm">

                                <Mars size={14} />

                                Male

                              </div>

                            ) : (

                              <div className="flex items-center gap-1 text-pink-500 text-sm">

                                <Venus size={14} />

                                Female

                              </div>
                            )}

                          </div>

                        </td>

                        <td className="p-5">

                          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">

                            {
                              getTypeLabel(
                                item?.type
                              )
                            }

                          </span>

                        </td>

                        <td className="p-5 font-medium">
                          {
                            renderValue(
                              item
                            )
                          }
                        </td>

                        <td className="p-5">
                          {
                            item?.user
                              ?.province
                          }
                        </td>

                        <td className="p-5">

                          {item?.cvdRisk ? (

                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                item?.cvdRisk
                                  ?.level ===
                                "risk_high"
                                  ? "bg-red-100 text-red-600"
                                  : item
                                        ?.cvdRisk
                                        ?.level ===
                                      "risk_medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >

                              {
                                item?.cvdRisk
                                  ?.label
                              }

                            </span>

                          ) : (
                            "-"
                          )}

                        </td>

                        <td className="p-5 text-sm text-gray-500">

                          {new Date(
                            item?.createdAt
                          ).toLocaleString(
                            "th-TH"
                          )}

                        </td>

                      </tr>
                    )
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