export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const BE_OFFSET = 543;

export function validDateParts(year, month, day) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function isoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function gregorianDate(value) {
  const text = String(value || "");
  if (!/^\d{8}$|^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const match = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
  if (!match || !validDateParts(Number(match[1]), Number(match[2]), Number(match[3]))) return "";
  return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}
export function todayGregorian(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", calendar: "gregory", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function currentBuddhistYear(now = new Date()) { return Number(todayGregorian(now).slice(0, 4)) + BE_OFFSET; }
export function buddhistInputToGregorian(value) {
  const text = String(value || "").trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4,5})$/.exec(text) || /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  if (!match) return "";
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]) - BE_OFFSET;
  return validDateParts(year, month, day) ? isoDate(year, month, day) : "";
}
export function gregorianToBuddhistInput(value) {
  const iso = gregorianDate(value);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${Number(iso.slice(0, 4)) + BE_OFFSET}` : "";
}
export function formatThaiDate(value, { withTime = false, empty = "—", ...options } = {}) {
  if (value === null || value === undefined || value === "") return empty;
  const text = typeof value === "string" ? value : "";
  const dateOnly = /^\d{8}$|^\d{4}-\d{2}-\d{2}$/.test(text);
  const iso = dateOnly ? gregorianDate(text) : null;
  if (dateOnly && !iso) return empty;
  const date = new Date(iso ? `${iso}T00:00:00.000Z` : value);
  if (!Number.isFinite(date.getTime())) return empty;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", calendar: "buddhist", day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), ...options }).format(date);
}
