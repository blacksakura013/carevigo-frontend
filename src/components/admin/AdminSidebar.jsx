import React, { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ClipboardCheck,
  Settings2,
  LogOut,
  X,
  HeartHandshake,
  ArrowUpRight,
} from "lucide-react";
import { adminLogout } from "../../api/api";
import { Brand } from "../ui";

const menus = [
  { id: "dashboard", label: "ภาพรวมการดูแล", icon: LayoutDashboard },
  { id: "members", label: "ทะเบียนสมาชิก", icon: Users },
  { id: "reviews", label: "ตรวจสอบบันทึก", icon: ClipboardCheck },
  { id: "verification", label: "ยืนยันสมาชิก", icon: ShieldCheck },
  { id: "settings", label: "ตั้งค่าบัญชี", icon: Settings2 },
];

export default function AdminSidebar({
  activeMenu,
  setActiveMenu,
  verification,
  open,
  onClose,
  profile,
}) {
  const sidebarRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector("button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll("button, a[href]");
      const first = focusable?.[0];
      const last = focusable?.[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open]);
  return (
    <>
      {open && (
        <button
          className="admin-nav-backdrop"
          aria-label="ปิดเมนูนำทาง"
          onClick={onClose}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`admin-sidebar ${open ? "is-open" : ""}`}
        aria-label="เมนูผู้ดูแลระบบ"
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
      >
        <div className="admin-sidebar-brand">
          <Brand />
          <button
            className="admin-nav-close admin-icon-button"
            onClick={onClose}
            aria-label="ปิดเมนู"
          >
            <X size={20} />
          </button>
        </div>
        <div className="admin-workspace-label">
          <span className="admin-live-dot" /> พื้นที่ผู้ดูแลระบบ
        </div>
        <nav className="admin-navigation" aria-label="เมนูหลัก">
          <p className="admin-nav-label">จัดการการดูแล</p>
          {menus.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`admin-nav-item ${activeMenu === id ? "is-active" : ""}`}
              aria-current={activeMenu === id ? "page" : undefined}
              onClick={() => {
                setActiveMenu(id);
                onClose();
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
              {id === "verification" && verification?.pending > 0 && (
                <span className="admin-nav-count">{verification.pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-help">
          <HeartHandshake size={27} />
          <strong>ดูแลด้วยความเข้าใจ</strong>
          <p>
            ข้อมูลสุขภาพที่เชื่อมต่อ
            <br />
            เพื่อการดูแลที่ต่อเนื่อง
          </p>
          <a href="/" target="_blank" rel="noreferrer">
            เปิดหน้าสำหรับสมาชิก <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="admin-sidebar-account">
          <span className="admin-avatar">
            {(profile?.email || "A").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>ผู้ดูแลระบบ</strong>
            <span title={profile?.email}>
              {profile?.email || "บัญชีผู้ดูแล"}
            </span>
          </div>
          <button
            className="admin-icon-button"
            onClick={() => { Promise.resolve(adminLogout()).catch(() => {}); }}
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>
    </>
  );
}
