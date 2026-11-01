import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useContentMotion } from "./motion";

function Page({ title }) {
  const ref = useContentMotion(title);
  return <><h1 ref={ref} data-motion-content>{title}</h1><label>ข้อมูลที่ยังไม่ส่ง<input /></label></>;
}

const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
const originalMatchMedia = window.matchMedia;
let animate, media, listeners;

beforeEach(() => {
  listeners = new Set();
  media = {
    matches: false,
    addEventListener: jest.fn((name, listener) => listeners.add(listener)),
    removeEventListener: jest.fn((name, listener) => listeners.delete(listener)),
  };
  window.matchMedia = jest.fn(() => media);
  animate = jest.fn(() => ({ cancel: jest.fn() }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
});

afterEach(() => {
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else delete HTMLElement.prototype.animate;
  window.matchMedia = originalMatchMedia;
});

function preferReduced(matches) {
  act(() => {
    media.matches = matches;
    [...listeners].forEach(listener => listener({ matches }));
  });
}

test("heading changes replay a finite fade while retaining the form node, draft and focus", () => {
  const view = render(<Page title="บันทึกสุขภาพ" />);
  const heading = screen.getByRole("heading");
  const input = screen.getByRole("textbox");
  input.focus();
  fireEvent.change(input, { target: { value: "ข้อมูลร่าง" } });
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<Page title="ข้อมูลของฉัน" />);
  expect(screen.getByRole("heading")).toBe(heading);
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("ข้อมูลร่าง");
  expect(input).toHaveFocus();
  expect(animate).toHaveBeenCalledWith(
    [{ opacity: 0.75 }, { opacity: 1 }],
    { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
  );
  expect(animate.mock.instances[0]).toBe(heading);
});

test("initial mounting and ordinary rerenders do not replay the heading", () => {
  const view = render(<Page title="ตั้งค่าบัญชี" />);
  view.rerender(<Page title="ตั้งค่าบัญชี" />);
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<Page title="ภาพรวม" />);
  const first = animate.mock.results[0].value;
  view.rerender(<Page title="ภาพรวม" />);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(first.cancel).not.toHaveBeenCalled();
});

test("rapid heading changes cancel the old animation and unmount cancels the current one", () => {
  const view = render(<Page title="ภาพรวม" />);
  view.rerender(<Page title="สมาชิก" />);
  const first = animate.mock.results[0].value;
  view.rerender(<Page title="ตั้งค่า" />);
  const second = animate.mock.results[1].value;
  expect(first.cancel).toHaveBeenCalledTimes(1);
  expect(second.cancel).not.toHaveBeenCalled();
  view.unmount();
  expect(second.cancel).toHaveBeenCalledTimes(1);
  expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  expect(listeners.size).toBe(0);
});

test("reduced motion from the start suppresses replay and opting out does not start one", () => {
  media.matches = true;
  const view = render(<Page title="ภาพรวม" />);
  view.rerender(<Page title="สมาชิก" />);
  expect(animate).not.toHaveBeenCalled();
  preferReduced(false);
  view.rerender(<Page title="สมาชิก" />);
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<Page title="ตั้งค่า" />);
  expect(animate).toHaveBeenCalledTimes(1);
});

test("turning on reduced motion cancels a running animation and prevents subsequent replay", () => {
  const view = render(<Page title="ภาพรวม" />);
  view.rerender(<Page title="สมาชิก" />);
  const first = animate.mock.results[0].value;
  preferReduced(true);
  expect(first.cancel).toHaveBeenCalledTimes(1);
  view.rerender(<Page title="ตั้งค่า" />);
  expect(animate).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(first.cancel).toHaveBeenCalledTimes(1);
});

test("legacy media listeners also cancel motion and are removed on unmount", () => {
  delete media.addEventListener;
  delete media.removeEventListener;
  media.addListener = jest.fn(listener => listeners.add(listener));
  media.removeListener = jest.fn(listener => listeners.delete(listener));
  const view = render(<Page title="ภาพรวม" />);
  view.rerender(<Page title="สมาชิก" />);
  const animation = animate.mock.results[0].value;
  preferReduced(true);
  expect(animation.cancel).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(media.removeListener).toHaveBeenCalledWith(expect.any(Function));
  expect(listeners.size).toBe(0);
});

test("browsers without Web Animations keep the updated heading and draft usable", () => {
  delete HTMLElement.prototype.animate;
  const view = render(<Page title="ภาพรวม" />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "ข้อมูลร่าง" } });
  view.rerender(<Page title="ตั้งค่า" />);
  expect(screen.getByRole("heading")).toHaveTextContent("ตั้งค่า");
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("ข้อมูลร่าง");
});

test("browsers without matchMedia can update and clean up the heading", () => {
  window.matchMedia = undefined;
  const view = render(<Page title="ภาพรวม" />);
  view.rerender(<Page title="ตั้งค่า" />);
  const animation = animate.mock.results[0].value;
  view.unmount();
  expect(animation.cancel).toHaveBeenCalledTimes(1);
});
