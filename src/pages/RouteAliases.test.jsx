import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { adminLogin, getHealthByType, getPatientProfile, getSessionSnapshot, initializeSessions, loginPatient, saveAdminSession, savePatientSession } from "../api/api";
import { clearSession } from "../utils/session";

jest.mock("../api/api", () => ({
  ...jest.requireActual("../api/api"),
  adminLogin: jest.fn(), getHealthByType: jest.fn(), getPatientProfile: jest.fn(), initializeSessions: jest.fn(), loginPatient: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null });
  initializeSessions.mockResolvedValue(undefined);
  getPatientProfile.mockResolvedValue({ data: { data: data() } });
  getHealthByType.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } });
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
