import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import HealthProgress from "./HealthProgress";
import { getHealthProgress, getStoredPatient } from "../api/api";
import { clearSession, saveSession } from "../utils/session";
import { progressFixture, progressPatient } from "../testUtils/healthProgress";

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"), getHealthProgress: jest.fn(), getStoredPatient: jest.fn() }));
const otherId = "8900000000842";
const response = data => ({ data: { data } });
const records = () => screen.getByRole("region", { name: "รายการและความคืบหน้าการตรวจสอบ" });
const session = (scope, profile) => ({ [scope === "patient" ? "patient" : "admin"]: profile,
  session: { scope, sessionId: `progress-${scope}`, csrfToken: "synthetic-csrf", expiresAt: new Date(Date.now() + 600000).toISOString() } });
function RouteChange() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(`/admin/progress/${otherId}`)}>เปิดสมาชิกอื่น</button>;
}
function RangeChange() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("?from=2026-02-01&to=2026-02-28")}>เปลี่ยนช่วงจากลิงก์</button>;
}
const mount = (staff = false, id = progressPatient.citizenId) => render(<MemoryRouter initialEntries={[`${staff ? "/admin" : ""}/progress/${id}`]}>
  <Routes><Route path={staff ? "/admin/progress/:citizenId" : "/progress/:citizenId"} element={<><HealthProgress staffMode={staff} />{staff && <RouteChange />}</>} /></Routes>
</MemoryRouter>);
beforeEach(() => {
  jest.clearAllMocks(); clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null });
  saveSession("patient", session("patient", progressPatient));
  saveSession("admin", session("admin", { role: "admin", email: "progress@example.test" }));
  getStoredPatient.mockReturnValue(progressPatient);
  getHealthProgress.mockImplementation(params => Promise.resolve(response(progressFixture(params.citizenId))));
});
afterEach(() => { clearSession("patient"); clearSession("admin"); });

test("a member always requests their own history while staff context can request another member with explicit admin scope", async () => {
  const view = mount(false, otherId);
  await screen.findByRole("heading", { name: "สมใจ ทดสอบ" });
  expect(getHealthProgress).toHaveBeenLastCalledWith(expect.objectContaining({ citizenId: progressPatient.citizenId, days: "90", limit: 20 }), expect.objectContaining({ sessionScope: "patient" }));
  view.unmount(); mount(true, otherId);
  await screen.findByText("มุมมองเจ้าหน้าที่ · ข้อมูลสมาชิกที่เลือก");
  expect(getHealthProgress).toHaveBeenLastCalledWith(expect.objectContaining({ citizenId: otherId }), expect.objectContaining({ sessionScope: "admin" }));
  screen.getAllByRole("link", { name: /แดชบอร์ดเจ้าหน้าที่/ }).forEach(link => expect(link).toHaveAttribute("href", "/admin"));
});

test("an individual report link uses its original period before the first read and provides a matching return link", async () => {
  render(<MemoryRouter initialEntries={[`/admin/progress/${otherId}?from=2026-01-01&to=2026-06-30`]}>
    <Routes><Route path="/admin/progress/:citizenId" element={<HealthProgress staffMode />} /></Routes>
  </MemoryRouter>);
  await screen.findByText("มุมมองเจ้าหน้าที่ · ข้อมูลสมาชิกที่เลือก");
  expect(getHealthProgress.mock.calls[0][0]).toMatchObject({ citizenId: otherId, from: "2026-01-01", to: "2026-06-30" });
  expect(getHealthProgress.mock.calls[0][0].days).toBeUndefined();
  expect(screen.getAllByRole("link", { name: "รายงานกลุ่มโรคและช่วงเวลา" }).some(link => link.getAttribute("href") === "/admin?view=reports&from=2026-01-01&to=2026-06-30")).toBe(true);
});

test("query-only navigation immediately follows the new report period on the same mounted member route", async () => {
  render(<MemoryRouter initialEntries={[`/admin/progress/${otherId}?from=2026-01-01&to=2026-01-31`]}>
    <Routes><Route path="/admin/progress/:citizenId" element={<><HealthProgress staffMode /><RangeChange /></>} /></Routes>
  </MemoryRouter>);
  await screen.findByText("มุมมองเจ้าหน้าที่ · ข้อมูลสมาชิกที่เลือก");
  fireEvent.click(screen.getByRole("button", { name: "เปลี่ยนช่วงจากลิงก์" }));
  await waitFor(() => expect(getHealthProgress.mock.calls.at(-1)[0]).toMatchObject({ from: "2026-02-01", to: "2026-02-28" }));
  expect(screen.getByLabelText("วันที่เริ่มต้น (พ.ศ.)")).toHaveValue("01/02/2569");
});

test("date presets and manual Buddhist dates send Gregorian ranges and invalid custom dates do not send a query", async () => {
  mount(); await screen.findByRole("heading", { name: "สมใจ ทดสอบ" });
  fireEvent.click(screen.getByRole("button", { name: "30 วัน", exact: true }));
  await waitFor(() => expect(getHealthProgress.mock.calls.at(-1)[0]).toMatchObject({ days: "30", page: 1 }));
  fireEvent.change(screen.getByLabelText("วันที่เริ่มต้น (พ.ศ.)"), { target: { value: "01/01/2569" } });
  fireEvent.change(screen.getByLabelText("วันที่สิ้นสุด (พ.ศ.)"), { target: { value: "31/01/2569" } });
  fireEvent.click(screen.getByRole("button", { name: "ใช้ช่วงวันที่นี้" }));
  await waitFor(() => expect(getHealthProgress.mock.calls.at(-1)[0]).toMatchObject({ from: "2026-01-01", to: "2026-01-31", page: 1 }));
  expect(getHealthProgress.mock.calls.at(-1)[0].days).toBeUndefined();
  const count = getHealthProgress.mock.calls.length;
  fireEvent.change(screen.getByLabelText("วันที่เริ่มต้น (พ.ศ.)"), { target: { value: "31/02/2569" } });
  fireEvent.click(screen.getByRole("button", { name: "ใช้ช่วงวันที่นี้" }));
  expect(screen.getByRole("alert")).toHaveTextContent("กรุณาระบุวันเริ่มต้น"); expect(getHealthProgress).toHaveBeenCalledTimes(count);
});

test("detail filtering hides old rows during a held read and preserves the chosen metric and full-period summary through failure and retry", async () => {
  let fail;
  getHealthProgress.mockImplementationOnce(params => Promise.resolve(response(progressFixture(params.citizenId))))
    .mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }));
  mount(); await screen.findByRole("heading", { name: "สมใจ ทดสอบ" });
  fireEvent.change(screen.getByLabelText("เลือกค่าที่ต้องการติดตาม"), { target: { value: "pulse" } });
  fireEvent.change(screen.getByLabelText("สถานะรายการที่ต้องการดู"), { target: { value: "pending" } });
  await waitFor(() => expect(getHealthProgress).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("เลือกค่าที่ต้องการติดตาม")).toHaveValue("pulse");
  expect(within(records()).queryByRole("heading", { name: "ความดันโลหิต" })).not.toBeInTheDocument();
  await act(async () => fail(new Error("synthetic offline")));
  expect(screen.getByRole("alert")).toHaveTextContent("แสดงผลที่โหลดไว้ก่อนหน้า");
  expect(screen.getByLabelText("เลือกค่าที่ต้องการติดตาม")).toHaveValue("pulse");
  const pending = progressFixture(); pending.records = [{ _id: "pending-sugar", type: "sugar", value: { fbs: 101 }, reviewStatus: "pending", recordedAt: "2026-11-01T03:00:00.000Z", reviewHistory: [] }];
  pending.pagination = { ...pending.pagination, reviewStatus: "pending", total: 1 };
  getHealthProgress.mockResolvedValue(response(pending));
  fireEvent.click(screen.getByRole("button", { name: "ลองโหลดอีกครั้ง" }));
  await waitFor(() => expect(within(records()).getByRole("heading", { name: "น้ำตาลในเลือด" })).toBeVisible());
  expect(screen.getByLabelText("เลือกค่าที่ต้องการติดตาม")).toHaveValue("pulse");
  expect(getHealthProgress.mock.calls.at(-1)[0]).toMatchObject({ reviewStatus: "pending", page: 1 });
});

test("switching staff identities cancels the old read, starts page one and never displays a late result for the prior person", async () => {
  let finish;
  const first = progressFixture(); first.pagination = { ...first.pagination, total: 42, hasMore: true };
  first.summary = { ...first.summary, total: 42, approved: 41, byType: { blood_pressure: 41, sugar: 1, cholesterol: 0, bmi: 0 } };
  getHealthProgress.mockResolvedValueOnce(response(first)).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockImplementation(params => Promise.resolve(response({ ...progressFixture(params.citizenId), patient: { ...progressPatient, citizenId: params.citizenId, firstName: "สมาชิกใหม่" } })));
  mount(true); await screen.findByRole("heading", { name: "สมใจ ทดสอบ" });
  fireEvent.click(screen.getByRole("button", { name: "หน้าถัดไป" })); await waitFor(() => expect(getHealthProgress).toHaveBeenCalledTimes(2));
  const oldOptions = getHealthProgress.mock.calls[1][1];
  fireEvent.click(screen.getByRole("button", { name: "เปิดสมาชิกอื่น" }));
  expect(screen.queryByRole("heading", { name: "สมใจ ทดสอบ" })).not.toBeInTheDocument();
  await screen.findByRole("heading", { name: "สมาชิกใหม่ ทดสอบ" });
  expect(oldOptions.signal.aborted).toBe(true); expect(oldOptions.isCurrent()).toBe(false);
  expect(getHealthProgress.mock.calls.at(-1)[0]).toMatchObject({ citizenId: otherId, page: 1 });
  await act(async () => finish(response(first)));
  expect(screen.queryByRole("heading", { name: "สมใจ ทดสอบ" })).not.toBeInTheDocument();
});

test("older or malformed API responses show a service error rather than invented empty progress, and explicit retry recovers", async () => {
  getHealthProgress.mockResolvedValueOnce({ data: { data: [] } });
  mount(); await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("ระบบติดตามผลยังไม่พร้อมแสดงข้อมูล");
  expect(screen.queryByRole("region", { name: "ความเปลี่ยนแปลงสุขภาพ" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ลองโหลดอีกครั้ง" }));
  await screen.findByRole("heading", { name: "สมใจ ทดสอบ" });
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("unmount cancels queued progress reads without retaining personal results in browser storage", async () => {
  let finish;
  getHealthProgress.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await waitFor(() => expect(getHealthProgress).toHaveBeenCalledTimes(1));
  const options = getHealthProgress.mock.calls[0][1]; view.unmount();
  expect(options.signal.aborted).toBe(true); expect(options.isCurrent()).toBe(false);
  await act(async () => finish(response(progressFixture())));
  expect(screen.queryByText("สมใจ ทดสอบ")).not.toBeInTheDocument();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("historical urgent guidance shows its recorded date and current-symptom caveat before action details", async () => {
  const data = progressFixture();
  data.latestApprovedRecords[0] = { ...data.latestApprovedRecords[0], value: { systolic: 190, diastolic: 110 } };
  getHealthProgress.mockResolvedValue(response(data)); mount();
  await screen.findByRole("heading", { name: "สมใจ ทดสอบ" });
  const guidance = screen.getByRole("region", { name: "สิ่งที่ควรติดตามจากผลล่าสุด" });
  const summary = within(guidance).getByText(/ความดันโลหิต · ความดันสูงมาก/, { selector: "summary" });
  expect(summary).toHaveTextContent("2569"); fireEvent.click(summary);
  expect(within(guidance).getByText(/ตรวจสอบอาการและผลตรวจล่าสุด.*หากค่านี้ยังเป็นปัจจุบัน/)).toBeVisible();
  expect(within(guidance).getByText("แปลผลจากค่าตามวันที่บันทึก ไม่ใช่การยืนยันอาการปัจจุบัน")).toBeVisible();
});
