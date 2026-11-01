import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw, Search, TrendingUp } from "lucide-react";
import { getApiError, getHealthProgress, getStoredPatient } from "../api/api";
import { Button, EmptyState, Field, Notice, PageHeading, PublicLayout } from "../components/ui";
import BuddhistDateInput from "../components/BuddhistDateInput";
import HealthProgressPanel from "../components/HealthProgressPanel";
import { normalizeHealthProgress } from "../utils/healthProgress";
import { formatThaiDate, gregorianDate, todayGregorian } from "../utils/thaiDate";
import { getDashboardRecordModel } from "../utils/dashboardRecord";
import { ThaiCvRiskCard } from "./AddHealth";
import { recordMeasurements, ReviewAudit } from "./HealthHistory";
import "../styles/health-progress-page.css";

const TYPES = { blood_pressure: "ความดันโลหิต", sugar: "น้ำตาลในเลือด", cholesterol: "ไขมันในเลือด", bmi: "น้ำหนักและ BMI" };
const PERIODS = [["30", "30 วัน"], ["90", "90 วัน"], ["365", "1 ปี"], ["all", "ทั้งหมด"]];
const recordedAt = record => record.recordedAt || record.submittedAt || record.createdAt;
const dateLabel = value => formatThaiDate(value, { withTime: true, empty: "ไม่ระบุวันที่" });
function progressError(error) {
  if ([404, 405].includes(error.response?.status) || error.code === "PROGRESS_RESPONSE_INVALID")
    return "ระบบติดตามผลยังไม่พร้อมแสดงข้อมูล กรุณาแจ้งเจ้าหน้าที่หรือลองใหม่ภายหลัง";
  return getApiError(error, "โหลดผลติดตามสุขภาพไม่สำเร็จ กรุณาลองอีกครั้ง");
}

function LatestGuidance({ data }) {
  const records = Array.isArray(data.latestApprovedRecords) ? data.latestApprovedRecords : [];
  return <section className="panel progress-guidance" aria-label="สิ่งที่ควรติดตามจากผลล่าสุด">
    <div className="panel-header"><div><h2>สิ่งที่ควรติดตามจากผลล่าสุด</h2>
      <p>ใช้ผลที่ยืนยันแล้วล่าสุดของแต่ละหมวดในช่วงที่เลือก แต่ละหมวดอาจบันทึกคนละวัน</p></div></div>
    <div className="panel-body">
      <p className="progress-explanation">คำแนะนำอ้างอิงค่าตามวันที่บันทึก ไม่ใช่การยืนยันอาการปัจจุบันหรือเป้าหมายการรักษารายบุคคล</p>
      {!records.length && <p>ยังไม่มีผลที่ยืนยันแล้วในช่วงนี้สำหรับแสดงคำแนะนำ</p>}
      {records.map(record => {
        const model = getDashboardRecordModel({ ...record, user: data.patient });
        return <details className={`progress-guidance-item progress-guidance-${model.level}`} key={record.type}>
          <summary>{TYPES[record.type] || "ผลสุขภาพ"} · {model.label}<span className="progress-guidance-date">บันทึก {dateLabel(recordedAt(record))} น.</span></summary>
          <p>วันที่บันทึก {dateLabel(recordedAt(record))} น.</p>
          <p>{model.explanation}</p><p>{model.notes}</p>
          {model.level === "urgent" && <p className="progress-historical-urgent">{model.nextAction}</p>}
          {model.details.map(item => <div key={item.id}><h3>{item.title} · {item.label}</h3><ul>{item.actions.map(action => <li key={action}>{action}</li>)}</ul></div>)}
          {!model.details.length && <p>{model.nextAction}</p>}
          {model.sources.length > 0 && <p className="progress-source-links">แหล่งอ้างอิง: {model.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</p>}
        </details>;
      })}
    </div>
  </section>;
}

export default function HealthProgress({ staffMode = false }) {
  const { citizenId: routeCitizenId } = useParams();
  const navigate = useNavigate();
  const scope = staffMode ? "admin" : "patient";
  const [lookupId, setLookupId] = useState(routeCitizenId || "");
  const [lookupError, setLookupError] = useState("");
  const [query, setQuery] = useState({ days: "90", reviewStatus: "all", page: 1 });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayGregorian);
  const [dateError, setDateError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const citizenId = staffMode ? (lookupId === routeCitizenId ? routeCitizenId : "") : getStoredPatient()?.citizenId;
  const validId = /^\d{13}$/.test(citizenId || "");
  const contextKey = JSON.stringify([scope, citizenId, query.days || null, query.from || null, query.to || null]);
  const requestKey = JSON.stringify([scope, citizenId, query, attempt]);
  const data = result?.key === requestKey ? result.data : null;
  const periodData = result?.context === contextKey ? result.data : null;

  useEffect(() => { document.title = staffMode ? "ติดตามผลสุขภาพสมาชิก | Save Stroke" : "ติดตามผลสุขภาพของฉัน | Save Stroke"; }, [staffMode]);
  useEffect(() => { setLookupId(routeCitizenId || ""); setLookupError(""); setQuery(previous => previous.page === 1 ? previous : { ...previous, page: 1 }); }, [routeCitizenId]);
  useEffect(() => {
    const currentVersion = ++version.current;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && version.current === currentVersion;
    setError("");
    if (!validId) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    getHealthProgress({ citizenId, ...query, limit: 20 }, { sessionScope: scope, signal: controller.signal, isCurrent: current })
      .then(response => {
        if (!current()) return;
        const normalized = normalizeHealthProgress(response.data?.data);
        if (!normalized || normalized.patient?.citizenId !== citizenId) {
          const invalid = new Error("Invalid progress response"); invalid.code = "PROGRESS_RESPONSE_INVALID"; throw invalid;
        }
        setResult({ key: requestKey, context: contextKey, data: normalized });
      })
      .catch(failure => {
        if (!current() || failure.code === "ERR_CANCELED") return;
        if (failure.code === "PROGRESS_RESPONSE_INVALID" || [401, 403].includes(failure.response?.status)) setResult(null);
        setError(progressError(failure));
      })
      .finally(() => { if (current()) setLoading(false); });
    return () => { controller.abort(); version.current += 1; };
  }, [citizenId, validId, query, scope, requestKey, contextKey]);

  const search = event => {
    event.preventDefault();
    if (!/^\d{13}$/.test(lookupId)) { setLookupError("กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก"); return; }
    setLookupError(""); setResult(null); setQuery(previous => ({ ...previous, page: 1 }));
    if (lookupId === routeCitizenId) setAttempt(previous => previous + 1);
    else navigate(`/admin/progress/${lookupId}`);
  };
  const applyPeriod = days => { setDateError(""); setQuery(previous => ({ days, reviewStatus: previous.reviewStatus, page: 1 })); };
  const customRange = event => {
    event.preventDefault();
    const start = gregorianDate(from), end = gregorianDate(to);
    if (!start || !end || start > end || end > todayGregorian()) {
      setDateError("กรุณาระบุวันเริ่มต้นและวันสิ้นสุดให้ถูกต้อง โดยวันสิ้นสุดไม่เกินวันนี้"); return;
    }
    setDateError(""); setQuery(previous => ({ from: start, to: end, reviewStatus: previous.reviewStatus, page: 1 }));
  };

  return <PublicLayout active="progress" accountScope={scope}>
    <PageHeading eyebrow="HEALTH PROGRESS" title={staffMode ? "ติดตามผลสุขภาพสมาชิก" : "ติดตามผลสุขภาพของฉัน"}
      description="ดูค่าครั้งก่อนเทียบครั้งล่าสุด แนวโน้มตามวันที่บันทึก และความคืบหน้าการตรวจสอบ">
      {staffMode ? <Link className="btn btn-secondary" to="/admin?view=members"><ArrowLeft size={18} />ทะเบียนสมาชิก</Link>
        : <Link className="btn btn-primary" to={`/health/${citizenId || ""}`}>บันทึกผลใหม่<ArrowRight size={18} /></Link>}
    </PageHeading>
    {staffMode && <section className="panel progress-member-search" aria-label="เลือกสมาชิกเพื่อติดตามผล">
      <div className="panel-body"><form onSubmit={search} noValidate>
        <Field id="progress-citizenId" label="เลขบัตรประชาชนของสมาชิก" error={lookupError} required>
          <div className="progress-search-row"><input className="input" id="progress-citizenId" inputMode="numeric" autoComplete="off" maxLength={13}
            value={lookupId} onChange={event => { setLookupId(event.target.value.replace(/\D/g, "").slice(0, 13)); setLookupError(""); }} />
            <Button type="submit"><Search size={18} />ค้นหาสมาชิก</Button></div>
        </Field>
      </form></div>
    </section>}
    {!validId ? <EmptyState icon={TrendingUp} title={staffMode ? "เลือกสมาชิกเพื่อดูความเปลี่ยนแปลงสุขภาพ" : "ยังไม่พบข้อมูลบัญชีสมาชิก"}
      description={staffMode ? "ค้นหาด้วยเลขบัตรประชาชน หรือเปิดจากทะเบียนสมาชิก" : "กรุณาเข้าสู่ระบบบัญชีของคุณอีกครั้ง"} /> : <>
      <section className="panel progress-range" aria-label="เลือกช่วงติดตามสุขภาพ">
        <div className="panel-body"><h2>ช่วงเวลาที่ต้องการติดตาม</h2>
          <div className="progress-periods" role="group" aria-label="ช่วงเวลาติดตาม">{PERIODS.map(([days, label]) =>
            <Button key={days} variant={query.days === days ? "primary" : "secondary"} aria-pressed={query.days === days} onClick={() => applyPeriod(days)}>{label}</Button>)}</div>
          <form className="progress-custom-range" onSubmit={customRange} noValidate>
            <Field label="วันที่เริ่มต้น (พ.ศ.)" id="progress-from"><BuddhistDateInput id="progress-from" name="from" label="วันที่เริ่มต้น" value={from} onChange={event => setFrom(event.target.value)} /></Field>
            <Field label="วันที่สิ้นสุด (พ.ศ.)" id="progress-to"><BuddhistDateInput id="progress-to" name="to" label="วันที่สิ้นสุด" value={to} onChange={event => setTo(event.target.value)} /></Field>
            <Button type="submit" variant="secondary">ใช้ช่วงวันที่นี้</Button>
          </form>
          {dateError && <p role="alert" className="progress-date-error">{dateError}</p>}
        </div>
      </section>
      {loading && <div className="panel progress-loading" role="status">กำลังโหลดข้อมูลความเปลี่ยนแปลงสุขภาพ…</div>}
      {error && <Notice tone="error">{error}{periodData && " แสดงผลที่โหลดไว้ก่อนหน้า ยังอัปเดตข้อมูลใหม่ไม่สำเร็จ"} <Button variant="secondary" onClick={() => setAttempt(previous => previous + 1)}>ลองโหลดอีกครั้ง</Button></Notice>}
      {periodData && <div className="progress-results" aria-label="ผลติดตามสุขภาพ">
        <section className="panel progress-identity"><div><h2>{periodData.patient.firstName} {periodData.patient.lastName}</h2>
          {staffMode && <span className="badge badge-neutral">มุมมองเจ้าหน้าที่ · ข้อมูลสมาชิกที่เลือก</span>}
          <p>เลขบัตรประชาชน •••••••••{citizenId.slice(-4)}</p>
          <p>{periodData.range.from ? formatThaiDate(periodData.range.from) : "ตั้งแต่เริ่มมีข้อมูล"} ถึง {formatThaiDate(periodData.range.to || periodData.range.asOf)} · เวลาไทย</p></div>
          <Button variant="secondary" onClick={() => setAttempt(previous => previous + 1)}><RefreshCw size={18} />อัปเดตข้อมูล</Button>
        </section>
        <HealthProgressPanel data={periodData} />
        <section className="progress-stored-risk" aria-label="ผลประเมิน CVD ที่บันทึกล่าสุด"><h2>ผลประเมินความเสี่ยงหัวใจและหลอดเลือดล่าสุด</h2>
          <p className="progress-explanation">แสดงผลประเมินล่าสุดที่ระบบบันทึกไว้ อาจใช้ผลตรวจนอกช่วงวันที่เลือก จึงแสดงแยกจากกราฟความเปลี่ยนแปลง</p>
          <ThaiCvRiskCard risk={periodData.currentRisk} />
        </section>
        <LatestGuidance data={periodData} />
        <section className="panel progress-records" aria-label="รายการและความคืบหน้าการตรวจสอบ">
          <div className="panel-header"><div><h2>รายการและความคืบหน้าการตรวจสอบ</h2><p>ตัวกรองสถานะส่วนนี้ใช้กับรายการด้านล่าง กราฟใช้เฉพาะผลที่ยืนยันแล้วในช่วงวันที่เลือก</p></div></div>
          <div className="panel-body">
            <Field label="สถานะรายการที่ต้องการดู" id="progress-review-status"><select className="input" id="progress-review-status" value={query.reviewStatus}
              onChange={event => setQuery(previous => ({ ...previous, reviewStatus: event.target.value, page: 1 }))}>
              <option value="all">ทุกสถานะ</option><option value="approved">ยืนยันแล้ว</option><option value="pending">รอตรวจสอบ</option><option value="rejected">ไม่ผ่านการตรวจสอบ</option>
            </select></Field>
            {!data && <p role="status">{loading ? "กำลังโหลดรายการตามตัวกรองที่เลือก…" : "ยังโหลดรายการตามตัวกรองนี้ไม่ได้ กรุณาลองโหลดอีกครั้ง"}</p>}
            {data && <p>{data.pagination.total} รายการ · หน้าที่ {data.pagination.page}</p>}
            {data && !data.records.length && <p>ไม่มีรายการตามช่วงวันที่และสถานะที่เลือก</p>}
            <div className="progress-record-list">{(data?.records || []).map((record, index) => <article className="progress-record" key={record._id || record.recordId || index}>
              <h3>{TYPES[record.type] || "ข้อมูลสุขภาพ"}</h3><p>วันที่บันทึก {dateLabel(recordedAt(record))} น.</p>
              <dl>{recordMeasurements(record).map(measure => <div key={measure.label}><dt>{measure.label}</dt><dd>{String(measure.value)} {measure.unit}</dd></div>)}
                {record.type === "bmi" && typeof record.bmi === "number" && Number.isFinite(record.bmi) && <div><dt>BMI ที่บันทึก</dt><dd>{record.bmi} กก./ม²</dd></div>}</dl>
              <ReviewAudit record={record} />
            </article>)}</div>
            <nav className="progress-pagination" aria-label="หน้ารายการตรวจสุขภาพ">
              <Button variant="secondary" disabled={!data || data.pagination.page <= 1} onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))}>หน้าก่อนหน้า</Button>
              <Button variant="secondary" disabled={!data?.pagination.hasMore} onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))}>หน้าถัดไป</Button>
            </nav>
            {staffMode && periodData.summary.pending > 0 && <Link className="btn btn-primary" to="/admin?view=reviews">ไปตรวจสอบรายการรอยืนยัน<ArrowRight size={18} /></Link>}
          </div>
        </section>
      </div>}
    </>}
  </PublicLayout>;
}
