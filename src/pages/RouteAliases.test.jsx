import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { adminLogin, getHealthByType, getHealthProgress, getPatientProfile, getSessionSnapshot, initializeSessions, loginPatient, saveAdminSession, savePatientSession } from "../api/api";
import { clearSession } from "../utils/session";
import { HEALTH_PROGRESS_METRICS } from "../utils/healthProgress";

jest.mock("../api/api", () => ({
  ...jest.requireActual("../api/api"),
  adminLogin: jest.fn(), getHealthByType: jest.fn(), getHealthProgress: jest.fn(), getPatientProfile: jest.fn(), initializeSessions: jest.fn(), loginPatient: jest.fn(),
}));
jest.mock("./AdminDashboard", () => function StaffArea() { return <h1>Staff dashboard</h1>; });

const citizenId = "1234567890123";
const patient = { citizenId, firstName: "ผู้ใช้", lastName: "ทดสอบ", requiresPasswordChange: false };
const data = () => ({ patient, session: {
  scope: "patient", sessionId: "route-alias-patient", csrfToken: "route-alias-csrf",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
} });
const staffData = () => ({ admin: { role: "admin", email: "route-staff@example.test" }, session: {
  scope: "admin", sessionId: "route-alias-staff", csrfToken: "route-alias-staff-csrf",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
} });
const progressData = requestedId => ({ schemaVersion: 1,
  patient: { citizenId: requestedId, firstName: requestedId === citizenId ? "สมาชิกของฉัน" : "สมาชิกเป้าหมาย", lastName: "ทดสอบ" },
  range: { from: "2026-10-01", to: "2026-11-01", asOf: "2026-11-01T00:00:00.000Z", timeZone: "Asia/Bangkok" },
  summary: { total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0, byType: {}, firstRecordedAt: null, lastRecordedAt: null },
  metrics: Object.fromEntries(Object.keys(HEALTH_PROGRESS_METRICS).map(key => [key, { total: 0, first: null, previous: null, latest: null, series: [], seriesLimit: 100, hasEarlier: false }])),
  records: [], latestApprovedRecords: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false, reviewStatus: "all" }, currentRisk: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null });
  initializeSessions.mockResolvedValue(undefined);
  getPatientProfile.mockResolvedValue({ data: { data: data() } });
  getHealthByType.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } });
  getHealthProgress.mockImplementation(({ citizenId: requestedId }) => Promise.resolve({ data: { data: progressData(requestedId) } }));
  loginPatient.mockResolvedValue({ data: { data: data() } });
  adminLogin.mockResolvedValue({ data: { data: staffData() } });
});
afterEach(() => { clearSession("patient"); clearSession("admin"); });

test.each(["/HEALTH", "/HeAlTh/"])("anonymous recording alias %s opens the guest entry flow", async route => {
  window.history.replaceState({}, "", route);
  render(<App />);
  expect(await screen.findByRole("heading", { name: "บันทึกสุขภาพ ไม่ต้องเข้าสู่ระบบ" })).toBeVisible();
  expect(window.location.pathname).toBe("/guest");
  expect(getPatientProfile).not.toHaveBeenCalled();
  expect(getHealthByType).not.toHaveBeenCalled();
});

test.each(["/HISTORY/9999999999999", "/HiStOrY/9999999999999/"])("history alias %s keeps the history flow while correcting another person's ID", async route => {
  savePatientSession(data());
  window.history.replaceState({}, "", `${route}?type=sugar#records`);
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe(`/history/${citizenId}`));
  expect(window.location.search).toBe("?type=sugar");
  expect(window.location.hash).toBe("#records");
  await waitFor(() => expect(getHealthByType).toHaveBeenCalled());
  getHealthByType.mock.calls.forEach(([requestedId]) => expect(requestedId).toBe(citizenId));
});

test("patient login from a mixed-case history deep link returns to personal history with its suffix", async () => {
  window.history.replaceState({}, "", "/HiStOrY/9999999999999///?type=sugar#Latest");
  render(<App />);
  await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" });
  fireEvent.change(screen.getByLabelText(/^เลขบัตรประชาชน/), { target: { value: citizenId } });
  fireEvent.change(screen.getByLabelText(/^รหัสผ่าน/), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "เข้าสู่บัญชีของฉัน" }));
  await waitFor(() => expect(window.location.pathname).toBe(`/history/${citizenId}`));
  expect(window.location.search).toBe("?type=sugar"); expect(window.location.hash).toBe("#Latest");
  await waitFor(() => expect(getHealthByType).toHaveBeenCalled());
  getHealthByType.mock.calls.forEach(([requestedId]) => expect(requestedId).toBe(citizenId));
});

test("staff login from a registration alias returns to registration with its original query and fragment", async () => {
  window.history.replaceState({}, "", "/REGISTER///?step=profile#Personal-Details");
  render(<App />);
  await screen.findByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" });
  fireEvent.change(screen.getByLabelText(/^อีเมล/), { target: { value: "route-staff@example.test" } });
  fireEvent.change(screen.getByLabelText(/^รหัสผ่าน/), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
  await screen.findByRole("heading", { name: "สุขภาพที่ดี เริ่มจากรู้จักคุณ" });
  expect(window.location.pathname).toBe("/register");
  expect(window.location.search).toBe("?step=profile"); expect(window.location.hash).toBe("#Personal-Details");
});

test("expiry on a patient history alias hides personal content and keeps the patient login warning", async () => {
  savePatientSession(data());
  window.history.replaceState({}, "", `/HISTORY/${citizenId}/?type=sugar#Latest`);
  render(<App />);
  await screen.findByText("ผู้ใช้ ทดสอบ");
  act(() => clearSession("patient", { expired: true }));
  await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" });
  expect(window.location.pathname).toBe("/login");
  expect(screen.getByText("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง")).toBeVisible();
  expect(screen.queryByText("ผู้ใช้ ทดสอบ")).not.toBeInTheDocument();
});

test("expiry on a staff registration alias keeps the staff login warning and personal session separate", async () => {
  saveAdminSession(staffData()); savePatientSession(data());
  window.history.replaceState({}, "", "/REGISTER///?step=profile#Personal-Details");
  render(<App />);
  await screen.findByRole("heading", { name: "สุขภาพที่ดี เริ่มจากรู้จักคุณ" });
  act(() => clearSession("admin", { expired: true }));
  await screen.findByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" });
  expect(window.location.pathname).toBe("/admin/login");
  expect(screen.getByText("เซสชันหมดอายุ กรุณาเข้าสู่ระบบเพื่อใช้งานต่อ")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "สุขภาพที่ดี เริ่มจากรู้จักคุณ" })).not.toBeInTheDocument();
  expect(getSessionSnapshot("patient").sessionId).toBe("route-alias-patient");
});

test.each(["/PROGRESS/9999999999999", "/PrOgReSs/9999999999999///"])("personal progress alias %s corrects a foreign ID before any progress read", async route => {
  savePatientSession(data());
  window.history.replaceState({}, "", `${route}?days=30#Latest`);
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe(`/progress/${citizenId}`));
  expect(window.location.search).toBe("?days=30"); expect(window.location.hash).toBe("#Latest");
  await screen.findByRole("heading", { name: "สมาชิกของฉัน ทดสอบ" });
  expect(getHealthProgress).toHaveBeenCalled();
  getHealthProgress.mock.calls.forEach(([params, options]) => {
    expect(params.citizenId).toBe(citizenId); expect(options.sessionScope).toBe("patient");
  });
});

test("anonymous progress aliases show personal login without reading any health or account data", async () => {
  window.history.replaceState({}, "", "/PROGRESS/9999999999999///");
  render(<App />);
  await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" });
  expect(window.location.pathname).toBe("/login"); expect(getHealthProgress).not.toHaveBeenCalled();
  expect(getPatientProfile).not.toHaveBeenCalled(); expect(getHealthByType).not.toHaveBeenCalled();
});

test("staff progress uses the selected member and staff workspace with both scopes signed in", async () => {
  savePatientSession(data()); saveAdminSession(staffData());
  window.history.replaceState({}, "", "/ADMIN/PROGRESS/9999999999999/");
  render(<App />);
  await screen.findByRole("heading", { name: "สมาชิกเป้าหมาย ทดสอบ" });
  expect(screen.getByRole("heading", { name: "ติดตามผลสุขภาพสมาชิก" })).toBeVisible();
  expect(screen.getByText("มุมมองเจ้าหน้าที่ · ข้อมูลสมาชิกที่เลือก")).toBeVisible();
  expect(screen.getByRole("link", { name: "กลับแดชบอร์ดเจ้าหน้าที่" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "บัญชีส่วนตัวของฉัน" })).not.toBeInTheDocument();
  expect(getPatientProfile).not.toHaveBeenCalled();
  getHealthProgress.mock.calls.forEach(([params, options]) => {
    expect(params.citizenId).toBe("9999999999999"); expect(options.sessionScope).toBe("admin");
  });
});

test("staff progress expiry hides the member results while the separate personal account remains signed in", async () => {
  savePatientSession(data()); saveAdminSession(staffData());
  window.history.replaceState({}, "", "/ADMIN/PROGRESS/9999999999999///");
  render(<App />);
  await screen.findByRole("heading", { name: "สมาชิกเป้าหมาย ทดสอบ" });
  act(() => clearSession("admin", { expired: true }));
  await screen.findByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" });
  expect(window.location.pathname).toBe("/admin/login");
  expect(screen.queryByRole("heading", { name: "สมาชิกเป้าหมาย ทดสอบ" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "ความเปลี่ยนแปลงสุขภาพ" })).not.toBeInTheDocument();
  expect(getSessionSnapshot("patient").sessionId).toBe("route-alias-patient");
});
