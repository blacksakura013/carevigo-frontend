import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "./ui";
import LegalLinks from "./LegalLinks";
import { currentBuddhistYear } from "../utils/thaiDate";
import "../styles/access.css";
import "../styles/admin-recovery.css";

export default function AdminRecoveryLayout({ title, description, children }) {
  return <div className="access-page admin-recovery-page">
    <a className="skip-link" href="#admin-recovery-main" onClick={event => {
      event.preventDefault(); document.getElementById("admin-recovery-main")?.focus();
    }}>ข้ามไปยังการกู้คืนบัญชี</a>
    <section className="access-story">
      <Link to="/admin/login" className="access-brand"><Brand /></Link>
      <div className="access-story-content">
        <p className="eyebrow">SAVE STROKE · ACCOUNT RECOVERY</p>
        <h2>กลับเข้าสู่บัญชี<br />เพื่อดูแลได้อย่างต่อเนื่อง</h2>
        <p>ใช้ลิงก์ในอีเมลของบัญชีเจ้าหน้าที่ เพื่อตั้งรหัสผ่านใหม่ด้วยตัวคุณเอง</p>
        <div className="admin-recovery-story-note"><ShieldCheck size={28} /><p>เก็บลิงก์และรหัสผ่านของคุณเป็นส่วนตัว</p></div>
      </div>
      <div className="access-story-footer">Save Stroke · ใส่ใจคุณในทุกวัน</div>
    </section>
    <main className="access-main" id="admin-recovery-main" tabIndex={-1}>
      <Link to="/admin/login" className="access-back"><ArrowLeft size={20} />กลับหน้าเข้าสู่ระบบเจ้าหน้าที่</Link>
      <div className="access-form-wrap" data-motion-enter="panel">
        <span className="access-lock"><ShieldCheck size={28} /></span>
        <p className="eyebrow">กู้คืนบัญชีเจ้าหน้าที่</p>
        <h1>{title}</h1>
        <p className="access-description">{description}</p>
        {children}
      </div>
      <footer className="access-footer"><LegalLinks />© {currentBuddhistYear()} Save Stroke · ใส่ใจคุณในทุกวัน</footer>
    </main>
  </div>;
}
