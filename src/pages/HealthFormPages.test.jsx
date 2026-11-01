import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import AddHealth from "./AddHealth";
import GuestHealth from "./GuestHealth";
import { addHealth, getPatientProfile, getStoredPatient, hasPatientSession, searchUser, submitGuestHealth } from "../api/api";
import { clearSession, saveSession } from "../utils/session";

jest.mock("../api/api", () => ({
  ...jest.requireActual("../api/api"),
  addHealth: jest.fn(), getPatientProfile: jest.fn(), getStoredPatient: jest.fn(),
  hasPatientSession: jest.fn(), hasAdminSession: jest.fn(() => false),
  searchUser: jest.fn(), submitGuestHealth: jest.fn(), getGuestProfile: jest.fn(() => Promise.resolve({ data: { data: null } })),
}));

const person = { citizenId: "1234567890123", firstName: "สมใจ", lastName: "ทดสอบ", thaiCvRisk: { status: "incomplete" } };
const field = (label) => screen.getByLabelText(label);
const fill = (label, value) => fireEvent.change(field(label), { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
const back = () => fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
const nextTimes = (count) => { for (let index = 0; index < count; index += 1) next(); };
const backTimes = (count) => { for (let index = 0; index < count; index += 1) back(); };
const accept = () => {
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ }));
};
const guest = () => render(<MemoryRouter initialEntries={["/guest"]}><GuestHealth /></MemoryRouter>);
const health = () => render(<MemoryRouter initialEntries={[`/health/${person.citizenId}`]}><Routes><Route path="/health/:citizenId" element={<AddHealth />} /></Routes></MemoryRouter>);
const fillPersonal = () => {
  fill(/^เลขบัตรประชาชน/, person.citizenId);
  fill(/^ชื่อ/, person.firstName);
  fill(/^นามสกุล/, person.lastName);
};
const fillPressure = () => {
  fill(/^ความดันตัวบน/, "120");
  fill(/^ความดันตัวล่าง/, "80");
};

beforeEach(() => {
  jest.clearAllMocks();
  clearSession("patient", { endedBy: null });
  clearSession("admin", { endedBy: null });
  hasPatientSession.mockReturnValue(false);
  getStoredPatient.mockReturnValue(null);
  getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } });
  searchUser.mockResolvedValue({ data: { data: person } });
  Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto, configurable: true });
});

test("guest shows one section, validates before advancing, and Enter moves forward without submitting", async () => {
  guest();
  expect(field(/^ชื่อ/)).toBeVisible();
  expect(field(/^ความดันตัวบน/)).not.toBeVisible();
  expect(screen.queryByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ })).not.toBeInTheDocument();
  next();
  expect(field(/^เลขบัตรประชาชน/)).toHaveFocus();
  fillPersonal();
  userEvent.type(field(/^นามสกุล/), "{enter}");
  await waitFor(() => expect(field("สถานะการสูบบุหรี่")).toBeVisible());
  expect(field(/^ชื่อ/)).not.toBeVisible();
  expect(submitGuestHealth).not.toHaveBeenCalled();
  back();
  expect(field(/^ชื่อ/)).toBeVisible();
  expect(field(/^ชื่อ/)).toHaveValue(person.firstName);
});

test("guest reviews only the entered values, retains a failed submission for retry, then resets a new person", async () => {
  submitGuestHealth.mockRejectedValueOnce({ response: { status: 500 } })
    .mockResolvedValueOnce({ data: { data: { submissionId: "submission-1", recordIds: ["record-1"] } } });
  guest();
  fillPersonal(); nextTimes(2); fillPressure(); nextTimes(4);
  expect(screen.getByRole("region", { name: "ตรวจสอบผลตรวจที่กรอกครั้งนี้" })).toHaveTextContent("120 mmHg");
  expect(screen.getByRole("region", { name: "ตรวจสอบผลตรวจที่กรอกครั้งนี้" })).not.toHaveTextContent("ไขมันในเลือด");
  expect(field(/^ความดันตัวบน/)).not.toBeVisible();
  accept();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByText(/ข้อมูลที่กรอกยังอยู่ การส่งข้อมูลเดิมซ้ำ/);
  expect(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  expect(await screen.findByRole("heading", { name: /ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ/ })).toBeInTheDocument();
  expect(submitGuestHealth).toHaveBeenCalledTimes(2);
  expect(submitGuestHealth.mock.calls[1][0]).toEqual(submitGuestHealth.mock.calls[0][0]);
  expect(submitGuestHealth.mock.calls[0][0].records).toEqual([{ type: "blood_pressure", value: { systolic: 120, diastolic: 80 } }]);
  expect(searchUser).not.toHaveBeenCalled();
  expect(getPatientProfile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /บันทึกรายการใหม่/ }));
  expect(field(/^ชื่อ/)).toBeVisible();
  expect(field(/^ชื่อ/)).toHaveValue("");
  expect(field(/^เลขบัตรประชาชน/)).toHaveValue("");
  expect(field(/^ความดันตัวบน/)).toHaveValue(null);
  expect(field(/ฉันยอมรับ/)).not.toBeChecked();
});

test("guest review reflects all entered clinical values and confirmed conditions before posting Gregorian dates", async () => {
  submitGuestHealth.mockResolvedValueOnce({ data: { data: { submissionId: "complete-entry", recordIds: ["bp", "sugar", "lipid", "bmi"] } } });
  guest(); fillPersonal();
  fill(/^เบอร์โทรศัพท์/, "0812345678");
  fill("เพศสำหรับการประเมินความเสี่ยง", "female");
  fill(/^วันเกิด/, "01/01/2523");
  next();
  fill("สถานะการสูบบุหรี่", "former");
  fill(/^เลิกสูบบุหรี่มาแล้ว/, "18");
  fireEvent.click(screen.getByRole("checkbox", { name: "เบาหวาน" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "มะเร็ง" }));
  fill(/^ชนิดหรือตำแหน่งของมะเร็ง/, "เต้านม");
  fill("โรคประจำตัวอื่น ๆ", "  ภูมิแพ้, , หอบหืด  ");
  fireEvent.click(screen.getByRole("checkbox", { name: /ยืนยันว่าตรวจสอบข้อมูลโรคประจำตัวแล้ว/ }));
  next(); fillPressure(); fill(/^ชีพจร/, "72");
  next(); fill(/^น้ำตาลขณะอดอาหาร/, "95"); fill(/^น้ำตาลสะสม/, "5.6");
  next(); fill(/^ไขมันรวม/, "180"); fill("LDL cholesterol", "100"); fill("HDL cholesterol", "50"); fill(/^ไตรกลีเซอไรด์/, "120");
  next(); fill(/^น้ำหนัก/, "60"); fill(/^ส่วนสูง/, "165"); next();
  const personal = screen.getByRole("region", { name: "ตรวจสอบข้อมูลผู้รับบริการครั้งนี้" });
  for (const text of ["สมใจ ทดสอบ", "หญิง", "2523", "0812345678", "เลิกสูบบุหรี่แล้ว 18 เดือน", "เบาหวาน · มะเร็ง · ภูมิแพ้ · หอบหืด", "เต้านม", "ตรวจสอบแล้ว"])
    expect(personal).toHaveTextContent(text);
  const measurements = within(screen.getByRole("region", { name: "ตรวจสอบผลตรวจที่กรอกครั้งนี้" }));
  for (const text of ["120 mmHg", "80 mmHg", "72 ครั้ง/นาที", "95 mg/dL", "5.6 %", "180 mg/dL", "100 mg/dL", "50 mg/dL", "120 mg/dL", "60 กก.", "165 ซม."])
    expect(measurements.getByText(text, { exact: true })).toBeVisible();
  expect(submitGuestHealth).not.toHaveBeenCalled();
  accept(); fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByRole("heading", { name: /ส่งข้อมูลเรียบร้อยแล้ว 4 รายการ/ });
  expect(submitGuestHealth.mock.calls[0][0]).toEqual(expect.objectContaining({
    profile: expect.objectContaining({ birthDate: "19800101", gender: "female", smokingStatus: "former", smokingQuitMonths: 18,
      chronicDiseases: ["เบาหวาน", "มะเร็ง", "ภูมิแพ้", "หอบหืด"], chronicDiseasesConfirmed: true, cancerDetails: "เต้านม" }),
    records: [
      { type: "blood_pressure", value: { systolic: 120, diastolic: 80, pulse: 72 } },
      { type: "sugar", value: { fbs: 95, hba1c: 5.6 } },
      { type: "cholesterol", value: { total: 180, ldl: 100, hdl: 50, triglyceride: 120 } },
      { type: "bmi", value: { weight: 60, height: 165 }, weight: 60, height: 165 },
    ],
  }));
});

test("changing a guest citizen ID clears the previous person and measurements and requires fresh consent", () => {
  guest(); fillPersonal(); nextTimes(2); fillPressure(); nextTimes(4); accept();
  backTimes(6);
  fill(/^เลขบัตรประชาชน/, "9999999999999");
  expect(field(/^ชื่อ/)).toHaveValue("");
  expect(field(/^ความดันตัวบน/)).toHaveValue(null);
  fill(/^ชื่อ/, "ผู้รับบริการใหม่");
  fill(/^นามสกุล/, "ทดสอบ");
  nextTimes(6);
  expect(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ })).not.toBeChecked();
  expect(searchUser).not.toHaveBeenCalled();
  expect(getPatientProfile).not.toHaveBeenCalled();
  expect(submitGuestHealth).not.toHaveBeenCalled();
});

test("final guest validation reveals and focuses an earlier invalid personal field", async () => {
  guest(); fillPersonal(); fill(/^เบอร์โทรศัพท์/, "123"); nextTimes(2); fillPressure(); nextTimes(4); accept();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await waitFor(() => expect(field(/^เบอร์โทรศัพท์/)).toBeVisible());
  await waitFor(() => expect(field(/^เบอร์โทรศัพท์/)).toHaveFocus());
  expect(screen.getByText(/กรุณากรอกเบอร์โทร 9–10 หลัก/)).toBeVisible();
  expect(submitGuestHealth).not.toHaveBeenCalled();
});

test("a guest can submit profile and consent with every optional measurement page left blank", async () => {
  submitGuestHealth.mockResolvedValueOnce({ status: 202, data: { data: { submissionId: "profile-only", recordIds: [], profileOnly: true } } });
  guest(); fillPersonal(); nextTimes(6); accept();
  fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await screen.findByRole("heading", { name: "ส่งข้อมูลผู้รับบริการเรียบร้อยแล้ว" });
  expect(submitGuestHealth).toHaveBeenCalledWith(expect.objectContaining({ records: [] }), expect.objectContaining({ isCurrent: expect.any(Function) }));
  expect(screen.getByText("ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ")).toBeVisible();
});

test("health pages appear after profile lookup and cannot leave a partly filled pressure section", async () => {
  let finishProfile;
  searchUser.mockImplementationOnce(() => new Promise(resolve => { finishProfile = resolve; }));
  health();
  expect(screen.queryByRole("button", { name: "ถัดไป" })).not.toBeInTheDocument();
  await act(async () => { finishProfile({ data: { data: person } }); });
  expect(field(/^ความดันตัวบน/)).toBeVisible();
  fill(/^ความดันตัวบน/, "120"); next();
  expect(field(/^ความดันตัวล่าง/)).toHaveFocus();
  expect(field(/^น้ำตาลขณะอดอาหาร/)).not.toBeVisible();
  fill(/^ความดันตัวล่าง/, "80"); next();
  expect(field(/^น้ำตาลขณะอดอาหาร/)).toBeVisible();
  expect(addHealth).not.toHaveBeenCalled();
});

test("health review retries only failed sections, preserves saved locks, and resets all pages for a new entry", async () => {
  hasPatientSession.mockReturnValue(true);
  getStoredPatient.mockReturnValue(person);
  let sugarAttempts = 0;
  addHealth.mockImplementation(async ({ type }) => {
    if (type === "sugar" && ++sugarAttempts === 1) throw { response: { status: 500 } };
    return { data: { data: { type } } };
  });
  health();
  await waitFor(() => expect(field(/^ความดันตัวบน/)).toBeVisible());
  fillPressure(); next(); fill(/^น้ำตาลขณะอดอาหาร/, "95"); nextTimes(3); accept();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" }));
  await screen.findByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" });
  expect(addHealth).toHaveBeenCalledTimes(2);
  expect(field(/^ความดันตัวบน/)).toBeDisabled();
  expect(field(/^น้ำตาลขณะอดอาหาร/)).not.toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกส่วนที่ไม่สำเร็จอีกครั้ง" }));
  await screen.findByRole("button", { name: "บันทึกครั้งใหม่" });
  expect(addHealth.mock.calls.map(([payload]) => payload.type)).toEqual(["blood_pressure", "sugar", "sugar"]);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกครั้งใหม่" }));
  await waitFor(() => expect(field(/^ความดันตัวบน/)).toBeVisible());
  expect(field(/^ความดันตัวบน/)).not.toBeDisabled();
  expect(field(/^ความดันตัวบน/)).toHaveValue(null);
  expect(field(/^น้ำตาลขณะอดอาหาร/)).toHaveValue(null);
  nextTimes(4);
  expect(screen.getByRole("button", { name: "ข้ามการบันทึกครั้งนี้" })).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: /ฉันยอมรับ/ })).not.toBeInTheDocument();
});

test("the same patient session restores the wizard page and draft values while a new session starts fresh", async () => {
  const metadata = (sessionId) => ({ patient: person, session: {
    scope: "patient", sessionId, csrfToken: "csrf-test", expiresAt: new Date(Date.now() + 600000).toISOString(),
  } });
  hasPatientSession.mockReturnValue(true);
  getStoredPatient.mockReturnValue(person);
  saveSession("patient", metadata("same-patient-session"));
  const first = health();
  await waitFor(() => expect(field(/^ความดันตัวบน/)).toBeVisible());
  fillPressure(); nextTimes(4); accept();
  first.unmount();
  const second = health();
  expect(await screen.findByRole("button", { name: "บันทึกข้อมูลสุขภาพ" })).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ })).not.toBeChecked();
  backTimes(4);
  expect(field(/^ความดันตัวบน/)).toBeVisible();
  expect(field(/^ความดันตัวบน/)).toHaveValue(120);
  second.unmount();
  clearSession("patient", { logout: true });
  saveSession("patient", metadata("different-patient-session"));
  health();
  await waitFor(() => expect(field(/^ความดันตัวบน/)).toBeVisible());
  expect(field(/^ความดันตัวบน/)).toHaveValue(null);
  expect(screen.queryByRole("button", { name: "บันทึกข้อมูลสุขภาพ" })).not.toBeInTheDocument();
});
