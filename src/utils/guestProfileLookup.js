const PERSONAL_FIELDS = ["firstName", "lastName", "gender", "birthDate", "phone"];

export function readGuestProfile(response) {
  const body = response?.data;
  if (body && typeof body === "object" && !Array.isArray(body) && Object.prototype.hasOwnProperty.call(body, "data")) {
    if (body.data === null) return null;
    if (body.data && typeof body.data === "object" && !Array.isArray(body.data) && PERSONAL_FIELDS.some(field => typeof body.data[field] === "string"))
      return body.data;
  }
  const error = new Error("Unexpected guest profile response");
  error.code = "GUEST_PROFILE_RESPONSE_INVALID";
  throw error;
}

function retryDeadline(error, now) {
  const headers = error?.response?.headers;
  const value = headers?.get?.("retry-after") ?? headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const text = String(value).trim();
  const timestamp = /^\d+(?:\.\d+)?$/.test(text) ? now + Number(text) * 1000 : Date.parse(text);
  return Number.isFinite(timestamp) ? Math.max(now, timestamp) : null;
}

export function guestProfileLookupFailure(error, now = Date.now()) {
  if (error?.code === "ERR_CANCELED" || error?.name === "AbortError") return null;
  const status = error?.response?.status;
  let message;
  if ([401, 403, 404, 405].includes(status))
    message = "ระบบค้นหาข้อมูลยังไม่เปิดให้ใช้งาน กรุณาแจ้งเจ้าหน้าที่ หรือลองใหม่ภายหลัง คุณสามารถกรอกข้อมูลเองต่อได้";
  else if (status === 429)
    message = "ค้นหาข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ คุณสามารถกรอกข้อมูลเองต่อได้";
  else if (error?.code === "API_NOT_READY" || status >= 500)
    message = "ระบบยังไม่พร้อมค้นหาข้อมูล กรุณารอสักครู่แล้วลองอีกครั้ง คุณสามารถกรอกข้อมูลเองต่อได้";
  else if (error?.code === "GUEST_PROFILE_RESPONSE_INVALID")
    message = "ระบบส่งข้อมูลค้นหากลับมาไม่สมบูรณ์ กรุณาลองใหม่ หรือกรอกข้อมูลเองต่อได้";
  else if (status === 400)
    message = "ระบบยังค้นหาเลขบัตรนี้ไม่ได้ กรุณาตรวจสอบเลขบัตรประชาชนแล้วลองใหม่ หรือกรอกข้อมูลเองต่อได้";
  else
    message = "เชื่อมต่อระบบค้นหาไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อหรือลองใหม่ คุณสามารถกรอกข้อมูลเองต่อได้";
  return { message, retryAt: status === 429 || status >= 500 ? retryDeadline(error, now) : null };
}
