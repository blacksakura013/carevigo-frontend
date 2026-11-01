import React, { useEffect, useRef, useState } from "react";
import { formatThaiDate } from "../../utils/thaiDate";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  decideReviews,
  getApiError,
  getReviewQueue,
  getReviewSettings,
} from "../../api/api";
import { Button, EmptyState, Field, Notice } from "../ui";
import "../../styles/reviews.css";
import SubmittedProfileDetails from "../SubmittedProfileDetails";

const STATUS = {
  pending: ["รอยืนยัน", "warning"],
  approved: ["ยืนยันแล้ว", "success"],
  rejected: ["ยกเลิกแล้ว", "danger"],
};
const SOURCES = {
  guest: "ผู้ใช้ทั่วไป",
  public: "ผู้ใช้ทั่วไป",
  patient: "บัญชีผู้รับบริการ",
  admin: "ผู้ดูแลระบบ",
  email: "ลิงก์อีเมล",
  automatic: "ระบบยืนยันอัตโนมัติ",
};
const TYPE_LABELS = {
  profile: "ข้อมูลผู้รับบริการ",
  blood_pressure: "ความดันโลหิต",
  sugar: "น้ำตาลในเลือด",
  cholesterol: "ไขมันในเลือด",
  bmi: "น้ำหนักและส่วนสูง",
};
const FIELD_LABELS = {
  systolic: ["ความดันตัวบน", "mmHg"],
  diastolic: ["ความดันตัวล่าง", "mmHg"],
  pulse: ["ชีพจร", "ครั้ง/นาที"],
  fbs: ["น้ำตาลขณะอดอาหาร", "mg/dL"],
  hba1c: ["น้ำตาลสะสม", "%"],
  total: ["คอเลสเตอรอลรวม", "mg/dL"],
  ldl: ["LDL", "mg/dL"],
  hdl: ["HDL", "mg/dL"],
  triglyceride: ["ไตรกลีเซอไรด์", "mg/dL"],
  weight: ["น้ำหนัก", "กก."],
  height: ["ส่วนสูง", "ซม."],
};
const number = (value) =>
  value == null ? "—" : Number(value).toLocaleString("th-TH");
const dateTime = (value) => formatThaiDate(value, { withTime: true });
const profileFor = (row) =>
  row.submittedProfile ||
  row.user ||
  (typeof row.userId === "object" ? row.userId : null) ||
  {};
const nameFor = (row) => {
  const profile = profileFor(row);
  return (
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "ไม่ระบุชื่อ"
  );
};
const citizenFor = (row) => row.citizenId || profileFor(row).citizenId || "";
const maskId = (id) =>
  id ? `•••••••••${String(id).slice(-4)}` : "ไม่ระบุเลขประจำตัว";
const statusFor = (row) => row.reviewStatus || "approved";
function valueFor(row) {
  if (row.type === "profile") return "ไม่ได้ระบุผลตรวจสุขภาพ";
  const value = row.value || {};
  if (row.type === "blood_pressure")
    return `${value.systolic ?? "—"}/${value.diastolic ?? "—"} mmHg`;
  if (row.type === "sugar")
    return value.fbs != null
      ? `${value.fbs} mg/dL`
      : `${value.hba1c ?? "—"}% HbA1c`;
  if (row.type === "cholesterol") return `${value.total ?? "—"} mg/dL`;
  if (row.type === "bmi")
    return `${row.weight ?? value.weight ?? "—"} กก. / ${row.height ?? value.height ?? "—"} ซม.`;
  return "ดูรายละเอียด";
}
export function ReviewStatusBadge({ status = "approved" }) {
  const [label, tone] = STATUS[status] || STATUS.approved;
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

function ReviewDialog({ title, children, onClose, busy, className = "" }) {
  const ref = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (event) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const items = ref.current?.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="review-dialog-overlay" onClick={onClose}>
      <section
        className={`review-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">HEALTH RECORD REVIEW</span>
            <h2>{title}</h2>
          </div>
          <button
            className="admin-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="ปิดหน้าต่างตรวจสอบ"
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function ReviewQueue({ refreshKey = 0, onChanged }) {
  const [status, setStatus] = useState("pending"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [data, setData] = useState({
    records: [],
    total: 0,
    hasMore: false,
    snapshotAt: null,
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set()),
    [allSelection, setAllSelection] = useState(null);
  const [decision, setDecision] = useState(null),
    [reason, setReason] = useState(""),
    [saving, setSaving] = useState(false),
    [decisionError, setDecisionError] = useState("");
  const [feedback, setFeedback] = useState(null),
    [detail, setDetail] = useState(null);
  const selectPageRef = useRef(null);
  const clearSelection = () => {
    setSelectedIds(new Set());
    setAllSelection(null);
    setDecision(null);
    setReason("");
    setDecisionError("");
  };
  useEffect(() => {
    if (search.trim() === query) return undefined;
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    setSelectedIds(new Set());
    setAllSelection(null);
    setDecision(null);
  }, [status, query, refreshKey]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getReviewQueue(page, 20, { status, ...(query ? { search: query } : {}) })
      .then((response) => {
        if (!active) return;
        const body = response.data || {};
        setData({
          records: Array.isArray(body.data) ? body.data : [],
          total: body.total || 0,
          hasMore: Boolean(body.hasMore),
          snapshotAt: body.snapshotAt || null,
        });
      })
      .catch((failure) => {
        if (active)
          setError(
            getApiError(failure, "โหลดรายการตรวจสอบไม่สำเร็จ กรุณาลองอีกครั้ง"),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, status, query, version, refreshKey]);
  const pendingOnPage = data.records.filter(
    (row) => statusFor(row) === "pending",
  );
  const selectedCount = allSelection ? allSelection.count : selectedIds.size;
  const isSelected = (row) =>
    allSelection
      ? statusFor(row) === "pending" &&
        new Date(row.submittedAt || row.createdAt) <=
          new Date(allSelection.cutoff)
      : selectedIds.has(row._id);
  const allOnPage = pendingOnPage.length > 0 && pendingOnPage.every(isSelected);
  const someOnPage = pendingOnPage.some(isSelected);
  useEffect(() => {
    if (selectPageRef.current)
      selectPageRef.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);
  const toggle = (row) => {
    if (allSelection || saving || statusFor(row) !== "pending") return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(row._id)) next.delete(row._id);
      else next.add(row._id);
      return next;
    });
  };
  const togglePage = () => {
    if (allSelection || saving) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      pendingOnPage.forEach((row) => {
        if (allOnPage) next.delete(row._id);
        else next.add(row._id);
      });
      return next;
    });
  };
  const selectAll = () => {
    if (status !== "pending" || !data.snapshotAt || !data.total) return;
    setSelectedIds(new Set());
    setAllSelection({
      count: data.total,
      cutoff: data.snapshotAt,
      filters: { status: "pending", ...(query ? { search: query } : {}) },
    });
  };
  const openDecision = (action) => {
    setDecision(action);
    setReason("");
    setDecisionError("");
  };
  const closeDecision = () => {
    if (!saving) setDecision(null);
  };
  const decide = async () => {
    if (!selectedCount || saving) return;
    const payload = allSelection
      ? {
          all: true,
          filters: allSelection.filters,
          cutoff: allSelection.cutoff,
          action: decision,
        }
      : { ids: [...selectedIds], action: decision };
    if (reason.trim()) payload.reason = reason.trim();
    setSaving(true);
    setDecisionError("");
    try {
      const response = await decideReviews(payload);
      const result = response.data?.data || {};
      const changed = Number(result.changed) || 0,
        skipped = Number(result.skipped) || 0;
      setFeedback({
        tone: changed ? "success" : "info",
        text: `${decision === "approve" ? "ยืนยัน" : "ยกเลิก"}แล้ว ${number(changed)} รายการ${skipped ? ` · ข้าม ${number(skipped)} รายการที่เปลี่ยนสถานะไปแล้ว` : ""}`,
      });
      clearSelection();
      setPage(1);
      setVersion((previous) => previous + 1);
      onChanged?.();
    } catch (failure) {
      setDecisionError(
        getApiError(
          failure,
          "เปลี่ยนสถานะไม่สำเร็จ รายการที่เลือกยังอยู่ กรุณาลองอีกครั้ง",
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="review-workspace">
      <div className="review-policy-banner">
        <span className="admin-stat-icon amber">
          <Clock3 size={24} />
        </span>
        <div>
          <strong>ยืนยันอัตโนมัติ 23:59 น. ของวันเดียวกัน</strong>
          <p>
            รายการที่ยังรอยืนยันเมื่อถึงกำหนด จะยืนยันอัตโนมัติตามเวลาไทย
            (Asia/Bangkok)
          </p>
        </div>
      </div>
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      <section className="panel review-queue-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">REVIEW INBOX</span>
            <h2 className="section-heading">
              บันทึกที่ส่งเข้าระบบ{" "}
              <span className="admin-heading-count">{number(data.total)}</span>
            </h2>
            <p>
              เลือกรายการรอยืนยันหนึ่งรายการ หลายรายการ หรือทั้งหมดตามตัวกรอง
            </p>
          </div>
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => {
              clearSelection();
              setVersion((previous) => previous + 1);
            }}
          >
            <RefreshCw size={15} />
            อัปเดตรายการ
          </Button>
        </div>
        <div className="review-filters">
          <label className="admin-search">
            <Search size={18} />
            <input
              className="input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                clearSelection();
              }}
              placeholder="ค้นหาชื่อ เลขประจำตัว หรือจังหวัด"
              aria-label="ค้นหาบันทึกเพื่อตรวจสอบ"
            />
          </label>
          <select
            className="input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
              clearSelection();
            }}
            aria-label="สถานะการตรวจสอบ"
          >
            <option value="pending">รอยืนยัน</option>
            <option value="approved">ยืนยันแล้ว</option>
            <option value="rejected">ยกเลิกแล้ว</option>
            <option value="all">ทุกสถานะ</option>
          </select>
        </div>
        <div className="review-selection-toolbar">
          <label>
            <input
              ref={selectPageRef}
              type="checkbox"
              aria-label="เลือกบันทึกรอยืนยันทั้งหมดในหน้านี้"
              checked={allOnPage}
              disabled={
                loading || !pendingOnPage.length || Boolean(allSelection)
              }
              onChange={togglePage}
            />
            เลือกในหน้านี้
          </label>
          <span>
            {selectedCount
              ? `เลือกไว้ ${number(selectedCount)} รายการ`
              : "ยังไม่ได้เลือกรายการ"}
          </span>
          {selectedCount > 0 && (
            <button className="admin-text-button" onClick={clearSelection}>
              ล้างการเลือก
            </button>
          )}
          {status === "pending" && data.total > 0 && !allSelection && (
            <button
              className="admin-text-button review-select-all"
              disabled={loading || !data.snapshotAt}
              onClick={selectAll}
            >
              เลือกทั้งหมด {number(data.total)} รายการตามตัวกรอง
            </button>
          )}
        </div>
        {allSelection && (
          <div className="review-all-selection">
            <CheckCheck size={17} />
            <p>
              เลือกทั้งหมด {number(allSelection.count)} รายการตามตัวกรอง ณ{" "}
              {dateTime(allSelection.cutoff)} น.
              รายการใหม่ที่ส่งหลังจากนี้ไม่รวมในการเลือกครั้งนี้
            </p>
          </div>
        )}
        {loading ? (
          <div className="review-loading" role="status">
            กำลังโหลดรายการตรวจสอบ…
          </div>
        ) : error ? (
          <div className="panel-body">
            <Notice tone="error">{error}</Notice>
            <Button
              variant="secondary"
              onClick={() => setVersion((previous) => previous + 1)}
            >
              ลองอีกครั้ง
            </Button>
          </div>
        ) : !data.records.length ? (
          <EmptyState
            icon={ClipboardCheck}
            title={
              query
                ? "ไม่พบบันทึกที่ตรงกับการค้นหา"
                : status === "pending"
                  ? "ไม่มีบันทึกที่รอยืนยัน"
                  : "ยังไม่มีบันทึกในสถานะนี้"
            }
            description={
              query
                ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                : "รายการที่ส่งเข้าระบบจะแสดงที่นี่ พร้อมประวัติการตรวจสอบ"
            }
          />
        ) : (
          <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="ตารางตรวจสอบบันทึก เลื่อนเพื่อดูข้อมูลเพิ่มเติม">
            <table className="admin-table review-table">
              <caption className="sr-only">รายการตรวจสอบบันทึกสุขภาพ</caption>
              <thead>
                <tr>
                  <th>เลือก</th>
                  <th>ผู้ส่งข้อมูล</th>
                  <th>ประเภท / ค่าที่บันทึก</th>
                  <th>สถานะ</th>
                  <th>วันที่ส่ง / กำหนดยืนยัน</th>
                  <th>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((row) => (
                  <tr
                    key={row._id}
                    className={isSelected(row) ? "is-selected" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`เลือกบันทึก ${nameFor(row)} ${TYPE_LABELS[row.type] || row.type}`}
                        checked={isSelected(row)}
                        disabled={
                          statusFor(row) !== "pending" || Boolean(allSelection)
                        }
                        onChange={() => toggle(row)}
                      />
                    </td>
                    <td>
                      <div className="admin-person">
                        <span className="admin-person-avatar">
                          {nameFor(row).slice(0, 1)}
                        </span>
                        <div>
                          <strong>{nameFor(row)}</strong>
                          <span>{maskId(citizenFor(row))}</span>
                          <span className="review-source-label">
                            {SOURCES[
                              row.reviewHistory?.[0]?.source || row.source
                            ] || "ข้อมูลในระบบ"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-record-value">
                        <div>
                          <strong>{valueFor(row)}</strong>
                          <span>{TYPE_LABELS[row.type] || row.type}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <ReviewStatusBadge status={statusFor(row)} />
                    </td>
                    <td>
                      <span className="review-timestamp">
                        {dateTime(row.submittedAt || row.createdAt)}
                      </span>
                      <span className="admin-cell-note">
                        {statusFor(row) === "pending"
                          ? `อัตโนมัติ ${dateTime(row.reviewDueAt)}`
                          : `${SOURCES[row.reviewSource] || "ตรวจสอบแล้ว"} · ${dateTime(row.reviewedAt)}`}
                      </span>
                    </td>
                    <td>
                      <button
                        className="admin-text-button"
                        onClick={() => setDetail(row)}
                      >
                        ดูบันทึก <ChevronRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-pagination">
          <span>
            หน้า {page} · ทั้งหมด {number(data.total)} รายการ
          </span>
          <div>
            <Button
              variant="secondary"
              aria-label="หน้าก่อนหน้าของรายการตรวจสอบ"
              disabled={page <= 1 || loading}
              onClick={() => setPage((previous) => previous - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="admin-page-number">{page}</span>
            <Button
              variant="secondary"
              aria-label="หน้าถัดไปของรายการตรวจสอบ"
              disabled={!data.hasMore || loading}
              onClick={() => setPage((previous) => previous + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      <div className="review-bulk-actions">
        <div>
          <strong>
            {selectedCount
              ? `พร้อมตรวจสอบ ${number(selectedCount)} รายการ`
              : "เลือกรายการรอยืนยันเพื่อดำเนินการ"}
          </strong>
          <p>
            เปลี่ยนเฉพาะรายการที่ยังรอยืนยัน
            ประวัติและรายการที่ยกเลิกยังคงตรวจสอบย้อนหลังได้
          </p>
        </div>
        <div className="inline-actions">
          <Button
            variant="secondary"
            disabled={!selectedCount || loading}
            onClick={() => openDecision("reject")}
          >
            <XCircle size={17} />
            ยกเลิกรายการที่เลือก
          </Button>
          <Button
            disabled={!selectedCount || loading}
            onClick={() => openDecision("approve")}
          >
            <Check size={17} />
            ยืนยันรายการที่เลือก
          </Button>
        </div>
      </div>
      {decision && (
        <ReviewDialog
          title={
            decision === "approve"
              ? "ยืนยันบันทึกที่เลือก"
              : "ยกเลิกบันทึกที่เลือก"
          }
          busy={saving}
          onClose={closeDecision}
        >
          <div className="review-dialog-body">
            {decisionError && <Notice tone="error">{decisionError}</Notice>}
            <Notice tone={decision === "approve" ? "info" : "warning"}>
              {decision === "approve" ? "ยืนยัน" : "ยกเลิก"}บันทึกจำนวน{" "}
              <strong>{number(selectedCount)} รายการ</strong>
              {allSelection && (
                <> ตามตัวกรอง ณ {dateTime(allSelection.cutoff)} น.</>
              )}{" "}
              {decision === "reject" &&
                "รายการจะยังอยู่ในประวัติพร้อมสถานะยกเลิก"}
            </Notice>
            <Field
              label="เหตุผลหรือหมายเหตุ (ถ้ามี)"
              id="review-decision-reason"
            >
              <textarea
                className="input"
                id="review-decision-reason"
                maxLength={500}
                value={reason}
                disabled={saving}
                onChange={(event) => setReason(event.target.value)}
                placeholder="บันทึกหมายเหตุสำหรับตรวจสอบย้อนหลัง"
              />
            </Field>
          </div>
          <footer>
            <Button
              variant="secondary"
              onClick={closeDecision}
              disabled={saving}
            >
              กลับไปตรวจสอบ
            </Button>
            <Button loading={saving} onClick={decide}>
              {decision === "approve" ? "ยืนยัน" : "ยืนยันยกเลิก"}{" "}
              {number(selectedCount)} รายการ
            </Button>
          </footer>
        </ReviewDialog>
      )}
      {detail && (
        <ReviewDialog
          title="รายละเอียดและประวัติการตรวจสอบ"
          onClose={() => setDetail(null)}
        >
          <ReviewRecordDetails row={detail} />
        </ReviewDialog>
      )}
    </div>
  );
}

function ReviewRecordDetails({ row }) {
  const profile = profileFor(row),
    history = Array.isArray(row.reviewHistory) ? row.reviewHistory : [];
  return (
    <div className="review-dialog-body">
      <div className="review-detail-identity">
        <span className="admin-person-avatar">{nameFor(row).slice(0, 1)}</span>
        <div>
          <h3>{nameFor(row)}</h3>
          <p>{citizenFor(row) || "ไม่ระบุเลขประจำตัว"}</p>
        </div>
        <ReviewStatusBadge status={statusFor(row)} />
      </div>
      <dl className="review-detail-grid">
        <div>
          <dt>ประเภทบันทึก</dt>
          <dd>{TYPE_LABELS[row.type] || row.type}</dd>
        </div>
        <div>
          <dt>วันที่ส่งข้อมูล</dt>
          <dd>{dateTime(row.submittedAt || row.createdAt)}</dd>
        </div>
        <div>
          <dt>จังหวัดที่ส่งมา</dt>
          <dd>{profile.province || "ไม่ระบุ"}</dd>
        </div>
        <div>
          <dt>กำหนดยืนยันอัตโนมัติ (เวลาไทย)</dt>
          <dd>{dateTime(row.reviewDueAt)}</dd>
        </div>
        {Object.entries(row.value || {})
          .filter(([key, value]) => FIELD_LABELS[key] && value != null)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{FIELD_LABELS[key][0]}</dt>
              <dd>
                {value} {FIELD_LABELS[key][1]}
              </dd>
            </div>
          ))}
      </dl>
      {row.type === "profile" && <SubmittedProfileDetails profile={profile} />}
      {statusFor(row) === "pending" && (
        <Notice>
          บันทึกนี้ยังรอยืนยัน
          ผลประเมินความเสี่ยงจะใช้ข้อมูลที่ผ่านการยืนยันแล้ว
        </Notice>
      )}
      <h3 className="admin-detail-heading">ประวัติการตรวจสอบ</h3>
      {history.length ? (
        <ol className="review-audit-list">
          {history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <span
                className={`review-audit-dot is-${entry.to || "pending"}`}
              />
              <div>
                <strong>{STATUS[entry.to]?.[0] || "ส่งบันทึกเข้าระบบ"}</strong>
                <span>
                  {SOURCES[entry.source] || "ข้อมูลในระบบ"} ·{" "}
                  {dateTime(entry.at)} น.
                </span>
                {entry.reason && <p>{entry.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="admin-risk-description">
          บันทึกเดิมในระบบ ยังไม่มีประวัติการเปลี่ยนสถานะ
        </p>
      )}
      {row.reviewReason && (
        <div className="review-final-reason">
          <strong>หมายเหตุล่าสุด</strong>
          <p>{row.reviewReason}</p>
        </div>
      )}
    </div>
  );
}

export function ReviewPolicyPanel({ refreshKey = 0 }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getReviewSettings()
      .then((response) => {
        if (active) setData(response.data?.data || null);
      })
      .catch((failure) => {
        if (active)
          setError(
            getApiError(failure, "โหลดสถานะการตรวจสอบและอีเมลไม่สำเร็จ"),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry, refreshKey]);
  return (
    <section className="panel review-settings-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">REVIEW POLICY & NOTIFICATIONS</span>
          <h2 className="section-heading">
            การยืนยันบันทึกและแจ้งเตือนเจ้าหน้าที่
          </h2>
          <p>นโยบายอัตโนมัติและสถานะการแจ้งเตือนจากระบบ</p>
        </div>
        <ShieldCheck size={23} />
      </div>
      <div className="panel-body">
        <div className="review-settings-policy">
          <Clock3 size={25} />
          <div>
            <strong>ยืนยันอัตโนมัติ 23:59 น. วันเดียวกับวันที่ส่ง</strong>
            <p>
              ใช้เวลาไทย (Asia/Bangkok) สำหรับรายการที่ยังรอยืนยันเมื่อถึงกำหนด
              รายการที่ยกเลิกแล้วจะไม่ถูกยืนยันอัตโนมัติ
            </p>
          </div>
        </div>
        {loading ? (
          <p className="review-loading" role="status">
            กำลังตรวจสอบสถานะการแจ้งเตือน…
          </p>
        ) : error ? (
          <Notice tone="error">
            {error}{" "}
            <button
              className="admin-text-button"
              onClick={() => setRetry((previous) => previous + 1)}
            >
              ลองอีกครั้ง
            </button>
          </Notice>
        ) : (
          data && (
            <>
              <div className="review-email-status">
                <Mail size={23} />
                <div>
                  <strong>
                    {data.activeAdminRecipients > 0
                      ? `ผู้ดูแลที่รับแจ้งเตือน ${number(data.activeAdminRecipients)} บัญชี`
                      : "ยังไม่มีผู้ดูแลที่พร้อมรับแจ้งเตือน"}
                  </strong>
                  <p>
                    เมื่อมีบันทึกใหม่ ระบบส่งอีเมลพร้อมลิงก์เปิดตรวจสอบ ยืนยัน
                    หรือยกเลิก และบันทึกผู้ดำเนินการไว้ในประวัติ
                  </p>
                </div>
              </div>
              <div className="review-outbox-grid">
                {[
                  ["pending", "อีเมลรอส่ง"],
                  ["sent", "อีเมลส่งแล้ว"],
                  ["failed", "อีเมลส่งไม่สำเร็จ"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <strong>{number(data.outbox?.[key])}</strong>
                  </div>
                ))}
              </div>
              <p className="admin-risk-description">
                การยืนยันผ่านอีเมลจะมีหน้าตรวจสอบให้ยืนยันการดำเนินการก่อนเปลี่ยนสถานะ
                รายการทั้งหมดเปิดดูย้อนหลังได้ในเมนูตรวจสอบบันทึก
              </p>
            </>
          )
        )}
      </div>
    </section>
  );
}
