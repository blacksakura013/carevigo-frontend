import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  getApiError,
  getPatientProfile,
  updatePatientProfile,
} from "../api/api";
import {
  Button,
  Field,
  Notice,
  PageHeading,
  PublicLayout,
} from "../components/ui";
import { ThaiCvRiskCard } from "./AddHealth";
import "../styles/patient.css";
import Agreements from "../components/Agreements";
import { agreementPayload, agreementsComplete } from "../utils/legal";
import { usePrivateDraft } from "../utils/privateDraft";
import BuddhistDateInput from "../components/BuddhistDateInput";
import FormPages, { FormPage } from "../components/FormPages";
import { formatThaiDate, gregorianDate, todayGregorian } from "../utils/thaiDate";

const CONDITIONS = [
  "เบาหวาน",
  "ความดันโลหิตสูง",
  "โรคหัวใจ",
  "โรคหลอดเลือดสมอง",
  "มะเร็ง",
  "ไขมันในเส้นเลือด",
];
const DEFAULTS = {
  firstName: "",
  lastName: "",
  gender: "",
  birthDate: "",
  phone: "",
  email: "",
  lineId: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  province: "",
  district: "",
  subdistrict: "",
  address: "",
  occupation: "",
  weight: "",
  height: "",
  smokingStatus: "",
  smokingQuitMonths: "",
  chronicDiseases: [],
  cancerDetails: "",
  chronicDiseasesConfirmed: false,
};
const PROFILE_PAGES = [
  { id: "basic", title: "ข้อมูลพื้นฐาน" },
  { id: "risk", title: "พฤติกรรมและโรคประจำตัว" },
  { id: "contact", title: "ข้อมูลติดต่อและที่อยู่" },
  { id: "emergency", title: "ผู้ติดต่อฉุกเฉิน" },
  { id: "review", title: "ตรวจสอบและบันทึก" },
];
function dateForInput(value) {
  return gregorianDate(String(value || "").slice(0, 10));
}
function toDraft(patient) {
  const draft = Object.fromEntries(
    Object.entries(DEFAULTS).map(([name, fallback]) => [
      name,
      patient[name] ?? fallback,
    ]),
  );
  draft.birthDate = dateForInput(patient.birthDate);
  draft.gender = ["male", "ชาย"].includes(patient.gender)
    ? "male"
    : ["female", "หญิง"].includes(patient.gender)
      ? "female"
      : "";
  draft.smokingStatus = ["never", "current", "former"].includes(
    patient.smokingStatus,
  )
    ? patient.smokingStatus
    : "";
  const aliases = {
    diabetes: "เบาหวาน",
    hypertension: "ความดันโลหิตสูง",
    "heart disease": "โรคหัวใจ",
    stroke: "โรคหลอดเลือดสมอง",
    cancer: "มะเร็ง",
    dyslipidemia: "ไขมันในเส้นเลือด",
    ไขมันในเลือดสูง: "ไขมันในเส้นเลือด",
  };
  const conditions = [
    ...new Set(
      (patient.chronicDiseases || []).map(
        (condition) =>
          aliases[condition.toLowerCase()] ||
          (condition.startsWith("มะเร็ง") ? "มะเร็ง" : condition),
      ),
    ),
  ];
  draft.chronicDiseases = conditions.filter((condition) =>
    CONDITIONS.includes(condition),
  );
  draft.otherDiseases = conditions
    .filter((condition) => !CONDITIONS.includes(condition))
    .join(", ");
  draft.cancerDetails =
    patient.cancerDetails ||
    (patient.chronicDiseases || []).find(
      (condition) => condition.startsWith("มะเร็ง") && condition !== "มะเร็ง",
    ) ||
    "";
  return draft;
}

export default function Profile() {
  const { read: readDraft, write: writeDraft, clear: clearDraft } = usePrivateDraft("patient", "profile");
  const { read: readStep, write: writeStep } = usePrivateDraft("patient", "profile-step");
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState({ ...DEFAULTS, otherDiseases: "" });
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [agreements, setAgreements] = useState({});
  const [agreementError, setAgreementError] = useState("");
  const [success, setSuccess] = useState(false);
  const [assessmentRefreshPending, setAssessmentRefreshPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const resultRef = useRef(null);
  const pagesRef = useRef(null);
  useEffect(() => {
    document.title = "ข้อมูลส่วนตัว | Save Stroke";
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    getPatientProfile()
      .then((response) => {
        if (!active) return;
        const person = response.data?.data?.patient;
        if (!person) throw new Error("Missing patient profile");
        const next = toDraft(person);
        setPatient(person);
        setAssessmentRefreshPending(response.data?.data?.assessmentRefreshPending === true);
        setForm(readDraft()?.form || next);
        setInitial(next);
      })
      .catch((requestError) => {
        if (active)
          setLoadError(
            getApiError(
              requestError,
              "โหลดข้อมูลส่วนตัวไม่สำเร็จ กรุณาลองอีกครั้ง",
            ),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, readDraft]);
  useEffect(() => {
    if (loading || !initial) return;
    if (JSON.stringify(form) !== JSON.stringify(initial)) writeDraft({ form });
    else clearDraft();
  }, [form, initial, loading, writeDraft, clearDraft]);
  const update = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "otherDiseases" ? { chronicDiseasesConfirmed: false } : {}),
    }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
    setSuccess(false);
    setError("");
  };
  const toggleCondition = (condition, checked) => {
    setForm((previous) => ({
      ...previous,
      chronicDiseasesConfirmed: false,
      chronicDiseases: checked
        ? [...previous.chronicDiseases, condition]
        : previous.chronicDiseases.filter((item) => item !== condition),
    }));
    setSuccess(false);
    setError("");
  };
  const dirty = initial && JSON.stringify(form) !== JSON.stringify(initial);
  const submit = async (event) => {
    event.preventDefault();
    if (saving || !dirty) return;
    const nextErrors = {};
    ["firstName", "lastName"].forEach((name) => {
      if (!form[name].trim())
        nextErrors[name] =
          name === "firstName" ? "กรุณากรอกชื่อ" : "กรุณากรอกนามสกุล";
    });
    if (
      form.birthDate &&
      (!gregorianDate(form.birthDate) || form.birthDate > todayGregorian())
    )
      nextErrors.birthDate = "กรุณาเลือกวันเกิดที่ถูกต้องและไม่เกินวันนี้";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      nextErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    ["phone", "emergencyContactPhone"].forEach((name) => {
      if (form[name] && !/^0\d{8,9}$/.test(form[name].replace(/[\s-]/g, "")))
        nextErrors[name] = "กรุณากรอกเบอร์โทร 9–10 หลัก เริ่มด้วย 0";
    });
    ["weight", "height"].forEach((name) => {
      if (
        form[name] !== "" &&
        (!Number.isFinite(Number(form[name])) || Number(form[name]) <= 0)
      )
        nextErrors[name] = "กรุณากรอกตัวเลขมากกว่า 0";
    });
    if (
      form.smokingStatus === "former" &&
      (form.smokingQuitMonths === "" ||
        !Number.isInteger(Number(form.smokingQuitMonths)) ||
        Number(form.smokingQuitMonths) < 0)
    )
      nextErrors.smokingQuitMonths =
        "กรุณาระบุจำนวนเดือนเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป";
    if (form.chronicDiseases.includes("มะเร็ง") && !form.cancerDetails.trim())
      nextErrors.cancerDetails = "กรุณาระบุชนิดหรือตำแหน่งของมะเร็ง";
    if (form.emergencyContactPhone && !form.emergencyContactName.trim())
      nextErrors.emergencyContactName = "กรุณาระบุชื่อผู้ติดต่อ";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      pagesRef.current?.focusField(`profile-${Object.keys(nextErrors)[0]}`);
      return;
    }
    if (!agreementsComplete(agreements)) {
      setAgreementError("กรุณาอ่านเงื่อนไขและให้ความยินยอมก่อนบันทึกการเปลี่ยนแปลง");
      pagesRef.current?.focusField("profile-agreement-terms");
      return;
    }
    const { otherDiseases, ...payload } = form;
    payload.agreements = agreementPayload(agreements);
    payload.firstName = payload.firstName.trim();
    payload.lastName = payload.lastName.trim();
    payload.birthDate = form.birthDate.replaceAll("-", "");
    payload.chronicDiseases = [
      ...form.chronicDiseases,
      ...otherDiseases
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ];
    payload.weight = form.weight === "" ? null : Number(form.weight);
    payload.height = form.height === "" ? null : Number(form.height);
    payload.smokingQuitMonths =
      form.smokingStatus === "former" ? Number(form.smokingQuitMonths) : null;
    payload.cancerDetails = form.chronicDiseases.includes("มะเร็ง")
      ? form.cancerDetails.trim()
      : "";
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const response = await updatePatientProfile(payload);
      const person = response.data?.data?.patient;
      if (!person) throw new Error("Missing saved profile");
      const next = toDraft(person);
      clearDraft();
      setPatient(person);
      setAssessmentRefreshPending(response.data?.data?.assessmentRefreshPending === true);
      setForm(next);
      setInitial(next);
      setAgreements({});
      setAgreementError("");
      setSuccess(true);
      setTimeout(() => resultRef.current?.focus(), 0);
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          "บันทึกข้อมูลไม่สำเร็จ ข้อมูลที่แก้ไขยังอยู่ กรุณาลองอีกครั้ง",
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  const input = (name, label, options = {}) => (
    <Field
      key={name}
      label={label}
      id={`profile-${name}`}
      hint={options.hint}
      error={errors[name]}
      required={options.required}
    >
      {name === "birthDate" ? <BuddhistDateInput id={`profile-${name}`} name={name} label={label} value={form[name]} onChange={update}
        aria-invalid={Boolean(errors[name])} aria-describedby={`profile-${name}-description`} /> : <input
        className="input"
        id={`profile-${name}`}
        name={name}
        value={form[name]}
        onChange={update}
        type={options.type || "text"}
        required={options.required}
        autoComplete={options.autoComplete}
        placeholder={options.placeholder}
        inputMode={options.type === "number" ? "decimal" : undefined}
        step={options.step || "any"}
        min={options.min ?? (options.type === "number" ? "0.01" : undefined)}
      />}
    </Field>
  );
  const select = (name, label, options) => (
    <Field key={name} label={label} id={`profile-${name}`}>
      <select
        className="input"
        id={`profile-${name}`}
        name={name}
        value={form[name]}
        onChange={update}
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

  return (
    <PublicLayout active="profile">
      <PageHeading
        eyebrow="MY HEALTH PROFILE"
        title="ข้อมูลส่วนตัวของฉัน"
        description="อัปเดตข้อมูลให้ครบถ้วน เพื่อให้การดูแลและประเมินสุขภาพตรงกับคุณ"
      />
      {loading ? (
        <section className="panel patient-history-loading" role="status">
          <div className="patient-skeleton" />
          <div className="patient-skeleton" />
          <span>กำลังโหลดข้อมูลส่วนตัว…</span>
        </section>
      ) : loadError ? (
        <Notice tone="error">
          {loadError}{" "}
          <Button
            variant="ghost"
            onClick={() => setAttempt((previous) => previous + 1)}
          >
            ลองอีกครั้ง
          </Button>
        </Notice>
      ) : (
        patient && (
          <>
            <div className="patient-person-strip">
              <span className="patient-existing-avatar">
                <UserRound size={23} />
              </span>
              <div>
                <span className="muted">ผู้รับบริการ</span>
                <strong>
                  {patient.firstName} {patient.lastName}
                </strong>
              </div>
              <div className="patient-person-id">
                <span className="muted">เลขบัตรประชาชน</span>
                <strong>{patient.citizenId}</strong>
              </div>
              <span
                className={`badge ${patient.isVerified ? "badge-success" : "badge-warning"}`}
              >
                {patient.isVerified
                  ? "เจ้าหน้าที่ยืนยันข้อมูลแล้ว"
                  : "รอเจ้าหน้าที่ตรวจสอบ"}
              </span>
            </div>
            {assessmentRefreshPending ? (
              <Notice tone="warning">
                ผลประเมิน CV risk ยังอัปเดตไม่สำเร็จ ข้อมูลส่วนตัวบันทึกแล้ว โดยไม่ต้องบันทึกข้อมูลซ้ำ
                <Button variant="secondary" onClick={() => setAttempt((previous) => previous + 1)}>
                  ลองโหลดผลประเมินอีกครั้ง
                </Button>
              </Notice>
            ) : <ThaiCvRiskCard risk={patient.thaiCvRisk} />}
              {success && (
                <div tabIndex={-1} ref={resultRef}>
                  <Notice tone="success">
                    <CheckCircle2 size={15} /> บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว
                    {!assessmentRefreshPending && " ระบบอัปเดตผลประเมินตามข้อมูลล่าสุด"}
                  </Notice>
                </div>
              )}
              {error && <Notice tone="error">{error}</Notice>}
            <FormPages ref={pagesRef} steps={PROFILE_PAGES} busy={saving}
              initialStep={readStep()?.step} onStepChange={(step) => writeStep({ step })}>
            <form
              className="patient-profile-form"
              onSubmit={submit}
              noValidate
              aria-busy={saving}
            >
              <fieldset className="patient-fieldset" disabled={saving}>
                <FormPage id="basic">
                <section className="panel">
                  <div className="patient-panel-title">
                    <span className="patient-icon">
                      <UserRound size={21} />
                    </span>
                    <div>
                      <h2>ข้อมูลพื้นฐาน</h2>
                      <p>เพศและวันเกิดใช้ในการประเมินความเสี่ยง Thai CV</p>
                    </div>
                  </div>
                  <div className="panel-body field-grid">
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
                    {input("weight", "น้ำหนัก (กก.)", { type: "number" })}
                    {input("height", "ส่วนสูง (ซม.)", { type: "number" })}
                  </div>
                </section>
                </FormPage>
                <FormPage id="risk">
                <section className="panel">
                  <div className="patient-panel-title">
                    <span className="patient-icon">
                      <HeartPulse size={21} />
                    </span>
                    <div>
                      <h2>พฤติกรรมและโรคประจำตัว</h2>
                      <p>ระบุตามข้อมูลปัจจุบัน เลือกโรคประจำตัวได้หลายข้อ</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <div className="field-grid">
                      {select("smokingStatus", "สถานะการสูบบุหรี่", {
                        never: "ไม่เคยสูบบุหรี่",
                        current: "ยังสูบบุหรี่อยู่",
                        former: "เลิกสูบบุหรี่แล้ว",
                      })}
                      {form.smokingStatus === "former" &&
                        input(
                          "smokingQuitMonths",
                          "เลิกสูบบุหรี่มาแล้ว (เดือน)",
                          {
                            type: "number",
                            min: "0",
                            step: "1",
                            required: true,
                            hint: "กรอก 0 หากเลิกสูบมายังไม่ครบ 1 เดือน",
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
                              checked={form.chronicDiseases.includes(condition)}
                              onChange={(event) =>
                                toggleCondition(condition, event.target.checked)
                              }
                            />
                            <span>{condition}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {form.chronicDiseases.includes("มะเร็ง") && (
                      <div className="patient-cancer-details">
                        {input("cancerDetails", "ชนิดหรือตำแหน่งของมะเร็ง", {
                          required: true,
                          hint: "ระบุตามข้อมูลการวินิจฉัยที่คุณทราบ",
                        })}
                      </div>
                    )}
                    {input("otherDiseases", "โรคประจำตัวอื่น ๆ", {
                      hint: "หากมีหลายโรค คั่นด้วยเครื่องหมายจุลภาค ( , )",
                    })}
                    <label className="patient-confirm-history">
                      <input
                        type="checkbox"
                        checked={form.chronicDiseasesConfirmed}
                        onChange={(event) => {
                          setForm((previous) => ({
                            ...previous,
                            chronicDiseasesConfirmed: event.target.checked,
                          }));
                          setSuccess(false);
                        }}
                      />
                      <span>
                        ยืนยันว่าตรวจสอบข้อมูลโรคประจำตัวแล้ว
                        <small>
                          หากไม่มีโรคประจำตัว
                          ให้เว้นรายการด้านบนและทำเครื่องหมายยืนยัน
                          เพื่อให้ระบบใช้ข้อมูลในการประเมินความเสี่ยง
                        </small>
                      </span>
                    </label>
                  </div>
                </section>
                </FormPage>
                <FormPage id="contact">
                <section className="panel">
                  <div className="patient-panel-title">
                    <span className="patient-icon">
                      <MapPin size={21} />
                    </span>
                    <div>
                      <h2>ข้อมูลติดต่อและที่อยู่</h2>
                      <p>ช่องทางติดต่อสำหรับการดูแลสุขภาพ</p>
                    </div>
                  </div>
                  <div className="panel-body field-grid">
                    {input("phone", "เบอร์โทรศัพท์", {
                      type: "tel",
                      autoComplete: "tel",
                    })}
                    {input("email", "อีเมล", {
                      type: "email",
                      autoComplete: "email",
                    })}
                    {input("lineId", "LINE ID")}
                    {input("province", "จังหวัด", {
                      autoComplete: "address-level1",
                    })}
                    {input("district", "อำเภอ / เขต", {
                      autoComplete: "address-level2",
                    })}
                    {input("subdistrict", "ตำบล / แขวง", {
                      autoComplete: "address-level3",
                    })}
                    {input("address", "บ้านเลขที่ ถนน หมู่บ้าน", {
                      autoComplete: "street-address",
                    })}
                    {input("occupation", "อาชีพ")}
                  </div>
                </section>
                </FormPage>
                <FormPage id="emergency">
                <section className="panel">
                  <div className="patient-panel-title">
                    <span className="patient-icon">
                      <Phone size={21} />
                    </span>
                    <div>
                      <h2>ผู้ติดต่อฉุกเฉิน</h2>
                      <p>บุคคลที่สามารถติดต่อแทนคุณได้</p>
                    </div>
                  </div>
                  <div className="panel-body field-grid">
                    {input("emergencyContactName", "ชื่อ–นามสกุลผู้ติดต่อ")}
                    {input("emergencyContactPhone", "เบอร์โทรผู้ติดต่อ", {
                      type: "tel",
                    })}
                  </div>
                </section>
                </FormPage>
              </fieldset>
              <FormPage id="review">
              <section className="panel">
                <div className="patient-panel-title">
                  <span className="patient-icon"><ClipboardList size={21} /></span>
                  <div><h2>ตรวจสอบข้อมูลส่วนตัวก่อนบันทึก</h2><p>สรุปจากข้อมูลที่คุณแก้ไขในครั้งนี้ ย้อนกลับเพื่อแก้ไขแต่ละส่วนได้</p></div>
                </div>
                <div className="panel-body">
                  <dl className="form-pages-summary">
                    <div><dt>ชื่อ–นามสกุล</dt><dd>{`${form.firstName} ${form.lastName}`.trim() || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>เพศสำหรับการประเมินความเสี่ยง</dt><dd>{{ male: "ชาย", female: "หญิง" }[form.gender] || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>วันเกิด</dt><dd>{form.birthDate ? formatThaiDate(form.birthDate) : "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>เบอร์โทรศัพท์</dt><dd>{form.phone || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>อีเมล</dt><dd>{form.email || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>LINE ID</dt><dd>{form.lineId || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>จังหวัด</dt><dd>{form.province || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>ที่อยู่ อำเภอ / เขต ตำบล / แขวง</dt><dd>{[form.address, form.district, form.subdistrict].filter(Boolean).join(" · ") || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>อาชีพ</dt><dd>{form.occupation || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>น้ำหนัก / ส่วนสูง</dt><dd>{form.weight ? `${form.weight} กก.` : "ไม่ได้ระบุน้ำหนัก"} · {form.height ? `${form.height} ซม.` : "ไม่ได้ระบุส่วนสูง"}</dd></div>
                    <div><dt>สถานะการสูบบุหรี่</dt><dd>{{ never: "ไม่เคยสูบบุหรี่", current: "ยังสูบบุหรี่อยู่", former: `เลิกสูบบุหรี่แล้ว ${form.smokingQuitMonths || "0"} เดือน` }[form.smokingStatus] || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>โรคประจำตัวที่เลือก</dt><dd>{[...form.chronicDiseases, form.otherDiseases].filter(Boolean).join(", ") || (form.chronicDiseasesConfirmed ? "ยืนยันว่าไม่มีโรคประจำตัว" : "ยังไม่ได้ยืนยันข้อมูล")}</dd></div>
                    <div><dt>การตรวจสอบโรคประจำตัว</dt><dd>{form.chronicDiseasesConfirmed ? "ตรวจสอบข้อมูลแล้ว" : "ยังไม่ได้ยืนยันข้อมูล"}</dd></div>
                    {form.chronicDiseases.includes("มะเร็ง") && <div><dt>ชนิดหรือตำแหน่งของมะเร็ง</dt><dd>{form.cancerDetails || "ไม่ได้ระบุ"}</dd></div>}
                    <div><dt>ผู้ติดต่อฉุกเฉิน</dt><dd>{[form.emergencyContactName, form.emergencyContactPhone].filter(Boolean).join(" · ") || "ไม่ได้ระบุ"}</dd></div>
                  </dl>
                </div>
              </section>
              <Agreements value={agreements} onChange={(next) => { setAgreements(next); setAgreementError(""); }}
                error={agreementError} disabled={saving} idPrefix="profile-agreement" />
              <div className="patient-form-footer">
                <p>
                  <ShieldCheck size={17} /> บันทึกเฉพาะข้อมูลของบัญชีคุณ
                </p>
                <div className="inline-actions">
                  <Link className="btn btn-secondary" to="/health">
                    บันทึกผลตรวจ <ArrowRight size={17} />
                  </Link>
                  <Button type="submit" loading={saving} disabled={!dirty}>
                    <Save size={17} /> บันทึกการเปลี่ยนแปลง
                  </Button>
                </div>
              </div>
              </FormPage>
            </form>
            </FormPages>
          </>
        )
      )}
    </PublicLayout>
  );
}
