import { gregorianDate } from "./thaiDate";

export const HEALTH_PROGRESS_METRICS = {
  systolic: { label: "ความดันตัวบน", unit: "mmHg", category: "blood_pressure" },
  diastolic: { label: "ความดันตัวล่าง", unit: "mmHg", category: "blood_pressure" },
  pulse: { label: "ชีพจร", unit: "ครั้ง/นาที", category: "blood_pressure" },
  fbs: { label: "น้ำตาลขณะอดอาหาร (FBS)", unit: "mg/dL", category: "sugar" },
  hba1c: { label: "น้ำตาลสะสม (HbA1c)", unit: "%", category: "sugar" },
  total: { label: "คอเลสเตอรอลรวม", unit: "mg/dL", category: "cholesterol" },
  ldl: { label: "LDL", unit: "mg/dL", category: "cholesterol" },
  hdl: { label: "HDL", unit: "mg/dL", category: "cholesterol" },
  triglyceride: { label: "ไตรกลีเซอไรด์", unit: "mg/dL", category: "cholesterol" },
  weight: { label: "น้ำหนัก", unit: "กก.", category: "bmi" },
  height: { label: "ส่วนสูง", unit: "ซม.", category: "bmi" },
  bmi: { label: "BMI", unit: "กก./ม²", category: "bmi" },
};

export const HEALTH_PROGRESS_CATEGORIES = [
  { type: "blood_pressure", label: "ความดันโลหิต", metrics: ["systolic", "diastolic", "pulse"] },
  { type: "sugar", label: "น้ำตาลในเลือด", metrics: ["fbs", "hba1c"] },
  { type: "cholesterol", label: "ไขมันในเลือด", metrics: ["total", "ldl", "hdl", "triglyceride"] },
  { type: "bmi", label: "น้ำหนักและ BMI", metrics: ["weight", "height", "bmi"] },
];

const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const count = value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;

function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  if (!gregorianDate(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function sample(value) {
  if (!object(value) || !positive(value.value) || timestamp(value.recordedAt) === null ||
      typeof value.recordId !== "string" || !value.recordId.trim() ||
      (value.reviewStatus !== undefined && value.reviewStatus !== "approved")) return null;
  return { value: value.value, recordedAt: value.recordedAt, recordId: value.recordId };
}

function normalizeMetric(raw) {
  if (!object(raw)) return { total: 0, first: null, previous: null, latest: null, series: [], seriesLimit: 100, hasEarlier: false, hasInvalidSamples: true };
  let hasInvalidSamples = raw.hasInvalidSamples === true || !count(raw.total) || !Array.isArray(raw.series);
  const total = count(raw.total) ? raw.total : 0;
  const read = value => {
    if (value === null || value === undefined) return null;
    const result = sample(value);
    if (!result) hasInvalidSamples = true;
    return result;
  };
  const latest = read(raw.latest);
  let first = read(raw.first), previous = read(raw.previous);
  if (previous && latest && (previous.recordId === latest.recordId || timestamp(previous.recordedAt) > timestamp(latest.recordedAt))) {
    previous = null;
    hasInvalidSamples = true;
  }
  if (first && latest && timestamp(first.recordedAt) > timestamp(latest.recordedAt)) {
    first = null;
    hasInvalidSamples = true;
  }
  const seen = new Set();
  const series = [];
  for (const item of Array.isArray(raw.series) ? raw.series : []) {
    const point = read(item);
    if (!point) { hasInvalidSamples = true; continue; }
    if (seen.has(point.recordId)) { hasInvalidSamples = true; continue; }
    seen.add(point.recordId);
    series.push(point);
  }
  series.sort((a, b) => timestamp(a.recordedAt) - timestamp(b.recordedAt) || a.recordId.localeCompare(b.recordId));
  const seriesLimit = count(raw.seriesLimit) && raw.seriesLimit > 0 && raw.seriesLimit <= 100 ? raw.seriesLimit : 100;
  if (series.length > seriesLimit || total < series.length || (total > 0 && !latest) || (total === 0 && (latest || first || previous || series.length))) hasInvalidSamples = true;
  return { total, first, previous, latest, series: series.slice(-seriesLimit), seriesLimit,
    hasEarlier: raw.hasEarlier === true || total > seriesLimit, hasInvalidSamples };
}

// Capability validation is deliberate: an older API or an error body is not an empty history.
// Per-metric values never coerce strings, booleans, missing values, or zero into measurements.
export function normalizeHealthProgress(data) {
  if (!object(data) || data.schemaVersion !== 1 || !object(data.patient) ||
      typeof data.patient.citizenId !== "string" || !/^\d{13}$/.test(data.patient.citizenId) || !object(data.range) ||
      data.range.timeZone !== "Asia/Bangkok" || timestamp(data.range.asOf) === null ||
      !object(data.summary) || !["total", "approved", "pending", "rejected", "unknown"].every(key => count(data.summary[key])) ||
      !object(data.metrics) || !Object.keys(HEALTH_PROGRESS_METRICS).every(key => object(data.metrics[key]) && count(data.metrics[key].total) && Array.isArray(data.metrics[key].series)) ||
      data.summary.approved + data.summary.pending + data.summary.rejected + data.summary.unknown !== data.summary.total ||
      (data.range.from !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(data.range.from || "") || !gregorianDate(data.range.from))) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.range.to || "") || !gregorianDate(data.range.to) ||
      (data.range.from !== null && data.range.from > data.range.to) ||
      !Array.isArray(data.records) || !Array.isArray(data.latestApprovedRecords) || !object(data.pagination) ||
      !count(data.pagination.page) || data.pagination.page < 1 || !count(data.pagination.limit) || data.pagination.limit < 1 || data.pagination.limit > 50 ||
      !count(data.pagination.total) || typeof data.pagination.hasMore !== "boolean" ||
      !["all", "approved", "pending", "rejected"].includes(data.pagination.reviewStatus)) return null;
  const metrics = Object.fromEntries(Object.keys(HEALTH_PROGRESS_METRICS).map(key => [key, normalizeMetric(data.metrics[key])]));
  const text = key => typeof data.patient[key] === "string" ? data.patient[key] : "";
  return {
    schemaVersion: 1,
    patient: { citizenId: data.patient.citizenId, firstName: text("firstName"), lastName: text("lastName"), birthDate: text("birthDate"), gender: text("gender") },
    range: { from: data.range.from || null, to: data.range.to || null, asOf: data.range.asOf, timeZone: "Asia/Bangkok" },
    summary: { ...Object.fromEntries(["total", "approved", "pending", "rejected", "unknown"].map(key => [key, data.summary[key]])),
      byType: object(data.summary.byType) ? Object.fromEntries(Object.entries(data.summary.byType).filter(([, value]) => count(value))) : {},
      firstRecordedAt: timestamp(data.summary.firstRecordedAt) !== null ? data.summary.firstRecordedAt : null,
      lastRecordedAt: timestamp(data.summary.lastRecordedAt) !== null ? data.summary.lastRecordedAt : null },
    metrics,
    records: data.records,
    latestApprovedRecords: data.latestApprovedRecords,
    pagination: { page: data.pagination.page, limit: data.pagination.limit, total: data.pagination.total, hasMore: data.pagination.hasMore, reviewStatus: data.pagination.reviewStatus },
    currentRisk: object(data.currentRisk) ? data.currentRisk : null,
  };
}

export function formatProgressNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const formatted = value.toLocaleString("th-TH", { maximumFractionDigits: 12 });
  return value !== 0 && Number(formatted.replace(/,/g, "")) === 0 ? String(value) : formatted;
}

export function buildMetricComparison(metric) {
  const latest = sample(metric?.latest), previous = sample(metric?.previous), first = sample(metric?.first);
  if (!latest || !previous || previous.recordId === latest.recordId || timestamp(previous.recordedAt) > timestamp(latest.recordedAt))
    return { latest, previous: null, first, delta: null, direction: null, label: "ยังไม่มีค่าครั้งก่อนสำหรับเปรียบเทียบ" };
  const delta = Number((latest.value - previous.value).toPrecision(12));
  return { latest, previous, first, delta, direction: delta > 0 ? "increase" : delta < 0 ? "decrease" : "same",
    label: delta > 0 ? "เพิ่มขึ้น" : delta < 0 ? "ลดลง" : "เท่าเดิม" };
}

// A point's horizontal position represents elapsed time, never its array index.
// Invalid samples break the line entirely rather than implying values across unreadable data.
export function buildProgressChart(metric) {
  const series = (Array.isArray(metric?.series) ? metric.series : []).map(sample).filter(Boolean)
    .sort((a, b) => timestamp(a.recordedAt) - timestamp(b.recordedAt) || a.recordId.localeCompare(b.recordId));
  if (!series.length) return null;
  const times = series.map(point => timestamp(point.recordedAt));
  const values = series.map(point => point.value);
  const min = Math.min(...values), max = Math.max(...values);
  const padding = max === min ? Math.max(max * 0.1, 0.1) : (max - min) * 0.1;
  const yMin = Math.max(0, min - padding), yMax = Math.min(Number.MAX_VALUE, max + padding);
  const duration = times[times.length - 1] - times[0];
  const points = series.map((point, index) => ({ ...point,
    x: duration === 0 ? 300 : 20 + ((times[index] - times[0]) / duration) * 560,
    y: 220 - ((point.value - yMin) / (yMax - yMin)) * 200 }));
  return { points, line: metric?.hasInvalidSamples || points.length < 2 ? "" : points.map(point => `${point.x},${point.y}`).join(" "),
    yMin, yMax, firstAt: series[0].recordedAt, lastAt: series[series.length - 1].recordedAt };
}
