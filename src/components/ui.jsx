import React, { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { currentBuddhistYear } from "../utils/thaiDate";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardPlus,
  HeartPulse,
  History,
  Info,
  LifeBuoy,
  LoaderCircle,
  Menu,
  ShieldCheck,
  UserRoundPlus,
  X,
  AlertCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import {
  getStoredPatient,
  hasAdminSession,
  hasPatientSession,
  patientLogout,
} from "../api/api";
import LegalLinks from "./LegalLinks";
import "../styles/brand.css";
import { useContentMotion } from "../utils/motion";

export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <img src={`${process.env.PUBLIC_URL || ""}/save-stroke-mark.svg`} width={40} height={40} alt="" />
      </span>
      {!compact && (
        <span>
          <strong>
            Save <span>Stroke</span>
          </strong>
          <small>ใส่ใจสุขภาพ ในทุกวัน</small>
        </span>
      )}
    </span>
  );
}
export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${className}`}
      aria-busy={loading || undefined}
    >
      {loading && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function Notice({ tone = "info", children, ...props }) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "error" || tone === "warning"
        ? AlertCircle
        : Info;
  return (
    <div
      className={`notice notice-${tone}`}
      data-motion-feedback="true"
      role={tone === "error" ? "alert" : "status"}
      {...props}
    >
      <Icon size={19} />
      <div>{children}</div>
    </div>
  );
}
export function Field({
  label,
  id,
  hint,
  error,
  required,
  children,
  className = "",
}) {
  const generatedId = useId();
  const fieldId =
    id || (React.isValidElement(children) && children.props.id) || generatedId;
  const descriptionId = `${fieldId}-description`;
  let labelled = false;
  const decorate = (node) => {
    if (!React.isValidElement(node)) return node;
    if (!labelled && ["input", "select", "textarea"].includes(node.type)) {
      labelled = true;
      return React.cloneElement(node, {
        id: fieldId,
        "aria-required": required || undefined,
        "aria-invalid": error ? true : node.props["aria-invalid"],
        "aria-describedby":
          error || hint ? descriptionId : node.props["aria-describedby"],
      });
    }
    return node.props.children
      ? React.cloneElement(
          node,
          {},
          React.Children.map(node.props.children, decorate),
        )
      : node;
  };
  const input = React.Children.map(children, decorate);
  return (
    <div className={`field ${error ? "field-invalid" : ""} ${className}`}>
      <label htmlFor={fieldId}>
        {label}
        {required && (
          <span className="required" aria-label="จำเป็น">
            {" "}
            *
          </span>
        )}
      </label>
      {input}
      {(error || hint) && (
        <small
          id={descriptionId}
          className={error ? "field-error" : "field-hint"}
        >
          {error || hint}
        </small>
      )}
    </div>
  );
}
export function EmptyState({
  icon: Icon = ClipboardPlus,
  title,
  description,
  action,
}) {
  return (
    <div className="empty-state" data-motion-enter="fade">
      <span className="empty-state-icon">
        <Icon size={27} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  const motionRef = useContentMotion(title);
  return (
    <div className="page-heading" ref={motionRef} data-motion-content="heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </div>
  );
}
const publicLinks = [
  {
    to: "/",
    key: "dashboard",
    label: "ภาพรวมสุขภาพ",
    icon: LayoutDashboard,
  },
  { to: "/health", key: "health", label: "บันทึกสุขภาพ", icon: Activity },
  { to: "/history", key: "history", label: "ประวัติสุขภาพ", icon: History },
  { to: "/profile", key: "profile", label: "ข้อมูลของฉัน", icon: UserRound },
  { to: "/settings", key: "settings", label: "ตั้งค่าบัญชี", icon: Settings },
  {
    to: "/guest",
    key: "guest",
    label: "บันทึกไม่เข้าสู่ระบบ",
    icon: ClipboardPlus,
  },
];
export function PublicLayout({
  children,
  active = "dashboard",
  title,
  subtitle,
  eyebrow,
  guestOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef(null);
  const location = useLocation();
  const [patient, setPatient] = useState(getStoredPatient);
  const patientSession = !guestOnly && hasPatientSession();
  const staffView = !guestOnly && !patientSession && hasAdminSession();
  const links = guestOnly
    ? [{ to: "/guest", key: "guest", label: "บันทึกสุขภาพ", icon: ClipboardPlus }]
    : staffView
    ? [
        {
          to: "/admin",
          key: "dashboard",
          label: "แดชบอร์ดเจ้าหน้าที่",
          icon: LayoutDashboard,
        },
        {
          to: "/register",
          key: "register",
          label: "ลงทะเบียนผู้รับบริการ",
          icon: UserRoundPlus,
        },
        ...publicLinks.filter((link) =>
          ["health", "history", "guest"].includes(link.key),
        ),
      ]
    : patientSession
      ? publicLinks
      : [
          {
            to: "/guest",
            key: "guest",
            label: "บันทึกสุขภาพ",
            icon: ClipboardPlus,
          },
          {
            to: "/login",
            key: "login",
            label: "เข้าสู่บัญชีของฉัน",
            icon: UserRound,
          },
        ];
  useEffect(() => {
    const update = () => setPatient(getStoredPatient());
    window.addEventListener("carevigo:patient-updated", update);
    return () => {
      window.removeEventListener("carevigo:patient-updated", update);
    };
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 900px)").matches) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...sidebarRef.current.querySelectorAll("a,button:not([disabled])"),
      ].filter((node) => node.getClientRects().length);
    focusable()[0]?.focus();
    const close = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const resize = () => {
      if (!window.matchMedia("(max-width: 900px)").matches) setOpen(false);
    };
    document.addEventListener("keydown", close);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", resize);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);
  return (
    guestOnly ? <div className="guest-entry-shell">
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
      <header className="guest-entry-header"><Brand /><span>บันทึกสุขภาพ</span></header>
      <main id="main-content" className="guest-entry-content">
        {children}
        <footer className="content-footer"><LegalLinks /><span>© {currentBuddhistYear()} Save Stroke</span></footer>
      </main>
    </div> : <div className="app-shell">
      <a className="skip-link" href="#main-content">
        ข้ามไปยังเนื้อหา
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="ปิดเมนู"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`public-sidebar ${open ? "is-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Link to="/" aria-label="Save Stroke หน้าหลัก">
            <Brand />
          </Link>
          <button
            className="icon-btn mobile-only"
            aria-label="ปิดเมนู"
            onClick={() => setOpen(false)}
          >
            <X size={21} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-icon">
            <HeartPulse size={17} />
          </span>
          <div>
            {staffView ? "พื้นที่เจ้าหน้าที่" : "ศูนย์ดูแลสุขภาพ"}
            <small>
              {staffView ? "จัดการข้อมูลผู้รับบริการ" : "สำหรับผู้รับบริการ"}
            </small>
          </div>
          <ChevronRight size={15} />
        </div>
        <p className="nav-caption">การดูแลของคุณ</p>
        <nav aria-label="เมนูหลัก" className="sidebar-nav">
          {links.map(({ to, key, label, icon: Icon }) => (
            <Link
              to={to}
              key={key}
              aria-current={active === key ? "page" : undefined}
              className={`nav-item ${active === key ? "is-active" : ""}`}
            >
              <Icon size={20} strokeWidth={1.7} />
              <span>{label}</span>
              {active === key && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {patientSession && patient && (
            <div className="patient-session-card">
              <span>
                <UserRound size={19} />
              </span>
              <div>
                <strong>{patient.firstName || "บัญชีของฉัน"}</strong>
                <small>•••••••••{patient.citizenId?.slice(-4)}</small>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="ออกจากบัญชีของฉัน"
                onClick={() => { Promise.resolve(patientLogout()).catch(() => {}); }}
              >
                <LogOut size={17} />
              </button>
            </div>
          )}
          <div className="care-note">
            <span className="care-note-icon">
              <ShieldCheck size={23} strokeWidth={1.5} />
            </span>
            <h3>สุขภาพดี เริ่มที่การใส่ใจ</h3>
            <p>บันทึกอย่างสม่ำเสมอ เพื่อให้เห็นภาพสุขภาพของคุณชัดขึ้น</p>
            <Link to="/help">
              เริ่มต้นใช้งาน <ArrowUpRight size={15} />
            </Link>
          </div>
          <NavLink
            to="/help"
            className={({ isActive }) =>
              `nav-item ${isActive ? "is-active" : ""}`
            }
          >
            <LifeBuoy size={19} />
            ศูนย์ช่วยเหลือ
          </NavLink>
          <div className="sidebar-footer">
            Save Stroke <span>Health & wellbeing</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-only"
              aria-label="เปิดเมนู"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              พื้นที่ดูแลสุขภาพ <ChevronRight size={14} />
              <strong>
                {links.find((link) => link.key === active)?.label ||
                  "ศูนย์ช่วยเหลือ"}
              </strong>
            </span>
          </div>
          {!guestOnly && <Link
            to={staffView ? "/admin" : patientSession ? "/profile" : "/login"}
            className="staff-link"
          >
            <ShieldCheck size={16} />
            <span>
              {staffView
                ? "กลับแดชบอร์ดเจ้าหน้าที่"
                : patientSession
                  ? "บัญชีส่วนตัวของฉัน"
                  : "เข้าสู่ระบบ"}
            </span>
            <ArrowUpRight size={15} />
          </Link>}
        </header>
        <main id="main-content" className="main-content">
          {title && (
            <PageHeading
              eyebrow={eyebrow}
              title={title}
              description={subtitle}
            />
          )}
          {children}
          <footer className="content-footer">
            <LegalLinks />
            <span>
              © {currentBuddhistYear()} Save Stroke · ใส่ใจคุณในทุกวัน
            </span>
            <Link to="/help">
              คู่มือการใช้งาน <ArrowUpRight size={12} />
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
