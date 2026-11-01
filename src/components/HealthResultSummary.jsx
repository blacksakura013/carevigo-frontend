import React, { useId } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { interpretHealthRecords } from "../utils/healthInterpretation";
import "../styles/health-results.css";

export default function HealthResultSummary({ records = [], context = "saved", birthDate, gender, asOf }) {
  const result = interpretHealthRecords(records, { birthDate, gender, asOf });
  const headingId = useId();
  const sources = Array.from(new Map((result.sources || []).filter(source => /^https:\/\//.test(source.url)).map(source => [source.url, source])).values());
  return <section className="health-results" aria-label="สรุปผลสุขภาพและคำแนะนำ">
    <header className="health-results-heading">
      <h2>สรุปผลสุขภาพและคำแนะนำ</h2>
      <p>{context === "pending-review" ? "จากผลตรวจที่คุณส่งครั้งนี้ · รอเจ้าหน้าที่ตรวจสอบ" : "จากผลตรวจที่บันทึกสำเร็จในครั้งนี้"}</p>
    </header>
    {!result.hasMeasurements ? <div className="health-results-empty">
      <Info size={24} aria-hidden="true" />
      <p>ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ</p>
    </div> : <>
      {result.priority && <section className="health-results-priority" aria-label="คำแนะนำเร่งด่วน">
        <AlertTriangle size={28} aria-hidden="true" />
        <div><h3>{result.priority.title}</h3><p>{result.priority.description}</p>
          {result.emergencyAdvice && <p>{result.emergencyAdvice}</p>}
        </div>
      </section>}
      <div className="health-results-grid">
        {result.cards.map((card, index) => {
          const level = ["normal", "watch", "high", "urgent"].includes(card.level) ? card.level : "neutral";
          const Icon = level === "normal" ? CheckCircle2 : level === "neutral" ? Info : AlertTriangle;
          const titleId = `${headingId}-${index}`;
          return <article className={`health-result-card health-result-${level}`} data-result-type={card.type} key={card.id} aria-labelledby={titleId}>
            <div className="health-result-card-heading"><h3 id={titleId}>{card.title}</h3>
              <span className="health-result-level"><Icon size={22} aria-hidden="true" />{card.label}</span>
            </div>
            <dl className="health-result-measurements">{card.measurements.map((measurement, measurementIndex) => <div key={`${measurement.label}-${measurementIndex}`}>
              <dt>{measurement.label}</dt><dd>{measurement.value}{measurement.unit ? ` ${measurement.unit}` : ""}</dd>
            </div>)}</dl>
            <p className="health-result-explanation">{card.explanation}</p>
            {card.reference && <p className="health-result-reference">{card.reference}</p>}
            {card.actions.length > 0 && <div className="health-result-actions"><h4>ควรทำอย่างไรต่อ</h4>
              <ul>{card.actions.map(action => <li key={action}>{action}</li>)}</ul>
            </div>}
          </article>;
        })}
      </div>
    </>}
    {result.note && <p className="health-results-note">{result.note}</p>}
    {result.hasMeasurements && !result.priority && result.emergencyAdvice && <p className="health-results-emergency-advice">{result.emergencyAdvice}</p>}
    {result.hasMeasurements && sources.length > 0 && <details className="health-results-sources">
      <summary>แหล่งอ้างอิงและเกณฑ์แปลผล</summary>
      <ul>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer noopener">{source.title}</a></li>)}</ul>
    </details>}
  </section>;
}
