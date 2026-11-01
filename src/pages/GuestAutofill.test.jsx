import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GuestHealth from "./GuestHealth";
import { getGuestProfile, getHealthByType, getPatientProfile, searchUser, submitGuestHealth } from "../api/api";

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"),
  getGuestProfile: jest.fn(), getHealthByType: jest.fn(), getPatientProfile: jest.fn(), searchUser: jest.fn(), submitGuestHealth: jest.fn(),
}));
const idA = "8900000000701", idB = "8900000000702";
const field = label => screen.getByLabelText(label);
const fill = (label, value) => fireEvent.change(field(label), { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
const nextTimes = count => { for (let i = 0; i < count; i += 1) next(); };
const accept = () => {
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ }));
};
const mount = () => render(<MemoryRouter initialEntries={["/guest"]}><GuestHealth /></MemoryRouter>);
const advance = async ms => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const resolve = async (finish, value) => { await act(async () => { finish({ data: { data: value } }); }); };
const storedPerson = { firstName: "สมใจ", lastName: "ดูแลสุขภาพ", gender: "female", birthDate: "19800315", phone: "0812345678" };

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto, configurable: true });
  getGuestProfile.mockResolvedValue({ data: { data: null } });
  submitGuestHealth.mockResolvedValue({ status: 202, data: { data: { submissionId: "accepted", profileOnly: true, recordIds: [] } } });
});
afterEach(() => jest.useRealTimers());

test("waits for exactly thirteen digits and debounces changes before making the public lookup", async () => {
  mount(); fill(/^เลขบัตรประชาชน/, idA.slice(0, 12)); await advance(1000);
  expect(getGuestProfile).not.toHaveBeenCalled();
  fill(/^เลขบัตรประชาชน/, idA); await advance(349);
  expect(getGuestProfile).not.toHaveBeenCalled();
  fill(/^เลขบัตรประชาชน/, idB); await advance(349);
  expect(getGuestProfile).not.toHaveBeenCalled();
  await advance(1);
  expect(getGuestProfile).toHaveBeenCalledTimes(1);
  expect(getGuestProfile).toHaveBeenCalledWith(idB, expect.objectContaining({ signal: expect.any(AbortSignal), isCurrent: expect.any(Function) }));
  expect(screen.getByRole("status")).toHaveTextContent("ไม่พบข้อมูลเดิม");
});

test.each([["female", "female"], ["หญิง", "female"], ["male", "male"], ["ชาย", "male"]])("autofills only personal fields with gender %s and a Buddhist year without reading private history or storing PII", async (gender, expectedGender) => {
  getGuestProfile.mockResolvedValue({ data: { data: { ...storedPerson, gender, smokingStatus: "current", chronicDiseases: ["มะเร็ง"],
    cancerDetails: "PRIVATE-CANCER", thaiCvRisk: { score: 99 }, passwordHash: "PRIVATE-HASH", records: [{ value: 999 }] } } });
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  expect(field(/^ชื่อ/)).toHaveValue(storedPerson.firstName); expect(field(/^นามสกุล/)).toHaveValue(storedPerson.lastName);
  expect(field(/^เบอร์โทรศัพท์/)).toHaveValue(storedPerson.phone); expect(field("เพศสำหรับการประเมินความเสี่ยง")).toHaveValue(expectedGender);
  expect(field(/^วันเกิด/)).toHaveValue("15/03/2523");
  expect(screen.getByRole("status")).toHaveTextContent("พบข้อมูลส่วนตัวแล้ว");
  next(); expect(field("สถานะการสูบบุหรี่")).toHaveValue("");
  expect(screen.getByRole("checkbox", { name: "มะเร็ง" })).not.toBeChecked();
  next(); expect(field(/^ความดันตัวบน/)).toHaveValue(null);
  for (const method of [searchUser, getPatientProfile, getHealthByType]) expect(method).not.toHaveBeenCalled();
  expect(document.body).not.toHaveTextContent(/PRIVATE-CANCER|PRIVATE-HASH|999/);
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("a delayed lookup preserves manually edited and deliberately cleared fields while filling untouched fields", async () => {
  let finish; getGuestProfile.mockImplementation(() => new Promise(done => { finish = done; }));
  mount(); fill(/^เลขบัตรประชาชน/, idA); fill(/^ชื่อ/, "ชื่อที่กำลังกรอก"); await advance(350);
  fill(/^เบอร์โทรศัพท์/, "0891111111"); fill(/^เบอร์โทรศัพท์/, ""); fill(/^วันเกิด/, "15/03/25");
  await resolve(finish, storedPerson);
  expect(field(/^ชื่อ/)).toHaveValue("ชื่อที่กำลังกรอก"); expect(field(/^เบอร์โทรศัพท์/)).toHaveValue("");
  expect(field(/^วันเกิด/)).toHaveValue("15/03/25"); expect(field(/^นามสกุล/)).toHaveValue(storedPerson.lastName);
  expect(field("เพศสำหรับการประเมินความเสี่ยง")).toHaveValue("female");
});

test("switching people immediately clears the old profile, health draft and consent and ignores a late old response", async () => {
  let finishA, finishB;
  getGuestProfile.mockImplementationOnce(() => new Promise(done => { finishA = done; }))
    .mockImplementationOnce(() => new Promise(done => { finishB = done; }));
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  const firstOptions = getGuestProfile.mock.calls[0][1];
  fill(/^ชื่อ/, "คนเดิม"); fill(/^นามสกุล/, "ทดสอบ"); next();
  fill("สถานะการสูบบุหรี่", "current"); fireEvent.click(screen.getByRole("checkbox", { name: "เบาหวาน" }));
  next(); fill(/^ความดันตัวบน/, "120"); fill(/^ความดันตัวล่าง/, "80"); nextTimes(4); accept();
  for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
  fill(/^เลขบัตรประชาชน/, idB);
  expect(firstOptions.signal.aborted).toBe(true); expect(firstOptions.isCurrent()).toBe(false);
  expect(field(/^ชื่อ/)).toHaveValue(""); expect(field(/^ความดันตัวบน/)).toHaveValue(null);
  expect(field("สถานะการสูบบุหรี่")).toHaveValue("");
  expect(screen.getByLabelText("เบาหวาน")).not.toBeChecked();
  expect(screen.getByLabelText(/ฉันยอมรับ/)).not.toBeChecked();
  await advance(350); await resolve(finishB, { ...storedPerson, firstName: "คนใหม่" }); await resolve(finishA, storedPerson);
  expect(field(/^ชื่อ/)).toHaveValue("คนใหม่"); expect(field(/^เลขบัตรประชาชน/)).toHaveValue(idB);
});

test.each(["not-found", "failed"])("%s lookup permits manual profile-only entry without a mandatory lookup or health result", async outcome => {
  if (outcome === "failed") getGuestProfile.mockRejectedValue(new Error("synthetic offline"));
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  expect(screen.getByRole("status")).toHaveTextContent(outcome === "failed" ? "คุณสามารถกรอกข้อมูลเองต่อได้" : "ไม่พบข้อมูลเดิม");
  fill(/^ชื่อ/, "กรอกเอง"); fill(/^นามสกุล/, "ทดสอบ"); nextTimes(6); accept();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ })); });
  expect(screen.getByRole("heading", { name: "ส่งข้อมูลผู้รับบริการเรียบร้อยแล้ว" })).toBeInTheDocument();
  expect(submitGuestHealth).toHaveBeenCalledWith(expect.objectContaining({ citizenId: idA, records: [], profile: expect.objectContaining({ firstName: "กรอกเอง" }) }), expect.any(Object));
});

test("unmount cancels the lookup and prevents its delayed result from entering a new guest form", async () => {
  let finish; getGuestProfile.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  const page = mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  const options = getGuestProfile.mock.calls[0][1]; page.unmount();
  expect(options.signal.aborted).toBe(true); expect(options.isCurrent()).toBe(false);
  mount(); await resolve(finish, storedPerson);
  expect(field(/^ชื่อ/)).toHaveValue(""); expect(field(/^เลขบัตรประชาชน/)).toHaveValue("");
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("submission freezes the entered snapshot so a late autofill cannot alter a failed retry or its accepted summary", async () => {
  let finish; getGuestProfile.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  submitGuestHealth.mockRejectedValueOnce({ response: { status: 500 } });
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  fill(/^ชื่อ/, "ข้อมูลครั้งนี้"); fill(/^นามสกุล/, "กรอกเอง"); nextTimes(6); accept();
  const send = () => fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await act(async () => { send(); });
  const firstPayload = submitGuestHealth.mock.calls[0][0];
  expect(getGuestProfile.mock.calls[0][1].signal.aborted).toBe(true);
  await resolve(finish, storedPerson); await act(async () => { send(); });
  expect(submitGuestHealth.mock.calls[1][0]).toEqual(firstPayload);
  expect(screen.getByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).toHaveTextContent("ข้อมูลครั้งนี้ กรอกเอง");
  expect(screen.getByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).not.toHaveTextContent(storedPerson.firstName);
  fireEvent.click(screen.getByRole("button", { name: /บันทึกรายการใหม่/ }));
  expect(field(/^ชื่อ/)).toHaveValue(""); expect(screen.queryByText(/พบข้อมูลส่วนตัวแล้ว/)).not.toBeInTheDocument();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("an unavailable public route permits explicit same-ID retry without login and preserves manual clears and edits", async () => {
  let finish;
  getGuestProfile.mockRejectedValueOnce({ response: { status: 401 } }).mockImplementationOnce(() => new Promise(done => { finish = done; }));
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  expect(screen.getByRole("status")).toHaveTextContent("ระบบค้นหาข้อมูลยังไม่เปิดให้ใช้งาน");
  expect(screen.queryByText(/ไม่พบข้อมูลเดิม|กรุณาเข้าสู่ระบบ/)).not.toBeInTheDocument();
  fill(/^เบอร์โทรศัพท์/, "0811111111"); fill(/^เบอร์โทรศัพท์/, ""); fill(/^วันเกิด/, "15/03/2523"); fill(/^วันเกิด/, "");
  const retry = screen.getByRole("button", { name: "ลองค้นหาอีกครั้ง" });
  expect(retry).toHaveAttribute("type", "button"); fireEvent.click(retry); fireEvent.click(retry);
  expect(retry).toBeDisabled(); await advance(350); expect(getGuestProfile).toHaveBeenCalledTimes(2);
  fill(/^ชื่อ/, "ชื่อที่แก้ระหว่างรอ"); await resolve(finish, storedPerson);
  expect(field(/^ชื่อ/)).toHaveValue("ชื่อที่แก้ระหว่างรอ"); expect(field(/^นามสกุล/)).toHaveValue(storedPerson.lastName);
  expect(field(/^เบอร์โทรศัพท์/)).toHaveValue(""); expect(field(/^วันเกิด/)).toHaveValue("");
  expect(field("เพศสำหรับการประเมินความเสี่ยง")).toHaveValue("female");
  expect(getGuestProfile.mock.calls.map(([id]) => id)).toEqual([idA, idA]);
  expect(screen.getByRole("heading", { level: 1, name: "บันทึกสุขภาพ ไม่ต้องเข้าสู่ระบบ" })).toBeInTheDocument();
  expect(submitGuestHealth).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

test("a rate-limit deadline disables retries until elapsed without automatically querying again", async () => {
  getGuestProfile.mockRejectedValueOnce({ response: { status: 429, headers: { "retry-after": "2" } } });
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  const retry = screen.getByRole("button", { name: "ลองค้นหาอีกครั้ง" });
  expect(screen.getByRole("status")).toHaveTextContent("ค้นหาข้อมูลถี่เกินไป"); expect(retry).toBeDisabled();
  fireEvent.click(retry); await advance(1999); expect(retry).toBeDisabled(); expect(getGuestProfile).toHaveBeenCalledTimes(1);
  await advance(1); expect(retry).toBeEnabled(); await advance(5000); expect(getGuestProfile).toHaveBeenCalledTimes(1);
  fireEvent.click(retry); await advance(350); expect(getGuestProfile).toHaveBeenCalledTimes(2);
});

test("a malformed HTTP success is a service error and never claims that the person was not found", async () => {
  getGuestProfile.mockResolvedValueOnce({ data: "<html>upstream unavailable</html>" });
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  expect(screen.getByRole("status")).toHaveTextContent("ระบบส่งข้อมูลค้นหากลับมาไม่สมบูรณ์");
  expect(screen.queryByText(/ไม่พบข้อมูลเดิม/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ลองค้นหาอีกครั้ง" })).toBeEnabled(); expect(field(/^ชื่อ/)).toBeEnabled();
});

test("changing ID while a manual retry is pending aborts its response without restoring old fields or feedback", async () => {
  let finishOld;
  getGuestProfile.mockRejectedValueOnce(new Error("synthetic network"))
    .mockImplementationOnce(() => new Promise(done => { finishOld = done; }))
    .mockResolvedValueOnce({ data: { data: { ...storedPerson, firstName: "ผู้รับบริการใหม่" } } });
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  fireEvent.click(screen.getByRole("button", { name: "ลองค้นหาอีกครั้ง" })); await advance(350);
  const oldOptions = getGuestProfile.mock.calls[1][1];
  fill(/^เลขบัตรประชาชน/, idB); expect(oldOptions.signal.aborted).toBe(true); expect(oldOptions.isCurrent()).toBe(false);
  await advance(350); await resolve(finishOld, storedPerson);
  expect(field(/^ชื่อ/)).toHaveValue("ผู้รับบริการใหม่"); expect(field(/^เลขบัตรประชาชน/)).toHaveValue(idB);
  expect(screen.queryByRole("button", { name: "ลองค้นหาอีกครั้ง" })).not.toBeInTheDocument();
});

test("lookup retry preserves health and consent while submission cancels the retry and keeps an identical failed-write fingerprint", async () => {
  let finish;
  getGuestProfile.mockRejectedValueOnce({ response: { status: 503 } }).mockImplementationOnce(() => new Promise(done => { finish = done; }));
  submitGuestHealth.mockRejectedValueOnce({ response: { status: 500 } });
  mount(); fill(/^เลขบัตรประชาชน/, idA); await advance(350);
  expect(screen.getByRole("status")).toHaveTextContent("ระบบยังไม่พร้อมค้นหาข้อมูล");
  fill(/^ชื่อ/, "ข้อมูลที่กรอกเอง"); fill(/^นามสกุล/, "ทดสอบ"); nextTimes(2);
  fill(/^ความดันตัวบน/, "120"); fill(/^ความดันตัวล่าง/, "80"); nextTimes(4); accept();
  for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
  fireEvent.click(screen.getByRole("button", { name: "ลองค้นหาอีกครั้ง" })); await advance(350);
  expect(field(/^ความดันตัวบน/)).toHaveValue(120); nextTimes(6);
  expect(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ })).toBeChecked(); expect(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ })).toBeChecked();
  const send = () => fireEvent.click(screen.getByRole("button", { name: /ส่งข้อมูลเพื่อรอตรวจสอบ/ }));
  await act(async () => { send(); }); const firstPayload = submitGuestHealth.mock.calls[0][0];
  expect(getGuestProfile.mock.calls[1][1].signal.aborted).toBe(true);
  await resolve(finish, storedPerson); await act(async () => { send(); });
  expect(submitGuestHealth.mock.calls[1][0]).toEqual(firstPayload);
  expect(screen.getByRole("region", { name: "สรุปข้อมูลที่ส่งครั้งนี้" })).toHaveTextContent("ข้อมูลที่กรอกเอง ทดสอบ");
  expect(getGuestProfile).toHaveBeenCalledTimes(2); expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});
