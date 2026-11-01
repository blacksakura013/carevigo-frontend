import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  Eye,
  EyeOff,
  HeartPulse,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  adminLogin,
  clearAdminSession,
  getApiError,
  hasAdminSession,
  saveAdminSession,
} from "../api/api";
import { Brand, Button, Field, Notice } from "../components/ui";
import "../styles/access.css";
import "../styles/admin-recovery.css";
import { currentBuddhistYear } from "../utils/thaiDate";
import LegalLinks from "../components/LegalLinks";
import { getAdminDestination } from "../utils/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const destination = getAdminDestination(location.state?.from);
  useEffect(() => {
    document.title = "เข้าสู่ระบบเจ้าหน้าที่ | Save Stroke";
    return () => {
      attempt.current += 1;
    };
  }, [navigate, destination]);
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    const request = ++attempt.current;
    setLoading(true);
    setError("");
    try {
      const response = await adminLogin(email.trim().toLowerCase(), password, { isCurrent: () => request === attempt.current });
      if (request !== attempt.current) return;
      const data = response.data?.data;
      saveAdminSession(data);
      if (!hasAdminSession()) {
        clearAdminSession();
        throw new Error("invalid session");
      }
      setPassword("");
      navigate(destination, { replace: true });
    } catch (failure) {
      if (request !== attempt.current) return;
      const status = failure.response?.status;
      setError(
        ["SESSION_COOKIE_UNAVAILABLE", "SESSION_SERVICE_UNAVAILABLE"].includes(failure.code)
          ? getApiError(failure)
          : !failure.response && failure.request
          ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง"
          : status === 429
            ? "เข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
            : status >= 500
              ? "เซิร์ฟเวอร์ยังไม่พร้อมให้บริการ กรุณาลองอีกครั้งภายหลัง"
              : "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน หรือติดต่อผู้ดูแลระบบ",
      );
    } finally {
      if (request === attempt.current) setLoading(false);
    }
  }
  if (hasAdminSession()) return <Navigate to={destination} replace />;
  return (
    <div className="access-page">
      <a className="skip-link" href="#login-form">
        ข้ามไปเข้าสู่ระบบ
      </a>
      <section className="access-story">
        <Link to="/" className="access-brand">
          <Brand />
        </Link>
        <div className="access-story-content">
          <p className="eyebrow">CARE THAT CONNECTS</p>
          <h1>
            เชื่อมต่อการดูแล
            <br />
            ใกล้ชิดทุกสุขภาพ
          </h1>
          <p>
            พื้นที่ทำงานสำหรับทีมดูแลสุขภาพ
            <br />
            ติดตามข้อมูลและดูแลผู้รับบริการได้ในที่เดียว
          </p>
          <div className="access-illustration" aria-hidden="true">
            <div className="access-orbit orbit-one" />
            <div className="access-orbit orbit-two" />
            <span className="access-illustration-center">
              <HeartPulse size={62} strokeWidth={1.2} />
            </span>
            <span className="access-float float-one">
              <Activity size={22} />
              <span>
                ติดตามข้อมูลสุขภาพ<small>เห็นภาพรวมได้ชัดเจน</small>
              </span>
            </span>
            <span className="access-float float-two">
              <Users size={21} />
              <span>
                ดูแลอย่างต่อเนื่อง<small>ข้อมูลเชื่อมถึงกัน</small>
              </span>
            </span>
            <span className="access-small-plus">+</span>
          </div>
        </div>
        <div className="access-story-footer">
          <span className="access-status-dot" /> SAVE STROKE HEALTH MANAGEMENT
        </div>
      </section>
      <main className="access-main">
        <Link to="/" className="access-back">
          <ArrowLeft size={16} /> กลับสู่หน้าผู้รับบริการ
        </Link>
        <div className="access-form-wrap" data-motion-enter="panel">
          <span className="access-lock">
            <ShieldCheck size={28} strokeWidth={1.5} />
          </span>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>เข้าสู่ระบบเจ้าหน้าที่</h2>
          <p className="access-description">
            เริ่มต้นดูแลสุขภาพผู้รับบริการของคุณ
          </p>
          {location.state?.expired && (
            <Notice tone="warning">
              เซสชันหมดอายุ กรุณาเข้าสู่ระบบเพื่อใช้งานต่อ
            </Notice>
          )}
          <form id="login-form" onSubmit={submit} className="access-form">
            {error && <Notice tone="error">{error}</Notice>}
            <Field label="อีเมล" id="admin-email" required>
              <input
                id="admin-email"
                className="input"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field label="รหัสผ่าน" id="admin-password" required>
              <div className="password-input">
                <input
                  id="admin-password"
                  className="input"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="กรอกรหัสผ่านของคุณ"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            <Link to="/admin/forgot-password" className="admin-forgot-password-link">ลืมรหัสผ่านเจ้าหน้าที่?</Link>
            <Button type="submit" loading={loading}>
              เข้าสู่ระบบ {!loading && <ArrowRight size={17} />}
            </Button>
          </form>
          <p className="access-support">
            หากเข้าใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
            <br />
            <Link to="/help">
              อ่านคู่มือการใช้งาน <ArrowRight size={12} />
            </Link>
          </p>
        </div>
        <footer className="access-footer">
          <LegalLinks />
          © {currentBuddhistYear()} Save Stroke · ใส่ใจคุณในทุกวัน
        </footer>
      </main>
    </div>
  );
}
