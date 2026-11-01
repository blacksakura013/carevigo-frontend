import { interpretHealthRecords } from "./healthInterpretation";

const validNumber = value => (typeof value === "number" || (typeof value === "string" && value.trim())) && Number.isFinite(Number(value)) && Number(value) > 0;

// Rows describe the supplied historical record, not a current clinical state.
// Never borrow another measurement, a cached BMI risk, or a user's CV score.
export function getDashboardRecordModel(record) {
  const profile = record?.source === "guest" ? record.submittedProfile || {} : record?.user || {};
  const result = interpretHealthRecords(record ? [record] : [], {
    birthDate: profile.birthDate,
    gender: profile.gender,
    asOf: record?.submittedAt || record?.createdAt,
  });
  const card = result.cards.find(item => !["normal", "neutral"].includes(item.level))
    || result.cards.find(item => item.level === "neutral") || result.cards[0];
  if (!card) {
    const legacyBmi = record?.type === "bmi" && validNumber(record.bmi);
    return {
      measurements: legacyBmi ? [{ label: "BMI ที่บันทึก", value: String(record.bmi), unit: "กก./ม²" }] : [],
      level: "neutral",
      label: legacyBmi ? "มีเฉพาะค่า BMI เดิม" : "ยังแปลผลไม่ได้",
      nextAction: legacyBmi ? "เปิดรายละเอียดเพื่อตรวจสอบน้ำหนัก ส่วนสูง และบริบทของผลเดิม" : "เปิดรายละเอียดเพื่อตรวจสอบค่าที่บันทึก",
      explanation: "ข้อมูลสำหรับการแปลผลครั้งนี้ไม่ครบ จึงไม่สรุปว่าอยู่ในเกณฑ์ปกติ",
      notes: "แสดงเฉพาะข้อมูลที่มีในรายการนี้",
      details: [],
      sources: [],
    };
  }
  const followUp = card.actions.find(action => /นัดพบแพทย์|ติดต่อสถานพยาบาล|พบแพทย์|บุคลากรทางการแพทย์/.test(action)) || card.actions[0];
  return {
    measurements: result.cards.flatMap(item => item.measurements),
    level: card.level,
    label: card.label,
    nextAction: card.level === "urgent"
      ? "ตรวจสอบอาการและผลตรวจล่าสุดของสมาชิก หากค่านี้ยังเป็นปัจจุบันให้ดำเนินการตามคำแนะนำเร่งด่วน"
      : followUp || "นำผลให้เจ้าหน้าที่ประเมินร่วมกับประวัติสุขภาพ",
    explanation: card.explanation,
    notes: "แปลผลจากค่าตามวันที่บันทึก ไม่ใช่การยืนยันอาการปัจจุบัน",
    details: result.cards,
    sources: result.sources,
  };
}
