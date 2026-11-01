import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AddHealth from "./AddHealth";
import { addHealth, getPatientProfile, getStoredPatient, hasPatientSession, searchUser } from "../api/api";
import { clearSession } from "../utils/session";

jest.mock("../api/api", () => ({
  ...jest.requireActual("../api/api"),
  addHealth: jest.fn(), getPatientProfile: jest.fn(), getStoredPatient: jest.fn(),
  hasPatientSession: jest.fn(), searchUser: jest.fn(),
}));
const person = { citizenId: "1234567890123", firstName: "สมใจ", lastName: "ทดสอบ" };
function showHealth() {
  render(<MemoryRouter initialEntries={[`/health/${person.citizenId}`]}><Routes>
    <Route path="/health/:citizenId" element={<AddHealth />} />
    <Route path="/" element={<h1>บัญชีของฉัน</h1>} />
    <Route path="/admin" element={<h1>หน้าบัญชีเจ้าหน้าที่</h1>} />
  </Routes></MemoryRouter>);
}
const next = () => fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
beforeEach(() => {
  jest.clearAllMocks();
  clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null });
  getStoredPatient.mockReturnValue(person);
  getPatientProfile.mockResolvedValue({ data: { data: { patient: person } } });
  searchUser.mockResolvedValue({ data: { data: person } });
  addHealth.mockResolvedValue({ data: { data: {} } });
});

test.each([true, false])("all measurements may be skipped without writing records or requiring consent (patient=%s)", async patient => {
  hasPatientSession.mockReturnValue(patient);
  showHealth();
  await screen.findByLabelText(/^ความดันตัวบน/);
  for (let step = 0; step < 4; step++) next();
  expect(screen.getByText("ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ สามารถข้ามผลตรวจได้ทุกหมวด")).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: /ฉันยอมรับ/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ข้ามการบันทึกครั้งนี้" }));
  expect(await screen.findByRole("heading", { name: patient ? "บัญชีของฉัน" : "หน้าบัญชีเจ้าหน้าที่" })).toBeInTheDocument();
  expect(addHealth).not.toHaveBeenCalled();
});

test("one HbA1c result may be saved while all other categories and FBS stay blank", async () => {
  hasPatientSession.mockReturnValue(true);
  showHealth();
  await screen.findByLabelText(/^ความดันตัวบน/);
  next();
  fireEvent.change(screen.getByLabelText(/^น้ำตาลสะสม/), { target: { value: "5.8" } });
  for (let step = 0; step < 3; step++) next();
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยอมรับ/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ }));
  fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูลสุขภาพ", exact: true }));
  await waitFor(() => expect(addHealth).toHaveBeenCalledTimes(1));
  expect(addHealth.mock.calls[0][0]).toMatchObject({ citizenId: person.citizenId, type: "sugar", value: { hba1c: 5.8 } });
  expect(addHealth.mock.calls[0][0].value).not.toHaveProperty("fbs");
  expect(await screen.findByText(/บันทึกข้อมูลเรียบร้อยแล้ว 1 ส่วน/)).toBeVisible();
});
