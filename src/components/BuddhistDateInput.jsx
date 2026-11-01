import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { BE_OFFSET, THAI_MONTHS, buddhistInputToGregorian, formatThaiDate, gregorianDate, gregorianToBuddhistInput, isoDate, todayGregorian } from "../utils/thaiDate";
import "../styles/buddhist-date.css";

const INVALID = "!BE:";
const readable = value => String(value || "").startsWith(INVALID) ? value.slice(INVALID.length) : gregorianToBuddhistInput(value);
const partsFor = value => {
  const iso = gregorianDate(value) || todayGregorian();
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 };
};
function dateAt(year, month, day) {
  const date = new Date(0); date.setUTCFullYear(year, month, day); return date;
}

export default function BuddhistDateInput({ id, name = "birthDate", value = "", onChange, label = "วันเกิด", max = todayGregorian(), min, disabled, required, ...inputProps }) {
  const [text, setText] = useState(() => readable(value));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => partsFor(value));
  const [yearText, setYearText] = useState(() => String(partsFor(value).year + BE_OFFSET));
  const [position, setPosition] = useState({});
  const wrapper = useRef(null), popup = useRef(null), trigger = useRef(null), pendingFocus = useRef(null);
  useEffect(() => { setText(readable(value)); }, [value]);
  useEffect(() => { setYearText(String(view.year + BE_OFFSET)); }, [view.year]);
  const close = (focus = true) => { setOpen(false); if (focus) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = wrapper.current.getBoundingClientRect(), width = Math.min(352, window.innerWidth - 24);
      const height = Math.min(popup.current?.scrollHeight || 520, window.innerHeight - 24);
      const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12));
      setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top, maxHeight: Math.max(120, window.innerHeight - top - 12) });
    };
    const outside = event => { if (!wrapper.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false); };
    const stepChanged = event => {
      if (event.target?.contains?.(wrapper.current)) setOpen(false);
    };
    place(); document.addEventListener("pointerdown", outside); window.addEventListener("resize", place);
    window.addEventListener("save-stroke:form-step-change", stepChanged);
    return () => {
      document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", place);
      window.removeEventListener("save-stroke:form-step-change", stepChanged);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const wanted = pendingFocus.current || gregorianDate(value) || todayGregorian();
    const button = popup.current?.querySelector(`[data-date="${wanted}"]:not(:disabled)`);
    if (button) { button.focus(); pendingFocus.current = null; }
  }, [open, view, value]);
  const emit = next => onChange?.({ target: { name, value: next, type: "text" } });
  const allowed = iso => (!max || iso <= max) && (!min || iso >= min);
  const choose = iso => { emit(iso); setText(gregorianToBuddhistInput(iso)); close(); };
  const moveMonth = delta => {
    const date = dateAt(view.year, view.month + delta, 1);
    if (date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999) setView({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  };
  const keyboard = event => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    const selected = event.target.dataset.date;
    if (!selected) return;
    const date = new Date(`${selected}T00:00:00Z`);
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getUTCDay(), End: 6 - date.getUTCDay() };
    if (Object.hasOwn(offsets, event.key)) date.setUTCDate(date.getUTCDate() + offsets[event.key]);
    else if (event.key === "PageUp" || event.key === "PageDown") {
      const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + (event.key === "PageUp" ? -1 : 1));
      date.setUTCDate(Math.min(day, dateAt(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate()));
    } else return;
    event.preventDefault();
    const iso = isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    if (!allowed(iso)) return;
    pendingFocus.current = iso; setView({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  };
  const first = dateAt(view.year, view.month, 1).getUTCDay(), days = dateAt(view.year, view.month + 1, 0).getUTCDate();
  const selected = gregorianDate(value), today = todayGregorian();
  return <div className="buddhist-date" ref={wrapper}>
    <div className="buddhist-date-control">
      <input {...inputProps} className="input" id={id} name={name} type="text" inputMode="numeric" autoComplete="off"
        aria-invalid={inputProps["aria-invalid"] || String(value).startsWith(INVALID)}
        placeholder="วว/ดด/ปปปป (พ.ศ.)" maxLength={11} required={required} disabled={disabled} value={text}
        onChange={event => {
          const next = event.target.value; setText(next);
          emit(next.trim() ? buddhistInputToGregorian(next) || `${INVALID}${next}` : "");
        }} />
      <button ref={trigger} type="button" className="buddhist-date-trigger" disabled={disabled} aria-label={`เปิดปฏิทิน${label} พ.ศ.`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => {
          if (open) close(); else { setView(partsFor(value)); setOpen(true); }
        }}><CalendarDays size={20} /></button>
    </div>
    {open && createPortal(<div ref={popup} id={`${id}-calendar`} className="buddhist-calendar" role="dialog" aria-label={`ปฏิทินเลือก${label} พ.ศ.`}
      style={position} onKeyDown={keyboard}>
      <div className="buddhist-calendar-heading"><strong>เลือก{label} · พ.ศ.</strong><button type="button" onClick={() => close()} aria-label="ปิดปฏิทิน"><X size={18} /></button></div>
      <div className="buddhist-calendar-navigation">
        <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></button>
        <label><span>เดือน</span><select aria-label="เดือนในปฏิทิน" value={view.month} onChange={event => setView({ ...view, month: Number(event.target.value) })}>
          {THAI_MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
        <label><span>ปี พ.ศ.</span><input aria-label="ปี พ.ศ. ในปฏิทิน" type="number" inputMode="numeric" value={yearText} min={544} max={10542}
          onFocus={event => event.target.select()} onChange={event => {
            setYearText(event.target.value); const year = Number(event.target.value) - BE_OFFSET;
            if (/^\d{4,5}$/.test(event.target.value) && year >= 1 && year <= 9999) setView({ ...view, year });
          }} onBlur={() => setYearText(String(view.year + BE_OFFSET))} /></label>
        <button type="button" aria-label="เดือนถัดไป" onClick={() => moveMonth(1)}><ChevronRight size={20} /></button>
      </div>
      <p className="buddhist-calendar-month" aria-live="polite">{THAI_MONTHS[view.month]} พ.ศ. {view.year + BE_OFFSET}</p>
      <div className="buddhist-calendar-grid" role="group" aria-label={`วันที่ในเดือน${THAI_MONTHS[view.month]} พ.ศ. ${view.year + BE_OFFSET}`}>
        {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(day => <span className="buddhist-calendar-weekday" key={day}>{day}</span>)}
        {Array.from({ length: first }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1, iso = isoDate(view.year, view.month + 1, day);
          return <button type="button" key={day} data-date={iso} disabled={!allowed(iso)} aria-label={formatThaiDate(iso, { month: "long" })}
            aria-pressed={selected === iso} aria-current={today === iso ? "date" : undefined}
            className={selected === iso ? "selected" : ""} onClick={() => choose(iso)}>{day}</button>;
        })}
      </div>
      <div className="buddhist-calendar-footer"><button type="button" onClick={() => { emit(""); setText(""); close(); }}>ล้างวันเกิด</button>
        <button type="button" onClick={() => choose(today)} disabled={!allowed(today)}>วันนี้ · พ.ศ. {Number(today.slice(0, 4)) + BE_OFFSET}</button></div>
    </div>, document.body)}
  </div>;
}
