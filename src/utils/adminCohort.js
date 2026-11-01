import { gregorianDate, todayGregorian } from "./thaiDate";

export const COHORT_DISEASES = {
  diabetes: "เบาหวาน", hypertension: "ความดันโลหิตสูง", heart: "โรคหัวใจ", stroke: "โรคหลอดเลือดสมอง",
  cancer: "มะเร็ง", dyslipidemia: "ไขมันในเลือด", other: "โรคอื่นที่ระบุ", none: "ระบุว่าไม่มีโรคประจำตัว", unknown: "ยังไม่ระบุประวัติโรค",
};
export const COHORT_TYPES = { blood_pressure: "ความดันโลหิต", sugar: "น้ำตาลในเลือด", cholesterol: "ไขมันในเลือด", bmi: "น้ำหนัก / BMI", unknown: "หมวดอื่น" };
export const COHORT_PERIODS = [["day", "วัน"], ["month", "เดือน"], ["3months", "3 เดือน"], ["6months", "6 เดือน"], ["custom", "กำหนดเอง"]];
const count = value => Number.isSafeInteger(value) && value >= 0;
const validInstant = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const validClinicalRecord = record => record && typeof record === "object" && Object.keys(COHORT_TYPES).slice(0, 4).includes(record.type) &&
  validInstant(record.recordedAt) && record.value && typeof record.value === "object" && !Array.isArray(record.value) &&
  Object.values(record.value).every(value => typeof value === "number" && Number.isFinite(value) && value > 0) &&
  ["bmi", "weight", "height"].every(key => record[key] === undefined || (typeof record[key] === "number" && Number.isFinite(record[key]) && record[key] > 0));
const validCounts = value => value && ["total", "approved", "pending", "rejected", "unknown"].every(key => count(value[key])) &&
  value.total === value.approved + value.pending + value.rejected + value.unknown &&
  value.byType && Object.keys(COHORT_TYPES).every(key => count(value.byType[key])) &&
  value.total === Object.keys(COHORT_TYPES).reduce((sum, key) => sum + value.byType[key], 0);

export function validCohortRange(from, to, today = todayGregorian()) {
  return Boolean(gregorianDate(from) && gregorianDate(to) && from <= to && to <= today &&
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 < 366);
}
export function cohortPeriodRange(period, anchor = todayGregorian(), today = todayGregorian()) {
  if (!gregorianDate(anchor) || anchor > today) return null;
  if (period === "day") return { from: anchor, to: anchor };
  const months = { month: 1, "3months": 3, "6months": 6 }[period];
  if (!months) return null;
  const [year, month] = anchor.split("-").map(Number);
  const calendar = (y, m, day) => { const date = new Date(0); date.setUTCFullYear(y, m, day); return date.toISOString().slice(0, 10); };
  const end = calendar(year, month, 0);
  const from = calendar(year, month - months, 1);
  return { from, to: end > today ? today : end };
}
export function initialCohortQuery(search = "", today = todayGregorian()) {
  const params = new URLSearchParams(search);
  const from = params.get("from"), to = params.get("to");
  const range = validCohortRange(from, to, today) ? { from, to } : cohortPeriodRange("month", today, today);
  return { ...range, disease: Object.hasOwn(COHORT_DISEASES, params.get("disease")) ? params.get("disease") : "all",
    search: (params.get("search") || "").trim().slice(0, 100),
    activity: ["recorded", "none"].includes(params.get("activity")) ? params.get("activity") : "all", page: 1, limit: 20 };
}
function reportParams(range, filters = {}) {
  const params = new URLSearchParams(range.from ? { from: range.from, to: range.to } : {});
  if (Object.hasOwn(COHORT_DISEASES, filters.disease)) params.set("disease", filters.disease);
  if (["recorded", "none"].includes(filters.activity)) params.set("activity", filters.activity);
  if (typeof filters.search === "string" && filters.search.trim()) params.set("search", filters.search.trim().slice(0, 100));
  return params;
}
export function cohortReportHref(range, filters) {
  return `/admin?view=reports${String(reportParams(range, filters)) ? `&${reportParams(range, filters)}` : ""}`;
}
export function cohortProgressHref(citizenId, range, filters) {
  return /^\d{13}$/.test(citizenId || "") ? `/admin/progress/${citizenId}?${reportParams(range, filters)}` : null;
}
export function normalizeCohortReport(data, query) {
  if (!data || data.schemaVersion !== 1 || data.range?.timeZone !== "Asia/Bangkok" ||
      !validCohortRange(data.range.from, data.range.to) || !validInstant(data.range.asOf) ||
      !["day", "month"].includes(data.range.bucket) || data.range.from !== query.from || data.range.to !== query.to ||
      data.diseaseScope !== "current-profile-reported" || data.distributionScope !== "search-and-activity-current-profile" ||
      data.recordedAtScope !== "submittedAt-or-createdAt" ||
      ["disease", "search", "activity"].some(key => data.filters?.[key] !== query[key]) ||
      !validCounts(data.summary) || !["cohortPeople", "withRecords", "withoutRecords", "people"].every(key => count(data.summary[key])) ||
      data.summary.cohortPeople !== data.summary.withRecords + data.summary.withoutRecords || data.summary.people > data.summary.cohortPeople ||
      !Array.isArray(data.people) || data.people.length > query.limit || !Array.isArray(data.diseases) || data.diseases.length !== 9 ||
      data.diseases.some(item => !item || typeof item !== "object") || new Set(data.diseases.map(item => item.id)).size !== 9 || data.diseases.some(item => !Object.hasOwn(COHORT_DISEASES, item.id) || !count(item.people)) ||
      !Array.isArray(data.timeline) || data.timeline.length > 366 || data.timeline.some(item => !validCounts(item) || !count(item.people) ||
        !(data.range.bucket === "day" ? gregorianDate(item.date) : /^\d{4}-\d{2}$/.test(item.date) && gregorianDate(`${item.date}-01`))) ||
      data.timeline.reduce((sum, item) => sum + item.total, 0) !== data.summary.total ||
      !count(data.pagination?.total) || data.pagination.total !== data.summary.people || data.pagination.page !== query.page ||
      data.pagination.limit !== query.limit || typeof data.pagination.hasMore !== "boolean" ||
      data.pagination.hasMore !== (query.page * query.limit < data.pagination.total) ||
      data.people.some(person => !person || typeof person !== "object" || !validCounts(person.counts) || !Array.isArray(person.diseaseGroups) || person.diseaseGroups.some(id => !Object.hasOwn(COHORT_DISEASES, id)) ||
        (person.latestApprovedRecords !== undefined && (!Array.isArray(person.latestApprovedRecords) || person.latestApprovedRecords.length > 4 ||
          person.latestApprovedRecords.some(record => !validClinicalRecord(record)) || new Set(person.latestApprovedRecords.map(record => record.type)).size !== person.latestApprovedRecords.length)) ||
        (person.firstRecordedAt !== null && !validInstant(person.firstRecordedAt)) || (person.lastRecordedAt !== null && !validInstant(person.lastRecordedAt)))) return null;
  return data;
}
