import React, { useId, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, CalendarDays, Info, Minus } from "lucide-react";
import { formatThaiDate } from "../utils/thaiDate";
import { HEALTH_PROGRESS_CATEGORIES, HEALTH_PROGRESS_METRICS, buildMetricComparison, buildProgressChart, formatProgressNumber, normalizeHealthProgress } from "../utils/healthProgress";
import "../styles/health-progress.css";

const date = value => formatThaiDate(value, { withTime: true, empty: "ไม่ระบุวันที่" });
const hasData = metric => Boolean(metric?.latest || metric?.series?.length);
const initialCategory = data => HEALTH_PROGRESS_CATEGORIES.find(category => category.metrics.some(key => hasData(data?.metrics[key]))) || HEALTH_PROGRESS_CATEGORIES[0];
const initialMetric = (data, category) => category.metrics.find(key => hasData(data?.metrics[key])) || category.metrics[0];

function Measurement({ label, point, unit, empty }) {
  return <div className="health-progress-reading"><dt>{label}</dt><dd>{point ? <><strong>{formatProgressNumber(point.value)}</strong> <span>{unit}</span><time dateTime={point.recordedAt}>{date(point.recordedAt)}</time></> : <span>{empty || "ยังไม่มีข้อมูล"}</span>}</dd></div>;
}

function MetricCard({ metricKey, metric, selected, onSelect }) {
  const meta = HEALTH_PROGRESS_METRICS[metricKey];
  const comparison = buildMetricComparison(metric);
  const Icon = comparison.direction === "increase" ? ArrowUp : comparison.direction === "decrease" ? ArrowDown : Minus;
  return <article className={`health-progress-metric${selected ? " is-selected" : ""}`} aria-label={meta.label}>
    <h3>{meta.label}</h3>
    <dl>
      <Measurement label="ล่าสุด" point={comparison.latest} unit={meta.unit} />
      <Measurement label="ก่อนหน้า" point={comparison.previous} unit={meta.unit} empty="ยังไม่มีค่าครั้งก่อน" />
      <div className="health-progress-delta"><dt>เปลี่ยนแปลงจากครั้งก่อน</dt><dd>
        {comparison.delta === null ? <span>{comparison.label}</span> : <><Icon size={22} aria-hidden="true" /><span>{comparison.label}{comparison.delta !== 0 ? ` ${formatProgressNumber(Math.abs(comparison.delta))} ${meta.unit}` : ""}</span></>}
      </dd></div>
      <Measurement label="ครั้งแรกในช่วงนี้" point={comparison.first} unit={meta.unit} />
    </dl>
    <p className="health-progress-sample-count">มีบันทึกค่านี้ {metric.total.toLocaleString("th-TH")} ครั้งในช่วงนี้</p>
    {metric.hasInvalidSamples && <p className="health-progress-data-note">ข้อมูลบางค่าไม่ครบหรืออ่านไม่ได้ จึงแสดงเฉพาะค่าที่ตรวจสอบรูปแบบได้</p>}
    <button type="button" className="health-progress-chart-button" onClick={onSelect} aria-pressed={selected}>ดูกราฟ{meta.label}</button>
  </article>;
}

function MetricChart({ metricKey, metric, titleId }) {
  const meta = HEALTH_PROGRESS_METRICS[metricKey];
  const chart = buildProgressChart(metric);
  if (!chart) return <div className="health-progress-empty"><Info size={26} aria-hidden="true" /><p>ยังไม่มีค่า{meta.label}ที่ยืนยันแล้วในช่วงนี้ จึงยังแสดงกราฟไม่ได้</p></div>;
  const yMiddle = (chart.yMin + chart.yMax) / 2;
  return <div className="health-progress-chart-section">
    <h3 id={titleId}>กราฟ{meta.label}ตามวันที่บันทึก</h3>
    <p>{chart.points.length === 1 ? "มีค่าที่แสดงเพียงครั้งเดียว จึงยังสรุปความเปลี่ยนแปลงไม่ได้" : "จุดแต่ละจุดคือค่าที่บันทึกจริง ตำแหน่งแนวนอนแสดงระยะห่างของเวลา"}</p>
    <p className="health-progress-coverage">แสดง {chart.points.length.toLocaleString("th-TH")} จาก {metric.total.toLocaleString("th-TH")} ค่าที่มีในช่วงนี้{metric.hasEarlier ? ` · กราฟจำกัดไม่เกิน ${metric.seriesLimit} ค่าล่าสุด ข้อมูลก่อนหน้านี้ยังรวมในการเปรียบเทียบด้านบน` : ""}</p>
    <div className="health-progress-chart-frame">
      <span className="health-progress-axis-unit">หน่วย: {meta.unit}</span>
      <div className="health-progress-plot">
        <div className="health-progress-y-labels" aria-hidden="true"><span>{formatProgressNumber(Number(chart.yMax.toPrecision(4)))}</span><span>{formatProgressNumber(Number(yMiddle.toPrecision(4)))}</span><span>{formatProgressNumber(Number(chart.yMin.toPrecision(4)))}</span></div>
        <svg className="health-progress-chart" viewBox="0 0 600 240" preserveAspectRatio="none" role="img" aria-labelledby={titleId}>
          <desc>กราฟแสดงเฉพาะค่าที่ได้รับการยืนยันแล้ว อ่านวันที่และค่าทุกจุดได้จากตารางใต้กราฟ</desc>
          {[20, 120, 220].map(y => <line key={y} x1="10" y1={y} x2="590" y2={y} className="health-progress-grid-line" vectorEffect="non-scaling-stroke" />)}
          {chart.line && <polyline points={chart.line} className="health-progress-line" fill="none" vectorEffect="non-scaling-stroke" />}
          {chart.points.map(point => <circle key={point.recordId} cx={point.x} cy={point.y} r="6" className="health-progress-point" vectorEffect="non-scaling-stroke"><title>{meta.label} {formatProgressNumber(point.value)} {meta.unit} · {date(point.recordedAt)}</title></circle>)}
        </svg>
      </div>
      <div className="health-progress-x-labels" aria-hidden="true"><span>{formatThaiDate(chart.firstAt)}</span><span>{formatThaiDate(chart.lastAt)}</span></div>
    </div>
    <p>ช่วงที่ไม่มีจุดไม่ได้หมายถึงค่าศูนย์ เส้นเชื่อมช่วยอ่านลำดับเวลา ไม่ใช่ค่าที่วัดระหว่างจุด</p>
    {metric.hasInvalidSamples && <p className="health-progress-data-note">ข้อมูลบางจุดไม่ครบหรืออ่านไม่ได้ จึงไม่เชื่อมเส้นผ่านข้อมูลที่ขาด และไม่นำจุดนั้นมาเปรียบเทียบ</p>}
    <details className="health-progress-table-details"><summary>ตารางค่าที่แสดงในกราฟ</summary>
      <div className="health-progress-table-wrap"><table><caption>ค่าที่แสดงในกราฟ</caption><thead><tr><th scope="col">วันที่บันทึก (พ.ศ.)</th><th scope="col">{meta.label} ({meta.unit})</th></tr></thead>
        <tbody>{chart.points.map(point => <tr key={point.recordId}><td><time dateTime={point.recordedAt}>{date(point.recordedAt)}</time></td><td>{formatProgressNumber(point.value)} {meta.unit}</td></tr>)}</tbody>
      </table></div>
    </details>
  </div>;
}

export default function HealthProgressPanel({ data }) {
  const normalized = useMemo(() => normalizeHealthProgress(data), [data]);
  const [categoryKey, setCategoryKey] = useState(null);
  const [metricKey, setMetricKey] = useState(null);
  const id = useId();
  if (!normalized) return <section className="health-progress-panel" aria-label="ความเปลี่ยนแปลงสุขภาพ"><h2>ความเปลี่ยนแปลงสุขภาพ</h2><p role="alert" className="health-progress-data-note">ยังแสดงความเปลี่ยนแปลงสุขภาพไม่ได้ เนื่องจากข้อมูลจากระบบไม่ครบหรือยังไม่รองรับ กรุณารีเฟรชหรือติดต่อเจ้าหน้าที่</p></section>;
  const category = HEALTH_PROGRESS_CATEGORIES.find(item => item.type === categoryKey) || initialCategory(normalized);
  const activeMetric = category.metrics.includes(metricKey) ? metricKey : initialMetric(normalized, category);
  const metric = normalized.metrics[activeMetric];
  const counters = [["total", "รายการในช่วงนี้"], ["approved", "ยืนยันแล้ว"], ["pending", "รอตรวจสอบ"], ["rejected", "ยกเลิก / ไม่นำมาเปรียบเทียบ"]];
  if (normalized.summary.unknown) counters.push(["unknown", "ไม่ระบุสถานะ / ไม่นำมาเปรียบเทียบ"]);
  return <section className="health-progress-panel" aria-label="ความเปลี่ยนแปลงสุขภาพ">
    <header className="health-progress-heading"><span className="health-progress-heading-icon" aria-hidden="true"><Activity size={29} /></span><div><h2>ความเปลี่ยนแปลงสุขภาพ</h2><p>เปรียบเทียบค่าที่บันทึกตามเวลา การเพิ่มหรือลดของตัวเลขยังไม่ใช่ข้อสรุปว่าสุขภาพดีขึ้นหรือแย่ลง</p></div></header>
    <dl className="health-progress-counters">{counters.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{normalized.summary[key].toLocaleString("th-TH")} <span>รายการ</span></dd></div>)}</dl>
    <div className="health-progress-period"><CalendarDays size={22} aria-hidden="true" /><div><p>บันทึกแรกในช่วงนี้: {normalized.summary.firstRecordedAt ? date(normalized.summary.firstRecordedAt) : "ยังไม่มีบันทึก"}</p><p>บันทึกล่าสุดในช่วงนี้: {normalized.summary.lastRecordedAt ? date(normalized.summary.lastRecordedAt) : "ยังไม่มีบันทึก"}</p><p>ข้อมูลถึง {date(normalized.range.asOf)} · เวลาไทย</p></div></div>
    <p className="health-progress-policy">กราฟและการเปรียบเทียบใช้เฉพาะรายการที่ยืนยันแล้วและมีค่าที่อ่านได้ รายการรอตรวจสอบ ยกเลิก หรือไม่ระบุสถานะไม่ถูกรวม สถานะเหล่านี้เป็นการตรวจสอบข้อมูล ไม่ใช่ระดับความรุนแรงของสุขภาพ</p>
    <div className="health-progress-categories" role="group" aria-label="เลือกหมวดความเปลี่ยนแปลงสุขภาพ">{HEALTH_PROGRESS_CATEGORIES.map(item => <button key={item.type} type="button" aria-pressed={category.type === item.type} onClick={() => { setCategoryKey(item.type); setMetricKey(initialMetric(normalized, item)); }}>{item.label}</button>)}</div>
    <div className="health-progress-metrics">{category.metrics.map(key => <MetricCard key={key} metricKey={key} metric={normalized.metrics[key]} selected={key === activeMetric} onSelect={() => setMetricKey(key)} />)}</div>
    <div className="health-progress-chart-selector"><label htmlFor={`${id}-metric`}>เลือกค่าที่ต้องการติดตาม</label><select id={`${id}-metric`} value={activeMetric} onChange={event => setMetricKey(event.target.value)}>{category.metrics.map(key => <option value={key} key={key}>{HEALTH_PROGRESS_METRICS[key].label} ({HEALTH_PROGRESS_METRICS[key].unit})</option>)}</select></div>
    <MetricChart metricKey={activeMetric} metric={metric} titleId={`${id}-chart-title`} />
    <p className="health-progress-footnote">วันที่แสดงคือวันที่บันทึกในระบบ ไม่ใช่การยืนยันวันตรวจจริง ค่าครั้งแรกและครั้งก่อนคำนวณจากข้อมูลทั้งช่วงที่เลือก แยก FBS ออกจาก HbA1c และแยก BMI ออกจากคะแนนความเสี่ยงหัวใจและหลอดเลือด 10 ปี</p>
  </section>;
}
