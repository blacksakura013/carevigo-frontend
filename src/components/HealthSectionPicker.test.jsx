import React, { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HealthSectionPicker from "./HealthSectionPicker";

const sections = [
  { type: "blood_pressure", title: "ความดันโลหิต", description: "กรอกความดันตัวบนและตัวล่าง" },
  { type: "sugar", title: "น้ำตาลในเลือด", description: "กรอก FBS หรือ HbA1c" },
  { type: "cholesterol", title: "ไขมันในเลือด", description: "กรอกผลไขมันที่มี" },
  { type: "bmi", title: "น้ำหนักและส่วนสูง", description: "กรอกน้ำหนักและส่วนสูง" },
];
function Harness({ observe = () => {}, initial = [], ...props }) {
  const [selected, setSelected] = useState(initial);
  return <HealthSectionPicker sections={sections} selectedTypes={selected} onChange={next => { observe(next); setSelected(next); }} {...props} />;
}

test("starts with no selected category and explains the optional empty flow without choosing on behalf of the user", () => {
  const change = jest.fn();
  render(<Harness observe={change} emptyMessage="ส่งข้อมูลส่วนตัวได้โดยไม่กรอกผลตรวจ" />);
  const picker = screen.getByRole("region", { name: "เลือกข้อมูลสุขภาพครั้งนี้" });
  expect(within(picker).getByRole("group", { name: "เลือกได้มากกว่า 1 รายการ หรือไม่เลือกเลยก็ได้" })).toBeInTheDocument();
  expect(within(picker).getAllByRole("checkbox")).toHaveLength(4);
  within(picker).getAllByRole("checkbox").forEach(field => expect(field).not.toBeChecked());
  expect(within(picker).getByRole("status")).toHaveTextContent("เลือกแล้ว 0 จาก 4 หมวด");
  expect(picker).toHaveTextContent("ส่งข้อมูลส่วนตัวได้โดยไม่กรอกผลตรวจ"); expect(change).not.toHaveBeenCalled();
});

test("multiple categories toggle independently and emit canonical order, including returning to none", () => {
  const change = jest.fn(); render(<Harness observe={change} emptyMessage="ข้ามผลตรวจครั้งนี้ได้" />);
  userEvent.click(screen.getByRole("checkbox", { name: "บันทึกน้ำตาลในเลือด" }));
  userEvent.click(screen.getByText("ความดันโลหิต"));
  expect(change).toHaveBeenLastCalledWith(["blood_pressure", "sugar"]);
  expect(screen.getByRole("status")).toHaveTextContent("เลือกแล้ว 2 จาก 4 หมวด");
  expect(screen.getAllByText("เลือกแล้ว", { exact: true })).toHaveLength(2);
  expect(screen.queryByText("ข้ามผลตรวจครั้งนี้ได้")).not.toBeInTheDocument();
  userEvent.click(screen.getByRole("checkbox", { name: "บันทึกความดันโลหิต" }));
  userEvent.click(screen.getByRole("checkbox", { name: "บันทึกน้ำตาลในเลือด" }));
  expect(change).toHaveBeenLastCalledWith([]); expect(screen.getByText("ข้ามผลตรวจครั้งนี้ได้")).toBeInTheDocument();
});

test("native keyboard focus and Space select or unselect a category", () => {
  const change = jest.fn(); render(<Harness observe={change} />);
  userEvent.tab(); const first = screen.getByRole("checkbox", { name: "บันทึกความดันโลหิต" });
  expect(first).toHaveFocus(); userEvent.keyboard(" "); expect(first).toBeChecked(); expect(change).toHaveBeenLastCalledWith(["blood_pressure"]);
  userEvent.keyboard(" "); expect(first).not.toBeChecked(); expect(change).toHaveBeenLastCalledWith([]);
});

test("saved categories stay checked and cannot be deselected while other choices remain editable", () => {
  const change = jest.fn(); render(<Harness observe={change} lockedTypes={["blood_pressure"]} initial={["unknown"]} />);
  const saved = screen.getByRole("checkbox", { name: "บันทึกความดันโลหิต" });
  expect(saved).toBeChecked(); expect(saved).toBeDisabled(); expect(saved.closest("label")).toHaveTextContent("บันทึกแล้ว");
  userEvent.click(saved); expect(change).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole("checkbox", { name: "บันทึกน้ำตาลในเลือด" }));
  expect(change).toHaveBeenLastCalledWith(["blood_pressure", "sugar"]);
  expect(screen.getByRole("status")).toHaveTextContent("เลือกแล้ว 2 จาก 4 หมวด");
});

test("busy state disables all choices and external controlled updates never trigger a submission or selection callback", () => {
  const change = jest.fn();
  const { rerender } = render(<HealthSectionPicker sections={sections} selectedTypes={["sugar"]} onChange={change} disabled />);
  screen.getAllByRole("checkbox").forEach(field => expect(field).toBeDisabled());
  userEvent.click(screen.getByRole("checkbox", { name: "บันทึกความดันโลหิต" })); expect(change).not.toHaveBeenCalled();
  rerender(<HealthSectionPicker sections={sections} selectedTypes={["bmi"]} onChange={change} />);
  expect(screen.getByRole("checkbox", { name: "บันทึกน้ำหนักและส่วนสูง" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "บันทึกน้ำตาลในเลือด" })).not.toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("เลือกแล้ว 1 จาก 4 หมวด"); expect(change).not.toHaveBeenCalled();
});
