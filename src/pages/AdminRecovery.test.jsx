import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminForgotPassword from "./AdminForgotPassword";
import AdminResetPassword from "./AdminResetPassword";
import { requestAdminPasswordReset, resetAdminPassword, validateAdminPasswordReset } from "../api/api";

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"),
  requestAdminPasswordReset: jest.fn(), validateAdminPasswordReset: jest.fn(), resetAdminPassword: jest.fn(),
}));

const firstToken = "A".repeat(43), secondToken = "B".repeat(43);
const valid = { data: { data: { valid: true } } };
const expired = { response: { status: 400, data: { code: "RESET_LINK_INVALID" } } };
const failure = { response: { status: 503 } };
function LocationControls() {
  const location = useLocation(), navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}{location.hash}</output>
    <button onClick={() => navigate(`/admin/reset-password#token=${secondToken}`)}>เปิดลิงก์ใหม่ในแท็บเดิม</button></>;
}
function RecoveryApp({ entry = `/admin/reset-password#token=${firstToken}`, revision = 0 }) {
  return <MemoryRouter initialEntries={[entry]}><output data-testid="revision">{revision}</output><LocationControls />
    <Routes>
      <Route path="/admin/reset-password" element={<AdminResetPassword />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
      <Route path="/admin/login" element={<h1>หน้าเข้าสู่ระบบเจ้าหน้าที่</h1>} />
    </Routes>
  </MemoryRouter>;
}
const input = name => screen.getByLabelText(name);
const fill = (name, value) => fireEvent.change(input(name), { target: { value } });
const submitReset = () => fireEvent.submit(input(/^รหัสผ่านใหม่/).closest("form"));
const fillPasswords = (password = "new-password-123", confirmation = password) => {
  fill(/^รหัสผ่านใหม่/, password); fill(/^ยืนยันรหัสผ่านใหม่/, confirmation);
};
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  requestAdminPasswordReset.mockResolvedValue({ status: 202, data: { message: "generic" } });
  validateAdminPasswordReset.mockResolvedValue(valid);
  resetAdminPassword.mockResolvedValue({ status: 200, data: { data: null } });
});

test("forgot-password validates the email and does not reveal whether a submitted account exists", async () => {
  render(<RecoveryApp entry="/admin/forgot-password" />);
  fireEvent.click(screen.getByRole("button", { name: "ส่งลิงก์ตั้งรหัสผ่านใหม่" }));
  expect(input(/อีเมลบัญชีเจ้าหน้าที่/)).toHaveFocus();
  expect(requestAdminPasswordReset).not.toHaveBeenCalled();
  fill(/อีเมลบัญชีเจ้าหน้าที่/, "STAFF@example.test");
  fireEvent.click(screen.getByRole("button", { name: "ส่งลิงก์ตั้งรหัสผ่านใหม่" }));
  expect(await screen.findByText(/รับคำขอแล้ว หากอีเมลนี้ตรงกับบัญชีเจ้าหน้าที่/)).toBeVisible();
  expect(requestAdminPasswordReset).toHaveBeenCalledWith("staff@example.test");
  expect(screen.queryByText(/พบบัญชี|ไม่มีบัญชี|ส่งอีเมลถึงแล้ว/)).not.toBeInTheDocument();
  expect(screen.getByText(/รออย่างน้อย 1 นาที/)).toBeVisible();
  expect(screen.queryByDisplayValue("STAFF@example.test")).not.toBeInTheDocument();
});

test("forgot-password prevents double submits and retains the email after a failed request for an explicit retry", async () => {
  let reject;
  requestAdminPasswordReset.mockImplementationOnce(() => new Promise((resolve, rejectRequest) => { reject = rejectRequest; }));
  render(<RecoveryApp entry="/admin/forgot-password" />);
  fill(/อีเมลบัญชีเจ้าหน้าที่/, "staff@example.test");
  const form = input(/อีเมลบัญชีเจ้าหน้าที่/).closest("form");
  fireEvent.submit(form); fireEvent.submit(form);
  expect(requestAdminPasswordReset).toHaveBeenCalledTimes(1);
  expect(input(/อีเมลบัญชีเจ้าหน้าที่/)).toBeDisabled();
  await act(async () => { reject(failure); });
  expect(screen.getByRole("alert")).toHaveTextContent(/เซิร์ฟเวอร์ยังไม่พร้อม/);
  expect(input(/อีเมลบัญชีเจ้าหน้าที่/)).toHaveValue("staff@example.test");
  fireEvent.submit(form);
  await screen.findByText(/รับคำขอแล้ว/);
  expect(requestAdminPasswordReset).toHaveBeenCalledTimes(2);
});

test("captures the fragment in memory, removes it immediately, and keeps it through ordinary background rerenders", async () => {
  let complete;
  validateAdminPasswordReset.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const view = render(<RecoveryApp />);
  expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin\/reset-password$/);
  expect(validateAdminPasswordReset).toHaveBeenCalledWith(firstToken);
  expect(screen.queryByLabelText(/^รหัสผ่านใหม่/)).not.toBeInTheDocument();
  view.rerender(<RecoveryApp revision={1} />);
  expect(validateAdminPasswordReset).toHaveBeenCalledTimes(1);
  await act(async () => { complete(valid); });
  expect(await screen.findByLabelText(/^รหัสผ่านใหม่/)).toBeVisible();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  expect(document.cookie).not.toContain(firstToken);
});

test.each(["/admin/reset-password", "/admin/reset-password#token=invalid"])("missing or malformed recovery link %s never sends a reset request", async entry => {
  render(<RecoveryApp entry={entry} />);
  expect(await screen.findByText(/ลิงก์นี้ใช้ไม่ได้ หมดอายุ หรือถูกใช้แล้ว/)).toBeVisible();
  expect(validateAdminPasswordReset).not.toHaveBeenCalled(); expect(resetAdminPassword).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "ขอลิงก์ใหม่" })).toHaveAttribute("href", "/admin/forgot-password");
});

test("expired links cannot expose password fields and lead to a new request", async () => {
  validateAdminPasswordReset.mockRejectedValueOnce(expired);
  render(<RecoveryApp />);
  await screen.findByText(/ลิงก์นี้ใช้ไม่ได้ หมดอายุ หรือถูกใช้แล้ว/);
  expect(screen.queryByLabelText(/^รหัสผ่านใหม่/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "ขอลิงก์ใหม่" }));
  expect(await screen.findByRole("heading", { name: "ลืมรหัสผ่านเจ้าหน้าที่" })).toBeVisible();
  expect(resetAdminPassword).not.toHaveBeenCalled();
});

test("validation network errors retry the same in-memory token after the fragment has been removed", async () => {
  validateAdminPasswordReset.mockRejectedValueOnce(failure);
  render(<RecoveryApp />);
  await screen.findByRole("alert");
  expect(screen.getByTestId("location")).not.toHaveTextContent(firstToken);
  fireEvent.click(screen.getByRole("button", { name: "ลองตรวจสอบลิงก์อีกครั้ง" }));
  await screen.findByLabelText(/^รหัสผ่านใหม่/);
  expect(validateAdminPasswordReset.mock.calls).toEqual([[firstToken], [firstToken]]);
});

test("password validation enforces length, UTF-8 byte limit and confirmation before any write", async () => {
  render(<RecoveryApp />); await screen.findByLabelText(/^รหัสผ่านใหม่/);
  fillPasswords("1234567"); submitReset();
  expect(input(/^รหัสผ่านใหม่/)).toHaveFocus();
  expect(screen.getByText(/ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร/)).toBeVisible();
  fillPasswords("ก".repeat(25)); submitReset();
  expect(screen.getByText(/กรุณาลดจำนวนตัวอักษร/)).toBeVisible();
  fillPasswords("new-password-123", "different-password"); submitReset();
  expect(input(/^ยืนยันรหัสผ่านใหม่/)).toHaveFocus();
  expect(resetAdminPassword).not.toHaveBeenCalled();
});

test("reset locks duplicate writes, clears credentials on success and offers login without automatically signing in", async () => {
  let complete;
  resetAdminPassword.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  render(<RecoveryApp />); await screen.findByLabelText(/^รหัสผ่านใหม่/);
  fillPasswords();
  fireEvent.click(screen.getByRole("button", { name: "แสดงรหัสผ่าน" }));
  expect(input(/^รหัสผ่านใหม่/)).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "ซ่อนรหัสผ่าน" })).toHaveAttribute("aria-pressed", "true");
  submitReset(); submitReset();
  expect(resetAdminPassword).toHaveBeenCalledTimes(1);
  expect(resetAdminPassword).toHaveBeenCalledWith(firstToken, "new-password-123", "new-password-123");
  expect(input(/^รหัสผ่านใหม่/)).toBeDisabled();
  await act(async () => { complete({ status: 200 }); });
  expect(await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/)).toBeVisible();
  expect(screen.queryByLabelText(/^รหัสผ่านใหม่/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "เข้าสู่ระบบเจ้าหน้าที่" })).toHaveAttribute("href", "/admin/login");
  expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin\/reset-password$/);
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("a failed reset preserves passwords for an explicit retry but an invalidated link removes the form", async () => {
  resetAdminPassword.mockRejectedValueOnce(failure).mockRejectedValueOnce(expired);
  render(<RecoveryApp />); await screen.findByLabelText(/^รหัสผ่านใหม่/); fillPasswords(); submitReset();
  await screen.findByRole("alert");
  expect(input(/^รหัสผ่านใหม่/)).toHaveValue("new-password-123");
  expect(input(/^ยืนยันรหัสผ่านใหม่/)).toHaveValue("new-password-123");
  submitReset();
  await screen.findByText(/ลิงก์นี้ใช้ไม่ได้ หมดอายุ หรือถูกใช้แล้ว/);
  expect(screen.queryByLabelText(/^รหัสผ่านใหม่/)).not.toBeInTheDocument();
  expect(resetAdminPassword).toHaveBeenCalledTimes(2);
});

test.each(["invalid", "success"])("a new fragment in the same tab replaces the old token after %s without preserving old passwords", async previous => {
  if (previous === "invalid") validateAdminPasswordReset.mockRejectedValueOnce(expired);
  render(<RecoveryApp />);
  if (previous === "success") {
    await screen.findByLabelText(/^รหัสผ่านใหม่/); fillPasswords(); submitReset();
    await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/);
  } else await screen.findByText(/ลิงก์นี้ใช้ไม่ได้ หมดอายุ หรือถูกใช้แล้ว/);
  fireEvent.click(screen.getByRole("button", { name: "เปิดลิงก์ใหม่ในแท็บเดิม" }));
  expect(await screen.findByLabelText(/^รหัสผ่านใหม่/)).toHaveValue("");
  expect(input(/^ยืนยันรหัสผ่านใหม่/)).toHaveValue("");
  expect(validateAdminPasswordReset.mock.calls.map(([token]) => token)).toEqual([firstToken, secondToken]);
  expect(screen.getByTestId("location")).not.toHaveTextContent(secondToken);
  fillPasswords("second-password-123"); submitReset();
  await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/);
  expect(resetAdminPassword).toHaveBeenLastCalledWith(secondToken, "second-password-123", "second-password-123");
});

test("an old validation response cannot replace a newer fragment in the same component", async () => {
  let completeOld;
  validateAdminPasswordReset.mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve; }));
  render(<RecoveryApp />);
  fireEvent.click(screen.getByRole("button", { name: "เปิดลิงก์ใหม่ในแท็บเดิม" }));
  await screen.findByLabelText(/^รหัสผ่านใหม่/);
  await act(async () => { completeOld({ data: { data: { valid: false } } }); });
  expect(input(/^รหัสผ่านใหม่/)).toBeVisible();
  fillPasswords(); submitReset(); await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/);
  expect(resetAdminPassword).toHaveBeenCalledWith(secondToken, "new-password-123", "new-password-123");
});

test("leaving a pending recovery request does not display its late result on the next page", async () => {
  let complete;
  requestAdminPasswordReset.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const old = render(<RecoveryApp entry="/admin/forgot-password" />);
  fill(/อีเมลบัญชีเจ้าหน้าที่/, "staff@example.test");
  fireEvent.click(screen.getByRole("button", { name: "ส่งลิงก์ตั้งรหัสผ่านใหม่" }));
  old.unmount(); render(<RecoveryApp entry="/admin/forgot-password" />);
  await act(async () => { complete({ status: 202 }); });
  expect(input(/อีเมลบัญชีเจ้าหน้าที่/)).toHaveValue("");
  expect(screen.queryByText(/รับคำขอแล้ว/)).not.toBeInTheDocument();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("the skip link focuses the recovery content without overwriting its in-memory reset token", async () => {
  render(<RecoveryApp />); await screen.findByLabelText(/^รหัสผ่านใหม่/);
  fireEvent.click(screen.getByRole("link", { name: "ข้ามไปยังการกู้คืนบัญชี" }));
  expect(screen.getByRole("main")).toHaveFocus();
  fillPasswords(); submitReset(); await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/);
  expect(resetAdminPassword).toHaveBeenCalledWith(firstToken, "new-password-123", "new-password-123");
  expect(validateAdminPasswordReset).toHaveBeenCalledTimes(1);
});

test("StrictMode keeps the captured token through effect cleanup and hash removal", async () => {
  render(<StrictMode><RecoveryApp /></StrictMode>);
  await screen.findByLabelText(/^รหัสผ่านใหม่/);
  expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin\/reset-password$/);
  fillPasswords(); submitReset(); await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/);
  expect(resetAdminPassword).toHaveBeenCalledTimes(1);
  expect(resetAdminPassword).toHaveBeenCalledWith(firstToken, "new-password-123", "new-password-123");
});

test("a late reset for the old link cannot unlock or complete a pending reset from a newer link", async () => {
  let completeOld, completeNew;
  resetAdminPassword.mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { completeNew = resolve; }));
  render(<RecoveryApp />); await screen.findByLabelText(/^รหัสผ่านใหม่/);
  fillPasswords(); submitReset();
  fireEvent.click(screen.getByRole("button", { name: "เปิดลิงก์ใหม่ในแท็บเดิม" }));
  await waitFor(() => expect(input(/^รหัสผ่านใหม่/)).toBeEnabled());
  expect(input(/^รหัสผ่านใหม่/)).toHaveValue("");
  fillPasswords("second-password-123"); submitReset();
  expect(resetAdminPassword).toHaveBeenCalledTimes(2);
  await act(async () => { completeOld({ status: 200 }); });
  expect(input(/^รหัสผ่านใหม่/)).toBeDisabled();
  expect(screen.queryByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/)).not.toBeInTheDocument();
  submitReset();
  expect(resetAdminPassword).toHaveBeenCalledTimes(2);
  await act(async () => { completeNew({ status: 200 }); });
  expect(await screen.findByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/)).toBeVisible();
  expect(resetAdminPassword).toHaveBeenLastCalledWith(secondToken, "second-password-123", "second-password-123");
});

test("leaving a pending reset does not apply its late success to the next page", async () => {
  let complete;
  resetAdminPassword.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const old = render(<RecoveryApp />); await screen.findByLabelText(/^รหัสผ่านใหม่/); fillPasswords(); submitReset();
  old.unmount(); render(<RecoveryApp entry="/admin/forgot-password" />);
  await act(async () => { complete({ status: 200 }); });
  expect(screen.getByTestId("location")).toHaveTextContent("/admin/forgot-password");
  expect(input(/อีเมลบัญชีเจ้าหน้าที่/)).toHaveValue("");
  expect(screen.queryByText(/ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว/)).not.toBeInTheDocument();
});
