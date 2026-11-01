import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import API, {
  adminLogin, getApiError, getSessionSnapshot, invalidateApiReadiness, loginPatient, patientLogout,
  restoreSession, saveAdminSession, savePatientSession, submitGuestHealth, waitForApiReadiness,
} from "./api";
import { clearSession } from "../utils/session";
import { hasLogoutIntent } from "../utils/storage";
import GuestHealth from "../pages/GuestHealth";
import AdminForgotPassword from "../pages/AdminForgotPassword";
import AdminResetPassword from "../pages/AdminResetPassword";
import EmailReview from "../pages/EmailReview";

const originalAdapter = API.defaults.adapter, originalFetch = global.fetch;
const session = (scope, id) => ({ [scope]: scope === "admin" ? { role: "admin", email: "staff@example.test" } : { citizenId: "1234567890123" },
  session: { scope, sessionId: id, csrfToken: `csrf-${id}`, expiresAt: new Date(Date.now() + 600000).toISOString() } });
const ok = (config, data = {}) => ({ status: 200, headers: {}, config, data: { data } });
const healthResponse = (status = 200) => ({ status, text: async () => JSON.stringify({ status: "OK", mongodb: "CONNECTED" }), headers: { get: () => null } });
const body = config => typeof config.data === "string" ? JSON.parse(config.data) : config.data;
const settle = promise => promise.then(value => ({ value }), error => ({ error }));
const releases = [];
function holdHealth() {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const waiting = new Promise(resolve => { release = () => resolve(healthResponse()); });
  global.fetch.mockImplementationOnce(() => { started(); return waiting; });
  releases.push(release);
  return { ready, release };
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null });
  global.fetch = jest.fn().mockResolvedValue(healthResponse());
  API.defaults.adapter = jest.fn(async config => ok(config));
  invalidateApiReadiness();
});
afterEach(async () => {
  cleanup(); releases.splice(0).forEach(release => release());
  await waitForApiReadiness().catch(() => {});
  API.defaults.adapter = originalAdapter; global.fetch = originalFetch;
  clearSession("patient"); clearSession("admin"); jest.useRealTimers();
});

test("simultaneous account requests share an anonymous health check before dispatching their captured scope", async () => {
  saveAdminSession(session("admin", "staff-a")); savePatientSession(session("patient", "person-a"));
  const health = holdHealth();
  const staff = API.get("/dashboard/summary"), patient = API.patch("/auth/patient/me", { firstName: "เปลี่ยนชื่อ" });
  await health.ready;
  expect(global.fetch).toHaveBeenCalledTimes(1); expect(API.defaults.adapter).not.toHaveBeenCalled();
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toMatch(/\/health$/); expect(options).toMatchObject({ method: "GET", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
  expect(options.headers).toBeUndefined(); expect(options.signal).toBeDefined();
  health.release(); await Promise.all([staff, patient]);
  const [staffConfig, patientConfig] = API.defaults.adapter.mock.calls.map(([config]) => config);
  expect(staffConfig.headers["X-Carevigo-Session-Id"]).toBe("staff-a");
  expect(patientConfig.headers["X-Carevigo-Session-Id"]).toBe("person-a");
  expect(patientConfig.headers["X-CSRF-Token"]).toBe("csrf-person-a");
  expect(patientConfig.timeout).toBe(20000);
});

test("a replacement account cannot inherit an old form's mutation while health is pending", async () => {
  savePatientSession(session("patient", "person-a")); const health = holdHealth();
  const outcome = settle(API.patch("/auth/patient/me", { firstName: "ของบัญชีเดิม" }));
  await health.ready; savePatientSession(session("patient", "person-b")); health.release();
  expect((await outcome).error.code).toBe("ERR_CANCELED");
  expect(API.defaults.adapter).not.toHaveBeenCalled();
  expect(getSessionSnapshot("patient").sessionId).toBe("person-b");
});

test("a superseded bootstrap is canceled before dispatch and only the newest verification may restore identity", async () => {
  API.defaults.adapter = jest.fn(async config => ok(config, session("patient", "fresh-person")));
  const health = holdHealth(), first = restoreSession("patient", { force: true });
  await health.ready;
  const second = restoreSession("patient", { force: true });
  health.release(); await Promise.all([first, second]);
  expect(API.defaults.adapter).toHaveBeenCalledTimes(1);
  expect(getSessionSnapshot("patient").sessionId).toBe("fresh-person");
});

test.each([["patient", loginPatient], ["admin", adminLogin]])("leaving a %s login during readiness never sends credentials or revokes an existing account", async (scope, login) => {
  (scope === "patient" ? savePatientSession : saveAdminSession)(session(scope, "previous-account"));
  let current = true; const health = holdHealth();
  const outcome = settle(login(scope === "patient" ? "1234567890123" : "staff@example.test", "synthetic-password", { isCurrent: () => current }));
  await health.ready; current = false; health.release();
  expect((await outcome).error.code).toBe("ERR_CANCELED");
  expect(API.defaults.adapter).not.toHaveBeenCalled();
  expect(getSessionSnapshot(scope).sessionId).toBe("previous-account");
  expect(hasLogoutIntent(scope)).toBe(false);
});

test("logout queued during a warming login still revokes only its pinned session without dispatching the canceled login", async () => {
  savePatientSession(session("patient", "previous-account")); saveAdminSession(session("admin", "staff-kept"));
  const health = holdHealth(), login = settle(loginPatient("1234567890123", "synthetic-password"));
  await health.ready; const logout = patientLogout();
  expect(getSessionSnapshot("patient").logoutPending).toBe(true);
  health.release(); expect((await login).error.code).toBe("ERR_CANCELED"); await logout;
  expect(API.defaults.adapter).toHaveBeenCalledTimes(1);
  const config = API.defaults.adapter.mock.calls[0][0];
  expect(config.url).toBe("/auth/logout"); expect(config.headers["X-Carevigo-Session-Id"]).toBe("previous-account");
  expect(config.headers["X-CSRF-Token"]).toBe("csrf-previous-account");
  expect(getSessionSnapshot("admin").sessionId).toBe("staff-kept"); expect(hasLogoutIntent("patient")).toBe(false);
});

test("canceling one readiness waiter does not abort another account's shared health request", async () => {
  saveAdminSession(session("admin", "staff")); savePatientSession(session("patient", "person"));
  const controller = new AbortController(), health = holdHealth();
  const canceled = settle(API.get("/dashboard/summary", { signal: controller.signal }));
  const kept = API.get("/auth/patient/me");
  await health.ready; controller.abort();
  expect((await canceled).error.code).toBe("ERR_CANCELED");
  expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(false);
  health.release(); await kept;
  expect(global.fetch).toHaveBeenCalledTimes(1); expect(API.defaults.adapter).toHaveBeenCalledTimes(1);
  expect(API.defaults.adapter.mock.calls[0][0].url).toBe("/auth/patient/me");
});

test("a 22-second wake-up uses the readiness budget while the one mutation keeps its separate 20-second timeout", async () => {
  jest.useFakeTimers(); const health = holdHealth();
  const request = submitGuestHealth({ clientRequestId: "same-id", records: [] });
  await health.ready; jest.advanceTimersByTime(22000);
  expect(API.defaults.adapter).not.toHaveBeenCalled();
  health.release(); await request;
  expect(API.defaults.adapter).toHaveBeenCalledTimes(1); expect(API.defaults.adapter.mock.calls[0][0].timeout).toBe(20000);
});

test("readiness failure sends no guest mutation and an explicit retry preserves its idempotency key", async () => {
  global.fetch.mockResolvedValueOnce(healthResponse(404));
  const payload = { clientRequestId: "fixed-request-id", records: [] };
  const failed = await settle(submitGuestHealth(payload));
  expect(failed.error).toMatchObject({ code: "API_NOT_READY", requestSent: false });
  expect(getApiError(failed.error)).toContain("ข้อมูลที่กรอกยังไม่ถูกส่ง");
  expect(API.defaults.adapter).not.toHaveBeenCalled();
  await submitGuestHealth(payload);
  expect(global.fetch).toHaveBeenCalledTimes(2); expect(API.defaults.adapter).toHaveBeenCalledTimes(1);
  expect(body(API.defaults.adapter.mock.calls[0][0])).toEqual(payload);
});

test("an upstream mutation failure invalidates only the next readiness check and is never replayed automatically", async () => {
  API.defaults.adapter = jest.fn(async config => Promise.reject({ config, response: { status: 503, data: {} } }));
  await expect(submitGuestHealth({ clientRequestId: "same-id", records: [] })).rejects.toBeDefined();
  expect(API.defaults.adapter).toHaveBeenCalledTimes(1); expect(global.fetch).toHaveBeenCalledTimes(1);
  API.defaults.adapter.mockImplementation(async config => ok(config));
  await submitGuestHealth({ clientRequestId: "same-id", records: [] });
  expect(API.defaults.adapter).toHaveBeenCalledTimes(2); expect(global.fetch).toHaveBeenCalledTimes(2);
});

function fillGuest() {
  for (const [label, value] of [[/^เลขบัตรประชาชน/, "1234567890123"], [/^ชื่อ/, "สมใจ"], [/^นามสกุล/, "ทดสอบ"]])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  for (let step = 0; step < 2; step++) fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
  const categories = screen.getAllByRole("checkbox", { name: /^บันทึก/ });
  expect(categories).toHaveLength(4);
  categories.forEach(category => expect(category).not.toBeChecked());
  fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ }));
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
}
test("leaving a guest form during health wait prevents its queued POST and persists no personal data", async () => {
  Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto, configurable: true });
  const health = holdHealth();
  const page = render(<MemoryRouter><GuestHealth /></MemoryRouter>); fillGuest();
  await health.ready; page.unmount(); await act(async () => { health.release(); await waitForApiReadiness(); });
  expect(API.defaults.adapter).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("leaving forgot-password during health wait sends no queued email request", async () => {
  const health = holdHealth(), page = render(<MemoryRouter><AdminForgotPassword /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/อีเมลบัญชีเจ้าหน้าที่/), { target: { value: "staff@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "ส่งลิงก์ตั้งรหัสผ่านใหม่" }));
  await health.ready; page.unmount(); await act(async () => { health.release(); await waitForApiReadiness(); });
  expect(API.defaults.adapter).not.toHaveBeenCalled();
});

const tokenA = "A".repeat(43), tokenB = "B".repeat(43);
function ResetPage() {
  const navigate = useNavigate();
  return <><AdminResetPassword /><button onClick={() => navigate(`/admin/reset-password#token=${tokenB}`)}>เปิดลิงก์ใหม่</button></>;
}
test("opening another reset link while warming cannot dispatch the old token's queued password change", async () => {
  API.defaults.adapter = jest.fn(async config => ok(config, config.url.endsWith("/validate") ? { valid: true } : {}));
  render(<MemoryRouter initialEntries={[`/admin/reset-password#token=${tokenA}`]}><ResetPage /></MemoryRouter>);
  await screen.findByLabelText(/^รหัสผ่านใหม่/);
  invalidateApiReadiness(); const health = holdHealth();
  fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), { target: { value: "old-link-password" } });
  fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), { target: { value: "old-link-password" } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }));
  await health.ready; fireEvent.click(screen.getByRole("button", { name: "เปิดลิงก์ใหม่" }));
  await act(async () => { health.release(); await waitForApiReadiness(); });
  expect(await screen.findByLabelText(/^รหัสผ่านใหม่/)).toHaveValue("");
  expect(API.defaults.adapter.mock.calls.filter(([config]) => config.url === "/auth/reset-password")).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), { target: { value: "new-link-password" } });
  fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), { target: { value: "new-link-password" } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }));
  await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/);
  const writes = API.defaults.adapter.mock.calls.filter(([config]) => config.url === "/auth/reset-password");
  expect(writes).toHaveLength(1); expect(body(writes[0][0]).token).toBe(tokenB);
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("leaving an email confirmation during health wait prevents the queued decision POST", async () => {
  API.defaults.adapter = jest.fn(async config => ok(config, { canDecide: true, records: [{ _id: "pending", type: "sugar", value: { fbs: 95 }, reviewStatus: "pending" }] }));
  const page = render(<MemoryRouter initialEntries={["/review-email?token=synthetic-token&action=approve"]}><EmailReview /></MemoryRouter>);
  await screen.findByRole("button", { name: "ยืนยันการรับรอง" });
  invalidateApiReadiness(); const health = holdHealth();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันการรับรอง" }));
  await health.ready; page.unmount(); await act(async () => { health.release(); await waitForApiReadiness(); });
  expect(API.defaults.adapter.mock.calls.filter(([config]) => config.method === "post")).toHaveLength(0);
});
