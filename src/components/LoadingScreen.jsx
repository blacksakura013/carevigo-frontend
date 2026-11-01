import React, { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLoadingScreen } from "./LoadingScreenContext";
import "../styles/loading-screen.css";

export function LoadingVisual({ compact = false }) {
  return <div className={`loading-visual${compact ? " loading-visual-compact" : ""}`} aria-hidden="true">
    <span className="loading-visual-halo" />
    <span className="loading-visual-orbit" />
    <span className="loading-visual-core">
      <img src={`${process.env.PUBLIC_URL || ""}/save-stroke-mark.svg`} width="80" height="80" alt="" />
    </span>
  </div>;
}

export default function LoadingScreen({
  title = "กำลังตรวจสอบการเข้าสู่ระบบ…",
  description = "เรากำลังเตรียมพื้นที่ดูแลสุขภาพให้คุณ",
}) {
  const { registerFullScreen } = useLoadingScreen();
  useLayoutEffect(() => registerFullScreen(), [registerFullScreen]);
  return <main className="loading-screen" data-loading-screen="full">
    <section className="loading-screen-card">
      <span className="loading-screen-brand">Save <span>Stroke</span></span>
      <LoadingVisual />
      <div className="loading-screen-status" role="status" aria-live="polite" aria-atomic="true">
        <h1 className="loading-screen-title">{title}</h1>
        <p>{description}</p>
      </div>
      <svg className="loading-screen-pulse" viewBox="0 0 200 40" fill="none" aria-hidden="true">
        <path className="loading-pulse-base" d="M2 23h45l9-8 9 17 13-27 16 31 12-19 10 6h82" />
        <path className="loading-pulse-trace" d="M2 23h45l9-8 9 17 13-27 16 31 12-19 10 6h82" />
      </svg>
      <p className="loading-screen-hint">กรุณารอสักครู่ ระบบจะเปิดหน้าที่คุณต้องการโดยอัตโนมัติ</p>
      <Link className="loading-screen-guest" to="/guest">บันทึกสุขภาพโดยไม่เข้าสู่ระบบ <ArrowRight size={18} aria-hidden="true" /></Link>
    </section>
    <p className="loading-screen-tagline">ใส่ใจสุขภาพ ในทุกวัน</p>
  </main>;
}
