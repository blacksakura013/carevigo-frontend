import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import { getApiError, requestAdminPasswordReset } from "../api/api";
import { Button, Field, Notice } from "../components/ui";
import AdminRecoveryLayout from "../components/AdminRecoveryLayout";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef(null), resultRef = useRef(null);
  const active = useRef(true), busy = useRef(false), epoch = useRef(0);
  useEffect(() => {
    active.current = true;
    document.title = "ลืมรหัสผ่านเจ้าหน้าที่ | Save Stroke";
    return () => { active.current = false; epoch.current += 1; };
  }, []);
  useEffect(() => { if (sent) resultRef.current?.focus(); }, [sent]);

  async function submit(event) {
    event.preventDefault();
    if (busy.current) return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
      setFieldError("กรุณากรอกอีเมลให้ถูกต้อง");
      inputRef.current?.focus();
      return;
    }
    busy.current = true;
    const request = ++epoch.current;
    setSaving(true); setError(""); setFieldError("");
    try {
      await requestAdminPasswordReset(normalized, { isCurrent: () => active.current && epoch.current === request });
      if (!active.current || epoch.current !== request) return;
      setEmail(""); setSent(true);
    } catch (failure) {
      if (active.current && epoch.current === request)
        setError(getApiError(failure, "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง"));
    } finally {
      busy.current = false;
      if (active.current && epoch.current === request) setSaving(false);
    }
  }

  return <AdminRecoveryLayout title="ลืมรหัสผ่านเจ้าหน้าที่" description="กรอกอีเมลที่ใช้กับบัญชีเจ้าหน้าที่ เพื่อขอลิงก์ตั้งรหัสผ่านใหม่">
    {sent ? <div className="admin-recovery-result" ref={resultRef} tabIndex={-1}>
      <Notice tone="success">รับคำขอแล้ว หากอีเมลนี้ตรงกับบัญชีเจ้าหน้าที่ที่เปิดใช้งาน ระบบจะดำเนินการส่งลิงก์ตั้งรหัสผ่านใหม่ กรุณาตรวจสอบกล่องขาเข้าและสแปม</Notice>
      <p>หากเพิ่งส่งคำขอ ให้รออย่างน้อย 1 นาทีก่อนขอลิงก์ใหม่ และตรวจสอบกล่องสแปม หากยังไม่พบอีเมลให้ติดต่อผู้ดูแลระบบของหน่วยงาน</p>
      <Link className="btn btn-primary" to="/admin/login">กลับหน้าเข้าสู่ระบบ<ArrowRight size={20} /></Link>
      <Button variant="secondary" onClick={() => { setSent(false); setError(""); }}>ส่งคำขออีกครั้ง</Button>
    </div> : <form className="access-form" onSubmit={submit} noValidate aria-busy={saving}>
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="admin-forgot-email" label="อีเมลบัญชีเจ้าหน้าที่" required error={fieldError} hint="ใช้อีเมลเดียวกับที่เข้าสู่ระบบเจ้าหน้าที่">
        <input ref={inputRef} className="input" id="admin-forgot-email" type="email" autoComplete="email" inputMode="email"
          required maxLength={254} placeholder="name@example.com" value={email} disabled={saving}
          onChange={event => { setEmail(event.target.value); setFieldError(""); setError(""); }} />
      </Field>
      <Button type="submit" loading={saving}><Mail size={20} />ส่งลิงก์ตั้งรหัสผ่านใหม่</Button>
    </form>}
  </AdminRecoveryLayout>;
}
