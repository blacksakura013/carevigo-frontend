import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestHealth from "./GuestHealth";
import AddHealth, { emptyHealthValues } from "./AddHealth";
import { addHealth, getGuestProfile, getPatientProfile, getStoredPatient, hasPatientSession, searchUser, submitGuestHealth } from "../api/api";
import { clearSession, saveSession } from "../utils/session";
import { clearPrivateDrafts, writePrivateDraft } from "../utils/privateDraft";

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"), addHealth: jest.fn(), getGuestProfile: jest.fn(), getPatientProfile: jest.fn(),
  getStoredPatient: jest.fn(), hasPatientSession: jest.fn(), searchUser: jest.fn(), submitGuestHealth: jest.fn() }));
const person = { citizenId: "8900000000701", firstName: "สมใจ", lastName: "ทดสอบ", birthDate: "19800101", gender: "female" };
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
const nextTimes = count => { for (let i = 0; i < count; i += 1) next(); };
const choose = (...titles) => titles.forEach(title => fireEvent.click(screen.getByRole("checkbox", { name: `บันทึก${title}` })));
const accept = () => {
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ }));
};
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null });
  Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto, configurable: true });
  getGuestProfile.mockResolvedValue({ data: { data: null } }); hasPatientSession.mockReturnValue(true); getStoredPatient.mockReturnValue(person);
  getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } }); searchUser.mockResolvedValue({ data: { data: person } });
});
afterEach(() => { clearSession("patient"); clearSession("admin"); clearPrivateDrafts(); });

test("accepted guest shows acute guidance before its separate ten-year risk and reset control using only entered measurements", async () => {
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "current-entry", recordIds: ["bp", "sugar"],
    thaiCvRisk: { status: "calculated", score: 12.34 }, records: [{ type: "cholesterol", value: { total: 999 } }] } } });
  render(<MemoryRouter initialEntries={["/guest"]}><GuestHealth /></MemoryRouter>);
  fill(/^เลขบัตรประชาชน/, person.citizenId); fill(/^ชื่อ/, person.firstName); fill(/^นามสกุล/, person.lastName);
  nextTimes(2); choose("ความดันโลหิต", "น้ำตาลในเลือด"); next();
  fill(/^ความดันตัวบน/, "137"); fill(/^ความดันตัวล่าง/, "92"); next(); fill(/^น้ำตาลขณะอดอาหาร/, "343"); next(); accept();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  const accepted = await screen.findByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" });
  const result = within(accepted).getByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" });
  const urgent = within(result).getByRole("region", { name: "คำแนะนำเร่งด่วน" });
  const cvd = within(accepted).getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" });
  const reset = within(accepted).getByRole("button", { name: "บันทึกรายการใหม่" });
  expect(urgent.compareDocumentPosition(cvd) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(urgent.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const text of ["137 mmHg", "92 mmHg", "343 mg/dL"]) expect(within(result).getByText(text, { exact: true })).toBeVisible();
  expect(result.querySelector('[data-result-type="sugar"]')).toHaveClass("health-result-urgent");
  expect(cvd).toHaveClass("patient-cv-risk-moderate"); expect(cvd).toHaveTextContent("12.34%");
  expect(result).not.toHaveTextContent(/999|ไขมันรวม|BMI/); expect(getPatientProfile).not.toHaveBeenCalled(); expect(searchUser).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  fireEvent.click(reset); expect(screen.queryByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" })).not.toBeInTheDocument();
});

test("partial signed-in saves summarize successful sections only and add the failed category only after retry succeeds", async () => {
  addHealth.mockImplementationOnce(async () => ({ data: { data: {} } }))
    .mockRejectedValueOnce({ response: { status: 400 } }).mockResolvedValue({ data: { data: {} } });
  render(<MemoryRouter initialEntries={[`/health/${person.citizenId}`]}><Routes><Route path="/health/:citizenId" element={<AddHealth />} /></Routes></MemoryRouter>);
  await screen.findByRole("checkbox", { name: "บันทึกความดันโลหิต" }); choose("ความดันโลหิต", "น้ำตาลในเลือด"); next();
  fill(/^ความดันตัวบน/, "137"); fill(/^ความดันตัวล่าง/, "92"); next();
  fill(/^น้ำตาลขณะอดอาหาร/, "343"); next(); accept();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ", exact: true }));
  const result = await screen.findByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" });
  await screen.findByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" });
  expect(result.querySelector('[data-result-type="blood_pressure"]')).toBeInTheDocument();
  expect(result.querySelector('[data-result-type="sugar"]')).not.toBeInTheDocument(); expect(result).not.toHaveTextContent("343 mg/dL");
  expect(within(result).queryByRole("region", { name: "คำแนะนำเร่งด่วน" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" }));
  await waitFor(() => expect(within(result).getByText("343 mg/dL", { exact: true })).toBeVisible());
  expect(within(result).getByRole("region", { name: "คำแนะนำเร่งด่วน" })).toBeInTheDocument();
  expect(addHealth.mock.calls.filter(([payload]) => payload.type === "blood_pressure")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกครั้งใหม่" }));
  expect(screen.queryByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" })).not.toBeInTheDocument();
});

test("a restored saved pediatric draft waits for profile verification before interpreting with age-specific guidance", async () => {
  const child = { ...person, birthDate: "20170101" };
  saveSession("patient", { patient: child, session: { scope: "patient", sessionId: "pediatric-current", csrfToken: "synthetic-csrf", expiresAt: new Date(Date.now() + 600000).toISOString() } });
  getStoredPatient.mockReturnValue(child);
  const values = emptyHealthValues(); values.bmi = { weight: "60", height: "165" };
  expect(writePrivateDraft("patient", "pediatric-current", `health:${child.citizenId}`, { values, outcomes: { bmi: { status: "success", data: { bmi: 22.04 } } }, step: "review" })).toBe(true);
  let verify; getPatientProfile.mockImplementation(() => new Promise(resolve => { verify = resolve; }));
  render(<MemoryRouter initialEntries={[`/health/${child.citizenId}`]}><Routes><Route path="/health/:citizenId" element={<AddHealth />} /></Routes></MemoryRouter>);
  expect(screen.getByText(/บันทึกข้อมูลเรียบร้อยแล้ว 1 ส่วน/)).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" })).not.toBeInTheDocument();
  await act(async () => { verify({ data: { data: { patient: child } } }); });
  const result = screen.getByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" });
  expect(result.querySelector('[data-result-type="bmi"]')).toHaveClass("health-result-neutral");
  expect(result).toHaveTextContent("ต้องใช้เกณฑ์ตามอายุ"); expect(within(result).getByText("60 กก.", { exact: true })).toBeVisible();
  expect(addHealth).not.toHaveBeenCalled();
});
