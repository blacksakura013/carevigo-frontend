import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatThaiDate } from "../utils/thaiDate";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Droplets,
  HeartPulse,
  History,
  Plus,
  RefreshCw,
  Scale,
  UserRound,
} from "lucide-react";
import {
  getApiError,
  getHealthByType,
  getPatientProfile,
  getStoredPatient,
  storePatientProfile,
} from "../api/api";
import {
  Button,
  EmptyState,
  Notice,
  PageHeading,
  PublicLayout,
} from "../components/ui";
import { ThaiCvRiskCard } from "./AddHealth";
import "../styles/portal.css";
const typeInfo = {
  blood_pressure: { label: "ความดันโลหิต", icon: HeartPulse, color: "coral" },
  sugar: { label: "น้ำตาลในเลือด", icon: Droplets, color: "blue" },
  cholesterol: { label: "ไขมันในเลือด", icon: Activity, color: "amber" },
  bmi: { label: "ดัชนีมวลกาย", icon: Scale, color: "mint" },
};
function valueLabel(record) {
  const value = record.value || {};
  if (record.type === "blood_pressure")
    return `${value.systolic ?? "—"}/${value.diastolic ?? "—"} mmHg`;
  if (record.type === "sugar")
    return value.fbs != null
      ? `${value.fbs} mg/dL`
      : `${value.hba1c ?? "—"}% HbA1c`;
  if (record.type === "cholesterol")
    return value.total != null ? `${value.total} mg/dL` : "ดูรายละเอียด";
  if (record.type === "bmi")
    return record.bmi != null
      ? `${record.bmi} กก./ม.²`
      : value.weight != null
        ? `${value.weight} กก.`
        : "—";
  return "ดูรายละเอียด";
}
function dateLabel(value) {
  return formatThaiDate(value, { empty: "ไม่ระบุวันที่" });
}

export default function PatientDashboard() {
  const [profile, setProfile] = useState(getStoredPatient);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getPatientProfile();
      const data = response.data?.data;
      if (!data?.patient) throw new Error("Invalid profile");
      const patient = storePatientProfile(
        data.patient,
        data.requiresPasswordChange,
      );
      setProfile(patient);
      const health = await getHealthByType(patient.citizenId, undefined, 1, 8);
      setRecords(Array.isArray(health.data?.data) ? health.data.data : []);
      setTotal(health.data?.total ?? 0);
    } catch (failure) {
      setError(
        getApiError(failure, "โหลดข้อมูลสุขภาพไม่สำเร็จ กรุณาลองอีกครั้ง"),
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    document.title = "ภาพรวมสุขภาพของฉัน | Save Stroke";
    load();
  }, [load]);
  const citizenId = profile?.citizenId;
  return (
    <PublicLayout active="dashboard">
      <PageHeading
        eyebrow="YOUR HEALTH OVERVIEW"
        title={`สวัสดี คุณ${profile?.firstName || "ผู้รับบริการ"}`}
        description="ทุกบันทึก ช่วยให้คุณรู้จักสุขภาพตัวเองมากขึ้น"
      >
        <Button variant="secondary" loading={loading} onClick={load}>
          {!loading && <RefreshCw size={16} />}อัปเดตข้อมูล
        </Button>
      </PageHeading>
      <section className="portal-welcome" data-motion-enter="panel">
        <div>
          <span className="badge badge-success">
            <CheckCircle2 size={13} /> บัญชีสุขภาพส่วนตัว
          </span>
          <h2>ใส่ใจวันนี้ เพื่อวันข้างหน้าของคุณ</h2>
          <p>บันทึกผลตรวจตามค่าที่วัดได้ และติดตามข้อมูลของคุณอย่างต่อเนื่อง</p>
          <Link to={`/health/${citizenId}`} className="btn btn-primary">
            <Plus size={17} />
            บันทึกสุขภาพวันนี้
            <ArrowRight size={16} />
          </Link>
        </div>
        <span className="portal-welcome-art" aria-hidden="true">
          <HeartPulse size={94} strokeWidth={1} />
        </span>
      </section>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <Button variant="ghost" onClick={load}>
            ลองอีกครั้ง
          </Button>
        </Notice>
      )}
      <div className="portal-metrics">
        <div className="panel portal-metric" data-motion-enter="panel">
          <span className="portal-icon">
            <History size={23} />
          </span>
          <div>
            <p>บันทึกสุขภาพทั้งหมด</p>
            <strong>
              {total === null ? "—" : total.toLocaleString("th-TH")}
              <small> รายการ</small>
            </strong>
          </div>
        </div>
        <div className="panel portal-metric" data-motion-enter="panel">
          <span className="portal-icon">
            <CalendarDays size={23} />
          </span>
          <div>
            <p>บันทึกล่าสุด</p>
            <strong className="portal-date">
              {records[0]
                ? dateLabel(records[0].createdAt)
                : loading
                  ? "กำลังโหลด…"
                  : "ยังไม่มีบันทึก"}
            </strong>
          </div>
        </div>
        <Link to="/profile" className="panel portal-metric portal-profile-link" data-motion-enter="panel">
          <span className="portal-icon">
            <UserRound size={23} />
          </span>
          <div>
            <p>ข้อมูลส่วนตัวและปัจจัยสุขภาพ</p>
            <strong className="portal-date">
              ตรวจสอบข้อมูลของฉัน <ArrowRight size={16} />
            </strong>
          </div>
        </Link>
      </div>
      <div className="portal-overview-grid">
        <section className="panel portal-recent">
          <div className="panel-header">
            <div>
              <h2>บันทึกสุขภาพล่าสุด</h2>
              <p>รายการล่าสุดจากบัญชีของคุณ</p>
            </div>
            <Link to={`/history/${citizenId}`} className="portal-text-link">
              ดูทั้งหมด <ArrowRight size={14} />
            </Link>
          </div>
          {loading && !records.length ? (
            <div className="empty-state" role="status">
              กำลังโหลดข้อมูลสุขภาพ…
            </div>
          ) : !records.length ? (
            <EmptyState
              icon={History}
              title={
                error ? "ยังโหลดบันทึกไม่ได้" : "เริ่มต้นบันทึกสุขภาพครั้งแรก"
              }
              description={
                error
                  ? "ลองเชื่อมต่ออีกครั้งเพื่อดูข้อมูลของคุณ"
                  : "ผลตรวจของคุณจะจัดเก็บไว้ที่นี่ เพื่อเปิดดูย้อนหลังได้สะดวก"
              }
              action={
                <Link to={`/health/${citizenId}`} className="btn btn-primary">
                  <Plus size={16} />
                  เพิ่มบันทึกสุขภาพ
                </Link>
              }
            />
          ) : (
            <div className="portal-recent-list">
              {records.map((record, index) => {
                const info = typeInfo[record.type] || {
                  label: record.type,
                  icon: Activity,
                  color: "mint",
                };
                const Icon = info.icon;
                return (
                  <Link
                    to={`/history/${citizenId}`}
                    className="portal-record"
                    key={record._id || index}
                  >
                    <span className={`portal-measure-icon ${info.color}`}>
                      <Icon size={21} strokeWidth={1.5} />
                    </span>
                    <div>
                      <strong>{info.label}</strong>
                      <small>{dateLabel(record.createdAt)}</small>
                      {record.reviewStatus === "pending" && (
                        <span className="badge badge-warning">รอตรวจสอบ</span>
                      )}
                      {record.reviewStatus === "rejected" && (
                        <span className="badge badge-danger">ยกเลิกแล้ว</span>
                      )}
                      {record.reviewStatus === "approved" && (
                        <span className="badge badge-success">ยืนยันแล้ว</span>
                      )}
                    </div>
                    <b>{valueLabel(record)}</b>
                    <ArrowRight size={15} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <div className="portal-risk">
          <ThaiCvRiskCard risk={profile?.thaiCvRisk} />
          <div className="portal-risk-legend">
            <h3>ระดับความเสี่ยงใน 10 ปี</h3>
            <p className="field-hint">ประเมินจากข้อมูลที่ยืนยันแล้ว</p>
            <span>
              <i className="risk-dot low" />
              ต่ำ · น้อยกว่า 10%
            </span>
            <span>
              <i className="risk-dot moderate" />
              ปานกลาง · 10%–20%
            </span>
            <span>
              <i className="risk-dot high" />
              สูง · มากกว่า 20%
            </span>
            <Link to="/profile">
              เพิ่มข้อมูลสำหรับการคำนวณ <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
