import React, { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoadingScreen from "./LoadingScreen";
import { LoadingScreenProvider } from "./LoadingScreenContext";
import ServerReadinessNotice from "./ServerReadinessNotice";

const waiting = { status: "waiting" };
jest.mock("../api/api", () => ({
  getApiReadinessSnapshot: () => waiting,
  subscribeApiReadiness: () => () => {},
}));

function Preview({ full = true }) {
  return <StrictMode><MemoryRouter><LoadingScreenProvider>
    <ServerReadinessNotice />
    {full && <LoadingScreen />}
  </LoadingScreenProvider></MemoryRouter></StrictMode>;
}

test("uses one accessible status during full-screen verification and keeps a guest entry available", () => {
  render(<Preview />);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "กำลังตรวจสอบการเข้าสู่ระบบ…" })).toBeInTheDocument();
  expect(document.querySelector(".server-readiness-notice")).toBeNull();
  expect(screen.getByRole("link", { name: /บันทึกสุขภาพโดยไม่เข้าสู่ระบบ/ })).toHaveAttribute("href", "/guest");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

test("returns to compact waiting after leaving full-screen verification without leaking StrictMode registrations", () => {
  const view = render(<Preview />);
  view.rerender(<Preview full={false} />);
  expect(document.querySelector("[data-loading-screen='full']")).toBeNull();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status")).toHaveTextContent("ข้อมูลที่กรอกยังอยู่");
  view.rerender(<Preview />);
  expect(document.querySelector(".server-readiness-notice")).toBeNull();
  expect(screen.getAllByRole("status")).toHaveLength(1);
});
