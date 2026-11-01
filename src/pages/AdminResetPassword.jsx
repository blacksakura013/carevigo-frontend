import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { getApiError, resetAdminPassword, validateAdminPasswordReset } from "../api/api";
import { Button, Field, Notice } from "../components/ui";
import AdminRecoveryLayout from "../components/AdminRecoveryLayout";

export default function AdminResetPassword() {
  const location = useLocation(), navigate = useNavigate();
  const token = useRef(null);
  if (token.current === null) token.current = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const active = useRef(true), busy = useRef(false), epoch = useRef(0), completed = useRef(false);
  const mountedLink = useRef(false), incomingHash = useRef(null);
  const passwordRef = useRef(null), confirmRef = useRef(null), resultRef = useRef(null);
  useLayoutEffect(() => {
    const initial = !mountedLink.current;
    mountedLink.current = true;
    if (!location.hash) { incomingHash.current = null; return; }
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("token")) return;
    if (incomingHash.current !== location.hash) {
      incomingHash.current = location.hash;
      if (!initial) {
        epoch.current += 1; busy.current = false; completed.current = false;
        token.current = params.get("token") || "";
        setPassword(""); setConfirm(""); setVisible(false); setErrors({}); setError(""); setSaving(false);
        setStatus("checking"); setAttempt(value => value + 1);
      }
    }
  }, [location.hash]);
  useEffect(() => {
    if (new URLSearchParams(location.hash.slice(1)).has("token"))
      navigate({ pathname: location.pathname, search: location.search, hash: "" }, { replace: true, state: location.state });
  }, [location.hash, location.pathname, location.search, location.state, navigate]);
  useEffect(() => {
    active.current = true;
    document.title = "ตั้งรหัสผ่านเจ้าหน้าที่ใหม่ | Save Stroke";
    return () => { active.current = false; epoch.current += 1; };
  }, []);
  useEffect(() => {
    if (completed.current) return undefined;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token.current)) { token.current = ""; setStatus("invalid"); return undefined; }
    let current = true;
    const request = epoch.current;
    setStatus("checking"); setError("");
    validateAdminPasswordReset(token.current, { isCurrent: () => current && active.current && epoch.current === request }).then(response => {
      if (!current || !active.current || epoch.current !== request) return;
      if (response.data?.data?.valid === true) setStatus("ready");
      else { token.current = ""; setStatus("invalid"); }
    }).catch(failure => {
      if (!current || !active.current || epoch.current !== request) return;
      if (failure.response?.data?.code === "RESET_LINK_INVALID") { token.current = ""; setStatus("invalid"); }
      else { setStatus("error"); setError(getApiError(failure, "ตรวจสอบลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง")); }
    });
    return () => { current = false; };
  }, [attempt]);
  useEffect(() => { if (status === "success" || status === "invalid") resultRef.current?.focus(); }, [status]);

  async function submit(event) {
    event.preventDefault();
    if (busy.current || status !== "ready") return;
    const invalid = {};
    if (password.length < 8) invalid.password = "ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร";
    else if (new TextEncoder().encode(password).length > 72) invalid.password = "รหัสผ่านยาวเกินไป กรุณาลดจำนวนตัวอักษร";
    if (!confirm || password !== confirm) invalid.confirm = "กรอกรหัสผ่านใหม่ทั้งสองช่องให้ตรงกัน";
    setErrors(invalid);
    if (Object.keys(invalid).length) { (invalid.password ? passwordRef : confirmRef).current?.focus(); return; }
    busy.current = true;
    const request = ++epoch.current;
    setSaving(true); setError("");
    try {
      await resetAdminPassword(token.current, password, confirm, { isCurrent: () => active.current && epoch.current === request });
      if (!active.current || epoch.current !== request) return;
      completed.current = true; token.current = "";
      setPassword(""); setConfirm(""); setVisible(false); setStatus("success");
    } catch (failure) {
      if (!active.current || epoch.current !== request) return;
      if (failure.response?.data?.code === "RESET_LINK_INVALID") {
        token.current = ""; setPassword(""); setConfirm(""); setStatus("invalid");
      } else setError(getApiError(failure, "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง"));
    } finally {
      if (epoch.current === request) {
        busy.current = false;
        if (active.current) setSaving(false);
      }
    }
  }

  return <AdminRecoveryLayout title="ตั้งรหัสผ่านเจ้าหน้าที่ใหม่" description="เลือกรหัสผ่านใหม่สำหรับบัญชีเจ้าหน้าที่ของคุณ">
    {status === "checking" && <Notice>กำลังตรวจสอบลิงก์ตั้งรหัสผ่านใหม่…</Notice>}
    {status === "error" && <div className="admin-recovery-result"><Notice tone="error">{error}</Notice>
      <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>ลองตรวจสอบลิงก์อีกครั้ง</Button></div>}
    {status === "invalid" && <div className="admin-recovery-result" ref={resultRef} tabIndex={-1}>
      <Notice tone="warning">ลิงก์นี้ใช้ไม่ได้ หมดอายุ หรือถูกใช้แล้ว กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง</Notice>
      <Link className="btn btn-primary" to="/admin/forgot-password">ขอลิงก์ใหม่<ArrowRight size={20} /></Link>
    </div>}
    {status === "success" && <div className="admin-recovery-result" ref={resultRef} tabIndex={-1}>
      <Notice tone="success">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ</Notice>
      <Link className="btn btn-primary" to="/admin/login">เข้าสู่ระบบเจ้าหน้าที่<ArrowRight size={20} /></Link>
    </div>}
    {status === "ready" && <form className="access-form" noValidate onSubmit={submit} aria-busy={saving}>
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="admin-reset-password" label="รหัสผ่านใหม่" required error={errors.password} hint="อย่างน้อย 8 ตัวอักษร">
        <input ref={passwordRef} className="input" id="admin-reset-password" type={visible ? "text" : "password"} autoComplete="new-password"
          required value={password} disabled={saving} onChange={event => { setPassword(event.target.value); setErrors(previous => ({ ...previous, password: "" })); setError(""); }} />
      </Field>
      <Field id="admin-reset-confirm" label="ยืนยันรหัสผ่านใหม่" required error={errors.confirm}>
        <input ref={confirmRef} className="input" id="admin-reset-confirm" type={visible ? "text" : "password"} autoComplete="new-password"
          required value={confirm} disabled={saving} onChange={event => { setConfirm(event.target.value); setErrors(previous => ({ ...previous, confirm: "" })); setError(""); }} />
      </Field>
      <button className="admin-recovery-reveal" type="button" disabled={saving} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}{visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      </button>
      <Button type="submit" loading={saving}><KeyRound size={20} />บันทึกรหัสผ่านใหม่</Button>
    </form>}
  </AdminRecoveryLayout>;
}
