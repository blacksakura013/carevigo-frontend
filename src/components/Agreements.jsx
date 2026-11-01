import React from "react";
import { LegalDocumentLink } from "./LegalLinks";
import "../styles/legal.css";

export default function Agreements({
  value = {}, onChange, error, disabled = false, idPrefix = "agreement", actor = "subject",
}) {
  const staff = actor === "staff";
  const descriptionId = `${idPrefix}-description`;
  const errorId = `${idPrefix}-error`;
  const change = (key) => (event) => onChange({ ...value, [key]: event.target.checked });
  const checkbox = (key, suffix, children) => (
    <div className="legal-agreement-choice">
      <input
        id={`${idPrefix}-${suffix}`}
        type="checkbox"
        checked={value[key] === true}
        onChange={change(key)}
        disabled={disabled}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
      />
      <label htmlFor={`${idPrefix}-${suffix}`}>{children}</label>
    </div>
  );
  return (
    <fieldset className={`legal-agreements ${error ? "legal-agreements-invalid" : ""}`} disabled={disabled}>
      <legend>ข้อตกลงและการใช้ข้อมูล</legend>
      {checkbox("termsAccepted", "terms", <>
        ฉันยอมรับ <LegalDocumentLink href="/terms">ข้อกำหนดการใช้บริการ</LegalDocumentLink>
      </>)}
      {staff ? <>
        {checkbox("privacyNoticeAcknowledged", "notice", <>
          ฉันได้แจ้ง <LegalDocumentLink href="/privacy">ประกาศความเป็นส่วนตัว</LegalDocumentLink> แก่เจ้าของข้อมูลแล้ว
        </>)}
        {checkbox("lawfulAuthorityConfirmed", "authority", <>
          ฉันยืนยันว่ามีอำนาจและฐานกฎหมายที่เหมาะสมในการบันทึกข้อมูลสุขภาพแทนเจ้าของข้อมูล
        </>)}
      </> : checkbox("healthDataConsent", "health", <>
        ฉันยินยอมอย่างชัดแจ้งให้หน่วยงานผู้ให้บริการ Save Stroke เก็บ ใช้ และเปิดเผยข้อมูลสุขภาพที่จำเป็นแก่เจ้าหน้าที่ที่ได้รับสิทธิ
        เพื่อบันทึก ติดตามสุขภาพ ตรวจสอบรายการ และประเมินความเสี่ยงโรคหัวใจและหลอดเลือด (CV risk)
        ตาม <LegalDocumentLink href="/privacy">ประกาศความเป็นส่วนตัว</LegalDocumentLink>
      </>)}
      <p id={descriptionId} className="legal-agreement-description">
        {staff
          ? "คำรับรองนี้เป็นของเจ้าหน้าที่ ไม่ใช่ความยินยอมแทนเจ้าของข้อมูล หากอาศัยความยินยอม ต้องมีหลักฐานความยินยอมที่ชัดแจ้งตามขั้นตอนของหน่วยงาน"
          : "อ่านประกาศความเป็นส่วนตัวก่อนตัดสินใจ คุณถอนความยินยอมได้โดยติดต่อเจ้าหน้าที่ของหน่วยงาน การถอนอาจทำให้ใช้บริการที่จำเป็นต้องอาศัยข้อมูลสุขภาพต่อไม่ได้"}
      </p>
      {error && <p id={errorId} className="legal-agreement-error" role="alert">{error}</p>}
    </fieldset>
  );
}
