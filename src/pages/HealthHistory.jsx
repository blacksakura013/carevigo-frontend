import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatThaiDate } from "../utils/thaiDate";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Droplets,
  HeartPulse,
  History,
  IdCard,
  Plus,
  Printer,
  Scale,
  Search,
  UserRound,
} from "lucide-react";
import {
  getHealthByType,
  getPatientProfile,
  getStoredPatient,
  hasPatientSession,
  searchUser,
} from "../api/api";
import { ThaiCvRiskCard } from "./AddHealth";
import {
  Button,
  EmptyState,
  Field,
  Notice,
  PageHeading,
  PublicLayout,
} from "../components/ui";
import "../styles/patient.css";

const TYPES = [
  { type: "all", label: "ทั้งหมด", icon: ClipboardList },
  {
    type: "blood_pressure",
    label: "ความดันโลหิต",
    icon: HeartPulse,
    color: "coral",
  },
  { type: "sugar", label: "น้ำตาลในเลือด", icon: Droplets, color: "blue" },
  {
    type: "cholesterol",
    label: "ไขมันในเลือด",
    icon: Activity,
    color: "amber",
  },
  { type: "bmi", label: "น้ำหนัก / BMI", icon: Scale, color: "teal" },
];
const TYPE_MAP = Object.fromEntries(TYPES.map((item) => [item.type, item]));
const DISPLAY_FIELDS = {
  blood_pressure: {
    systolic: ["SYS", "mmHg"],
    diastolic: ["DIA", "mmHg"],
    pulse: ["ชีพจร", "ครั้ง/นาที"],
  },
  sugar: { fbs: ["FBS", "mg/dL"], hba1c: ["HbA1c", "%"] },
  cholesterol: {
    total: ["Total", "mg/dL"],
    ldl: ["LDL", "mg/dL"],
    hdl: ["HDL", "mg/dL"],
    triglyceride: ["TG", "mg/dL"],
  },
};

function formatDate(value, time = false) {
  return formatThaiDate(value, { withTime: time, empty: "ไม่ระบุวันที่" });
}
export function recordMeasurements(record) {
  if (record.type === "bmi")
    return [
      {
        label: "น้ำหนัก",
        value: record.weight ?? record.value?.weight,
        unit: "กก.",
      },
      {
        label: "ส่วนสูง",
        value: record.height ?? record.value?.height,
        unit: "ซม.",
      },
    ].filter(({ value }) => value != null && value !== "");
  return Object.entries(DISPLAY_FIELDS[record.type] || {})
    .filter(
      ([name]) => record.value?.[name] != null && record.value[name] !== "",
    )
    .map(([name, [label, unit]]) => ({
      label,
      unit,
      value: record.value[name],
    }));
}
const REVIEW_STATES = {
  pending: { label: "รอตรวจสอบ", className: "badge-warning" },
  approved: { label: "ยืนยันแล้ว", className: "badge-success" },
  rejected: { label: "ไม่ผ่านการตรวจสอบ", className: "badge-danger" },
};
export function ReviewStatusBadge({ status = "approved" }) {
  const state = REVIEW_STATES[status] || {
    label: "อยู่ระหว่างดำเนินการ",
    className: "badge-neutral",
  };
  return <span className={`badge ${state.className}`}>{state.label}</span>;
}
function reviewSource(source) {
  if (/auto|deadline/.test(source || "")) return "ยืนยันอัตโนมัติตามกำหนด";
  if (/email/.test(source || "")) return "เจ้าหน้าที่ตรวจสอบผ่านอีเมล";
  return (
    {
      guest: "แบบฟอร์มไม่เข้าสู่ระบบ",
      patient: "บัญชีผู้รับบริการ",
      public: "แบบบันทึกสุขภาพ",
      admin: "เจ้าหน้าที่",
      staff: "เจ้าหน้าที่",
      manual: "เจ้าหน้าที่",
      system: "ระบบ",
    }[source] || "ระบบ"
  );
}
export function ReviewAudit({ record }) {
  const status = record.reviewStatus || "approved";
  const events = Array.isArray(record.reviewHistory)
    ? record.reviewHistory
    : [];
  return (
    <div className="patient-review-meta">
      <ReviewStatusBadge status={status} />
      <small>
        ที่มา:{" "}
        {reviewSource(
          record.source || (record.submissionId ? "guest" : "public"),
        )}
      </small>
      {status === "pending" && record.reviewDueAt && (
        <small>
          ยืนยันอัตโนมัติ {formatDate(record.reviewDueAt, true)} น. (เวลาไทย)
        </small>
      )}
      {status === "rejected" && record.reviewReason && (
        <p className="patient-review-reason">เหตุผล: {record.reviewReason}</p>
      )}
      <details className="patient-review-audit">
        <summary>ดูเส้นทางการตรวจสอบ</summary>
        <ol>
          <li>
            <strong>บันทึกเข้าระบบ</strong>
            <span>
              {formatDate(record.submittedAt || record.createdAt, true)} น.
            </span>
          </li>
          {events.map((event, index) => (
            <li key={`${event.at}-${event.to}-${index}`}>
              <strong>{REVIEW_STATES[event.to]?.label || "อัปเดตสถานะ"}</strong>
              <span>
                {formatDate(event.at, true)} น. · {reviewSource(event.source)}
              </span>
              {event.reason && <p>{event.reason}</p>}
            </li>
          ))}
          {!events.length && record.reviewedAt && (
            <li>
              <strong>{REVIEW_STATES[status]?.label || "ตรวจสอบรายการ"}</strong>
              <span>
                {formatDate(record.reviewedAt, true)} น. ·{" "}
                {reviewSource(record.reviewSource)}
              </span>
              {record.reviewReason && <p>{record.reviewReason}</p>}
            </li>
          )}
        </ol>
      </details>
    </div>
  );
}

export default function HealthHistory() {
  const { citizenId: routeCitizenId } = useParams();
  const patientMode = hasPatientSession();
  const citizenId = patientMode
    ? getStoredPatient()?.citizenId
    : routeCitizenId;
  const navigate = useNavigate();
  const validId = /^\d{13}$/.test(citizenId || "");
  const [lookupId, setLookupId] = useState(citizenId || "");
  const [lookupError, setLookupError] = useState("");
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [type, setType] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [serverFiltered, setServerFiltered] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const version = useRef(0);
  const historyHeading = useRef(null);
  const resultsForId = validId && lookupId === citizenId;

  useEffect(() => {
    document.title = "ประวัติสุขภาพ | Save Stroke";
  }, []);
  useEffect(() => {
    setLookupId(citizenId || "");
    setType("all");
  }, [citizenId]);
  const load = useCallback(
    async (nextPage, append, requestVersion) => {
      setLoading(true);
      setError("");
      try {
        const response = await getHealthByType(
          citizenId,
          type === "all" ? undefined : type,
          nextPage,
          10,
        );
        if (version.current !== requestVersion) return;
        const data = Array.isArray(response.data?.data)
          ? response.data.data
          : [];
        if (type !== "all" && data.some((record) => record.type !== type))
          setServerFiltered(false);
        setRecords((previous) => {
          if (!append) return data;
          const existingIds = new Set(
            previous.map((item) => item._id).filter(Boolean),
          );
          return [
            ...previous,
            ...data.filter((item) => !item._id || !existingIds.has(item._id)),
          ];
        });
        setPage(nextPage);
        setTotal(Number(response.data?.total) || data.length);
        setHasMore(
          Boolean(
            response.data?.hasMore ??
            nextPage * (Number(response.data?.limit) || 10) <
              Number(response.data?.total),
          ),
        );
      } catch (requestError) {
        if (version.current === requestVersion)
          setError(
            "โหลดประวัติไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
          );
      } finally {
        if (version.current === requestVersion) setLoading(false);
      }
    },
    [citizenId, type],
  );

  useEffect(() => {
    const requestVersion = ++version.current;
    setRecords([]);
    setPage(0);
    setTotal(0);
    setHasMore(false);
    setServerFiltered(true);
    setError("");
    if (!validId) {
      setLoading(false);
      return;
    }
    load(1, false, requestVersion);
    return () => {
      version.current += 1;
    };
  }, [load, validId, attempt]);
  useEffect(() => {
    setProfile(null);
    if (!validId) return;
    let active = true;
    (patientMode ? getPatientProfile() : searchUser(citizenId))
      .then((response) => {
        if (active)
          setProfile(
            response.data?.data?.patient || response.data?.data || null,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [citizenId, validId, patientMode]);

  const search = (event) => {
    event.preventDefault();
    if (!/^\d{13}$/.test(lookupId)) {
      setLookupError("กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก");
      return;
    }
    setLookupError("");
    if (lookupId === citizenId) setAttempt((previous) => previous + 1);
    else navigate(`/history/${lookupId}`);
    setTimeout(() => historyHeading.current?.focus(), 0);
  };
  const shownRecords = records.filter(
    (record) => type === "all" || record.type === type,
  );
  const latest = shownRecords[0];

  return (
    <PublicLayout active="history">
      <PageHeading
        eyebrow="YOUR HEALTH JOURNEY"
        title="ทุกบันทึก คือความใส่ใจในตัวคุณ"
        description="ดูผลตรวจย้อนหลัง และติดตามสุขภาพของคุณอย่างต่อเนื่อง"
      >
        <Link
          className="btn btn-primary"
          to={validId ? `/health/${citizenId}` : "/health"}
        >
          <Plus size={17} /> บันทึกสุขภาพ
        </Link>
      </PageHeading>
      {!patientMode && (
        <section className="panel patient-history-search">
          <div className="patient-panel-title">
            <span className="patient-icon">
              <IdCard size={22} />
            </span>
            <div>
              <h2>ค้นหาประวัติสุขภาพ</h2>
              <p>กรอกเลขบัตรประชาชนของผู้รับบริการ</p>
            </div>
          </div>
          <form className="panel-body" onSubmit={search} noValidate>
            <Field
              label="เลขบัตรประชาชน"
              id="history-citizenId"
              error={lookupError}
              required
              hint="ใช้ข้อมูลของตนเอง หรือผู้ที่คุณได้รับอนุญาตให้ดูแล"
            >
              <div className="patient-lookup-row">
                <input
                  id="history-citizenId"
                  className="input patient-id-input"
                  inputMode="numeric"
                  maxLength={13}
                  autoComplete="off"
                  required
                  value={lookupId}
                  onChange={(event) => {
                    setLookupId(
                      event.target.value.replace(/\D/g, "").slice(0, 13),
                    );
                    setLookupError("");
                  }}
                  placeholder="เลขบัตรประชาชน 13 หลัก"
                  aria-invalid={Boolean(lookupError)}
                />
                <Button type="submit" loading={loading && resultsForId}>
                  <Search size={17} /> ค้นหาประวัติ
                </Button>
              </div>
            </Field>
          </form>
        </section>
      )}
      {!resultsForId ? (
        <section className="panel patient-history-welcome">
          <EmptyState
            icon={History}
            title="เรื่องราวสุขภาพของคุณ อยู่ที่นี่"
            description="ค้นหาด้วยเลขบัตรประชาชน เพื่อดูข้อมูลสุขภาพที่เคยบันทึกไว้"
          />
          <div className="patient-history-categories">
            {TYPES.slice(1).map(
              ({ type: itemType, label, icon: Icon, color }) => (
                <div key={itemType}>
                  <span className={`patient-icon patient-icon-${color}`}>
                    <Icon size={21} />
                  </span>
                  <span>{label}</span>
                </div>
              ),
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="patient-history-overview">
            <div>
              <span className="patient-icon">
                <UserRound size={22} />
              </span>
              <div>
                <span className="muted">ผู้รับบริการ</span>
                <strong>
                  {profile?.firstName
                    ? `${profile.firstName} ${profile.lastName || ""}`
                    : `เลขบัตรลงท้าย ${citizenId.slice(-4)}`}
                </strong>
              </div>
            </div>
            <div>
              <span className="patient-icon">
                <ClipboardList size={22} />
              </span>
              <div>
                <span className="muted">
                  รายการ
                  {type !== "all" && serverFiltered ? "ในหมวดนี้" : "ทั้งหมด"}
                </span>
                <strong>
                  {loading && page === 0 ? "…" : total.toLocaleString("th-TH")}{" "}
                  <small>รายการ</small>
                </strong>
              </div>
            </div>
            <div>
              <span className="patient-icon">
                <CalendarDays size={22} />
              </span>
              <div>
                <span className="muted">
                  บันทึกล่าสุด{type !== "all" ? "ในหมวดนี้" : ""}
                </span>
                <strong className="patient-overview-date">
                  {latest ? formatDate(latest.createdAt || latest.date) : "—"}
                </strong>
              </div>
            </div>
          </div>
          {profile && <ThaiCvRiskCard risk={profile.thaiCvRisk} />}
          <section className="panel patient-history-panel" aria-busy={loading}>
            <div className="panel-header">
              <div ref={historyHeading} tabIndex={-1}>
                <h2>ประวัติการบันทึกสุขภาพ</h2>
                <p>เรียงจากล่าสุด · แสดงตามวันที่บันทึกข้อมูล</p>
              </div>
              {shownRecords.length > 0 && (
                <Button variant="ghost" onClick={() => window.print()}>
                  <Printer size={17} /> พิมพ์รายการที่แสดง
                </Button>
              )}
            </div>
            <div
              className="patient-history-filters"
              role="group"
              aria-label="กรองประเภทข้อมูลสุขภาพ"
            >
              {TYPES.map(({ type: filterType, label, icon: Icon }) => (
                <button
                  type="button"
                  key={filterType}
                  className={type === filterType ? "is-active" : ""}
                  aria-pressed={type === filterType}
                  onClick={() => setType(filterType)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            {error && (
              <div className="patient-history-notice">
                <Notice tone="error">
                  {error}{" "}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      page > 0
                        ? load(page + 1, true, version.current)
                        : setAttempt((previous) => previous + 1)
                    }
                  >
                    ลองอีกครั้ง
                  </Button>
                </Notice>
              </div>
            )}
            {loading && !records.length ? (
              <div className="patient-history-loading" role="status">
                <div className="patient-skeleton" />
                <div className="patient-skeleton" />
                <div className="patient-skeleton" />
                <span>กำลังโหลดประวัติสุขภาพ…</span>
              </div>
            ) : !shownRecords.length && !error ? (
              <EmptyState
                icon={History}
                title={
                  type === "all"
                    ? "ยังไม่มีประวัติสุขภาพ"
                    : "ยังไม่มีรายการในหมวดนี้"
                }
                description={
                  type === "all"
                    ? "เริ่มบันทึกครั้งแรก เพื่อเก็บข้อมูลไว้ติดตามสุขภาพของคุณ"
                    : "เลือกหมวดอื่น หรือเพิ่มข้อมูลสุขภาพครั้งใหม่"
                }
                action={
                  <Link className="btn btn-primary" to={`/health/${citizenId}`}>
                    บันทึกสุขภาพ <ArrowRight size={17} />
                  </Link>
                }
              />
            ) : (
              shownRecords.length > 0 && (
                <div className="patient-history-table-wrap">
                  <table className="patient-history-table">
                    <thead>
                      <tr>
                        <th scope="col">วันที่บันทึก</th>
                        <th scope="col">ประเภทการตรวจ</th>
                        <th scope="col">ค่าที่บันทึก</th>
                        <th scope="col">ผลจากระบบ</th>
                        <th scope="col">สถานะและการตรวจสอบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownRecords.map((record, index) => {
                        const meta = TYPE_MAP[record.type] || {
                          label: "ข้อมูลสุขภาพ",
                          icon: ClipboardList,
                          color: "teal",
                        };
                        const Icon = meta.icon;
                        const measures = recordMeasurements(record);
                        return (
                          <tr
                            key={
                              record._id ||
                              `${record.type}-${record.createdAt}-${index}`
                            }
                          >
                            <td data-label="วันที่บันทึก">
                              <span className="patient-record-date">
                                {formatDate(record.createdAt || record.date)}
                              </span>
                              <small>
                                {Number.isFinite(
                                  new Date(
                                    record.createdAt || record.date,
                                  ).getTime(),
                                )
                                  ? new Intl.DateTimeFormat("th-TH", {
                                      timeZone: "Asia/Bangkok",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }).format(
                                      new Date(record.createdAt || record.date),
                                    ) + " น."
                                  : ""}
                              </small>
                            </td>
                            <td data-label="ประเภทการตรวจ">
                              <div className="patient-record-type">
                                <span
                                  className={`patient-icon patient-icon-${meta.color}`}
                                >
                                  <Icon size={19} />
                                </span>
                                <span>{meta.label}</span>
                              </div>
                            </td>
                            <td data-label="ค่าที่บันทึก">
                              <div className="patient-record-measures">
                                {measures.length ? (
                                  measures.map(({ label, value, unit }) => (
                                    <div key={label}>
                                      <span>{label}</span>
                                      <strong>
                                        {String(value)} <small>{unit}</small>
                                      </strong>
                                    </div>
                                  ))
                                ) : (
                                  <span className="muted">ไม่มีค่าที่ระบุ</span>
                                )}
                              </div>
                            </td>
                            <td data-label="ผลจากระบบ">
                              {record.bmi != null ? (
                                <div className="patient-record-bmi">
                                  <span className="muted">BMI</span>
                                  <strong>{record.bmi}</strong>
                                </div>
                              ) : (
                                <span className="muted">—</span>
                              )}
                              <p className="patient-record-assessment">
                                {(record.reviewStatus || "approved") ===
                                  "approved" &&
                                record.thaiCvRisk?.status === "calculated" ? (
                                  <span
                                    className={`patient-cv-record patient-cv-record-${record.thaiCvRisk.level}`}
                                  >
                                    {record.thaiCvRisk.displayScore ||
                                      (Number(record.thaiCvRisk.score) > 30
                                        ? ">30%"
                                        : `${Number(record.thaiCvRisk.score).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`)}{" "}
                                    · {record.thaiCvRisk.label}
                                    {record.thaiCvRisk.inputs?.profileSource ===
                                      "submitted-profile" && (
                                      <span className="patient-risk-profile-source">
                                        ประเมินจากข้อมูลที่ส่งในรายการนี้
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span>
                                    {record.reviewStatus === "pending"
                                      ? "รอยืนยันข้อมูลก่อนนำไปประเมิน Thai CV"
                                      : record.reviewStatus === "rejected"
                                        ? "รายการนี้ไม่ถูกนำไปใช้ประเมิน Thai CV"
                                        : record.thaiCvRisk?.reason ||
                                          "ยังไม่มีผล Thai CV ในรายการนี้"}
                                  </span>
                                )}
                              </p>
                            </td>
                            <td data-label="สถานะและการตรวจสอบ">
                              <ReviewAudit record={record} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {records.length > 0 && (
              <div className="patient-history-footer">
                <p>
                  แสดง {shownRecords.length.toLocaleString("th-TH")} จาก{" "}
                  {total.toLocaleString("th-TH")} รายการ
                  {type !== "all" && serverFiltered ? "ในหมวดนี้" : "ทั้งหมด"}
                </p>
                {hasMore && (
                  <Button
                    variant="secondary"
                    loading={loading}
                    onClick={() => load(page + 1, true, version.current)}
                  >
                    <ArrowDown size={16} /> โหลดรายการเพิ่มเติม
                  </Button>
                )}
              </div>
            )}
          </section>
          <p className="patient-history-caption">
            แสดงทุกสถานะ รวมรายการที่รอตรวจสอบและไม่ผ่านการตรวจสอบ · Thai CV
            Risk Score ใช้เฉพาะข้อมูลที่ยืนยันแล้ว
          </p>
        </>
      )}
    </PublicLayout>
  );
}
