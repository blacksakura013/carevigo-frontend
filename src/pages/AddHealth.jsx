import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  HeartPulse,
  History,
  IdCard,
  Plus,
  RotateCcw,
  Scale,
  Search,
  UserRound,
} from "lucide-react";
import {
  addHealth,
  getPatientProfile,
  getStoredPatient,
  hasPatientSession,
  searchUser,
} from "../api/api";
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
import { usePrivateDraft } from "../utils/privateDraft";
import { formatThaiDate } from "../utils/thaiDate";
import FormPages, { FormPage } from "../components/FormPages";

export const HEALTH_SECTIONS = [
  {
    type: "blood_pressure",
    title: "ความดันโลหิต",
    english: "BLOOD PRESSURE",
    icon: HeartPulse,
    color: "coral",
    description: "กรอกความดันตัวบนและตัวล่าง ชีพจรกรอกได้ถ้ามี",
    fields: [
      {
        name: "systolic",
        label: "ความดันตัวบน (SYS)",
        unit: "mmHg",
        placeholder: "เช่น 120",
      },
      {
        name: "diastolic",
        label: "ความดันตัวล่าง (DIA)",
        unit: "mmHg",
        placeholder: "เช่น 80",
      },
      {
        name: "pulse",
        label: "ชีพจร (Pulse)",
        unit: "ครั้ง/นาที",
        placeholder: "ไม่บังคับ",
      },
    ],
  },
  {
    type: "sugar",
    title: "น้ำตาลในเลือด",
    english: "BLOOD GLUCOSE",
    icon: Droplets,
    color: "blue",
    description: "กรอก FBS หรือ HbA1c อย่างน้อย 1 ค่า",
    fields: [
      {
        name: "fbs",
        label: "น้ำตาลขณะอดอาหาร (FBS)",
        unit: "mg/dL",
        placeholder: "เช่น 95",
      },
      {
        name: "hba1c",
        label: "น้ำตาลสะสม (HbA1c)",
        unit: "%",
        placeholder: "เช่น 5.5",
      },
    ],
  },
  {
    type: "cholesterol",
    title: "ไขมันในเลือด",
    english: "LIPID PROFILE",
    icon: Activity,
    color: "amber",
    description: "กรอกไขมันรวม และค่ารายการอื่นที่มีผลตรวจ",
    fields: [
      {
        name: "total",
        label: "ไขมันรวม (Total cholesterol)",
        unit: "mg/dL",
        placeholder: "เช่น 180",
      },
      {
        name: "ldl",
        label: "LDL cholesterol",
        unit: "mg/dL",
        placeholder: "ไม่บังคับ",
      },
      {
        name: "hdl",
        label: "HDL cholesterol",
        unit: "mg/dL",
        placeholder: "ไม่บังคับ",
      },
      {
        name: "triglyceride",
        label: "ไตรกลีเซอไรด์ (Triglyceride)",
        unit: "mg/dL",
        placeholder: "ไม่บังคับ",
      },
    ],
  },
  {
    type: "bmi",
    title: "น้ำหนักและส่วนสูง",
    english: "BODY MEASUREMENTS",
    icon: Scale,
    color: "teal",
    description: "กรอกทั้ง 2 ค่า เพื่อคำนวณดัชนีมวลกาย (BMI)",
    fields: [
      { name: "weight", label: "น้ำหนัก", unit: "กก.", placeholder: "เช่น 60" },
      {
        name: "height",
        label: "ส่วนสูง",
        unit: "ซม.",
        placeholder: "เช่น 165",
      },
    ],
  },
];
const SECTIONS = HEALTH_SECTIONS;
const HEALTH_FORM_STEPS = [
  ...SECTIONS.map(({ type, title }) => ({ id: type, title, description: "กรอกเฉพาะผลตรวจที่มี หากไม่มีข้อมูลให้กดถัดไป" })),
  { id: "review", title: "ตรวจสอบและบันทึก", description: "ตรวจสอบค่าที่กรอกและยืนยันก่อนบันทึก" },
];
export const emptyHealthValues = () =>
  Object.fromEntries(
    SECTIONS.map(({ type, fields }) => [
      type,
      Object.fromEntries(fields.map(({ name }) => [name, ""])),
    ]),
  );
const emptyValues = emptyHealthValues;
const hasValues = (section) =>
  Object.values(section).some((value) => value !== "");
const requiredFor = (type) =>
  type === "blood_pressure"
    ? ["systolic", "diastolic"]
    : type === "bmi"
      ? ["weight", "height"]
      : type === "cholesterol"
        ? ["total"]
        : [];

export function healthMeasurementErrors(
  values,
  types = SECTIONS.map(({ type }) => type),
) {
  const errors = {};
  SECTIONS.filter(
    ({ type }) => types.includes(type) && hasValues(values[type]),
  ).forEach(({ type, fields }) => {
    fields.forEach(({ name }) => {
      const value = values[type][name];
      if (
        value !== "" &&
        (!Number.isFinite(Number(value)) || Number(value) <= 0)
      )
        errors[`${type}-${name}`] = "กรุณากรอกตัวเลขมากกว่า 0";
    });
    requiredFor(type).forEach((name) => {
      if (values[type][name] === "")
        errors[`${type}-${name}`] = "กรุณากรอกค่านี้ เพื่อบันทึกข้อมูลส่วนนี้";
    });
  });
  return errors;
}

export function healthRecordPayloads(values) {
  return SECTIONS.filter(({ type }) => hasValues(values[type])).map(
    ({ type }) => {
      const value = Object.fromEntries(
        Object.entries(values[type])
          .filter(([, amount]) => amount !== "")
          .map(([name, amount]) => [name, Number(amount)]),
      );
      return {
        type,
        value,
        ...(type === "bmi"
          ? { weight: value.weight, height: value.height }
          : {}),
      };
    },
  );
}

export function HealthEntrySummary({ values, outcomes = {} }) {
  const selected = SECTIONS.filter(({ type }) => hasValues(values[type]));
  return <section className="panel" aria-label="ตรวจสอบผลตรวจที่กรอกครั้งนี้">
    <div className="panel-header"><h2>ผลตรวจที่กรอกครั้งนี้</h2></div>
    <div className="panel-body">
      {!selected.length && <p>ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ สามารถข้ามผลตรวจได้ทุกหมวด</p>}
      {selected.map(({ type, title, fields }) => <section className="form-review-section" key={type}>
        <h3>{title}</h3>
        <dl className="form-review-values">
          {fields.filter(({ name }) => values[type][name] !== "").map(({ name, label, unit }) => <div key={name}>
            <dt>{label}</dt><dd>{values[type][name]} {unit}</dd>
          </div>)}
        </dl>
        {outcomes[type]?.status === "success" && <p className="patient-saved-section">บันทึกส่วนนี้แล้ว จะไม่ส่งซ้ำ</p>}
        {outcomes[type]?.status === "error" && <p className="patient-section-error">{outcomes[type].message}</p>}
      </section>)}
    </div>
  </section>;
}

export function HealthMeasurementFields({
  section,
  values,
  onChange,
  errors = {},
  disabled = false,
  idPrefix = "health",
}) {
  const { type, fields } = section;
  return (
    <fieldset className="patient-fieldset" disabled={disabled}>
      <div className="field-grid">
        {fields.map(({ name, label, unit, placeholder }) => (
          <Field
            key={name}
            label={label}
            id={`${idPrefix}-${type}-${name}`}
            required={hasValues(values) && requiredFor(type).includes(name)}
            error={errors[`${type}-${name}`]}
          >
            <div className="patient-unit-input">
              <input
                className="input"
                id={`${idPrefix}-${type}-${name}`}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                required={hasValues(values) && requiredFor(type).includes(name)}
                value={values[name]}
                onChange={(event) => onChange(name, event.target.value)}
                placeholder={placeholder}
                aria-invalid={Boolean(errors[`${type}-${name}`])}
              />
              <span>{unit}</span>
            </div>
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

function saveError(error) {
  if (error?.response?.status === 429)
    return "บันทึกถี่เกินกำหนด กรุณารออย่างน้อย 1 นาทีแล้วลองอีกครั้ง";
  if (!error?.response)
    return "การเชื่อมต่อขัดข้อง ยังยืนยันผลการบันทึกไม่ได้ กรุณาตรวจสอบประวัติก่อนลองอีกครั้ง";
  return "บันทึกไม่สำเร็จ ข้อมูลยังอยู่ กรุณาลองบันทึกส่วนนี้อีกครั้ง";
}

function draftOutcomes(outcomes = {}, restoring = false) {
  return Object.fromEntries(Object.entries(outcomes).map(([type, outcome]) => [type,
    outcome.status === "success"
      ? { status: "success", data: { bmi: outcome.data?.bmi } }
      : outcome.status === "pending" && restoring
        ? { status: "error", uncertain: true, message: "การส่งข้อมูลก่อนหน้าถูกขัดจังหวะ ยังยืนยันผลไม่ได้ กรุณาตรวจสอบประวัติก่อนบันทึกซ้ำ" }
        : { status: outcome.status, message: outcome.message, uncertain: outcome.uncertain === true },
  ]));
}

const RISK_FIELDS = {
  age: "อายุ",
  birthDate: "วันเกิด",
  gender: "เพศ",
  sex: "เพศ",
  smokingStatus: "สถานะการสูบบุหรี่",
  smokingQuitMonths: "ระยะเวลาหลังเลิกสูบบุหรี่",
  chronicDiseasesConfirmed: "การยืนยันประวัติโรคประจำตัว",
  systolic: "ความดันตัวบน",
  totalCholesterol: "คอเลสเตอรอลรวม",
  total: "คอเลสเตอรอลรวม",
};
const riskDate = (value) => formatThaiDate(value, { empty: null });
export function ThaiCvRiskCard({ risk, compact = false }) {
  const calculated =
    risk?.status === "calculated" &&
    Number.isFinite(Number(risk.score)) &&
    risk.score != null;
  const level =
    calculated && ["low", "moderate", "high"].includes(risk.level)
      ? risk.level
      : "unknown";
  const percent = calculated
    ? risk.displayScore ||
      (Number(risk.score) > 30
        ? ">30%"
        : `${Number(risk.score).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`)
    : "—";
  const bloodPressureDate = riskDate(risk?.inputs?.bloodPressureRecordedAt);
  const cholesterolDate = riskDate(risk?.inputs?.cholesterolRecordedAt);
  return (
    <section
      className={`panel patient-cv-risk patient-cv-risk-${level}${compact ? " patient-cv-risk-compact" : ""}`}
      aria-label="ความเสี่ยงโรคหัวใจและหลอดเลือด"
    >
      <div className="patient-cv-risk-content">
        <span className="patient-icon">
          <HeartPulse size={24} />
        </span>
        <div>
          <span className="eyebrow">THAI CV RISK SCORE</span>
          <h2>ความเสี่ยงโรคหัวใจและหลอดเลือดใน 10 ปี</h2>
          <p>
            {calculated
              ? risk.label
              : risk?.reason ||
                risk?.label ||
                "เพิ่มข้อมูลส่วนตัวและผลตรวจ เพื่อให้ระบบประเมินความเสี่ยงได้"}
          </p>
          {!calculated && risk?.missing?.length > 0 && (
            <p className="patient-cv-missing">
              ข้อมูลที่ยังขาด:{" "}
              {risk.missing
                .map((name) => RISK_FIELDS[name] || name)
                .join(" · ")}
            </p>
          )}
          {risk?.inputs?.profileSource === "submitted-profile" && (
            <p className="patient-cv-missing">
              ประเมินจากข้อมูลที่ส่งในรายการนี้
            </p>
          )}
          {calculated && (bloodPressureDate || cholesterolDate) && (
            <p className="patient-cv-missing">
              ใช้ผลตรวจ{bloodPressureDate ? `ความดัน ${bloodPressureDate}` : ""}
              {bloodPressureDate && cholesterolDate ? " · " : ""}
              {cholesterolDate ? `ไขมัน ${cholesterolDate}` : ""}
            </p>
          )}
        </div>
        <div className="patient-cv-score">
          <strong>{percent}</strong>
          <span>
            {calculated
              ? "ผลประเมินจากระบบ"
              : risk?.status === "ineligible"
                ? "อยู่นอกเงื่อนไขการประเมิน"
                : "ยังประเมินไม่ได้"}
          </span>
        </div>
      </div>
      <div className="patient-cv-legend">
        <span className="patient-cv-level-low">
          <i /> ต่ำ &lt;10%
        </span>
        <span className="patient-cv-level-moderate">
          <i /> ปานกลาง 10–20%
        </span>
        <span className="patient-cv-level-high">
          <i /> สูง &gt;20%
        </span>
        <span className="patient-cv-model">
          Thai CV · แบบใช้คอเลสเตอรอลรวม
          {risk?.source?.startsWith("https://www.rama.mahidol.ac.th/") && (
            <a href={risk.source} target="_blank" rel="noopener noreferrer">
              ที่มาของแบบประเมิน <ArrowRight size={12} />
            </a>
          )}
        </span>
      </div>
    </section>
  );
}

export default function AddHealth() {
  const { citizenId: routeCitizenId } = useParams();
  const patientMode = hasPatientSession();
  const citizenId = patientMode
    ? getStoredPatient()?.citizenId
    : routeCitizenId;
  const navigate = useNavigate();
  const validId = /^\d{13}$/.test(citizenId || "");
  const draftKey = `health:${citizenId || "lookup"}`;
  const { read: readDraft, write: writeDraft, clear: clearDraft } = usePrivateDraft(patientMode ? "patient" : "admin", draftKey);
  const [draftContext, setDraftContext] = useState(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [profile, setProfile] = useState(null);
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [agreements, setAgreements] = useState({});
  const [agreementError, setAgreementError] = useState("");
  const [outcomes, setOutcomes] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formStep, setFormStep] = useState(SECTIONS[0].type);
  const [assessment, setAssessment] = useState(null);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const outcomeRef = useRef(null);
  const savingRef = useRef(false);
  const saveVersion = useRef(0);
  const pagesRef = useRef(null);

  useEffect(() => {
    document.title = "บันทึกสุขภาพ | Save Stroke";
  }, []);
  useEffect(() => {
    saveVersion.current += 1;
    savingRef.current = false;
    setSaving(false);
    const draft = readDraft();
    setValues(draft?.values || emptyValues());
    setFormStep(draft?.step || SECTIONS[0].type);
    setDraftContext(draftKey);
    setAgreements({});
    setAgreementError("");
    setOutcomes(draftOutcomes(draft?.outcomes, true));
    setErrors({});
    setFormError("");
    setProfile(null);
    setProfileError("");
    setAssessment(null);
    pagesRef.current?.reset();
    if (!validId) return;
    let active = true;
    setProfilePending(true);
    (patientMode ? getPatientProfile() : searchUser(citizenId))
      .then((response) => {
        if (active) {
          const person =
            response.data?.data?.patient || response.data?.data || null;
          setProfile(person);
          setAssessment(
            response.data?.data?.thaiCvRisk || person?.thaiCvRisk || null,
          );
        }
      })
      .catch(() => {
        if (active)
          setProfileError(
            "โหลดข้อมูลผู้รับบริการไม่สำเร็จ กรุณาลองอีกครั้งก่อนบันทึก",
          );
      })
      .finally(() => {
        if (active) setProfilePending(false);
      });
    return () => {
      active = false;
    };
  }, [citizenId, validId, profileAttempt, patientMode, readDraft, draftKey]);
  useEffect(() => {
    if (draftContext !== draftKey || !validId) return;
    if (Object.values(values).some(hasValues) || Object.keys(outcomes).length || formStep !== SECTIONS[0].type)
      writeDraft({ values, outcomes: draftOutcomes(outcomes), step: formStep });
    else clearDraft();
  }, [values, outcomes, formStep, draftContext, draftKey, validId, writeDraft, clearDraft]);

  const update = (type, name, value) => {
    setValues((previous) => ({
      ...previous,
      [type]: { ...previous[type], [name]: value },
    }));
    setErrors((previous) => ({ ...previous, [`${type}-${name}`]: "" }));
    setFormError("");
    setOutcomes((previous) => {
      if (previous[type]?.status !== "error") return previous;
      const next = { ...previous };
      delete next[type];
      return next;
    });
  };
  const selected = SECTIONS.filter(({ type }) => hasValues(values[type]));
  const successes = Object.values(outcomes).filter(
    ({ status }) => status === "success",
  ).length;
  const failures = Object.values(outcomes).filter(
    ({ status }) => status === "error",
  ).length;
  const allSaved = successes > 0 && successes === selected.length;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (
      savingRef.current ||
      !validId ||
      profilePending ||
      profileError ||
      !profile
    )
      return;
    const toSave = selected.filter(
      ({ type }) => outcomes[type]?.status !== "success",
    );
    if (!toSave.length) {
      if (!selected.length) {
        clearDraft();
        navigate(patientMode ? "/" : "/admin");
      }
      return;
    }
    const nextErrors = healthMeasurementErrors(
      values,
      toSave.map(({ type }) => type),
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFormError(
        "กรุณาตรวจสอบช่องที่ระบุด้านล่าง ส่วนที่เว้นว่างทั้งหมดจะไม่ถูกบันทึก",
      );
      pagesRef.current?.focusField(`health-${Object.keys(nextErrors)[0]}`);
      return;
    }
    if (!agreementsComplete(agreements, { staff: !patientMode })) {
      setAgreementError("กรุณาอ่านเงื่อนไขและยืนยันข้อมูลสำหรับการบันทึกครั้งนี้ให้ครบ");
      pagesRef.current?.focusField("health-agreement-terms");
      return;
    }
    const requestVersion = saveVersion.current;
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    setOutcomes((previous) => ({
      ...previous,
      ...Object.fromEntries(
        toSave.map(({ type }) => [type, { status: "pending" }]),
      ),
    }));
    const results = await Promise.allSettled(
      toSave.map(async ({ type }) => {
        const value = Object.fromEntries(
          Object.entries(values[type])
            .filter(([, amount]) => amount !== "")
            .map(([name, amount]) => [name, Number(amount)]),
        );
        const response = await addHealth({
          citizenId,
          agreements: agreementPayload(agreements, { staff: !patientMode }),
          type,
          value,
          ...(type === "bmi"
            ? { weight: value.weight, height: value.height }
            : {}),
        });
        return { data: response.data?.data || {}, value };
      }),
    );
    if (saveVersion.current !== requestVersion) return;
    const returnedRisks = results
      .filter(
        (result) =>
          result.status === "fulfilled" && result.value.data.thaiCvRisk,
      )
      .map((result) => result.value.data.thaiCvRisk);
    if (returnedRisks.length)
      setAssessment(
        returnedRisks.sort(
          (a, b) =>
            new Date(b.calculatedAt || 0) - new Date(a.calculatedAt || 0),
        )[0],
      );
    setOutcomes((previous) => {
      const next = { ...previous };
      results.forEach((result, index) => {
        next[toSave[index].type] =
          result.status === "fulfilled"
            ? { status: "success", ...result.value }
            : {
                status: "error",
                message: saveError(result.reason),
                uncertain: !result.reason?.response,
              };
      });
      return next;
    });
    try {
      const fresh = await (patientMode
        ? getPatientProfile()
        : searchUser(citizenId));
      if (saveVersion.current === requestVersion) {
        const person = fresh.data?.data?.patient || fresh.data?.data;
        setProfile(person);
        const freshRisk = fresh.data?.data?.thaiCvRisk || person?.thaiCvRisk;
        if (freshRisk) setAssessment(freshRisk);
      }
    } catch {
      /* Saved records remain successful if refreshing the assessment fails. */
    }
    if (saveVersion.current !== requestVersion) return;
    savingRef.current = false;
    setSaving(false);
    setTimeout(() => outcomeRef.current?.focus(), 0);
  };
  const lookup = (event) => {
    event.preventDefault();
    if (!/^\d{13}$/.test(lookupId)) {
      setLookupError("กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก");
      return;
    }
    navigate(`/health/${lookupId}`);
  };
  const newEntry = () => {
    clearDraft();
    setValues(emptyValues());
    setAgreements({});
    setAgreementError("");
    setOutcomes({});
    setErrors({});
    setFormError("");
    setFormStep(SECTIONS[0].type);
    pagesRef.current?.reset();
    setTimeout(
      () => pagesRef.current?.focusField("health-blood_pressure-systolic"),
      0,
    );
  };

  return (
    <PublicLayout active="health">
      <PageHeading
        eyebrow="HEALTH CHECK-IN"
        title="วันนี้ สุขภาพคุณเป็นอย่างไร"
        description="บันทึกผลตรวจตามค่าที่วัดได้ เลือกกรอกเฉพาะส่วนที่มีข้อมูล"
      >
        <Link
          className="btn btn-secondary"
          to={validId ? `/history/${citizenId}` : "/history"}
        >
          <History size={17} /> ประวัติสุขภาพ
        </Link>
      </PageHeading>
      {!validId ? (
        patientMode ? (
          <Notice tone="error">
            ไม่พบข้อมูลบัญชีผู้รับบริการ กรุณาเข้าสู่ระบบใหม่
          </Notice>
        ) : (
          <section className="panel patient-health-lookup">
            <div className="patient-panel-title">
              <span className="patient-icon">
                <IdCard size={24} />
              </span>
              <div>
                <h2>เลือกผู้รับบริการ</h2>
                <p>ค้นหาข้อมูลก่อนเริ่มบันทึกสุขภาพ</p>
              </div>
            </div>
            <form className="panel-body" onSubmit={lookup} noValidate>
              <Field
                label="เลขบัตรประชาชน"
                id="health-citizenId"
                required
                error={lookupError}
              >
                <div className="patient-lookup-row">
                  <input
                    className="input"
                    id="health-citizenId"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={13}
                    required
                    value={lookupId}
                    onChange={(event) => {
                      setLookupId(
                        event.target.value.replace(/\D/g, "").slice(0, 13),
                      );
                      setLookupError("");
                    }}
                    placeholder="เลขบัตรประชาชน 13 หลัก"
                    aria-invalid={Boolean(lookupError)}
                  />
                  <Button type="submit">
                    <Search size={17} /> ค้นหาข้อมูล
                  </Button>
                </div>
              </Field>
            </form>
          </section>
        )
      ) : (
        <>
          <div className="patient-person-strip">
            <span className="patient-existing-avatar">
              <UserRound size={23} />
            </span>
            <div>
              <span className="muted">ผู้รับบริการ</span>
              <strong>
                {profilePending
                  ? "กำลังโหลดข้อมูล…"
                  : profile
                    ? `${profile.firstName || "ผู้รับบริการ"} ${profile.lastName || ""}`
                    : "ยังไม่พบข้อมูลผู้รับบริการ"}
              </strong>
            </div>
            <div className="patient-person-id">
              <span className="muted">เลขบัตรประชาชน</span>
              <strong>• • • • • • • • • {citizenId.slice(-4)}</strong>
            </div>
            {!patientMode && (
              <Link to="/health" className="btn btn-ghost">
                เปลี่ยนผู้รับบริการ
              </Link>
            )}
          </div>
          {profileError && (
            <Notice tone="error">
              {profileError}{" "}
              <Button
                variant="ghost"
                onClick={() => setProfileAttempt((previous) => previous + 1)}
              >
                ลองอีกครั้ง
              </Button>
            </Notice>
          )}
          {!profilePending && !profileError && !profile && (
            <Notice tone="info">
              ยังไม่พบข้อมูลผู้รับบริการ กรุณา
              <Link to={patientMode ? "/profile" : "/register"}>
                ตรวจสอบข้อมูลก่อนบันทึกสุขภาพ
              </Link>
            </Notice>
          )}
          {!profilePending && profile && (
            <>
              <ThaiCvRiskCard risk={assessment} />
              {patientMode && assessment?.status !== "calculated" && (
                <p className="patient-complete-profile">
                  เพิ่มข้อมูลที่ยังขาดได้ที่{" "}
                  <Link to="/profile">
                    ข้อมูลส่วนตัว <ArrowRight size={14} />
                  </Link>
                </p>
              )}
            </>
          )}
          {successes > 0 && (
            <div ref={outcomeRef} tabIndex={-1}>
              <Notice tone={failures ? "warning" : "success"}>
                {allSaved
                  ? `บันทึกข้อมูลเรียบร้อยแล้ว ${successes} ส่วน`
                  : `บันทึกแล้ว ${successes} ส่วน${failures ? ` · ยังไม่สำเร็จ ${failures} ส่วน` : ""}`}{" "}
                ส่วนที่บันทึกแล้วจะไม่ถูกส่งซ้ำ
              </Notice>
            </div>
          )}
          {!successes && failures > 0 && (
            <div ref={outcomeRef} tabIndex={-1}>
              <Notice tone="error">
                ยังบันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่
                กรุณาดูรายละเอียดในแต่ละส่วน
              </Notice>
            </div>
          )}
          {!profilePending && !profileError && profile && <FormPages ref={pagesRef} key={citizenId} steps={HEALTH_FORM_STEPS} busy={saving} initialStep={formStep} onStepChange={setFormStep}>
          <form onSubmit={handleSubmit} noValidate aria-busy={saving}>
            <div className="patient-health-intro">
              <div>
                <span className="eyebrow">YOUR MEASUREMENTS</span>
                <h2>บันทึกข้อมูลสุขภาพ</h2>
              </div>
              <span className="badge badge-neutral">
                {selected.length} / 4 ส่วนที่กรอก
              </span>
            </div>
            {formError && <Notice tone="error">{formError}</Notice>}
              {SECTIONS.map(
                (
                  {
                    type,
                    title,
                    english,
                    icon: Icon,
                    color,
                    description,
                    fields,
                  },
                  index,
                ) => {
                  const outcome = outcomes[type];
                  const locked =
                    saving ||
                    outcome?.status === "success" ||
                    !profile ||
                    profilePending ||
                    Boolean(profileError);
                  return (
                    <FormPage id={type} key={type}>
                    <section
                      className={`panel patient-health-card ${outcome?.status === "success" ? "patient-health-card-saved" : ""}`}
                      data-motion-enter="panel"
                      key={type}
                    >
                      <div className="patient-panel-title">
                        <span className={`patient-icon patient-icon-${color}`}>
                          <Icon size={22} />
                        </span>
                        <div>
                          <span className="patient-card-eyebrow">
                            {english}
                          </span>
                          <h2>{title}</h2>
                        </div>
                        <span className="patient-section-number">
                          0{index + 1}
                        </span>
                      </div>
                      <div className="panel-body">
                        <p className="patient-card-description">
                          {description}
                        </p>
                        <HealthMeasurementFields
                          section={{ type, fields }}
                          values={values[type]}
                          onChange={(name, value) => update(type, name, value)}
                          errors={errors}
                          disabled={locked}
                        />
                        {outcome?.status === "success" && (
                          <div className="patient-saved-section">
                            <CheckCircle2 size={17} />
                            <span>บันทึกเรียบร้อยแล้ว</span>
                          </div>
                        )}
                        {outcome?.status === "error" && (
                          <div className="patient-section-error" role="alert">
                            {outcome.message}
                            {outcome.uncertain && (
                              <Link to={`/history/${citizenId}`}>
                                ตรวจสอบประวัติสุขภาพ <ArrowRight size={14} />
                              </Link>
                            )}
                          </div>
                        )}
                        {outcome?.status === "success" &&
                          outcome.data.bmi != null && (
                            <div className="patient-bmi-result">
                              <span>ดัชนีมวลกาย (BMI) จากระบบ</span>
                              <strong>
                                {outcome.data.bmi}
                                <small> กก./ม.²</small>
                              </strong>
                            </div>
                          )}
                      </div>
                    </section>
                    </FormPage>
                  );
                },
              )}
            <FormPage id="review">
            <HealthEntrySummary values={values} outcomes={outcomes} />
            {selected.length > 0 && <Agreements actor={patientMode ? "subject" : "staff"} value={agreements}
              onChange={(next) => { setAgreements(next); setAgreementError(""); }}
              error={agreementError} disabled={saving || allSaved} idPrefix="health-agreement" />}
            <div className="patient-save-bar">
              <div className="patient-save-copy">
                <ClipboardCheck size={22} />
                <div>
                  <strong>
                    {allSaved
                      ? "บันทึกครั้งนี้เรียบร้อยแล้ว"
                      : selected.length ? "พร้อมบันทึกข้อมูลสุขภาพ" : "ไม่ได้ระบุผลตรวจในครั้งนี้"}
                  </strong>
                  <p>
                    {allSaved
                      ? "ดูประวัติย้อนหลัง หรือเริ่มบันทึกครั้งใหม่ได้เลย"
                      : selected.length ? "บันทึกเฉพาะส่วนที่กรอก ไม่จำเป็นต้องครบทุกส่วน" : "ข้ามได้โดยไม่มีการเพิ่มบันทึกสุขภาพ"}
                  </p>
                </div>
              </div>
              <div className="inline-actions">
                {allSaved ? (
                  <>
                    <Link
                      className="btn btn-secondary"
                      to={`/history/${citizenId}`}
                    >
                      <History size={17} /> ดูประวัติ
                    </Link>
                    <Button type="button" onClick={newEntry} disabled={saving}>
                      <Plus size={17} /> บันทึกครั้งใหม่
                    </Button>
                  </>
                ) : (
                  <Button
                    type="submit"
                    loading={saving}
                    disabled={
                      profilePending || Boolean(profileError) || !profile
                    }
                  >
                    {failures ? (
                      <RotateCcw size={18} />
                    ) : (
                      <ClipboardCheck size={18} />
                    )}
                    {failures
                      ? "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง"
                      : selected.length ? "บันทึกข้อมูลสุขภาพ" : "ข้ามการบันทึกครั้งนี้"}
                  </Button>
                )}
              </div>
            </div>
            </FormPage>
          </form>
          </FormPages>}
        </>
      )}
    </PublicLayout>
  );
}
