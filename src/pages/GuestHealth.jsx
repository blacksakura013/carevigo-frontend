import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  IdCard,
  Plus,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getApiError, submitGuestHealth } from "../api/api";
import {
  Button,
  Field,
  Notice,
  PageHeading,
  PublicLayout,
} from "../components/ui";
import {
  emptyHealthValues,
  HEALTH_SECTIONS,
  HealthMeasurementFields,
  healthMeasurementErrors,
  healthRecordPayloads,
  HealthEntrySummary,
} from "./AddHealth";
import Agreements from "../components/Agreements";
import { agreementPayload, agreementsComplete } from "../utils/legal";
import BuddhistDateInput from "../components/BuddhistDateInput";
import { formatThaiDate, gregorianDate, todayGregorian } from "../utils/thaiDate";
import FormPages, { FormPage } from "../components/FormPages";
import "../styles/patient.css";

const CONDITIONS = [
  "เบาหวาน",
  "ความดันโลหิตสูง",
  "โรคหัวใจ",
  "โรคหลอดเลือดสมอง",
  "มะเร็ง",
  "ไขมันในเส้นเลือด",
];
const EMPTY_PROFILE = {
  firstName: "",
  lastName: "",
  gender: "",
  birthDate: "",
  phone: "",
  smokingStatus: "",
  smokingQuitMonths: "",
  chronicDiseases: [],
  chronicDiseasesConfirmed: false,
  cancerDetails: "",
};
const GUEST_FORM_STEPS = [
  { id: "personal", title: "ข้อมูลผู้รับบริการ", description: "กรอกข้อมูลของผู้ที่ต้องการบันทึกสุขภาพครั้งนี้" },
  { id: "conditions", title: "พฤติกรรมและโรคประจำตัว", description: "กรอกข้อมูลที่ทราบ เลือกโรคได้มากกว่า 1 ข้อ" },
  ...HEALTH_SECTIONS.map(({ type, title }) => ({ id: type, title, description: "กรอกเฉพาะผลตรวจที่มี หากไม่มีข้อมูลให้กดถัดไป" })),
  { id: "review", title: "ตรวจสอบและส่งข้อมูล", description: "ตรวจสอบข้อมูลและให้ความยินยอมก่อนส่งให้เจ้าหน้าที่" },
];
function newRequestId() {
  if (window.crypto.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export default function GuestHealth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [citizenId, setCitizenId] = useState("");
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });
  const [otherDiseases, setOtherDiseases] = useState("");
  const [values, setValues] = useState(emptyHealthValues);
  const [errors, setErrors] = useState({});
  const [agreements, setAgreements] = useState({});
  const [agreementError, setAgreementError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const requestKey = useRef({ fingerprint: "", id: "" });
  const pendingRef = useRef(false);
  const activeRef = useRef(true);
  const resultRef = useRef(null);
  const pagesRef = useRef(null);

  useEffect(() => {
    document.title = "บันทึกสุขภาพโดยไม่เข้าสู่ระบบ | Save Stroke";
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);
  // Old receipt links open a fresh entry form; guest pages never fetch health data.
  useEffect(() => {
    if (location.search || location.hash) navigate("/guest", { replace: true });
  }, [location.search, location.hash, navigate]);

  const updateProfile = (event) => {
    const { name, value } = event.target;
    setProfile((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
    setError("");
  };
  const updateMeasure = (type, name, value) => {
    setValues((previous) => ({
      ...previous,
      [type]: { ...previous[type], [name]: value },
    }));
    setErrors((previous) => ({ ...previous, [`${type}-${name}`]: "" }));
    setError("");
  };
  const records = healthRecordPayloads(values);
  const recordedDiseases = [
    ...profile.chronicDiseases,
    ...otherDiseases.split(",").map((item) => item.trim()).filter(Boolean),
  ];
  const submit = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;
    const invalid = {};
    if (!/^\d{13}$/.test(citizenId))
      invalid.citizenId = "กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก";
    if (!profile.firstName.trim()) invalid.firstName = "กรุณากรอกชื่อ";
    if (!profile.lastName.trim()) invalid.lastName = "กรุณากรอกนามสกุล";
    if (
      profile.birthDate &&
      (!gregorianDate(profile.birthDate) || profile.birthDate > todayGregorian())
    )
      invalid.birthDate = "กรุณาเลือกวันเกิดที่ถูกต้องและไม่เกินวันนี้";
    if (
      profile.phone &&
      !/^0\d{8,9}$/.test(profile.phone.replace(/[\s-]/g, ""))
    )
      invalid.phone = "กรุณากรอกเบอร์โทร 9–10 หลัก เริ่มด้วย 0";
    if (
      profile.smokingStatus === "former" &&
      (profile.smokingQuitMonths === "" ||
        !Number.isInteger(Number(profile.smokingQuitMonths)) ||
        Number(profile.smokingQuitMonths) < 0)
    )
      invalid.smokingQuitMonths =
        "กรุณาระบุจำนวนเดือนเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป";
    if (
      profile.chronicDiseases.includes("มะเร็ง") &&
      !profile.cancerDetails.trim()
    )
      invalid.cancerDetails = "กรุณาระบุชนิดหรือตำแหน่งของมะเร็ง";
    Object.assign(invalid, healthMeasurementErrors(values));
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      setError("กรุณาตรวจสอบข้อมูลในช่องที่ระบุ");
      pagesRef.current?.focusField(`guest-${Object.keys(invalid)[0]}`);
      return;
    }
    if (!records.length) {
      setError("กรุณากรอกข้อมูลสุขภาพอย่างน้อย 1 ส่วนก่อนส่ง");
      pagesRef.current?.focusField("guest-blood_pressure-systolic");
      return;
    }
    if (!agreementsComplete(agreements)) {
      setAgreementError("กรุณาอ่านเงื่อนไขและให้ความยินยอมสำหรับการบันทึกครั้งนี้ก่อนส่งข้อมูล");
      pagesRef.current?.focusField("guest-agreement-terms");
      return;
    }
    const profileData = {
      ...profile,
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      birthDate: profile.birthDate.replaceAll("-", ""),
      chronicDiseases: recordedDiseases,
    };
    if (profile.smokingStatus === "former")
      profileData.smokingQuitMonths = Number(profile.smokingQuitMonths);
    else delete profileData.smokingQuitMonths;
    if (profile.chronicDiseases.includes("มะเร็ง"))
      profileData.cancerDetails = profile.cancerDetails.trim();
    else delete profileData.cancerDetails;
    const payload = { citizenId, profile: profileData, records, agreements: agreementPayload(agreements) };
    const fingerprint = JSON.stringify(payload);
    if (requestKey.current.fingerprint !== fingerprint)
      requestKey.current = { fingerprint, id: newRequestId() };
    pendingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await submitGuestHealth({
        ...payload,
        clientRequestId: requestKey.current.id,
      });
      if (!activeRef.current) return;
      const data = response.data?.data;
      if (!data?.submissionId) throw new Error("Missing submission acknowledgement");
      setConfirmation({ recordCount: data.recordIds?.length || records.length });
      // Drop the submitted person and measurements from the public form immediately.
      setCitizenId("");
      setProfile({ ...EMPTY_PROFILE });
      setOtherDiseases("");
      setValues(emptyHealthValues());
      setAgreements({});
      requestKey.current = { fingerprint: "", id: "" };
      setTimeout(() => resultRef.current?.focus(), 0);
    } catch (requestError) {
      if (activeRef.current)
        setError(
          `${getApiError(requestError, "ส่งข้อมูลไม่สำเร็จ กรุณาตรวจสอบแล้วลองอีกครั้ง")} ข้อมูลที่กรอกยังอยู่ การส่งข้อมูลเดิมซ้ำจะใช้รหัสรายการเดิม`,
        );
    } finally {
      pendingRef.current = false;
      if (activeRef.current) setSaving(false);
    }
  };
  const input = (name, label, options = {}) => (
    <Field
      key={name}
      label={label}
      id={`guest-${name}`}
      error={errors[name]}
      hint={options.hint}
      required={options.required}
    >
      {name === "birthDate" ? <BuddhistDateInput id={`guest-${name}`} name={name} label={label} value={profile[name]} onChange={updateProfile}
        aria-invalid={Boolean(errors[name])} aria-describedby={`guest-${name}-description`} /> : <input
        className="input"
        id={`guest-${name}`}
        name={name}
        type={options.type || "text"}
        autoComplete={options.autoComplete}
        required={options.required}
        value={profile[name]}
        onChange={updateProfile}
        placeholder={options.placeholder}
        min={options.min}
        step={options.step}
        inputMode={options.inputMode}
      />}
    </Field>
  );
  const select = (name, label, options) => (
    <Field label={label} id={`guest-${name}`}>
      <select
        className="input"
        id={`guest-${name}`}
        name={name}
        value={profile[name]}
        onChange={updateProfile}
      >
        <option value="">เลือก / ไม่ระบุ</option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
  const startNew = () => {
    setCitizenId("");
    setProfile({ ...EMPTY_PROFILE });
    setOtherDiseases("");
    setValues(emptyHealthValues());
    setAgreements({});
    setAgreementError("");
    setErrors({});
    setError("");
    setConfirmation(null);
    requestKey.current = { fingerprint: "", id: "" };
    pagesRef.current?.reset();
    navigate("/guest", { replace: true });
  };

  return (
    <PublicLayout active="guest" guestOnly>
      <PageHeading
        eyebrow="QUICK HEALTH RECORD"
        title="บันทึกสุขภาพ ไม่ต้องเข้าสู่ระบบ"
        description="กรอกผลตรวจที่คุณมี แล้วส่งให้เจ้าหน้าที่ตรวจสอบ"
      />
      {confirmation ? (
        <section className="panel patient-guest-confirmation" ref={resultRef} tabIndex={-1}>
          <span className="patient-success-icon"><CheckCircle2 size={34} /></span>
          <h2>ส่งข้อมูลเรียบร้อยแล้ว {confirmation.recordCount} รายการ</h2>
          <p>ระบบรับข้อมูลแล้วและส่งให้เจ้าหน้าที่ตรวจสอบ</p>
          <p>หากต้องการดูประวัติหรือแก้ไขข้อมูล กรุณาติดต่อเจ้าหน้าที่หรือใช้บัญชีส่วนตัวของคุณ</p>
          <Button onClick={startNew}><Plus size={19} /> บันทึกรายการใหม่</Button>
        </section>
      ) : (
        <>
          <div className="patient-guest-policy">
            <span className="patient-icon">
              <Clock3 size={23} />
            </span>
            <div>
              <h2>กรอกข้อมูล แล้วส่งให้เจ้าหน้าที่ตรวจสอบ</h2>
              <p>
                รายการจะรอเจ้าหน้าที่ตรวจสอบ หากยังไม่มีผลการตรวจสอบ
                ระบบจะยืนยันอัตโนมัติเวลา 23:59 น. ของวันที่ส่งข้อมูล ตามเวลาไทย
              </p>
            </div>
            <span className="badge badge-warning">รอตรวจสอบก่อนยืนยัน</span>
          </div>
          <FormPages ref={pagesRef} steps={GUEST_FORM_STEPS} busy={saving}>
          <form
            onSubmit={submit}
            noValidate
            className="patient-profile-form"
            aria-busy={saving}
          >
            {error && <Notice tone="error">{error}</Notice>}
            <fieldset className="patient-fieldset" disabled={saving}>
              <FormPage id="personal">
              <section className="panel">
                <div className="patient-panel-title">
                  <span className="patient-icon">
                    <IdCard size={23} />
                  </span>
                  <div>
                    <h2>ข้อมูลผู้รับบริการครั้งนี้</h2>
                    <p>กรอกข้อมูลของตนเอง หรือผู้ที่คุณได้รับอนุญาตให้ดูแล</p>
                  </div>
                  <span className="patient-section-number">01</span>
                </div>
                <div className="panel-body">
                  <div className="field-grid">
                    <Field
                      label="เลขบัตรประชาชน"
                      id="guest-citizenId"
                      required
                      error={errors.citizenId}
                      hint="ใช้เชื่อมรายการกับผู้รับบริการ โดยไม่เปิดเผยข้อมูลเดิม"
                    >
                      <input
                        id="guest-citizenId"
                        className="input patient-id-input"
                        inputMode="numeric"
                        maxLength={13}
                        autoComplete="off"
                        required
                        pattern="[0-9]{13}"
                        value={citizenId}
                        onChange={(event) => {
                          const nextId = event.target.value.replace(/\D/g, "").slice(0, 13);
                          if (nextId !== citizenId) {
                            setAgreements({});
                            setAgreementError("");
                          }
                          setCitizenId(nextId);
                          setErrors((previous) => ({
                            ...previous,
                            citizenId: "",
                          }));
                        }}
                        placeholder="เลขบัตรประชาชน 13 หลัก"
                      />
                    </Field>
                    {input("phone", "เบอร์โทรศัพท์ (ถ้ามี)", {
                      type: "tel",
                      autoComplete: "tel",
                      placeholder: "08XXXXXXXX",
                    })}
                    {input("firstName", "ชื่อ", {
                      required: true,
                      autoComplete: "given-name",
                    })}
                    {input("lastName", "นามสกุล", {
                      required: true,
                      autoComplete: "family-name",
                    })}
                    {select("gender", "เพศสำหรับการประเมินความเสี่ยง", {
                      male: "ชาย",
                      female: "หญิง",
                    })}
                    {input("birthDate", "วันเกิด", {
                      autoComplete: "bday",
                      hint: "กรอกวัน/เดือน/ปี พ.ศ. เช่น 01/01/2523",
                    })}
                  </div>
                  <p className="patient-guest-profile-note">
                    หากต้องการแก้ไขข้อมูลบัญชีเดิม
                    ให้เข้าสู่ระบบแล้วแก้ไขที่ข้อมูลส่วนตัว
                  </p>
                </div>
              </section>
              </FormPage>
              <FormPage id="conditions">
              <section className="panel">
                <div className="patient-panel-title">
                  <span className="patient-icon">
                    <UserRound size={22} />
                  </span>
                  <div>
                    <h2>พฤติกรรมและโรคประจำตัว</h2>
                    <p>กรอกตามข้อมูลที่ทราบ เพื่อประกอบการตรวจสอบครั้งนี้</p>
                  </div>
                  <span className="patient-section-number">02</span>
                </div>
                <div className="panel-body">
                  <div className="field-grid">
                    {select("smokingStatus", "สถานะการสูบบุหรี่", {
                      never: "ไม่เคยสูบบุหรี่",
                      current: "ยังสูบบุหรี่อยู่",
                      former: "เลิกสูบบุหรี่แล้ว",
                    })}
                    {profile.smokingStatus === "former" &&
                      input(
                        "smokingQuitMonths",
                        "เลิกสูบบุหรี่มาแล้ว (เดือน)",
                        {
                          type: "number",
                          min: "0",
                          step: "1",
                          inputMode: "numeric",
                          required: true,
                          hint: "กรอก 0 หากยังไม่ครบ 1 เดือน",
                        },
                      )}
                  </div>
                  <fieldset className="patient-condition-fieldset">
                    <legend>
                      โรคประจำตัว{" "}
                      <span className="muted">(เลือกได้มากกว่า 1 ข้อ)</span>
                    </legend>
                    <div className="patient-condition-list">
                      {CONDITIONS.map((condition) => (
                        <label className="patient-condition" key={condition}>
                          <input
                            type="checkbox"
                            checked={profile.chronicDiseases.includes(
                              condition,
                            )}
                            onChange={(event) =>
                              setProfile((previous) => ({
                                ...previous,
                                chronicDiseasesConfirmed: false,
                                chronicDiseases: event.target.checked
                                  ? [...previous.chronicDiseases, condition]
                                  : previous.chronicDiseases.filter(
                                      (item) => item !== condition,
                                    ),
                              }))
                            }
                          />
                          <span>{condition}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {profile.chronicDiseases.includes("มะเร็ง") && (
                    <div className="patient-cancer-details">
                      {input("cancerDetails", "ชนิดหรือตำแหน่งของมะเร็ง", {
                        required: true,
                        hint: "ระบุตามข้อมูลการวินิจฉัยที่คุณทราบ",
                      })}
                    </div>
                  )}
                  <Field
                    label="โรคประจำตัวอื่น ๆ"
                    id="guest-otherDiseases"
                    hint="หากมีหลายโรค คั่นด้วยเครื่องหมายจุลภาค ( , )"
                  >
                    <input
                      id="guest-otherDiseases"
                      className="input"
                      value={otherDiseases}
                      onChange={(event) => {
                        setOtherDiseases(event.target.value);
                        setProfile((previous) => ({
                          ...previous,
                          chronicDiseasesConfirmed: false,
                        }));
                      }}
                    />
                  </Field>
                  <label className="patient-confirm-history">
                    <input
                      type="checkbox"
                      checked={profile.chronicDiseasesConfirmed}
                      onChange={(event) =>
                        setProfile((previous) => ({
                          ...previous,
                          chronicDiseasesConfirmed: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      ยืนยันว่าตรวจสอบข้อมูลโรคประจำตัวแล้ว
                      <small>
                        หากไม่มีโรคประจำตัว
                        ให้เว้นรายการด้านบนและทำเครื่องหมายยืนยัน
                      </small>
                    </span>
                  </label>
                </div>
              </section>
              </FormPage>
                {HEALTH_SECTIONS.map((section, index) => {
                  const Icon = section.icon;
                  return (
                    <FormPage id={section.type} key={section.type}>
                    <section
                      className="panel patient-health-card"
                      data-motion-enter="panel"
                      key={section.type}
                    >
                      <div className="patient-panel-title">
                        <span
                          className={`patient-icon patient-icon-${section.color}`}
                        >
                          <Icon size={22} />
                        </span>
                        <div>
                          <span className="patient-card-eyebrow">
                            {section.english}
                          </span>
                          <h2>{section.title}</h2>
                        </div>
                        <span className="patient-section-number">
                          0{index + 1}
                        </span>
                      </div>
                      <div className="panel-body">
                        <p className="patient-card-description">
                          {section.description}
                        </p>
                        <HealthMeasurementFields
                          section={section}
                          values={values[section.type]}
                          onChange={(name, value) =>
                            updateMeasure(section.type, name, value)
                          }
                          errors={errors}
                          idPrefix="guest"
                        />
                      </div>
                    </section>
                    </FormPage>
                  );
                })}
            </fieldset>
            <FormPage id="review">
            <section className="panel" aria-label="ตรวจสอบข้อมูลผู้รับบริการครั้งนี้">
              <div className="panel-header"><h2>ข้อมูลผู้รับบริการครั้งนี้</h2></div>
              <div className="panel-body"><dl className="form-review-values">
                <div><dt>ชื่อผู้รับบริการ</dt><dd>{profile.firstName} {profile.lastName}</dd></div>
                <div><dt>เลขบัตรประชาชน</dt><dd>ลงท้าย {citizenId.slice(-4)}</dd></div>
                <div><dt>เพศ</dt><dd>{{ male: "ชาย", female: "หญิง" }[profile.gender] || "ไม่ระบุ"}</dd></div>
                <div><dt>วันเกิด</dt><dd>{formatThaiDate(profile.birthDate, { empty: "ไม่ระบุ" })}</dd></div>
                {profile.phone && <div><dt>เบอร์โทรศัพท์</dt><dd>{profile.phone}</dd></div>}
                <div><dt>สถานะการสูบบุหรี่</dt><dd>{{ never: "ไม่เคยสูบบุหรี่", current: "ยังสูบบุหรี่อยู่", former: `เลิกสูบบุหรี่แล้ว ${profile.smokingQuitMonths} เดือน` }[profile.smokingStatus] || "ไม่ระบุ"}</dd></div>
                <div><dt>โรคประจำตัว</dt><dd>{recordedDiseases.join(" · ") || (profile.chronicDiseasesConfirmed ? "ยืนยันว่าไม่มีโรคประจำตัว" : "ยังไม่ระบุ")}</dd></div>
                <div><dt>การตรวจสอบโรคประจำตัว</dt><dd>{profile.chronicDiseasesConfirmed ? "ตรวจสอบแล้ว" : "ยังไม่ได้ยืนยัน"}</dd></div>
                {profile.chronicDiseases.includes("มะเร็ง") && <div><dt>ชนิดหรือตำแหน่งมะเร็ง</dt><dd>{profile.cancerDetails}</dd></div>}
              </dl></div>
            </section>
            <HealthEntrySummary values={values} />
            <Agreements value={agreements} onChange={(next) => { setAgreements(next); setAgreementError(""); }}
              error={agreementError} disabled={saving} idPrefix="guest-agreement" />
            <div className="patient-save-bar">
              <div className="patient-save-copy">
                <ShieldCheck size={23} />
                <div>
                  <strong>ตรวจสอบข้อมูลก่อนส่ง</strong>
                  <p>ส่งเฉพาะส่วนที่กรอก ทุกส่วนจะอยู่ในชุดรายการเดียวกัน</p>
                </div>
              </div>
              <Button type="submit" loading={saving}>
                <Send size={17} /> ส่งข้อมูลเพื่อรอตรวจสอบ
              </Button>
            </div>
            </FormPage>
          </form>
          </FormPages>
        </>
      )}
    </PublicLayout>
  );
}
