import { getDashboardRecordModel } from "./dashboardRecord";

const context = { user: { birthDate: "19800101", gender: "female" }, createdAt: "2026-11-01T00:00:00Z" };
test("HbA1c-only sugar shows the supplied percentage instead of an invented FBS dash or value", () => {
  const result = getDashboardRecordModel({ ...context, type: "sugar", value: { hba1c: 6.5 } });
  expect(result.measurements).toEqual([{ label: "HbA1c", value: "6.5", unit: "%" }]);
  expect(result.level).toBe("high"); expect(result.nextAction).toMatch(/ตรวจยืนยัน/);
});
test("every supplied lipid and optional pulse is readable and the worst actual measurement sets severity", () => {
  const lipids = getDashboardRecordModel({ ...context, type: "cholesterol", value: { total: 180, ldl: 190, hdl: 55, triglyceride: 145 } });
  expect(lipids.measurements.map(item => item.value)).toEqual(["190", "180", "55", "145"]);
  expect(lipids.level).toBe("high"); expect(lipids.label).toBe("LDL สูงมาก");
  expect(lipids.nextAction).toMatch(/นัดพบแพทย์โดยเร็ว/);
  const bp = getDashboardRecordModel({ ...context, type: "blood_pressure", value: { systolic: 120, diastolic: 70, pulse: 110 } });
  expect(bp.measurements).toHaveLength(3); expect(bp.level).toBe("watch");
});
test("historical urgent results ask staff to verify current status rather than treating an old reading as current", () => {
  const row = { ...context, type: "sugar", value: { fbs: 343 }, createdAt: "2020-01-01T00:00:00Z", thaiCvRisk: { score: 1, status: "calculated" } };
  const result = getDashboardRecordModel(row);
  expect(result.level).toBe("urgent"); expect(result.nextAction).toMatch(/ผลตรวจล่าสุด.*หากค่านี้ยังเป็นปัจจุบัน/);
  expect(result.notes).toMatch(/ไม่ใช่การยืนยันอาการปัจจุบัน/); expect(result).not.toHaveProperty("score");
});
test("guest interpretation uses its submitted profile without borrowing missing or conflicting official demographics", () => {
  const row = { ...context, source: "guest", submittedProfile: { birthDate: "20160101" }, type: "sugar", value: { fbs: 95 } };
  expect(getDashboardRecordModel(row).level).toBe("neutral");
  const hdl = getDashboardRecordModel({ ...row, submittedProfile: {}, type: "cholesterol", value: { hdl: 45 } });
  expect(hdl.label).toBe("ต้องมีข้อมูลเพศเพื่อเลือกเกณฑ์");
});
test("legacy BMI-only rows preserve the number neutrally and never use BMI labels as a CV score", () => {
  const row = { ...context, type: "bmi", value: {}, bmi: 30.1, cvdRisk: { level: "risk_high" } };
  const result = getDashboardRecordModel(row);
  expect(result.measurements).toEqual([{ label: "BMI ที่บันทึก", value: "30.1", unit: "กก./ม²" }]);
  expect(result.level).toBe("neutral"); expect(result.label).toBe("มีเฉพาะค่า BMI เดิม");
  expect(result.nextAction).toMatch(/น้ำหนัก ส่วนสูง/);
});
test("a normal companion measurement cannot hide an incomplete or age-dependent interpretation", () => {
  const hdl = getDashboardRecordModel({ ...context, user: {}, type: "cholesterol", value: { total: 180, hdl: 45 } });
  expect(hdl.level).toBe("neutral"); expect(hdl.label).toMatch(/ข้อมูลเพศ/);
  const bp = getDashboardRecordModel({ ...context, type: "blood_pressure", value: { systolic: 120, pulse: 80 } });
  expect(bp.level).toBe("neutral"); expect(bp.label).toBe("ข้อมูลยังไม่ครบ");
});
test("missing records and unusable values remain neutral without fabricated zeros", () => {
  for (const row of [undefined, { type: "sugar", value: { fbs: null } }, { type: "bmi", bmi: null }, { type: "bmi", bmi: false }]) {
    const result = getDashboardRecordModel(row); expect(result.level).toBe("neutral"); expect(result.measurements).toEqual([]);
  }
});
