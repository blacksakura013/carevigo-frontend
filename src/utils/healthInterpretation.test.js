import { interpretHealthRecords } from "./healthInterpretation";

const adult = { birthDate: "19800101", gender: "female", asOf: "2026-11-01T00:00:00Z" };
const interpret = (type, value, options = adult) => interpretHealthRecords([{ type, value }], options);
const first = (type, value, options) => interpret(type, value, options).cards[0];

test("the reported 137/92 and FBS343 prioritize acute glucose advice independently of ten-year CV risk", () => {
  const records = [{ type: "blood_pressure", value: { systolic: 137, diastolic: 92 } }, { type: "sugar", value: { fbs: 343 } }];
  const result = interpretHealthRecords(records, adult);
  expect(result.cards.map(card => [card.type, card.level])).toEqual([["sugar", "urgent"], ["blood_pressure", "high"]]);
  expect(result.priority.title).toBe("มีค่าที่ควรดูแลเร่งด่วน");
  expect(result.priority.description).toMatch(/ไม่ต้องรอเจ้าหน้าที่/);
  expect(result.priority.description).toMatch(/ติดต่อสถานพยาบาลวันนี้/);
  expect(result.cards[0].actions.join(" ")).toMatch(/วันนี้.*ตรวจซ้ำแล้วยังตั้งแต่ 300.*ฉุกเฉิน/);
  expect(result.cards[0].actions.join(" ")).not.toMatch(/ออกกำลังกาย/);
  expect(result).not.toHaveProperty("score"); expect(result).not.toHaveProperty("cvdRisk");
  expect(result.cards[1].explanation).toMatch(/ยังไม่ยืนยันโรค/);
});

test.each([
  [119, 79, "normal"], [129, 79, "normal"], [130, 79, "watch"], [129, 80, "watch"],
  [139, 89, "watch"], [140, 89, "high"], [137, 90, "high"], [179, 109, "high"],
  [180, 70, "urgent"], [120, 110, "urgent"], [89, 59, "watch"], [90, 60, "normal"],
])("Thai2024 adult BP %s/%s is %s; either pressure can determine severity", (systolic, diastolic, level) => {
  expect(first("blood_pressure", { systolic, diastolic }).level).toBe(level);
});

test("one extreme BP value still warns, while an incomplete non-extreme pair stays neutral", () => {
  expect(first("blood_pressure", { systolic: 180 }).level).toBe("urgent");
  expect(first("blood_pressure", { diastolic: 110 }).level).toBe("urgent");
  expect(first("blood_pressure", { systolic: 120 }).level).toBe("neutral");
  const card = first("blood_pressure", { systolic: 180, diastolic: 110 });
  expect(card.actions.join(" ")).toMatch(/ไม่มีอาการฉุกเฉิน.*อย่างน้อย 1 นาที/);
  expect(card.actions.join(" ")).toMatch(/1669 ทันที ไม่ต้องรอวัดซ้ำ/);
});

test.each([[59, "watch"], [60, "normal"], [100, "normal"], [101, "watch"]])("resting pulse %s has %s guidance without inventing an emergency threshold", (pulse, level) => {
  const result = interpret("blood_pressure", { pulse });
  expect(result.cards).toHaveLength(1); expect(result.cards[0].title).toBe("ชีพจร");
  expect(result.cards[0].level).toBe(level); expect(result.priority).toBeNull();
});

test.each([[54, "urgent"], [55, "urgent"], [69.9, "urgent"], [70, "normal"], [99.9, "normal"], [100, "watch"], [125.9, "watch"], [126, "high"], [299, "high"], [300, "urgent"]])("FBS %s has %s guidance at screening and safety boundaries", (fbs, level) => {
  const card = first("sugar", { fbs }); expect(card.level).toBe(level);
  expect(card.reference).toMatch(/อดอาหารอย่างน้อย 8 ชั่วโมง/);
});

test("low glucose explains safe swallowing,15-15 recheck and no oral feeding when unsafe", () => {
  const actions = first("sugar", { fbs: 54 }).actions.join(" ");
  expect(actions).toMatch(/ขอความช่วยเหลือ/); expect(actions).toMatch(/รู้สึกตัวและกลืนได้.*15 กรัม/);
  expect(actions).toMatch(/15 นาที.*ต่ำกว่า 70/); expect(actions).toMatch(/กลืนไม่ได้ ห้ามป้อนอาหารหรือน้ำ.*1669/);
  const childActions = first("sugar", { fbs: 60 }, { birthDate: "20200101", asOf: adult.asOf }).actions.join(" ");
  expect(childActions).toMatch(/สำหรับเด็ก/); expect(childActions).not.toMatch(/15 กรัม/);
});

test.each([[5.69, "normal"], [5.7, "watch"], [6.49, "watch"], [6.5, "high"]])("HbA1c %s is %s and never treated as an acute glucose reading", (hba1c, level) => {
  const result = interpret("sugar", { hba1c }); expect(result.cards[0].level).toBe(level); expect(result.priority).toBeNull();
  if (level === "high") expect(result.cards[0].actions.join(" ")).toMatch(/ตรวจยืนยัน/);
});

test.each([["total", 199.9, "normal"], ["total", 200, "watch"], ["total", 240, "high"], ["ldl", 99.9, "normal"], ["ldl", 100, "watch"], ["ldl", 159.9, "watch"], ["ldl", 160, "high"], ["ldl", 190, "high"], ["triglyceride", 149.9, "normal"], ["triglyceride", 150, "watch"], ["triglyceride", 200, "high"], ["triglyceride", 500, "high"]])("%s %s is %s under its own lipid reference", (key, value, level) => {
  expect(first("cholesterol", { [key]: value }).level).toBe(level);
});

test("very high TG calls for prompt assessment, with ER only conditional on symptoms", () => {
  const result = interpret("cholesterol", { triglyceride: 500 });
  expect(result.priority).toBeNull();
  expect(result.cards[0].actions.join(" ")).toMatch(/โดยเร็ว.*หากปวดท้องรุนแรงหรืออาเจียน/);
  expect(first("cholesterol", { ldl: 190 }).actions.join(" ")).toMatch(/นัดพบแพทย์โดยเร็ว/);
  expect(first("cholesterol", { ldl: 90 }).explanation).toMatch(/เป้าหมายต่ำกว่านี้/);
});

test.each([["male", 40, "normal"], ["female", 40, "watch"], ["หญิง", 49.9, "watch"], ["หญิง", 50, "normal"], ["ชาย", 39.9, "watch"], [undefined, 45, "neutral"], [undefined, 39, "watch"], [undefined, 50, "normal"]])("HDL uses sex %s and value%s appropriately", (gender, hdl, level) => {
  const card = first("cholesterol", { hdl }, { ...adult, gender }); expect(card.level).toBe(level);
  expect(card.explanation).toMatch(/เพียงค่าเดียวไม่ยืนยันว่าปลอดภัย/);
});

test.each([[18.49, "watch"], [18.5, "normal"], [22.995, "normal"], [23, "watch"], [24.99, "watch"], [25, "high"], [29.99, "high"], [30, "high"]])("Thai adult BMI %s is %s before rounding", (bmi, level) => {
  const card = first("bmi", { weight: bmi * 4, height: 200, cvdRisk: "high" });
  expect(card.level).toBe(level); expect(card.explanation).toMatch(/ไม่ใช่เปอร์เซ็นต์ความเสี่ยงโรคหัวใจ/);
  if (bmi === 22.995) expect(card.measurements.find(item => item.label === "BMI").value).toBe("22.9950");
});

test("BMI computes only from both supplied metric measurements, ignoring any legacy risk or derived BMI", () => {
  expect(first("bmi", { weight: 60 }).level).toBe("neutral");
  expect(first("bmi", { weight: 60, height: 165, bmi: 99, cvdRisk: "high" }).measurements.find(item => item.label === "BMI").value).toBe("22.04");
});

test("known young patients retain measured values without adult reassurance; extreme acute values still warn", () => {
  const options = { birthDate: "20160101", asOf: adult.asOf };
  const result = interpretHealthRecords([
    { type: "blood_pressure", value: { systolic: 120, diastolic: 70, pulse: 90 } },
    { type: "sugar", value: { fbs: 95, hba1c: 5.5 } },
    { type: "cholesterol", value: { total: 170 } },
    { type: "bmi", value: { weight: 40, height: 150 } },
  ], options);
  expect(result.cards).toHaveLength(6); expect(result.cards.every(card => card.level === "neutral")).toBe(true);
  expect(result.cards.every(card => card.label === "ต้องใช้เกณฑ์ตามอายุ")).toBe(true);
  expect(first("blood_pressure", { systolic: 180, diastolic: 100 }, options).level).toBe("urgent");
  expect(first("sugar", { fbs: 343 }, options).level).toBe("urgent");
});

test("adult lipid/BMI eligibility changes on the twentieth Thai-calendar birthday, not UTC day", () => {
  const record = { type: "bmi", value: { weight: 60, height: 165 } };
  expect(interpretHealthRecords([record], { birthDate: "20061102", asOf: "2026-11-01T16:59:59Z" }).cards[0].level).toBe("neutral");
  expect(interpretHealthRecords([record], { birthDate: "20061102", asOf: "2026-11-01T17:00:00Z" }).cards[0].level).toBe("normal");
  expect(first("sugar", { fbs: 95 }, { birthDate: "20081101", asOf: "2026-11-01" }).level).toBe("normal");
});

test("young patients retain severe-TG safety actions without using adult normal lipid bands", () => {
  const result = interpret("cholesterol", { triglyceride: 1000 }, { birthDate: "20090101", asOf: adult.asOf });
  const card = result.cards[0];
  expect(card.level).toBe("high"); expect(card.reference).not.toMatch(/เกณฑ์ทั่วไปอายุ 20/);
  expect(card.actions.join(" ")).toMatch(/โดยเร็ว.*หากปวดท้องรุนแรงหรืออาเจียน.*ฉุกเฉิน/);
  expect(result.sources.some(source => source.id === "pediatricTg")).toBe(true);
});

test.each([null, undefined, "", " ", NaN, Infinity, -Infinity, false, true, [], {}, 0, -1, "abc"])("missing/malformed supplied value %p never becomes a reassuring zero", value => {
  const result = interpret("sugar", { fbs: value });
  expect(result.cards).toEqual([]); expect(result.hasMeasurements).toBe(false); expect(result.priority).toBeNull(); expect(result.sources).toEqual([]);
});

test("only current, known, supplied fields become cards; input is not mutated or enriched from any history", () => {
  const records = [{ type: "sugar", value: { fbs: " 95 ", historicalHba1c: 9 } }, { type: "unknown", value: { total: 999 } }, null];
  const before = JSON.stringify(records); const result = interpretHealthRecords(records, adult);
  expect(result.cards).toHaveLength(1); expect(result.cards[0].measurements).toEqual([{ label: "น้ำตาลขณะอดอาหาร (FBS)", value: "95", unit: "mg/dL" }]);
  expect(JSON.stringify(records)).toBe(before); expect(result.sources.every(source => /^https:\/\//.test(source.url))).toBe(true);
  expect(new Set(result.sources.map(source => source.id)).size).toBe(result.sources.length);
  expect(result.note).toMatch(/ไม่ใช่การวินิจฉัยโรค/); expect(result.emergencyAdvice).toMatch(/แม้ค่าที่บันทึกจะไม่สูง/);
  expect(interpretHealthRecords(undefined).hasMeasurements).toBe(false);
});

test("unknown or invalid age is explicit, rather than inventing an age or a pediatric normal result", () => {
  for (const birthDate of [undefined, "invalid", "20990101"]) {
    const result = interpret("sugar", { fbs: 95 }, { birthDate, asOf: adult.asOf });
    expect(result.note).toMatch(/แสดงเกณฑ์ผู้ใหญ่ทั่วไป/);
  }
});
