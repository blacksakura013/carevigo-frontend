import { act, render, screen } from "@testing-library/react";
import ServerReadinessNotice from "./ServerReadinessNotice";
import { getApiReadinessSnapshot, subscribeApiReadiness } from "../api/api";

jest.mock("../api/api", () => ({
  getApiReadinessSnapshot: jest.fn(),
  subscribeApiReadiness: jest.fn(),
}));

test("announces a slow connection and removes the notice once ready", () => {
  let snapshot = { status: "checking" }, listener;
  const unsubscribe = jest.fn();
  getApiReadinessSnapshot.mockImplementation(() => snapshot);
  subscribeApiReadiness.mockImplementation(callback => { listener = callback; return unsubscribe; });
  const { unmount } = render(<ServerReadinessNotice />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  act(() => { snapshot = { status: "waiting" }; listener(); });
  expect(screen.getByRole("status")).toHaveTextContent("กำลังเชื่อมต่อระบบ");
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("status")).toHaveTextContent("ข้อมูลที่กรอกยังอยู่");
  act(() => { snapshot = { status: "ready" }; listener(); });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test("leaves failed connection feedback to the requesting form", () => {
  getApiReadinessSnapshot.mockReturnValue({ status: "error" });
  subscribeApiReadiness.mockReturnValue(() => {});
  render(<ServerReadinessNotice />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
