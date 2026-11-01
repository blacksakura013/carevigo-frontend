import { guestProfileLookupFailure, readGuestProfile } from "./guestProfileLookup";

test("only an explicit null profile is a successful no-result response", () => {
  expect(readGuestProfile({ data: { data: null } })).toBeNull();
  const person = { firstName: "สมใจ", lastName: "ทดสอบ" };
  expect(readGuestProfile({ data: { data: person } })).toBe(person);
  for (const data of ["<html>service</html>", {}, { data: undefined }, { data: [] }, { data: false }, { data: { message: "service unavailable" } }])
    expect(() => readGuestProfile({ data })).toThrow(expect.objectContaining({ code: "GUEST_PROFILE_RESPONSE_INVALID" }));
});

test.each([401, 403, 404, 405])("HTTP%s describes an unavailable public service rather than a missing person or login requirement", status => {
  const result = guestProfileLookupFailure({ response: { status, data: { message: "PRIVATE-SERVER-DETAIL" } } });
  expect(result.message).toMatch(/ยังไม่เปิดให้ใช้งาน.*แจ้งเจ้าหน้าที่/);
  expect(result.message).not.toMatch(/ไม่พบข้อมูล|เข้าสู่ระบบ|PRIVATE-SERVER-DETAIL/);
});

test("rate limits and server pauses honor seconds or HTTP-date Retry-After without inventing a delay", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  const limited = guestProfileLookupFailure({ response: { status: 429, headers: { "retry-after": "12" } } }, now);
  expect(limited.message).toMatch(/ถี่เกินไป/); expect(limited.retryAt).toBe(now + 12000);
  expect(guestProfileLookupFailure({ response: { status: 503, headers: { get: () => "Sun, 01 Nov 2026 00:00:20 GMT" } } }, now).retryAt).toBe(now + 20000);
  expect(guestProfileLookupFailure({ response: { status: 429, headers: { "Retry-After": "invalid" } } }, now).retryAt).toBeNull();
  expect(guestProfileLookupFailure({ response: { status: 429 } }, now).retryAt).toBeNull();
});

test("readiness, connectivity and malformed success have distinct safe feedback and cancellation stays silent", () => {
  expect(guestProfileLookupFailure({ code: "API_NOT_READY", requestSent: false }).message).toMatch(/ระบบยังไม่พร้อมค้นหา/);
  expect(guestProfileLookupFailure(new Error("synthetic network")).message).toMatch(/เชื่อมต่อระบบค้นหาไม่สำเร็จ/);
  expect(guestProfileLookupFailure({ code: "GUEST_PROFILE_RESPONSE_INVALID" }).message).toMatch(/กลับมาไม่สมบูรณ์/);
  expect(guestProfileLookupFailure({ code: "ERR_CANCELED" })).toBeNull();
  expect(guestProfileLookupFailure({ name: "AbortError" })).toBeNull();
});
