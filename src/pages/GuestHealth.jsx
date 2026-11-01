import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { getApiError, getGuestProfile, submitGuestHealth } from "../api/api";
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
  selectedHealthValues,
  HealthEntrySummary,
  ThaiCvRiskCard,
} from "./AddHealth";
import Agreements from "../components/Agreements";
import { agreementPayload, agreementsComplete } from "../utils/legal";
import BuddhistDateInput from "../components/BuddhistDateInput";
import { formatThaiDate, gregorianDate, todayGregorian } from "../utils/thaiDate";
import FormPages, { FormPage } from "../components/FormPages";
import HealthResultSummary from "../components/HealthResultSummary";
import HealthSectionPicker from "../components/HealthSectionPicker";
import { guestProfileLookupFailure, readGuestProfile } from "../utils/guestProfileLookup";
import "../styles/patient.css";
import "../styles/guest-lookup.css";

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
function personalFields(value) {
  const fields = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return fields;
  for (const name of ["firstName", "lastName", "phone"])
    if (typeof value[name] === "string") fields[name] = value[name].trim().slice(0, 100);
  const gender = typeof value.gender === "string" ? value.gender.trim() : "";
  if (["male", "ชาย"].includes(gender)) fields.gender = "male";
  if (["female", "หญิง"].includes(gender)) fields.gender = "female";
  const birthDate = gregorianDate(value.birthDate);
  if (birthDate && birthDate <= todayGregorian()) fields.birthDate = birthDate;
  return fields;
}
const GUEST_FORM_STEPS = [
  { id: "personal", title: "ข้อมูลผู้รับบริการ", description: "กรอกข้อมูลของผู้ที่ต้องการบันทึกสุขภาพครั้งนี้" },
  { id: "conditions", title: "พฤติกรรมและโรคประจำตัว", description: "กรอกข้อมูลที่ทราบ เลือกโรคได้มากกว่า 1 ข้อ" },
  { id: "measurements", title: "เลือกรายการสุขภาพ", description: "เลือกเฉพาะหมวดที่ต้องการบันทึก หรือไม่เลือกเลยก็ได้" },
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
const acknowledgementTime = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const ASSESSMENT_FIELDS = new Set(["age", "birthDate", "gender", "sex", "smokingStatus", "smokingQuitMonths", "chronicDiseasesConfirmed", "systolic", "totalCholesterol", "total"]);
function acceptedAssessment(value) {
  if (!value || !["calculated", "incomplete", "ineligible", "pending"].includes(value.status))
    return { status: "pending", score: null, reason: "ระบบรับข้อมูลแล้ว แต่ยังไม่ได้รับผลประเมิน CVD risk จากระบบ" };
  const assessment = { status: value.status, score: typeof value.score === "number" && Number.isFinite(value.score) ? value.score : null };
  for (const field of ["label", "reason"])
    if (typeof value[field] === "string") assessment[field] = value[field].slice(0, 1000);
  if (typeof value.displayScore === "string" && /^[<>]?\d+(?:\.\d+)?%$/.test(value.displayScore)) assessment.displayScore = value.displayScore;
  if (typeof value.source === "string" && value.source.startsWith("https://www.rama.mahidol.ac.th/")) assessment.source = value.source;
  if (Array.isArray(value.missing)) assessment.missing = value.missing.filter(field => ASSESSMENT_FIELDS.has(field));
  assessment.calculatedAt = acknowledgementTime(value.calculatedAt);
  assessment.inputs = {};
  if (value.inputs?.profileSource === "submitted-profile") assessment.inputs.profileSource = "submitted-profile";
  for (const field of ["bloodPressureRecordedAt", "cholesterolRecordedAt"])
    assessment.inputs[field] = acknowledgementTime(value.inputs?.[field]);
  return assessment;
}

function GuestMeasurementSummary({ values, recordCount, submitted = false }) {
  if (recordCount) return <HealthEntrySummary values={values} />;
  return <section className="panel" aria-label="ผลตรวจสุขภาพที่ไม่ได้ระบุ">
    <div className="panel-header"><h2>ผลตรวจสุขภาพครั้งนี้</h2></div>
    <div className="panel-body"><p>{submitted ? "ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ" : "ยังไม่ได้ระบุผลตรวจสุขภาพ สามารถส่งข้อมูลผู้รับบริการได้โดยไม่กรอกผลตรวจ"}</p></div>
  </section>;
}

function GuestSubmittedSummary({ summary, resultRef, onStartNew }) {
  const person = summary.profile;
  return <section className="patient-profile-form guest-submitted-summary" aria-label="สรุปข้อมูลที่ส่งครั้งนี้" ref={resultRef} tabIndex={-1}>
    <section className="panel patient-guest-confirmation guest-submitted-header">
      <span className="patient-success-icon"><CheckCircle2 size={34} /></span>
      <h2>{summary.recordCount ? `ส่งข้อมูลเรียบร้อยแล้ว ${summary.recordCount} รายการ` : "ส่งข้อมูลผู้รับบริการเรียบร้อยแล้ว"}</h2>
      <p>ระบบรับข้อมูลแล้ว สรุปด้านล่างเป็นข้อมูลที่คุณส่งในครั้งนี้</p>
    </section>
    <HealthResultSummary records={healthRecordPayloads(summary.values)} context="pending-review" birthDate={person.birthDate} gender={person.gender} asOf={summary.submittedAt || summary.clientSubmittedAt} />
    <div className="guest-submitted-assessment">
      <p className="patient-server-assessment">ประเมินจากข้อมูลครั้งนี้ · รอเจ้าหน้าที่ตรวจสอบ</p>
      <ThaiCvRiskCard risk={summary.assessment} />
    </div>
    <div className="guest-summary-actions">
      <Button onClick={onStartNew}><Plus size={19} /> บันทึกรายการใหม่</Button>
    </div>
    <section className="panel" aria-label="ข้อมูลการส่งครั้งนี้">
      <div className="panel-header"><h2>ข้อมูลการส่ง</h2></div>
      <div className="panel-body">
        <dl className="form-review-values">
          <div><dt>สถานะเมื่อส่งข้อมูล</dt><dd><span className="badge badge-warning">รอเจ้าหน้าที่ตรวจสอบ</span></dd></div>
          <div><dt>จำนวนผลตรวจสุขภาพที่ส่ง</dt><dd>{summary.recordCount} รายการ</dd></div>
          <div><dt>{summary.submittedAt ? "เวลาที่ระบบรับข้อมูล" : "เวลาส่งจากอุปกรณ์นี้"}</dt>
            <dd>{formatThaiDate(summary.submittedAt || summary.clientSubmittedAt, { withTime: true })} น. (เวลาไทย)</dd></div>
          <div><dt>กำหนดยืนยันอัตโนมัติ</dt><dd>{summary.reviewDueAt
            ? `${formatThaiDate(summary.reviewDueAt, { withTime: true })} น. (เวลาไทย)`
            : "เวลา 23:59 น. ของวันที่ส่งข้อมูล (เวลาไทย)"}</dd></div>
        </dl>
        <p>หากเจ้าหน้าที่ยังไม่ตรวจสอบภายในกำหนด ระบบจะยืนยันอัตโนมัติ สรุปนี้แสดงข้อมูล ณ เวลาที่ส่ง</p>
      </div>
    </section>
    <section className="panel" aria-label="ข้อมูลผู้รับบริการที่ส่งครั้งนี้">
      <div className="panel-header"><h2>ข้อมูลผู้รับบริการที่ส่ง</h2></div>
      <div className="panel-body"><dl className="form-review-values">
        <div><dt>ชื่อผู้รับบริการ</dt><dd>{person.firstName} {person.lastName}</dd></div>
        <div><dt>เลขบัตรประชาชน</dt><dd>{summary.maskedCitizenId}</dd></div>
        <div><dt>เพศ</dt><dd>{{ male: "ชาย", female: "หญิง" }[person.gender] || "ไม่ระบุ"}</dd></div>
        <div><dt>วันเกิด</dt><dd>{formatThaiDate(person.birthDate, { empty: "ไม่ระบุ" })}</dd></div>
        {person.phone && <div><dt>เบอร์โทรศัพท์</dt><dd>{person.phone}</dd></div>}
        <div><dt>สถานะการสูบบุหรี่</dt><dd>{{ never: "ไม่เคยสูบบุหรี่", current: "ยังสูบบุหรี่อยู่", former: `เลิกสูบบุหรี่แล้ว ${person.smokingQuitMonths} เดือน` }[person.smokingStatus] || "ไม่ระบุ"}</dd></div>
        <div><dt>โรคประจำตัว</dt><dd>{person.chronicDiseases.join(" · ") || (person.chronicDiseasesConfirmed ? "ยืนยันว่าไม่มีโรคประจำตัว" : "ยังไม่ระบุ")}</dd></div>
        <div><dt>การตรวจสอบโรคประจำตัว</dt><dd>{person.chronicDiseasesConfirmed ? "ตรวจสอบแล้ว" : "ยังไม่ได้ยืนยัน"}</dd></div>
        {person.chronicDiseases.includes("มะเร็ง") && <div><dt>ชนิดหรือตำแหน่งมะเร็ง</dt><dd>{person.cancerDetails}</dd></div>}
      </dl></div>
    </section>
  </section>;
}
export default function GuestHealth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [citizenId, setCitizenId] = useState("");
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });
  const [otherDiseases, setOtherDiseases] = useState("");
  const [values, setValues] = useState(emptyHealthValues);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [errors, setErrors] = useState({});
  const [agreements, setAgreements] = useState({});
  const [agreementError, setAgreementError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [focusNewEntry, setFocusNewEntry] = useState(false);
  const [profileLookup, setProfileLookup] = useState("");
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [lookupFailure, setLookupFailure] = useState(null);
  const [retryWait, setRetryWait] = useState(0);
  const requestKey = useRef({ fingerprint: "", id: "" });
  const pendingRef = useRef(false);
  const activeRef = useRef(true);
  const resultRef = useRef(null);
  const pagesRef = useRef(null);
  const lookupVersion = useRef(0);
  const lookupController = useRef(null);
  const lookupBusy = useRef(false);
  const editedFields = useRef(new Set());

  useEffect(() => {
    document.title = "บันทึกสุขภาพโดยไม่เข้าสู่ระบบ | Save Stroke";
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);
  useEffect(() => {
    document.title = confirmation ? "สรุปผลการบันทึกสุขภาพ | Save Stroke" : "บันทึกสุขภาพโดยไม่เข้าสู่ระบบ | Save Stroke";
  }, [confirmation]);
  useLayoutEffect(() => {
    if (!confirmation) return;
    const node = resultRef.current;
    node?.focus({ preventScroll: true });
    node?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [confirmation]);
  useLayoutEffect(() => {
    if (!focusNewEntry || confirmation) return;
    const field = document.getElementById("guest-citizenId");
    field?.focus({ preventScroll: true });
    field?.scrollIntoView?.({ block: "center", behavior: "auto" });
    setFocusNewEntry(false);
  }, [focusNewEntry, confirmation]);
  // Old receipt links open a fresh entry form; guest pages never fetch health data.
  useEffect(() => {
    if (location.search || location.hash) navigate("/guest", { replace: true });
  }, [location.search, location.hash, navigate]);
  useEffect(() => {
    if (confirmation || pendingRef.current || !/^\d{13}$/.test(citizenId)) return;
    const version = ++lookupVersion.current;
    const controller = new AbortController();
    lookupController.current = controller;
    lookupBusy.current = true;
    setProfileLookup("loading");
    const current = () => activeRef.current && version === lookupVersion.current && !controller.signal.aborted;
    const timer = setTimeout(async () => {
      if (!current()) return;
      try {
        const response = await getGuestProfile(citizenId, { signal: controller.signal, isCurrent: current });
        if (!current()) return;
        const person = readGuestProfile(response);
        const fields = personalFields(person);
        setProfile(previous => {
          if (!current()) return previous;
          const next = { ...previous };
          for (const [name, value] of Object.entries(fields))
            if (!editedFields.current.has(name)) next[name] = value;
          return next;
        });
        setLookupFailure(null);
        setProfileLookup(person === null ? "empty" : "found");
      } catch (failure) {
        if (current()) {
          const feedback = guestProfileLookupFailure(failure);
          setLookupFailure(feedback);
          setProfileLookup(feedback ? "error" : "");
        }
      } finally {
        if (current()) lookupBusy.current = false;
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (lookupController.current === controller) lookupController.current = null;
      if (lookupVersion.current === version) { lookupVersion.current += 1; lookupBusy.current = false; }
    };
  }, [citizenId, confirmation, lookupAttempt]);
  useEffect(() => {
    if (!lookupFailure?.retryAt) { setRetryWait(0); return; }
    let timer;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((lookupFailure.retryAt - Date.now()) / 1000));
      setRetryWait(remaining);
      if (remaining > 0) timer = setTimeout(update, 1000);
    };
    update();
    return () => clearTimeout(timer);
  }, [lookupFailure?.retryAt]);

  const cancelProfileLookup = () => {
    lookupVersion.current += 1;
    lookupController.current?.abort();
    lookupController.current = null;
    lookupBusy.current = false;
  };
  const retryProfileLookup = () => {
    if (!lookupFailure || lookupBusy.current || saving || pendingRef.current || confirmation || !/^\d{13}$/.test(citizenId) || lookupFailure.retryAt > Date.now()) return;
    cancelProfileLookup();
    lookupBusy.current = true;
    setProfileLookup("loading");
    setLookupAttempt(previous => previous + 1);
  };
  const changeCitizenId = (event) => {
    const nextId = event.target.value.replace(/\D/g, "").slice(0, 13);
    if (nextId === citizenId) return;
    cancelProfileLookup();
    editedFields.current = new Set();
    setCitizenId(nextId);
    setProfile({ ...EMPTY_PROFILE });
    setOtherDiseases("");
    setValues(emptyHealthValues());
    setSelectedTypes([]);
    setAgreements({});
    setAgreementError("");
    setErrors({});
    setError("");
    setProfileLookup(/^\d{13}$/.test(nextId) ? "loading" : "");
    setLookupFailure(null);
    setLookupAttempt(0);
    requestKey.current = { fingerprint: "", id: "" };
  };

  const updateProfile = (event) => {
    const { name, value } = event.target;
    editedFields.current.add(name);
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
  const formSteps = useMemo(() => GUEST_FORM_STEPS.filter(step => ["personal", "conditions", "measurements", "review"].includes(step.id) || selectedTypes.includes(step.id)), [selectedTypes]);
  const selectedValues = selectedHealthValues(values, selectedTypes);
  const records = healthRecordPayloads(selectedValues);
  const changeSelection = nextTypes => {
    if (pendingRef.current) return;
    const next = HEALTH_SECTIONS.filter(({ type }) => nextTypes.includes(type)).map(({ type }) => type);
    setSelectedTypes(next);
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => !HEALTH_SECTIONS.some(({ type }) => field.startsWith(`${type}-`) && !next.includes(type)))));
    setError("");
  };
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
    Object.assign(invalid, healthMeasurementErrors(selectedValues));
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      setError("กรุณาตรวจสอบข้อมูลในช่องที่ระบุ");
      pagesRef.current?.focusField(`guest-${Object.keys(invalid)[0]}`);
      return;
    }
    if (!agreementsComplete(agreements)) {
      setAgreementError("กรุณาอ่านเงื่อนไขและให้ความยินยอมสำหรับการบันทึกครั้งนี้ก่อนส่งข้อมูล");
      pagesRef.current?.focusField("guest-agreement-terms");
      return;
    }
    cancelProfileLookup();
    setProfileLookup("");
    setLookupFailure(null);
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
    const submitted = {
      maskedCitizenId: `•••••••••${citizenId.slice(-4)}`,
      profile: { ...profileData, chronicDiseases: [...profileData.chronicDiseases] },
      values: selectedHealthValues(values, selectedTypes),
      recordCount: records.length,
      clientSubmittedAt: new Date().toISOString(),
    };
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
      }, { isCurrent: () => activeRef.current });
      if (!activeRef.current) return;
      const data = response.data?.data;
      if (!data?.submissionId) throw new Error("Missing submission acknowledgement");
      setConfirmation({ ...submitted, assessment: acceptedAssessment(data.thaiCvRisk), submittedAt: acknowledgementTime(data.submittedAt), reviewDueAt: acknowledgementTime(data.reviewDueAt) });
      // Keep this entry's summary only in memory; clear the editable form now.
      setCitizenId("");
      setProfile({ ...EMPTY_PROFILE });
      setOtherDiseases("");
      setValues(emptyHealthValues());
      setSelectedTypes([]);
      setAgreements({});
      requestKey.current = { fingerprint: "", id: "" };
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
    cancelProfileLookup();
    editedFields.current = new Set();
    setProfileLookup("");
    setLookupFailure(null);
    setLookupAttempt(0);
    setCitizenId("");
    setProfile({ ...EMPTY_PROFILE });
    setOtherDiseases("");
    setValues(emptyHealthValues());
    setSelectedTypes([]);
    setAgreements({});
    setAgreementError("");
    setErrors({});
    setError("");
    setConfirmation(null);
    setFocusNewEntry(true);
    requestKey.current = { fingerprint: "", id: "" };
    pagesRef.current?.reset();
    navigate("/guest", { replace: true });
  };

  return (
    <PublicLayout active="guest" guestOnly>
      <PageHeading
        eyebrow={confirmation ? "SUBMISSION SUMMARY" : "QUICK HEALTH RECORD"}
        title={confirmation ? "สรุปผลการบันทึกสุขภาพ" : "บันทึกสุขภาพ ไม่ต้องเข้าสู่ระบบ"}
        description={confirmation ? "ระบบรับข้อมูลแล้ว ตรวจสอบผลประเมินและข้อมูลที่ส่งครั้งนี้" : "กรอกข้อมูลผู้รับบริการ ผลตรวจสุขภาพกรอกได้ตามที่มี"}
      />
      {confirmation ? (
        <GuestSubmittedSummary summary={confirmation} resultRef={resultRef} onStartNew={startNew} />
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
          <FormPages ref={pagesRef} steps={formSteps} busy={saving}>
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
                      hint="กรอกครบ 13 หลัก ระบบจะค้นหาข้อมูลส่วนตัวให้ หากไม่พบสามารถกรอกเองได้"
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
                        onChange={changeCitizenId}
                        placeholder="เลขบัตรประชาชน 13 หลัก"
                      />
                      {profileLookup && <div className={`guest-profile-lookup${profileLookup === "error" ? " guest-profile-lookup-error" : ""}`}>
                        <p role="status" aria-live="polite" aria-atomic="true">{profileLookup === "error" ? lookupFailure?.message : { loading: "กำลังค้นหาข้อมูลส่วนตัว คุณสามารถกรอกข้อมูลต่อได้", found: "พบข้อมูลส่วนตัวแล้ว กรุณาตรวจสอบก่อนส่ง ช่องที่คุณแก้ไขจะคงค่าที่กรอกไว้", empty: "ไม่พบข้อมูลเดิม กรุณากรอกข้อมูลผู้รับบริการครั้งนี้" }[profileLookup]}</p>
                        {lookupFailure && <div className="guest-profile-lookup-actions">
                          <Button type="button" variant="secondary" loading={profileLookup === "loading"} disabled={saving || retryWait > 0 || lookupFailure.retryAt > Date.now()} onClick={retryProfileLookup}>ลองค้นหาอีกครั้ง</Button>
                          {retryWait > 0 && <p aria-live="off">ลองใหม่ได้ในอีก {retryWait} วินาที</p>}
                        </div>}
                      </div>}
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
              <FormPage id="measurements">
                <HealthSectionPicker sections={HEALTH_SECTIONS} selectedTypes={selectedTypes} onChange={changeSelection} disabled={saving}
                  emptyMessage="หากไม่เลือกหมวดใด สามารถส่งเฉพาะข้อมูลผู้รับบริการได้โดยไม่กรอกผลตรวจสุขภาพ" />
              </FormPage>
                {HEALTH_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  return (
                    <FormPage id={section.type} key={section.type}>
                    <section
                      className={`panel patient-health-card patient-health-card-${section.type}`}
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
                          {String(formSteps.findIndex(step => step.id === section.type) + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="panel-body">
                        <Button type="button" variant="secondary" disabled={saving} onClick={() => pagesRef.current?.goTo("measurements")}>เปลี่ยนรายการสุขภาพ</Button>
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
                          disabled={!selectedTypes.includes(section.type)}
                          idPrefix="guest"
                        />
                      </div>
                    </section>
                    </FormPage>
                  );
                })}
            </fieldset>
            <FormPage id="review">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => pagesRef.current?.goTo("measurements")}>เปลี่ยนรายการสุขภาพ</Button>
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
            <GuestMeasurementSummary values={selectedValues} recordCount={records.length} />
            <Agreements value={agreements} onChange={(next) => { setAgreements(next); setAgreementError(""); }}
              error={agreementError} disabled={saving} idPrefix="guest-agreement" />
            <div className="patient-save-bar">
              <div className="patient-save-copy">
                <ShieldCheck size={23} />
                <div>
                  <strong>ตรวจสอบข้อมูลก่อนส่ง</strong>
                  <p>ส่งข้อมูลผู้รับบริการพร้อมผลตรวจที่กรอก หากไม่มีผลตรวจสามารถส่งข้อมูลได้</p>
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
