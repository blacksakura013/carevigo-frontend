import React, { useId } from "react";
import { Activity, CheckCircle2, LockKeyhole } from "lucide-react";
import "../styles/health-selection.css";

export default function HealthSectionPicker({ sections = [], selectedTypes = [], onChange, disabled = false, lockedTypes = [], emptyMessage }) {
  const headingId = useId();
  const knownTypes = sections.map(section => section.type);
  const locked = new Set(lockedTypes);
  const selected = new Set([...selectedTypes, ...lockedTypes].filter(type => knownTypes.includes(type)));
  const change = (type, checked) => {
    if (disabled || locked.has(type)) return;
    const next = new Set(selected);
    if (checked) next.add(type);
    else next.delete(type);
    onChange?.(knownTypes.filter(item => next.has(item)));
  };
  return <section className="health-section-picker" aria-labelledby={headingId}>
    <h2 id={headingId}>เลือกข้อมูลสุขภาพครั้งนี้</h2>
    <fieldset disabled={disabled}>
      <legend>เลือกได้มากกว่า 1 รายการ หรือไม่เลือกเลยก็ได้</legend>
      <p className="health-selection-count" role="status" aria-live="polite" aria-atomic="true">เลือกแล้ว {selected.size} จาก {sections.length} หมวด</p>
      <div className="health-selection-grid">
        {sections.map(section => {
          const checked = selected.has(section.type);
          const isLocked = locked.has(section.type);
          const Icon = section.icon || Activity;
          return <label key={section.type} className={`health-selection-card health-selection-${section.type}${checked ? " is-selected" : ""}${isLocked ? " is-locked" : ""}${disabled ? " is-disabled" : ""}`}>
            <input type="checkbox" aria-label={`บันทึก${section.title}`} checked={checked} disabled={isLocked}
              onChange={event => change(section.type, event.target.checked)} />
            <span className="health-selection-icon" aria-hidden="true"><Icon size={26} /></span>
            <span className="health-selection-copy"><strong>{section.title}</strong><span>{section.description}</span></span>
            <span className="health-selection-status">{isLocked ? <><LockKeyhole size={19} aria-hidden="true" />บันทึกแล้ว</> : checked ? <><CheckCircle2 size={20} aria-hidden="true" />เลือกแล้ว</> : "ยังไม่เลือก"}</span>
          </label>;
        })}
      </div>
      {selected.size === 0 && emptyMessage && <p className="health-selection-empty">{emptyMessage}</p>}
    </fieldset>
  </section>;
}
