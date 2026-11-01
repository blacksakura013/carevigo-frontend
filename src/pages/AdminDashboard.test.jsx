import React from "react";
import {
  act,
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
      summaryScope: "all",
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

test("puts four real category totals and the record table first, and filters all records on the server", async () => {
  getDashboardHealth.mockImplementation(async (_page, _limit, filters) => ({ data: { ...healthResponse.data,
    data: { ...healthResponse.data.data, records: filters.type === "sugar" ? [] : [healthRecord] }, total: filters.type === "sugar" ? 0 : 11 } }));
  renderDashboard();
  const counts = screen.getByRole("region", { name: "จำนวนบันทึกสุขภาพแยกตามประเภท" });
  const pressure = await within(counts).findByRole("button", { name: /ความดันโลหิต 5 รายการ/ });
  expect(within(counts).getAllByRole("button")).toHaveLength(4);
  expect(screen.getByRole("heading", { level: 1, name: "แดชบอร์ดสุขภาพ" })).toBeInTheDocument();
  const table = await screen.findByRole("table", { name: "บันทึกสุขภาพสมาชิก" });
  expect(counts.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(table.compareDocumentPosition(screen.getByRole("heading", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือดของสมาชิก" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("img", { name: /ความดันโลหิต 5 รายการ/ })).not.toBeInTheDocument();
  expect(within(table).getByText("124 mmHg")).toBeInTheDocument(); expect(within(table).getByText("82 mmHg")).toBeInTheDocument();
  expect(within(table).getByText("•••••••••0123")).toBeInTheDocument(); expect(table).toHaveTextContent("2569");
  expect(pressure).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(within(counts).getByRole("button", { name: /ระดับน้ำตาล 3 รายการ/ }));
  await waitFor(() => expect(getDashboardHealth).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ type: "sugar" })));
  expect(await screen.findByText("ไม่พบข้อมูลที่ตรงกับตัวกรอง")).toBeInTheDocument();
  expect(within(counts).getByRole("button", { name: /ระดับน้ำตาล 3 รายการ/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
  expect(await screen.findByText("124 mmHg")).toBeInTheDocument();
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
  expect(await screen.findByText("124 mmHg")).toBeInTheDocument();
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
  const rows = scores.map((score, index) => ({ ...healthRecord, _id: `cv-${index}`,
    user: { ...member, firstName: `คะแนน${score}` }, thaiCvRisk: { status: "calculated", score } }));
  getDashboardHealth.mockImplementation(async (_page, _limit, filters) => ({ data: { ...healthResponse.data, data: {
    ...healthResponse.data.data, records: filters.riskLevel === "moderate" ? rows.filter(row => [10,20].includes(row.thaiCvRisk.score)) : rows,
  } } }));
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
  fireEvent.click(screen.getByText("ตัวกรองเพิ่มเติมและการเรียงลำดับ"));
  fireEvent.change(screen.getByLabelText("ความเสี่ยง Thai CV"), { target: { value: "moderate" } });
  await waitFor(() => expect(getDashboardHealth).toHaveBeenLastCalledWith(1,20,expect.objectContaining({ riskLevel: "moderate" })));
  const filtered = await screen.findByRole("table", { name: "บันทึกสุขภาพสมาชิก" });
  expect(within(filtered).getAllByRole("row")).toHaveLength(3);
  expect(within(filtered).queryByText("9.99% · ความเสี่ยงต่ำ")).not.toBeInTheDocument();
});

test("legacy BMI risk never becomes a Thai CV score and unavailable remains filterable", async () => {
  const row = { ...healthRecord, type: "bmi", value: {}, bmi: 30.1, cvdRisk: { level: "risk_high" } };
  getDashboardHealth.mockImplementation(async (_page, _limit, filters) => ({ data: { ...healthResponse.data, data: {
    ...healthResponse.data.data, records: filters.riskLevel === "high" ? [] : [row],
  } } }));
  renderDashboard();
  const table = await screen.findByRole("table", { name: "บันทึกสุขภาพสมาชิก" });
  expect(within(table).getByText("ยังไม่มีผลประเมิน")).toBeInTheDocument();
  expect(within(table).getByText("มีเฉพาะค่า BMI เดิม")).toBeInTheDocument();
  expect(within(table).getByText("30.1 กก./ม²")).toBeInTheDocument();
  fireEvent.click(screen.getByText("ตัวกรองเพิ่มเติมและการเรียงลำดับ"));
  fireEvent.change(screen.getByLabelText("ความเสี่ยง Thai CV"), { target: { value: "high" } });
  expect(await screen.findByText("ไม่พบข้อมูลที่ตรงกับตัวกรอง")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("ความเสี่ยง Thai CV"), { target: { value: "unavailable" } });
  expect(await screen.findByRole("table", { name: "บันทึกสุขภาพสมาชิก" })).toBeInTheDocument();
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

test("all real measurements remain visible and clinical severity is separate from historical ten-year CVD", async () => {
  const risk = { status: "calculated", score: 6.25 };
  const records = [
    { ...healthRecord, _id: "hba1c-only", type: "sugar", value: { hba1c: 6.5 }, reviewStatus: "approved", thaiCvRisk: risk, user: { ...member, thaiCvRisk: { status: "calculated", score: 29 } } },
    { ...healthRecord, _id: "full-lipids", type: "cholesterol", value: { total: 180, ldl: 190, hdl: 55, triglyceride: 120 }, reviewStatus: "pending", thaiCvRisk: risk },
    { ...healthRecord, _id: "pulse", value: { systolic: 137, diastolic: 92, pulse: 72 }, reviewStatus: "approved", thaiCvRisk: risk },
    { ...healthRecord, _id: "legacy-bmi", type: "bmi", value: {}, bmi: 30.1 },
  ];
  getDashboardHealth.mockResolvedValue({ data: { ...healthResponse.data, data: { ...healthResponse.data.data, records } } });
  renderDashboard();
  const table = await screen.findByRole("table", { name: "บันทึกสุขภาพสมาชิก" });
  for (const text of ["6.5 %", "180 mg/dL", "190 mg/dL", "55 mg/dL", "120 mg/dL", "137 mmHg", "92 mmHg", "72 ครั้ง/นาที", "30.1 กก./ม²"])
    expect(within(table).getByText(text, { exact: true })).toBeInTheDocument();
  const sugar = within(table).getAllByRole("row").find(row => within(row).queryByText("6.5 %"));
  expect(sugar.querySelector(".admin-record-level-high")).toBeInTheDocument();
  expect(within(sugar).getByText("6.25% · ความเสี่ยงต่ำ")).toBeInTheDocument();
  expect(sugar).not.toHaveTextContent(/29%|— mg\/dL/); expect(table).not.toHaveTextContent(member.citizenId);
  const legacy = within(table).getAllByRole("row").find(row => within(row).queryByText("30.1 กก./ม²"));
  expect(legacy.querySelector(".admin-record-level-neutral")).toBeInTheDocument();
  expect(legacy).toHaveTextContent("ไม่ระบุสถานะรายการ"); expect(legacy).not.toHaveTextContent("ยืนยันแล้ว");
  expect(screen.getByText(/เมื่อไม่มีวันเกิดจะใช้เกณฑ์ผู้ใหญ่ทั่วไป/)).toBeInTheDocument();
});

test("health pagination and each filter use the server contract and changing a filter resets the page", async () => {
  getDashboardHealth.mockResolvedValue({ data: { ...healthResponse.data, hasMore: true, total: 45 } });
  renderDashboard(); await screen.findByRole("table", { name: "บันทึกสุขภาพสมาชิก" });
  fireEvent.click(screen.getByRole("button", { name: "หน้าถัดไป" }));
  await waitFor(() => expect(getDashboardHealth).toHaveBeenLastCalledWith(2,20,expect.objectContaining({ type: "all" })));
  fireEvent.change(screen.getByLabelText("ประเภทบันทึก"), { target: { value: "sugar" } });
  await waitFor(() => expect(getDashboardHealth).toHaveBeenLastCalledWith(1,20,expect.objectContaining({ type: "sugar" })));
  fireEvent.change(screen.getByLabelText("สถานะรายการ"), { target: { value: "pending" } });
  fireEvent.click(screen.getByText("ตัวกรองเพิ่มเติมและการเรียงลำดับ"));
  fireEvent.change(screen.getByLabelText("ความเสี่ยง Thai CV"), { target: { value: "high" } });
  fireEvent.change(screen.getByLabelText("การจัดกลุ่ม BMI"), { target: { value: "risk_high" } });
  fireEvent.change(screen.getByLabelText("เรียงลำดับบันทึก"), { target: { value: "oldest" } });
  fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาบันทึกสุขภาพ" }), { target: { value: "เชียงใหม่" } });
  await waitFor(() => expect(getDashboardHealth).toHaveBeenLastCalledWith(1,20,{ search: "เชียงใหม่", type: "sugar", reviewStatus: "pending", riskLevel: "high", bmiLevel: "risk_high", sort: "oldest" }));
  expect(screen.getByText(/ค้นหาและกรองรายการทั้งระบบ/)).toBeInTheDocument();
});

test("a late response for an old health search cannot replace the newest server result", async () => {
  let finishOld;
  getDashboardHealth.mockImplementation(async (_page, _limit, filters) => {
    if (filters.search === "เก่า") return new Promise(resolve => { finishOld = resolve; });
    return { data: { ...healthResponse.data, data: { ...healthResponse.data.data, records: [{ ...healthRecord, user: { ...member, firstName: filters.search || "เริ่มต้น" } }] } } };
  });
  renderDashboard(); await screen.findByText("เริ่มต้น ทดสอบ");
  const search = screen.getByRole("textbox", { name: "ค้นหาบันทึกสุขภาพ" });
  fireEvent.change(search, { target: { value: "เก่า" } });
  await waitFor(() => expect(getDashboardHealth).toHaveBeenLastCalledWith(1,20,expect.objectContaining({ search: "เก่า" })));
  fireEvent.change(search, { target: { value: "ใหม่" } });
  expect(await screen.findByText("ใหม่ ทดสอบ")).toBeInTheDocument();
  await act(async () => { finishOld({ data: { ...healthResponse.data, data: { ...healthResponse.data.data, records: [{ ...healthRecord, user: { ...member, firstName: "เก่า" } }] } } }); });
  expect(screen.getByText("ใหม่ ทดสอบ")).toBeInTheDocument(); expect(screen.queryByText("เก่า ทดสอบ")).not.toBeInTheDocument();
});

test("an older backend cannot silently display unfiltered data as server-wide results and upgrading permits retry", async () => {
  const legacy = { ...healthResponse.data.data }; delete legacy.summaryScope;
  getDashboardHealth.mockResolvedValueOnce({ data: { ...healthResponse.data, data: legacy } });
  renderDashboard();
  expect(await screen.findByText(/API ยังไม่รองรับการค้นหาทั้งระบบ/)).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "บันทึกสุขภาพสมาชิก" })).not.toBeInTheDocument();
  expect(screen.queryByText("124 mmHg")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
  expect(await screen.findByRole("table", { name: "บันทึกสุขภาพสมาชิก" })).toBeInTheDocument();
});

test("member drawer history displays HbA1c-only results and every supplied measurement without inventing missing FBS", async () => {
  getAdminUser.mockResolvedValue({ data: { data: { user: member, health: {
    sugar: [{ ...healthRecord, _id: "history-a1c", type: "sugar", value: { hba1c: 6.5 } }],
    cholesterol: [{ ...healthRecord, _id: "history-lipids", type: "cholesterol", value: { total: 180, ldl: 190, hdl: 55, triglyceride: 120 } }],
    blood_pressure: [{ ...healthRecord, _id: "history-bp", value: { systolic: 137, diastolic: 92, pulse: 72 } }],
    bmi: [{ ...healthRecord, _id: "history-bmi", type: "bmi", value: {}, bmi: 30.1 }],
  } } } });
  renderDashboard("/admin?view=members");
  fireEvent.click(await screen.findByRole("button", { name: "ดูรายละเอียด" }));
  const drawer = screen.getByRole("dialog", { name: "รายละเอียดสมาชิก" });
  expect(await within(drawer).findByText("HbA1c 6.5 %", { exact: true })).toBeInTheDocument();
  for (const text of ["ไขมันรวม 180 mg/dL", "LDL 190 mg/dL", "HDL 55 mg/dL", "ไตรกลีเซอไรด์ 120 mg/dL", "ความดันตัวบน 137 mmHg", "ความดันตัวล่าง 92 mmHg", "ชีพจร 72 ครั้ง/นาที", "BMI ที่บันทึก 30.1 กก./ม²"])
    expect(drawer).toHaveTextContent(text);
  expect(within(drawer).queryByText("— mg/dL")).not.toBeInTheDocument();
  expect(getAdminUser).toHaveBeenCalledWith("member-1");
});
