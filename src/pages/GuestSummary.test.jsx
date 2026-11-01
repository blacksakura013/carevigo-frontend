import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import GuestHealth from "./GuestHealth";
import { getGuestReceipt, getHealthByType, getPatientProfile, searchUser, submitGuestHealth } from "../api/api";

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"),
  submitGuestHealth: jest.fn(), getGuestProfile: jest.fn(() => Promise.resolve({ data: { data: null } })), getGuestReceipt: jest.fn(), getHealthByType: jest.fn(), getPatientProfile: jest.fn(), searchUser: jest.fn(),
}));
const citizenId = "8900000000701";
const mount = () => render(<MemoryRouter initialEntries={["/guest"]}><GuestHealth /></MemoryRouter>);
const field = label => screen.getByLabelText(label);
const fill = (label, value) => fireEvent.change(field(label), { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
const nextTimes = count => { for (let step = 0; step < count; step += 1) next(); };
const personal = () => { fill(/^เลขบัตรประชาชน/, citizenId); fill(/^ชื่อ/, "สมใจ"); fill(/^นามสกุล/, "ดูแลสุขภาพ"); };
const pressure = () => { fill(/^ความดันตัวบน/, "128"); fill(/^ความดันตัวล่าง/, "79"); };
const consent = () => {
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ }));
};
const send = () => fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
const summary = () => screen.getByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" });
const readyPressure = () => { personal(); nextTimes(2); pressure(); nextTimes(4); consent(); };
const riskCard = () => within(summary()).getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" });
const readyAssessment = () => {
  personal(); fill(/^วันเกิด/, "15/03/2523"); fill("เพศสำหรับการประเมินความเสี่ยง", "female"); next();
  fill("สถานะการสูบบุหรี่", "never");
  fireEvent.click(screen.getByRole("checkbox", { name: /ยืนยันว่าตรวจสอบข้อมูลโรคประจำตัวแล้ว/ }));
  next(); pressure(); nextTimes(2); fill(/^ไขมันรวม/, "180"); nextTimes(2); consent();
};
function noReadsOrStorage() {
  for (const method of [getGuestReceipt, getHealthByType, getPatientProfile, searchUser]) expect(method).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
}
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto, configurable: true });
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "accepted", recordIds: ["bp"], reviewDueAt: "2026-11-01T16:59:00.000Z" } } });
});
afterEach(() => jest.useRealTimers());

test("an accepted guest entry shows only its submitted profile and all measurement values with Thai dates and review deadline", async () => {
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: {
    submissionId: "accepted-four", recordIds: ["bp", "sugar", "lipid", "bmi"],
    submittedAt: "2026-11-01T03:45:00.000Z", reviewDueAt: "2026-11-01T16:59:00.000Z",
    profile: { firstName: "ข้อมูลของคนอื่น" }, records: [{ value: { systolic: 999 } }], receiptToken: "do-not-display-receipt-token",
  } } });
  mount(); personal();
  fill(/^วันเกิด/, "15/03/2523"); fill("เพศสำหรับการประเมินความเสี่ยง", "female"); fill(/^เบอร์โทรศัพท์/, "0812345678");
  next(); fill("สถานะการสูบบุหรี่", "former"); fill(/^เลิกสูบบุหรี่มาแล้ว/, "18");
  fireEvent.click(screen.getByRole("checkbox", { name: "มะเร็ง" })); fill(/^ชนิดหรือตำแหน่งของมะเร็ง/, "เต้านม");
  fireEvent.click(screen.getByRole("checkbox", { name: /ยืนยันว่าตรวจสอบข้อมูลโรคประจำตัวแล้ว/ }));
  next(); pressure(); fill(/^ชีพจร/, "72");
  next(); fill(/^น้ำตาลขณะอดอาหาร/, "95"); fill(/^น้ำตาลสะสม/, "5.6");
  next(); fill(/^ไขมันรวม/, "180"); fill("LDL cholesterol", "100"); fill("HDL cholesterol", "50"); fill(/^ไตรกลีเซอไรด์/, "120");
  next(); fill(/^น้ำหนัก/, "60.5"); fill(/^ส่วนสูง/, "165"); next(); consent(); send();
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 4 รายการ" });
  const result = within(summary());
  for (const value of ["สมใจ ดูแลสุขภาพ", "•••••••••0701", "หญิง", "0812345678", "เลิกสูบบุหรี่แล้ว 18 เดือน", "เต้านม", "128 mmHg", "79 mmHg", "72 ครั้ง/นาที", "95 mg/dL", "5.6 %", "180 mg/dL", "100 mg/dL", "50 mg/dL", "120 mg/dL", "60.5 กก.", "165 ซม."])
    expect(result.getByText(value, { exact: true })).toBeVisible();
  expect(summary()).toHaveTextContent(/2523/);
  expect(summary()).toHaveTextContent(/2569/);
  expect(summary()).toHaveTextContent(/10:45/);
  expect(summary()).toHaveTextContent(/23:59/);
  expect(result.getByText("เวลาที่ระบบรับข้อมูล")).toBeVisible();
  expect(result.getByText("รอเจ้าหน้าที่ตรวจสอบ")).toBeVisible();
  expect(summary()).not.toHaveTextContent(citizenId);
  expect(summary()).not.toHaveTextContent(/ข้อมูลของคนอื่น|999|do-not-display-receipt-token/);
  expect(screen.queryByLabelText(/^เลขบัตรประชาชน/)).not.toBeInTheDocument();
  noReadsOrStorage();
});

test("starting a new guest entry clears the accepted summary, personal fields, measurements and consent", async () => {
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "accepted", recordIds: ["bp"],
    thaiCvRisk: { status: "calculated", score: 6.25, level: "low", label: "ความเสี่ยงต่ำ" } } } });
  mount(); readyPressure(); send();
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(summary()).toHaveTextContent("128 mmHg");
  expect(riskCard()).toHaveTextContent("6.25%");
  expect(screen.getByRole("heading", { level: 1, name: "สรุปผลการบันทึกสุขภาพ" })).toBeVisible();
  expect(document.title).toBe("สรุปผลการบันทึกสุขภาพ | Save Stroke");
  const startNew = screen.getByRole("button", { name: "บันทึกรายการใหม่" });
  expect(riskCard().compareDocumentPosition(startNew) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await waitFor(() => expect(summary()).toHaveFocus());
  userEvent.tab();
  expect(startNew).toHaveFocus();
  const previousScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  const scrollIntoView = jest.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  try {
    userEvent.keyboard("{Enter}");
    await waitFor(() => expect(field(/^เลขบัตรประชาชน/)).toHaveFocus());
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "center", behavior: "auto" });
  } finally {
    if (previousScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", previousScroll);
    else delete HTMLElement.prototype.scrollIntoView;
  }
  expect(screen.queryByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).not.toBeInTheDocument();
  await waitFor(() => expect(field(/^เลขบัตรประชาชน/)).toHaveFocus());
  expect(field(/^เลขบัตรประชาชน/)).toBeVisible();
  expect(screen.getByText("ขั้นตอนที่ 1 จาก 7")).toBeVisible();
  expect(screen.getByRole("heading", { level: 1, name: "บันทึกสุขภาพ ไม่ต้องเข้าสู่ระบบ" })).toBeVisible();
  expect(document.title).toBe("บันทึกสุขภาพโดยไม่เข้าสู่ระบบ | Save Stroke");
  expect(field(/^ชื่อ/)).toHaveValue(""); expect(field(/^นามสกุล/)).toHaveValue(""); expect(field(/^เลขบัตรประชาชน/)).toHaveValue("");
  expect(field(/^ความดันตัวบน/)).toHaveValue(null); expect(field(/^ความดันตัวล่าง/)).toHaveValue(null);
  expect(field(/ฉันยอมรับ/)).not.toBeChecked(); expect(field(/ฉันยินยอมอย่างชัดแจ้ง/)).not.toBeChecked();
  expect(document.body).not.toHaveTextContent("สมใจ ดูแลสุขภาพ");
  expect(screen.queryByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" })).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent("6.25%");
  expect(submitGuestHealth).toHaveBeenCalledTimes(1);
  noReadsOrStorage();
});

test("an accepted async response focuses the committed summary without waiting for a timer or leaving focus on the removed submit button", async () => {
  jest.useFakeTimers();
  let accepted;
  submitGuestHealth.mockImplementationOnce(() => new Promise(resolve => { accepted = resolve; }));
  mount(); readyPressure(); send();
  expect(screen.queryByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).not.toBeInTheDocument();
  await act(async () => { accepted({ status: 202, data: { data: { submissionId: "accepted", recordIds: ["bp"] } } }); });
  expect(summary()).toHaveFocus();
  expect(screen.getByRole("heading", { level: 1, name: "สรุปผลการบันทึกสุขภาพ" })).toBeVisible();
  expect(document.title).toBe("สรุปผลการบันทึกสุขภาพ | Save Stroke");
  expect(submitGuestHealth).toHaveBeenCalledTimes(1);
  noReadsOrStorage();
});

test.each([
  [6.25, "low", "ความเสี่ยงต่ำ"],
  [14.2, "moderate", "ความเสี่ยงปานกลาง"],
  [23, "high", "ความเสี่ยงสูง"],
])("accepted guest submission shows the server's %s percent result prominently as %s", async (score, level, label) => {
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: {
    submissionId: "accepted-assessment", recordIds: ["bp", "lipid"],
    thaiCvRisk: { status: "calculated", score, level: "untrusted-level", label: "untrusted-label",
      displayScore: "server-private-name", inputs: { profileSource: "submitted-profile",
        bloodPressureRecordedAt: "2026-11-01T03:45:00.000Z", cholesterolRecordedAt: "2026-11-01T03:45:00.000Z" } },
  } } });
  mount(); readyAssessment();
  expect(screen.queryByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" })).not.toBeInTheDocument();
  send(); await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 2 รายการ" });
  expect(riskCard()).toHaveClass(`patient-cv-risk-${level}`);
  expect(riskCard()).toHaveTextContent(`${score}%`);
  expect(riskCard()).toHaveTextContent(label);
  expect(summary()).toHaveTextContent("ประเมินจากข้อมูลครั้งนี้ · รอเจ้าหน้าที่ตรวจสอบ");
  const header = screen.getByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 2 รายการ" });
  const metadata = screen.getByRole("region", { name: "ข้อมูลการส่งครั้งนี้" });
  expect(header.compareDocumentPosition(riskCard()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(riskCard().compareDocumentPosition(metadata) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(summary()).not.toHaveTextContent(/untrusted-label|untrusted-level|server-private-name/);
  expect(submitGuestHealth.mock.calls[0][0]).toMatchObject({ profile: { gender: "female", birthDate: "19800315", smokingStatus: "never", chronicDiseasesConfirmed: true },
    records: [{ type: "blood_pressure", value: { systolic: 128, diastolic: 79 } }, { type: "cholesterol", value: { total: 180 } }] });
  noReadsOrStorage();
});

test.each([
  ["incomplete", "ยังขาดข้อมูลสำหรับการประเมิน", ["birthDate", "systolic", "totalCholesterol"]],
  ["ineligible", "อายุอยู่นอกช่วงของแบบประเมิน", []],
])("profile-only guest may finish while %s assessment remains neutral and explains why", async (status, reason, missing) => {
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: {
    submissionId: "accepted-profile", recordIds: [], profileOnly: true,
    thaiCvRisk: { status, score: null, reason, missing, inputs: { profileSource: "submitted-profile" } },
  } } });
  mount(); personal(); nextTimes(6); consent(); send();
  await screen.findByRole("heading", { name: "ส่งข้อมูลผู้รับบริการเรียบร้อยแล้ว" });
  expect(riskCard()).toHaveClass("patient-cv-risk-unknown");
  expect(riskCard()).toHaveTextContent(reason);
  expect(within(riskCard()).getByText("—")).toBeVisible();
  expect(within(riskCard()).queryByText("0%", { exact: true })).not.toBeInTheDocument();
  expect(submitGuestHealth.mock.calls[0][0].records).toEqual([]);
  expect(summary()).toHaveTextContent("ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ");
  noReadsOrStorage();
});

test("an older API acknowledgment without an assessment stays accepted and shows a neutral unavailable result", async () => {
  mount(); readyPressure(); send();
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(riskCard()).toHaveClass("patient-cv-risk-unknown");
  expect(riskCard()).toHaveTextContent("ระบบรับข้อมูลแล้ว แต่ยังไม่ได้รับผลประเมิน CVD risk จากระบบ");
  expect(within(riskCard()).getByText("—")).toBeVisible();
  expect(within(riskCard()).queryByText("0%", { exact: true })).not.toBeInTheDocument();
  expect(submitGuestHealth).toHaveBeenCalledTimes(1);
  noReadsOrStorage();
});

test("guest assessment copies only safe derived fields and never retains server profile, tokens or unknown missing-field echoes", async () => {
  const serverRisk = { status: "incomplete", score: null, reason: "ยังขาดข้อมูลสำหรับการประเมิน", missing: ["systolic", "PRIVATE-MISSING-NAME"],
    patient: { firstName: "PRIVATE-RISK-PATIENT" }, receiptToken: "PRIVATE-RISK-TOKEN", citizenId: "PRIVATE-RISK-ID",
    inputs: { profileSource: "submitted-profile", patient: { firstName: "PRIVATE-INPUT-PATIENT" }, citizenId: "PRIVATE-INPUT-ID" } };
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "accepted", recordIds: ["bp"], thaiCvRisk: serverRisk,
    patient: { firstName: "PRIVATE-TOP-PATIENT" }, receiptToken: "PRIVATE-TOP-TOKEN" } } });
  const rendered = mount(); readyPressure(); send();
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(riskCard()).toHaveTextContent("ความดันตัวบน");
  serverRisk.missing.push("gender"); serverRisk.reason = "PRIVATE-LATE-REASON"; serverRisk.inputs.profileSource = "PRIVATE-LATE-SOURCE";
  rendered.rerender(<MemoryRouter initialEntries={["/guest"]}><GuestHealth /></MemoryRouter>);
  expect(riskCard()).toHaveTextContent("ยังขาดข้อมูลสำหรับการประเมิน");
  expect(riskCard()).not.toHaveTextContent("ข้อมูลที่ยังขาด: ความดันตัวบน · เพศ");
  expect(summary()).not.toHaveTextContent(/PRIVATE-/);
  expect(summary()).not.toHaveTextContent(citizenId);
  noReadsOrStorage();
});

test("a failed request retains the form and explicit retry shows one snapshot without duplicate acknowledgment counts", async () => {
  let reject;
  submitGuestHealth.mockImplementationOnce(() => new Promise((resolve, rejectRequest) => { reject = rejectRequest; }))
    .mockResolvedValueOnce({ status: 202, data: { data: { submissionId: "same-ack", recordIds: ["same-id", "same-id", "unrelated-id"] } } });
  mount(); readyPressure();
  const form = screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }).closest("form");
  fireEvent.submit(form); fireEvent.submit(form);
  expect(submitGuestHealth).toHaveBeenCalledTimes(1);
  await act(async () => { reject({ response: { status: 503 } }); });
  expect(screen.queryByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).not.toBeInTheDocument();
  expect(field(/^ความดันตัวบน/)).toHaveValue(128);
  expect(field(/ฉันยอมรับ/)).toBeChecked();
  send(); await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(submitGuestHealth.mock.calls[1][0]).toEqual(submitGuestHealth.mock.calls[0][0]);
  expect(within(summary()).getAllByText("128 mmHg", { exact: true })).toHaveLength(1);
  expect(summary()).not.toHaveTextContent(/same-id|unrelated-id/);
  noReadsOrStorage();
});

test("missing or invalid server timestamps are clearly shown as device submission time without inventing server receipt time", async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-11-01T04:20:00.000Z"));
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "accepted", submittedAt: "invalid", reviewDueAt: "invalid" } } });
  mount(); readyPressure();
  await act(async () => { send(); });
  expect(summary()).toHaveTextContent("เวลาส่งจากอุปกรณ์นี้");
  expect(summary()).toHaveTextContent("11:20");
  expect(summary()).toHaveTextContent("เวลา 23:59 น. ของวันที่ส่งข้อมูล (เวลาไทย)");
  expect(summary()).not.toHaveTextContent("เวลาที่ระบบรับข้อมูล");
  expect(summary()).not.toHaveTextContent("invalid");
  noReadsOrStorage();
});

test("the one-time summary is discarded on unmount and no receipt or historical record is reopened", async () => {
  const first = mount(); readyPressure(); send();
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(summary()).toHaveTextContent("สมใจ ดูแลสุขภาพ");
  first.unmount(); mount();
  await waitFor(() => expect(field(/^ชื่อ/)).toBeVisible());
  expect(field(/^ชื่อ/)).toHaveValue("");
  expect(screen.queryByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).not.toBeInTheDocument();
  expect(submitGuestHealth).toHaveBeenCalledTimes(1);
  noReadsOrStorage();
});

test("profile-only guest submission sends no health rows and explicitly summarizes zero optional measurements", async () => {
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "profile-only", recordIds: [], profileOnly: true,
    submittedAt: "2026-11-01T03:45:00.000Z", reviewDueAt: "2026-11-01T16:59:00.000Z" } } });
  mount(); personal(); nextTimes(6);
  expect(screen.getByText(/สามารถส่งข้อมูลผู้รับบริการได้โดยไม่กรอกผลตรวจ/)).toBeVisible();
  send();
  expect(submitGuestHealth).not.toHaveBeenCalled();
  expect(field(/ฉันยอมรับ/)).toHaveFocus();
  consent(); send();
  await screen.findByRole("heading", { name: "ส่งข้อมูลผู้รับบริการเรียบร้อยแล้ว" });
  expect(submitGuestHealth).toHaveBeenCalledTimes(1);
  expect(submitGuestHealth).toHaveBeenCalledWith(expect.objectContaining({ citizenId, records: [],
    profile: expect.objectContaining({ firstName: "สมใจ", lastName: "ดูแลสุขภาพ" }),
    agreements: expect.objectContaining({ termsAccepted: true, healthDataConsent: true }) }), expect.objectContaining({ isCurrent: expect.any(Function) }));
  expect(summary()).toHaveTextContent("0 รายการ");
  expect(summary()).toHaveTextContent("ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ");
  expect(summary()).toHaveTextContent("รอเจ้าหน้าที่ตรวจสอบ");
  expect(summary()).toHaveTextContent("23:59");
  expect(summary()).toHaveTextContent("สมใจ ดูแลสุขภาพ");
  expect(summary()).not.toHaveTextContent(/mmHg|mg\/dL|ผลตรวจ.*1 รายการ|BMI|อย่างน้อย 1 ส่วน/);
  expect(screen.queryByRole("region", { name: "ตรวจสอบผลตรวจที่กรอกครั้งนี้" })).not.toBeInTheDocument();
  noReadsOrStorage();
});
