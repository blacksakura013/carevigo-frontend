import { fireEvent, render, screen, within } from "@testing-library/react";
import HealthResultSummary from "./HealthResultSummary";
import { interpretHealthRecords } from "../utils/healthInterpretation";

jest.mock("../utils/healthInterpretation", () => ({ interpretHealthRecords: jest.fn() }));
const source = { id: "guideline", title: "เกณฑ์อ้างอิงผลตรวจ", url: "https://example.test/guideline" };
const card = { id: "sugar-fbs", type: "sugar", title: "น้ำตาลในเลือด", level: "urgent", label: "ควรรับการประเมินเร่งด่วน",
  explanation: "ผลตรวจครั้งนี้สูง ควรประเมินร่วมกับอาการ", measurements: [{ label: "น้ำตาลขณะอดอาหาร", value: "343", unit: "mg/dL" }],
  reference: "เกณฑ์ทดสอบจากแนวทางอ้างอิง", actions: ["ติดต่อสถานพยาบาลเพื่อประเมินวันนี้"], sourceKeys: ["guideline"] };
beforeEach(() => {
  jest.clearAllMocks();
  interpretHealthRecords.mockReturnValue({ hasMeasurements: true, cards: [card], priority: { title: "ดูแลผลตรวจนี้ก่อน", description: "ควรได้รับคำแนะนำจากบุคลากรทางการแพทย์" },
    note: "เป็นการคัดกรองจากข้อมูลครั้งนี้", emergencyAdvice: "หากมีอาการผิดปกติรุนแรง ให้ขอความช่วยเหลือฉุกเฉิน", sources: [source] });
});

test("renders urgent action before measured values with a named region, textual severity and current-entry context", () => {
  const records = [{ type: "sugar", value: { fbs: 343 } }];
  render(<HealthResultSummary records={records} context="pending-review" birthDate="19800101" gender="female" asOf="2026-11-01T00:00:00Z" />);
  expect(interpretHealthRecords).toHaveBeenCalledWith(records, { birthDate: "19800101", gender: "female", asOf: "2026-11-01T00:00:00Z" });
  const result = screen.getByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" });
  const urgent = within(result).getByRole("region", { name: "คำแนะนำเร่งด่วน" });
  const measurement = within(result).getByRole("article", { name: "น้ำตาลในเลือด" });
  expect(urgent.compareDocumentPosition(measurement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(measurement).toHaveClass("health-result-urgent"); expect(measurement).toHaveTextContent(card.label);
  expect(within(measurement).getByText("343 mg/dL", { exact: true })).toBeVisible();
  expect(within(measurement).getByRole("heading", { name: "ควรทำอย่างไรต่อ" })).toBeVisible();
  expect(result).toHaveTextContent("รอเจ้าหน้าที่ตรวจสอบ"); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("profile-only completion stays neutral without invented zeros, clinical cards or reference controls", () => {
  interpretHealthRecords.mockReturnValue({ hasMeasurements: false, cards: [], priority: null, note: "กรอกผลตรวจเพิ่มได้ในครั้งต่อไป", emergencyAdvice: "", sources: [source] });
  render(<HealthResultSummary records={[]} context="pending-review" />);
  const result = screen.getByRole("region", { name: "สรุปผลสุขภาพและคำแนะนำ" });
  expect(result).toHaveTextContent("ครั้งนี้ไม่ได้ระบุผลตรวจสุขภาพ"); expect(result).not.toHaveTextContent(/0|mg\/dL|mmHg/);
  expect(within(result).queryByRole("article")).not.toBeInTheDocument(); expect(within(result).queryByRole("link")).not.toBeInTheDocument();
});

test("references are expandable, deduplicated and restricted to HTTPS links without repeating measurements", () => {
  interpretHealthRecords.mockReturnValue({ hasMeasurements: true, cards: [{ ...card, level: "watch", label: "ควรติดตาม" }], priority: null,
    note: "ติดตามผลกับเจ้าหน้าที่", emergencyAdvice: "หากมีอาการรุนแรงให้ขอความช่วยเหลือ", sources: [source, { ...source, id: "duplicate" }, { id: "unsafe", title: "ลิงก์ผิดรูปแบบ", url: "javascript:alert(1)" }] });
  render(<HealthResultSummary records={[{ type: "sugar", value: { fbs: 343 } }]} />);
  expect(screen.getAllByText("343 mg/dL", { exact: true })).toHaveLength(1);
  expect(screen.getByRole("article")).toHaveClass("health-result-watch");
  const toggle = screen.getByText("แหล่งอ้างอิงและเกณฑ์แปลผล"); expect(toggle.closest("details")).not.toHaveAttribute("open");
  fireEvent.click(toggle); expect(toggle.closest("details")).toHaveAttribute("open");
  expect(screen.getAllByRole("link")).toHaveLength(1); expect(screen.getByRole("link")).toHaveAttribute("href", source.url);
  expect(screen.queryByText("ลิงก์ผิดรูปแบบ")).not.toBeInTheDocument();
});
