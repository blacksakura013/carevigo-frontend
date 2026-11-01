import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "../App";
import {
  adminLogin,
  changePatientPassword,
  clearAdminSession,
  clearPatientSession,
  getHealthByType,
  getPatientProfile,
  getSessionSnapshot,
  getStoredAdmin,
  getStoredPatient,
  initializeSessions,
  getGuestProfile,
  loginPatient,
  patientLogout,
  restoreSession,
  retryLogout,
  saveAdminSession,
  savePatientSession,
} from "../api/api";
import { clearSession, failSessionLoad } from "../utils/session";
import { apiNotReady } from "../utils/apiReadiness";

jest.mock("../api/api", () => ({
  ...jest.requireActual("../api/api"),
  loginPatient: jest.fn(),
  adminLogin: jest.fn(),
  getPatientProfile: jest.fn(),
  changePatientPassword: jest.fn(),
  getHealthByType: jest.fn(),
  initializeSessions: jest.fn(),
  getGuestProfile: jest.fn(),
  restoreSession: jest.fn(),
  patientLogout: jest.fn(),
  retryLogout: jest.fn(),
}));
jest.mock("./AdminDashboard", () => function StaffArea() {
  return <h1>Staff private area</h1>;
});
const ownId = "1234567890123";
const ownProfile = {
  _id: "patient-1",
  citizenId: ownId,
  firstName: "ผู้ใช้",
  lastName: "ทดสอบ",
  accountEnabled: true,
  requiresPasswordChange: false,
  thaiCvRisk: { status: "incomplete", missing: ["birthDate"] },
};
const response = (requiresPasswordChange = false, profile = ownProfile, sessionId = requiresPasswordChange ? "patient-temporary" : "patient-active") => ({
  data: {
    data: {
      session: { scope: "patient", sessionId, csrfToken: `csrf-${sessionId}`, expiresAt: new Date(Date.now() + 600000).toISOString() },
      patient: { ...profile, requiresPasswordChange },
      requiresPasswordChange,
    },
  },
});
const staffResponse = () => ({ data: { data: {
  admin: { id: "staff-1", email: "staff@example.test", role: "admin" },
  session: { scope: "admin", sessionId: "staff-session", csrfToken: "staff-csrf", expiresAt: new Date(Date.now() + 600000).toISOString() },
} } });
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  clearSession("patient", { endedBy: null });
  clearSession("admin", { endedBy: null });
  initializeSessions.mockResolvedValue(undefined);
  getGuestProfile.mockResolvedValue({ data: { data: null } });
  restoreSession.mockImplementation(async (scope) => {
    if (scope === "patient") clearPatientSession(); else clearAdminSession();
  });
  patientLogout.mockImplementation(async () => clearSession("patient", { logout: true }));
  retryLogout.mockImplementation(async (scope) => clearSession(scope));
  window.history.replaceState({}, "", "/login");
  getPatientProfile.mockResolvedValue(response());
  getHealthByType.mockResolvedValue({
    data: { data: [], total: 0, hasMore: false },
  });
});
function signIn() {
  fireEvent.change(screen.getByLabelText(/เลขบัตรประชาชน/), {
    target: { value: ownId },
  });
  fireEvent.change(screen.getByLabelText(/^รหัสผ่าน/), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "เข้าสู่บัญชีของฉัน" }));
}

test("requires a personal account before opening health data", async () => {
  window.history.replaceState({}, "", "/history/9999999999999");
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" }),
  ).toBeInTheDocument();
  expect(getHealthByType).not.toHaveBeenCalled();
});
test("keeps an unsuccessful login on the form and gives an account recovery path", async () => {
  loginPatient.mockRejectedValueOnce({ response: { status: 401 } });
  render(<App />);
  signIn();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /ตรวจสอบเลขบัตรประชาชนและรหัสผ่าน/,
  );
  expect(screen.getByLabelText(/เลขบัตรประชาชน/)).toHaveValue(ownId);
  expect(
    screen.getByText(/ติดต่อเจ้าหน้าที่ของหน่วยงานเพื่อเปิดบัญชี/),
  ).toBeInTheDocument();
  expect(localStorage.getItem("patientAccessToken")).toBeNull();
});

test.each(["patient", "admin"])("%s login keeps the draft and explains a cold-start timeout", async scope => {
  const staff = scope === "admin";
  const login = staff ? adminLogin : loginPatient;
  login.mockRejectedValueOnce(apiNotReady());
  window.history.replaceState({}, "", staff ? "/admin/login" : "/login");
  render(<App />);
  const identity = screen.getByLabelText(staff ? /^อีเมล/ : /เลขบัตรประชาชน/);
  fireEvent.change(identity, { target: { value: staff ? "staff@example.test" : ownId } });
  fireEvent.change(screen.getByLabelText(/^รหัสผ่าน/), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: staff ? "เข้าสู่ระบบ" : "เข้าสู่บัญชีของฉัน" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("ระบบยังไม่พร้อมให้บริการ");
  expect(screen.getByRole("alert")).not.toHaveTextContent("ตรวจสอบอีเมลและรหัสผ่าน");
  expect(identity).toHaveValue(staff ? "staff@example.test" : ownId);
  expect(screen.getByLabelText(/^รหัสผ่าน/)).toHaveValue("synthetic-password");
  expect(identity).toBeEnabled();
  expect(login).toHaveBeenCalledTimes(1);
  expect(getStoredAdmin()).toBeNull();
  expect(getStoredPatient()).toBeNull();
});
test("first login sends the temporary code to mandatory password setup before reading health data", async () => {
  loginPatient.mockResolvedValueOnce(response(true));
  getPatientProfile.mockResolvedValue(response(true));
  render(<App />);
  signIn();
  expect(
    await screen.findByRole("heading", {
      name: "ตั้งรหัสผ่านของคุณก่อนเริ่มต้น",
    }),
  ).toBeInTheDocument();
  expect(getHealthByType).not.toHaveBeenCalled();
  expect(loginPatient).toHaveBeenCalledWith(ownId, "123456", expect.objectContaining({ isCurrent: expect.any(Function) }));
});
test("editing a record URL still loads only the signed-in patient's history", async () => {
  savePatientSession(response().data.data);
  window.history.replaceState({}, "", "/history/9999999999999");
  render(<App />);
  await waitFor(() =>
    expect(window.location.pathname).toBe(`/history/${ownId}`),
  );
  await waitFor(() => expect(getHealthByType).toHaveBeenCalled());
  getHealthByType.mock.calls.forEach((call) => expect(call[0]).toBe(ownId));
  expect(
    screen.queryByRole("textbox", { name: /เลขบัตรประชาชน/ }),
  ).not.toBeInTheDocument();
});
test("checks confirmation and replaces the temporary session after a successful password change", async () => {
  savePatientSession(response(true).data.data);
  getPatientProfile.mockResolvedValue(response(true));
  changePatientPassword.mockResolvedValue(response(false));
  window.history.replaceState({}, "", "/settings?required=1");
  render(<App />);
  const current = await screen.findByLabelText(/^รหัสเริ่มต้น 6 หลัก/);
  fireEvent.change(current, { target: { value: "123456" } });
  fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), {
    target: { value: "654321" },
  });
  fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), {
    target: { value: "111111" },
  });
  fireEvent.click(screen.getByRole("button", { name: /บันทึกและเริ่มใช้งาน/ }));
  expect(changePatientPassword).not.toHaveBeenCalled();
  expect(
    screen.getByText("กรอกรหัสผ่านใหม่ทั้งสองช่องให้ตรงกัน"),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), {
    target: { value: "654321" },
  });
  getPatientProfile.mockResolvedValue(response(false));
  fireEvent.click(screen.getByRole("button", { name: /บันทึกและเริ่มใช้งาน/ }));
  await waitFor(() =>
    expect(changePatientPassword).toHaveBeenCalledWith("123456", "654321"),
  );
  expect(
    await screen.findByRole("heading", { name: "สวัสดี คุณผู้ใช้" }),
  ).toBeInTheDocument();
  expect(getStoredPatient().requiresPasswordChange).toBe(false);
  expect(getSessionSnapshot("patient").sessionId).toBe("patient-active");
  expect(screen.getByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")).toBeInTheDocument();
  expect(localStorage.getItem("patientProfile")).toBeNull();
  expect(localStorage.getItem("patientAccessToken")).toBeNull();
});
test("confirmed password feedback survives re-verification but disappears after patient logout", async () => {
  savePatientSession(response().data.data);
  changePatientPassword.mockResolvedValue(response(false, ownProfile, "patient-rotated"));
  window.history.replaceState({}, "", "/settings");
  render(<App />);
  fireEvent.change(await screen.findByLabelText(/^รหัสผ่านปัจจุบัน/), { target: { value: "123456" } });
  fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), { target: { value: "654321" } });
  fireEvent.change(screen.getByLabelText(/^ยืนยันรหัสผ่านใหม่/), { target: { value: "654321" } });
  fireEvent.click(screen.getByRole("button", { name: /บันทึกรหัสผ่านใหม่/ }));
  expect(await screen.findByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")).toBeInTheDocument();
  await screen.findByLabelText(/^รหัสผ่านปัจจุบัน/);
  expect(getSessionSnapshot("patient").sessionId).toBe("patient-rotated");
  expect(screen.getByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")).toBeInTheDocument();
  await act(async () => { clearSession("patient", { logout: true }); });
  expect(screen.queryByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")).not.toBeInTheDocument();
});
test("patient logout clears only its session and returns to an authenticated staff landing", async () => {
  savePatientSession(response().data.data);
  const staff = { id: "staff-1", email: "staff@example.test", role: "admin" };
  saveAdminSession({ admin: staff, session: { scope: "admin", sessionId: "staff-session", csrfToken: "staff-csrf", expiresAt: new Date(Date.now() + 600000).toISOString() } });
  window.history.replaceState({}, "", "/profile");
  render(<App />);
  await screen.findByRole("heading", { name: "ข้อมูลส่วนตัวของฉัน" });
  fireEvent.click(screen.getByRole("button", { name: "ออกจากบัญชีของฉัน" }));
  expect(
    await screen.findByRole("heading", { name: "Staff private area" }),
  ).toBeInTheDocument();
  expect(localStorage.getItem("patientAccessToken")).toBeNull();
  expect(getStoredPatient()).toBeNull();
  expect(getStoredAdmin()).toEqual(staff);
  expect(localStorage.getItem("adminAccessToken")).toBeNull();
  expect(screen.queryByText(/เซสชันหมดอายุ/)).not.toBeInTheDocument();
});
test("a login response arriving after leaving the form cannot restore a session", async () => {
  let complete;
  loginPatient.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  render(<App />);
  signIn();
  fireEvent.click(screen.getByRole("link", { name: /ดูวิธีเข้าใช้งาน/ }));
  expect(
    await screen.findByRole("heading", { name: "เราพร้อมช่วยให้คุณเริ่มต้น" }),
  ).toBeInTheDocument();
  await act(async () => {
    complete(response());
  });
  expect(localStorage.getItem("patientAccessToken")).toBeNull();
  expect(getStoredPatient()).toBeNull();
  expect(window.location.pathname).toBe("/help");
});
test("public guest form data survives a session change or logout in another tab", async () => {
  window.history.replaceState({}, "", "/guest");
  render(<App />);
  const name = screen.getByLabelText(/^ชื่อ/);
  fireEvent.change(name, { target: { value: "ข้อมูลที่ยังไม่ส่ง" } });
  await act(async () => {
    savePatientSession(response().data.data);
  });
  expect(screen.queryByRole("link", { name: /ประวัติสุขภาพ|ข้อมูลของฉัน|ตั้งค่าบัญชี/ })).not.toBeInTheDocument();
  expect(screen.queryByText("ผู้ใช้")).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^ชื่อ/)).toHaveValue("ข้อมูลที่ยังไม่ส่ง");
  await act(async () => { saveAdminSession(staffResponse().data.data); });
  expect(window.location.pathname).toBe("/guest");
  expect(screen.getByLabelText(/^ชื่อ/)).toHaveValue("ข้อมูลที่ยังไม่ส่ง");
  await act(async () => {
    clearSession("patient", { expired: true });
  });
  expect(window.location.pathname).toBe("/guest");
  expect(screen.getByLabelText(/^ชื่อ/)).toHaveValue("ข้อมูลที่ยังไม่ส่ง");
  await act(async () => { clearSession("admin", { expired: true }); });
  expect(window.location.pathname).toBe("/guest");
  expect(screen.getByLabelText(/^ชื่อ/)).toHaveValue("ข้อมูลที่ยังไม่ส่ง");
  expect(getHealthByType).not.toHaveBeenCalled();
});

test("anonymous neutral entry goes to guest even after an earlier patient session ended", async () => {
  clearSession("patient", { expired: true });
  window.history.replaceState({}, "", "/");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "บันทึกสุขภาพ ไม่ต้องเข้าสู่ระบบ" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/guest");
  expect(getPatientProfile).not.toHaveBeenCalled();
});

test("neutral entry opens a personal dashboard for a patient session", async () => {
  savePatientSession(response().data.data);
  clearSession("admin", { expired: true });
  window.history.replaceState({}, "", "/");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "สวัสดี คุณผู้ใช้" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/");
});

test.each(["expired", "logout"])("an authenticated staff landing takes priority over a stale patient %s marker", async (endedBy) => {
  clearSession("patient", { endedBy });
  saveAdminSession(staffResponse().data.data);
  window.history.replaceState({}, "", "/");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Staff private area" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/admin");
  expect(screen.queryByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" })).not.toBeInTheDocument();
  expect(getPatientProfile).not.toHaveBeenCalled();
});

test("neutral entry chooses the staff dashboard when both cookie sessions are active", async () => {
  savePatientSession(response(true).data.data);
  saveAdminSession(staffResponse().data.data);
  window.history.replaceState({}, "", "/");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Staff private area" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/admin");
  expect(getPatientProfile).not.toHaveBeenCalled();
  expect(getHealthByType).not.toHaveBeenCalled();
});

test.each(["/", "/login"])("confirmed staff entry at %s does not wait on an unrelated patient bootstrap error", async (entry) => {
  failSessionLoad("patient", new Error("patient scope unavailable"));
  saveAdminSession(staffResponse().data.data);
  window.history.replaceState({}, "", entry);
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Staff private area" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/admin");
  expect(screen.queryByText(/ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ/)).not.toBeInTheDocument();
});

test("a patient session expiring on its dashboard keeps the scoped warning and hides private content", async () => {
  savePatientSession(response().data.data);
  window.history.replaceState({}, "", "/");
  render(<App />);
  await screen.findByRole("heading", { name: "สวัสดี คุณผู้ใช้" });
  await act(async () => { clearSession("patient", { expired: true }); });
  expect(await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "สวัสดี คุณผู้ใช้" })).not.toBeInTheDocument();
  expect(screen.getByText(/เซสชันหมดอายุ/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: /บันทึกสุขภาพโดยไม่เข้าสู่ระบบ/ }));
  expect(await screen.findByRole("heading", { name: "บันทึกสุขภาพ ไม่ต้องเข้าสู่ระบบ" })).toBeInTheDocument();
});

test("an authenticated staff member opening patient login lands directly in staff area", async () => {
  saveAdminSession(staffResponse().data.data);
  render(<App />);
  expect(screen.queryByLabelText(/^รหัสผ่าน/)).not.toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Staff private area" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/admin");
  expect(loginPatient).not.toHaveBeenCalled();
});

test("an existing personal session opening login goes directly to its dashboard", async () => {
  savePatientSession(response().data.data);
  render(<App />);
  expect(screen.queryByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" })).not.toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "สวัสดี คุณผู้ใช้" })).toBeInTheDocument();
});

test("a patient may explicitly open staff login without being redirected to the personal dashboard", () => {
  savePatientSession(response().data.data);
  window.history.replaceState({}, "", "/admin/login");
  render(<App />);
  expect(screen.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/admin/login");
  expect(getPatientProfile).not.toHaveBeenCalled();
});

test("patient login returns to the requested protected record with its query and fragment, using only their own ID", async () => {
  loginPatient.mockResolvedValueOnce(response());
  window.history.replaceState({}, "", "/history/9999999999999?type=blood#recent");
  render(<App />);
  await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" });
  signIn();
  await waitFor(() => expect(window.location.pathname).toBe(`/history/${ownId}`));
  expect(window.location.search).toBe("?type=blood");
  expect(window.location.hash).toBe("#recent");
  await waitFor(() => expect(getHealthByType).toHaveBeenCalled());
  getHealthByType.mock.calls.forEach((call) => expect(call[0]).toBe(ownId));
});

test("a protected deep link still requires initial password setup before reading records", async () => {
  loginPatient.mockResolvedValueOnce(response(true));
  getPatientProfile.mockResolvedValue(response(true));
  window.history.replaceState({}, "", `/history/${ownId}?type=blood#recent`);
  render(<App />);
  await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" });
  signIn();
  expect(await screen.findByRole("heading", { name: "ตั้งรหัสผ่านของคุณก่อนเริ่มต้น" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/settings");
  expect(window.location.search).toBe("?required=1");
  expect(getHealthByType).not.toHaveBeenCalled();
});

test("staff login returns to a protected registration page with its query and fragment", async () => {
  adminLogin.mockResolvedValueOnce(staffResponse());
  window.history.replaceState({}, "", "/register?step=profile#personal-details");
  render(<App />);
  await screen.findByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" });
  fireEvent.change(screen.getByLabelText(/^อีเมล/), { target: { value: "staff@example.test" } });
  fireEvent.change(screen.getByLabelText(/^รหัสผ่าน/), { target: { value: "staff-password" } });
  fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
  expect(await screen.findByRole("heading", { name: "สุขภาพที่ดี เริ่มจากรู้จักคุณ" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/register");
  expect(window.location.search).toBe("?step=profile");
  expect(window.location.hash).toBe("#personal-details");
});

test("an explicit patient page remains available when a separate staff session is also active", async () => {
  savePatientSession(response().data.data);
  saveAdminSession(staffResponse().data.data);
  window.history.replaceState({}, "", "/profile?section=conditions#history");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "ข้อมูลส่วนตัวของฉัน" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/profile");
  expect(window.location.search).toBe("?section=conditions");
  expect(window.location.hash).toBe("#history");
});

test("hides a former patient's private history as soon as a different cookie session is restored", async () => {
  let profile = ownProfile;
  savePatientSession(response().data.data);
  getPatientProfile.mockImplementation(async () => response(false, profile));
  getHealthByType.mockImplementation(async (citizenId) => ({ data: { data: [{
    _id: `row-${citizenId}`, type: "sugar", value: { fbs: citizenId === ownId ? 111 : 222 },
    createdAt: "2026-11-01T08:00:00.000Z", reviewStatus: "approved",
  }], total: 1, hasMore: false } }));
  window.history.replaceState({}, "", `/history/${ownId}`);
  render(<App />);
  expect(await screen.findByText("111")).toBeInTheDocument();
  profile = { ...ownProfile, _id: "patient-2", citizenId: "9999999999999", firstName: "บัญชีใหม่" };
  await act(async () => { savePatientSession(response(false, profile, "second-patient-session").data.data); });
  await waitFor(() => expect(window.location.pathname).toBe(`/history/${profile.citizenId}`));
  expect(screen.queryByText("111")).not.toBeInTheDocument();
  expect(await screen.findByText("222")).toBeInTheDocument();
  expect(getStoredPatient().citizenId).toBe(profile.citizenId);
  expect(localStorage.getItem("patientProfile")).toBeNull();
});

test("failed server logout hides private data and keeps a retry visible until revocation succeeds", async () => {
  savePatientSession(response().data.data);
  patientLogout.mockImplementationOnce(async () => {
    clearSession("patient", { logout: true, logoutPending: true, error: new Error("offline") });
    window.dispatchEvent(new CustomEvent("carevigo:logout-failed", { detail: { scope: "patient" } }));
  });
  window.history.replaceState({}, "", "/");
  render(<App />);
  await screen.findByRole("heading", { name: "สวัสดี คุณผู้ใช้" });
  fireEvent.click(screen.getByRole("button", { name: "ออกจากบัญชีของฉัน" }));
  expect(await screen.findByRole("heading", { name: "เข้าสู่บัญชีสุขภาพของคุณ" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "สวัสดี คุณผู้ใช้" })).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/ยังออกจากระบบบนเซิร์ฟเวอร์ไม่สำเร็จ/);
  expect(getStoredPatient()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ออกจากระบบอีกครั้ง" }));
  await waitFor(() => expect(retryLogout).toHaveBeenCalledWith("patient"));
  await waitFor(() => expect(screen.queryByText(/ยังออกจากระบบบนเซิร์ฟเวอร์ไม่สำเร็จ/)).not.toBeInTheDocument());
});
