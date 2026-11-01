import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CreateUser from "./CreateUser";
import Profile from "./Profile";
import { createUser, getPatientProfile, savePatientSession, searchUser, updatePatientProfile } from "../api/api";
import { beginSessionLoad, clearSession } from "../utils/session";
import { clearPrivateDrafts } from "../utils/privateDraft";

jest.mock("../api/api", () => ({ ...jest.requireActual("../api/api"),
  createUser: jest.fn(), searchUser: jest.fn(), getPatientProfile: jest.fn(), updatePatientProfile: jest.fn(),
}));
jest.mock("../components/ui", () => ({
  PublicLayout: ({ children }) => <main>{children}</main>,
  PageHeading: ({ title }) => <h1>{title}</h1>,
  Button: ({ children, loading, disabled, variant, ...props }) => <button type="button" {...props} disabled={disabled || loading}>{children}</button>,
  Notice: ({ children, tone }) => <div role={tone === "error" ? "alert" : "status"}>{children}</div>,
  Field: ({ label, id, children, hint, error }) => <div><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}{error && <small role="alert">{error}</small>}</div>,
}));

const person = { _id: "wizard-patient", citizenId: "8900000000001", firstName: "สมใจ", lastName: "สุขภาพดี", birthDate: "1980-03-15",
  phone: "0812345678", province: "เชียงใหม่", chronicDiseases: [], smokingStatus: "never", thaiCvRisk: { status: "incomplete" } };
const mount = (page) => render(<MemoryRouter>{page}</MemoryRouter>);
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: /^ถัดไป/ }));
const back = () => fireEvent.click(screen.getByRole("button", { name: /^ย้อนกลับ/ }));
const accept = () => screen.getAllByRole("checkbox", { name: /ฉันยอมรับ|ฉันยินยอมอย่างชัดแจ้ง|ฉันได้แจ้ง|ฉันยืนยันว่ามีอำนาจ/ }).forEach(box => fireEvent.click(box));
async function lookup(id = "8900000000002") {
  fill("เลขบัตรประชาชน", id);
  fireEvent.click(screen.getByRole("button", { name: /ค้นหาข้อมูล/ }));
  await waitFor(() => expect(screen.getByLabelText("ชื่อ")).toBeVisible());
}
async function registrationReview() {
  fill("ชื่อ", "ประเสริฐ"); fill("นามสกุล", "รักษาสุขภาพ");
  next();
  await waitFor(() => expect(screen.getByLabelText("จังหวัด")).toBeVisible());
  fill("จังหวัด", "เชียงใหม่");
  next(); next(); next(); next();
  await waitFor(() => expect(screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ })).toBeVisible());
}
async function profileReview() {
  next(); next(); next(); next();
  await waitFor(() => expect(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ })).toBeVisible());
}

beforeEach(() => {
  jest.clearAllMocks(); clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null }); clearPrivateDrafts();
  searchUser.mockResolvedValue({ data: { data: null } });
  getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } });
  savePatientSession({ patient: person, session: { scope: "patient", sessionId: "wizard-profile-session", csrfToken: "csrf",
    expiresAt: new Date(Date.now() + 600000).toISOString() } });
});
afterEach(() => { clearSession("patient"); clearSession("admin"); clearPrivateDrafts(); });

test("registration validates each section, keeps the Buddhist date on back, and saves once after staff attestation", async () => {
  createUser.mockResolvedValue({ data: { data: {} } });
  mount(<CreateUser />); await lookup();
  expect(screen.getByLabelText("จังหวัด")).not.toBeVisible();
  next();
  expect(screen.getByLabelText("ชื่อ")).toBeVisible(); expect(createUser).not.toHaveBeenCalled();
  fill("ชื่อ", "ประเสริฐ"); fill("นามสกุล", "รักษาสุขภาพ"); fill("วันเกิด", "15/03/2523");
  fireEvent.blur(screen.getByLabelText("วันเกิด"));
  next();
  await waitFor(() => expect(screen.getByLabelText("จังหวัด")).toBeVisible());
  fill("จังหวัด", "เชียงใหม่"); next(); next();
  fill("สถานะการสูบบุหรี่", "former"); next();
  expect(screen.getByLabelText("เลิกสูบบุหรี่มาแล้ว (เดือน)")).toBeVisible();
  fill("เลิกสูบบุหรี่มาแล้ว (เดือน)", "0"); next(); next();
  await waitFor(() => expect(screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ })).toBeVisible());
  expect(createUser).not.toHaveBeenCalled();
  for (let count = 0; count < 5; count += 1) back();
  expect(screen.getByLabelText("วันเกิด")).toBeVisible(); expect(screen.getByLabelText("วันเกิด")).toHaveValue("15/03/2523");
  for (let count = 0; count < 5; count += 1) next();
  accept(); fireEvent.click(screen.getByRole("button", { name: /บันทึกข้อมูลลงทะเบียน/ }));
  await screen.findByRole("heading", { name: "บันทึกข้อมูลเรียบร้อยแล้ว" });
  expect(createUser).toHaveBeenCalledTimes(1);
  expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ birthDate: "19800315", smokingQuitMonths: 0,
    agreements: expect.objectContaining({ privacyNoticeAcknowledged: true, lawfulAuthorityConfirmed: true }) }));
});

test("a different citizen starts at the first section with fresh agreements while the earlier person keeps only their own draft", async () => {
  mount(<CreateUser />); await lookup(); await registrationReview(); accept();
  await lookup("8900000000003");
  expect(screen.getByLabelText("ชื่อ")).toBeVisible(); expect(screen.getByLabelText("ชื่อ")).toHaveValue("");
  await registrationReview();
  screen.getAllByRole("checkbox", { name: /ฉันยอมรับ|ฉันได้แจ้ง|ฉันยืนยันว่ามีอำนาจ/ }).forEach(box => expect(box).not.toBeChecked());
  await lookup("8900000000002");
  expect(screen.getByLabelText("ชื่อ")).toBeVisible(); expect(screen.getByLabelText("ชื่อ")).toHaveValue("ประเสริฐ");
  expect(createUser).not.toHaveBeenCalled();
});

test("profile section navigation keeps edited Buddhist dates and contact details without refetching or saving", async () => {
  mount(<Profile />); await screen.findByLabelText("ชื่อ");
  fill("ชื่อ", "แก้ไขค้างไว้"); fill("วันเกิด", "25/01/2520"); fireEvent.blur(screen.getByLabelText("วันเกิด"));
  next(); next();
  await waitFor(() => expect(screen.getByLabelText("เบอร์โทรศัพท์")).toBeVisible());
  fill("เบอร์โทรศัพท์", "0898765432"); back(); back();
  expect(screen.getByLabelText("ชื่อ")).toBeVisible(); expect(screen.getByLabelText("ชื่อ")).toHaveValue("แก้ไขค้างไว้");
  expect(screen.getByLabelText("วันเกิด")).toHaveValue("25/01/2520");
  next(); next(); expect(screen.getByLabelText("เบอร์โทรศัพท์")).toHaveValue("0898765432");
  expect(getPatientProfile).toHaveBeenCalledTimes(1); expect(updatePatientProfile).not.toHaveBeenCalled();
});

test("profile restores the current section and draft only after the same session verifies, with fresh consent", async () => {
  const first = mount(<Profile />); await screen.findByLabelText("ชื่อ"); fill("ชื่อ", "ร่างเดิมของฉัน");
  next(); next(); fill("เบอร์โทรศัพท์", "0898765432"); next(); next(); accept(); back(); back();
  expect(screen.getByLabelText("เบอร์โทรศัพท์")).toBeVisible(); first.unmount();
  function verify(sessionId) {
    act(() => {
      beginSessionLoad("patient");
      savePatientSession({ patient: person, session: { scope: "patient", sessionId, csrfToken: "csrf",
        expiresAt: new Date(Date.now() + 600000).toISOString() } });
    });
  }
  verify("wizard-profile-session");
  const restored = mount(<Profile />);
  await waitFor(() => expect(screen.getByLabelText("เบอร์โทรศัพท์")).toBeVisible());
  expect(screen.getByLabelText("เบอร์โทรศัพท์")).toHaveValue("0898765432");
  expect(screen.getByLabelText("ชื่อ")).toHaveValue("ร่างเดิมของฉัน");
  expect(screen.getByLabelText("ชื่อ")).not.toBeVisible();
  next(); next();
  screen.getAllByRole("checkbox", { name: /ฉันยอมรับ|ฉันยินยอมอย่างชัดแจ้ง/ }).forEach(box => expect(box).not.toBeChecked());
  restored.unmount(); verify("changed-profile-session"); mount(<Profile />);
  await waitFor(() => expect(screen.getByLabelText("ชื่อ")).toBeVisible());
  expect(screen.getByLabelText("ชื่อ")).toHaveValue(person.firstName);
  expect(screen.getByLabelText("เบอร์โทรศัพท์")).toHaveValue(person.phone);
  expect(updatePatientProfile).not.toHaveBeenCalled();
});

test("profile final validation opens the section containing an invalid hidden field instead of saving", async () => {
  mount(<Profile />); await screen.findByLabelText("ชื่อ"); fill("ชื่อ", "แก้ไข"); await profileReview(); accept();
  fill("อีเมล", "invalid-email");
  fireEvent.click(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ }));
  await waitFor(() => expect(screen.getByLabelText("อีเมล")).toBeVisible());
  await waitFor(() => expect(screen.getByLabelText("อีเมล")).toHaveFocus());
  expect(updatePatientProfile).not.toHaveBeenCalled();
});

test("profile save failure retains review choices and successful retry clears consent without overwriting the saved draft", async () => {
  const changed = { ...person, firstName: "บันทึกแล้ว" };
  updatePatientProfile.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { data: { patient: changed } } });
  mount(<Profile />); await screen.findByLabelText("ชื่อ"); fill("ชื่อ", changed.firstName); await profileReview(); accept();
  fireEvent.click(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
  screen.getAllByRole("checkbox", { name: /ฉันยอมรับ|ฉันยินยอมอย่างชัดแจ้ง/ }).forEach(box => expect(box).toBeChecked());
  fireEvent.click(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ }));
  await screen.findByText(/บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว/);
  expect(updatePatientProfile).toHaveBeenCalledTimes(2);
  expect(updatePatientProfile.mock.calls[1][0]).toEqual(expect.objectContaining({ firstName: changed.firstName, birthDate: "19800315" }));
  screen.getAllByRole("checkbox", { name: /ฉันยอมรับ|ฉันยินยอมอย่างชัดแจ้ง/ }).forEach(box => expect(box).not.toBeChecked());
  expect(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ })).toBeDisabled();
});
