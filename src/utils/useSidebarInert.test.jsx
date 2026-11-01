import React, { useCallback, useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { useSidebarInert } from "./useSidebarInert";

const originalMatchMedia = window.matchMedia;
let media, listeners;

function Drawer({ open = false, query = "(max-width: 900px)", initialInert }) {
  const ref = useRef(null);
  const attach = useCallback((node) => {
    if (node && initialInert !== undefined) node.inert = initialInert;
    ref.current = node;
  }, [initialInert]);
  useSidebarInert(ref, open, query);
  return <aside ref={attach} aria-label="เมนูนำทาง"><button>ภาพรวม</button></aside>;
}

beforeEach(() => {
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
});

function resize(matches) {
  act(() => {
    media.matches = matches;
    [...listeners].forEach(listener => listener({ matches }));
  });
}

test("a closed mobile drawer becomes inert immediately and opening retains the same interactive DOM", () => {
  const view = render(<Drawer initialInert={false} />);
  const sidebar = screen.getByRole("complementary");
  const button = screen.getByRole("button");
  expect(sidebar.inert).toBe(true);
  view.rerender(<Drawer open initialInert={false} />);
  expect(screen.getByRole("complementary")).toBe(sidebar);
  expect(screen.getByRole("button")).toBe(button);
  expect(sidebar.inert).toBe(false);
  view.rerender(<Drawer initialInert={false} />);
  expect(sidebar.inert).toBe(true);
  view.unmount();
  expect(sidebar.inert).toBe(false);
});

test("desktop navigation remains interactive even when the mobile open state is false", () => {
  media.matches = false;
  const view = render(<Drawer initialInert />);
  const sidebar = screen.getByRole("complementary");
  expect(sidebar.inert).toBe(false);
  view.rerender(<Drawer open initialInert />);
  expect(sidebar.inert).toBe(false);
  view.unmount();
  expect(sidebar.inert).toBe(true);
});

test("resizing updates a closed drawer immediately while an open drawer remains interactive", () => {
  const view = render(<Drawer />);
  const sidebar = screen.getByRole("complementary");
  expect(sidebar.inert).toBe(true);
  resize(false);
  expect(sidebar.inert).toBe(false);
  resize(true);
  expect(sidebar.inert).toBe(true);
  view.rerender(<Drawer open />);
  resize(false);
  resize(true);
  expect(sidebar.inert).toBe(false);
  expect(listeners.size).toBe(1);
  view.unmount();
  expect(listeners.size).toBe(0);
});

test("legacy media listeners resize correctly and are removed on cleanup", () => {
  delete media.addEventListener;
  delete media.removeEventListener;
  media.addListener = jest.fn(listener => listeners.add(listener));
  media.removeListener = jest.fn(listener => listeners.delete(listener));
  const view = render(<Drawer initialInert={false} query="(max-width: 1023px)" />);
  const sidebar = screen.getByRole("complementary");
  expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
  expect(sidebar.inert).toBe(true);
  resize(false);
  expect(sidebar.inert).toBe(false);
  view.unmount();
  expect(media.removeListener).toHaveBeenCalledWith(expect.any(Function));
  expect(listeners.size).toBe(0);
  expect(sidebar.inert).toBe(false);
});

test("StrictMode keeps one live listener and restores the prior inert value after unmount", () => {
  const view = render(<React.StrictMode><Drawer initialInert={false} /></React.StrictMode>);
  const sidebar = screen.getByRole("complementary");
  expect(sidebar.inert).toBe(true);
  expect(listeners.size).toBe(1);
  view.unmount();
  expect(listeners.size).toBe(0);
  expect(sidebar.inert).toBe(false);
});

test.each([undefined, () => { throw new Error("Media queries unavailable"); }])(
  "missing or unavailable matchMedia keeps the navigation interactive",
  (matchMedia) => {
    window.matchMedia = matchMedia;
    const view = render(<Drawer initialInert />);
    const sidebar = screen.getByRole("complementary");
    expect(sidebar.inert).toBe(false);
    view.unmount();
    expect(sidebar.inert).toBe(true);
    expect(listeners.size).toBe(0);
  },
);
