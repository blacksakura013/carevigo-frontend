import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EmailReview from "./EmailReview";
import { decideEmailReview, getEmailReview } from "../api/api";
jest.mock("../api/api", () => ({
  decideEmailReview: jest.fn(),
  getEmailReview: jest.fn(),
}));
const record = {
  _id: "health-1",
  type: "blood_pressure",
  value: { systolic: 125, diastolic: 80 },
  reviewStatus: "pending",
  submittedAt: "2026-11-01T03:00:00Z",
  reviewHistory: [
    { status: "pending", at: "2026-11-01T03:00:00Z", source: "guest" },
  ],
};
const data = {
  submissionId: "submission-1",
  patientName: "ผู้รับบริการ ทดสอบ",
  maskedCitizenId: "•••••••••0123",
  reviewDueAt: "2026-11-01T16:59:00Z",
  canDecide: true,
  records: [record],
};
beforeEach(() => {
  jest.clearAllMocks();
  getEmailReview.mockResolvedValue({ data: { data } });
});
function renderPage(path = "/review-email?token=opaque-token&action=approve") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EmailReview />
    </MemoryRouter>,
  );
}
test("opening an email approve link only reads the scoped submission and requires a confirmation", async () => {
  renderPage();
  await screen.findByText("ผู้รับบริการ ทดสอบ");
  expect(getEmailReview).toHaveBeenCalledWith("opaque-token");
  expect(decideEmailReview).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "ยืนยันการรับรอง" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/23:59/)).toBeInTheDocument();
});
test("email cancellation is confirmed and the cancelled record remains visible in history", async () => {
  renderPage("/review-email?token=opaque-token&action=reject");
  await screen.findByText("ผู้รับบริการ ทดสอบ");
  getEmailReview.mockResolvedValue({
    data: {
      data: {
        ...data,
        canDecide: false,
        records: [
          {
            ...record,
            reviewStatus: "rejected",
            reviewHistory: [
              ...record.reviewHistory,
              {
                status: "rejected",
                source: "email",
                at: "2026-11-01T04:00:00Z",
              },
            ],
          },
        ],
      },
    },
  });
  decideEmailReview.mockResolvedValue({
    data: { data: { changed: 1, skipped: 0 } },
  });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันการยกเลิก" }));
  await waitFor(() =>
    expect(decideEmailReview).toHaveBeenCalledWith("opaque-token", "reject"),
  );
  expect(
    await screen.findByText("ยกเลิก 1 รายการเรียบร้อยแล้ว"),
  ).toBeInTheDocument();
  expect(screen.getByText("ความดันโลหิต")).toBeInTheDocument();
  expect(screen.getByText("ยกเลิกแล้ว")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "ยืนยันการยกเลิก" }),
  ).not.toBeInTheDocument();
});
test("an invalid email link has a recovery path without any record disclosure", async () => {
  getEmailReview.mockRejectedValue({ response: { status: 401 } });
  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /ลิงก์นี้ไม่ถูกต้องหรือหมดอายุ/,
  );
  expect(screen.queryByText("ผู้รับบริการ ทดสอบ")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /ไปยังคิวตรวจสอบ/ })).toHaveAttribute(
    "href",
    "/admin?view=reviews",
  );
  expect(decideEmailReview).not.toHaveBeenCalled();
});
