import React from "react";
import { ArrowUpRight } from "lucide-react";
import "../styles/legal.css";

export function LegalDocumentLink({ href, children, newTab = true }) {
  return (
    <a
      className="legal-link"
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
      {newTab && <ArrowUpRight size={13} aria-hidden="true" />}
      {newTab && <span className="legal-sr-only"> (เปิดในแท็บใหม่)</span>}
    </a>
  );
}

export default function LegalLinks({ className = "", newTab = true }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="ข้อกำหนดและความเป็นส่วนตัว">
      <LegalDocumentLink href="/terms" newTab={newTab}>ข้อกำหนดการใช้บริการ</LegalDocumentLink>
      <span className="legal-links-separator" aria-hidden="true">·</span>
      <LegalDocumentLink href="/privacy" newTab={newTab}>ประกาศความเป็นส่วนตัว</LegalDocumentLink>
    </nav>
  );
}
