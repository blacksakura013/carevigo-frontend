import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CohortReportPanel from "./CohortReportPanel";

const byType = { blood_pressure: 4, sugar: 2, cholesterol: 1, bmi: 1, unknown: 0 };
function dto(overrides = {}) {
  return {
    range: { from: "2026-11-01", to: "2026-11-02", asOf: "2026-11-02T03:00:00.000Z", timeZone: "Asia/Bangkok", bucket: "day" },
    filters: { disease: "diabetes", search: "", activity: "all" },
    summary: { cohortPeople: 10, withRecords: 3, withoutRecords: 7, people: 10, total: 8, approved: 4, pending: 2, rejected: 1, unknown: 1, byType },
    diseases: [{ id: "diabetes", label: "เบาหวาน", people: 10 }, { id: "hypertension", label: "ความดันโลหิตสูง", people: 6 }, { id: "unknown", label: "ไม่ระบุประวัติ", people: 2 }],
    timeline: [
      { date: "2026-11-01", people: 2, total: 5, approved: 3, pending: 1, rejected: 1, unknown: 0, byType },
      { date: "2026-11-02", people: 1, total: 3, approved: 1, pending: 1, rejected: 0, unknown: 1, byType },
    ],
    ...overrides,
  };
}

test("separates people coverage, filtered people, recording categories and approval status counts", () => {
  render(<CohortReportPanel data={dto()} onActivitySelect={jest.fn()} onDiseaseSelect={jest.fn()} />);
  const coverage = screen.getByRole("group", { name: "เลือกผู้รับบริการตามการมีบันทึก" });
  expect(within(coverage).getByRole("button", { name: /ผู้รับบริการในกลุ่มทั้งหมด/ })).toHaveTextContent("10คน");
  expect(within(coverage).getByRole("button", { name: /^มีบันทึกในช่วงนี้/ })).toHaveTextContent("3คน");
  expect(within(coverage).getByRole("button", { name: /ยังไม่มีบันทึกในช่วงนี้/ })).toHaveTextContent("7คน");
  const totals = screen.getByRole("region", { name: "สรุปตามตัวกรองปัจจุบัน" });
  expect(totals).toHaveTextContent("ผู้รับบริการที่ตรงตัวกรอง10คน");
  expect(totals).toHaveTextContent("บันทึกสุขภาพทั้งหมด8รายการ");
  expect(within(totals).getByRole("article", { name: "จำนวนรายการความดันโลหิต" })).toHaveTextContent("4รายการ");
  expect(within(totals).getByRole("article", { name: "จำนวนรายการน้ำตาลในเลือด" })).toHaveTextContent("2รายการ");
  expect(totals).toHaveTextContent("ยืนยันแล้ว4รายการ"); expect(totals).toHaveTextContent("รอตรวจสอบ2รายการ");
  expect(totals).toHaveTextContent("ยกเลิก1รายการ"); expect(totals).toHaveTextContent("ไม่ทราบสถานะ1รายการ");
  expect(totals).toHaveTextContent("ไม่ใช่ระดับความรุนแรงของโรค");
});

test("native activity and disease buttons support keyboard selection without recalculating report data", () => {
  const onActivitySelect = jest.fn(), onDiseaseSelect = jest.fn();
  const data = dto();
  const { rerender } = render(<CohortReportPanel data={data} onActivitySelect={onActivitySelect} onDiseaseSelect={onDiseaseSelect} />);
  const recorded = screen.getByRole("button", { name: /^มีบันทึกในช่วงนี้/ }); recorded.focus(); userEvent.keyboard("{Enter}");
  expect(onActivitySelect).toHaveBeenCalledWith("recorded");
  const disease = screen.getByRole("button", { name: /^ความดันโลหิตสูง/ }); disease.focus(); userEvent.keyboard(" ");
  expect(onDiseaseSelect).toHaveBeenCalledWith("hypertension");
  rerender(<CohortReportPanel data={{ ...data, filters: { ...data.filters, disease: "hypertension", activity: "recorded" }, summary: { ...data.summary, people: 3 } }} onActivitySelect={onActivitySelect} onDiseaseSelect={onDiseaseSelect} />);
  expect(screen.getByRole("button", { name: /^มีบันทึกในช่วงนี้/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /^ความดันโลหิตสูง/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /ผู้รับบริการในกลุ่มทั้งหมด/ })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("region", { name: "สรุปตามตัวกรองปัจจุบัน" })).toHaveTextContent("ผู้รับบริการที่ตรงตัวกรอง3คน");
  expect(data.summary.people).toBe(10);
});

test("disease scope and current-profile grouping are explicit and never imply a new diagnosis", () => {
  render(<CohortReportPanel data={dto()} />);
  const groups = screen.getByRole("region", { name: "จำนวนคนในแต่ละกลุ่ม (ไม่จำกัดกลุ่มโรคที่เลือก)" });
  expect(groups).toHaveTextContent("ใช้คำค้นหาและตัวเลือกการมีบันทึกปัจจุบัน");
  expect(groups).toHaveTextContent("ประวัติโรคประจำตัวในข้อมูลส่วนตัวปัจจุบัน");
  expect(groups).toHaveTextContent("ไม่ใช่การวินิจฉัยจากผลตรวจ");
  expect(groups).toHaveTextContent("คนเดิมอาจอยู่หลายกลุ่ม");
  expect(within(groups).getByRole("button", { name: /^เบาหวาน/ })).toBeDisabled();
  expect(within(groups).getByRole("button", { name: /^ความดันโลหิตสูง/ })).toBeDisabled();
});

test("daily recording volume uses B.E. Thai dates and has an accessible status table", () => {
  render(<CohortReportPanel data={dto()} />);
  const chart = screen.getByRole("img", { name: "จำนวนรายการที่บันทึกรายวัน" });
  expect(within(chart).getByText("1 พ.ย. 2569: 2 คน, 5 รายการ", { selector: "title" })).toBeInTheDocument();
  expect(within(chart).getAllByText(/รายการ$/, { selector: "title" })).toHaveLength(2);
  userEvent.click(screen.getByText("ตารางจำนวนคนและรายการรายวัน (2 ช่วง)", { selector: "summary" }));
  const table = screen.getByRole("table", { name: "จำนวนคนและรายการตามวันที่บันทึก (พ.ศ.)" });
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  const first = within(table).getAllByRole("row")[1];
  expect(first).toHaveTextContent("1 พ.ย. 2569"); expect(first).toHaveTextContent("2 คน");
  expect(first).toHaveTextContent("รวม 5 รายการ"); expect(first).toHaveTextContent("ยืนยันแล้ว3 รายการ");
  expect(first).toHaveTextContent("รอตรวจสอบ1 รายการ");
  expect(table).not.toHaveTextContent("2026");
  expect(screen.getByText(/คนเดิมอาจปรากฏหลายช่วง/)).toHaveTextContent("ไม่ใช่แนวโน้มว่าสุขภาพดีขึ้นหรือแย่ลง");
});

test("monthly buckets retain Buddhist year, their own counts and all zero-count periods", () => {
  const data = dto();
  const monthly = [{ ...data.timeline[0], date: "2026-10" }, { ...data.timeline[1], date: "2026-11", people: 0, total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0 }];
  render(<CohortReportPanel data={{ ...data, range: { ...data.range, from: "2026-06-01", bucket: "month" }, timeline: monthly }} />);
  const chart = screen.getByRole("img", { name: "จำนวนรายการที่บันทึกรายเดือน" });
  expect(within(chart).getByText("ตุลาคม 2569: 2 คน, 5 รายการ", { selector: "title" })).toBeInTheDocument();
  expect(within(chart).getByText("พฤศจิกายน 2569: 0 คน, 0 รายการ", { selector: "title" })).toBeInTheDocument();
  userEvent.click(screen.getByText("ตารางจำนวนคนและรายการรายเดือน (2 ช่วง)", { selector: "summary" }));
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")[2]).toHaveTextContent("พฤศจิกายน 2569ผู้มีรายการ: 0 คนรวม 0 รายการ");
});

test("empty periods describe zero recordings without inventing a graph or a clinical reading", () => {
  const data = dto();
  render(<CohortReportPanel data={{ ...data, timeline: data.timeline.map(row => ({ ...row, people: 0, total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0 })) }} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText("ยังไม่มีรายการบันทึกในช่วงเวลาและตัวกรองนี้")).toBeInTheDocument();
  expect(screen.getByText("ตารางจำนวนคนและรายการรายวัน (2 ช่วง)", { selector: "summary" })).toBeInTheDocument();
});

test("missing data shows a clear empty message and unavailable values do not become fake zeros", () => {
  const view = render(<CohortReportPanel />);
  expect(screen.getByRole("region", { name: "สรุปผลสุขภาพกลุ่มผู้รับบริการ" })).toHaveTextContent("ยังไม่มีข้อมูลสรุปที่แสดงได้");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  const data = dto(); delete data.summary.byType;
  view.rerender(<CohortReportPanel data={data} />);
  expect(screen.getByRole("article", { name: "จำนวนรายการน้ำตาลในเลือด" })).toHaveTextContent("—รายการ");
});

test("unknown category records are disclosed independently of the four measured health categories", () => {
  const data = dto();
  render(<CohortReportPanel data={{ ...data, summary: { ...data.summary, byType: { ...byType, unknown: 2 } } }} />);
  expect(screen.getByText("มีบันทึกไม่ทราบหมวด 2 รายการ รวมอยู่ในจำนวนบันทึกทั้งหมดแล้ว")).toBeInTheDocument();
});
