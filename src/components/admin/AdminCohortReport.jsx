import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { getAdminCohortReport, getApiError } from "../../api/api";
import { Button, EmptyState, Field, Notice } from "../ui";
import BuddhistDateInput from "../BuddhistDateInput";
import CohortReportPanel from "./CohortReportPanel";
import { COHORT_DISEASES, COHORT_PERIODS, COHORT_TYPES, cohortPeriodRange, cohortProgressHref, initialCohortQuery, normalizeCohortReport, validCohortRange } from "../../utils/adminCohort";
import { formatThaiDate, todayGregorian } from "../../utils/thaiDate";
import { recordMeasurements } from "../../pages/HealthHistory";
import "../../styles/admin-cohort-page.css";

const number = value => value.toLocaleString("th-TH");
const date = value => formatThaiDate(value, { withTime: true, empty: "ยังไม่มีบันทึกในช่วงนี้" });
export default function AdminCohortReport({ refreshKey = 0 }) {
  const [params, setParams] = useSearchParams();
  const initial = initialCohortQuery(params.toString());
  const [query, setQuery] = useState(initial);
  const [draft, setDraft] = useState({ ...initial, period: params.has("from") ? "custom" : "month", anchor: todayGregorian() });
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const version = useRef(0);
  const ownUrl = useRef(params.toString());
  const key = JSON.stringify([query, refreshKey, attempt]);
  const data = ownUrl.current === params.toString() && result?.key === key ? result.data : null;
  useEffect(() => {
    const search = params.toString();
    if (ownUrl.current === search) return;
    ownUrl.current = search;
    const next = initialCohortQuery(search);
    setQuery(next); setDraft({ ...next, period: "custom", anchor: next.to }); setResult(null); setFormError("");
  }, [params]);
  useEffect(() => {
    const controller = new AbortController(), request = ++version.current;
    const current = () => !controller.signal.aborted && request === version.current;
    setLoading(true); setError("");
    getAdminCohortReport(query, { signal: controller.signal, isCurrent: current })
      .then(response => {
        if (!current()) return;
        const normalized = normalizeCohortReport(response.data?.data, query);
        if (!normalized) { const invalid = new Error("Report contract unavailable"); invalid.code = "COHORT_SCHEMA"; throw invalid; }
        setResult({ key, data: normalized });
      })
      .catch(failure => {
        if (!current() || failure.code === "ERR_CANCELED") return;
        setResult(null);
        setError(failure.code === "COHORT_SCHEMA" || [404, 405].includes(failure.response?.status)
          ? "ระบบรายงานยังไม่พร้อม กรุณาอัปเดต backend เป็นรุ่นล่าสุดแล้วลองอีกครั้ง"
          : getApiError(failure, "โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง"));
      }).finally(() => { if (current()) setLoading(false); });
    return () => { controller.abort(); version.current += 1; };
  }, [query, key]);
  const apply = next => {
    setResult(null); setFormError(""); setQuery(next);
    const search = new URLSearchParams({ view: "reports", from: next.from, to: next.to });
    if (next.disease !== "all") search.set("disease", next.disease);
    if (next.activity !== "all") search.set("activity", next.activity);
    if (next.search) search.set("search", next.search);
    ownUrl.current = search.toString(); setParams(search, { replace: true });
  };
  const submit = event => {
    event.preventDefault();
    const range = draft.period === "custom" ? { from: draft.from, to: draft.to } : cohortPeriodRange(draft.period, draft.anchor);
    if (!range || !validCohortRange(range.from, range.to)) {
      setFormError("กรุณาเลือกวันที่ให้ถูกต้อง วันสิ้นสุดไม่เกินวันนี้ และเลือกช่วงไม่เกิน 366 วัน"); return;
    }
    apply({ ...query, ...range, disease: draft.disease, activity: draft.activity, search: draft.search.trim(), page: 1 });
  };
  const changeFilter = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); apply({ ...query, [field]: value, page: 1 }); };
  const preview = draft.period === "custom" ? { from: draft.from, to: draft.to } : cohortPeriodRange(draft.period, draft.anchor);
  return <div className="cohort-report-page">
    <section className="panel" aria-label="ตัวกรองรายงานสุขภาพ">
      <div className="panel-header"><div><h2>เลือกกลุ่มคนและช่วงรายงาน</h2><p>สรุปตามวันที่บันทึก เวลาไทย แล้วเปิดดูผลและคำแนะนำรายบุคคลได้</p></div></div>
      <form className="panel-body cohort-filter-form" onSubmit={submit} noValidate>
        <div className="cohort-period-buttons" role="group" aria-label="รอบสรุปรายงาน">{COHORT_PERIODS.map(([id, label]) =>
          <Button key={id} variant={draft.period === id ? "primary" : "secondary"} aria-pressed={draft.period === id} onClick={() => setDraft(previous => ({ ...previous, period: id }))}>{label}</Button>)}</div>
        <p className="cohort-page-note">รอบเดือนนับเป็นเดือนปฏิทิน รอบ 3 และ 6 เดือนรวมเดือนที่เลือก หากเป็นเดือนปัจจุบันจะสรุปถึงวันนี้</p>
        <div className="cohort-filter-grid">
          {draft.period === "custom" ? <>
            <Field label="วันที่เริ่มรายงาน (พ.ศ.)" id="cohort-from"><BuddhistDateInput id="cohort-from" name="from" label="วันที่เริ่มรายงาน" value={draft.from} onChange={event => setDraft(previous => ({ ...previous, from: event.target.value }))} /></Field>
            <Field label="วันที่สิ้นสุดรายงาน (พ.ศ.)" id="cohort-to"><BuddhistDateInput id="cohort-to" name="to" label="วันที่สิ้นสุดรายงาน" value={draft.to} onChange={event => setDraft(previous => ({ ...previous, to: event.target.value }))} /></Field>
          </> : <Field label="วัน / เดือนอ้างอิง (พ.ศ.)" id="cohort-anchor"><BuddhistDateInput id="cohort-anchor" name="anchor" label="วันเดือนอ้างอิง" value={draft.anchor} onChange={event => setDraft(previous => ({ ...previous, anchor: event.target.value }))} /></Field>}
          <Field label="กลุ่มโรคที่ระบุในโปรไฟล์" id="cohort-disease"><select id="cohort-disease" className="input" value={draft.disease} onChange={event => setDraft(previous => ({ ...previous, disease: event.target.value }))}>
            <option value="all">ทุกกลุ่มโรค</option>{Object.entries(COHORT_DISEASES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></Field>
          <Field label="การบันทึกในช่วงที่เลือก" id="cohort-activity"><select id="cohort-activity" className="input" value={draft.activity} onChange={event => setDraft(previous => ({ ...previous, activity: event.target.value }))}>
            <option value="all">ทุกคน</option><option value="recorded">มีบันทึกในช่วงนี้</option><option value="none">ยังไม่มีบันทึกในช่วงนี้</option>
          </select></Field>
          <Field label="ค้นหาชื่อ เลขบัตร หรือจังหวัด" id="cohort-search"><input id="cohort-search" className="input" maxLength={100} value={draft.search} onChange={event => setDraft(previous => ({ ...previous, search: event.target.value }))} /></Field>
        </div>
        <p className="cohort-page-note">ช่วงที่จะใช้: {preview && validCohortRange(preview.from, preview.to) ? `${formatThaiDate(preview.from)} ถึง ${formatThaiDate(preview.to)}` : "กรุณาเลือกวันที่ให้ถูกต้อง"} · กดแสดงรายงานเพื่อใช้ตัวกรอง</p>
        {formError && <p role="alert" className="cohort-form-error">{formError}</p>}
        <div className="cohort-page-actions"><Button type="submit">แสดงรายงาน</Button><Button variant="secondary" onClick={() => { const next = initialCohortQuery(""); setDraft({ ...next, period: "month", anchor: todayGregorian() }); apply(next); }}>ล้างตัวกรอง</Button></div>
      </form>
    </section>
    <div className="cohort-applied-range"><div><h2>ผลรายงานช่วงที่ใช้</h2><p>{formatThaiDate(query.from)} ถึง {formatThaiDate(query.to)} · {COHORT_DISEASES[query.disease] || "ทุกกลุ่มโรค"}{query.search && ` · ค้นหา “${query.search}”`}</p></div>
      <Button variant="secondary" onClick={() => setAttempt(previous => previous + 1)} loading={loading}><RefreshCw size={18} />อัปเดตรายงาน</Button></div>
    {loading && <p role="status" className="cohort-page-loading">กำลังสรุปรายงานตามตัวกรองที่เลือก…</p>}
    {error && <Notice tone="error">{error} <Button variant="secondary" onClick={() => setAttempt(previous => previous + 1)}>ลองโหลดรายงานอีกครั้ง</Button></Notice>}
    {data && <>
      <CohortReportPanel data={data} onDiseaseSelect={value => changeFilter("disease", value)} onActivitySelect={value => changeFilter("activity", value)} />
      <section className="panel cohort-people" aria-label="รายบุคคลในรายงาน">
        <div className="panel-header"><div><h2>รายบุคคลในรายงาน</h2><p>{number(data.pagination.total)} คน · หน้าที่ {data.pagination.page} · คนที่ไม่มีบันทึกยังเปิดดูประวัติทั้งหมดต่อได้</p></div></div>
        <div className="panel-body">
          {!data.people.length && <EmptyState title="ไม่พบผู้รับบริการตามตัวกรองนี้" description="ลองเปลี่ยนกลุ่มโรค การบันทึก หรือคำค้นหา" />}
          <div className="cohort-person-list">{data.people.map((person, index) => {
            const href = cohortProgressHref(person.citizenId, data.range, data.filters);
            return <article className="cohort-person" key={person.internalId || person.citizenId || index}>
              <div className="cohort-person-heading"><div><h3>{[person.firstName, person.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อ"}</h3><p>เลขบัตร •••••••••{String(person.citizenId || "").slice(-4)} · {person.province || "ไม่ระบุจังหวัด"}</p></div>
                {href && <Link className="btn btn-primary" to={href}>ดูผลและความคืบหน้า<ArrowRight size={18} /></Link>}</div>
              <p className="cohort-person-groups">ประวัติโรคที่ระบุ: {person.diseaseGroups.map(id => COHORT_DISEASES[id]).join(" · ")}{person.chronicDiseasesConfirmed !== true && " · ยังไม่ยืนยันประวัติโรค"}</p>
              <dl className="cohort-person-counts"><div><dt>บันทึกในช่วงนี้</dt><dd>{number(person.counts.total)} รายการ</dd></div><div><dt>ยืนยันแล้ว</dt><dd>{number(person.counts.approved)} รายการ</dd></div><div><dt>รอตรวจสอบ</dt><dd>{number(person.counts.pending)} รายการ</dd></div><div><dt>ยกเลิก / ไม่ทราบสถานะ</dt><dd>{number(person.counts.rejected + person.counts.unknown)} รายการ</dd></div></dl>
              <p>{Object.entries(COHORT_TYPES).filter(([id]) => person.counts.byType[id] > 0).map(([id, label]) => `${label} ${number(person.counts.byType[id])} รายการ`).join(" · ") || "ยังไม่มีบันทึกในช่วงนี้"}</p>
              {person.latestApprovedRecords?.length > 0 && <div className="cohort-latest-readings"><h4>ผลที่ยืนยันแล้วล่าสุดของแต่ละหมวดในช่วงนี้</h4>
                <p>แสดงรายการล่าสุดของหมวดนั้น แต่ละหมวดอาจบันทึกคนละวัน เปิดดูความคืบหน้าเพื่อเทียบค่าตรวจย้อนหลัง</p>
                {person.latestApprovedRecords.map(record => <div className="cohort-latest-reading" key={record.type}><h5>{COHORT_TYPES[record.type]}</h5><p>วันที่บันทึก {date(record.recordedAt || record.submittedAt || record.createdAt)} น.</p>
                  <dl>{recordMeasurements(record).map(measure => <div key={measure.label}><dt>{measure.label}</dt><dd>{String(measure.value)} {measure.unit}</dd></div>)}
                    {record.type === "bmi" && typeof record.bmi === "number" && Number.isFinite(record.bmi) && <div><dt>BMI</dt><dd>{record.bmi} กก./ม²</dd></div>}</dl>
                  {!recordMeasurements(record).length && !(typeof record.bmi === "number" && Number.isFinite(record.bmi)) && <p>รายการนี้ยังไม่มีค่าตรวจที่แสดงได้</p>}
                </div>)}
              </div>}
              <p>บันทึกล่าสุดในช่วง: {date(person.lastRecordedAt)}</p>
            </article>;
          })}</div>
          <nav className="cohort-page-actions" aria-label="หน้ารายชื่อในรายงาน"><Button variant="secondary" disabled={query.page <= 1} onClick={() => apply({ ...query, page: query.page - 1 })}>หน้าก่อนหน้า</Button><Button variant="secondary" disabled={!data.pagination.hasMore} onClick={() => apply({ ...query, page: query.page + 1 })}>หน้าถัดไป</Button></nav>
        </div>
      </section>
      <p className="cohort-page-note">ข้อมูลถึง {date(data.range.asOf)} น. · กลุ่มโรคอิงโปรไฟล์ปัจจุบัน ไม่ใช่การวินิจฉัยหรือจำนวนผู้ป่วยรายใหม่ในอดีต · วันที่ในรายงานคือวันที่ส่งบันทึก หากไม่มีจะใช้วันที่สร้างรายการ</p>
    </>}
  </div>;
}
