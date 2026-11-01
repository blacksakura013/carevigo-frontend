import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Privacy from "./Privacy";
import Terms from "./Terms";

jest.mock("../components/ui", () => ({
  PublicLayout: ({ title, children }) => <main><h1>{title}</h1>{children}</main>,
}));

test("public terms explain review status and clinical limitations without waiving user rights", () => {
  render(<MemoryRouter><Terms /></MemoryRouter>);
  expect(screen.getByRole("heading", { level: 1, name: "ข้อกำหนดการใช้บริการ" })).toBeInTheDocument();
  expect(screen.getByText(/23:59 น/)).toBeInTheDocument();
  expect(screen.getByText(/ไม่ได้รับรองว่าข้อมูลถูกต้องทางการแพทย์/)).toBeInTheDocument();
  expect(screen.getByText(/ไม่ตัดสิทธิที่คุณมีตามกฎหมาย/)).toBeInTheDocument();
  expect(screen.getByText(/Save Stroke ไม่ใช่ช่องทางดูแลภาวะฉุกเฉิน/)).toBeInTheDocument();
  expect(document.title).toBe("ข้อกำหนดการใช้บริการ | Save Stroke");
});

test("privacy notice describes actual health collection, essential cookies, recipients and conditional rights", () => {
  render(<MemoryRouter><Privacy /></MemoryRouter>);
  expect(screen.getByRole("heading", { level: 1, name: "ประกาศความเป็นส่วนตัว" })).toBeInTheDocument();
  expect(screen.getByText(/เลขบัตรประชาชน ชื่อ นามสกุล วันเกิด เพศ/)).toBeInTheDocument();
  expect(screen.getByText(/พฤติกรรมสูบบุหรี่ โรคประจำตัว รายละเอียดมะเร็ง/)).toBeInTheDocument();
  expect(screen.getByText(/โฮสติ้ง ฐานข้อมูล และอีเมล/)).toBeInTheDocument();
  expect(screen.getByText(/ผู้ให้บริการ LINE และผู้ให้บริการ AI ภายนอก/)).toBeInTheDocument();
  expect(screen.getByText(/คุกกี้ยืนยันตัวตนเป็น HttpOnly/)).toBeInTheDocument();
  expect(screen.getByText(/ไม่เก็บ JWT รหัสผ่าน/)).toBeInTheDocument();
  expect(screen.getByText(/การถอนความยินยอมไม่ทำให้ข้อมูลเดิมถูกลบโดยอัตโนมัติ/)).toBeInTheDocument();
  expect(screen.getByText(/การอ่านประกาศหรือเข้าสู่ระบบไม่ใช่การให้ความยินยอม/)).toBeInTheDocument();
  expect(screen.getByText(/1 พฤศจิกายน พ.ศ. 2569/)).toBeInTheDocument();
  expect(document.title).toBe("ประกาศความเป็นส่วนตัว | Save Stroke");
});
