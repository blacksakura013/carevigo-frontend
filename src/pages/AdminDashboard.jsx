import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatThaiDate } from "../utils/thaiDate";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Droplets,
  Eye,
  EyeOff,
  Heart,
  HeartPulse,
  Info,
  Menu,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  UserRoundPlus,
  X,
  LockKeyhole,
  CalendarDays,
  Scale,
} from "lucide-react";
import {
  approveAdminUser,
  changeAdminPassword,
  getAdminUser,
  getAdminUsers,
  getApiError,
  getDashboardHealth,
  getDashboardSummary,
  getDashboardVerification,
  getStoredAdmin,
  provisionPatientAccount,
} from "../api/api";
import {
  Button,
  EmptyState,
  Field,
  Notice,
  PageHeading,
} from "../components/ui";
import AdminSidebar from "../components/admin/AdminSidebar";
import ReviewQueue, {
  ReviewPolicyPanel,
  ReviewStatusBadge,
} from "../components/admin/ReviewQueue";
import "../styles/admin.css";
import "../styles/admin-dashboard.css";
import "../styles/admin-clarity.css";
import LegalLinks from "../components/LegalLinks";
import { notifyPasswordChanged } from "../utils/flowFeedback";
import { getDashboardRecordModel } from "../utils/dashboardRecord";
import { getCvRiskPresentation } from "../utils/cvRisk";

const PAGE_SIZE = 20;
const TYPES = {
  blood_pressure: {
    label: "ความดันโลหิต",
    short: "ความดัน",
    icon: Heart,
    color: "#117d70",
  },
  sugar: {
    label: "ระดับน้ำตาล",
    short: "น้ำตาล",
    icon: Droplets,
    color: "#64aaa0",
  },
  cholesterol: {
    label: "ไขมันในเลือด",
    short: "ไขมัน",
    icon: Activity,
    color: "#b4d8ce",
  },
  bmi: {
    label: "น้ำหนักและส่วนสูง",
    short: "BMI",
    icon: Scale,
    color: "#dfb874",
  },
};
const BMI_LEVELS = {
  underweight: ["น้ำหนักต่ำกว่าเกณฑ์", "warning"],
  normal: ["น้ำหนักตามเกณฑ์", "success"],
  risk_low: ["น้ำหนักเกิน", "warning"],
  risk_medium: ["อ้วนระดับ 1", "warning"],
  risk_high: ["อ้วนระดับ 2 ขึ้นไป", "danger"],
};
const CV_LEVELS = {
  low: { label: "ความเสี่ยงต่ำ", range: "น้อยกว่า 10%", tone: "success" },
  moderate: { label: "ความเสี่ยงปานกลาง", range: "10–20%", tone: "warning" },
  high: { label: "ความเสี่ยงสูง", range: "มากกว่า 20%", tone: "danger" },
};
const CV_MISSING_LABELS = {
  age: "อายุ",
  birthDate: "วันเกิด",
  gender: "เพศ",
  sex: "เพศ",
  smokingStatus: "ประวัติสูบบุหรี่",
  smoking: "ประวัติสูบบุหรี่",
  diabetes: "ประวัติเบาหวาน",
  hasDiabetes: "ประวัติเบาหวาน",
  chronicDiseasesConfirmed: "การยืนยันประวัติโรคประจำตัว",
  systolic: "ความดันตัวบน",
  systolicBP: "ความดันตัวบน",
  totalCholesterol: "คอเลสเตอรอลรวม",
  cholesterol: "คอเลสเตอรอลรวม",
};
const SMOKING_LABELS = {
  never: "ไม่เคยสูบ",
  current: "กำลังสูบ",
  former: "เคยสูบและเลิกแล้ว",
};
const MENU_LABELS = {
  dashboard: "แดชบอร์ดสุขภาพ",
  members: "ทะเบียนสมาชิก",
  reviews: "ตรวจสอบบันทึก",
  verification: "ยืนยันสมาชิก",
  settings: "ตั้งค่าบัญชี",
};
const formatNumber = (value) =>
  Number.isFinite(Number(value)) && value !== null && value !== undefined
    ? Number(value).toLocaleString("th-TH")
    : "—";
const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";
const dateLabel = (value, withTime = false) => {
  return formatThaiDate(value, { withTime });
};
const maskCitizenId = (value) =>
  value ? `•••••••••${String(value).slice(-4)}` : "ไม่ระบุเลขประจำตัว";
function readProfile() {
  try {
    const value = getStoredAdmin();
    return {
      email: typeof value?.email === "string" ? value.email : "",
      role: typeof value?.role === "string" ? value.role : "",
    };
  } catch {
    return {};
  }
}
function recordValue(record) {
  const { measurements } = getDashboardRecordModel(record);
  return measurements.length
    ? measurements.map(item => `${item.label} ${item.value}${item.unit ? ` ${item.unit}` : ""}`).join(" · ")
    : "ยังไม่มีค่าที่แสดงได้";
}
function MemberStatus({ user }) {
  return (
    <span
      className={`badge badge-${user?.status === "pending" ? "warning" : user?.isVerified ? "success" : user?.status === "rejected" ? "danger" : "neutral"}`}
    >
      {user?.status === "pending"
        ? "รอยืนยัน"
        : user?.isVerified
          ? "ยืนยันแล้ว"
          : user?.status === "rejected"
            ? "ไม่ผ่านการยืนยัน"
            : "ยังไม่ยืนยัน"}
    </span>
  );
}
function getCvLevel(risk) {
  return getCvRiskPresentation(risk)?.level || null;
}
function CvRiskBadge({ risk, showReason = false }) {
  const level = getCvLevel(risk);
  if (level) {
    const displayScore = getCvRiskPresentation(risk).percent;
    return (
      <div className="admin-cv-result">
        <span className={`badge badge-${CV_LEVELS[level].tone}`}>
          <span className="admin-risk-dot" />
          {displayScore} · {CV_LEVELS[level].label}
        </span>
        {showReason && (
          <p className="admin-risk-description">
            โอกาสเกิดโรคหัวใจและหลอดเลือดใน 10 ปี ตามแบบประเมิน Thai CV Risk
            Score
          </p>
        )}
      </div>
    );
  }
  const label =
    risk?.status === "ineligible"
      ? "อยู่นอกเกณฑ์แบบประเมิน"
      : risk?.status === "incomplete"
        ? "ข้อมูลสำหรับประเมินไม่ครบ"
        : "ยังไม่มีผลประเมิน";
  const reason =
    risk?.reason && /[\u0E00-\u0E7F]/.test(risk.reason)
      ? risk.reason
      : risk?.status === "ineligible"
        ? "ข้อมูลอยู่นอกขอบเขตที่แบบประเมินรองรับ"
        : risk?.missing?.length
          ? `ข้อมูลที่ต้องตรวจสอบ: ${risk.missing.map((key) => CV_MISSING_LABELS[key] || key).join(", ")}`
          : "ต้องมีข้อมูลครบตามแบบประเมินก่อนแสดงผล";
  return (
    <div className="admin-cv-result">
      <span className="badge badge-neutral">{label}</span>
      {showReason && <p className="admin-risk-description">{reason}</p>}
    </div>
  );
}
function Skeleton({ rows = 4 }) {
  return (
    <div
      className="admin-skeleton-list"
      role="status"
      aria-label="กำลังโหลดข้อมูล"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="admin-skeleton" />
      ))}
    </div>
  );
}
function Pagination({ page, total, hasMore, onChange, loading }) {
  return (
    <div className="admin-pagination">
      <span>
        หน้า {page} · ทั้งหมด {formatNumber(total)} รายการ
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1 || loading}
          onClick={() => onChange(page - 1)}
          aria-label="หน้าก่อนหน้า"
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="admin-page-number">{page}</span>
        <Button
          variant="secondary"
          disabled={!hasMore || loading}
          onClick={() => onChange(page + 1)}
          aria-label="หน้าถัดไป"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
function RiskOverview({ counts, loading, onSelect }) {
  const unavailable = counts
    ? (Number(counts.incomplete) || 0) + (Number(counts.ineligible) || 0)
    : undefined;
  return (
    <section className="panel admin-risk-overview">
      <div className="panel-header">
        <div>
          <span className="eyebrow">THAI CV RISK SCORE</span>
          <h2 className="section-heading">
            ความเสี่ยงโรคหัวใจและหลอดเลือดของสมาชิก
          </h2>
          <p className="muted">
            โอกาสเกิดโรคใน 10 ปี · นับสมาชิกแต่ละคนจากผลประเมินล่าสุดที่บันทึกไว้
          </p>
        </div>
        <HeartPulse size={24} />
      </div>
      {loading ? (
        <Skeleton rows={2} />
      ) : (
        <>
          <div className="admin-risk-cards">
            {Object.entries(CV_LEVELS).map(([level, item]) => (
              <button
                className={`admin-risk-card is-${level}`}
                key={level}
                onClick={() => onSelect(level)}
              >
                <span className={`badge badge-${item.tone}`}>
                  <span className="admin-risk-dot" />
                  {item.label}
                </span>
                <strong>
                  {formatNumber(counts?.[level])}
                  <small>คน</small>
                </strong>
                <span>{item.range}</span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <div className="admin-risk-overview-footer">
            <span>มีผลประเมิน {formatNumber(counts?.totalCalculated)} คน</span>
            <button
              className="admin-text-button"
              onClick={() => onSelect("unavailable")}
            >
              ยังประเมินไม่ได้ {formatNumber(unavailable)} คน{" "}
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMenu = Object.hasOwn(MENU_LABELS, searchParams.get("view"))
    ? searchParams.get("view")
    : "dashboard";
  const usersRiskLevel = ["low", "moderate", "high", "unavailable"].includes(
    searchParams.get("risk"),
  )
    ? searchParams.get("risk")
    : "all";
  const [navOpen, setNavOpen] = useState(false);
  const [profile] = useState(readProfile);
  const [summary, setSummary] = useState(null);
  const [verification, setVerification] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [health, setHealth] = useState({
    records: [],
    summary: {},
    total: null,
    hasMore: false,
  });
  const [healthPage, setHealthPage] = useState(1);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState("");
  const [search, setSearch] = useState("");
  const [healthQuery, setHealthQuery] = useState("");
  const [type, setType] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [bmiLevel, setBmiLevel] = useState("all");
  const [riskLevel, setRiskLevel] = useState("all");
  const [sort, setSort] = useState("newest");
  const [users, setUsers] = useState({ records: [], total: 0, hasMore: false });
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersQuery, setUsersQuery] = useState("");
  const [usersStatus, setUsersStatus] = useState("all");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [confirmApproval, setConfirmApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const detailRequest = useRef(0);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError("");
    const results = await Promise.allSettled([
      getDashboardSummary(),
      getDashboardVerification(),
    ]);
    if (results[0].status === "fulfilled")
      setSummary(results[0].value?.data?.data || {});
    if (results[1].status === "fulfilled")
      setVerification(results[1].value?.data?.data || {});
    const failed = results.find((result) => result.status === "rejected");
    if (failed)
      setOverviewError(
        getApiError(
          failed.reason,
          "โหลดข้อมูลสรุปบางส่วนไม่สำเร็จ กรุณาลองใหม่",
        ),
      );
    setLastUpdated(new Date());
    setOverviewLoading(false);
  }, []);
  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshKey]);
  useEffect(() => {
    let cancelled = false;
    setHealthLoading(true);
    setHealthError("");
    getDashboardHealth(healthPage, PAGE_SIZE, { search: healthQuery, type, reviewStatus, riskLevel, bmiLevel, sort })
      .then((response) => {
        if (!cancelled) {
          const body = response?.data || {};
          if (body.data?.summaryScope !== "all") {
            setHealth({ records: [], summary: {}, total: null, hasMore: false });
            setHealthError("API ยังไม่รองรับการค้นหาทั้งระบบ กรุณาอัปเดต backend แล้วรีเฟรช");
            return;
          }
          setHealth({
            records: body.data?.records || [],
            summary: body.data?.summary || {},
            total: Number.isFinite(body.total) && body.total >= 0 ? body.total : null,
            hasMore: Boolean(body.hasMore),
          });
        }
      })
      .catch((error) => {
        if (!cancelled)
          setHealthError(getApiError(error, "โหลดรายการสุขภาพไม่สำเร็จ"));
      })
      .finally(() => {
        if (!cancelled) setHealthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [healthPage, refreshKey, healthQuery, type, reviewStatus, riskLevel, bmiLevel, sort]);
  useEffect(() => {
    if (search.trim() === healthQuery) return undefined;
    const timer = setTimeout(() => { setHealthQuery(search.trim()); setHealthPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search, healthQuery]);
  useEffect(() => {
    if (usersSearch.trim() === usersQuery) return undefined;
    const timer = setTimeout(() => {
      setUsersQuery(usersSearch.trim());
      setUsersPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [usersSearch, usersQuery]);
  useEffect(() => {
    if (activeMenu !== "members" && activeMenu !== "verification")
      return undefined;
    let cancelled = false;
    setUsersLoading(true);
    setUsersError("");
    getAdminUsers(usersPage, PAGE_SIZE, {
      ...(activeMenu === "verification"
        ? { status: "pending" }
        : usersStatus !== "all"
          ? { status: usersStatus }
          : {}),
      ...(activeMenu === "members" && usersRiskLevel !== "all"
        ? { riskLevel: usersRiskLevel }
        : {}),
      ...(usersQuery ? { search: usersQuery } : {}),
    })
      .then((response) => {
        if (!cancelled) {
          const body = response?.data || {};
          setUsers({
            records: Array.isArray(body.data) ? body.data : [],
            total: body.total || 0,
            hasMore: Boolean(body.hasMore),
          });
        }
      })
      .catch((error) => {
        if (!cancelled)
          setUsersError(getApiError(error, "โหลดทะเบียนสมาชิกไม่สำเร็จ"));
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeMenu,
    usersPage,
    usersQuery,
    usersStatus,
    usersRiskLevel,
    refreshKey,
  ]);
  useEffect(() => {
    if (!selected) return undefined;
    const requestId = ++detailRequest.current;
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    setConfirmApproval(false);
    getAdminUser(selected._id)
      .then((response) => {
        if (requestId === detailRequest.current)
          setDetail(response?.data?.data || null);
      })
      .catch((error) => {
        if (requestId === detailRequest.current)
          setDetailError(getApiError(error, "โหลดข้อมูลสมาชิกไม่สำเร็จ"));
      })
      .finally(() => {
        if (requestId === detailRequest.current) setDetailLoading(false);
      });
    return () => {
      detailRequest.current += 1;
    };
  }, [selected, detailRefresh]);

  useEffect(() => {
    setUsersPage(1);
    setUsersSearch("");
    setUsersQuery("");
    setUsersStatus("all");
  }, [activeMenu]);
  const changeMenu = (menu) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", menu);
    nextParams.delete("risk");
    setSearchParams(nextParams);
    window.scrollTo(0, 0);
  };
  const openRiskMembers = (level) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", "members");
    nextParams.set("risk", level);
    setSearchParams(nextParams);
    setUsersPage(1);
    window.scrollTo(0, 0);
  };
  const changeMemberRisk = (level) => {
    const nextParams = new URLSearchParams(searchParams);
    if (level === "all") nextParams.delete("risk");
    else nextParams.set("risk", level);
    setSearchParams(nextParams);
    setUsersPage(1);
  };
  const refresh = () => {
    setRefreshKey((key) => key + 1);
  };
  const records = health.records;
  const hasHealthFilters = Boolean(healthQuery || type !== "all" || reviewStatus !== "all" || riskLevel !== "all" || bmiLevel !== "all");
  const changeHealthFilter = (setter, value) => { setter(value); setHealthPage(1); };
  const clearHealthFilters = () => {
    setSearch(""); setHealthQuery(""); setType("all"); setReviewStatus("all");
    setBmiLevel("all"); setRiskLevel("all"); setSort("newest"); setHealthPage(1);
  };
  const approve = async () => {
    if (!selected?._id || approving) return;
    setApproving(true);
    setDetailError("");
    try {
      await approveAdminUser(selected._id);
      setFeedback({
        tone: "success",
        message: `ยืนยันสมาชิก ${fullName(detail?.user || selected)} สำเร็จ`,
      });
      setSelected(null);
      setUsersPage(1);
      refresh();
    } catch (error) {
      setDetailError(getApiError(error, "ยืนยันสมาชิกไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className={`admin-shell${activeMenu === "dashboard" ? " admin-dashboard-view" : ""}`}>
      <a className="admin-skip-link" href="#admin-main">
        ข้ามไปยังเนื้อหา
      </a>
      <AdminSidebar
        activeMenu={activeMenu}
        setActiveMenu={changeMenu}
        verification={verification}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        profile={profile}
      />
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <button
              className="admin-menu-toggle admin-icon-button"
              onClick={() => setNavOpen(true)}
              aria-label="เปิดเมนู"
              aria-expanded={navOpen}
            >
              <Menu size={22} />
            </button>
            <span>พื้นที่ผู้ดูแล</span>
            <ChevronRight size={14} />
            <strong>{MENU_LABELS[activeMenu]}</strong>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-today">
              <CalendarDays size={15} />
              {dateLabel(new Date())}
            </span>
            <span className="admin-topbar-divider" />
            <span className="admin-avatar">
              {(profile?.email || "A").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="admin-main" className="admin-main">
          <PageHeading
            eyebrow="CARE MANAGEMENT"
            title={MENU_LABELS[activeMenu]}
            description={
              activeMenu === "dashboard"
                ? "เลือกหมวดผลตรวจ แล้วดูค่า การแปลผล และสิ่งที่ควรทำต่อ"
                : activeMenu === "members"
                  ? "ค้นหาและเปิดดูข้อมูลสมาชิก พร้อมประวัติการบันทึกสุขภาพ"
                  : activeMenu === "verification"
                    ? "ตรวจสอบข้อมูลและยืนยันสมาชิกที่รอการอนุมัติ"
                    : activeMenu === "reviews"
                      ? "ตรวจสอบ ยืนยัน และยกเลิกบันทึก พร้อมเลือกทีละรายการหรือทั้งหมดตามตัวกรอง"
                      : "จัดการข้อมูลบัญชีผู้ดูแลและรหัสผ่านของคุณ"
            }
          >
            <Button
              variant="secondary"
              onClick={refresh}
              loading={overviewLoading || healthLoading || usersLoading}
            >
              <RefreshCw size={16} />
              รีเฟรชข้อมูล
            </Button>
          </PageHeading>
          {feedback && (
            <div className="admin-feedback" role="status">
              <Notice tone={feedback.tone}>{feedback.message}</Notice>
              <button
                className="admin-icon-button"
                aria-label="ปิดข้อความ"
                onClick={() => setFeedback(null)}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {overviewError && (
            <Notice tone="error">
              {overviewError}{" "}
              <button className="admin-text-button" onClick={refresh}>
                ลองอีกครั้ง
              </button>
            </Notice>
          )}
          {activeMenu === "dashboard" && (
            <>
              <section className="admin-health-type-cards" aria-label="จำนวนบันทึกสุขภาพแยกตามประเภท">
                {Object.entries(TYPES).map(([key, item]) => {
                  const Icon = item.icon;
                  return <button type="button" key={key}
                    className={`admin-health-type-card admin-health-type-${key}${type === key ? " is-selected" : ""}`}
                    aria-pressed={type === key}
                    onClick={() => changeHealthFilter(setType, key)}
                    disabled={healthLoading && !Object.keys(health.summary).length}>
                    <span className="admin-health-type-icon"><Icon size={27} aria-hidden="true" /></span>
                    <span className="admin-health-type-label">{item.label}{key === "bmi" ? " (BMI)" : ""}</span>
                    <strong>{formatNumber(health.summary[key])}<small>รายการ</small></strong>
                    <span className="admin-health-type-note">{type === key ? <><CheckCircle2 size={18} aria-hidden="true" /> กำลังแสดงหมวดนี้ · รวมทุกสถานะ</> : "ทั้งหมดในระบบ · ทุกสถานะรายการ"}</span>
                  </button>;
                })}
              </section>
              <section className="panel admin-records-panel">
                <div className="panel-header">
                  <div>
                    <span className="eyebrow">HEALTH RECORDS</span>
                    <h2 className="section-heading">
                      รายการผลตรวจสุขภาพ{" "}
                      <span className="admin-heading-count">
                        {formatNumber(health.total)}
                      </span>
                    </h2>
                    <p className="muted">
                      ค้นหาและกรองรายการทั้งระบบ · หน้าละ {PAGE_SIZE} รายการ
                    </p>
                  </div>
                  <span className="admin-updated">
                    {lastUpdated
                      ? `อัปเดต ${dateLabel(lastUpdated, true)} น.`
                      : "กำลังอัปเดต"}
                  </span>
                </div>
                <div className="admin-record-filters">
                  <label className="admin-search admin-record-search">
                    <span className="admin-record-search-label">ค้นหาบันทึกสุขภาพ</span>
                    <Search size={18} aria-hidden="true" />
                    <input className="input" aria-label="ค้นหาบันทึกสุขภาพ" placeholder="ค้นหาชื่อ เลขบัตรประชาชน หรือจังหวัด"
                      value={search} onChange={event => setSearch(event.target.value)} />
                  </label>
                  <label className="admin-record-filter-label"><span>ประเภทบันทึก</span>
                    <select className="input" aria-label="ประเภทบันทึก" value={type} onChange={event => changeHealthFilter(setType, event.target.value)}>
                      <option value="all">ทุกประเภท</option>
                      {Object.entries(TYPES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="admin-record-filter-label"><span>สถานะรายการ</span>
                    <select className="input" aria-label="สถานะรายการ" value={reviewStatus} onChange={event => changeHealthFilter(setReviewStatus, event.target.value)}>
                      <option value="all">ทุกสถานะรายการ</option><option value="pending">รอตรวจสอบ</option>
                      <option value="approved">ยืนยันรายการแล้ว</option><option value="rejected">ยกเลิกรายการแล้ว</option>
                    </select>
                  </label>
                  <Button variant="secondary" className="admin-filter-reset" onClick={clearHealthFilters}>ล้างตัวกรอง</Button>
                  <details className="admin-record-advanced">
                    <summary>ตัวกรองเพิ่มเติมและการเรียงลำดับ</summary>
                    <div className="admin-record-advanced-controls">
                      <label className="admin-record-filter-label"><span>Thai CV Risk ณ เวลาบันทึก</span>
                        <select className="input" aria-label="ความเสี่ยง Thai CV" value={riskLevel} onChange={event => changeHealthFilter(setRiskLevel, event.target.value)}>
                          <option value="all">ทุกระดับ Thai CV</option>
                          {Object.entries(CV_LEVELS).map(([key, item]) => <option key={key} value={key}>{item.label} ({item.range})</option>)}
                          <option value="unavailable">ยังประเมินไม่ได้</option>
                        </select>
                      </label>
                      <label className="admin-record-filter-label"><span>กลุ่ม BMI ที่ระบบบันทึกไว้</span>
                        <select className="input" aria-label="การจัดกลุ่ม BMI" value={bmiLevel} onChange={event => changeHealthFilter(setBmiLevel, event.target.value)}>
                          <option value="all">ทุกกลุ่ม BMI</option>
                          {Object.entries(BMI_LEVELS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </label>
                      <label className="admin-record-filter-label"><span><ArrowDownUp size={16} aria-hidden="true" /> เรียงลำดับ</span>
                        <select className="input" aria-label="เรียงลำดับบันทึก" value={sort} onChange={event => changeHealthFilter(setSort, event.target.value)}>
                          <option value="newest">ใหม่สุดก่อน</option><option value="oldest">เก่าสุดก่อน</option><option value="name">ตามชื่อสมาชิก</option>
                          <option value="risk_desc">Thai CV สูงสุดก่อน</option><option value="risk_asc">Thai CV ต่ำสุดก่อน</option>
                        </select>
                      </label>
                    </div>
                  </details>
                </div>
                {healthLoading ? (
                  <Skeleton rows={5} />
                ) : healthError ? (
                  <div className="panel-body">
                    <Notice tone="error">{healthError}</Notice>
                    <Button variant="secondary" onClick={refresh}>
                      ลองอีกครั้ง
                    </Button>
                  </div>
                ) : !records.length ? (
                  <EmptyState icon={ClipboardList}
                    title={hasHealthFilters ? "ไม่พบข้อมูลที่ตรงกับตัวกรอง" : "ยังไม่มีบันทึกสุขภาพ"}
                    description={hasHealthFilters ? "ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูรายการทั้งหมด" : "ข้อมูลจะแสดงเมื่อมีการบันทึกผลตรวจสุขภาพ"} />
                ) : (
                  <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="ตารางบันทึกสุขภาพ เลื่อนเพื่อดูข้อมูลเพิ่มเติม">
                    <table className="admin-table admin-health-table" role="table">
                      <caption className="sr-only">บันทึกสุขภาพสมาชิก</caption>
                      <thead><tr>
                        <th scope="col">ผู้รับบริการ</th><th scope="col">ประเภทและค่าที่บันทึก</th>
                        <th scope="col">การแปลผล</th><th scope="col">ควรทำอย่างไรต่อ</th><th scope="col">Thai CV Risk · 10 ปี</th>
                      </tr></thead>
                      <tbody>
                        {records.map(record => {
                          const model = getDashboardRecordModel(record);
                          const person = record.user || (record.source === "guest" ? record.submittedProfile : null);
                          const TypeIcon = TYPES[record.type]?.icon || Activity;
                          const StatusIcon = model.level === "normal" ? CheckCircle2 : ["high", "urgent", "watch"].includes(model.level) ? AlertTriangle : Info;
                          return <tr key={record._id}>
                            <td data-label="ผู้รับบริการ"><div className="admin-person">
                              <span className="admin-person-avatar" aria-hidden="true">{fullName(person).slice(0, 1)}</span>
                              <div><strong>{fullName(person)}</strong><span>{maskCitizenId(record.user?.citizenId || record.citizenId)}</span>
                                {record.user?.province && <span>{record.user.province}</span>}
                              </div>
                            </div><span className="admin-record-date">{dateLabel(record.createdAt, true)}</span>
                              {record.user?._id ? <button className="admin-table-action" aria-label={`ดูข้อมูล ${fullName(person)}`} onClick={() => setSelected(record.user)}><Eye size={20} aria-hidden="true" />รายละเอียด</button> : <span className="admin-cell-note">ยังไม่เชื่อมทะเบียนสมาชิก</span>}
                            </td>
                            <td data-label="ประเภทและค่าที่บันทึก"><div className="admin-record-category"><TypeIcon size={22} aria-hidden="true" />{TYPES[record.type]?.label || "ไม่ระบุประเภท"}</div>
                              <div className="admin-record-review-state"><span>สถานะตรวจสอบรายการ</span>
                                {["pending", "approved", "rejected"].includes(record.reviewStatus)
                                  ? <ReviewStatusBadge status={record.reviewStatus} /> : <span className="badge badge-neutral">ไม่ระบุสถานะรายการ</span>}
                              </div>
                              {model.measurements.length ? <dl className="admin-record-measurements">
                              {model.measurements.map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}{item.unit ? ` ${item.unit}` : ""}</dd></div>)}
                            </dl> : <span>ยังไม่มีค่าที่แสดงได้</span>}</td>
                            <td data-label="การแปลผล"><div className="admin-record-interpretation">
                              <span className={`admin-record-level admin-record-level-${model.level}`}><StatusIcon size={20} aria-hidden="true" />{model.level === "urgent" ? `เร่งด่วน · ${model.label}` : model.label}</span>
                            </div></td>
                            <td data-label="ควรทำอย่างไรต่อ" className="admin-record-next-action"><p>{model.nextAction}</p>
                              {model.details.length > 0 && <details className="admin-record-guidance"><summary>คำแนะนำเพิ่มเติม</summary>
                                <p>ใช้คำแนะนำนี้เมื่อค่าตรวจยังเป็นปัจจุบัน หากเป็นผลเดิมให้ตรวจสอบอาการและผลตรวจล่าสุดก่อน</p>
                                {model.details.map(card => <section key={card.id}><h4>{card.title}</h4><p>{card.explanation}</p>
                                  <ul>{card.actions.map(action => <li key={action}>{action}</li>)}</ul><p>{card.reference}</p>
                                </section>)}
                                <ul>{model.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer noopener">{source.title}</a></li>)}</ul>
                              </details>}
                            </td>
                            <td data-label="Thai CV Risk · 10 ปี"><CvRiskBadge risk={record.thaiCvRisk} /><span className="admin-cell-note">คะแนน ณ เวลาบันทึก</span></td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {!healthError && (
                  <Pagination
                    page={healthPage}
                    total={health.total}
                    hasMore={health.hasMore}
                    onChange={setHealthPage}
                    loading={healthLoading}
                  />
                )}
                <p className="admin-clinical-note">
                  ผลสุขภาพเป็นการคัดกรองจากค่าตามวันที่บันทึก ไม่ใช่การวินิจฉัยหรือการยืนยันอาการปัจจุบัน
                  เมื่อไม่มีวันเกิดจะใช้เกณฑ์ผู้ใหญ่ทั่วไป ส่วน Thai CV Risk เป็นความเสี่ยงใน 10 ปี ณ เวลาบันทึก แยกจาก BMI และระดับผลตรวจแต่ละรายการ
                </p>
              </section>
              <section className="admin-dashboard-secondary" aria-label="ข้อมูลสมาชิกและการดูแล">
                <div><span>สมาชิกทั้งหมด</span><strong>{formatNumber(summary?.totalUsers)} คน</strong><small>สมาชิกในทะเบียน</small></div>
                <div><span>บันทึกสุขภาพวันนี้</span><strong>{formatNumber(summary?.todayHealthRecords)} รายการ</strong><small>วันที่ปัจจุบันตามเวลาไทย</small></div>
                <button type="button" onClick={() => changeMenu("verification")}><span>สมาชิกรอยืนยัน</span><strong>{formatNumber(verification?.pending)} คน</strong><small>เปิดตรวจสอบทะเบียนสมาชิก · แยกจากสถานะผลตรวจ</small></button>
              </section>
              <RiskOverview counts={summary?.thaiCvRisk} loading={overviewLoading} onSelect={openRiskMembers} />
            </>
          )}
          {(activeMenu === "members" || activeMenu === "verification") && (
            <>
              {activeMenu === "verification" && (
                <div className="admin-queue-banner">
                  <span className="admin-stat-icon amber">
                    <ShieldCheck size={26} />
                  </span>
                  <div>
                    <strong>
                      {formatNumber(verification?.pending)}{" "}
                      สมาชิกกำลังรอการยืนยัน
                    </strong>
                    <p>เปิดรายละเอียดเพื่อตรวจสอบข้อมูล ก่อนยืนยันสมาชิก</p>
                  </div>
                </div>
              )}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="section-heading">
                      {activeMenu === "verification"
                        ? "รายการรอตรวจสอบ"
                        : "สมาชิกในระบบ"}{" "}
                      <span className="admin-heading-count">
                        {formatNumber(users.total)}
                      </span>
                    </h2>
                    <p className="muted">ค้นหาจากสมาชิกทั้งหมดในระบบ</p>
                  </div>
                  {activeMenu === "members" ? (
                    <Link className="btn btn-primary" to="/register">
                      <UserRoundPlus size={17} />
                      เพิ่มผู้รับบริการ
                    </Link>
                  ) : (
                    <span className="admin-list-icon">
                      <Users size={22} />
                    </span>
                  )}
                </div>
                <div className="admin-member-filters">
                  <label className="admin-search">
                    <Search size={18} />
                    <input
                      className="input"
                      aria-label="ค้นหาสมาชิก"
                      placeholder="ชื่อ เลขประจำตัว เบอร์โทร หรือจังหวัด"
                      value={usersSearch}
                      onChange={(event) => setUsersSearch(event.target.value)}
                    />
                  </label>
                  {activeMenu === "members" && (
                    <>
                      <select
                        className="input"
                        aria-label="สถานะสมาชิก"
                        value={usersStatus}
                        onChange={(event) => {
                          setUsersStatus(event.target.value);
                          setUsersPage(1);
                        }}
                      >
                        <option value="all">ทุกสถานะ</option>
                        <option value="pending">รอยืนยัน</option>
                        <option value="active">ใช้งานอยู่</option>
                        <option value="rejected">ไม่ผ่านการยืนยัน</option>
                      </select>
                      <select
                        className="input"
                        aria-label="ความเสี่ยงสมาชิก Thai CV"
                        value={usersRiskLevel}
                        onChange={(event) =>
                          changeMemberRisk(event.target.value)
                        }
                      >
                        <option value="all">ทุกระดับ Thai CV</option>
                        {Object.entries(CV_LEVELS).map(([key, item]) => (
                          <option key={key} value={key}>
                            {item.label} ({item.range})
                          </option>
                        ))}
                        <option value="unavailable">ยังประเมินไม่ได้</option>
                      </select>
                    </>
                  )}
                </div>
                {usersLoading ? (
                  <Skeleton rows={6} />
                ) : usersError ? (
                  <div className="panel-body">
                    <Notice tone="error">{usersError}</Notice>
                    <Button variant="secondary" onClick={refresh}>
                      ลองอีกครั้ง
                    </Button>
                  </div>
                ) : !users.records.length ? (
                  <EmptyState
                    icon={activeMenu === "verification" ? CheckCircle2 : Users}
                    title={
                      usersQuery ||
                      usersStatus !== "all" ||
                      usersRiskLevel !== "all"
                        ? "ไม่พบสมาชิกที่ตรงกับการค้นหา"
                        : activeMenu === "verification"
                          ? "ตรวจสอบครบแล้ว"
                          : "ยังไม่มีสมาชิกในระบบ"
                    }
                    description={
                      usersQuery ||
                      usersStatus !== "all" ||
                      usersRiskLevel !== "all"
                        ? "ลองเปลี่ยนคำค้นหาหรือสถานะสมาชิก"
                        : activeMenu === "verification"
                          ? "ไม่มีสมาชิกที่รอการยืนยันในขณะนี้"
                          : "สมาชิกจะแสดงที่นี่เมื่อลงทะเบียนสำเร็จ"
                    }
                  />
                ) : (
                  <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="ตารางทะเบียนสมาชิก เลื่อนเพื่อดูข้อมูลเพิ่มเติม">
                    <table className="admin-table admin-members-table">
                      <caption className="sr-only">ทะเบียนสมาชิก</caption>
                      <thead>
                        <tr>
                          <th>สมาชิก</th>
                          <th>ติดต่อ</th>
                          <th>จังหวัด</th>
                          <th>Thai CV Risk · ล่าสุด</th>
                          <th>สถานะ</th>
                          <th>ลงทะเบียนเมื่อ</th>
                          <th>จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.records.map((user) => (
                          <tr key={user._id}>
                            <td>
                              <div className="admin-person">
                                <span className="admin-person-avatar">
                                  {fullName(user).slice(0, 1)}
                                </span>
                                <div>
                                  <strong>{fullName(user)}</strong>
                                  <span>{maskCitizenId(user.citizenId)}</span>
                                </div>
                              </div>
                            </td>
                            <td>{user.phone || "—"}</td>
                            <td>{user.province || "—"}</td>
                            <td>
                              <CvRiskBadge risk={user.thaiCvRisk} />
                            </td>
                            <td>
                              <MemberStatus user={user} />
                            </td>
                            <td className="admin-date-cell">
                              {dateLabel(user.createdAt)}
                            </td>
                            <td>
                              <button
                                className="admin-text-button"
                                onClick={() => setSelected(user)}
                              >
                                {activeMenu === "verification"
                                  ? "ตรวจสอบ"
                                  : "ดูรายละเอียด"}
                                <ChevronRight size={15} />
                              </button>
                              {/^[0-9]{13}$/.test(user.citizenId || "") && <Link className="admin-text-button" to={`/admin/progress/${user.citizenId}`}>ติดตามผลสุขภาพ<ArrowRight size={15} /></Link>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!usersError && (
                  <Pagination
                    page={usersPage}
                    total={users.total}
                    hasMore={users.hasMore}
                    onChange={setUsersPage}
                    loading={usersLoading}
                  />
                )}
              </section>
            </>
          )}
          {activeMenu === "reviews" && (
            <ReviewQueue refreshKey={refreshKey} onChanged={refresh} />
          )}
          {activeMenu === "settings" && (
            <div className="admin-settings-stack">
              <SettingsPanel profile={profile} />
              <ReviewPolicyPanel refreshKey={refreshKey} />
              <RiskPolicyPanel />
            </div>
          )}
          <footer className="admin-footer">
            <span>Save Stroke · เชื่อมต่อทุกการดูแล</span>
            <span>ข้อมูลสุขภาพสำหรับผู้ดูแลที่ได้รับอนุญาต</span>
          </footer>
          <footer className="content-footer"><LegalLinks /></footer>
        </main>
      </div>
      {selected && (
        <MemberDrawer
          selected={selected}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onRetry={() => setDetailRefresh((value) => value + 1)}
          onClose={() => {
            if (!approving && !accountBusy) setSelected(null);
          }}
          confirmApproval={confirmApproval}
          onConfirm={() => setConfirmApproval(true)}
          onCancelConfirm={() => setConfirmApproval(false)}
          approving={approving}
          onApprove={approve}
          accountBusy={accountBusy}
          onAccountBusy={setAccountBusy}
          onAccountProvisioned={(patient) => {
            setDetail((previous) => ({
              ...previous,
              user: { ...previous?.user, ...patient },
            }));
            refresh();
          }}
        />
      )}
    </div>
  );
}

function MemberDrawer({
  selected,
  detail,
  loading,
  error,
  onRetry,
  onClose,
  confirmApproval,
  onConfirm,
  onCancelConfirm,
  approving,
  onApprove,
  accountBusy,
  onAccountBusy,
  onAccountProvisioned,
}) {
  const drawerRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const focusable = drawerRef.current?.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === drawerRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === drawerRef.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);
  const user = detail?.user || selected;
  const healthRecords = detail?.health
    ? Object.values(detail.health)
        .flat()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];
  return (
    <div className="admin-drawer-overlay" onClick={onClose}>
      <section
        className="admin-member-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-drawer-title"
        tabIndex={-1}
        ref={drawerRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-drawer-header">
          <div>
            <span className="eyebrow">MEMBER PROFILE</span>
            <h2 id="member-drawer-title">รายละเอียดสมาชิก</h2>
          </div>
          <button
            className="admin-icon-button"
            aria-label="ปิดรายละเอียดสมาชิก"
            onClick={onClose}
            disabled={approving || accountBusy}
          >
            <X size={22} />
          </button>
        </div>
        <div className="admin-drawer-body">
          {loading ? (
            <Skeleton rows={7} />
          ) : (
            <>
              {error && <Notice tone="error">{error}</Notice>}
              {!detail ? (
                <EmptyState
                  icon={Users}
                  title="เปิดข้อมูลสมาชิกไม่ได้"
                  description="ลองเชื่อมต่ออีกครั้งเพื่อดูข้อมูลล่าสุด"
                  action={
                    <Button variant="secondary" onClick={onRetry}>
                      ลองอีกครั้ง
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="admin-member-identity">
                    <span className="admin-member-avatar">
                      {fullName(user).slice(0, 1)}
                    </span>
                    <h3>{fullName(user)}</h3>
                    <MemberStatus user={user} />
                    <span>ลงทะเบียน {dateLabel(user.createdAt)}</span>
                  </div>
                  {/^[0-9]{13}$/.test(user.citizenId || "") && <Link className="btn btn-primary" to={`/admin/progress/${user.citizenId}`} onClick={onClose}>ติดตามผลสุขภาพรายบุคคล<ArrowRight size={18} /></Link>}
                  <section className="admin-member-risk">
                    <div className="admin-detail-section-title">
                      <h3 className="admin-detail-heading">
                        Thai CV Risk Score · ล่าสุด
                      </h3>
                      <HeartPulse size={19} />
                    </div>
                    <CvRiskBadge
                      risk={detail?.thaiCvRisk || user.thaiCvRisk}
                      showReason
                    />
                    <p className="admin-risk-date">
                      {user.thaiCvRisk?.calculatedAt
                        ? `ประเมินเมื่อ ${dateLabel(user.thaiCvRisk.calculatedAt, true)}`
                        : "แสดงเมื่อมีข้อมูลครบตามแบบประเมิน"}
                    </p>
                  </section>
                  <h3 className="admin-detail-heading">
                    ข้อมูลส่วนตัวและประวัติสุขภาพ
                  </h3>
                  <dl className="admin-detail-grid">
                    <DetailField
                      label="เลขประจำตัวประชาชน"
                      value={user.citizenId}
                    />
                    <DetailField
                      label="วันเกิด"
                      value={dateLabel(user.birthDate)}
                    />
                    <DetailField
                      label="เพศ"
                      value={
                        {
                          male: "ชาย",
                          female: "หญิง",
                          other: "อื่น ๆ",
                          unspecified: "ไม่ระบุ",
                        }[user.gender] || user.gender
                      }
                    />
                    <DetailField label="เบอร์โทรศัพท์" value={user.phone} />
                    <DetailField label="อีเมล" value={user.email} />
                    <DetailField label="จังหวัด" value={user.province} />
                    <DetailField label="อำเภอ / เขต" value={user.district} />
                    <DetailField label="ตำบล / แขวง" value={user.subdistrict} />
                    <DetailField label="ที่อยู่" value={user.address} />
                    <DetailField
                      label="โรคประจำตัว"
                      value={
                        Array.isArray(user.chronicDiseases)
                          ? user.chronicDiseases.join(", ")
                          : user.chronicDiseases
                      }
                    />
                    <DetailField
                      label="สถานะการสูบบุหรี่"
                      value={SMOKING_LABELS[user.smokingStatus]}
                    />
                    {user.smokingStatus === "former" && (
                      <DetailField
                        label="ระยะเวลาที่เลิกสูบ"
                        value={
                          user.smokingQuitMonths != null
                            ? `${formatNumber(user.smokingQuitMonths)} เดือน`
                            : undefined
                        }
                      />
                    )}
                    <DetailField
                      label="รายละเอียดโรคมะเร็ง"
                      value={user.cancerDetails}
                    />
                    <DetailField
                      label="การยืนยันประวัติโรคประจำตัว"
                      value={
                        user.chronicDiseasesConfirmed === true
                          ? "ตรวจสอบประวัติแล้ว"
                          : "ยังไม่ได้ยืนยันประวัติ"
                      }
                    />
                    <DetailField
                      label="ผู้ติดต่อฉุกเฉิน"
                      value={user.emergencyContactName}
                    />
                    <DetailField
                      label="เบอร์ติดต่อฉุกเฉิน"
                      value={user.emergencyContactPhone}
                    />
                  </dl>
                  <AccountProvisioningPanel
                    key={user._id}
                    user={user}
                    disabled={approving}
                    onBusy={onAccountBusy}
                    onProvisioned={onAccountProvisioned}
                  />
                  <div className="admin-detail-section-title">
                    <h3 className="admin-detail-heading">
                      ประวัติการบันทึกสุขภาพ
                    </h3>
                    <span className="badge badge-neutral">
                      {healthRecords.length} รายการ
                    </span>
                  </div>
                  {!healthRecords.length ? (
                    <EmptyState
                      icon={HeartPulse}
                      title="ยังไม่มีบันทึกสุขภาพ"
                      description="สมาชิกยังไม่ได้บันทึกข้อมูลสุขภาพ"
                    />
                  ) : (
                    <div className="admin-member-history">
                      {healthRecords.map((record) => {
                        const Icon = TYPES[record.type]?.icon || Activity;
                        return (
                          <div
                            className="admin-member-history-row"
                            key={record._id}
                          >
                            <span className="admin-stat-icon mint">
                              <Icon size={19} />
                            </span>
                            <div>
                              <strong>
                                {TYPES[record.type]?.label || record.type}
                              </strong>
                              <span>{dateLabel(record.createdAt, true)}</span>
                              <CvRiskBadge risk={record.thaiCvRisk} />
                            </div>
                            <b>{recordValue(record)}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        {!loading && detail && user.status === "pending" && (
          <div className="admin-drawer-actions">
            {confirmApproval ? (
              <>
                <Notice tone="warning">
                  ยืนยันว่าตรวจสอบข้อมูลของ {fullName(user)} แล้ว
                  และต้องการอนุมัติสมาชิกคนนี้
                </Notice>
                <div className="inline-actions">
                  <Button
                    variant="secondary"
                    onClick={onCancelConfirm}
                    disabled={approving || accountBusy}
                  >
                    ย้อนกลับ
                  </Button>
                  <Button
                    onClick={onApprove}
                    loading={approving}
                    disabled={accountBusy}
                  >
                    <Check size={17} />
                    ยืนยันการอนุมัติ
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={onConfirm} disabled={accountBusy}>
                <ShieldCheck size={18} />
                อนุมัติสมาชิก
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
function DetailField({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "ไม่ระบุ"}</dd>
    </div>
  );
}
function AccountProvisioningPanel({ user, disabled, onBusy, onProvisioned }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showIssued, setShowIssued] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [issued, setIssued] = useState(null);
  const generateCode = () => {
    try {
      const values = new Uint32Array(1);
      do {
        window.crypto.getRandomValues(values);
      } while (values[0] >= 4294000000);
      setPassword(String(values[0] % 1000000).padStart(6, "0"));
      setConfirmReset(false);
      setMessage(null);
    } catch {
      setMessage({
        tone: "error",
        text: "สุ่มรหัสไม่ได้ กรุณากำหนดตัวเลข 6 หลักด้วยตนเอง",
      });
    }
  };
  const submit = async (event) => {
    event?.preventDefault();
    if (saving || disabled) return;
    setMessage(null);
    if (!/^\d{6}$/.test(password)) {
      setMessage({
        tone: "error",
        text: "รหัสผ่านเริ่มต้นต้องเป็นตัวเลข 6 หลัก",
      });
      return;
    }
    if (user.accountEnabled && !confirmReset) {
      setConfirmReset(true);
      return;
    }
    setSaving(true);
    onBusy(true);
    try {
      const response = await provisionPatientAccount(user._id, password);
      const body = response?.data?.data || {};
      setIssued({
        citizenId: body.patient?.citizenId || user.citizenId,
        password: body.temporaryPassword || password,
      });
      setPassword("");
      setShowPassword(false);
      setShowIssued(false);
      setConfirmReset(false);
      onProvisioned(
        body.patient || { accountEnabled: true, requiresPasswordChange: true },
      );
      setMessage({
        tone: "success",
        text: user.accountEnabled
          ? "ตั้งรหัสผ่านเริ่มต้นใหม่เรียบร้อยแล้ว"
          : "เปิดบัญชีผู้รับบริการเรียบร้อยแล้ว",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: getApiError(
          error,
          "เปิดบัญชีหรือตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง",
        ),
      });
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(issued.password);
      setMessage({ tone: "success", text: "คัดลอกรหัสผ่านเริ่มต้นแล้ว" });
    } catch {
      setMessage({
        tone: "error",
        text: "คัดลอกอัตโนมัติไม่ได้ กรุณาแสดงรหัสและคัดลอกด้วยตนเอง",
      });
    }
  };
  return (
    <section className="admin-account-provision">
      <div className="admin-detail-section-title">
        <h3 className="admin-detail-heading">บัญชีเข้าสู่ระบบผู้รับบริการ</h3>
        <span
          className={`badge badge-${user.accountEnabled ? "success" : "neutral"}`}
        >
          {user.accountEnabled ? "เปิดบัญชีแล้ว" : "ยังไม่เปิดบัญชี"}
        </span>
      </div>
      <p className="admin-risk-description">
        ใช้เลขประจำตัวประชาชนและรหัสผ่านเริ่มต้น 6 หลัก
        ผู้รับบริการต้องเปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก
      </p>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {issued ? (
        <div className="admin-issued-account">
          <dl>
            <DetailField
              label="เลขประจำตัวสำหรับเข้าสู่ระบบ"
              value={issued.citizenId}
            />
          </dl>
          <Field label="รหัสผ่านเริ่มต้นที่ออกให้" id="issued-patient-password">
            <div className="admin-password-input">
              <input
                id="issued-patient-password"
                className="input"
                type={showIssued ? "text" : "password"}
                value={issued.password}
                readOnly
                autoComplete="off"
              />
              <button
                type="button"
                className="admin-icon-button"
                aria-label={
                  showIssued
                    ? "ซ่อนรหัสผ่านเริ่มต้นที่ออกให้"
                    : "แสดงรหัสผ่านเริ่มต้นที่ออกให้"
                }
                onClick={() => setShowIssued((value) => !value)}
              >
                {showIssued ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          <Button variant="secondary" onClick={copyCode}>
            คัดลอกรหัสผ่านเริ่มต้น
          </Button>
          <p className="admin-account-handover">
            ส่งมอบรหัสให้ผู้รับบริการผ่านช่องทางที่ปลอดภัย
            รหัสนี้จะแสดงเฉพาะครั้งนี้และถูกล้างเมื่อปิดหน้ารายละเอียด
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="admin-account-form">
          <Field
            label="กำหนดรหัสผ่านเริ่มต้น"
            id="patient-temporary-password"
            hint="ตัวเลข 6 หลัก กำหนดเองหรือกดสุ่มรหัส"
            required
          >
            <div className="admin-password-input">
              <input
                className="input"
                id="patient-temporary-password"
                type={showPassword ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                autoComplete="new-password"
                value={password}
                disabled={saving || disabled}
                onChange={(event) => {
                  setPassword(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  );
                  setConfirmReset(false);
                }}
              />
              <button
                type="button"
                className="admin-icon-button"
                aria-label={
                  showPassword ? "ซ่อนรหัสผ่านเริ่มต้น" : "แสดงรหัสผ่านเริ่มต้น"
                }
                disabled={saving || disabled}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          {confirmReset && (
            <Notice tone="warning">
              บัญชีนี้เปิดใช้งานแล้ว การตั้งรหัสใหม่จะทำให้รหัสผ่านเดิมใช้ไม่ได้
              และผู้รับบริการต้องเปลี่ยนรหัสผ่านอีกครั้ง
            </Notice>
          )}
          <div className="inline-actions">
            <Button
              variant="secondary"
              onClick={generateCode}
              disabled={saving || disabled}
            >
              สุ่มรหัส 6 หลัก
            </Button>
            {confirmReset ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmReset(false)}
                  disabled={saving || disabled}
                >
                  ยกเลิก
                </Button>
                <Button type="submit" loading={saving} disabled={disabled}>
                  ยืนยันตั้งรหัสใหม่
                </Button>
              </>
            ) : (
              <Button type="submit" loading={saving} disabled={disabled}>
                {user.accountEnabled
                  ? "ตั้งรหัสผ่านเริ่มต้นใหม่"
                  : "เปิดบัญชีผู้รับบริการ"}
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
function SettingsPanel({ profile }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage({
        tone: "error",
        text: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร",
      });
      return;
    }
    if (password !== confirm) {
      setMessage({
        tone: "error",
        text: "รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง",
      });
      return;
    }
    setSaving(true);
    try {
      await changeAdminPassword(password);
      notifyPasswordChanged("admin");
      setPassword("");
      setConfirm("");
      setMessage({ tone: "success", text: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
    } catch (error) {
      setMessage({
        tone: "error",
        text: getApiError(error, "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"),
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="admin-settings-grid">
      <section className="panel">
        <div className="panel-header">
          <div><span className="admin-section-access">อ่านอย่างเดียว</span><h2 className="section-heading">ข้อมูลบัญชี</h2></div>
          <Settings2 size={20} />
        </div>
        <div className="panel-body">
          <div className="admin-account-profile">
            <span className="admin-member-avatar">
              {(profile.email || "A").slice(0, 1).toUpperCase()}
            </span>
            <dl className="admin-account-details">
              <div><dt>อีเมลบัญชีที่กำลังใช้งาน</dt><dd>{profile.email || "ไม่พบข้อมูลอีเมล"}</dd></div>
              <div><dt>สิทธิ์บัญชี</dt><dd><span className="badge badge-neutral">{profile.role === "superadmin" ? "ผู้ดูแลระบบหลัก" : profile.role === "admin" ? "ผู้ดูแลระบบ" : "ไม่พบข้อมูลสิทธิ์"}</span></dd></div>
            </dl>
          </div>
          <p className="admin-settings-note">
            ส่วนนี้แสดงข้อมูลบัญชีปัจจุบัน หากต้องการเปลี่ยนรหัสผ่าน ให้กรอกแบบฟอร์มเปลี่ยนรหัสผ่าน
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="admin-section-access is-editable">แก้ไขได้</span>
            <h2 className="section-heading">เปลี่ยนรหัสผ่าน</h2>
            <p className="muted">
              ใช้รหัสผ่านที่คาดเดายากและไม่ซ้ำกับบัญชีอื่น
            </p>
          </div>
          <LockKeyhole size={22} />
        </div>
        <form className="panel-body admin-password-form" onSubmit={submit}>
          <p className="admin-form-help">กรอกรหัสผ่านใหม่ทั้งสองช่องให้ตรงกัน แล้วกด “บันทึกรหัสผ่านใหม่”</p>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Field
            label="รหัสผ่านใหม่"
            id="admin-new-password"
            hint="อย่างน้อย 8 ตัวอักษร"
            required
          >
            <input
              className="input"
              id="admin-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field
            label="ยืนยันรหัสผ่านใหม่"
            id="admin-confirm-password"
            required
          >
            <input
              className="input"
              id="admin-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          <Button type="submit" loading={saving}>
            บันทึกรหัสผ่านใหม่
          </Button>
        </form>
      </section>
    </div>
  );
}

function RiskPolicyPanel() {
  return (
    <section className="panel admin-risk-policy">
      <div className="panel-header">
        <div>
          <span className="admin-section-access">เกณฑ์อ้างอิง · อ่านอย่างเดียว</span>
          <h2 className="section-heading">เกณฑ์แสดงผลและการเข้าถึงข้อมูล</h2>
          <p className="muted">
            เกณฑ์เดียวกันสำหรับแดชบอร์ดและผลประเมินของผู้รับบริการ
          </p>
        </div>
        <HeartPulse size={23} />
      </div>
      <div className="panel-body">
        <h3 className="admin-detail-heading">
          Thai CV Risk Score · ความเสี่ยงใน 10 ปี
        </h3>
        <div className="admin-risk-policy-grid">
          {Object.entries(CV_LEVELS).map(([key, item]) => (
            <div key={key} className={`admin-risk-policy-item is-${key}`}>
              <span className={`badge badge-${item.tone}`}>
                <span className="admin-risk-dot" />
                {item.label}
              </span>
              <strong>{item.range}</strong>
            </div>
          ))}
        </div>
        <p className="admin-risk-description">
          ช่วง 10–20% รวมคะแนนเท่ากับ 10% และ 20% ด้วย คะแนนมากกว่า 30% แสดงเป็น
          &gt;30%
          ส่วนข้อมูลไม่ครบหรืออยู่นอกเกณฑ์จะแสดงสถานะโดยไม่แทนค่าด้วยศูนย์
        </p>
        <a
          className="admin-model-reference"
          href="https://www.rama.mahidol.ac.th/cardio_vascular_risk/thai_cv_risk_score/"
          target="_blank"
          rel="noopener noreferrer"
        >
          แหล่งอ้างอิงแบบประเมิน · คณะแพทยศาสตร์โรงพยาบาลรามาธิบดี{" "}
          <ArrowRight size={14} />
        </a>
        <div className="admin-settings-info-grid">
          <div>
            <h3>ข้อมูลที่ใช้ประเมิน</h3>
            <p>
              อายุ เพศ ประวัติสูบบุหรี่ ประวัติเบาหวาน ความดันตัวบน
              และคอเลสเตอรอลรวม โดยแยกผลประเมินออกจาก BMI
              แบบประเมินใช้สำหรับคนไทยอายุ 35–70
              ปีที่ไม่มีโรคหัวใจและหลอดเลือดอยู่เดิม
            </p>
          </div>
          <div>
            <h3>การนับสมาชิกในแดชบอร์ด</h3>
            <p>
              นับสมาชิกแต่ละคนจากผลล่าสุด
              ส่วนประวัติสุขภาพแสดงผลประเมินที่บันทึกไว้ในเวลานั้น
            </p>
          </div>
          <div>
            <h3>การเปิดบัญชีผู้รับบริการ</h3>
            <p>
              เจ้าหน้าที่เป็นผู้เปิดบัญชี
              ใช้เลขประจำตัวประชาชนกับรหัสผ่านเริ่มต้น 6 หลัก
              และเปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก
            </p>
          </div>
          <div>
            <h3>การจัดการรหัสผ่าน</h3>
            <p>
              รหัสที่ออกให้แสดงครั้งเดียวในหน้ารายละเอียดสมาชิก
              เจ้าหน้าที่ส่งมอบให้ผู้รับบริการผ่านช่องทางที่ปลอดภัย
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
