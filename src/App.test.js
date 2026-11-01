import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import {
  clearAdminSession,
  clearPatientSession,
  initializeSessions,
  restoreSession,
  saveAdminSession,
  requestAdminPasswordReset,
  validateAdminPasswordReset,
  resetAdminPassword,
} from "./api/api";
import { beginSessionLoad, clearSession, failSessionLoad } from "./utils/session";
import { notifyPasswordChanged } from "./utils/flowFeedback";

jest.mock("./api/api", () => ({
  ...jest.requireActual("./api/api"),
  initializeSessions: jest.fn(),
  restoreSession: jest.fn(),
  requestAdminPasswordReset: jest.fn(),
  validateAdminPasswordReset: jest.fn(),
  resetAdminPassword: jest.fn(),
}));
jest.mock("./pages/AdminDashboard", () => function StaffArea() {
  return <h1>Staff private area</h1>;
});

const staffSession = (expiresAt = Date.now() + 60000) => ({
  admin: { id: "staff-1", email: "staff@example.test", role: "admin" },
  session: { scope: "admin", sessionId: "staff-session", csrfToken: "staff-csrf", expiresAt: new Date(expiresAt).toISOString() },
});

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  clearSession("patient", { endedBy: null });
  clearSession("admin", { endedBy: null });
  initializeSessions.mockResolvedValue(undefined);
  requestAdminPasswordReset.mockResolvedValue({ status: 202 });
  validateAdminPasswordReset.mockResolvedValue({ data: { data: { valid: true } } });
  resetAdminPassword.mockResolvedValue({ status: 200 });
  restoreSession.mockImplementation(async (scope) => {
    if (scope === "admin") clearAdminSession();
    else clearPatientSession();
  });
  window.scrollTo = jest.fn();
});
afterEach(() => { jest.useRealTimers(); });

test("protects staff pages and provides a way back to patient care", () => {
  window.history.replaceState({}, "", "/admin");
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /กลับสู่หน้าผู้รับบริการ/ }),
  ).toHaveAttribute("href", "/");
  expect(screen.getByLabelText("อีเมล", { exact: false })).toHaveAttribute(
    "type",
    "email",
  );
});

test("staff recovery remains accessible when cookie bootstrap is unavailable", () => {
  failSessionLoad("admin", new Error("offline"));
  failSessionLoad("patient", new Error("offline"));
  window.history.replaceState({}, "", "/admin/forgot-password");
  render(<App />);
  expect(screen.getByRole("heading", { name: "ลืมรหัสผ่านเจ้าหน้าที่" })).toBeInTheDocument();
  expect(screen.getByLabelText(/อีเมลบัญชีเจ้าหน้าที่/)).toBeEnabled();
  expect(screen.queryByText(/ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ/)).not.toBeInTheDocument();
});

test("the reset link survives session revalidation and revoked staff sessions do not interrupt reset success", async () => {
  const token = "A".repeat(43);
  saveAdminSession(staffSession());
  window.history.replaceState({}, "", `/admin/reset-password#token=${token}`);
  render(<App />);
  const password = await screen.findByLabelText(/^รหัสผ่านใหม่/);
  expect(validateAdminPasswordReset).toHaveBeenCalledWith(token);
  expect(window.location.hash).toBe("");
  fireEvent.change(password, { target: { value: "new-password-123" } });
  await act(async () => { beginSessionLoad("admin"); });
  expect(screen.getByLabelText(/^รหัสผ่านใหม่/)).toHaveValue("new-password-123");
  await act(async () => { saveAdminSession(staffSession()); });
  resetAdminPassword.mockImplementation(async () => {
    clearSession("admin", { expired: true });
    return { status: 200 };
  });
  fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), { target: { value: "new-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: /บันทึกรหัสผ่านใหม่/ }));
  expect(await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/)).toBeInTheDocument();
  expect(window.location.pathname).toBe("/admin/reset-password");
  expect(resetAdminPassword).toHaveBeenCalledWith(token, "new-password-123", "new-password-123");
  expect(screen.queryByLabelText(/^รหัสผ่านใหม่/)).not.toBeInTheDocument();
});

test.each([
  ["/admin/reset-password/", "expired"],
  ["/admin/RESET-PASSWORD", "logout"],
  ["/admin/forgot-password/", "expired"],
  ["/admin/FORGOT-PASSWORD", "logout"],
])("public recovery at %s preserves the current form after staff %s", async (pathname, reason) => {
  saveAdminSession(staffSession());
  const reset = pathname.toLowerCase().includes("reset-password");
  window.history.replaceState({}, "", `${pathname}${reset ? `#token=${"A".repeat(43)}` : ""}`);
  render(<App />);
  const field = await screen.findByLabelText(reset ? /^รหัสผ่านใหม่/ : /อีเมลบัญชีเจ้าหน้าที่/);
  const value = reset ? "draft-password-123" : "staff@example.test";
  fireEvent.change(field, { target: { value } });
  await act(async () => { clearSession("admin", { [reason]: true }); });
  expect(window.location.pathname).toBe(pathname);
  expect(screen.getByLabelText(reset ? /^รหัสผ่านใหม่/ : /อีเมลบัญชีเจ้าหน้าที่/)).toHaveValue(value);
  expect(screen.queryByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" })).not.toBeInTheDocument();
});

test("removes private staff content when the cookie session expires", async () => {
  jest.useFakeTimers();
  saveAdminSession(staffSession(Date.now() + 1000));
  window.history.replaceState({}, "", "/admin");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Staff private area" })).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(1001); });
  expect(
    screen.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Staff private area" })).not.toBeInTheDocument();
  expect(screen.getByText(/เซสชันหมดอายุ/)).toBeInTheDocument();
  expect(localStorage.getItem("adminAccessToken")).toBeNull();
  expect(localStorage.getItem("adminProfile")).toBeNull();
});

test("waits for cookie bootstrap and offers retry after an unavailable server", async () => {
  let finishBootstrap;
  beginSessionLoad("admin");
  initializeSessions.mockImplementationOnce(() => new Promise((resolve) => {
    finishBootstrap = () => { failSessionLoad("admin", new Error("offline")); resolve(); };
  }));
  window.history.replaceState({}, "", "/admin");
  render(<App />);
  expect(screen.getByRole("status")).toHaveTextContent(/กำลังตรวจสอบการเข้าสู่ระบบ/);
  expect(screen.queryByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Staff private area" })).not.toBeInTheDocument();
  await act(async () => { finishBootstrap(); });
  expect(screen.getByRole("alert")).toHaveTextContent(/ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ/);
  fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
  expect(restoreSession).toHaveBeenCalledWith("admin", { force: true });
  expect(await screen.findByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" })).toBeInTheDocument();
});

test("one login recovery retries both failed session checks and waits for both before showing the form", async () => {
  failSessionLoad("admin", new Error("offline"));
  failSessionLoad("patient", new Error("offline"));
  const finish = {};
  restoreSession.mockImplementation((scope) => {
    beginSessionLoad(scope);
    return new Promise((resolve) => {
      finish[scope] = () => { clearSession(scope); resolve(); };
    });
  });
  window.history.replaceState({}, "", "/login");
  render(<App />);
  expect(screen.getByRole("alert")).toHaveTextContent(/ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ/);
  expect(screen.queryByLabelText(/เลขบัตรประชาชน/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
  expect(restoreSession.mock.calls).toEqual([["admin", { force: true }], ["patient", { force: true }]]);
  expect(screen.getByRole("status")).toHaveTextContent(/กำลังตรวจสอบการเข้าสู่ระบบ/);
  await act(async () => { finish.admin(); });
  expect(screen.queryByLabelText(/เลขบัตรประชาชน/)).not.toBeInTheDocument();
  await act(async () => { finish.patient(); });
  expect(await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" })).toBeInTheDocument();
  expect(restoreSession).toHaveBeenCalledTimes(2);
});

test("staff password feedback follows the confirmed rotated session and clears on account change", async () => {
  saveAdminSession(staffSession());
  window.history.replaceState({}, "", "/admin");
  render(<App />);
  await act(async () => {
    const rotated = staffSession();
    rotated.session.sessionId = "staff-rotated";
    saveAdminSession(rotated);
    notifyPasswordChanged("admin");
  });
  expect(screen.getByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Staff private area" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ปิดข้อความ" }));
  expect(screen.queryByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")).not.toBeInTheDocument();
  await act(async () => { notifyPasswordChanged("admin"); });
  await act(async () => {
    const another = staffSession();
    another.admin.id = "staff-2";
    another.session.sessionId = "another-account";
    saveAdminSession(another);
  });
  expect(screen.queryByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")).not.toBeInTheDocument();
});

test("offers recovery for unknown URLs", () => {
  window.history.replaceState({}, "", "/missing-page");
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "ไม่พบหน้าที่คุณต้องการ" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /กลับหน้าหลัก/ })).toHaveAttribute(
    "href",
    "/",
  );
});

test("help links lead to working workflows and answers expand", () => {
  window.history.replaceState({}, "", "/help");
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "เราพร้อมช่วยให้คุณเริ่มต้น" }),
  ).toBeInTheDocument();
  const question = screen.getByText("ใช้งานครั้งแรก ต้องเริ่มอย่างไร?");
  fireEvent.click(question);
  expect(question.closest("details")).toHaveAttribute("open");
  expect(
    screen.getByRole("link", { name: /ติดตามประวัติ.*เปิดดูผลตรวจ/ }),
  ).toHaveAttribute("href", "/history");
});
