import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  IdCard,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { createUser, searchUser } from "../api/api";
import {
  Button,
  Field,
  Notice,
  PageHeading,
  PublicLayout,
} from "../components/ui";
import "../styles/patient.css";
import Agreements from "../components/Agreements";
import { agreementPayload, agreementsComplete } from "../utils/legal";
import BuddhistDateInput from "../components/BuddhistDateInput";
import FormPages, { FormPage } from "../components/FormPages";
import { formatThaiDate, gregorianDate, todayGregorian } from "../utils/thaiDate";

const EMPTY_FORM = {
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
  weight: "",
  height: "",
  education: "",
  maritalStatus: "",
  occupation: "",
  economicStatus: "",
  chronicDiseases: [],
  smokingStatus: "",
  smokingQuitMonths: "",
  cancerDetails: "",
  chronicDiseasesConfirmed: false,
};
const CONDITIONS = [
  "เบาหวาน",
  "ความดันโลหิตสูง",
  "โรคหัวใจ",
  "โรคหลอดเลือดสมอง",
  "มะเร็ง",
  "ไขมันในเส้นเลือด",
];
const REGISTRATION_PAGES = [
  { id: "personal", title: "ข้อมูลส่วนตัว" },
  { id: "contact", title: "ข้อมูลติดต่อและที่อยู่" },
  { id: "general", title: "ข้อมูลเพิ่มเติม" },
  { id: "health", title: "ข้อมูลสุขภาพเบื้องต้น" },
  { id: "emergency", title: "ผู้ติดต่อฉุกเฉิน" },
  { id: "review", title: "ตรวจสอบและบันทึก" },
];
const today = () => {
  return todayGregorian();
};

export default function CreateUser() {
  const navigate = useNavigate();
  const [citizenId, setCitizenId] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [lookup, setLookup] = useState(null);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [agreements, setAgreements] = useState({});
  const [agreementError, setAgreementError] = useState("");
  const [error, setError] = useState("");
  const [otherDisease, setOtherDisease] = useState("");
  const lookupVersion = useRef(0);
  const drafts = useRef({});
  const profileRef = useRef(null);
  const successRef = useRef(null);
  const pagesRef = useRef(null);

  useEffect(() => {
    document.title = "ลงทะเบียน | Save Stroke";
  }, []);
  useEffect(() => {
    if (saved) successRef.current?.focus();
  }, [saved]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
  };
  const changeId = (event) => {
    const nextId = event.target.value.replace(/\D/g, "").slice(0, 13);
    if (lookup?.kind === "new")
      drafts.current[citizenId] = { form, otherDisease };
    lookupVersion.current += 1;
    setCitizenId(nextId);
    setLookup(null);
    setSaved(false);
    setError("");
    setErrors({});
    setAgreements({});
    setAgreementError("");
    setForm(drafts.current[nextId]?.form || { ...EMPTY_FORM });
    setOtherDisease(drafts.current[nextId]?.otherDisease || "");
    setPending(false);
    pagesRef.current?.reset();
  };
  const handleSearch = async (event) => {
    event.preventDefault();
    if (!/^\d{13}$/.test(citizenId)) {
      setErrors({ citizenId: "กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก" });
      return;
    }
    const requestVersion = ++lookupVersion.current;
    setPending(true);
    setError("");
    setErrors({});
    try {
      const response = await searchUser(citizenId);
      if (requestVersion !== lookupVersion.current) return;
      setLookup({
        kind: response.data?.data ? "existing" : "new",
        user: response.data?.data,
        citizenId,
      });
      setTimeout(() => profileRef.current?.focus(), 0);
    } catch (requestError) {
      if (requestVersion === lookupVersion.current)
        setError(
          "ตรวจสอบข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
        );
    } finally {
      if (requestVersion === lookupVersion.current) setPending(false);
    }
  };
  const handleSave = async (event) => {
    event.preventDefault();
    if (saving || lookup?.kind !== "new" || lookup.citizenId !== citizenId)
      return;
    const nextErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = "กรุณากรอกชื่อ";
    if (!form.lastName.trim()) nextErrors.lastName = "กรุณากรอกนามสกุล";
    if (!form.province.trim()) nextErrors.province = "กรุณากรอกจังหวัด";
    if (
      form.birthDate &&
      (!gregorianDate(form.birthDate) ||
        form.birthDate > today())
    )
      nextErrors.birthDate = "กรุณาเลือกวันเกิดที่ถูกต้องและไม่เกินวันนี้";
    ["phone", "emergencyContactPhone"].forEach((name) => {
      if (form[name] && !/^0\d{8,9}$/.test(form[name].replace(/[\s-]/g, "")))
        nextErrors[name] = "กรุณากรอกเบอร์โทร 9–10 หลัก เริ่มด้วย 0";
    });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      nextErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
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
      pagesRef.current?.focusField(`register-${Object.keys(nextErrors)[0]}`);
      return;
    }
    if (!agreementsComplete(agreements, { staff: true })) {
      setAgreementError("กรุณารับทราบเงื่อนไขและยืนยันอำนาจในการบันทึกข้อมูลให้ครบ");
      pagesRef.current?.focusField("register-agreement-terms");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== ""),
      );
      payload.citizenId = citizenId;
      payload.agreements = agreementPayload(agreements, { staff: true });
      payload.firstName = form.firstName.trim();
      payload.lastName = form.lastName.trim();
      payload.province = form.province.trim();
      if (form.birthDate)
        payload.birthDate = form.birthDate.replaceAll("-", "");
      if (form.weight) payload.weight = Number(form.weight);
      if (form.height) payload.height = Number(form.height);
      if (form.smokingStatus === "former")
        payload.smokingQuitMonths = Number(form.smokingQuitMonths);
      else delete payload.smokingQuitMonths;
      if (form.chronicDiseases.includes("มะเร็ง"))
        payload.cancerDetails = form.cancerDetails.trim();
      else delete payload.cancerDetails;
      payload.chronicDiseases = [
        ...form.chronicDiseases,
        ...otherDisease
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ];
      await createUser(payload);
      setSaved(true);
      delete drafts.current[citizenId];
    } catch (requestError) {
      setError(
        "บันทึกข้อมูลไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาตรวจสอบแล้วลองบันทึกอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  };
  const input = (name, label, options = {}) => (
    <Field
      key={name}
      label={label}
      id={`register-${name}`}
      error={errors[name]}
      required={options.required}
      hint={options.hint}
    >
      {name === "birthDate" ? <BuddhistDateInput id={`register-${name}`} name={name} label={label} value={form[name]} onChange={update}
        max={today()} aria-invalid={Boolean(errors[name])} aria-describedby={`register-${name}-description`} /> : <input
        id={`register-${name}`}
        className="input"
        name={name}
        value={form[name]}
        onChange={update}
        type={options.type || "text"}
        autoComplete={options.autoComplete}
        inputMode={options.inputMode}
        placeholder={options.placeholder}
        max={options.max}
        required={options.required}
        min={options.min ?? (options.type === "number" ? "0.01" : undefined)}
        step={options.step ?? (options.type === "number" ? "any" : undefined)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={
          errors[name]
            ? `register-${name}-error`
            : options.hint
              ? `register-${name}-hint`
              : undefined
        }
      />}
    </Field>
  );
  const select = (name, label, options) => (
    <Field key={name} label={label} id={`register-${name}`}>
      <select
        id={`register-${name}`}
        className="input"
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
  const step = saved ? 3 : lookup ? 2 : 1;

  return (
    <PublicLayout active="register">
      <PageHeading
        eyebrow="PATIENT REGISTRATION"
        title="สุขภาพที่ดี เริ่มจากรู้จักคุณ"
        description="ตรวจสอบข้อมูล ลงทะเบียน และเริ่มบันทึกสุขภาพของคุณได้ในที่เดียว"
      />
      <ol className="patient-steps" aria-label="ขั้นตอนลงทะเบียน">
        {["ตรวจสอบข้อมูล", "ข้อมูลส่วนตัว", "พร้อมบันทึกสุขภาพ"].map(
          (label, index) => (
            <li
              className={step >= index + 1 ? "is-active" : ""}
              key={label}
              aria-current={step === index + 1 ? "step" : undefined}
            >
              <span>
                {step > index + 1 ? <Check size={16} /> : `0${index + 1}`}
              </span>
              <div>{label}</div>
            </li>
          ),
        )}
      </ol>
      {saved ? (
        <section
          className="panel patient-success"
          tabIndex={-1}
          ref={successRef}
        >
          <div className="patient-success-icon">
            <CheckCircle2 size={38} />
          </div>
          <span className="eyebrow">REGISTRATION COMPLETE</span>
          <h2>บันทึกข้อมูลเรียบร้อยแล้ว</h2>
          <p>
            ลงทะเบียนคุณ{form.firstName} {form.lastName} แล้ว
            เจ้าหน้าที่สามารถตั้งรหัสผ่านชั่วคราวเพื่อเปิดบัญชีให้ผู้รับบริการ
          </p>
          <div className="inline-actions patient-success-actions">
            <Link className="btn btn-primary" to="/admin?view=members">
              เปิดบัญชีผู้รับบริการ <ArrowRight size={18} />
            </Link>
            <Button
              variant="secondary"
              onClick={() => navigate(`/health/${citizenId}`)}
            >
              บันทึกสุขภาพ
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div
            className={`patient-registration-grid ${lookup ? "patient-registration-grid-compact" : ""}`}
          >
            <section className="panel patient-lookup">
              <div className="patient-panel-title">
                <span className="patient-icon">
                  <IdCard size={23} />
                </span>
                <div>
                  <h2>ตรวจสอบข้อมูลของคุณ</h2>
                  <p>ค้นหาด้วยเลขบัตรประชาชนก่อนลงทะเบียน</p>
                </div>
              </div>
              <form onSubmit={handleSearch} noValidate>
                <Field
                  label="เลขบัตรประชาชน"
                  id="citizenId"
                  required
                  error={errors.citizenId}
                  hint="กรอกตัวเลข 13 หลัก โดยไม่เว้นวรรค"
                >
                  <div className="patient-lookup-row">
                    <input
                      id="citizenId"
                      name="citizenId"
                      className="input patient-id-input"
                      value={citizenId}
                      onChange={changeId}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={13}
                      required
                      placeholder="เลขบัตรประชาชน 13 หลัก"
                      disabled={saving}
                      aria-invalid={Boolean(errors.citizenId)}
                      aria-describedby={
                        errors.citizenId ? "citizenId-error" : "citizenId-hint"
                      }
                    />
                    <Button type="submit" loading={pending} disabled={saving}>
                      <Search size={18} /> ค้นหาข้อมูล
                    </Button>
                  </div>
                </Field>
              </form>
              <p className="patient-privacy">
                <ShieldCheck size={16} /> ใช้ข้อมูลของตนเอง
                หรือผู้ที่คุณได้รับอนุญาตให้ดูแล
              </p>
            </section>
            {!lookup && (
              <aside className="patient-prepare">
                <ClipboardList size={26} />
                <h2>เตรียมข้อมูลให้พร้อม</h2>
                <p>
                  ใช้เวลาเพียงไม่กี่นาที เพื่อให้การดูแลสุขภาพต่อเนื่องยิ่งขึ้น
                </p>
                <ul>
                  <li>
                    <CheckCircle2 size={16} /> เลขบัตรประชาชน 13 หลัก
                  </li>
                  <li>
                    <CheckCircle2 size={16} /> ข้อมูลส่วนตัวและที่อยู่
                  </li>
                  <li>
                    <CheckCircle2 size={16} /> ผู้ติดต่อฉุกเฉินและโรคประจำตัว
                    (ถ้ามี)
                  </li>
                </ul>
              </aside>
            )}
          </div>
          {error && lookup?.kind !== "new" && (
            <Notice tone="error">{error}</Notice>
          )}
          {lookup?.kind === "existing" && (
            <section
              className="panel patient-existing"
              tabIndex={-1}
              ref={profileRef}
            >
              <div className="patient-existing-avatar">
                <UserRound size={31} />
              </div>
              <div>
                <span className="badge badge-success">พบข้อมูลในระบบ</span>
                <h2>
                  {lookup.user.firstName || "ผู้รับบริการ"}{" "}
                  {lookup.user.lastName || ""}
                </h2>
                <p>
                  คุณสามารถบันทึกสุขภาพครั้งใหม่ หรือดูประวัติที่ผ่านมาได้เลย
                </p>
              </div>
              <div className="inline-actions">
                <Link className="btn btn-primary" to="/admin?view=members">
                  จัดการบัญชีผู้รับบริการ <ArrowRight size={18} />
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/health/${citizenId}`)}
                >
                  บันทึกสุขภาพ
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/history/${citizenId}`)}
                >
                  ดูประวัติ
                </Button>
              </div>
            </section>
          )}
          {lookup?.kind === "new" && (
            <FormPages ref={pagesRef} steps={REGISTRATION_PAGES} busy={saving}>
            <form
              onSubmit={handleSave}
              noValidate
              className="patient-profile-form"
              aria-busy={saving}
            >
              <Notice tone="info">
                ยังไม่พบข้อมูลของเลขบัตรนี้ กรุณากรอกข้อมูลเพื่อลงทะเบียน{" "}
                <span className="patient-required-note">
                  ช่องที่มี * จำเป็นต้องกรอก
                </span>
              </Notice>
              <fieldset disabled={saving} className="patient-fieldset">
                <FormPage id="personal">
                <section className="panel" tabIndex={-1} ref={profileRef}>
                  <div className="patient-panel-title">
                    <span className="patient-icon">
                      <UserRound size={21} />
                    </span>
                    <div>
                      <h2>ข้อมูลส่วนตัว</h2>
                      <p>ข้อมูลพื้นฐานสำหรับผู้รับบริการ</p>
                    </div>
                    <span className="patient-section-number">01</span>
                  </div>
                  <div className="panel-body field-grid">
                    {input("firstName", "ชื่อ", {
                      required: true,
                      autoComplete: "given-name",
                      placeholder: "ชื่อจริง",
                    })}
                    {input("lastName", "นามสกุล", {
                      required: true,
                      autoComplete: "family-name",
                      placeholder: "นามสกุล",
                    })}
                    {select("gender", "เพศสำหรับการประเมินความเสี่ยง", {
                      male: "ชาย",
                      female: "หญิง",
                    })}
                    {input("birthDate", "วันเกิด", {
                      max: today(),
                      autoComplete: "bday",
                      hint: "กรอกวัน/เดือน/ปี พ.ศ. เช่น 01/01/2523 ใช้คำนวณอายุในการประเมินความเสี่ยง",
                    })}
                  </div>
                </section>
                </FormPage>
                <FormPage id="contact">
                <section className="panel">
                  <div className="patient-panel-title">
                    <span className="patient-icon"><MapPin size={21} /></span>
                    <div>
                      <h2>ข้อมูลติดต่อและที่อยู่</h2>
                      <p>ช่วยให้เจ้าหน้าที่ติดต่อและดูแลได้สะดวก</p>
                    </div>
                    <span className="patient-section-number">02</span>
                  </div>
                  <div className="panel-body field-grid">
                    {input("phone", "เบอร์โทรศัพท์", {
                      type: "tel",
                      autoComplete: "tel",
                      placeholder: "08XXXXXXXX",
                    })}
                    {input("email", "อีเมล", {
                      type: "email",
                      autoComplete: "email",
                      placeholder: "name@example.com",
                    })}
                    {input("lineId", "LINE ID", {
                      placeholder: "LINE ID ของคุณ (ถ้ามี)",
                    })}
                    {input("province", "จังหวัด", {
                      required: true,
                      placeholder: "เช่น กรุงเทพมหานคร",
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
                  </div>
                </section>
                </FormPage>
                <FormPage id="general">
                <section className="panel">
                  <div className="patient-panel-title">
                    <span className="patient-icon"><ClipboardList size={21} /></span>
                    <div>
                      <h2>ข้อมูลเพิ่มเติม</h2>
                      <p>กรอกเฉพาะข้อมูลที่ทราบ สามารถเว้นว่างได้</p>
                    </div>
                    <span className="patient-section-number">03</span>
                  </div>
                  <div className="panel-body field-grid">
                    {input("occupation", "อาชีพ", {
                      placeholder: "ระบุอาชีพ (ถ้ามี)",
                    })}
                    {select("education", "ระดับการศึกษา", {
                      none: "ไม่ได้ศึกษา",
                      primary: "ประถมศึกษา",
                      secondary: "มัธยมศึกษา",
                      vocational: "อาชีวศึกษา",
                      bachelor: "ปริญญาตรี",
                      postgraduate: "สูงกว่าปริญญาตรี",
                    })}
                    {select("maritalStatus", "สถานภาพสมรส", {
                      single: "โสด",
                      married: "สมรส",
                      divorced: "หย่าร้าง",
                      widowed: "หม้าย",
                    })}
                    {select("economicStatus", "ความเพียงพอของรายได้", {
                      enough: "เพียงพอ",
                      not_enough: "ไม่เพียงพอ",
                    })}
                  </div>
                </section>
                </FormPage>
                <FormPage id="health">
                <section className="panel">
                  <div className="patient-panel-title">
                    <span className="patient-icon">
                      <HeartPulse size={21} />
                    </span>
                    <div>
                      <h2>ข้อมูลสุขภาพเบื้องต้น</h2>
                      <p>กรอกเฉพาะข้อมูลที่คุณทราบ สามารถเว้นว่างได้</p>
                    </div>
                    <span className="patient-section-number">04</span>
                  </div>
                  <div className="panel-body">
                    <div className="field-grid">
                      {input("weight", "น้ำหนัก (กก.)", {
                        type: "number",
                        placeholder: "เช่น 60",
                        inputMode: "decimal",
                      })}
                      {input("height", "ส่วนสูง (ซม.)", {
                        type: "number",
                        placeholder: "เช่น 165",
                        inputMode: "decimal",
                      })}
                    </div>
                    <div className="patient-risk-profile">
                      <div className="patient-risk-profile-heading">
                        <HeartPulse size={18} />
                        <div>
                          <h3>พฤติกรรมการสูบบุหรี่</h3>
                          <p>
                            ข้อมูลนี้ใช้ประกอบการประเมินความเสี่ยงร่วมกับผลตรวจสุขภาพ
                          </p>
                        </div>
                      </div>
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
                              required: true,
                              min: "0",
                              step: "1",
                              inputMode: "numeric",
                              placeholder: "เช่น 12",
                              hint: "กรอก 0 หากเลิกสูบมายังไม่ครบ 1 เดือน",
                            },
                          )}
                      </div>
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
                                setForm((previous) => ({
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
                    {form.chronicDiseases.includes("มะเร็ง") && (
                      <div className="patient-cancer-details">
                        {input("cancerDetails", "ชนิดหรือตำแหน่งของมะเร็ง", {
                          required: true,
                          placeholder: "เช่น มะเร็งเต้านม",
                          hint: "ระบุตามข้อมูลการวินิจฉัยที่คุณทราบ",
                        })}
                      </div>
                    )}
                    <Field
                      label="โรคประจำตัวอื่น ๆ"
                      id="otherDisease"
                      hint="หากมีหลายโรค คั่นด้วยเครื่องหมายจุลภาค ( , )"
                    >
                      <input
                        className="input"
                        id="otherDisease"
                        value={otherDisease}
                        onChange={(event) => {
                          setOtherDisease(event.target.value);
                          setForm((previous) => ({
                            ...previous,
                            chronicDiseasesConfirmed: false,
                          }));
                        }}
                        placeholder="ระบุเพิ่มเติม (ถ้ามี)"
                      />
                    </Field>
                    <label className="patient-confirm-history">
                      <input
                        type="checkbox"
                        checked={form.chronicDiseasesConfirmed}
                        onChange={(event) =>
                          setForm((previous) => ({
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
                          เพื่อให้ระบบใช้ข้อมูลในการประเมินความเสี่ยง
                        </small>
                      </span>
                    </label>
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
                      <p>บุคคลที่สามารถติดต่อแทนคุณได้ (ถ้ามี)</p>
                    </div>
                    <span className="patient-section-number">05</span>
                  </div>
                  <div className="panel-body field-grid">
                    {input("emergencyContactName", "ชื่อ–นามสกุลผู้ติดต่อ", {
                      placeholder: "ชื่อบุคคลที่ติดต่อได้",
                    })}
                    {input("emergencyContactPhone", "เบอร์โทรผู้ติดต่อ", {
                      type: "tel",
                      placeholder: "08XXXXXXXX",
                    })}
                  </div>
                </section>
                </FormPage>
              </fieldset>
              <FormPage id="review">
              <section className="panel">
                <div className="patient-panel-title">
                  <span className="patient-icon"><ClipboardList size={21} /></span>
                  <div><h2>ตรวจสอบข้อมูลก่อนลงทะเบียน</h2><p>ย้อนกลับเพื่อแก้ไขข้อมูลแต่ละส่วนได้ก่อนบันทึก</p></div>
                </div>
                <div className="panel-body">
                  <dl className="form-pages-summary">
                    <div><dt>ชื่อ–นามสกุล</dt><dd>{`${form.firstName} ${form.lastName}`.trim() || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>เลขบัตรประชาชน</dt><dd>{citizenId}</dd></div>
                    <div><dt>เพศสำหรับการประเมินความเสี่ยง</dt><dd>{{ male: "ชาย", female: "หญิง" }[form.gender] || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>วันเกิด</dt><dd>{form.birthDate ? formatThaiDate(form.birthDate) : "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>เบอร์โทรศัพท์</dt><dd>{form.phone || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>อีเมล</dt><dd>{form.email || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>LINE ID</dt><dd>{form.lineId || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>จังหวัด</dt><dd>{form.province || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>ที่อยู่ อำเภอ / เขต ตำบล / แขวง</dt><dd>{[form.address, form.district, form.subdistrict].filter(Boolean).join(" · ") || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>อาชีพ</dt><dd>{form.occupation || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>ระดับการศึกษา</dt><dd>{{ none: "ไม่ได้ศึกษา", primary: "ประถมศึกษา", secondary: "มัธยมศึกษา", vocational: "อาชีวศึกษา", bachelor: "ปริญญาตรี", postgraduate: "สูงกว่าปริญญาตรี" }[form.education] || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>สถานภาพสมรส</dt><dd>{{ single: "โสด", married: "สมรส", divorced: "หย่าร้าง", widowed: "หม้าย" }[form.maritalStatus] || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>ความเพียงพอของรายได้</dt><dd>{{ enough: "เพียงพอ", not_enough: "ไม่เพียงพอ" }[form.economicStatus] || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>น้ำหนัก / ส่วนสูง</dt><dd>{form.weight ? `${form.weight} กก.` : "ไม่ได้ระบุน้ำหนัก"} · {form.height ? `${form.height} ซม.` : "ไม่ได้ระบุส่วนสูง"}</dd></div>
                    <div><dt>สถานะการสูบบุหรี่</dt><dd>{{ never: "ไม่เคยสูบบุหรี่", current: "ยังสูบบุหรี่อยู่", former: `เลิกสูบบุหรี่แล้ว ${form.smokingQuitMonths || "0"} เดือน` }[form.smokingStatus] || "ไม่ได้ระบุ"}</dd></div>
                    <div><dt>โรคประจำตัวที่เลือก</dt><dd>{[...form.chronicDiseases, otherDisease].filter(Boolean).join(", ") || (form.chronicDiseasesConfirmed ? "ยืนยันว่าไม่มีโรคประจำตัว" : "ยังไม่ได้ยืนยันข้อมูล")}</dd></div>
                    <div><dt>การตรวจสอบโรคประจำตัว</dt><dd>{form.chronicDiseasesConfirmed ? "ตรวจสอบข้อมูลแล้ว" : "ยังไม่ได้ยืนยันข้อมูล"}</dd></div>
                    {form.chronicDiseases.includes("มะเร็ง") && <div><dt>ชนิดหรือตำแหน่งของมะเร็ง</dt><dd>{form.cancerDetails || "ไม่ได้ระบุ"}</dd></div>}
                    <div><dt>ผู้ติดต่อฉุกเฉิน</dt><dd>{[form.emergencyContactName, form.emergencyContactPhone].filter(Boolean).join(" · ") || "ไม่ได้ระบุ"}</dd></div>
                  </dl>
                </div>
              </section>
              <Agreements actor="staff" value={agreements}
                onChange={(next) => { setAgreements(next); setAgreementError(""); }}
                error={agreementError} disabled={saving} idPrefix="register-agreement" />
              {error && <Notice tone="error">{error}</Notice>}
              <div className="patient-form-footer">
                <p>
                  <ShieldCheck size={17} /> ตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึก
                </p>
                <Button type="submit" loading={saving}>
                  บันทึกข้อมูลลงทะเบียน <ArrowRight size={18} />
                </Button>
              </div>
              </FormPage>
            </form>
            </FormPages>
          )}
          {!lookup && (
            <div className="patient-bottom-note">
              ลงทะเบียนแล้ว? ค้นหาข้อมูลด้านบน หรือ{" "}
              <Link to="/history">ดูประวัติสุขภาพ</Link>
            </div>
          )}
        </>
      )}
    </PublicLayout>
  );
}
