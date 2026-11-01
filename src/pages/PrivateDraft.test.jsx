import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AddHealth from "./AddHealth";
import Profile from "./Profile";
import { addHealth, getPatientProfile, savePatientSession, updatePatientProfile } from "../api/api";
import { beginSessionLoad, clearSession } from "../utils/session";
import { clearPrivateDrafts, readPrivateDraft } from "../utils/privateDraft";
import { apiNotReady } from "../utils/apiReadiness";
jest.mock("../components/FormPages", () => require("../testUtils/InlineFormPages"));

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"), getPatientProfile: jest.fn(), addHealth: jest.fn(), updatePatientProfile: jest.fn() }));
jest.mock("../components/ui", () => ({
  PublicLayout: ({ children }) => <main>{children}</main>,
  PageHeading: ({ title }) => <h1>{title}</h1>,
  Button: ({ children, loading, disabled, variant, ...props }) => <button type="button" {...props} disabled={disabled || loading}>{children}</button>,
  Notice: ({ children, tone }) => <div role={tone === "error" ? "alert" : "status"}>{children}</div>,
  Field: ({ label, id, children, hint, error }) => <div><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}{error && <small role="alert">{error}</small>}</div>,
}));
const citizenId = "1234567890123";
const patient = { _id: "patient-one", citizenId, firstName: "เดิม", lastName: "ทดสอบ", birthDate: "1980-01-02", chronicDiseases: [], thaiCvRisk: { status: "incomplete" } };
const data = (sessionId = "same-session", person = patient) => ({ patient: person, session: { scope: "patient", sessionId, csrfToken: "csrf", expiresAt: new Date(Date.now() + 600000).toISOString() } });
const healthPage = () => <MemoryRouter initialEntries={[`/health/${citizenId}`]}><Routes><Route path="/health/:citizenId" element={<AddHealth />} /></Routes></MemoryRouter>;
const profilePage = () => <MemoryRouter><Profile /></MemoryRouter>;
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const choose = (...titles) => titles.forEach(title => fireEvent.click(screen.getByRole("checkbox", { name: `บันทึก${title}` })));
const accept = () => screen.getAllByRole("checkbox", { name: /ฉันยอมรับ|ฉันยินยอมอย่างชัดแจ้ง/ }).forEach((checkbox) => fireEvent.click(checkbox));
async function readyHealth() { await screen.findByRole("checkbox", { name: "บันทึกความดันโลหิต" }); }
function reverify(rendered, sessionId = "same-session") {
  act(() => beginSessionLoad("patient")); rendered.unmount(); act(() => savePatientSession(data(sessionId)));
}
beforeEach(() => {
  jest.clearAllMocks(); clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null }); clearPrivateDrafts();
  getPatientProfile.mockResolvedValue({ data: { data: { patient } } }); savePatientSession(data());
});
afterEach(() => { clearSession("patient"); clearSession("admin"); clearPrivateDrafts(); });

test("health measurements survive a same-session visibility recheck while consent choices reset", async () => {
  const first = render(healthPage()); await readyHealth(); choose("ความดันโลหิต"); fill("ความดันตัวบน (SYS)", "123"); fill("ความดันตัวล่าง (DIA)", "81"); accept();
  reverify(first); render(healthPage()); await readyHealth();
  expect(screen.getByLabelText("ความดันตัวบน (SYS)")).toHaveValue(123); expect(screen.getByLabelText("ความดันตัวล่าง (DIA)")).toHaveValue(81);
  expect(screen.getByRole("checkbox", { name: "บันทึกความดันโลหิต" })).toBeChecked();
  screen.getAllByRole("checkbox", { name: /ฉันยอมรับ|ฉันยินยอมอย่างชัดแจ้ง/ }).forEach((checkbox) => expect(checkbox).not.toBeChecked());
});
test("a changed session or logout never restores the previous health draft", async () => {
  const first = render(healthPage()); await readyHealth(); choose("ความดันโลหิต"); fill("ความดันตัวบน (SYS)", "123");
  reverify(first, "new-session"); const second = render(healthPage()); await readyHealth(); expect(screen.getByLabelText("ความดันตัวบน (SYS)")).toHaveValue(null);
  choose("ความดันโลหิต"); fill("ความดันตัวบน (SYS)", "130"); second.unmount(); act(() => clearSession("patient", { logout: true }));
  act(() => savePatientSession(data("new-session"))); render(healthPage()); await readyHealth(); expect(screen.getByLabelText("ความดันตัวบน (SYS)")).toHaveValue(null);
});
test("partially saved health sections stay locked after recheck and only failed sections are retried", async () => {
  addHealth.mockImplementation(async (payload) => {
    if (payload.type === "sugar") throw { response: { status: 400 } };
    return { data: { data: { recordId: "saved-bp" } } };
  });
  const first = render(healthPage()); await readyHealth(); choose("ความดันโลหิต", "น้ำตาลในเลือด"); fill("ความดันตัวบน (SYS)", "123"); fill("ความดันตัวล่าง (DIA)", "81"); fill("น้ำตาลขณะอดอาหาร (FBS)", "95"); accept();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" })); await screen.findByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" });
  reverify(first); render(healthPage()); await screen.findByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" });
  expect(screen.getByLabelText("ความดันตัวบน (SYS)")).toBeDisabled(); expect(screen.getByLabelText("น้ำตาลขณะอดอาหาร (FBS)")).not.toBeDisabled();
  addHealth.mockResolvedValue({ data: { data: { recordId: "saved-sugar" } } }); accept();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" })); await waitFor(() => expect(addHealth).toHaveBeenCalledTimes(3));
  expect(addHealth.mock.calls.map(([payload]) => payload.type)).toEqual(["blood_pressure", "sugar", "sugar"]);
});
test("an interrupted pending health write is shown as uncertain and never resent automatically", async () => {
  addHealth.mockImplementation(() => new Promise(() => {}));
  const first = render(healthPage()); await readyHealth(); choose("ความดันโลหิต"); fill("ความดันตัวบน (SYS)", "123"); fill("ความดันตัวล่าง (DIA)", "81"); accept();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" })); await waitFor(() => expect(addHealth).toHaveBeenCalledTimes(1));
  reverify(first); render(healthPage()); await readyHealth();
  expect((await screen.findAllByText(/การส่งข้อมูลก่อนหน้าถูกขัดจังหวะ/)).length).toBeGreaterThan(0); expect(screen.getByRole("link", { name: /ตรวจสอบประวัติสุขภาพ/ })).toBeInTheDocument();
  expect(addHealth).toHaveBeenCalledTimes(1);
});

test("a readiness failure keeps health values retryable without suggesting an unsent record exists", async () => {
  addHealth.mockRejectedValue(apiNotReady());
  render(healthPage()); await readyHealth(); choose("ความดันโลหิต");
  fill("ความดันตัวบน (SYS)", "123"); fill("ความดันตัวล่าง (DIA)", "81"); accept();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" }));
  await screen.findByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" });
  expect(screen.getAllByRole("alert").some(alert => alert.textContent.includes("ข้อมูลที่กรอกยังไม่ถูกส่ง"))).toBe(true);
  expect(screen.queryByRole("link", { name: /ตรวจสอบประวัติสุขภาพ/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("ความดันตัวบน (SYS)")).toHaveValue(123);
  expect(getPatientProfile).toHaveBeenCalledTimes(1);
  expect(addHealth).toHaveBeenCalledTimes(1);
  addHealth.mockResolvedValue({ data: { data: { recordId: "saved-on-retry" } } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" }));
  await waitFor(() => expect(getPatientProfile).toHaveBeenCalledTimes(2));
  expect(addHealth).toHaveBeenCalledTimes(2);
});
test("an unsaved profile change survives the same verified session and clears on account change", async () => {
  const first = render(profilePage()); await screen.findByLabelText("ชื่อ"); fill("ชื่อ", "แก้ไขค้างไว้");
  reverify(first); const second = render(profilePage()); expect(await screen.findByLabelText("ชื่อ")).toHaveValue("แก้ไขค้างไว้");
  reverify(second, "different-session"); render(profilePage()); expect(await screen.findByLabelText("ชื่อ")).toHaveValue("เดิม");
});
test("confirmed profile updates remove the draft instead of restoring it over saved server data", async () => {
  const changed = { ...patient, firstName: "บันทึกแล้ว" };
  updatePatientProfile.mockResolvedValue({ data: { data: { patient: changed } } });
  const first = render(profilePage()); await screen.findByLabelText("ชื่อ"); fill("ชื่อ", changed.firstName); accept();
  fireEvent.click(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ })); await screen.findByText(/บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว/);
  expect(readPrivateDraft("patient", "same-session", "profile")).toBeNull(); getPatientProfile.mockResolvedValue({ data: { data: { patient: changed } } });
  reverify(first); render(profilePage()); expect(await screen.findByLabelText("ชื่อ")).toHaveValue(changed.firstName);
});
test("a committed profile with delayed assessment shows success without stale CV or a duplicate save", async () => {
  const oldRisk = { status: "calculated", score: 6.25, level: "low", label: "ความเสี่ยงต่ำ" };
  const changed = { ...patient, firstName: "บันทึกแล้ว", thaiCvRisk: oldRisk };
  getPatientProfile.mockResolvedValue({ data: { data: { patient: { ...patient, thaiCvRisk: oldRisk } } } });
  updatePatientProfile.mockResolvedValue({ data: { data: { patient: changed, assessmentRefreshPending: true } } });
  render(profilePage()); await screen.findByLabelText("ชื่อ"); expect(screen.getByText("6.25%")).toBeInTheDocument();
  fill("ชื่อ", changed.firstName); accept(); fireEvent.click(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ }));
  expect(await screen.findByText(/บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว/)).toBeInTheDocument();
  expect(screen.getByText(/ผลประเมิน CV risk ยังอัปเดตไม่สำเร็จ/)).toHaveTextContent(/ไม่ต้องบันทึกข้อมูลซ้ำ/);
  expect(screen.queryByText("6.25%")).not.toBeInTheDocument();
  expect(screen.queryByText(/ระบบอัปเดตผลประเมินตามข้อมูลล่าสุด/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ })).toBeDisabled();
  expect(readPrivateDraft("patient", "same-session", "profile")).toBeNull();
  getPatientProfile.mockResolvedValue({ data: { data: { patient: { ...changed, thaiCvRisk: { ...oldRisk, score: 12.5, level: "moderate" } } } } });
  fireEvent.click(screen.getByRole("button", { name: "ลองโหลดผลประเมินอีกครั้ง" }));
  expect(await screen.findByText("12.5%")).toBeInTheDocument(); expect(screen.queryByText(/ผลประเมิน CV risk ยังอัปเดตไม่สำเร็จ/)).not.toBeInTheDocument();
  expect(updatePatientProfile).toHaveBeenCalledTimes(1);
});
