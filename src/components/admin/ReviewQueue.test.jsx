import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import ReviewQueue, { ReviewPolicyPanel } from "./ReviewQueue";
import {
  decideReviews,
  getReviewQueue,
  getReviewSettings,
} from "../../api/api";

jest.mock("../../api/api", () => ({
  decideReviews: jest.fn(),
  getReviewQueue: jest.fn(),
  getReviewSettings: jest.fn(),
  getApiError: (_error, fallback) => fallback,
}));
const snapshotAt = "2026-11-01T08:00:00.000Z";
const profile = {
  firstName: "ผู้ส่ง",
  lastName: "ทดสอบ",
  citizenId: "1234567890123",
  province: "กรุงเทพมหานคร",
};
const pending = {
  _id: "record-1",
  type: "blood_pressure",
  value: { systolic: 130, diastolic: 82 },
  submittedProfile: profile,
  submittedAt: "2026-11-01T07:00:00Z",
  reviewDueAt: "2026-11-01T16:59:00Z",
  reviewStatus: "pending",
  reviewHistory: [
    {
      at: "2026-11-01T07:00:00Z",
      from: null,
      to: "pending",
      source: "guest",
      reason: "ส่งจากหน้าบันทึกทั่วไป",
    },
  ],
};
const second = {
  ...pending,
  _id: "record-2",
  type: "sugar",
  value: { fbs: 95 },
};
const approved = {
  ...pending,
  _id: "record-approved",
  reviewStatus: "approved",
  reviewedAt: snapshotAt,
  reviewSource: "email",
  reviewHistory: [
    ...pending.reviewHistory,
    {
      at: snapshotAt,
      from: "pending",
      to: "approved",
      source: "email",
      reason: "ตรวจสอบข้อมูลแล้ว",
    },
  ],
};
const response = (records, total = records.length, hasMore = false) => ({
  data: { data: records, total, page: 1, limit: 20, hasMore, snapshotAt },
});
beforeEach(() => {
  jest.clearAllMocks();
  getReviewQueue.mockResolvedValue(response([pending, second]));
  decideReviews.mockResolvedValue({
    data: { data: { changed: 2, skipped: 0, matched: 2 } },
  });
  getReviewSettings.mockResolvedValue({
    data: {
      data: {
        timezone: "Asia/Bangkok",
        autoApprovalTime: "23:59",
        policy: "same-day",
        activeAdminRecipients: 2,
        outbox: { pending: 1, sent: 9, failed: 2 },
        counts: { pending: 2, approved: 4, rejected: 1 },
      },
    },
  });
});

test("page selection includes only pending records and requires explicit confirmation", async () => {
  getReviewQueue.mockResolvedValue(response([pending, second, approved]));
  render(<ReviewQueue />);
  await screen.findByRole("table", { name: "รายการตรวจสอบบันทึกสุขภาพ" });
  const rows = screen.getAllByRole("row");
  expect(within(rows[3]).getByRole("checkbox")).toBeDisabled();
  fireEvent.click(screen.getByLabelText("เลือกบันทึกรอยืนยันทั้งหมดในหน้านี้"));
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันรายการที่เลือก" }));
  const dialog = screen.getByRole("dialog", { name: "ยืนยันบันทึกที่เลือก" });
  expect(decideReviews).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "ยืนยัน 2 รายการ" }),
  );
  await waitFor(() =>
    expect(decideReviews).toHaveBeenCalledWith({
      ids: ["record-1", "record-2"],
      action: "approve",
    }),
  );
  expect(await screen.findByText("ยืนยันแล้ว 2 รายการ")).toBeInTheDocument();
});

test("profile-only submissions can be inspected and selected as review units without clinical values", async () => {
  getReviewQueue.mockResolvedValue(response([{ ...pending, _id: "profile-submission", type: "profile", value: {},
    reviewEntity: "submission-profile", submittedProfile: { ...profile, gender: "female", smokingStatus: "never" } }]));
  render(<ReviewQueue />);
  expect(await screen.findByText("ไม่ได้ระบุผลตรวจสุขภาพ")).toBeInTheDocument();
  const selected = screen.getByRole("checkbox", { name: /เลือกบันทึก.*ข้อมูลผู้รับบริการ/ });
  expect(selected).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "ดูบันทึก" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("หญิง")).toBeInTheDocument();
  expect(within(dialog).getByText("ไม่เคยสูบบุหรี่")).toBeInTheDocument();
  expect(within(dialog).queryByText(/130.*82.*mmHg/)).not.toBeInTheDocument();
  expect(decideReviews).not.toHaveBeenCalled();
});

test("selecting all matching records freezes the cutoff and preserves cancellation reason", async () => {
  getReviewQueue.mockResolvedValue(response([pending, second], 67, true));
  render(<ReviewQueue />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "เลือกทั้งหมด 67 รายการตามตัวกรอง",
    }),
  );
  expect(
    screen.getByText(/รายการใหม่ที่ส่งหลังจากนี้ไม่รวมในการเลือกครั้งนี้/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ยกเลิกรายการที่เลือก" }));
  const dialog = screen.getByRole("dialog", { name: "ยกเลิกบันทึกที่เลือก" });
  fireEvent.change(
    within(dialog).getByLabelText("เหตุผลหรือหมายเหตุ (ถ้ามี)"),
    { target: { value: "ข้อมูลส่งซ้ำ" } },
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "ยืนยันยกเลิก 67 รายการ" }),
  );
  await waitFor(() =>
    expect(decideReviews).toHaveBeenCalledWith({
      all: true,
      filters: { status: "pending" },
      cutoff: snapshotAt,
      action: "reject",
      reason: "ข้อมูลส่งซ้ำ",
    }),
  );
});

test("individual selections persist across pages without approving unrelated records", async () => {
  getReviewQueue.mockImplementation((page) =>
    Promise.resolve(response(page === 1 ? [pending] : [second], 2, page === 1)),
  );
  render(<ReviewQueue />);
  await screen.findByRole("table", { name: "รายการตรวจสอบบันทึกสุขภาพ" });
  fireEvent.click(
    screen.getByLabelText("เลือกบันทึก ผู้ส่ง ทดสอบ ความดันโลหิต"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "หน้าถัดไปของรายการตรวจสอบ" }),
  );
  await screen.findByText("95 mg/dL");
  fireEvent.click(
    screen.getByLabelText("เลือกบันทึก ผู้ส่ง ทดสอบ น้ำตาลในเลือด"),
  );
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันรายการที่เลือก" }));
  fireEvent.click(screen.getByRole("button", { name: "ยืนยัน 2 รายการ" }));
  await waitFor(() =>
    expect(decideReviews).toHaveBeenCalledWith({
      ids: ["record-1", "record-2"],
      action: "approve",
    }),
  );
});

test("changing review filters clears earlier selection and sends server status/search", async () => {
  render(<ReviewQueue />);
  await screen.findByRole("table", { name: "รายการตรวจสอบบันทึกสุขภาพ" });
  fireEvent.click(screen.getByLabelText("เลือกบันทึกรอยืนยันทั้งหมดในหน้านี้"));
  fireEvent.change(screen.getByLabelText("สถานะการตรวจสอบ"), {
    target: { value: "all" },
  });
  expect(
    screen.getByRole("button", { name: "ยืนยันรายการที่เลือก" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("ค้นหาบันทึกเพื่อตรวจสอบ"), {
    target: { value: "กรุงเทพ" },
  });
  await waitFor(() =>
    expect(getReviewQueue).toHaveBeenLastCalledWith(1, 20, {
      status: "all",
      search: "กรุงเทพ",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "อัปเดตรายการ" })).toBeEnabled(),
  );
});

test("decision failure keeps the selected records and allows retry, reporting skipped concurrent decisions", async () => {
  decideReviews
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      data: { data: { changed: 1, skipped: 1, matched: 2 } },
    });
  render(<ReviewQueue />);
  await screen.findByRole("table", { name: "รายการตรวจสอบบันทึกสุขภาพ" });
  fireEvent.click(screen.getByLabelText("เลือกบันทึกรอยืนยันทั้งหมดในหน้านี้"));
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันรายการที่เลือก" }));
  fireEvent.click(screen.getByRole("button", { name: "ยืนยัน 2 รายการ" }));
  expect(
    await screen.findByText(
      "เปลี่ยนสถานะไม่สำเร็จ รายการที่เลือกยังอยู่ กรุณาลองอีกครั้ง",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยัน 2 รายการ" }));
  expect(
    await screen.findByText(
      "ยืนยันแล้ว 1 รายการ · ข้าม 1 รายการที่เปลี่ยนสถานะไปแล้ว",
    ),
  ).toBeInTheDocument();
});

test("details show guest submission, email approval and audit notes without deleting history", async () => {
  getReviewQueue.mockResolvedValue(response([approved]));
  render(<ReviewQueue />);
  fireEvent.click(await screen.findByRole("button", { name: "ดูบันทึก" }));
  const dialog = screen.getByRole("dialog", {
    name: "รายละเอียดและประวัติการตรวจสอบ",
  });
  expect(
    within(dialog).getByText("ส่งจากหน้าบันทึกทั่วไป"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText(/ลิงก์อีเมล/)).toBeInTheDocument();
  expect(within(dialog).getByText("ตรวจสอบข้อมูลแล้ว")).toBeInTheDocument();
  expect(within(dialog).getByText("130 mmHg")).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("review settings expose same-day Thai deadline and actual email outbox counts", async () => {
  render(<ReviewPolicyPanel />);
  expect(
    await screen.findByText("ผู้ดูแลที่รับแจ้งเตือน 2 บัญชี"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("ยืนยันอัตโนมัติ 23:59 น. วันเดียวกับวันที่ส่ง"),
  ).toBeInTheDocument();
  expect(screen.getByText("อีเมลส่งไม่สำเร็จ")).toBeInTheDocument();
  expect(screen.getByText("9")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
