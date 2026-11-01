import React, { useId } from "react";
import { Activity, BarChart3, CheckCircle2, ClipboardList, Droplets, HeartPulse, HelpCircle, Scale, Users } from "lucide-react";
import { formatThaiDate } from "../../utils/thaiDate";
import "../../styles/admin-cohort-report.css";

const TYPE_LABELS = [
  ["blood_pressure", "ความดันโลหิต", HeartPulse],
  ["sugar", "น้ำตาลในเลือด", Droplets],
  ["cholesterol", "ไขมันในเลือด", Activity],
  ["bmi", "น้ำหนัก / BMI", Scale],
];
const STATUS_LABELS = [
  ["approved", "ยืนยันแล้ว", "approved"],
  ["pending", "รอตรวจสอบ", "pending"],
  ["rejected", "ยกเลิก", "rejected"],
  ["unknown", "ไม่ทราบสถานะ", "unknown"],
];
const number = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("th-TH") : "—";
const periodDate = (value, monthly = false) => monthly
  ? formatThaiDate(`${value}-01`, { day: undefined, month: "long", year: "numeric", empty: "ไม่ระบุเดือน" })
  : formatThaiDate(value, { empty: "ไม่ระบุวันที่" });

function Count({ value, unit }) {
  return <span className="cohort-count"><strong>{number(value)}</strong><span>{unit}</span></span>;
}

function Timeline({ rows, monthly, titleId }) {
  const maximum = Math.max(0, ...rows.map(row => row.total));
  const step = 600 / Math.max(rows.length, 1);
  const chartTitle = `จำนวนรายการที่บันทึก${monthly ? "รายเดือน" : "รายวัน"}`;
  return <section className="cohort-section" aria-labelledby={titleId}>
    <header className="cohort-section-heading"><BarChart3 size={26} aria-hidden="true" /><div><h2 id={titleId}>{chartTitle}</h2><p>แสดงจำนวนการบันทึกทุกสถานะตามวันที่บันทึกในระบบ เวลาไทย</p></div></header>
    {maximum > 0 ? <div className="cohort-timeline-frame">
      <span className="cohort-axis-label">หน่วย: รายการ · สูงสุด {number(maximum)} รายการต่อ{monthly ? "เดือน" : "วัน"}</span>
      <svg className="cohort-timeline" viewBox="0 0 620 210" preserveAspectRatio="none" role="img" aria-label={chartTitle}>
        <desc>ความสูงของแท่งแสดงจำนวนรายการ อ่านจำนวนคน รายการ และสถานะทุกช่วงได้จากตารางใต้กราฟ</desc>
        {[10, 100, 190].map(y => <line key={y} x1="10" x2="610" y1={y} y2={y} className="cohort-chart-grid" vectorEffect="non-scaling-stroke" />)}
        {rows.map((row, index) => <rect key={row.date} x={10 + index * step + step * 0.12} y={190 - (row.total / maximum) * 180} width={step * 0.76} height={(row.total / maximum) * 180} rx={Math.min(3, step / 5)} className="cohort-chart-bar"><title>{periodDate(row.date, monthly)}: {number(row.people)} คน, {number(row.total)} รายการ</title></rect>)}
      </svg>
      <div className="cohort-chart-dates" aria-hidden="true"><span>{periodDate(rows[0]?.date, monthly)}</span><span>{periodDate(rows[rows.length - 1]?.date, monthly)}</span></div>
    </div> : <p className="cohort-empty">ยังไม่มีรายการบันทึกในช่วงเวลาและตัวกรองนี้</p>}
    <p className="cohort-note">จำนวนคนในแต่ละ{monthly ? "เดือน" : "วัน"}นับไม่ซ้ำภายในช่วงนั้น คนเดิมอาจปรากฏหลายช่วง จึงนำจำนวนคนแต่ละช่วงมาบวกรวมเป็นจำนวนคนทั้งหมดไม่ได้ กราฟนี้แสดงปริมาณการบันทึก ไม่ใช่แนวโน้มว่าสุขภาพดีขึ้นหรือแย่ลง</p>
    {rows.length > 0 && <details className="cohort-table-details"><summary>ตารางจำนวนคนและรายการ{monthly ? "รายเดือน" : "รายวัน"} ({number(rows.length)} ช่วง)</summary>
      <table className="cohort-timeline-table"><caption>จำนวนคนและรายการตามวันที่บันทึก (พ.ศ.)</caption><thead><tr><th scope="col">{monthly ? "เดือน" : "วันที่"} (พ.ศ.)</th><th scope="col">ผู้มีรายการ</th><th scope="col">รายการและสถานะการตรวจสอบ</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.date}>
          <th scope="row"><time dateTime={row.date}>{periodDate(row.date, monthly)}</time></th>
          <td><span className="cohort-cell-label" aria-hidden="true">ผู้มีรายการ: </span>{number(row.people)} คน</td>
          <td><p className="cohort-row-total">รวม {number(row.total)} รายการ</p><dl className="cohort-row-statuses">{STATUS_LABELS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{number(row[key])} รายการ</dd></div>)}</dl></td>
        </tr>)}</tbody>
      </table>
    </details>}
  </section>;
}

export default function CohortReportPanel({ data, onDiseaseSelect, onActivitySelect }) {
  const id = useId();
  if (!data?.summary || !data?.range || !Array.isArray(data.diseases) || !Array.isArray(data.timeline)) return <section className="cohort-report-panel" aria-label="สรุปผลสุขภาพกลุ่มผู้รับบริการ"><h2>สรุปผลสุขภาพกลุ่มผู้รับบริการ</h2><p className="cohort-empty">ยังไม่มีข้อมูลสรุปที่แสดงได้ กรุณาเลือกช่วงเวลาแล้วโหลดรายงาน</p></section>;
  const { summary, range, filters = {}, diseases, timeline } = data;
  const activities = [
    ["all", "ผู้รับบริการในกลุ่มทั้งหมด", summary.cohortPeople, Users],
    ["recorded", "มีบันทึกในช่วงนี้", summary.withRecords, CheckCircle2],
    ["none", "ยังไม่มีบันทึกในช่วงนี้", summary.withoutRecords, HelpCircle],
  ];
  return <div className="cohort-report-panel">
    <section className="cohort-section" aria-labelledby={`${id}-coverage`}>
      <header className="cohort-section-heading"><Users size={27} aria-hidden="true" /><div><h2 id={`${id}-coverage`}>ความครอบคลุมการบันทึกสุขภาพ</h2><p><time dateTime={range.from}>{periodDate(range.from)}</time> ถึง <time dateTime={range.to}>{periodDate(range.to)}</time> · เวลาไทย</p></div></header>
      <p className="cohort-note">จำนวนคนด้านล่างใช้กลุ่มโรคและคำค้นหาที่เลือก กดบัตรเพื่อดูรายชื่อทั้งหมด เฉพาะผู้มีบันทึก หรือผู้ที่ยังไม่มีบันทึกในช่วงนี้</p>
      <div className="cohort-coverage-grid" role="group" aria-label="เลือกผู้รับบริการตามการมีบันทึก">{activities.map(([key, label, count, Icon]) => <button key={key} type="button" className="cohort-coverage-card" aria-pressed={(filters.activity || "all") === key} onClick={() => onActivitySelect?.(key)} disabled={!onActivitySelect}>
        <span className="cohort-card-label"><Icon size={24} aria-hidden="true" />{label}</span><Count value={count} unit="คน" /><span className="cohort-card-action">{(filters.activity || "all") === key ? "กำลังแสดงกลุ่มนี้" : "ดูรายชื่อกลุ่มนี้"}</span>
      </button>)}</div>
    </section>
    <section className="cohort-section" aria-labelledby={`${id}-totals`}>
      <header className="cohort-section-heading"><ClipboardList size={27} aria-hidden="true" /><div><h2 id={`${id}-totals`}>สรุปตามตัวกรองปัจจุบัน</h2><p>จำนวนคนและรายการใช้ช่วงเวลา กลุ่มโรค คำค้นหา และการมีบันทึกที่เลือกครบทุกตัวกรอง</p></div></header>
      <dl className="cohort-main-totals"><div><dt>ผู้รับบริการที่ตรงตัวกรอง</dt><dd><Count value={summary.people} unit="คน" /></dd></div><div><dt>บันทึกสุขภาพทั้งหมด</dt><dd><Count value={summary.total} unit="รายการ" /></dd></div></dl>
      <div className="cohort-type-grid">{TYPE_LABELS.map(([key, label, Icon]) => <article className={`cohort-type-card cohort-type-${key}`} key={key} aria-label={`จำนวนรายการ${label}`}><h3><Icon size={25} aria-hidden="true" />{label}</h3><Count value={summary.byType?.[key]} unit="รายการ" /></article>)}</div>
      {summary.byType?.unknown > 0 && <p className="cohort-note">มีบันทึกไม่ทราบหมวด {number(summary.byType.unknown)} รายการ รวมอยู่ในจำนวนบันทึกทั้งหมดแล้ว</p>}
      <h3>สถานะการตรวจสอบข้อมูล</h3><dl className="cohort-status-grid">{STATUS_LABELS.map(([key, label, tone]) => <div className={`cohort-status-card cohort-status-${tone}`} key={key}><dt>{label}</dt><dd><Count value={summary[key]} unit="รายการ" /></dd></div>)}</dl>
      <p className="cohort-note">หนึ่งคนอาจมีหลายรายการและหลายหมวด สถานะการตรวจสอบแสดงว่าข้อมูลได้รับการยืนยันหรือไม่ ไม่ใช่ระดับความรุนแรงของโรค การดูแนวโน้มค่าตรวจรายบุคคลใช้เฉพาะรายการที่ยืนยันแล้ว</p>
    </section>
    <section className="cohort-section" aria-labelledby={`${id}-diseases`}>
      <header className="cohort-section-heading"><Users size={27} aria-hidden="true" /><div><h2 id={`${id}-diseases`}>จำนวนคนในแต่ละกลุ่ม (ไม่จำกัดกลุ่มโรคที่เลือก)</h2><p>ใช้คำค้นหาและตัวเลือกการมีบันทึกปัจจุบัน โดยยังไม่จำกัดตามกลุ่มโรคที่เลือก</p></div></header>
      <p className="cohort-note">จัดกลุ่มจากประวัติโรคประจำตัวในข้อมูลส่วนตัวปัจจุบัน ไม่ใช่การวินิจฉัยจากผลตรวจ คนเดิมอาจอยู่หลายกลุ่ม จึงนำจำนวนทุกกลุ่มมาบวกเป็นจำนวนคนทั้งหมดไม่ได้</p>
      <div className="cohort-disease-grid" role="group" aria-label="เลือกกลุ่มโรคจากสรุป">{diseases.map(disease => <button type="button" key={disease.id} aria-pressed={filters.disease === disease.id} onClick={() => onDiseaseSelect?.(disease.id)} disabled={!onDiseaseSelect} className="cohort-disease-card"><span>{disease.label}</span><Count value={disease.people} unit="คน" /><span className="cohort-card-action">{filters.disease === disease.id ? "กำลังเลือกกลุ่มนี้" : "ดูรายชื่อกลุ่มนี้"}</span></button>)}</div>
      {diseases.length === 0 && <p className="cohort-empty">ยังไม่มีข้อมูลการจัดกลุ่มโรคที่แสดงได้</p>}
    </section>
    <Timeline rows={timeline} monthly={range.bucket === "month"} titleId={`${id}-timeline`} />
    <p className="cohort-as-of">ข้อมูลถึง <time dateTime={range.asOf}>{formatThaiDate(range.asOf, { withTime: true, empty: "ไม่ระบุเวลา" })}</time> · เวลาไทย</p>
  </div>;
}
