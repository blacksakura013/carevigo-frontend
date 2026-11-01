import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatThaiDate } from "../utils/thaiDate";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  History,
  MailCheck,
  ShieldCheck,
  X,
} from "lucide-react";
import { decideEmailReview, getApiError, getEmailReview } from "../api/api";
import { Brand, Button, EmptyState, Notice } from "../components/ui";
import "../styles/review-email.css";
import SubmittedProfileDetails from "../components/SubmittedProfileDetails";
const labels = {
  profile: "ข้อมูลผู้รับบริการ",
  blood_pressure: "ความดันโลหิต",
  sugar: "น้ำตาลในเลือด",
  cholesterol: "ไขมันในเลือด",
  bmi: "น้ำหนักและส่วนสูง",
};
const states = {
  pending: ["รอตรวจสอบ", "warning"],
  approved: ["ยืนยันแล้ว", "success"],
  rejected: ["ยกเลิกแล้ว", "danger"],
};
function dateLabel(value) {
  return formatThaiDate(value, { withTime: true, empty: "ไม่ระบุ" });
}
function valueLabel(record) {
  if (record.type === "profile") return "ไม่ได้ระบุผลตรวจสุขภาพ";
  const value = record.value || {};
  const display = {
    systolic: ["SYS", "mmHg"],
    diastolic: ["DIA", "mmHg"],
    pulse: ["ชีพจร", "ครั้ง/นาที"],
    fbs: ["FBS", "mg/dL"],
    hba1c: ["HbA1c", "%"],
    total: ["Total cholesterol", "mg/dL"],
    ldl: ["LDL", "mg/dL"],
    hdl: ["HDL", "mg/dL"],
    triglyceride: ["TG", "mg/dL"],
    weight: ["น้ำหนัก", "กก."],
    height: ["ส่วนสูง", "ซม."],
  };
  return (
    Object.entries(value)
      .filter(
        ([name, amount]) => display[name] && amount != null && amount !== "",
      )
      .map(
        ([name, amount]) => `${display[name][0]} ${amount} ${display[name][1]}`,
      )
      .join(" · ") || "ไม่ระบุค่าผลตรวจ"
  );
}
export default function EmailReview() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const currentToken = useRef(token);
  currentToken.current = token;
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [action, setAction] = useState(
    ["approve", "reject"].includes(params.get("action"))
      ? params.get("action")
      : null,
  );
  const [success, setSuccess] = useState("");
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError("");
    if (!token) {
      setError("ลิงก์ไม่สมบูรณ์ กรุณาเปิดลิงก์จากอีเมลแจ้งเตือนอีกครั้ง");
      setLoading(false);
      return;
    }
    try {
      const response = await getEmailReview(token, { isCurrent: () => current === version.current && currentToken.current === token });
      if (current === version.current) setData(response.data?.data || null);
    } catch (failure) {
      if (current === version.current)
        setError(
          failure.code === "API_NOT_READY" ? getApiError(failure) : !failure.response
            ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง"
            : "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อตรวจสอบรายการ",
        );
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    document.title = "ตรวจสอบบันทึกจากอีเมล | Save Stroke";
    load();
    return () => {
      version.current += 1;
    };
  }, [load]);
  async function decide() {
    if (saving || !data?.canDecide || !action) return;
    const current = version.current;
    setSaving(true);
    setError("");
    try {
      const response = await decideEmailReview(token, action, { isCurrent: () => current === version.current && currentToken.current === token });
      if (current !== version.current) return;
      const changed = response.data?.data?.changed ?? 0;
      setSuccess(
        changed
          ? `${action === "approve" ? "ยืนยัน" : "ยกเลิก"} ${changed} รายการเรียบร้อยแล้ว`
          : "รายการนี้ได้รับการตรวจสอบแล้ว ไม่มีรายการที่ถูกเปลี่ยนซ้ำ",
      );
      setAction(null);
      await load();
    } catch (failure) {
      if (current === version.current)
        setError(
          failure.code === "API_NOT_READY" ? getApiError(failure) : !failure.response
            ? "ยังยืนยันผลการดำเนินการไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่"
            : "ดำเนินการไม่สำเร็จ รายการอาจได้รับการตรวจสอบไปแล้ว กรุณาโหลดข้อมูลล่าสุด",
        );
    } finally {
      setSaving(false);
    }
  }
  const pending = (data?.records || []).filter(
    (record) => record.reviewStatus === "pending",
  ).length;
  return (
    <div className="email-review-page">
      <header>
        <Link to="/login">
          <Brand />
        </Link>
        <span>
          <MailCheck size={16} /> ตรวจสอบจากอีเมล
        </span>
      </header>
      <main>
        <Link to="/admin?view=reviews" className="email-review-back">
          <ArrowLeft size={16} /> ไปยังคิวตรวจสอบของเจ้าหน้าที่
        </Link>
        <div className="email-review-heading">
          <span className="email-review-icon">
            <MailCheck size={30} strokeWidth={1.4} />
          </span>
          <p className="eyebrow">REVIEW HEALTH SUBMISSION</p>
          <h1>ตรวจสอบบันทึกสุขภาพ</h1>
          <p>
            การเปิดลิงก์นี้ยังไม่เปลี่ยนสถานะรายการ
            กรุณาตรวจสอบข้อมูลและกดยืนยันการดำเนินการด้านล่าง
          </p>
        </div>
        {success && <Notice tone="success">{success}</Notice>}
        {error && (
          <Notice tone="error">
            {error}
            <Button variant="ghost" onClick={load} disabled={saving}>
              โหลดข้อมูลล่าสุด
            </Button>
          </Notice>
        )}
        {loading ? (
          <section className="panel">
            <div className="empty-state" role="status">
              กำลังโหลดรายการจากอีเมล…
            </div>
          </section>
        ) : data ? (
          <>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>{data.patientName || "รายการบันทึกสุขภาพ"}</h2>
                  {data.maskedCitizenId && (
                    <p>เลขบัตรประชาชน {data.maskedCitizenId}</p>
                  )}
                </div>
                <span className="badge badge-warning">
                  รอตรวจสอบ {pending} รายการ
                </span>
              </div>
              <div className="email-review-records">
                {(data.records || []).map((record) => {
                  const [label, tone] =
                    states[record.reviewStatus] || states.pending;
                  return (
                    <article key={record._id}>
                      <div>
                        <h3>{labels[record.type] || record.type}</h3>
                        <span className={`badge badge-${tone}`}>{label}</span>
                      </div>
                      <p>{valueLabel(record)}</p>
                      {record.type === "profile" && <SubmittedProfileDetails profile={record.submittedProfile} />}
                      <small>
                        ส่งเมื่อ{" "}
                        {dateLabel(record.submittedAt || record.createdAt)}
                      </small>
                      {record.reviewHistory?.length > 0 && (
                        <details>
                          <summary>
                            <History size={14} /> ประวัติรายการ
                          </summary>
                          <ol>
                            {record.reviewHistory.map((event, index) => (
                              <li key={index}>
                                {states[
                                  event.status ||
                                    event.to ||
                                    event.toStatus ||
                                    event.action
                                ]?.[0] ||
                                  event.action ||
                                  event.status ||
                                  "อัปเดตสถานะ"}{" "}
                                ·{" "}
                                {dateLabel(
                                  event.at ||
                                    event.createdAt ||
                                    event.timestamp,
                                )}
                                {event.source &&
                                  ` · ${{ guest: "ส่งโดยไม่เข้าสู่ระบบ", admin: "เจ้าหน้าที่", email: "ตรวจสอบผ่านอีเมล", automatic: "ยืนยันอัตโนมัติ", patient: "บัญชีผู้รับบริการ" }[event.source] || "ระบบ"}`}
                                {event.reason && ` · ${event.reason}`}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
            <Notice tone="info">
              <Clock3 size={15} />{" "}
              รายการที่ยังรอตรวจสอบจะได้รับการยืนยันอัตโนมัติเมื่อถึง{" "}
              {dateLabel(data.reviewDueAt)} (เวลาไทย)
              โดยเก็บเหตุการณ์ไว้ในประวัติ
            </Notice>
            {data.canDecide && pending > 0 ? (
              <section className="panel email-review-decision">
                <h2>เลือกการดำเนินการสำหรับ {pending} รายการที่รอตรวจสอบ</h2>
                <p>
                  ผลการตรวจสอบใช้เฉพาะรายการจากอีเมลนี้
                  รายการที่ดำเนินการไปแล้วจะไม่ถูกเปลี่ยนซ้ำ
                </p>
                <div className="inline-actions">
                  <Button
                    variant={action === "approve" ? "primary" : "secondary"}
                    disabled={saving}
                    onClick={() => setAction("approve")}
                  >
                    <Check size={17} />
                    ยืนยันรายการ
                  </Button>
                  <Button
                    variant={action === "reject" ? "danger" : "secondary"}
                    disabled={saving}
                    onClick={() => setAction("reject")}
                  >
                    <X size={17} />
                    ยกเลิกรายการ
                  </Button>
                </div>
                {action && (
                  <div className="email-review-confirm">
                    <Notice tone={action === "approve" ? "info" : "warning"}>
                      {action === "approve"
                        ? "ยืนยันรับรองบันทึก"
                        : "ยกเลิกบันทึก"}
                      ที่รอตรวจสอบ {pending} รายการ?{" "}
                      {action === "reject" &&
                        "รายการจะยังอยู่ในประวัติพร้อมสถานะยกเลิก"}
                    </Notice>
                    <div className="inline-actions">
                      <Button
                        variant="ghost"
                        onClick={() => setAction(null)}
                        disabled={saving}
                      >
                        กลับไปตรวจสอบ
                      </Button>
                      <Button
                        variant={action === "approve" ? "primary" : "danger"}
                        loading={saving}
                        onClick={decide}
                      >
                        {action === "approve" ? (
                          <CheckCheck size={17} />
                        ) : (
                          <X size={17} />
                        )}
                        ยืนยันการ{action === "approve" ? "รับรอง" : "ยกเลิก"}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <Notice tone="success">
                <ShieldCheck size={17} /> รายการทั้งหมดได้รับการตรวจสอบแล้ว
                ดูผลการดำเนินการได้จากประวัติด้านบน
              </Notice>
            )}
          </>
        ) : (
          !error && (
            <section className="panel">
              <EmptyState
                icon={MailCheck}
                title="ไม่พบรายการสำหรับลิงก์นี้"
                description="เข้าสู่ระบบเจ้าหน้าที่เพื่อตรวจสอบรายการล่าสุด"
              />
            </section>
          )
        )}
        <footer>Save Stroke · ลิงก์นี้ใช้เฉพาะรายการที่ส่งมาในอีเมลนี้</footer>
      </main>
    </div>
  );
}
