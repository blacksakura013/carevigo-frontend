import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import {
  changePatientPassword,
  getApiError,
  getStoredPatient,
  savePatientSession,
} from "../api/api";
import { Button, Field, Notice, PublicLayout } from "../components/ui";
import "../styles/portal.css";
import { notifyPasswordChanged } from "../utils/flowFeedback";

export default function PatientSettings() {
  const profile = getStoredPatient();
  const required = Boolean(profile?.requiresPasswordChange);
  const [values, setValues] = useState({
    current: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "ตั้งค่าบัญชี | Save Stroke";
  }, []);
  function update(event) {
    setValues((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
    setErrors((previous) => ({ ...previous, [event.target.name]: "" }));
    setSuccess(false);
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const invalid = {};
    if (!values.current)
      invalid.current = "กรอกรหัสผ่านปัจจุบันหรือรหัสเริ่มต้น";
    if (!/^\d{6}$/.test(values.password) && values.password.length < 8)
      invalid.password = "ใช้ตัวเลข 6 หลัก หรือรหัสผ่านอย่างน้อย 8 ตัวอักษร";
    if (new TextEncoder().encode(values.password).length > 72)
      invalid.password = "รหัสผ่านต้องมีความยาวไม่เกิน 72 ไบต์";
    if (values.password === values.current && values.password)
      invalid.password = "เลือกรหัสใหม่ที่ต่างจากรหัสเดิม";
    if (values.password !== values.confirm || !values.confirm)
      invalid.confirm = "กรอกรหัสผ่านใหม่ทั้งสองช่องให้ตรงกัน";
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      document
        .getElementById(`patient-settings-${Object.keys(invalid)[0]}`)
        ?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await changePatientPassword(
        values.current,
        values.password,
      );
      savePatientSession(response.data?.data);
      notifyPasswordChanged("patient");
      setValues({ current: "", password: "", confirm: "" });
      setSuccess(true);
      if (required) navigate("/", { replace: true });
    } catch (failure) {
      setError(
        failure.code === "SESSION_COOKIE_UNAVAILABLE"
          ? getApiError(failure)
          : failure.response?.status === 429
          ? "เปลี่ยนรหัสถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
          : !failure.response
            ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง"
            : "เปลี่ยนรหัสไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านปัจจุบันแล้วลองใหม่",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <PublicLayout
      active="settings"
      title={required ? "ตั้งรหัสผ่านของคุณก่อนเริ่มต้น" : "ตั้งค่าบัญชี"}
      subtitle={
        required
          ? "เปลี่ยนรหัสเริ่มต้นที่ได้รับจากเจ้าหน้าที่ เป็นรหัสที่คุณเลือกเอง"
          : "จัดการรหัสผ่านสำหรับบัญชีสุขภาพส่วนตัวของคุณ"
      }
      eyebrow="ACCOUNT SETTINGS"
    >
      <div className="portal-settings-grid">
        <section className="panel">
          <div className="panel-header">
            <div className="inline-actions">
              <span className="portal-icon">
                <KeyRound size={22} />
              </span>
              <div>
                <h2>{required ? "เปลี่ยนรหัสเริ่มต้น" : "เปลี่ยนรหัสผ่าน"}</h2>
                <p>
                  บัญชีเลขบัตรประชาชน •••••••••{profile?.citizenId?.slice(-4)}
                </p>
              </div>
            </div>
          </div>
          <form
            onSubmit={submit}
            noValidate
            className="panel-body portal-settings-form"
          >
            {required && (
              <Notice>
                เพื่อให้คุณเป็นผู้เดียวที่รู้รหัสผ่าน
                กรุณาเปลี่ยนรหัสเริ่มต้นก่อนเปิดดูหรือบันทึกข้อมูลสุขภาพ
              </Notice>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            {success && (
              <Notice tone="success">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</Notice>
            )}
            {[
              {
                name: "current",
                label: required ? "รหัสเริ่มต้น 6 หลัก" : "รหัสผ่านปัจจุบัน",
                autoComplete: "current-password",
              },
              {
                name: "password",
                label: "รหัสผ่านใหม่",
                autoComplete: "new-password",
                hint: "ตัวเลข 6 หลัก หรือรหัสผ่านอย่างน้อย 8 ตัวอักษร",
              },
              {
                name: "confirm",
                label: "ยืนยันรหัสผ่านใหม่",
                autoComplete: "new-password",
              },
            ].map((field) => (
              <Field
                key={field.name}
                id={`patient-settings-${field.name}`}
                label={field.label}
                required
                error={errors[field.name]}
                hint={field.hint}
              >
                <input
                  className="input"
                  id={`patient-settings-${field.name}`}
                  name={field.name}
                  type={visible ? "text" : "password"}
                  autoComplete={field.autoComplete}
                  value={values[field.name]}
                  onChange={update}
                  disabled={saving}
                />
              </Field>
            ))}
            <button
              type="button"
              className="portal-reveal"
              onClick={() => setVisible(!visible)}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}{" "}
              {visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            </button>
            <Button type="submit" loading={saving}>
              <LockKeyhole size={17} />
              {required ? "บันทึกและเริ่มใช้งาน" : "บันทึกรหัสผ่านใหม่"}
              <ArrowRight size={16} />
            </Button>
          </form>
        </section>
        <aside className="portal-settings-note">
          <ShieldCheck size={30} strokeWidth={1.3} />
          <h2>บัญชีนี้ สำหรับคุณ</h2>
          <p>
            เข้าสู่ระบบด้วยเลขบัตรประชาชนและรหัสที่คุณตั้งไว้
            เก็บรหัสผ่านเป็นส่วนตัวและออกจากระบบเมื่อใช้เครื่องร่วมกับผู้อื่น
          </p>
          <p>หากลืมรหัสผ่าน ติดต่อเจ้าหน้าที่เพื่อออกรหัสเริ่มต้นใหม่ให้คุณ</p>
        </aside>
      </div>
    </PublicLayout>
  );
}
