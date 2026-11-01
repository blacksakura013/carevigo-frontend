import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HealthProgressPanel from "./HealthProgressPanel";
import { HEALTH_PROGRESS_METRICS } from "../utils/healthProgress";

const point = (value, day, id = `r${day}`) => ({ value, recordedAt: `2026-10-${String(day).padStart(2, "0")}T18:00:00.000Z`, recordId: id });
const metric = (...series) => ({ total: series.length, first: series[0] || null, previous: series.length > 1 ? series[series.length - 2] : null, latest: series[series.length - 1] || null, series, seriesLimit: 100, hasEarlier: false });
function dto(metrics = {}, summary = {}) {
  return { schemaVersion: 1, patient: { citizenId: "1234567890123", firstName: "ทดสอบ" }, range: { from: "2026-10-01", to: "2026-11-01", asOf: "2026-11-01T00:00:00.000Z", timeZone: "Asia/Bangkok" },
    summary: { total: 2, approved: 2, pending: 0, rejected: 0, unknown: 0, byType: {}, firstRecordedAt: point(1, 1).recordedAt, lastRecordedAt: point(1, 10).recordedAt, ...summary },
    metrics: { ...Object.fromEntries(Object.keys(HEALTH_PROGRESS_METRICS).map(key => [key, metric()])), ...metrics }, records: [], latestApprovedRecords: [], pagination: { page: 1, limit: 20, total: 2, hasMore: false, reviewStatus: "all" } };
}

test("pending-only history keeps counts visible while charts, comparisons and zeros remain absent", () => {
  render(<HealthProgressPanel data={dto({}, { total: 3, approved: 0, pending: 2, rejected: 1 })} />);
  const panel = screen.getByRole("region", { name: "ความเปลี่ยนแปลงสุขภาพ" });
  expect(panel).toHaveTextContent("รอตรวจสอบ"); expect(panel).toHaveTextContent("ยกเลิก / ไม่นำมาเปรียบเทียบ");
  expect(panel).toHaveTextContent("ยังไม่มีค่าความดันตัวบนที่ยืนยันแล้วในช่วงนี้"); expect(panel).toHaveTextContent("สถานะเหล่านี้เป็นการตรวจสอบข้อมูล");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(within(screen.getByRole("article", { name: "ความดันตัวบน" })).getAllByText("ยังไม่มีข้อมูล", { selector: "dd > span" })).toHaveLength(2);
});

test("HbA1c-only data opens the available sugar metric and never pretends it is FBS", () => {
  render(<HealthProgressPanel data={dto({ hba1c: metric(point(6.4, 1), point(6.5, 10)) })} />);
  expect(screen.getByRole("button", { name: "น้ำตาลในเลือด", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("combobox", { name: "เลือกค่าที่ต้องการติดตาม" })).toHaveValue("hba1c");
  const card = screen.getByRole("article", { name: "น้ำตาลสะสม (HbA1c)" });
  expect(card).toHaveTextContent("เพิ่มขึ้น 0.1 %"); expect(card).not.toHaveTextContent("mg/dL");
  expect(screen.getByRole("img", { name: "กราฟน้ำตาลสะสม (HbA1c)ตามวันที่บันทึก" })).toBeInTheDocument();
  expect(screen.getByRole("article", { name: "น้ำตาลขณะอดอาหาร (FBS)" })).toHaveTextContent("ยังไม่มีข้อมูล");
});

test("actual approved samples, prior and baseline are read in B.E. Thai dates with an accessible equivalent table", () => {
  render(<HealthProgressPanel data={dto({ systolic: metric(point(150, 1), point(135, 10)) })} />);
  const card = screen.getByRole("article", { name: "ความดันตัวบน" });
  expect(card).toHaveTextContent("ลดลง 15 mmHg"); expect(card).toHaveTextContent("2 ต.ค. 2569");
  expect(card).toHaveTextContent("11 ต.ค. 2569"); expect(card).toHaveTextContent("ครั้งแรกในช่วงนี้");
  userEvent.click(screen.getByText("ตารางค่าที่แสดงในกราฟ", { selector: "summary" }));
  const table = screen.getByRole("table", { name: "ค่าที่แสดงในกราฟ" });
  expect(within(table).getAllByRole("row")).toHaveLength(3); expect(table).toHaveTextContent("150 mmHg"); expect(table).toHaveTextContent("135 mmHg");
  expect(screen.getByText(/การเพิ่มหรือลดของตัวเลขยังไม่ใช่ข้อสรุป/)).toBeInTheDocument();
});

test("single result is a point without a connecting line or invented prior delta", () => {
  render(<HealthProgressPanel data={dto({ fbs: metric(point(100, 10)) }, { total: 1, approved: 1 })} />);
  const chart = screen.getByRole("img"); expect(within(chart).getAllByText(/100 mg\/dL/, { selector: "title" })).toHaveLength(1);
  expect(screen.getByText("มีค่าที่แสดงเพียงครั้งเดียว จึงยังสรุปความเปลี่ยนแปลงไม่ได้")).toBeInTheDocument();
  expect(screen.getByRole("article", { name: "น้ำตาลขณะอดอาหาร (FBS)" })).toHaveTextContent("ยังไม่มีค่าครั้งก่อนสำหรับเปรียบเทียบ");
});

test("category and metric choices work with the keyboard and remain selected when detail pagination changes", () => {
  const data = dto({ systolic: metric(point(120, 1), point(130, 10)), ldl: metric(point(140, 1), point(120, 10)), hdl: metric(point(40, 1), point(45, 10)) });
  const { rerender } = render(<HealthProgressPanel data={data} />);
  const lipids = screen.getByRole("button", { name: "ไขมันในเลือด", exact: true }); lipids.focus(); userEvent.keyboard("{Enter}");
  expect(lipids).toHaveAttribute("aria-pressed", "true"); expect(screen.getByRole("article", { name: "LDL", exact: true })).toHaveTextContent("ลดลง 20 mg/dL");
  userEvent.selectOptions(screen.getByRole("combobox"), "hdl"); expect(screen.getByRole("img")).toHaveAccessibleName("กราฟHDLตามวันที่บันทึก");
  rerender(<HealthProgressPanel data={{ ...data, pagination: { ...data.pagination, page: 2, reviewStatus: "pending" }, records: [{ reviewStatus: "pending" }] }} />);
  expect(screen.getByRole("combobox")).toHaveValue("hdl"); expect(screen.getByRole("button", { name: "ไขมันในเลือด", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("article", { name: "HDL", exact: true })).toHaveTextContent("เพิ่มขึ้น 5 mg/dL");
});

test("the bounded chart explicitly reports coverage and keeps the full-range baseline visible", () => {
  const first = point(180, 1, "first"), previous = point(140, 20, "prior"), latest = point(130, 31, "latest");
  render(<HealthProgressPanel data={dto({ systolic: { total: 150, first, previous, latest, series: [previous, latest], seriesLimit: 100, hasEarlier: true } })} />);
  expect(screen.getByText(/แสดง 2 จาก 150 ค่าที่มีในช่วงนี้/)).toHaveTextContent("กราฟจำกัดไม่เกิน 100 ค่าล่าสุด");
  expect(screen.getByRole("article", { name: "ความดันตัวบน" })).toHaveTextContent("180 mmHg");
  expect(within(screen.getByRole("img")).getAllByText(/mmHg/, { selector: "title" })).toHaveLength(2);
});

test("legacy or malformed DTO gives an explicit service-data message rather than a fake empty history", () => {
  const { rerender } = render(<HealthProgressPanel data={{ data: [] }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลจากระบบไม่ครบหรือยังไม่รองรับ"); expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  rerender(<HealthProgressPanel data={dto({ hba1c: metric(point(6.5, 10)) })} />);
  expect(screen.getByRole("combobox")).toHaveValue("hba1c");
});

test("BMI, weight and height stay separate from any stored CVD score and unknown review counts are explicit", () => {
  const data = dto({ weight: metric(point(60, 1), point(61, 10)), height: metric(point(165, 1)), bmi: metric(point(22.04, 1), point(22.4, 10)) }, { total: 3, approved: 2, unknown: 1 });
  data.currentRisk = { status: "calculated", score: 18.78 };
  render(<HealthProgressPanel data={data} />);
  expect(screen.getByRole("article", { name: "น้ำหนัก", exact: true })).toHaveTextContent("เพิ่มขึ้น 1 กก.");
  expect(screen.getByRole("article", { name: "ส่วนสูง", exact: true })).toHaveTextContent("165 ซม.");
  expect(screen.getByRole("article", { name: "BMI", exact: true })).toHaveTextContent("22.4 กก./ม²");
  expect(screen.getByRole("region")).toHaveTextContent("ไม่ระบุสถานะ / ไม่นำมาเปรียบเทียบ"); expect(screen.queryByText(/18\.78/)).not.toBeInTheDocument();
});

test("malformed points never draw zeros or reconnect a missing section", () => {
  const good = point(100, 1), bad = point("300", 2), latest = point(120, 10);
  render(<HealthProgressPanel data={dto({ fbs: { ...metric(good, bad, latest), previous: good } })} />);
  const chart = screen.getByRole("img"); expect(within(chart).getAllByText(/mg\/dL/, { selector: "title" })).toHaveLength(2); expect(within(chart).queryByText(/300 mg\/dL/, { selector: "title" })).not.toBeInTheDocument();
  expect(screen.getByText(/ข้อมูลบางจุดไม่ครบหรืออ่านไม่ได้/)).toBeInTheDocument();
  expect(screen.getByRole("article", { name: "น้ำตาลขณะอดอาหาร (FBS)" })).toHaveTextContent("เพิ่มขึ้น 20 mg/dL");
});
