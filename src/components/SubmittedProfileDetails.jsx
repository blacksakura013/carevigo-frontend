import { formatThaiDate } from "../utils/thaiDate";

export default function SubmittedProfileDetails({ profile = {} }) {
  const genders = { male: "ชาย", female: "หญิง", other: "อื่น ๆ" };
  const smoking = { never: "ไม่เคยสูบบุหรี่", current: "สูบบุหรี่", former: "เคยสูบและเลิกแล้ว" };
  const entries = [
    ["ชื่อผู้รับบริการ", [profile.firstName, profile.lastName].filter(Boolean).join(" ")],
    ["เพศ", genders[profile.gender]],
    ["วันเกิด", profile.birthDate ? formatThaiDate(profile.birthDate) : null],
    ["เบอร์โทรศัพท์", profile.phone],
    ["การสูบบุหรี่", smoking[profile.smokingStatus]],
    ["เลิกสูบมาแล้ว", profile.smokingStatus === "former" && profile.smokingQuitMonths != null ? `${profile.smokingQuitMonths} เดือน` : null],
    ["โรคประจำตัวที่แจ้ง", profile.chronicDiseases?.length ? profile.chronicDiseases.join(", ") : profile.chronicDiseasesConfirmed ? "ไม่มีโรคประจำตัวที่แจ้ง" : null],
    ["รายละเอียดมะเร็ง", profile.cancerDetails],
  ].filter(([, value]) => value);
  return <dl className="form-review-values" aria-label="ข้อมูลผู้รับบริการที่ส่งครั้งนี้">
    {entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}
