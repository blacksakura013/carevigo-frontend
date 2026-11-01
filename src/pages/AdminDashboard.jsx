import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatThaiDate } from "../utils/thaiDate";
import {
  Activity,
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
import LegalLinks from "../components/LegalLinks";
import { notifyPasswordChanged } from "../utils/flowFeedback";

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
  dashboard: "ภาพรวมการดูแล",
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
  const value = record?.value || {};
  const shown = (v) => (v === null || v === undefined || v === "" ? "—" : v);
  if (record?.type === "blood_pressure")
    return `${shown(value.systolic)}/${shown(value.diastolic)} mmHg`;
  if (record?.type === "sugar") return `${shown(value.fbs)} mg/dL`;
  if (record?.type === "cholesterol") return `${shown(value.total)} mg/dL`;
  if (record?.type === "bmi")
    return record.bmi != null ? `${record.bmi} kg/m²` : "—";
  return "—";
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
function BmiBadge({ record }) {
  const assessment = BMI_LEVELS[record?.cvdRisk?.level];
  return assessment ? (
    <span className={`badge badge-${assessment[1]}`}>{assessment[0]}</span>
  ) : (
    <span className="muted">ไม่มีข้อมูล BMI</span>
  );
}
function getCvLevel(risk) {
  if (
    risk?.status !== "calculated" ||
    typeof risk.score !== "number" ||
    !Number.isFinite(risk.score) ||
    risk.score < 0
  )
    return null;
  return risk.score < 10 ? "low" : risk.score <= 20 ? "moderate" : "high";
}
function CvRiskBadge({ risk, showReason = false }) {
  const level = getCvLevel(risk);
  if (level) {
    const rounded = Number(risk.score.toFixed(2));
    const displayScore =
      risk.displayScore ||
      (risk.score > 30
        ? ">30%"
        : level === "low" && rounded >= 10
          ? "<10%"
          : level === "high" && rounded <= 20
            ? ">20%"
            : `${risk.score.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`);
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
function StatCard({ icon: Icon, label, value, note, tone = "mint" }) {
  return (
    <div className="admin-stat-card" data-motion-enter="panel">
      <div className={`admin-stat-icon ${tone}`}>
        <Icon size={21} />
      </div>
      <span className="admin-stat-label">{label}</span>
      <strong>{formatNumber(value)}</strong>
      <span className="admin-stat-note">{note}</span>
    </div>
  );
}

function HealthChart({ summary, loading, error }) {
  const bars = Object.entries(TYPES).map(([key, type]) => ({
    ...type,
    value: Number(summary?.[key]) || 0,
  }));
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <section className="panel admin-chart-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">HEALTH ACTIVITY</span>
          <h2 className="section-heading">ภาพรวมการบันทึกสุขภาพ</h2>
          <p className="muted">จำนวนรายการทั้งหมด แยกตามประเภท</p>
        </div>
        <span className="admin-chart-key">
          <span /> ข้อมูลในระบบ
        </span>
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="panel-body">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Activity}
          title="ยังไม่มีการบันทึกสุขภาพ"
          description="กราฟจะแสดงเมื่อมีสมาชิกบันทึกข้อมูลเข้ามา"
        />
      ) : (
        <>
          <div
            className="admin-bar-chart"
            role="img"
            aria-label={bars
              .map((bar) => `${bar.label} ${bar.value} รายการ`)
              .join(", ")}
          >
            <div className="admin-chart-grid">
              <span>{formatNumber(max)}</span>
              <span>{formatNumber(max / 2)}</span>
              <span>0</span>
            </div>
            <div className="admin-chart-bars">
              {bars.map((bar) => (
                <div className="admin-chart-column" key={bar.label}>
                  <strong>{formatNumber(bar.value)}</strong>
                  <div className="admin-chart-bar-track">
                    <div
                      className="admin-chart-bar"
                      style={{
                        height: `${(bar.value / max) * 100}%`,
                        background: bar.color,
                      }}
                    />
                  </div>
                  <span>{bar.short}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-chart-footer">
            <ClipboardList size={16} />
            <span>
              รวม <strong>{formatNumber(total)}</strong> รายการบันทึกสุขภาพ
            </span>
          </div>
        </>
      )}
    </section>
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
            โอกาสเกิดโรคใน 10 ปี · นับสมาชิกแต่ละคนจากผลประเมินล่าสุด
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
    total: 0,
    hasMore: false,
  });
  const [healthPage, setHealthPage] = useState(1);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
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
    getDashboardHealth(healthPage, PAGE_SIZE)
      .then((response) => {
        if (!cancelled) {
          const body = response?.data || {};
          setHealth({
            records: body.data?.records || [],
            summary: body.data?.summary || {},
            total: body.total || 0,
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
  }, [healthPage, refreshKey]);
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
  const records = useMemo(
    () =>
      health.records
        .filter((record) => {
          const query = search.trim().toLowerCase();
          const match = [
            fullName(record.user),
            record.user?.citizenId,
            record.user?.province,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(query),
          );
          const cvLevel = getCvLevel(record.thaiCvRisk);
          return (
            match &&
            (type === "all" || record.type === type) &&
            (bmiLevel === "all" || record.cvdRisk?.level === bmiLevel) &&
            (riskLevel === "all" ||
              (riskLevel === "unavailable" && !cvLevel) ||
              cvLevel === riskLevel)
          );
        })
        .sort((a, b) => {
          if (sort === "name")
            return fullName(a.user).localeCompare(fullName(b.user), "th");
          if (sort === "risk_desc" || sort === "risk_asc") {
            const aScore = getCvLevel(a.thaiCvRisk) ? a.thaiCvRisk.score : null;
            const bScore = getCvLevel(b.thaiCvRisk) ? b.thaiCvRisk.score : null;
            if (aScore === null) return bScore === null ? 0 : 1;
            if (bScore === null) return -1;
            return (bScore - aScore) * (sort === "risk_asc" ? -1 : 1);
          }
          return (
            (new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()) *
            (sort === "oldest" ? -1 : 1)
          );
        }),
    [health.records, search, type, bmiLevel, riskLevel, sort],
  );
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
  const verified = Number(verification?.verified) || 0;
  const pending = Number(verification?.pending) || 0;
  const rejected = Number(verification?.rejected) || 0;
  const verificationTotal =
    Number(verification?.total ?? summary?.totalUsers) || 0;
  const verifiedPercent = verificationTotal
    ? Math.round((verified / verificationTotal) * 100)
    : 0;

  return (
    <div className="admin-shell">
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
                ? "เห็นภาพสุขภาพชัดเจน เชื่อมต่อทุกการดูแลไว้ในที่เดียว"
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
              <section className="admin-welcome" data-motion-enter="panel">
                <div>
                  <div className="admin-welcome-label">
                    <span /> พร้อมดูแลไปด้วยกัน
                  </div>
                  <h2>ทุกการดูแล เริ่มต้นจากข้อมูลที่ชัดเจน</h2>
                  <p>
                    ติดตามการบันทึกสุขภาพ
                    และให้สมาชิกเข้าถึงการดูแลอย่างต่อเนื่อง
                  </p>
                  <button onClick={() => changeMenu("members")}>
                    ดูทะเบียนสมาชิก <ArrowRight size={16} />
                  </button>
                </div>
                <div className="admin-welcome-art" aria-hidden="true">
                  <div className="admin-welcome-orbit" />
                  <HeartPulse size={75} strokeWidth={1.1} />
                  <span className="admin-art-plus">+</span>
                </div>
              </section>
              <div className="admin-stats">
                <StatCard
                  icon={Users}
                  label="สมาชิกทั้งหมด"
                  value={summary?.totalUsers}
                  note="สมาชิกที่ลงทะเบียนในระบบ"
                />
                <StatCard
                  icon={ClipboardList}
                  label="บันทึกสุขภาพทั้งหมด"
                  value={summary?.totalHealthRecords}
                  note="รวมทุกประเภทการบันทึก"
                  tone="blue"
                />
                <StatCard
                  icon={HeartPulse}
                  label="บันทึกสุขภาพวันนี้"
                  value={summary?.todayHealthRecords}
                  note="ตามวันที่ของระบบเซิร์ฟเวอร์"
                  tone="rose"
                />
                <StatCard
                  icon={ShieldCheck}
                  label="สมาชิกรอยืนยัน"
                  value={verification?.pending}
                  note="รอผู้ดูแลตรวจสอบข้อมูล"
                  tone="amber"
                />
              </div>
              <RiskOverview
                counts={summary?.thaiCvRisk}
                loading={overviewLoading}
                onSelect={openRiskMembers}
              />
              <div className="admin-overview-grid">
                <HealthChart
                  summary={health.summary}
                  loading={healthLoading && !health.records.length}
                  error={healthError}
                />
                <section className="panel admin-verification-card">
                  <div className="panel-header">
                    <div>
                      <span className="eyebrow">MEMBER VERIFICATION</span>
                      <h2 className="section-heading">การยืนยันสมาชิก</h2>
                    </div>
                    <ShieldCheck size={23} />
                  </div>
                  {overviewLoading ? (
                    <Skeleton rows={3} />
                  ) : !verification ? (
                    <EmptyState
                      icon={ShieldCheck}
                      title="ยังโหลดข้อมูลไม่ได้"
                      description="รีเฟรชข้อมูลเพื่อลองอีกครั้ง"
                    />
                  ) : (
                    <div className="panel-body">
                      <div className="admin-verification-number">
                        <strong>
                          {verifiedPercent}
                          <small>%</small>
                        </strong>
                        <span>ยืนยันแล้วจากสถานะที่ระบบรายงาน</span>
                      </div>
                      <div
                        className="admin-verification-progress"
                        role="img"
                        aria-label={`ยืนยันแล้ว ${verified} รอยืนยัน ${pending} ไม่ผ่าน ${rejected}`}
                      >
                        <span style={{ width: `${verifiedPercent}%` }} />
                      </div>
                      <div className="admin-verification-line">
                        <span>
                          <i className="is-verified" />
                          ยืนยันแล้ว
                        </span>
                        <strong>
                          {formatNumber(verified)} <small>คน</small>
                        </strong>
                      </div>
                      <div className="admin-verification-line">
                        <span>
                          <i className="is-pending" />
                          รอการยืนยัน
                        </span>
                        <strong>
                          {formatNumber(pending)} <small>คน</small>
                        </strong>
                      </div>
                      {rejected > 0 && (
                        <div className="admin-verification-line">
                          <span>
                            <i className="is-rejected" />
                            ไม่ผ่านการยืนยัน
                          </span>
                          <strong>
                            {formatNumber(rejected)} <small>คน</small>
                          </strong>
                        </div>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => changeMenu("verification")}
                      >
                        ตรวจสอบสมาชิก <ArrowRight size={16} />
                      </Button>
                    </div>
                  )}
                </section>
              </div>
              <section className="panel admin-records-panel">
                <div className="panel-header">
                  <div>
                    <span className="eyebrow">HEALTH RECORDS</span>
                    <h2 className="section-heading">
                      บันทึกสุขภาพล่าสุด{" "}
                      <span className="admin-heading-count">
                        {formatNumber(health.total)}
                      </span>
                    </h2>
                    <p className="muted">
                      ค้นหา กรอง และเรียงลำดับเฉพาะ {health.records.length}{" "}
                      รายการในหน้านี้
                    </p>
                  </div>
                  <span className="admin-updated">
                    {lastUpdated
                      ? `อัปเดต ${lastUpdated.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`
                      : "กำลังอัปเดต"}
                  </span>
                </div>
                <div className="admin-record-filters">
                  <label className="admin-search">
                    <Search size={18} />
                    <input
                      className="input"
                      aria-label="ค้นหาบันทึกสุขภาพในหน้านี้"
                      placeholder="ค้นหาชื่อ เลขประจำตัว หรือจังหวัด"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <select
                    className="input"
                    aria-label="ประเภทบันทึก"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                  >
                    <option value="all">ทุกประเภท</option>
                    {Object.entries(TYPES).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    aria-label="ความเสี่ยง Thai CV"
                    value={riskLevel}
                    onChange={(event) => setRiskLevel(event.target.value)}
                  >
                    <option value="all">ทุกระดับ Thai CV</option>
                    {Object.entries(CV_LEVELS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label} ({item.range})
                      </option>
                    ))}
                    <option value="unavailable">ยังประเมินไม่ได้</option>
                  </select>
                  <select
                    className="input"
                    aria-label="การจัดกลุ่ม BMI"
                    value={bmiLevel}
                    onChange={(event) => setBmiLevel(event.target.value)}
                  >
                    <option value="all">ทุกกลุ่ม BMI</option>
                    {Object.entries(BMI_LEVELS).map(([key, [label]]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="admin-sort">
                    <ArrowDownUp size={15} />
                    <select
                      className="input"
                      aria-label="เรียงลำดับบันทึก"
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="newest">ใหม่สุดก่อน</option>
                      <option value="oldest">เก่าสุดก่อน</option>
                      <option value="name">ตามชื่อสมาชิก</option>
                      <option value="risk_desc">Thai CV สูงสุดก่อน</option>
                      <option value="risk_asc">Thai CV ต่ำสุดก่อน</option>
                    </select>
                  </label>
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
                  <EmptyState
                    icon={ClipboardList}
                    title={
                      health.records.length
                        ? "ไม่พบข้อมูลที่ตรงกับตัวกรอง"
                        : "ยังไม่มีบันทึกสุขภาพ"
                    }
                    description={
                      health.records.length
                        ? "ลองเปลี่ยนคำค้นหาหรือเลือกประเภทอื่น"
                        : "ข้อมูลจะแสดงเมื่อสมาชิกบันทึกสุขภาพ"
                    }
                    action={
                      health.records.length ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSearch("");
                            setType("all");
                            setBmiLevel("all");
                            setRiskLevel("all");
                          }}
                        >
                          ล้างตัวกรอง
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="ตารางบันทึกสุขภาพ เลื่อนเพื่อดูข้อมูลเพิ่มเติม">
                    <table className="admin-table admin-health-table">
                      <caption className="sr-only">บันทึกสุขภาพสมาชิก</caption>
                      <thead>
                        <tr>
                          <th>สมาชิก</th>
                          <th>ประเภท / ค่าที่บันทึก</th>
                          <th>Thai CV Risk · 10 ปี</th>
                          <th>การจัดกลุ่ม BMI</th>
                          <th>จังหวัด</th>
                          <th>วันที่บันทึก</th>
                          <th>
                            <span className="sr-only">รายละเอียด</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => {
                          const TypeIcon = TYPES[record.type]?.icon || Activity;
                          return (
                            <tr key={record._id}>
                              <td>
                                <div className="admin-person">
                                  <span className="admin-person-avatar">
                                    {fullName(record.user).slice(0, 1)}
                                  </span>
                                  <div>
                                    <strong>{fullName(record.user)}</strong>
                                    <span>
                                      {maskCitizenId(record.user?.citizenId)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="admin-record-value">
                                  <TypeIcon size={16} />
                                  <div>
                                    <strong>{recordValue(record)}</strong>
                                    <span>
                                      {TYPES[record.type]?.label || record.type}
                                    </span>
                                    <ReviewStatusBadge
                                      status={record.reviewStatus || "approved"}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <CvRiskBadge risk={record.thaiCvRisk} />
                              </td>
                              <td>
                                <BmiBadge record={record} />
                                {record.bmi != null && (
                                  <span className="admin-cell-note">
                                    BMI {record.bmi} kg/m²
                                  </span>
                                )}
                              </td>
                              <td>{record.user?.province || "—"}</td>
                              <td className="admin-date-cell">
                                {dateLabel(record.createdAt, true)}
                              </td>
                              <td>
                                {record.user?._id && (
                                  <button
                                    className="admin-table-action"
                                    aria-label={`ดูข้อมูล ${fullName(record.user)}`}
                                    onClick={() => setSelected(record.user)}
                                  >
                                    <ChevronRight size={18} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
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
                  Thai CV Risk แสดงผลประเมินที่บันทึก ณ เวลานั้น
                  แยกจากการจัดกลุ่ม BMI
                  และแสดงเฉพาะข้อมูลที่ครบตามเกณฑ์แบบประเมิน
                </p>
              </section>
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
          <h2 className="section-heading">ข้อมูลบัญชี</h2>
          <Settings2 size={20} />
        </div>
        <div className="panel-body">
          <div className="admin-account-profile">
            <span className="admin-member-avatar">
              {(profile.email || "A").slice(0, 1).toUpperCase()}
            </span>
            <strong>ผู้ดูแลระบบ</strong>
            <span className="muted">
              {profile.email || "ไม่พบข้อมูลอีเมล"}
            </span>
            <span className="badge badge-success">
              {profile.role || "admin"}
            </span>
          </div>
          <p className="admin-settings-note">
            ข้อมูลบัญชีที่ยืนยันกับระบบแล้ว
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="section-heading">เปลี่ยนรหัสผ่าน</h2>
            <p className="muted">
              ใช้รหัสผ่านที่คาดเดายากและไม่ซ้ำกับบัญชีอื่น
            </p>
          </div>
          <LockKeyhole size={22} />
        </div>
        <form className="panel-body admin-password-form" onSubmit={submit}>
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
          <span className="eyebrow">ASSESSMENT & ACCESS</span>
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
