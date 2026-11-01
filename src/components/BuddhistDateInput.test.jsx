import React, { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import BuddhistDateInput from "./BuddhistDateInput";

function Harness({ initial = "2020-02-29", max = "2026-11-01" }) {
  const [value, setValue] = useState(initial);
  return <><label htmlFor="birthday">วันเกิด</label><BuddhistDateInput id="birthday" value={value} max={max} onChange={event => setValue(event.target.value)} />
    <output data-testid="stored-date">{value}</output></>;
}

test("the visible textbox accepts a Buddhist date and keeps its controlled value Gregorian", () => {
  render(<Harness />);
  const input = screen.getByRole("textbox", { name: "วันเกิด" });
  expect(input).toHaveValue("29/02/2563"); expect(input).toHaveAttribute("type", "text");
  fireEvent.change(input, { target: { value: "01/01/2523" } });
  expect(screen.getByTestId("stored-date")).toHaveTextContent("1980-01-01");
  expect(input).toHaveValue("01/01/2523");
  fireEvent.change(input, { target: { value: "29/02/2562" } });
  expect(input).toHaveValue("29/02/2562"); expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByTestId("stored-date")).toHaveTextContent("!BE:29/02/2562");
});

test("the Thai calendar shows a Buddhist year and returns a Gregorian leap day", () => {
  render(<Harness initial="1980-01-01" />);
  fireEvent.click(screen.getByRole("button", { name: "เปิดปฏิทินวันเกิด พ.ศ." }));
  const calendar = screen.getByRole("dialog", { name: "ปฏิทินเลือกวันเกิด พ.ศ." });
  expect(within(calendar).getByRole("spinbutton", { name: "ปี พ.ศ. ในปฏิทิน" })).toHaveValue(2523);
  fireEvent.change(within(calendar).getByRole("spinbutton", { name: "ปี พ.ศ. ในปฏิทิน" }), { target: { value: "2563" } });
  fireEvent.change(within(calendar).getByRole("combobox", { name: "เดือนในปฏิทิน" }), { target: { value: "1" } });
  fireEvent.click(within(calendar).getByRole("button", { name: "29 กุมภาพันธ์ 2563" }));
  expect(screen.getByTestId("stored-date")).toHaveTextContent("2020-02-29");
  expect(screen.getByRole("textbox", { name: "วันเกิด" })).toHaveValue("29/02/2563");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("keyboard navigation crosses month/year boundaries and Escape returns focus", () => {
  render(<Harness initial="2020-12-31" />);
  const trigger = screen.getByRole("button", { name: "เปิดปฏิทินวันเกิด พ.ศ." });
  fireEvent.click(trigger);
  const lastDay = screen.getByRole("button", { name: "31 ธันวาคม 2563" });
  fireEvent.keyDown(lastDay, { key: "ArrowRight" });
  const firstDay = screen.getByRole("button", { name: "1 มกราคม 2564" });
  expect(firstDay).toHaveFocus();
  fireEvent.keyDown(firstDay, { key: "Enter" });
  fireEvent.click(firstDay);
  expect(screen.getByTestId("stored-date")).toHaveTextContent("2021-01-01");
  fireEvent.click(trigger); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
});

test("calendar disables future birthdays and popup dimensions remain inside a narrow viewport", () => {
  const previous = window.innerWidth; Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
  render(<Harness initial="2026-11-01" />);
  fireEvent.click(screen.getByRole("button", { name: "เปิดปฏิทินวันเกิด พ.ศ." }));
  expect(screen.getByRole("button", { name: "2 พฤศจิกายน 2569" })).toBeDisabled();
  const dialog = screen.getByRole("dialog");
  expect(Number.parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(12);
  expect(Number.parseFloat(dialog.style.left) + Number.parseFloat(dialog.style.width)).toBeLessThanOrEqual(348);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: previous });
});

test("wizard step changes close only the owning calendar and do not restore focus to a hidden field", () => {
  render(<><div data-testid="owning-wizard"><Harness /></div><div data-testid="unrelated-wizard" /></>);
  const trigger = screen.getByRole("button", { name: "เปิดปฏิทินวันเกิด พ.ศ." });
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => {
    screen.getByTestId("unrelated-wizard").dispatchEvent(new CustomEvent("save-stroke:form-step-change", { bubbles: true }));
  });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => {
    screen.getByTestId("owning-wizard").dispatchEvent(new CustomEvent("save-stroke:form-step-change", { bubbles: true }));
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).not.toHaveFocus();
});
