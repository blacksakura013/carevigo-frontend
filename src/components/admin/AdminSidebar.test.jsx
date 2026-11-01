import React, { StrictMode, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";

const originalMatchMedia = window.matchMedia;
let media, listeners, previousOverflow;

function Harness({ onClose }) {
  const [open, setOpen] = useState(false);
  return <MemoryRouter>
    <button onClick={() => setOpen(true)}>เปิดเมนูผู้ดูแล</button>
    <AdminSidebar activeMenu="dashboard" setActiveMenu={() => {}} open={open}
      onClose={() => { onClose(); setOpen(false); }} />
    <button>เนื้อหาภายนอก</button>
  </MemoryRouter>;
}

beforeEach(() => {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "auto";
  listeners = new Set();
  media = {
    matches: true,
    addEventListener: jest.fn((name, listener) => listeners.add(listener)),
    removeEventListener: jest.fn((name, listener) => listeners.delete(listener)),
  };
  window.matchMedia = jest.fn(() => media);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.style.overflow = previousOverflow;
  jest.restoreAllMocks();
});

function resizeToDesktop() {
  act(() => {
    media.matches = false;
    [...listeners].forEach(listener => listener({ matches: false }));
  });
}

function openDrawer() {
  const trigger = screen.getByRole("button", { name: "เปิดเมนูผู้ดูแล" });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

test("resizing an open mobile drawer to desktop releases the modal, scroll lock and focus", () => {
  const onClose = jest.fn();
  const view = render(<Harness onClose={onClose} />);
  openDrawer();
  const sidebar = screen.getByRole("dialog", { name: "เมนูผู้ดูแลระบบ" });
  expect(sidebar.inert).toBe(false);
  expect(sidebar).toHaveAttribute("aria-modal", "true");
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByRole("button", { name: "ปิดเมนู", exact: true })).toHaveFocus();

  resizeToDesktop();
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("complementary", { name: "เมนูผู้ดูแลระบบ" })).toBe(sidebar);
  expect(sidebar).not.toHaveAttribute("aria-modal");
  expect(sidebar).not.toHaveClass("is-open");
  expect(sidebar.inert).toBe(false);
  expect(document.body.style.overflow).toBe("auto");
  expect(screen.getByRole("button", { name: "ภาพรวมการดูแล" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: "ปิดเมนูนำทาง" })).not.toBeInTheDocument();
  view.unmount();
  expect(listeners.size).toBe(0);
});

test("Escape makes the closing mobile drawer inert and releases focus immediately", () => {
  const onClose = jest.fn();
  const view = render(<Harness onClose={onClose} />);
  const trigger = openDrawer();
  const sidebar = screen.getByRole("dialog", { name: "เมนูผู้ดูแลระบบ" });
  fireEvent.keyDown(document, { key: "Escape" });

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("complementary", { name: "เมนูผู้ดูแลระบบ" })).toBe(sidebar);
  expect(sidebar.inert).toBe(true);
  expect(sidebar).not.toHaveClass("is-open");
  expect(sidebar).not.toHaveAttribute("aria-modal");
  expect(document.body.style.overflow).toBe("auto");
  expect(trigger).toHaveFocus();
  const outside = screen.getByRole("button", { name: "เนื้อหาภายนอก" });
  outside.focus();
  const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  outside.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(false);
  expect(outside).toHaveFocus();
  view.unmount();
  expect(listeners.size).toBe(0);
});

test("StrictMode and unmount remove media and keyboard listeners while preserving prior body overflow", () => {
  document.body.style.overflow = "clip";
  const added = jest.spyOn(document, "addEventListener");
  const removed = jest.spyOn(document, "removeEventListener");
  const onClose = jest.fn();
  const view = render(<StrictMode><Harness onClose={onClose} /></StrictMode>);
  expect(listeners.size).toBe(1);
  openDrawer();
  expect(document.body.style.overflow).toBe("hidden");
  view.unmount();
  expect(document.body.style.overflow).toBe("clip");
  expect(listeners.size).toBe(0);
  const keyListeners = added.mock.calls.filter(([name]) => name === "keydown");
  const keyRemovals = removed.mock.calls.filter(([name]) => name === "keydown");
  expect(keyListeners.length).toBeGreaterThan(0);
  expect(keyRemovals).toEqual(keyListeners);
  resizeToDesktop();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
});
