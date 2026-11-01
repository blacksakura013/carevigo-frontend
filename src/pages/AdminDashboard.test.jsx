import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import {
  approveAdminUser,
  changeAdminPassword,
  getAdminUser,
  getAdminUsers,
  getDashboardHealth,
  getDashboardSummary,
  getDashboardVerification,
  getReviewSettings,
  getStoredAdmin,
  provisionPatientAccount,
} from "../api/api";

jest.mock("../api/api", () => ({
  getDashboardHealth: jest.fn(),
  getStoredAdmin: jest.fn(),
  getDashboardSummary: jest.fn(),
  getDashboardVerification: jest.fn(),
  getAdminUsers: jest.fn(),
  getAdminUser: jest.fn(),
  approveAdminUser: jest.fn(),
  changeAdminPassword: jest.fn(),
  adminLogout: jest.fn(),
  provisionPatientAccount: jest.fn(),
  getReviewSettings: jest.fn(),
  getReviewQueue: jest.fn(),
  decideReviews: jest.fn(),
  getApiError: (_error, fallback) => fallback,
}));

const member = {
  _id: "member-1",
  firstName: "สมาชิก",
  lastName: "ทดสอบ",
  citizenId: "1234567890123",
  status: "pending",
  isVerified: false,
  province: "เชียงใหม่",
  phone: "0800000000",
  createdAt: "2026-10-30T12:00:00Z",
};
const healthRecord = {
  _id: "record-1",
  type: "blood_pressure",
  value: { systolic: 124, diastolic: 82 },
  createdAt: "2026-10-30T12:00:00Z",
  user: member,
  bmi: 22.4,
  cvdRisk: { level: "normal" },
};
const healthResponse = {
  data: {
    data: {
      summary: { blood_pressure: 5, sugar: 3, cholesterol: 2, bmi: 1 },
      records: [healthRecord],
    },
    total: 11,
    page: 1,
    hasMore: false,
  },
};
function renderDashboard(url = "/admin") {
  window.history.replaceState({}, "", url);
  return render(
    <BrowserRouter>
      <AdminDashboard />
    </BrowserRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  getStoredAdmin.mockReturnValue(null);
  getDashboardSummary.mockResolvedValue({
    data: {
      data: { totalUsers: 7, totalHealthRecords: 11, todayHealthRecords: 2 },
    },
  });
  getDashboardVerification.mockResolvedValue({
    data: { data: { total: 7, verified: 6, pending: 1, rejected: 0 } },
  });
  getDashboardHealth.mockResolvedValue(healthResponse);
  getAdminUsers.mockResolvedValue({
    data: { data: [member], total: 1, hasMore: false },
  });
  getAdminUser.mockResolvedValue({
    data: {
      data: {
        user: member,
        health: { blood_pressure: [healthRecord], sugar: [], cholesterol: [] },
      },
    },
  });
  approveAdminUser.mockResolvedValue({
    data: { data: { ...member, status: "active", isVerified: true } },
  });
  changeAdminPassword.mockResolvedValue({ data: { data: null } });
  provisionPatientAccount.mockResolvedValue({
    data: {
      data: {
        patient: {
          ...member,
          accountEnabled: true,
          requiresPasswordChange: true,
        },
        requiresPasswordChange: true,
        temporaryPassword: "012345",
      },
    },
  });
  getReviewSettings.mockResolvedValue({
    data: {
      data: {
        timezone: "Asia/Bangkok",
        autoApprovalTime: "23:59",
        policy: "same-day",
        activeAdminRecipients: 1,
        outbox: { pending: 0, sent: 3, failed: 0 },
        counts: { pending: 0, approved: 1, rejected: 0 },
      },
    },
  });
});

test("shows real type totals and filters loaded health records without manufacturing clinical advice", async () => {
  renderDashboard();
  expect(
    await screen.findByRole("img", { name: /ความดันโลหิต 5 รายการ/ }),
  ).toBeInTheDocument();
  expect(screen.getByText("124/82 mmHg")).toBeInTheDocument();
  expect(screen.getByText("•••••••••0123")).toBeInTheDocument();
  expect(
    within(screen.getByRole("table", { name: "บันทึกสุขภาพสมาชิก" })).getByText(
      "น้ำหนักตามเกณฑ์",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("ควรพบแพทย์ทันที")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("ประเภทบันทึก"), {
    target: { value: "sugar" },
  });
  expect(screen.getByText("ไม่พบข้อมูลที่ตรงกับตัวกรอง")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
  expect(screen.getByText("124/82 mmHg")).toBeInTheDocument();
});

test("verification requests pending members and requires explicit confirmation before approving", async () => {
  renderDashboard();
  fireEvent.click(screen.getByRole("button", { name: /^ยืนยันสมาชิก/ }));
  await waitFor(() =>
    expect(getAdminUsers).toHaveBeenCalledWith(1, 20, { status: "pending" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "ตรวจสอบ" }));
  const drawer = await screen.findByRole("dialog", {
    name: "รายละเอียดสมาชิก",
  });
  fireEvent.click(
    await within(drawer).findByRole("button", { name: "อนุมัติสมาชิก" }),
  );
  expect(approveAdminUser).not.toHaveBeenCalled();
  expect(
    within(drawer).getByText(/ยืนยันว่าตรวจสอบข้อมูลของ/),
  ).toBeInTheDocument();
  fireEvent.click(
    within(drawer).getByRole("button", { name: "ยืนยันการอนุมัติ" }),
  );
  await waitFor(() =>
    expect(approveAdminUser).toHaveBeenCalledWith("member-1"),
  );
  expect(
    await screen.findByText("ยืนยันสมาชิก สมาชิก ทดสอบ สำเร็จ"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("keeps approval errors visible and lets the administrator retry", async () => {
  approveAdminUser.mockRejectedValueOnce(new Error("unavailable"));
  renderDashboard();
  fireEvent.click(screen.getByRole("button", { name: /^ยืนยันสมาชิก/ }));
  fireEvent.click(await screen.findByRole("button", { name: "ตรวจสอบ" }));
  fireEvent.click(await screen.findByRole("button", { name: "อนุมัติสมาชิก" }));
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันการอนุมัติ" }));
  expect(
    await screen.findByText("ยืนยันสมาชิกไม่สำเร็จ กรุณาลองใหม่"),
  ).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันการอนุมัติ" }));
  await waitFor(() => expect(approveAdminUser).toHaveBeenCalledTimes(2));
  expect(
    await screen.findByText("ยืนยันสมาชิก สมาชิก ทดสอบ สำเร็จ"),
  ).toBeInTheDocument();
});

test("searches all members on the server and paginates the filtered results", async () => {
  getAdminUsers.mockResolvedValue({
    data: { data: [member], total: 35, hasMore: true },
  });
  renderDashboard();
  fireEvent.click(screen.getByRole("button", { name: "ทะเบียนสมาชิก" }));
  fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาสมาชิก" }), {
    target: { value: "เชียงใหม่" },
  });
  await waitFor(() =>
    expect(getAdminUsers).toHaveBeenLastCalledWith(1, 20, {
      search: "เชียงใหม่",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "หน้าถัดไป" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "หน้าถัดไป" }));
  await waitFor(() =>
    expect(getAdminUsers).toHaveBeenLastCalledWith(2, 20, {
      search: "เชียงใหม่",
    }),
  );
});

test("account settings display the verified in-memory account instead of a legacy stored profile", async () => {
  localStorage.setItem("adminProfile", JSON.stringify({ email: "stale@example.test", role: "admin" }));
  getStoredAdmin.mockReturnValue({ email: "current@example.test", role: "superadmin" });
  renderDashboard("/admin?view=settings");
  expect(screen.getAllByText("current@example.test").length).toBeGreaterThan(0);
  expect(screen.queryByText("stale@example.test")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "รีเฟรชข้อมูล" })).toBeEnabled());
});

test("validates password confirmation before submitting and clears passwords on success", async () => {
  localStorage.setItem("adminProfile", "broken json");
  renderDashboard();
  fireEvent.click(screen.getByRole("button", { name: "ตั้งค่าบัญชี" }));
  fireEvent.change(
    screen.getByLabelText(/รหัสผ่านใหม่/, { selector: "#admin-new-password" }),
    { target: { value: "valid-password" } },
  );
  fireEvent.change(screen.getByLabelText(/ยืนยันรหัสผ่านใหม่/), {
    target: { value: "different-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }));
  expect(
    screen.getByText("รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง"),
  ).toBeInTheDocument();
  expect(changeAdminPassword).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/ยืนยันรหัสผ่านใหม่/), {
    target: { value: "valid-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }));
  await waitFor(() =>
    expect(changeAdminPassword).toHaveBeenCalledWith("valid-password"),
  );
  expect(
    await screen.findByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText(/รหัสผ่านใหม่/, { selector: "#admin-new-password" }),
  ).toHaveValue("");
});

test("a failed health request offers a working retry and preserves available overview data", async () => {
  getDashboardHealth.mockRejectedValueOnce(new Error("unavailable"));
  renderDashboard();
  expect(
    (await screen.findAllByText("โหลดรายการสุขภาพไม่สำเร็จ")).length,
  ).toBeGreaterThan(0);
  expect(screen.getByText("สมาชิกทั้งหมด")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
  expect(await screen.findByText("124/82 mmHg")).toBeInTheDocument();
});

test("member details trap keyboard focus and restore the trigger when closed", async () => {
  renderDashboard();
  const trigger = await screen.findByRole("button", {
    name: "ดูข้อมูล สมาชิก ทดสอบ",
  });
  trigger.focus();
  fireEvent.click(trigger);
  const drawer = await screen.findByRole("dialog", {
    name: "รายละเอียดสมาชิก",
  });
  const approve = await within(drawer).findByRole("button", {
    name: "อนุมัติสมาชิก",
  });
  const close = within(drawer).getByRole("button", {
    name: "ปิดรายละเอียดสมาชิก",
  });
  close.focus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(approve).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test("Thai CV risk uses the exact 10 and 20 percent boundaries and remains separate from BMI", async () => {
  const scores = [0, 9.99, 9.999, 10, 20, 20.001, 20.01, 31];
  getDashboardHealth.mockResolvedValue({
    data: {
      ...healthResponse.data,
      data: {
        ...healthResponse.data.data,
        records: scores.map((score, index) => ({
          ...healthRecord,
          _id: `cv-${index}`,
          user: { ...member, firstName: `คะแนน${score}` },
          thaiCvRisk: { status: "calculated", score },
        })),
      },
    },
  });
  renderDashboard();
  const table = await screen.findByRole("table", {
    name: "บันทึกสุขภาพสมาชิก",
  });
  expect(within(table).getByText("0% · ความเสี่ยงต่ำ")).toBeInTheDocument();
  expect(within(table).getByText("<10% · ความเสี่ยงต่ำ")).toBeInTheDocument();
  expect(
    within(table).getByText("10% · ความเสี่ยงปานกลาง"),
  ).toBeInTheDocument();
  expect(
    within(table).getByText("20% · ความเสี่ยงปานกลาง"),
  ).toBeInTheDocument();
  expect(within(table).getByText("20.01% · ความเสี่ยงสูง")).toBeInTheDocument();
  expect(within(table).getByText(">20% · ความเสี่ยงสูง")).toBeInTheDocument();
  expect(within(table).getByText(">30% · ความเสี่ยงสูง")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("ความเสี่ยง Thai CV"), {
    target: { value: "moderate" },
  });
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(
    within(table).queryByText("9.99% · ความเสี่ยงต่ำ"),
  ).not.toBeInTheDocument();
});

test("legacy BMI risk never becomes a Thai CV score and unavailable remains filterable", async () => {
  getDashboardHealth.mockResolvedValue({
    data: {
      ...healthResponse.data,
      data: {
        ...healthResponse.data.data,
        records: [{ ...healthRecord, cvdRisk: { level: "risk_high" } }],
      },
    },
  });
  renderDashboard();
  const table = await screen.findByRole("table", {
    name: "บันทึกสุขภาพสมาชิก",
  });
  expect(within(table).getByText("ยังไม่มีผลประเมิน")).toBeInTheDocument();
  expect(within(table).getByText("อ้วนระดับ 2 ขึ้นไป")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("ความเสี่ยง Thai CV"), {
    target: { value: "high" },
  });
  expect(screen.getByText("ไม่พบข้อมูลที่ตรงกับตัวกรอง")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("ความเสี่ยง Thai CV"), {
    target: { value: "unavailable" },
  });
  expect(
    screen.getByRole("table", { name: "บันทึกสุขภาพสมาชิก" }),
  ).toBeInTheDocument();
});

test("risk overview opens the entire registry with a server risk filter", async () => {
  getDashboardSummary.mockResolvedValue({
    data: {
      data: {
        totalUsers: 7,
        totalHealthRecords: 11,
        todayHealthRecords: 2,
        thaiCvRisk: {
          low: 3,
          moderate: 2,
          high: 1,
          incomplete: 1,
          ineligible: 0,
          totalCalculated: 6,
        },
      },
    },
  });
  renderDashboard();
  fireEvent.click(
    await screen.findByRole("button", { name: /ความเสี่ยงสูง 1/ }),
  );
  await waitFor(() =>
    expect(getAdminUsers).toHaveBeenLastCalledWith(1, 20, {
      riskLevel: "high",
    }),
  );
  expect(window.location.search).toBe("?view=members&risk=high");
  expect(
    screen.getByRole("link", { name: "เพิ่มผู้รับบริการ" }),
  ).toHaveAttribute("href", "/register");
});

test("settings is a reloadable URL view with the requested fixed threshold ranges", async () => {
  const view = renderDashboard("/admin?view=settings");
  expect(
    screen.getByRole("heading", { name: "ตั้งค่าบัญชี" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("เกณฑ์แสดงผลและการเข้าถึงข้อมูล"),
  ).toBeInTheDocument();
  expect(screen.getByText("น้อยกว่า 10%")).toBeInTheDocument();
  expect(screen.getByText("10–20%")).toBeInTheDocument();
  expect(screen.getByText("มากกว่า 20%")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "รีเฟรชข้อมูล" })).toBeEnabled(),
  );
  const current = window.location.pathname + window.location.search;
  view.unmount();
  renderDashboard(current);
  expect(
    screen.getByRole("heading", { name: "ตั้งค่าบัญชี" }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "รีเฟรชข้อมูล" })).toBeEnabled(),
  );
});

test("staff can issue a six digit password, reveal it once, then closing clears the credential", async () => {
  renderDashboard("/admin?view=members");
  fireEvent.click(await screen.findByRole("button", { name: "ดูรายละเอียด" }));
  const input = await screen.findByLabelText(/กำหนดรหัสผ่านเริ่มต้น/);
  fireEvent.change(input, { target: { value: "012345" } });
  fireEvent.click(
    screen.getByRole("button", { name: "เปิดบัญชีผู้รับบริการ" }),
  );
  await waitFor(() =>
    expect(provisionPatientAccount).toHaveBeenCalledWith("member-1", "012345"),
  );
  const issued = await screen.findByLabelText("รหัสผ่านเริ่มต้นที่ออกให้");
  expect(issued).toHaveAttribute("type", "password");
  expect(issued).toHaveValue("012345");
  fireEvent.click(
    screen.getByRole("button", { name: "แสดงรหัสผ่านเริ่มต้นที่ออกให้" }),
  );
  expect(issued).toHaveAttribute("type", "text");
  expect(localStorage.length).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "ปิดรายละเอียดสมาชิก" }));
  expect(
    screen.queryByLabelText("รหัสผ่านเริ่มต้นที่ออกให้"),
  ).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "ดูรายละเอียด" }));
  expect(await screen.findByLabelText(/กำหนดรหัสผ่านเริ่มต้น/)).toHaveValue("");
});

test("resetting an existing patient account requires a second explicit confirmation", async () => {
  getAdminUser.mockResolvedValue({
    data: { data: { user: { ...member, accountEnabled: true }, health: {} } },
  });
  renderDashboard("/admin?view=members");
  fireEvent.click(await screen.findByRole("button", { name: "ดูรายละเอียด" }));
  fireEvent.change(await screen.findByLabelText(/กำหนดรหัสผ่านเริ่มต้น/), {
    target: { value: "654321" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "ตั้งรหัสผ่านเริ่มต้นใหม่" }),
  );
  expect(provisionPatientAccount).not.toHaveBeenCalled();
  expect(screen.getByText(/รหัสผ่านเดิมใช้ไม่ได้/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันตั้งรหัสใหม่" }));
  await waitFor(() =>
    expect(provisionPatientAccount).toHaveBeenCalledWith("member-1", "654321"),
  );
});
