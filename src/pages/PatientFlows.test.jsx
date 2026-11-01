import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import CreateUser from "./CreateUser";
import AddHealth from "./AddHealth";
import HealthHistory from "./HealthHistory";
import Profile from "./Profile";
import GuestHealth from "./GuestHealth";
import { ThaiCvRiskCard } from "./AddHealth";
import { PRIVACY_VERSION, TERMS_VERSION } from "../utils/legal";
jest.mock("../components/FormPages", () => require("../testUtils/InlineFormPages"));
import {
  addHealth,
  createUser,
  getGuestReceipt,
  getGuestProfile,
  getHealthByType,
  getPatientProfile,
  getStoredPatient,
  hasPatientSession,
  searchUser,
  submitGuestHealth,
  updatePatientProfile,
} from "../api/api";

let mockParams = {};
let mockLocation = { pathname: "/guest", search: "", hash: "" };
const mockNavigate = jest.fn();
jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => mockLocation,
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true },
);
jest.mock("../api/api", () => ({
  addHealth: jest.fn(),
  createUser: jest.fn(),
  getGuestReceipt: jest.fn(),
  getGuestProfile: jest.fn(),
  getHealthByType: jest.fn(),
  searchUser: jest.fn(),
  submitGuestHealth: jest.fn(),
  getPatientProfile: jest.fn(),
  getStoredPatient: jest.fn(),
  hasPatientSession: jest.fn(),
  updatePatientProfile: jest.fn(),
  getApiError: (error, fallback) => fallback,
}));
jest.mock("../components/ui", () => ({
  PublicLayout: ({ children }) => <main>{children}</main>,
  PageHeading: ({ title, description, children }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </header>
  ),
  Button: ({ children, loading, disabled, variant, ...props }) => (
    <button type="button" {...props} disabled={disabled || loading}>
      {children}
    </button>
  ),
  Notice: ({ children, tone }) => (
    <div role={tone === "error" ? "alert" : "status"}>{children}</div>
  ),
  Field: ({ label, id, children, hint, error }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small role="alert">{error}</small>}
    </div>
  ),
  EmptyState: ({ title, description, action }) => (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  ),
}));

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockParams = {};
  mockLocation = { pathname: "/guest", search: "", hash: "" };
  hasPatientSession.mockReturnValue(false);
  getGuestProfile.mockResolvedValue({ data: { data: null } });
  Object.defineProperty(window, "crypto", {
    value: require("crypto").webcrypto,
    configurable: true,
  });
});
const fill = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const agreementBoxes = (staff = false) => [
  screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }),
  ...(staff
    ? [
        screen.getByRole("checkbox", { name: /ฉันได้แจ้ง/ }),
        screen.getByRole("checkbox", { name: /ฉันยืนยันว่ามีอำนาจ/ }),
      ]
    : [screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ })]),
];
const acceptAgreements = (staff = false) => {
  agreementBoxes(staff).forEach((checkbox) => {
    if (!checkbox.checked) fireEvent.click(checkbox);
  });
};
const expectedAgreements = (staff = false) => ({
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
  termsAccepted: true,
  ...(staff
    ? { privacyNoticeAcknowledged: true, lawfulAuthorityConfirmed: true }
    : { healthDataConsent: true }),
});
const findNewUser = async () => {
  searchUser.mockResolvedValue({ data: { data: null } });
  fill("เลขบัตรประชาชน", "1234567890123");
  fireEvent.click(screen.getByRole("button", { name: /ค้นหาข้อมูล/ }));
  await screen.findByText(/ยังไม่พบข้อมูลของเลขบัตรนี้/);
};

test("keeps the profile and stays on registration when saving fails, then offers navigation only after success", async () => {
  createUser
    .mockRejectedValueOnce({ response: { status: 500 } })
    .mockResolvedValueOnce({ data: { data: { citizenId: "1234567890123" } } });
  render(<CreateUser />);
  await findNewUser();
  fill("ชื่อ", "ทดสอบ");
  fill("นามสกุล", "ตัวอย่าง");
  fill("จังหวัด", "เชียงใหม่");
  acceptAgreements(true);
  fireEvent.click(
    screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ }),
  );
  await screen.findByText(/บันทึกข้อมูลไม่สำเร็จ ข้อมูลที่กรอกยังอยู่/);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByLabelText("ชื่อ")).toHaveValue("ทดสอบ");
  fireEvent.click(
    screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ }),
  );
  await screen.findByRole("heading", { name: "บันทึกข้อมูลเรียบร้อยแล้ว" });
  expect(createUser).toHaveBeenLastCalledWith(
    expect.objectContaining({ citizenId: "1234567890123", firstName: "ทดสอบ" }),
  );
  expect(createUser.mock.calls[1][0]).not.toHaveProperty("weight");
  expect(createUser.mock.calls[1][0].agreements).toEqual(expectedAgreements(true));
  expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกสุขภาพ" }));
  expect(mockNavigate).toHaveBeenCalledWith("/health/1234567890123");
});

test("invalidates an existing-patient lookup immediately when the citizen ID changes", async () => {
  searchUser.mockResolvedValue({
    data: { data: { firstName: "ผู้ใช้เดิม", lastName: "ตัวอย่าง" } },
  });
  render(<CreateUser />);
  fill("เลขบัตรประชาชน", "1234567890123");
  fireEvent.click(screen.getByRole("button", { name: /ค้นหาข้อมูล/ }));
  await screen.findByRole("button", { name: "บันทึกสุขภาพ" });
  fill("เลขบัตรประชาชน", "9999999999999");
  expect(
    screen.queryByRole("button", { name: "บันทึกสุขภาพ" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("ผู้ใช้เดิม ตัวอย่าง")).not.toBeInTheDocument();
  expect(createUser).not.toHaveBeenCalled();
});

test("requires cancer details and the smoking cessation duration only when those options are selected", async () => {
  createUser.mockResolvedValue({
    data: { data: { citizenId: "1234567890123" } },
  });
  render(<CreateUser />);
  await findNewUser();
  fill("ชื่อ", "ทดสอบ");
  fill("นามสกุล", "ตัวอย่าง");
  fill("จังหวัด", "เชียงใหม่");
  fill("เพศสำหรับการประเมินความเสี่ยง", "female");
  fill("สถานะการสูบบุหรี่", "former");
  fireEvent.click(screen.getByLabelText("มะเร็ง"));
  acceptAgreements(true);
  fireEvent.click(
    screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ }),
  );
  expect(
    await screen.findByText("กรุณาระบุชนิดหรือตำแหน่งของมะเร็ง"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("กรุณาระบุจำนวนเดือนเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป"),
  ).toBeInTheDocument();
  expect(createUser).not.toHaveBeenCalled();
  fill("ชนิดหรือตำแหน่งของมะเร็ง", "มะเร็งเต้านม");
  fill("เลิกสูบบุหรี่มาแล้ว (เดือน)", "12");
  fireEvent.click(
    screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ }),
  );
  await screen.findByRole("heading", { name: "บันทึกข้อมูลเรียบร้อยแล้ว" });
  expect(createUser).toHaveBeenCalledWith(
    expect.objectContaining({
      gender: "female",
      smokingStatus: "former",
      smokingQuitMonths: 12,
      chronicDiseases: ["มะเร็ง"],
      cancerDetails: "มะเร็งเต้านม",
    }),
  );
});

test("does not submit stale cancer or cessation details after their dependent selections change", async () => {
  createUser.mockResolvedValue({ data: { data: {} } });
  render(<CreateUser />);
  await findNewUser();
  fill("ชื่อ", "ทดสอบ");
  fill("นามสกุล", "ตัวอย่าง");
  fill("จังหวัด", "เชียงใหม่");
  fill("สถานะการสูบบุหรี่", "former");
  fill("เลิกสูบบุหรี่มาแล้ว (เดือน)", "12");
  fireEvent.click(screen.getByLabelText("มะเร็ง"));
  fill("ชนิดหรือตำแหน่งของมะเร็ง", "มะเร็งเต้านม");
  fill("สถานะการสูบบุหรี่", "never");
  fireEvent.click(screen.getByLabelText("มะเร็ง"));
  acceptAgreements(true);
  fireEvent.click(
    screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ }),
  );
  await screen.findByRole("heading", { name: "บันทึกข้อมูลเรียบร้อยแล้ว" });
  expect(createUser.mock.calls[0][0]).not.toHaveProperty("smokingQuitMonths");
  expect(createUser.mock.calls[0][0]).not.toHaveProperty("cancerDetails");
  expect(createUser.mock.calls[0][0].chronicDiseases).toEqual([]);
});

test("retries only failed health sections and omits blank optional measures", async () => {
  mockParams = { citizenId: "1234567890123" };
  searchUser.mockResolvedValue({ data: { data: { firstName: "ผู้ทดสอบ" } } });
  let lipidAttempts = 0;
  addHealth.mockImplementation(async (payload) => {
    if (payload.type === "cholesterol" && lipidAttempts++ === 0)
      throw { response: { status: 429 } };
    return { data: { data: { recordId: payload.type } } };
  });
  render(<AddHealth />);
  await screen.findByText("ผู้ทดสอบ");
  fill("น้ำตาลขณะอดอาหาร (FBS)", "95");
  fill("ไขมันรวม (Total cholesterol)", "180");
  acceptAgreements(true);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" }));
  await screen.findAllByText(/บันทึกถี่เกินกำหนด/);
  expect(screen.getByRole("spinbutton", { name: "น้ำตาลขณะอดอาหาร (FBS)" })).toBeDisabled();
  expect(screen.getByLabelText("ไขมันรวม (Total cholesterol)")).toHaveValue(
    180,
  );
  expect(addHealth).toHaveBeenCalledWith({
    citizenId: "1234567890123",
    type: "cholesterol",
    value: { total: 180 },
    agreements: expectedAgreements(true),
  });
  expect(addHealth).toHaveBeenCalledWith({
    citizenId: "1234567890123",
    type: "sugar",
    value: { fbs: 95 },
    agreements: expectedAgreements(true),
  });
  fireEvent.click(
    screen.getByRole("button", { name: /บันทึกส่วนที่ไม่สำเร็จอีกครั้ง/ }),
  );
  await screen.findByRole("button", { name: "บันทึกครั้งใหม่" });
  expect(
    addHealth.mock.calls.filter(([payload]) => payload.type === "sugar"),
  ).toHaveLength(1);
  expect(
    addHealth.mock.calls.filter(([payload]) => payload.type === "cholesterol"),
  ).toHaveLength(2);
});

test("validates incomplete BP before sending and allows standalone BMI using server results", async () => {
  mockParams = { citizenId: "1234567890123" };
  searchUser.mockResolvedValue({ data: { data: { firstName: "ผู้ทดสอบ" } } });
  addHealth.mockResolvedValue({
    data: {
      data: {
        bmi: 22.04,
        thaiCvRisk: {
          status: "calculated",
          score: 8.5,
          level: "low",
          label: "ผลประเมินทดสอบจากระบบ",
        },
      },
    },
  });
  render(<AddHealth />);
  await screen.findByText("ผู้ทดสอบ");
  fill("ความดันตัวบน (SYS)", "120");
  acceptAgreements(true);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" }));
  await screen.findByText(/กรุณาตรวจสอบช่องที่ระบุด้านล่าง/);
  expect(addHealth).not.toHaveBeenCalled();
  fill("ความดันตัวบน (SYS)", "");
  fill("น้ำหนัก", "60");
  fill("ส่วนสูง", "165");
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" }));
  await screen.findByText("22.04");
  expect(addHealth).toHaveBeenCalledWith({
    citizenId: "1234567890123",
    type: "bmi",
    value: { weight: 60, height: 165 },
    weight: 60,
    height: 165,
    agreements: expectedAgreements(true),
  });
  expect(within(screen.getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" })).getByText("ความเสี่ยงต่ำ", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("8.5%")).toBeInTheDocument();
});

test("patient history uses only the signed-in ID and does not expose account lookup", async () => {
  mockParams = { citizenId: "9999999999999" };
  hasPatientSession.mockReturnValue(true);
  getStoredPatient.mockReturnValue({ citizenId: "1234567890123" });
  getPatientProfile.mockResolvedValue({
    data: {
      data: { patient: { firstName: "ผู้ทดสอบ", citizenId: "1234567890123" } },
    },
  });
  getHealthByType.mockResolvedValue({
    data: { data: [], total: 0, hasMore: false },
  });
  render(<HealthHistory />);
  await screen.findByText("ผู้ทดสอบ");
  expect(getHealthByType).toHaveBeenCalledWith(
    "1234567890123",
    undefined,
    1,
    10,
  );
  expect(searchUser).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("เลขบัตรประชาชน")).not.toBeInTheDocument();
});

test("the own-profile editor preserves edits after failure and sends only editable profile fields", async () => {
  const person = {
    citizenId: "1234567890123",
    firstName: "ทดสอบ",
    lastName: "ตัวอย่าง",
    gender: "female",
    birthDate: "19800101",
    smokingStatus: "never",
    chronicDiseases: [],
    chronicDiseasesConfirmed: false,
    status: "active",
    isVerified: true,
  };
  getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } });
  updatePatientProfile
    .mockRejectedValueOnce({ response: { status: 500 } })
    .mockImplementationOnce(async (payload) => ({
      data: { data: { patient: { ...person, ...payload } } },
    }));
  render(<Profile />);
  await screen.findByLabelText("ชื่อ");
  fill("สถานะการสูบบุหรี่", "former");
  fill("เลิกสูบบุหรี่มาแล้ว (เดือน)", "12");
  acceptAgreements();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
  await screen.findByText(/บันทึกข้อมูลไม่สำเร็จ ข้อมูลที่แก้ไขยังอยู่/);
  expect(screen.getByLabelText("เลิกสูบบุหรี่มาแล้ว (เดือน)")).toHaveValue(12);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }));
  await screen.findByText(/บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว/);
  expect(updatePatientProfile).toHaveBeenLastCalledWith(
    expect.objectContaining({
      gender: "female",
      birthDate: "19800101",
      smokingStatus: "former",
      smokingQuitMonths: 12,
    }),
  );
  expect(updatePatientProfile.mock.calls[1][0]).not.toHaveProperty("citizenId");
  expect(updatePatientProfile.mock.calls[1][0]).not.toHaveProperty(
    "isVerified",
  );
  expect(updatePatientProfile.mock.calls[1][0]).not.toHaveProperty("status");
  expect(updatePatientProfile.mock.calls[1][0].agreements).toEqual(expectedAgreements());
});

test.each([
  [9.9, "low", "9.9%"],
  [10, "moderate", "10%"],
  [20, "moderate", "20%"],
  [20.1, "high", "20.1%"],
  [31, "high", ">30%"],
])(
  "renders server risk %s as %s without recalculating the model",
  (score, level, percent) => {
    render(
      <ThaiCvRiskCard
        risk={{ status: "calculated", score, level, label: "ค่าทดสอบจากระบบ" }}
      />,
    );
    expect(screen.getByText(percent)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" }),
    ).toHaveClass(`patient-cv-risk-${level}`);
  },
);

test("never presents incomplete risk as zero percent", () => {
  render(
    <ThaiCvRiskCard
      risk={{
        status: "incomplete",
        score: null,
        label: "ข้อมูลยังไม่ครบ",
        missing: ["smokingStatus"],
      }}
    />,
  );
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(
    screen.getByText(/ข้อมูลที่ยังขาด: สถานะการสูบบุหรี่/),
  ).toBeInTheDocument();
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
});

test("guests submit without lookup or login and retry the identical batch with the same idempotency key", async () => {
  submitGuestHealth
    .mockRejectedValueOnce({ response: { status: 500 } })
    .mockResolvedValueOnce({
      data: {
        data: {
          submissionId: "submission-1",
          receiptToken: "private-receipt-token",
          recordIds: ["bp-1", "sugar-1"],
          reviewStatus: "pending",
          reviewDueAt: "2026-11-01T16:59:00.000Z",
        },
      },
    });
  render(<GuestHealth />);
  fill("เลขบัตรประชาชน", "1234567890123");
  fill("ชื่อ", "ทดสอบ");
  fill("นามสกุล", "ตัวอย่าง");
  fill("ความดันตัวบน (SYS)", "120");
  fill("ความดันตัวล่าง (DIA)", "80");
  fill("น้ำตาลขณะอดอาหาร (FBS)", "95");
  acceptAgreements();
  fireEvent.click(
    screen.getByRole("button", { name: "ส่งข้อมูลเพื่อรอตรวจสอบ" }),
  );
  await screen.findByText(/ส่งข้อมูลไม่สำเร็จ.*ข้อมูลที่กรอกยังอยู่/);
  expect(screen.getByLabelText("ชื่อ")).toHaveValue("ทดสอบ");
  const first = submitGuestHealth.mock.calls[0][0];
  expect(first.clientRequestId).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/);
  expect(first.records).toEqual([
    { type: "blood_pressure", value: { systolic: 120, diastolic: 80 } },
    { type: "sugar", value: { fbs: 95 } },
  ]);
  expect(first.profile).toEqual(
    expect.objectContaining({
      firstName: "ทดสอบ",
      lastName: "ตัวอย่าง",
      chronicDiseasesConfirmed: false,
    }),
  );
  expect(first.agreements).toEqual(expectedAgreements());
  fireEvent.click(
    screen.getByRole("button", { name: "ส่งข้อมูลเพื่อรอตรวจสอบ" }),
  );
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 2 รายการ" });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("เลขบัตรประชาชน")).not.toBeInTheDocument();
  expect(screen.queryByText("120/80 mmHg")).not.toBeInTheDocument();
  expect(getGuestReceipt).not.toHaveBeenCalled();
  expect(submitGuestHealth.mock.calls[1][0]).toEqual(first);
  expect(searchUser).not.toHaveBeenCalled();
  expect(getPatientProfile).not.toHaveBeenCalled();
  expect(getHealthByType).not.toHaveBeenCalled();
  expect(addHealth).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

test.each([
  ["?submission=submission-1", "#receipt=private-receipt-token"],
  ["?submission=submission-1", ""],
])("old guest links open only a fresh form without requesting records (%s)", async (search, hash) => {
  mockLocation = { pathname: "/guest", search, hash };
  render(<GuestHealth />);
  expect(screen.getByLabelText("เลขบัตรประชาชน")).toHaveValue("");
  expect(mockNavigate).toHaveBeenCalledWith("/guest", { replace: true });
  expect(getGuestReceipt).not.toHaveBeenCalled();
  expect(searchUser).not.toHaveBeenCalled();
  expect(getPatientProfile).not.toHaveBeenCalled();
  expect(getHealthByType).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /อัปเดตสถานะ|คัดลอกลิงก์/ })).not.toBeInTheDocument();
});

test("guest acknowledgement summarizes only the submitted entry and a new entry clears the previous person and consents", async () => {
  submitGuestHealth.mockResolvedValue({ data: { data: { submissionId: "submission-1", recordIds: ["bp-1"], receiptToken: "secret" } } });
  render(<GuestHealth />);
  fill("เลขบัตรประชาชน", "1234567890123");
  fill("ชื่อ", "ทดสอบ");
  fill("นามสกุล", "ตัวอย่าง");
  fill("ความดันตัวบน (SYS)", "120");
  fill("ความดันตัวล่าง (DIA)", "80");
  acceptAgreements();
  fireEvent.click(screen.getByRole("button", { name: "ส่งข้อมูลเพื่อรอตรวจสอบ" }));
  await screen.findByRole("heading", { name: "ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ" });
  expect(screen.getByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).toHaveTextContent("120 mmHg");
  expect(screen.queryByText(/1234567890123|private-receipt|secret|120\/80/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /ประวัติ|เข้าสู่/ })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" })).toHaveTextContent("ระบบรับข้อมูลแล้ว แต่ยังไม่ได้รับผลประเมิน CVD risk จากระบบ");
  expect(screen.getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" })).toHaveClass("patient-cv-risk-unknown");
  fireEvent.click(screen.getByRole("button", { name: "บันทึกรายการใหม่" }));
  expect(screen.getByLabelText("เลขบัตรประชาชน")).toHaveValue("");
  expect(screen.getByLabelText("ชื่อ")).toHaveValue("");
  expect(screen.getByLabelText("ความดันตัวบน (SYS)")).toHaveValue(null);
  agreementBoxes().forEach(box => expect(box).not.toBeChecked());
  expect(getGuestReceipt).not.toHaveBeenCalled();
});

test("history keeps rejected and pending records visible while excluding their CV snapshots", async () => {
  mockParams = { citizenId: "1234567890123" };
  searchUser.mockResolvedValue({ data: { data: { firstName: "ผู้ทดสอบ" } } });
  const risk = {
    status: "calculated",
    score: 12.34,
    level: "moderate",
    label: "ไม่ควรแสดงผลนี้",
  };
  getHealthByType.mockResolvedValue({
    data: {
      data: [
        {
          _id: "pending-1",
          type: "sugar",
          value: { fbs: 95 },
          reviewStatus: "pending",
          source: "guest",
          thaiCvRisk: risk,
        },
        {
          _id: "rejected-1",
          type: "cholesterol",
          value: { total: 180 },
          reviewStatus: "rejected",
          reviewReason: "ข้อมูลไม่ตรงผลตรวจ",
          thaiCvRisk: risk,
          reviewHistory: [
            {
              at: "2026-11-01T03:00:00Z",
              from: "pending",
              to: "rejected",
              source: "admin",
              reason: "ข้อมูลไม่ตรงผลตรวจ",
            },
          ],
        },
      ],
      total: 2,
      hasMore: false,
    },
  });
  render(<HealthHistory />);
  await screen.findByRole("table");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  expect(screen.getByText("รอตรวจสอบ")).toBeInTheDocument();
  expect(screen.getAllByText("ไม่ผ่านการตรวจสอบ").length).toBeGreaterThan(0);
  expect(screen.getByText("เหตุผล: ข้อมูลไม่ตรงผลตรวจ")).toBeInTheDocument();
  expect(screen.queryByText(/12.34%/)).not.toBeInTheDocument();
  expect(screen.queryByText("ไม่ควรแสดงผลนี้")).not.toBeInTheDocument();
  expect(
    screen.getByText("รอยืนยันข้อมูลก่อนนำไปประเมิน Thai CV"),
  ).toBeInTheDocument();
});

test("records blood pressure without fabricating an unavailable pulse", async () => {
  mockParams = { citizenId: "1234567890123" };
  searchUser.mockResolvedValue({ data: { data: { firstName: "ผู้ทดสอบ" } } });
  addHealth.mockResolvedValue({ data: { data: { recordId: "bp-1" } } });
  render(<AddHealth />);
  await screen.findByText("ผู้ทดสอบ");
  fill("ความดันตัวบน (SYS)", "120");
  fill("ความดันตัวล่าง (DIA)", "80");
  acceptAgreements(true);
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" }));
  await screen.findByRole("button", { name: "บันทึกครั้งใหม่" });
  expect(addHealth).toHaveBeenCalledWith({
    citizenId: "1234567890123",
    type: "blood_pressure",
    value: { systolic: 120, diastolic: 80 },
    agreements: expectedAgreements(true),
  });
});

test.each([
  ["staff registration", true],
  ["patient health entry", false],
  ["staff health entry", true],
  ["own-profile update", false],
  ["guest health submission", false],
])("%s requires explicit separate agreements before calling the API", async (flow, staff) => {
  const person = {
    citizenId: "1234567890123", firstName: "ผู้ทดสอบ", lastName: "ตัวอย่าง",
    gender: "female", birthDate: "19800101", smokingStatus: "never", chronicDiseases: [],
    chronicDiseasesConfirmed: false,
  };
  let write, button;
  if (flow === "staff registration") {
    createUser.mockResolvedValue({ data: { data: person } });
    render(<CreateUser />);
    await findNewUser();
    fill("ชื่อ", person.firstName);
    fill("นามสกุล", person.lastName);
    fill("จังหวัด", "เชียงใหม่");
    write = createUser;
    button = screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ });
  } else if (flow.includes("health entry")) {
    mockParams = { citizenId: person.citizenId };
    if (!staff) {
      hasPatientSession.mockReturnValue(true);
      getStoredPatient.mockReturnValue(person);
      getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } });
    } else searchUser.mockResolvedValue({ data: { data: person } });
    addHealth.mockResolvedValue({ data: { data: { recordId: "sugar-1" } } });
    render(<AddHealth />);
    await screen.findByText(`${person.firstName} ${person.lastName}`);
    fill("น้ำตาลขณะอดอาหาร (FBS)", "95");
    write = addHealth;
    button = screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ" });
  } else if (flow === "own-profile update") {
    getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } });
    updatePatientProfile.mockResolvedValue({ data: { data: { patient: person } } });
    render(<Profile />);
    await screen.findByLabelText("ชื่อ");
    fill("ชื่อ", "แก้ไขข้อมูล");
    write = updatePatientProfile;
    button = screen.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" });
  } else {
    submitGuestHealth.mockResolvedValue({ data: { data: {
      submissionId: "submission-1", receiptToken: "private-receipt-token", recordIds: ["sugar-1"],
    } } });
    render(<GuestHealth />);
    fill("เลขบัตรประชาชน", person.citizenId);
    fill("ชื่อ", person.firstName);
    fill("นามสกุล", person.lastName);
    fill("น้ำตาลขณะอดอาหาร (FBS)", "95");
    write = submitGuestHealth;
    button = screen.getByRole("button", { name: "ส่งข้อมูลเพื่อรอตรวจสอบ" });
  }
  const checkboxes = agreementBoxes(staff);
  checkboxes.forEach((checkbox) => expect(checkbox).not.toBeChecked());
  fireEvent.click(button);
  expect(write).not.toHaveBeenCalled();
  fireEvent.click(checkboxes[0]);
  fireEvent.click(button);
  expect(write).not.toHaveBeenCalled();
  acceptAgreements(staff);
  fireEvent.click(button);
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  const payload = write.mock.calls[0][0];
  expect(payload.agreements).toEqual(expectedAgreements(staff));
  if (staff) expect(payload.agreements).not.toHaveProperty("healthDataConsent");
  else {
    expect(payload.agreements).not.toHaveProperty("lawfulAuthorityConfirmed");
    expect(payload.agreements).not.toHaveProperty("privacyNoticeAcknowledged");
  }
  if (flow === "staff registration")
    await screen.findByRole("heading", { name: "บันทึกข้อมูลเรียบร้อยแล้ว" });
  else if (flow.includes("health entry"))
    await screen.findByRole("button", { name: "บันทึกครั้งใหม่" });
  else if (flow === "own-profile update")
    await screen.findByText(/บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว/);
  else await screen.findByRole("heading", { name: /ส่งข้อมูลเรียบร้อยแล้ว 1 รายการ/ });
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

test("filters history defensively when a server returns multiple types and loads the next page", async () => {
  mockParams = { citizenId: "1234567890123" };
  searchUser.mockResolvedValue({ data: { data: { firstName: "ผู้ทดสอบ" } } });
  const sugar = {
    _id: "sugar-1",
    type: "sugar",
    value: { fbs: 95 },
    createdAt: "2026-10-30T10:00:00Z",
  };
  const lipid = {
    _id: "lipid-1",
    type: "cholesterol",
    value: { total: 180 },
    createdAt: "2026-10-29T10:00:00Z",
  };
  getHealthByType.mockImplementation(async (id, type, page) => ({
    data: {
      data:
        page === 2
          ? [{ ...sugar, _id: "sugar-2", value: { fbs: 98 } }]
          : [sugar, lipid],
      total: 3,
      page,
      limit: 2,
      hasMore: page === 1,
    },
  }));
  render(<HealthHistory />);
  await screen.findByRole("table");
  expect(
    within(screen.getByRole("table")).getByText("180"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "น้ำตาลในเลือด" }));
  await waitFor(() =>
    expect(getHealthByType).toHaveBeenLastCalledWith(
      "1234567890123",
      "sugar",
      1,
      10,
    ),
  );
  await screen.findByRole("table");
  expect(
    within(screen.getByRole("table")).queryByText("180"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /โหลดรายการเพิ่มเติม/ }));
  await waitFor(() =>
    expect(getHealthByType).toHaveBeenLastCalledWith(
      "1234567890123",
      "sugar",
      2,
      10,
    ),
  );
  await screen.findByText("98");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
});
