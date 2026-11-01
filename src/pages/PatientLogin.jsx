import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  HeartPulse,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  getApiError,
  getStoredPatient,
  hasAdminSession,
  hasPatientSession,
  loginPatient,
  savePatientSession,
} from "../api/api";
import { Brand, Button, Field, Notice } from "../components/ui";
import "../styles/access.css";
import { currentBuddhistYear } from "../utils/thaiDate";
import LegalLinks from "../components/LegalLinks";
import { getLandingDestination, getPatientDestination } from "../utils/navigation";

export default function PatientLogin() {
  const [citizenId, setCitizenId] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [idError, setIdError] = useState("");
  const attempt = useRef(0);
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    document.title = "เข้าสู่บัญชีสุขภาพของคุณ | Save Stroke";
    return () => {
      attempt.current += 1;
    };
  }, [navigate]);
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    if (!/^\d{13}$/.test(citizenId)) {
      setIdError("กรอกเลขบัตรประชาชนให้ครบ 13 หลัก");
      document.getElementById("patient-citizenId")?.focus();
      return;
    }
    if (!password) {
      setError("กรุณากรอกรหัสผ่านที่ได้รับจากเจ้าหน้าที่");
      document.getElementById("patient-password")?.focus();
      return;
    }
    const request = ++attempt.current;
    setLoading(true);
    setError("");
    setIdError("");
    try {
      const response = await loginPatient(citizenId, password, { isCurrent: () => request === attempt.current });
      if (request !== attempt.current) return;
      const profile = savePatientSession(response.data?.data);
      setPassword("");
      navigate(hasAdminSession() ? "/admin" : getPatientDestination(location.state?.from, profile), {
        replace: true,
      });
    } catch (failure) {
      if (request !== attempt.current) return;
      setError(
        ["API_NOT_READY", "SESSION_COOKIE_UNAVAILABLE", "SESSION_SERVICE_UNAVAILABLE"].includes(failure.code)
          ? getApiError(failure)
          : failure.response?.status === 429
          ? "ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
          : !failure.response
            ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
            : "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบเลขบัตรประชาชนและรหัสผ่าน หากยังไม่มีบัญชีให้ติดต่อเจ้าหน้าที่",
      );
    } finally {
      if (request === attempt.current) setLoading(false);
    }
  }
  if (hasAdminSession() || hasPatientSession()) {
    const destination = getLandingDestination({
      hasAdmin: hasAdminSession(), hasPatient: hasPatientSession(), patient: getStoredPatient(),
    });
    return <Navigate to={destination === "/admin" ? destination : getPatientDestination(location.state?.from, getStoredPatient())} replace />;
  }
  return (
    <div className="access-page">
      <a className="skip-link" href="#patient-login">
        ข้ามไปเข้าสู่ระบบ
      </a>
      <section className="access-story">
        <Link to="/login" className="access-brand">
          <Brand />
        </Link>
        <div className="access-story-content">
          <p className="eyebrow">YOUR HEALTH, YOUR SPACE</p>
          <h1>
            ทุกข้อมูลของคุณ
            <br />
            เพื่อสุขภาพที่ดีขึ้น
          </h1>
          <p>
            บันทึกผลตรวจ ติดตามประวัติ และดูภาพรวมสุขภาพ
            <br />
            ในบัญชีส่วนตัวของคุณ
          </p>
          <div className="patient-login-visual" aria-hidden="true">
            <span className="patient-login-heart">
              <HeartPulse size={72} strokeWidth={1.2} />
            </span>
            <div>
              <ShieldCheck size={21} />
              <span>
                บัญชีส่วนตัวของคุณ
                <small>ข้อมูลสุขภาพเชื่อมกับผู้ใช้แต่ละราย</small>
              </span>
            </div>
          </div>
        </div>
        <div className="access-story-footer">
          <span className="access-status-dot" /> SAVE STROKE · EVERYDAY CARE
        </div>
      </section>
      <main className="access-main">
        <Link to="/admin/login" className="access-back">
          <ShieldCheck size={16} /> สำหรับเจ้าหน้าที่ <ArrowRight size={14} />
        </Link>
        <div className="access-form-wrap" data-motion-enter="panel">
          <span className="access-lock">
            <UserRound size={28} strokeWidth={1.5} />
          </span>
          <p className="eyebrow">WELCOME TO YOUR CARE</p>
          <h2>เข้าสู่บัญชีสุขภาพของคุณ</h2>
          <p className="access-description">
            ใช้เลขบัตรประชาชนและรหัสผ่านของคุณ
          </p>
          {location.state?.expired && (
            <Notice tone="warning">
              เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง
            </Notice>
          )}
          <form
            id="patient-login"
            className="access-form"
            onSubmit={submit}
            noValidate
          >
            {error && <Notice tone="error">{error}</Notice>}
            <Field
              label="เลขบัตรประชาชน"
              id="patient-citizenId"
              required
              error={idError}
            >
              <input
                className="input"
                id="patient-citizenId"
                inputMode="numeric"
                maxLength={13}
                autoComplete="username"
                placeholder="เลขบัตรประชาชน 13 หลัก"
                value={citizenId}
                onChange={(event) => {
                  setCitizenId(
                    event.target.value.replace(/\D/g, "").slice(0, 13),
                  );
                  setIdError("");
                }}
                disabled={loading}
              />
            </Field>
            <Field
              label="รหัสผ่าน"
              id="patient-password"
              required
              hint="ครั้งแรก ใช้รหัสเริ่มต้น 6 หลักจากเจ้าหน้าที่"
            >
              <div className="password-input">
                <input
                  id="patient-password"
                  className="input"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="กรอกรหัสผ่านของคุณ"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <Button type="submit" loading={loading}>
              เข้าสู่บัญชีของฉัน {!loading && <ArrowRight size={17} />}
            </Button>
          </form>
          <Link className="btn btn-secondary patient-guest-entry" to="/guest">
            บันทึกสุขภาพโดยไม่เข้าสู่ระบบ <ArrowRight size={16} />
          </Link>
          <div className="patient-login-help">
            <strong>เข้าใช้งานครั้งแรก หรือลืมรหัสผ่าน?</strong>
            <p>
              ติดต่อเจ้าหน้าที่ของหน่วยงานเพื่อเปิดบัญชีหรือออกรหัสเริ่มต้นใหม่ให้คุณ
            </p>
            <Link to="/help">
              ดูวิธีเข้าใช้งาน <ArrowRight size={13} />
            </Link>
          </div>
        </div>
        <footer className="access-footer">
          <LegalLinks />
          © {currentBuddhistYear()} Save Stroke · ใส่ใจคุณในทุกวัน
        </footer>
      </main>
    </div>
  );
}
