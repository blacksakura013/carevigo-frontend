import React, { useSyncExternalStore } from "react";
import { getApiReadinessSnapshot, subscribeApiReadiness } from "../api/api";
import "../styles/server-readiness.css";

export default function ServerReadinessNotice() {
  const snapshot = useSyncExternalStore(subscribeApiReadiness, getApiReadinessSnapshot, getApiReadinessSnapshot);
  if (snapshot.status !== "waiting") return null;
  return (
    <div className="server-readiness-notice" role="status" aria-live="polite" aria-atomic="true">
      <strong>กำลังเชื่อมต่อระบบ กรุณารอสักครู่…</strong>
      <span>ข้อมูลที่กรอกยังอยู่ ระบบจะดำเนินการต่อเมื่อพร้อม</span>
    </div>
  );
}
