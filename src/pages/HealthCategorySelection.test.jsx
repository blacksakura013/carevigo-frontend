import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AddHealth, { emptyHealthValues } from "./AddHealth";
import GuestHealth from "./GuestHealth";
import { addHealth, getGuestProfile, getPatientProfile, getStoredPatient, hasPatientSession, searchUser, submitGuestHealth } from "../api/api";
import { clearSession, saveSession } from "../utils/session";
import { clearPrivateDrafts, readPrivateDraft, writePrivateDraft } from "../utils/privateDraft";

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"),
  addHealth: jest.fn(), getGuestProfile: jest.fn(), getPatientProfile: jest.fn(), getStoredPatient: jest.fn(),
  hasPatientSession: jest.fn(), searchUser: jest.fn(), submitGuestHealth: jest.fn(),
}));
const person = { citizenId: "8900000000781", firstName: "สมใจ", lastName: "ทดสอบ", birthDate: "19800101", gender: "female" };
const labels = ["ความดันโลหิต", "น้ำตาลในเลือด", "ไขมันในเลือด", "น้ำหนักและส่วนสูง"];
const box = title => screen.getByLabelText(`บันทึก${title}`);
const choose = (...titles) => titles.forEach(title => fireEvent.click(screen.getByRole("checkbox", { name: `บันทึก${title}` })));
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
const change = () => fireEvent.click(screen.getByRole("button", { name: "เปลี่ยนรายการสุขภาพ" }));
const consent = () => {
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ }));
};
const guestPage = () => render(<MemoryRouter initialEntries={["/guest"]}><GuestHealth /></MemoryRouter>);
const privatePage = () => render(<MemoryRouter initialEntries={[`/health/${person.citizenId}`]}><Routes>
  <Route path="/health/:citizenId" element={<AddHealth />} />
</Routes></MemoryRouter>);
const guestChooser = () => {
  fill(/^เลขบัตรประชาชน/, person.citizenId); fill(/^ชื่อ/, person.firstName); fill(/^นามสกุล/, person.lastName);
  next(); next();
};
const metadata = () => ({ patient: person, session: {
  scope: "patient", sessionId: "selection-same-session", csrfToken: "synthetic-csrf", expiresAt: new Date(Date.now() + 600000).toISOString(),
} });

beforeEach(() => {
  jest.clearAllMocks(); clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null }); clearPrivateDrafts();
  Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto, configurable: true });
  hasPatientSession.mockReturnValue(true); getStoredPatient.mockReturnValue(person);
  getGuestProfile.mockResolvedValue({ data: { data: null } });
  getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } }); searchUser.mockResolvedValue({ data: { data: person } });
  addHealth.mockResolvedValue({ data: { data: {} } });
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "selected-entry", recordIds: [] } } });
  saveSession("patient", metadata());
});
afterEach(() => { clearSession("patient"); clearSession("admin"); clearPrivateDrafts(); });

test("guest defaults to no categories and sends only profile plus consent without visiting clinical pages", async () => {
  guestPage(); guestChooser();
  labels.forEach(title => expect(box(title)).not.toBeChecked());
  expect(screen.getByText("ขั้นตอนที่ 3 จาก 4")).toBeVisible();
  expect(screen.getByLabelText(/^ความดันตัวบน/)).not.toBeVisible();
  expect(screen.getByLabelText(/^ความดันตัวบน/)).toBeDisabled();
  next(); consent(); fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByRole("heading", { name: "ส่งข้อมูลผู้รับบริการเรียบร้อยแล้ว" });
  expect(submitGuestHealth).toHaveBeenCalledWith(expect.objectContaining({ records: [] }), expect.any(Object));
  expect(screen.getByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).toHaveTextContent("0 รายการ");
  expect(addHealth).not.toHaveBeenCalled();
});

test("a selected but blank category stays optional and is omitted from the actual guest records and interpretation", async () => {
  guestPage(); guestChooser(); choose("น้ำตาลในเลือด", "น้ำหนักและส่วนสูง"); next();
  fill(/^น้ำตาลสะสม/, "5.8"); next();
  expect(screen.getByLabelText(/^น้ำหนัก(?:\s*\*)?$/)).toBeVisible(); next(); consent();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(submitGuestHealth.mock.calls[0][0].records).toEqual([{ type: "sugar", value: { hba1c: 5.8 } }]);
  expect(screen.getByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" })).not.toHaveTextContent(/BMI|น้ำหนักและส่วนสูง|กก\./);
});

test("deselecting a partly entered guest category excludes its validation, payload and both summaries while identical retries keep their key", async () => {
  submitGuestHealth.mockRejectedValueOnce({ response: { status: 503 } });
  guestPage(); guestChooser(); choose("ความดันโลหิต", "น้ำตาลในเลือด"); next();
  fill(/^ความดันตัวบน/, "199"); change(); choose("ความดันโลหิต"); next();
  expect(screen.getByLabelText(/^น้ำตาลสะสม/)).toBeVisible();
  expect(screen.getByLabelText(/^ความดันตัวบน/)).toHaveValue(199);
  expect(screen.getByLabelText(/^ความดันตัวบน/)).toBeDisabled();
  fill(/^น้ำตาลสะสม/, "5.8"); next();
  const review = screen.getByRole("region", { name: "ตรวจสอบผลตรวจที่กรอกครั้งนี้" });
  expect(review).toHaveTextContent("5.8 %"); expect(review).not.toHaveTextContent(/ความดัน|199/);
  consent(); fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByText(/ข้อมูลที่กรอกยังอยู่ การส่งข้อมูลเดิมซ้ำ/);
  const first = submitGuestHealth.mock.calls[0][0];
  expect(first.records).toEqual([{ type: "sugar", value: { hba1c: 5.8 } }]);
  change(); choose("ความดันโลหิต"); choose("ความดันโลหิต"); next(); next();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(submitGuestHealth.mock.calls[1][0]).toEqual(first);
  const accepted = screen.getByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" });
  const results = within(accepted).getByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" });
  expect(results).toHaveTextContent("5.8 %"); expect(results).not.toHaveTextContent(/199|ความดันโลหิต|mmHg/);
});

test("guest reselection restores entered values and changing the submitted categories creates a new request key", async () => {
  submitGuestHealth.mockRejectedValue({ response: { status: 503 } });
  guestPage(); guestChooser(); choose("ความดันโลหิต", "น้ำตาลในเลือด"); next();
  fill(/^ความดันตัวบน/, "120"); fill(/^ความดันตัวล่าง/, "80"); next(); fill(/^น้ำตาลขณะอดอาหาร/, "95"); next(); consent();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByText(/ข้อมูลที่กรอกยังอยู่ การส่งข้อมูลเดิมซ้ำ/);
  const first = submitGuestHealth.mock.calls[0][0];
  change(); choose("น้ำตาลในเลือด"); next(); next();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await waitFor(() => expect(submitGuestHealth).toHaveBeenCalledTimes(2));
  const second = submitGuestHealth.mock.calls[1][0];
  expect(second.records).toEqual([{ type: "blood_pressure", value: { systolic: 120, diastolic: 80 } }]);
  expect(second.clientRequestId).not.toBe(first.clientRequestId);
  await screen.findByText(/ข้อมูลที่กรอกยังอยู่ การส่งข้อมูลเดิมซ้ำ/);
  change(); choose("น้ำตาลในเลือด"); next(); next();
  expect(screen.getByLabelText(/^น้ำตาลขณะอดอาหาร/)).toBeVisible();
  expect(screen.getByLabelText(/^น้ำตาลขณะอดอาหาร/)).toHaveValue(95);
});

test("guest person changes and a successful new-entry reset clear category choices", async () => {
  guestPage(); guestChooser(); choose("น้ำตาลในเลือด");
  fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
  fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
  fill(/^เลขบัตรประชาชน/, "8900000000782"); fill(/^ชื่อ/, "คนใหม่"); fill(/^นามสกุล/, "ทดสอบ"); next(); next();
  labels.forEach(title => expect(box(title)).not.toBeChecked());
  choose("น้ำตาลในเลือด"); next(); fill(/^น้ำตาลสะสม/, "5.8"); next(); consent();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกรายการใหม่" }));
  labels.forEach(title => expect(box(title)).not.toBeChecked());
  expect(screen.getByLabelText(/^น้ำตาลสะสม/)).toHaveValue(null);
});

test("private saved categories stay checked and locked while an excluded failure stops retrying and can later be reselected", async () => {
  addHealth.mockImplementation(async ({ type }) => {
    if (type === "sugar") throw { response: { status: 400 } };
    return { data: { data: { recordId: "saved-pressure" } } };
  });
  privatePage(); await screen.findByRole("checkbox", { name: "บันทึกความดันโลหิต" });
  choose("ความดันโลหิต", "น้ำตาลในเลือด"); next(); fill(/^ความดันตัวบน/, "120"); fill(/^ความดันตัวล่าง/, "80");
  next(); fill(/^น้ำตาลขณะอดอาหาร/, "343"); next(); consent();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ", exact: true }));
  await screen.findByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" }); change();
  expect(box("ความดันโลหิต")).toBeChecked(); expect(box("ความดันโลหิต")).toBeDisabled();
  fireEvent.click(box("ความดันโลหิต")); expect(box("ความดันโลหิต")).toBeChecked();
  choose("น้ำตาลในเลือด"); next(); next();
  expect(screen.queryByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "บันทึกครั้งใหม่" })).toBeVisible();
  expect(screen.getByRole("region", { name: "ตรวจสอบผลตรวจที่กรอกครั้งนี้" })).not.toHaveTextContent(/343|น้ำตาล/);
  expect(addHealth).toHaveBeenCalledTimes(2);
  change(); choose("น้ำตาลในเลือด"); next(); next();
  expect(screen.getByLabelText(/^น้ำตาลขณะอดอาหาร/)).toHaveValue(343); next();
  addHealth.mockResolvedValue({ data: { data: { recordId: "saved-sugar" } } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" }));
  await screen.findByRole("button", { name: "บันทึกครั้งใหม่" });
  expect(addHealth.mock.calls.map(([payload]) => payload.type)).toEqual(["blood_pressure", "sugar", "sugar"]);
});

test("private drafts preserve explicit selections and hidden input, including an empty selected category, with fresh consent", async () => {
  const values = emptyHealthValues(); values.blood_pressure.systolic = "199"; values.sugar.hba1c = "5.8";
  expect(writePrivateDraft("patient", "selection-same-session", `health:${person.citizenId}`, { values, selectedTypes: ["sugar"], step: "measurements" })).toBe(true);
  const first = privatePage(); await screen.findByRole("checkbox", { name: "บันทึกความดันโลหิต" });
  expect(box("ความดันโลหิต")).not.toBeChecked(); expect(box("น้ำตาลในเลือด")).toBeChecked();
  expect(screen.getByLabelText(/^ความดันตัวบน/)).toHaveValue(199); expect(screen.getByLabelText(/^ความดันตัวบน/)).toBeDisabled();
  choose("น้ำตาลในเลือด", "น้ำหนักและส่วนสูง");
  await waitFor(() => expect(readPrivateDraft("patient", "selection-same-session", `health:${person.citizenId}`)?.selectedTypes).toEqual(["bmi"]));
  first.unmount(); privatePage(); await screen.findByRole("checkbox", { name: "บันทึกความดันโลหิต" });
  expect(box("น้ำหนักและส่วนสูง")).toBeChecked(); expect(box("น้ำตาลในเลือด")).not.toBeChecked(); expect(box("ความดันโลหิต")).not.toBeChecked();
  expect(screen.getByLabelText(/^น้ำตาลสะสม/)).toHaveValue(5.8); next();
  expect(screen.getByLabelText(/^น้ำหนัก(?:\s*\*)?$/)).toBeVisible(); expect(screen.getByLabelText(/^น้ำหนัก(?:\s*\*)?$/)).toHaveValue(null);
  next(); expect(screen.getByRole("button", { name: "ข้ามการบันทึกครั้งนี้" })).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: /ฉันยอมรับ/ })).not.toBeInTheDocument(); expect(addHealth).not.toHaveBeenCalled();
});

test("legacy private drafts infer saved and interrupted categories without resending and require fresh consent", async () => {
  const values = emptyHealthValues(); values.blood_pressure = { systolic: "120", diastolic: "80", pulse: "" }; values.sugar.fbs = "95";
  expect(writePrivateDraft("patient", "selection-same-session", `health:${person.citizenId}`, { values, step: "review", outcomes: {
    blood_pressure: { status: "success", data: {} }, sugar: { status: "pending" },
  } })).toBe(true);
  privatePage(); await screen.findByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" });
  expect(box("ความดันโลหิต")).toBeChecked(); expect(box("ความดันโลหิต")).toBeDisabled(); expect(box("น้ำตาลในเลือด")).toBeChecked();
  expect(screen.getAllByText(/การส่งข้อมูลก่อนหน้าถูกขัดจังหวะ/).length).toBeGreaterThan(0);
  expect(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ })).not.toBeChecked();
  expect(addHealth).not.toHaveBeenCalled();
});

test("an explicit empty private selection survives remount despite retained measurements and an obsolete clinical step", async () => {
  const values = emptyHealthValues(); values.blood_pressure.systolic = "199";
  expect(writePrivateDraft("patient", "selection-same-session", `health:${person.citizenId}`, {
    values, selectedTypes: [], step: "blood_pressure",
  })).toBe(true);
  const first = privatePage(); await screen.findByRole("checkbox", { name: "บันทึกความดันโลหิต" });
  labels.forEach(title => expect(box(title)).not.toBeChecked());
  expect(screen.getByText("ขั้นตอนที่ 1 จาก 2")).toBeVisible();
  expect(screen.getByLabelText(/^ความดันตัวบน/)).toHaveValue(199); expect(screen.getByLabelText(/^ความดันตัวบน/)).toBeDisabled();
  await waitFor(() => expect(readPrivateDraft("patient", "selection-same-session", `health:${person.citizenId}`)).toMatchObject({ selectedTypes: [], step: "measurements" }));
  first.unmount(); privatePage(); await screen.findByRole("checkbox", { name: "บันทึกความดันโลหิต" });
  labels.forEach(title => expect(box(title)).not.toBeChecked()); next();
  expect(screen.getByRole("region", { name: "ตรวจสอบผลตรวจที่กรอกครั้งนี้" })).not.toHaveTextContent(/199|mmHg/);
  expect(screen.getByRole("button", { name: "ข้ามการบันทึกครั้งนี้" })).toBeVisible();
  expect(addHealth).not.toHaveBeenCalled(); change(); choose("ความดันโลหิต"); next();
  expect(screen.getByLabelText(/^ความดันตัวบน/)).toBeVisible(); expect(screen.getByLabelText(/^ความดันตัวบน/)).toHaveValue(199);
});
