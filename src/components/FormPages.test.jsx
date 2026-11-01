import React, { createRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FormPages, { FormPage } from "./FormPages";
import BuddhistDateInput from "./BuddhistDateInput";

const steps = [
  { id: "personal", title: "ข้อมูลส่วนตัว", description: "กรอกข้อมูลของผู้รับบริการ" },
  { id: "measurement", title: "ผลตรวจสุขภาพ" },
  { id: "review", title: "ตรวจสอบและบันทึก" },
];

function Harness({ wizardRef, busy = false, initialStep, onStepChange, onSubmit = jest.fn(), rejectPersonal = false }) {
  const [name, setName] = useState("");
  const [invalid, setInvalid] = useState(false);
  return <FormPages ref={wizardRef} steps={steps} busy={busy} initialStep={initialStep} onStepChange={onStepChange}>
    <form data-testid="entry-form" noValidate onSubmit={event => { event.preventDefault(); onSubmit(); if (rejectPersonal) setInvalid(true); }}>
      <fieldset>
        <FormPage id="personal"><label htmlFor="name">ชื่อ</label><input id="name" aria-required="true" aria-invalid={invalid || undefined} value={name} onChange={event => { setName(event.target.value); setInvalid(false); }} /></FormPage>
        <FormPage id="measurement"><label htmlFor="measurement">ความดัน</label><input id="measurement" type="number" min="1" max="300" /><label htmlFor="email">อีเมล (ถ้ามี)</label><input id="email" type="email" /></FormPage>
      </fieldset>
      <FormPage id="review"><label><input type="checkbox" required />ยืนยันข้อมูล</label><button type="submit">บันทึกข้อมูล</button></FormPage>
    </form>
  </FormPages>;
}

const fillName = () => fireEvent.change(screen.getByRole("textbox", { name: "ชื่อ" }), { target: { value: "สมใจ" } });
const next = () => fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));

test("only the current page is accessible and required validation focuses its missing field", () => {
  render(<Harness />);
  expect(screen.getByText("ขั้นตอนที่ 1 จาก 3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ข้อมูลส่วนตัว" })).toHaveAttribute("aria-current", "step");
  expect(screen.getByRole("button", { name: "ผลตรวจสุขภาพ" })).toBeDisabled();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "บันทึกข้อมูล" })).not.toBeInTheDocument();
  next();
  expect(screen.getByRole("alert")).toHaveTextContent("กรุณากรอกชื่อ");
  expect(screen.getByRole("textbox", { name: "ชื่อ" })).toHaveFocus();
  expect(screen.getByText("ขั้นตอนที่ 1 จาก 3")).toBeInTheDocument();
});

test("pages keep their DOM and draft values when advancing and going back", () => {
  render(<Harness />);
  const form = screen.getByTestId("entry-form");
  const name = screen.getByRole("textbox", { name: "ชื่อ" });
  fillName(); next();
  expect(name.closest("[data-form-page]")).toHaveAttribute("hidden");
  expect(name.closest("[data-form-page]")).toHaveAttribute("inert");
  expect(screen.getByRole("heading", { name: "ผลตรวจสุขภาพ" })).toHaveFocus();
  const measurement = screen.getByRole("spinbutton", { name: "ความดัน" });
  fireEvent.change(measurement, { target: { value: "125" } });
  fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
  expect(screen.getByRole("textbox", { name: "ชื่อ" })).toBe(name);
  expect(name).toHaveValue("สมใจ");
  next();
  expect(screen.getByRole("spinbutton", { name: "ความดัน" })).toBe(measurement);
  expect(measurement).toHaveValue(125);
  expect(screen.getByTestId("entry-form")).toBe(form);
});

test("optional blank clinical fields can be skipped while future required agreements stay untouched", () => {
  render(<Harness />);
  fillName(); next(); next();
  expect(screen.getByText("ขั้นตอนที่ 3 จาก 3")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "ยืนยันข้อมูล" })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "บันทึกข้อมูล" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ถัดไป" })).not.toBeInTheDocument();
});

test("only entered fields in the current page enforce their native range and email rules", () => {
  render(<Harness />);
  fillName(); next();
  const measurement = screen.getByRole("spinbutton", { name: "ความดัน" });
  fireEvent.change(measurement, { target: { value: "500" } }); next();
  expect(screen.getByRole("alert")).toHaveTextContent("ไม่เกิน 300");
  expect(measurement).toHaveFocus();
  fireEvent.change(measurement, { target: { value: "125" } });
  fireEvent.change(screen.getByRole("textbox", { name: "อีเมล (ถ้ามี)" }), { target: { value: "invalid" } }); next();
  expect(screen.getByRole("alert")).toHaveTextContent("กรุณากรอกอีเมลให้ถูกต้อง");
  expect(screen.getByRole("textbox", { name: "อีเมล (ถ้ามี)" })).toHaveFocus();
});

test("Enter on an earlier page advances without calling the existing submit handler", () => {
  const onSubmit = jest.fn();
  render(<Harness onSubmit={onSubmit} />);
  fillName();
  fireEvent.submit(screen.getByTestId("entry-form"));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText("ขั้นตอนที่ 2 จาก 3")).toBeInTheDocument();
  fireEvent.submit(screen.getByTestId("entry-form"));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText("ขั้นตอนที่ 3 จาก 3")).toBeInTheDocument();
  fireEvent.submit(screen.getByTestId("entry-form"));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("the imperative ref opens the field's page and focuses it after commit without clearing drafts", () => {
  const wizardRef = createRef();
  render(<Harness wizardRef={wizardRef} />);
  fillName(); next(); next();
  act(() => { expect(wizardRef.current.focusField("name")).toBe(true); });
  expect(screen.getByRole("textbox", { name: "ชื่อ" })).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "ชื่อ" })).toHaveValue("สมใจ");
  act(() => { wizardRef.current.goTo("review"); });
  expect(screen.getByRole("button", { name: "บันทึกข้อมูล" })).toBeInTheDocument();
  act(() => { wizardRef.current.reset(); });
  expect(screen.getByText("ขั้นตอนที่ 1 จาก 3")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "ชื่อ" })).toHaveValue("สมใจ");
  expect(screen.getByRole("button", { name: "ผลตรวจสุขภาพ" })).toBeDisabled();
  expect(wizardRef.current.focusField("unrelated-field")).toBe(false);
});

test("final parent validation can expose and focus a newly invalid field on an earlier page", async () => {
  const onSubmit = jest.fn();
  render(<Harness onSubmit={onSubmit} rejectPersonal />);
  fillName(); next(); next();
  fireEvent.submit(screen.getByTestId("entry-form"));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "ชื่อ" })).toHaveFocus());
  expect(screen.getByText("ขั้นตอนที่ 1 จาก 3")).toBeInTheDocument();
});

test("busy mode locks navigation, progress, ref changes and submit capture", () => {
  const onSubmit = jest.fn(), wizardRef = createRef();
  const view = render(<Harness wizardRef={wizardRef} onSubmit={onSubmit} />);
  fillName(); next();
  view.rerender(<Harness wizardRef={wizardRef} onSubmit={onSubmit} busy />);
  expect(screen.getByRole("button", { name: "ถัดไป" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "ย้อนกลับ" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "ข้อมูลส่วนตัว" })).toBeDisabled();
  act(() => { expect(wizardRef.current.goTo("review")).toBe(false); expect(wizardRef.current.reset()).toBe(false); });
  fireEvent.submit(screen.getByTestId("entry-form"));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText("ขั้นตอนที่ 2 จาก 3")).toBeInTheDocument();
});

test("removing the wizard immediately removes its data and pending field observation", async () => {
  const view = render(<Harness rejectPersonal />);
  fillName(); next(); next();
  fireEvent.submit(screen.getByTestId("entry-form"));
  view.unmount();
  await act(async () => {});
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(document.getElementById("name")).toBeNull();
});

test("an initial step restores the page without reporting a first-page change or controlling later navigation", () => {
  const onStepChange = jest.fn();
  const view = render(<Harness initialStep="review" onStepChange={onStepChange} />);
  expect(screen.getByText("ขั้นตอนที่ 3 จาก 3")).toBeInTheDocument();
  expect(onStepChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
  expect(onStepChange).toHaveBeenCalledWith("measurement");
  view.rerender(<Harness initialStep="personal" onStepChange={onStepChange} />);
  expect(screen.getByText("ขั้นตอนที่ 2 จาก 3")).toBeInTheDocument();
  expect(onStepChange).toHaveBeenCalledTimes(1);
});

test("step notifications use the latest callback without repeating on rerenders", () => {
  const first = jest.fn(), latest = jest.fn();
  const view = render(<Harness initialStep="measurement" onStepChange={first} />);
  view.rerender(<Harness initialStep="measurement" onStepChange={latest} />);
  expect(first).not.toHaveBeenCalled();
  expect(latest).not.toHaveBeenCalled();
  next();
  expect(latest).toHaveBeenCalledTimes(1);
  expect(latest).toHaveBeenCalledWith("review");
});

test("an unknown initial step falls back to the first page", () => {
  render(<Harness initialStep="unavailable" />);
  expect(screen.getByText("ขั้นตอนที่ 1 จาก 3")).toBeInTheDocument();
});

test.each(["submit", "imperative"])("%s navigation closes a calendar portal without returning focus to its hidden field", method => {
  const wizardRef = createRef();
  render(<FormPages ref={wizardRef} steps={steps}>
    <form noValidate data-testid="calendar-form">
      <FormPage id="personal"><BuddhistDateInput id="birthday" value="1980-01-01" onChange={() => {}} /></FormPage>
      <FormPage id="measurement"><label>ผลตรวจ<input /></label></FormPage>
      <FormPage id="review"><button type="submit">บันทึก</button></FormPage>
    </form>
  </FormPages>);
  const trigger = screen.getByRole("button", { name: "เปิดปฏิทินวันเกิด พ.ศ." });
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  if (method === "submit") fireEvent.submit(screen.getByTestId("calendar-form"));
  else act(() => { wizardRef.current.goTo("measurement"); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ผลตรวจสุขภาพ" })).toHaveFocus();
  expect(trigger.closest("[data-form-page]")).toHaveAttribute("hidden");
  expect(trigger).not.toHaveFocus();
});

test("typing a decimal after a required-field error clears feedback and retains the complete controlled value", async () => {
  function ControlledMeasurement() {
    const [value, setValue] = useState("");
    return <FormPages steps={[{ id: "measurement", title: "น้ำหนัก" }, { id: "review", title: "ตรวจสอบ" }]}>
      <form noValidate>
        <FormPage id="measurement"><label htmlFor="controlled-weight">น้ำหนักที่วัดได้</label>
          <input id="controlled-weight" type="number" required min="0.01" step="any" value={value}
            onChange={event => setValue(event.target.value)} />
        </FormPage>
        <FormPage id="review"><p>น้ำหนัก {value} กก.</p></FormPage>
      </form>
    </FormPages>;
  }
  render(<ControlledMeasurement />);
  next();
  expect(screen.getByRole("alert")).toHaveTextContent(/กรุณากรอกน้ำหนักที่วัดได้/);
  const input = screen.getByRole("spinbutton", { name: "น้ำหนักที่วัดได้" });
  for (const value of ["6", "60", "60.5"])
    await act(async () => { fireEvent.input(input, { target: { value }, inputType: "insertText" }); });
  expect(input).toHaveValue(60.5);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  next();
  expect(screen.getByText("น้ำหนัก 60.5 กก.")).toBeVisible();
});
