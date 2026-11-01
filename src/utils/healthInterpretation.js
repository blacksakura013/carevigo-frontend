import { gregorianDate, todayGregorian } from "./thaiDate";

// Screening guidance for the values supplied in this entry only. These are not
// diagnoses, treatment targets, or the separate ten-year Thai CV risk model.
const SOURCES = {
  thai: { id: "thai", title: "กรมควบคุมโรค: เกณฑ์คัดกรองความดัน น้ำตาล และ BMI", url: "https://ddc.moph.go.th/uploads/publish/1648820241210053223.pdf" },
  pressure: { id: "pressure", title: "กรมควบคุมโรค: สรุปเกณฑ์ความดันตามแนวทาง พ.ศ. 2567", url: "https://ddc.moph.go.th/uploads/publish/1643320241125083206.pdf" },
  pressureEmergency: { id: "pressureEmergency", title: "American Heart Association: เมื่อความดันสูงมาก", url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/when-to-call-911-for-high-blood-pressure" },
  lowPressure: { id: "lowPressure", title: "American Heart Association: ความดันต่ำ", url: "https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/low-blood-pressure-when-blood-pressure-is-too-low" },
  pulse: { id: "pulse", title: "American Heart Association: ชีพจรขณะพัก", url: "https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse" },
  sugar: { id: "sugar", title: "NIDDK: เกณฑ์ตรวจคัดกรองเบาหวาน", url: "https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis" },
  lowSugar: { id: "lowSugar", title: "CDC: การดูแลเมื่อน้ำตาลต่ำ", url: "https://www.cdc.gov/diabetes/treatment/treatment-low-blood-sugar-hypoglycemia.html" },
  highSugar: { id: "highSugar", title: "CDC: สัญญาณฉุกเฉินจากน้ำตาลสูง", url: "https://www.cdc.gov/diabetes/about/diabetic-ketoacidosis.html" },
  cholesterol: { id: "cholesterol", title: "MedlinePlus: เกณฑ์ไขมันในเลือด", url: "https://medlineplus.gov/cholesterollevelswhatyouneedtoknow.html" },
  ldl: { id: "ldl", title: "MedlinePlus: LDL cholesterol", url: "https://medlineplus.gov/ldlthebadcholesterol.html" },
  hdl: { id: "hdl", title: "NHLBI: เกณฑ์ HDL ตามเพศ", url: "https://www.nhlbi.nih.gov/health/metabolic-syndrome/diagnosis" },
  triglyceride: { id: "triglyceride", title: "MedlinePlus: ไตรกลีเซอไรด์", url: "https://medlineplus.gov/triglycerides.html" },
  pancreatitis: { id: "pancreatitis", title: "NHLBI: ไตรกลีเซอไรด์สูงและตับอ่อนอักเสบ", url: "https://www.nhlbi.nih.gov/health/high-blood-triglycerides" },
  pediatricTg: { id: "pediatricTg", title: "Pediatric Endocrine Society: ไตรกลีเซอไรด์สูงในเด็กและวัยรุ่น", url: "https://pedsendo.org/patient-resource/hypertriglyceridemia/" },
  bmi: { id: "bmi", title: "CDC: ข้อจำกัดของ BMI ในผู้ใหญ่และผู้มีอายุต่ำกว่า 20 ปี", url: "https://www.cdc.gov/bmi/adult-calculator/index.html" },
  emergency: { id: "emergency", title: "สถาบันการแพทย์ฉุกเฉินแห่งชาติ: อาการฉุกเฉินและสายด่วน 1669", url: "https://www.niems.go.th/th/Upload/File/255911291541026223_j7jJTq3otjIayXPw.pdf" },
};

const number = value => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const measurement = (label, value, unit) => ({ label, value: String(value), unit });
const EMERGENCY = "หากมีเจ็บหน้าอก หายใจลำบาก หน้าเบี้ยว แขนขาอ่อนแรงข้างเดียว หรือพูดไม่ชัด ให้โทร 1669 ทันที แม้ค่าที่บันทึกจะไม่สูง";
const CONFIRM_SUGAR = "นัดพบแพทย์เพื่อตรวจยืนยันและวางแผนดูแล ผลครั้งเดียวไม่ใช้วินิจฉัยเบาหวานด้วยตนเอง";
const NO_MED_CHANGE = "อย่าเพิ่ม ลด หรือหยุดยาเอง ให้ปรึกษาบุคลากรทางการแพทย์";

function ageAt(birthDate, asOf) {
  const birth = gregorianDate(birthDate);
  const direct = gregorianDate(asOf);
  const date = asOf === undefined ? new Date() : new Date(asOf);
  const today = direct || (Number.isFinite(date.getTime()) ? todayGregorian(date) : "");
  if (!birth || !today || birth > today) return null;
  return Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0);
}
function normalizedGender(gender) {
  const text = typeof gender === "string" ? gender.trim().toLowerCase() : "";
  return ["male", "ชาย"].includes(text) ? "male" : ["female", "หญิง"].includes(text) ? "female" : null;
}

export function interpretHealthRecords(records, { birthDate, gender, asOf } = {}) {
  const cards = [];
  const age = ageAt(birthDate, asOf);
  const sex = normalizedGender(gender);
  const child = age !== null && age < 18;
  const young = age !== null && age < 20;
  const add = (type, title, measurements, level, label, explanation, actions, reference, sourceKeys, minimumAge = 18, preserveSafety = false) => {
    if (!measurements.length) return;
    const outsideAdultRange = age !== null && age < minimumAge && level !== "urgent" && !preserveSafety;
    cards.push({ id: `${type}-${cards.length}`, type, title, measurements,
      level: outsideAdultRange ? "neutral" : level,
      label: outsideAdultRange ? "ต้องใช้เกณฑ์ตามอายุ" : label,
      explanation: outsideAdultRange ? "แสดงค่าที่บันทึกไว้ โดยไม่ใช้เกณฑ์ผู้ใหญ่มาสรุปผลในผู้มีอายุน้อยกว่าเกณฑ์" : explanation,
      actions: outsideAdultRange ? ["นำผลให้บุคลากรทางการแพทย์ประเมินด้วยเกณฑ์ตามอายุและบริบทของผู้รับบริการ"] : actions,
      reference: outsideAdultRange ? `เกณฑ์ด้านล่างนี้ใช้สำหรับอายุ ${minimumAge} ปีขึ้นไป` : reference,
      sourceKeys,
    });
  };

  (Array.isArray(records) ? records : []).forEach(record => {
    if (!record || typeof record.value !== "object" || !record.value || Array.isArray(record.value)) return;
    const v = record.value;
    if (record.type === "blood_pressure") {
      const sys = number(v.systolic), dia = number(v.diastolic), pulse = number(v.pulse);
      const values = [sys !== null && measurement("ความดันตัวบน", sys, "mmHg"), dia !== null && measurement("ความดันตัวล่าง", dia, "mmHg")].filter(Boolean);
      const reference = "เกณฑ์คัดกรองผู้ใหญ่: ตั้งแต่ 130/80 ควรติดตาม · ตั้งแต่ 140 หรือ 90 ควรพบแพทย์ · ตั้งแต่ 180 หรือ 110 ต้องประเมินเร่งด่วน";
      if (sys >= 180 || dia >= 110) {
        add(record.type, "ความดันโลหิต", values, "urgent", "ความดันสูงมาก", "มีค่าถึงเกณฑ์ความดันสูงรุนแรง ควรได้รับการประเมินเร่งด่วน ไม่ต้องรอเจ้าหน้าที่อนุมัติรายการ",
          ["หากไม่มีอาการฉุกเฉิน ให้นั่งพักแล้ววัดซ้ำหลังอย่างน้อย 1 นาที และติดต่อสถานพยาบาลทันทีหากยังสูง", "หากเจ็บหน้าอก หายใจลำบาก แขนขาอ่อนแรง หรือพูดไม่ชัด ให้โทร 1669 ทันที ไม่ต้องรอวัดซ้ำ", NO_MED_CHANGE], reference, ["pressure", "pressureEmergency"]);
      } else if (sys === null || dia === null) {
        add(record.type, "ความดันโลหิต", values, "neutral", "ข้อมูลยังไม่ครบ", "ต้องมีทั้งความดันตัวบนและตัวล่างจึงจะสรุปผลคู่นี้ได้", ["ตรวจสอบและบันทึกค่าตัวบนกับตัวล่างจากการวัดครั้งเดียวกัน"], reference, ["pressure"]);
      } else if (sys >= 140 || dia >= 90) {
        add(record.type, "ความดันโลหิต", values, "high", "ความดันสูง ควรพบแพทย์", "มีค่าตัวบนหรือตัวล่างสูงกว่าเกณฑ์คัดกรอง การวัดครั้งเดียวยังไม่ยืนยันโรคความดันโลหิตสูง",
          ["พักเงียบ ๆ อย่างน้อย 5 นาที นั่งพิงพนัก เท้าวางราบ แล้ววัดซ้ำและจดผล", "นัดพบแพทย์พร้อมบันทึกค่าความดัน โดยเฉพาะหากวัดซ้ำแล้วยังสูง", "ลดอาหารเค็มและอาหารแปรรูป และติดตามความดันสม่ำเสมอ", NO_MED_CHANGE], reference, ["pressure"]);
      } else if (sys < 90 || dia < 60) {
        add(record.type, "ความดันโลหิต", values, "watch", "ความดันต่ำ ควรติดตามอาการ", "ค่าต่ำกว่า 90 หรือ 60 ต้องพิจารณาร่วมกับอาการและค่าปกติของแต่ละคน",
          ["นั่งพักและวัดซ้ำ หากหน้ามืดหรืออ่อนเพลียต่อเนื่องให้ติดต่อบุคลากรทางการแพทย์", "หากหมดสติ เจ็บหน้าอก หรือหายใจลำบาก ให้โทร 1669 ทันที"], "เกณฑ์อ้างอิงความดันต่ำ: ต่ำกว่า 90/60 mmHg", ["lowPressure"]);
      } else if (sys >= 130 || dia >= 80) {
        add(record.type, "ความดันโลหิต", values, "watch", "ความดันเริ่มสูง ควรติดตาม", "อยู่ในช่วงเสี่ยง ควรติดตามการวัดซ้ำและดูแลพฤติกรรม",
          ["พักให้เพียงพอ ลดอาหารเค็ม และจดค่าความดันจากการวัดอย่างถูกวิธี", "นำบันทึกให้เจ้าหน้าที่ประเมินหากยังสูงต่อเนื่อง"], reference, ["pressure"]);
      } else {
        add(record.type, "ความดันโลหิต", values, "normal", "อยู่ในช่วงเกณฑ์ทั่วไป", "ค่าความดันคู่นี้ยังไม่ถึงช่วงเสี่ยงตามเกณฑ์คัดกรองที่ใช้",
          ["ดูแลอาหารและติดตามความดันตามนัด โดยใช้เป้าหมายเฉพาะที่แพทย์กำหนดหากมีโรคประจำตัว"], reference, ["pressure"]);
      }
      if (pulse !== null) add(record.type, "ชีพจร", [measurement("ชีพจร", pulse, "ครั้ง/นาที")], pulse < 60 || pulse > 100 ? "watch" : "normal",
        pulse < 60 || pulse > 100 ? "นอกช่วงชีพจรขณะพัก" : "อยู่ในช่วงชีพจรขณะพัก", "เกณฑ์นี้ใช้เมื่อพักอยู่ ความเครียด การออกแรง ยา และความฟิตอาจทำให้ชีพจรเปลี่ยนได้",
        [pulse < 60 || pulse > 100 ? "นั่งพักแล้ววัดซ้ำ หากผิดปกติต่อเนื่องหรือใจสั่น หน้ามืด ให้พบแพทย์" : "ติดตามอาการและวัดซ้ำเมื่อพัก หากมีอาการผิดปกติให้พบแพทย์"], "ชีพจรขณะพักของผู้ใหญ่โดยทั่วไป: 60–100 ครั้ง/นาที", ["pulse"]);
    }
    if (record.type === "sugar") {
      const fbs = number(v.fbs), a1c = number(v.hba1c);
      if (fbs !== null) {
        const values = [measurement("น้ำตาลขณะอดอาหาร (FBS)", fbs, "mg/dL")];
        const reference = "FBS หลังอดอาหารอย่างน้อย 8 ชั่วโมง: 70–99 · 100–125 เริ่มสูง · ตั้งแต่ 126 ต้องตรวจยืนยัน (mg/dL)";
        if (fbs < 70) {
          const actions = child
            ? ["ขอความช่วยเหลือจากผู้ดูแลและบุคลากรทางการแพทย์ทันที ใช้แผนแก้น้ำตาลต่ำสำหรับเด็กที่ได้รับคำแนะนำไว้"]
            : ["หากรู้สึกตัวและกลืนได้ ให้รับคาร์โบไฮเดรตที่ดูดซึมเร็ว 15 กรัม เช่น น้ำหวานตามปริมาณน้ำตาลบนฉลาก", "ตรวจน้ำตาลซ้ำใน 15 นาที หากยังต่ำกว่า 70 ให้ทำซ้ำ และขอความช่วยเหลือหากไม่ดีขึ้น"];
          if (fbs < 55) actions.unshift("น้ำตาลต่ำมาก ขอความช่วยเหลือจากคนใกล้ตัวและบุคลากรทางการแพทย์ทันที");
          actions.push("หากซึม หมดสติ ชัก หรือกลืนไม่ได้ ห้ามป้อนอาหารหรือน้ำ ให้โทร 1669 ทันที", NO_MED_CHANGE);
          add(record.type, "น้ำตาลขณะอดอาหาร (FBS)", values, "urgent", fbs < 55 ? "น้ำตาลต่ำมาก ต้องช่วยเหลือทันที" : "น้ำตาลต่ำ ต้องแก้ไขทันที", "น้ำตาลต่ำต้องดูแลทันทีตามอาการ ไม่ต้องรอการตรวจสอบรายการ", actions, reference, ["lowSugar", "sugar"]);
        } else if (fbs >= 300) {
          add(record.type, "น้ำตาลขณะอดอาหาร (FBS)", values, "urgent", "น้ำตาลสูงมาก ควรประเมินวันนี้", "ค่าน้ำตาลครั้งนี้สูงมาก ควรได้รับคำแนะนำจากสถานพยาบาลวันนี้ แม้คะแนน CVD risk จะต่ำ",
            ["ติดต่อสถานพยาบาลวันนี้เพื่อประเมินอาการและแนวทางตรวจซ้ำ ไม่ต้องรออนุมัติรายการ", "หากตรวจซ้ำแล้วยังตั้งแต่ 300 mg/dL หรือมีอาเจียนจนดื่มไม่ได้ หายใจลำบาก ซึม หรือสับสน ให้ไปห้องฉุกเฉินทันที", "หากรู้สึกตัวและกลืนได้ให้จิบน้ำเปล่าตามข้อจำกัดน้ำที่แพทย์กำหนด งดเครื่องดื่มหวาน", NO_MED_CHANGE], reference, ["sugar", "highSugar"]);
        } else if (fbs >= 126) {
          add(record.type, "น้ำตาลขณะอดอาหาร (FBS)", values, "high", "สูงถึงช่วงที่ต้องตรวจยืนยัน", "ผลอยู่ในช่วงคัดกรองที่อาจพบเบาหวาน ต้องประเมินร่วมกับอาการและผลยืนยัน",
            [CONFIRM_SUGAR, "ลดเครื่องดื่มหวานและควบคุมปริมาณแป้ง นำผลตรวจและรายการยาไปพบแพทย์", NO_MED_CHANGE], reference, ["sugar"]);
        } else if (fbs >= 100) {
          add(record.type, "น้ำตาลขณะอดอาหาร (FBS)", values, "watch", "น้ำตาลเริ่มสูง ควรติดตาม", "สูงกว่าช่วงคัดกรองทั่วไป แต่ยังไม่ใช้วินิจฉัยโรคจากผลครั้งเดียว",
            ["ลดเครื่องดื่มหวาน ควบคุมปริมาณแป้ง และนัดตรวจติดตามหรือ HbA1c ตามคำแนะนำ", "แจ้งเจ้าหน้าที่หากผลนี้ไม่ได้อดอาหารครบ 8 ชั่วโมง เพื่อเลือกเกณฑ์แปลผลที่เหมาะสม"], reference, ["sugar"]);
        } else add(record.type, "น้ำตาลขณะอดอาหาร (FBS)", values, "normal", "อยู่ในช่วงเกณฑ์ทั่วไป", "อยู่ในช่วงอ้างอิงเมื่ออดอาหารครบอย่างน้อย 8 ชั่วโมง ผลนี้ไม่ตัดโรคจากอาการหรือผลตรวจอื่น",
          ["ดูแลอาหารและตรวจติดตามตามนัด หากไม่ได้อดอาหารให้แจ้งเจ้าหน้าที่"], reference, ["sugar"]);
      }
      if (a1c !== null) add(record.type, "น้ำตาลสะสม (HbA1c)", [measurement("HbA1c", a1c, "%")], a1c >= 6.5 ? "high" : a1c >= 5.7 ? "watch" : "normal",
        a1c >= 6.5 ? "สูงถึงช่วงที่ต้องตรวจยืนยัน" : a1c >= 5.7 ? "น้ำตาลสะสมเริ่มสูง" : "ต่ำกว่าเกณฑ์คัดกรองน้ำตาลสูง",
        "สะท้อนระดับน้ำตาลเฉลี่ยในช่วงประมาณ 3 เดือน ต้องพิจารณาร่วมกับโรคประจำตัวและผลตรวจอื่น",
        a1c >= 6.5 ? [CONFIRM_SUGAR, NO_MED_CHANGE] : [a1c >= 5.7 ? "ดูแลอาหาร ลดเครื่องดื่มหวาน และนัดตรวจติดตามกับเจ้าหน้าที่" : "รักษาพฤติกรรมสุขภาพและติดตามตามนัด"], "เกณฑ์คัดกรอง: ต่ำกว่า 5.7% · 5.7–6.4% เริ่มสูง · ตั้งแต่ 6.5% ต้องตรวจยืนยัน", ["sugar"]);
    }
    if (record.type === "cholesterol") {
      const total = number(v.total), ldl = number(v.ldl), hdl = number(v.hdl), tg = number(v.triglyceride);
      const lifestyle = "ลดไขมันอิ่มตัวและอาหารทอด เลือกผัก ธัญพืช และปลา พร้อมนำผลไปประเมินตามนัด";
      if (total !== null) add(record.type, "ไขมันรวม (Total cholesterol)", [measurement("ไขมันรวม", total, "mg/dL")], total >= 240 ? "high" : total >= 200 ? "watch" : "normal", total >= 240 ? "ไขมันรวมสูง" : total >= 200 ? "ไขมันรวมเริ่มสูง" : "อยู่ในช่วงเกณฑ์ทั่วไป",
        "ไขมันรวมต้องพิจารณาร่วมกับ LDL, HDL และความเสี่ยงส่วนบุคคล", [lifestyle, ...(total >= 240 ? ["นัดพบแพทย์เพื่อประเมินสาเหตุและแผนดูแล ไม่เริ่มยาลดไขมันเอง"] : [])], "เกณฑ์ทั่วไปอายุ 20 ปีขึ้นไป: ต่ำกว่า 200 · 200–239 เริ่มสูง · ตั้งแต่ 240 สูง (mg/dL)", ["cholesterol"], 20);
      if (ldl !== null) add(record.type, "LDL cholesterol", [measurement("LDL", ldl, "mg/dL")], ldl >= 160 ? "high" : ldl >= 100 ? "watch" : "normal", ldl >= 190 ? "LDL สูงมาก" : ldl >= 160 ? "LDL สูง" : ldl >= 100 ? "ควรทบทวนเป้าหมาย LDL" : "ต่ำกว่าเกณฑ์ทั่วไป",
        "เป้าหมาย LDL ต่างกันตามโรคและความเสี่ยง ผู้มีเบาหวาน โรคหัวใจ หรือหลอดเลือดสมองอาจต้องมีเป้าหมายต่ำกว่านี้", [lifestyle, ...(ldl >= 160 ? [ldl >= 190 ? "ควรนัดพบแพทย์โดยเร็วเพื่อประเมิน LDL ที่สูงมากและสาเหตุที่เกี่ยวข้อง" : "นัดพบแพทย์เพื่อกำหนดเป้าหมาย LDL และวางแผนดูแล"] : ["สอบถามเป้าหมาย LDL ของตนเองจากแพทย์ โดยเฉพาะผู้มีโรคประจำตัว"])], "เกณฑ์ทั่วไปอายุ 20 ปีขึ้นไป: LDL ต่ำกว่า 100 mg/dL · ตั้งแต่ 190 สูงมาก", ["ldl"], 20);
      if (hdl !== null) {
        const uncertain = sex === null && hdl >= 40 && hdl < 50;
        const low = hdl < (sex === "female" ? 50 : 40);
        add(record.type, "HDL cholesterol", [measurement("HDL", hdl, "mg/dL")], uncertain ? "neutral" : low ? "watch" : "normal", uncertain ? "ต้องมีข้อมูลเพศเพื่อเลือกเกณฑ์" : low ? "HDL ต่ำกว่าเกณฑ์" : "HDL ไม่ต่ำตามเกณฑ์ทั่วไป",
          "HDL ใช้เกณฑ์ต่างกันตามเพศ และค่านี้เพียงค่าเดียวไม่ยืนยันว่าปลอดภัยจากโรคหัวใจ",
          [uncertain ? "ระบุเพศสำหรับการประเมิน หรือให้เจ้าหน้าที่เลือกเกณฑ์ที่เหมาะสม" : low ? "งดสูบบุหรี่ และปรึกษาเรื่องกิจกรรมทางกายที่เหมาะกับสุขภาพ" : "พิจารณาร่วมกับ LDL และปัจจัยเสี่ยงอื่น พร้อมติดตามตามนัด"], "HDL ต่ำ: ชายน้อยกว่า 40 · หญิงน้อยกว่า 50 mg/dL", ["hdl", "cholesterol"], 20);
      }
      if (tg !== null) add(record.type, "ไตรกลีเซอไรด์", [measurement("ไตรกลีเซอไรด์", tg, "mg/dL")], tg >= 200 ? "high" : tg >= 150 ? "watch" : "normal", tg >= 500 ? "ไตรกลีเซอไรด์สูงมาก" : tg >= 200 ? "ไตรกลีเซอไรด์สูง" : tg >= 150 ? "ไตรกลีเซอไรด์เริ่มสูง" : "อยู่ในช่วงเกณฑ์ทั่วไป",
        tg >= 500 ? "ค่าสูงมากเพิ่มความเสี่ยงตับอ่อนอักเสบ ควรได้รับการประเมินจากแพทย์" : "ควรพิจารณาร่วมกับมื้ออาหารก่อนตรวจ โรคประจำตัว และผลไขมันอื่น",
        tg >= 500 ? ["ติดต่อสถานพยาบาลโดยเร็วเพื่อประเมินและวางแผนลดไตรกลีเซอไรด์", "หากปวดท้องรุนแรงหรืออาเจียนร่วมด้วย ให้ไปห้องฉุกเฉินทันที", "งดแอลกอฮอล์และเครื่องดื่มหวาน ไม่เริ่มหรือปรับยาเอง"] : ["ลดเครื่องดื่มหวาน ควบคุมแป้งและแอลกอฮอล์ และตรวจติดตามตามคำแนะนำ"], young && tg >= 500 ? "ในเด็กและวัยรุ่น ค่าที่สูงมากหรือสูงต่อเนื่องต้องประเมินความเสี่ยงตับอ่อนอักเสบ ไม่ใช้ช่วงปกติของผู้ใหญ่ตัดสิน" : "เกณฑ์ทั่วไปอายุ 20 ปีขึ้นไป: ต่ำกว่า 150 · 150–199 เริ่มสูง · 200–499 สูง · ตั้งแต่ 500 สูงมาก (mg/dL)", ["triglyceride", ...(tg >= 500 ? ["pancreatitis", ...(young ? ["pediatricTg"] : [])] : [])], 20, tg >= 500);
    }
    if (record.type === "bmi") {
      const weight = number(v.weight), height = number(v.height);
      const values = [weight !== null && measurement("น้ำหนัก", weight, "กก."), height !== null && measurement("ส่วนสูง", height, "ซม.")].filter(Boolean);
      const bmi = weight !== null && height !== null ? weight / ((height / 100) ** 2) : null;
      if (bmi === null || !Number.isFinite(bmi)) {
        add(record.type, "ดัชนีมวลกาย (BMI)", values, "neutral", "ข้อมูลยังไม่ครบ", "ต้องมีน้ำหนักและส่วนสูงจึงคำนวณ BMI ได้", ["ตรวจสอบน้ำหนักเป็นกิโลกรัมและส่วนสูงเป็นเซนติเมตร"], "BMI = น้ำหนัก (กก.) ÷ ส่วนสูง (เมตร)²", ["thai", "bmi"], 20);
      } else {
        // Classify before rounding. Near a boundary show extra decimals so a
        // normal 22.995 is not presented as an overweight 23.00.
        const rounded = Number(bmi.toFixed(2));
        const crossesBoundary = [18.5, 23, 25, 30].some(limit => bmi < limit && rounded >= limit);
        const display = crossesBoundary ? bmi.toFixed(4) : bmi.toFixed(2);
        values.push(measurement("BMI", display, "กก./ม²"));
        const low = bmi < 18.5, normal = bmi >= 18.5 && bmi < 23;
        add(record.type, "ดัชนีมวลกาย (BMI)", values, normal ? "normal" : low || bmi < 25 ? "watch" : "high", low ? "น้ำหนักต่ำกว่าเกณฑ์" : normal ? "BMI อยู่ในช่วงเกณฑ์ทั่วไป" : bmi < 25 ? "น้ำหนักเกินเกณฑ์" : bmi < 30 ? "BMI อยู่ในช่วงอ้วน" : "BMI อยู่ในช่วงอ้วนมาก",
          "BMI เป็นการคัดกรองสัดส่วนน้ำหนักต่อส่วนสูง ไม่ใช่เปอร์เซ็นต์ความเสี่ยงโรคหัวใจ และไม่เหมาะใช้สรุปผลในหญิงตั้งครรภ์",
          [low ? "รับประทานอาหารให้ครบมื้อและปรึกษาเจ้าหน้าที่หากน้ำหนักลดโดยไม่ตั้งใจ" : normal ? "รักษาอาหารที่สมดุลและติดตามน้ำหนักตามนัด" : "ปรึกษาเรื่องอาหารและกิจกรรมทางกายที่เหมาะกับโรคประจำตัว ตั้งเป้าปรับน้ำหนักร่วมกับเจ้าหน้าที่"], "เกณฑ์ผู้ใหญ่ไทย: ต่ำกว่า 18.5 ผอม · 18.5 ถึงน้อยกว่า 23 ปกติ · 23 ถึงน้อยกว่า 25 น้ำหนักเกิน · ตั้งแต่ 25 อ้วน", ["thai", "bmi"], 20);
      }
    }
  });

  const ranks = { urgent: 0, high: 1, watch: 2, normal: 3, neutral: 4 };
  cards.sort((a, b) => ranks[a.level] - ranks[b.level]);
  const urgent = cards.find(card => card.level === "urgent");
  const sourceKeys = new Set(cards.flatMap(card => card.sourceKeys));
  if (cards.length) sourceKeys.add("emergency");
  return {
    cards,
    hasMeasurements: cards.length > 0,
    priority: urgent ? { title: "มีค่าที่ควรดูแลเร่งด่วน", description: `${urgent.actions[0]} ไม่ต้องรอเจ้าหน้าที่ตรวจสอบหรือรอถึงสิ้นวัน อ่านวิธีดูแลของทุกรายการสีแดงด้านล่าง` } : null,
    note: cards.length ? `เป็นการคัดกรองจากข้อมูลครั้งนี้ ไม่ใช่การวินิจฉัยโรค${age === null ? " · หากไม่ได้ระบุวันเกิด จะแสดงเกณฑ์ผู้ใหญ่ทั่วไป" : young ? " · ผู้มีอายุต่ำกว่าเกณฑ์ต้องใช้การประเมินตามอายุ" : ""} เป้าหมายของผู้มีโรคประจำตัวหรือหญิงตั้งครรภ์อาจแตกต่างกัน ไม่ปรับยาเอง` : "บันทึกเฉพาะข้อมูลที่คุณส่งครั้งนี้ หากมีผลตรวจภายหลังสามารถทำรายการใหม่ได้",
    emergencyAdvice: cards.length ? EMERGENCY : "",
    sources: Array.from(sourceKeys, key => SOURCES[key]).filter(Boolean),
  };
}
