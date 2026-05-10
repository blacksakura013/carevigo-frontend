import React, {
  useState,
  useEffect,
} from "react";

import {
  useParams,
  useNavigate,
} from "react-router-dom";

import Swal from "sweetalert2";

import {
  Heart,
  Activity,
  Droplets,
  Weight,
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
} from "lucide-react";

import { addHealth } from "../api/api";

export default function AddHealth() {

  const { citizenId } =
    useParams();

  const navigate =
    useNavigate();

  useEffect(() => {
    document.title =
      "บันทึกสุขภาพ | Check-D";
  }, []);

  // ===============================
  // STATE
  // ===============================
  const [bp, setBP] =
    useState({
      systolic: "",
      diastolic: "",
      pulse: "",
    });

  const [sugar, setSugar] =
    useState({
      fbs: "",
      hba1c: "",
    });

  const [chol, setChol] =
    useState({
      total: "",
      ldl: "",
      hdl: "",
      triglyceride: "",
    });

  const [weight, setWeight] =
    useState("");

  const [height, setHeight] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState(null);

  // ===============================
  // SUBMIT
  // ===============================
  const handleSubmit =
    async () => {

      try {

        setLoading(true);

        Swal.fire({
          title:
            "กำลังประเมินสุขภาพ",
          text:
            "กรุณารอสักครู่",
          allowOutsideClick:
            false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const results = [];

        // ===============================
        // BLOOD PRESSURE
        // ===============================
        if (
          bp.systolic &&
          bp.diastolic &&
          bp.pulse
        ) {

          const res =
            await addHealth({
              citizenId,

              type:
                "blood_pressure",

              value: {
                systolic:
                  +bp.systolic,

                diastolic:
                  +bp.diastolic,

                pulse:
                  +bp.pulse,
              },
            });

          results.push(
            res.data.data
          );
        }

        // ===============================
        // SUGAR
        // ===============================
        if (
          sugar.fbs ||
          sugar.hba1c
        ) {

          const res =
            await addHealth({
              citizenId,

              type: "sugar",

              value: {
                fbs:
                  sugar.fbs
                    ? +sugar.fbs
                    : undefined,

                hba1c:
                  sugar.hba1c
                    ? +sugar.hba1c
                    : undefined,
              },
            });

          results.push(
            res.data.data
          );
        }

        // ===============================
        // CHOLESTEROL
        // ===============================
        if (chol.total) {

          const res =
            await addHealth({
              citizenId,

              type:
                "cholesterol",

              value: {
                total:
                  +chol.total,

                ldl:
                  +chol.ldl,

                hdl:
                  +chol.hdl,

                triglyceride:
                  +chol.triglyceride,
              },

              weight:
                weight
                  ? +weight
                  : undefined,

              height:
                height
                  ? +height
                  : undefined,
            });

          results.push(
            res.data.data
          );
        }

        if (
          !results.length
        ) {

          Swal.fire({
            icon: "warning",
            title:
              "กรุณากรอกอย่างน้อย 1 ค่า",
          });

          return;
        }

        setResult(
          results[
            results.length -
              1
          ]
        );

        Swal.close();

      } catch (err) {

        console.error(err);

        Swal.fire({
          icon: "error",
          title:
            "บันทึกไม่สำเร็จ",
          text:
            err?.response
              ?.data
              ?.message ||
            "เกิดข้อผิดพลาด",
        });

      } finally {

        setLoading(false);
      }
    };

  // ===============================
  // RESET
  // ===============================
  const resetForm =
    () => navigate("/");

  // ===============================
  // BMI STATUS
  // ===============================
  const getBMIStatus =
    (bmi) => {

      if (!bmi)
        return null;

      if (bmi < 18.5) {
        return {
          label:
            "น้ำหนักน้อย",

          color:
            "text-blue-500",

          bg:
            "bg-blue-100",

          advice:
            "ควรเพิ่มสารอาหารและโปรตีนให้เพียงพอ",
        };
      }

      if (bmi < 23) {
        return {
          label:
            "สมส่วน",

          color:
            "text-green-600",

          bg:
            "bg-green-100",

          advice:
            "สุขภาพอยู่ในเกณฑ์ดี ควรรักษาระดับนี้ไว้",
        };
      }

      if (bmi < 25) {
        return {
          label:
            "น้ำหนักเกิน",

          color:
            "text-yellow-600",

          bg:
            "bg-yellow-100",

          advice:
            "ควรลดอาหารหวาน มัน และออกกำลังกาย",
        };
      }

      return {
        label:
          "อ้วน",

        color:
          "text-red-600",

        bg:
          "bg-red-100",

        advice:
          "เสี่ยงโรคหัวใจ เบาหวาน และความดันสูง ควรพบแพทย์",
      };
    };

  // ===============================
  // HEALTH ANALYSIS
  // ===============================
  const getHealthAdvice =
    () => {

      const advices =
        [];

      // ===============================
      // BLOOD PRESSURE
      // ===============================
      if (
        bp.systolic &&
        bp.diastolic
      ) {

        const sys =
          Number(
            bp.systolic
          );

        const dia =
          Number(
            bp.diastolic
          );

        if (
          sys >= 140 ||
          dia >= 90
        ) {

          advices.push({
            type: "danger",

            title:
              "ความดันโลหิตสูง",

            detail:
              "เสี่ยงโรคหัวใจ หลอดเลือดสมอง และไต",

            advice: [
              "ลดอาหารเค็มและอาหารแปรรูป",
              "หลีกเลี่ยงเครื่องดื่มแอลกอฮอล์",
              "ออกกำลังกายอย่างน้อย 30 นาที/วัน",
              "ควรตรวจวัดความดันสม่ำเสมอ",
              "หากมีอาการเวียนหัว แน่นหน้าอก ควรพบแพทย์",
            ],
          });

        } else if (
          sys < 90 ||
          dia < 60
        ) {

          advices.push({
            type: "warning",

            title:
              "ความดันโลหิตต่ำ",

            detail:
              "อาจทำให้เวียนศีรษะ หน้ามืด อ่อนเพลีย",

            advice: [
              "ดื่มน้ำให้เพียงพอ",
              "พักผ่อนให้เพียงพอ",
              "หลีกเลี่ยงการลุกเร็ว",
              "เพิ่มเกลือแร่ในปริมาณเหมาะสม",
            ],
          });

        } else {

          advices.push({
            type: "success",

            title:
              "ความดันโลหิตปกติ",

            detail:
              "อยู่ในเกณฑ์ที่ดี",

            advice: [
              "รักษาพฤติกรรมสุขภาพที่ดีต่อเนื่อง",
              "ควรตรวจสุขภาพทุกปี",
            ],
          });
        }
      }

      // ===============================
      // SUGAR
      // ===============================
      if (sugar.fbs) {

        const fbs =
          Number(
            sugar.fbs
          );

        if (
          fbs >= 126
        ) {

          advices.push({
            type: "danger",

            title:
              "น้ำตาลในเลือดสูง",

            detail:
              "เสี่ยงโรคเบาหวาน",

            advice: [
              "ลดอาหารหวาน น้ำอัดลม ชานม",
              "ควบคุมอาหารประเภทแป้ง",
              "ออกกำลังกายสม่ำเสมอ",
              "ตรวจ HbA1C เพิ่มเติม",
            ],
          });

        } else if (
          fbs < 70
        ) {

          advices.push({
            type: "warning",

            title:
              "น้ำตาลในเลือดต่ำ",

            detail:
              "อาจเกิดอาการหน้ามืด ใจสั่น",

            advice: [
              "รับประทานอาหารตรงเวลา",
              "พกลูกอม/น้ำหวานกรณีฉุกเฉิน",
              "หลีกเลี่ยงการอดอาหาร",
            ],
          });

        } else {

          advices.push({
            type: "success",

            title:
              "ระดับน้ำตาลปกติ",

            detail:
              "อยู่ในเกณฑ์เหมาะสม",

            advice: [
              "ควบคุมอาหารต่อเนื่อง",
              "หลีกเลี่ยงน้ำตาลสูง",
            ],
          });
        }
      }

      // ===============================
      // CHOLESTEROL
      // ===============================
      if (chol.total) {

        const total =
          Number(
            chol.total
          );

        if (
          total >= 240
        ) {

          advices.push({
            type: "danger",

            title:
              "ไขมันในเลือดสูง",

            detail:
              "เสี่ยงหลอดเลือดตีบและโรคหัวใจ",

            advice: [
              "ลดของทอด ของมัน",
              "หลีกเลี่ยงไขมันทรานส์",
              "เพิ่มผักและผลไม้",
              "ควรตรวจ LDL และ HDL เพิ่มเติม",
            ],
          });

        } else if (
          total < 120
        ) {

          advices.push({
            type: "warning",

            title:
              "ไขมันในเลือดต่ำ",

            detail:
              "อาจเกิดภาวะขาดสารอาหาร",

            advice: [
              "รับประทานอาหารให้ครบ 5 หมู่",
              "เพิ่มโปรตีนและไขมันดี",
            ],
          });

        } else {

          advices.push({
            type: "success",

            title:
              "ระดับไขมันปกติ",

            detail:
              "อยู่ในเกณฑ์ที่ดี",

            advice: [
              "รักษาพฤติกรรมสุขภาพที่ดี",
            ],
          });
        }
      }

      return advices;
    };

  const bmiStatus =
    getBMIStatus(
      result?.bmi
    );

  const healthAdvices =
    getHealthAdvice();

  // ===============================
  // RESULT
  // ===============================
  if (result) {

    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">

        <div className="max-w-2xl mx-auto space-y-6">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-3xl p-8 text-white shadow-xl text-center">

            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-5">

              <HeartPulse size={40} />

            </div>

            <h1 className="text-3xl font-bold">
              ผลการประเมินสุขภาพ
            </h1>

            <p className="mt-3 text-green-100">
              วิเคราะห์ข้อมูลสุขภาพเบื้องต้น
            </p>

          </div>

          {/* BMI */}
          {result.bmi && (
            <div className="bg-white rounded-3xl p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <div className="flex items-center gap-2 text-gray-500">

                    <Weight size={18} />

                    BMI
                  </div>

                  <h2 className="text-5xl font-bold mt-4">
                    {
                      result.bmi
                    }
                  </h2>

                </div>

                <div
                  className={`px-5 py-3 rounded-2xl font-semibold ${bmiStatus?.bg} ${bmiStatus?.color}`}
                >
                  {
                    bmiStatus?.label
                  }
                </div>

              </div>

              <div className="mt-6 p-4 rounded-2xl bg-gray-50">

                <p className="text-sm text-gray-500">
                  คำแนะนำ
                </p>

                <p className="mt-2 font-medium text-gray-700">
                  {
                    bmiStatus?.advice
                  }
                </p>

              </div>

            </div>
          )}

          {/* CVD */}
          {result.cvdRisk && (
            <div className="bg-white rounded-3xl p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <div className="flex items-center gap-2 text-gray-500">

                    <Heart size={18} />

                    ความเสี่ยงโรคหัวใจ
                  </div>

                  <h2 className="text-3xl font-bold mt-4">
                    {
                      result
                        ?.cvdRisk
                        ?.label
                    }
                  </h2>

                </div>

                {result
                  ?.cvdRisk
                  ?.level ===
                "risk_high" ? (

                  <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">

                    <AlertTriangle className="text-red-500" />

                  </div>

                ) : (

                  <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">

                    <CheckCircle2 className="text-green-500" />

                  </div>
                )}

              </div>

            </div>
          )}

          {/* HEALTH ADVICE */}
          <div className="space-y-5">

            {healthAdvices.map(
              (
                item,
                index
              ) => (

                <div
                  key={index}
                  className={`rounded-3xl p-6 shadow-sm ${
                    item.type ===
                    "danger"
                      ? "bg-red-50 border border-red-100"
                      : item.type ===
                          "warning"
                        ? "bg-yellow-50 border border-yellow-100"
                        : "bg-green-50 border border-green-100"
                  }`}
                >

                  <div className="flex items-center gap-3">

                    {item.type ===
                    "danger" ? (

                      <AlertTriangle className="text-red-500" />

                    ) : item.type ===
                      "warning" ? (

                      <Activity className="text-yellow-500" />

                    ) : (

                      <CheckCircle2 className="text-green-500" />

                    )}

                    <div>

                      <h2 className="text-xl font-bold text-gray-800">
                        {
                          item.title
                        }
                      </h2>

                      <p className="text-sm text-gray-500 mt-1">
                        {
                          item.detail
                        }
                      </p>

                    </div>

                  </div>

                  {/* ADVICE */}
                  <div className="mt-5 space-y-3">

                    {item.advice.map(
                      (
                        advice,
                        i
                      ) => (

                        <div
                          key={i}
                          className="flex items-start gap-3 bg-white rounded-2xl p-4"
                        >

                          <CheckCircle2
                            size={18}
                            className="text-green-500 mt-0.5"
                          />

                          <p className="text-gray-700">
                            {
                              advice
                            }
                          </p>

                        </div>
                      )
                    )}

                  </div>

                </div>
              )
            )}

          </div>

          {/* SUMMARY */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">

            <h2 className="text-xl font-bold text-gray-800 mb-5">
              สรุปข้อมูลสุขภาพ
            </h2>

            <div className="space-y-4">

              {bp.systolic && (
                <SummaryRow
                  icon={
                    <Heart className="text-red-500" />
                  }
                  title="ความดันโลหิต"
                  value={`${bp.systolic}/${bp.diastolic} mmHg`}
                />
              )}

              {sugar.fbs && (
                <SummaryRow
                  icon={
                    <Droplets className="text-blue-500" />
                  }
                  title="น้ำตาล FBS"
                  value={`${sugar.fbs} mg/dL`}
                />
              )}

              {chol.total && (
                <SummaryRow
                  icon={
                    <Activity className="text-yellow-500" />
                  }
                  title="ไขมันรวม"
                  value={`${chol.total} mg/dL`}
                />
              )}

            </div>

          </div>

          {/* BUTTON */}
          <div className="grid grid-cols gap-4">

            <button
              onClick={
                resetForm
              }
             className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-semibold transition-all"
            >
              ทำรายการใหม่
            </button>

       

          </div>

        </div>

      </div>
    );
  }

  // ===============================
  // FORM
  // ===============================
  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">

      <div className="max-w-3xl mx-auto space-y-6">

        <div className="text-center">

          <h1 className="text-3xl font-bold text-green-600">
            บันทึกข้อมูลสุขภาพ
          </h1>

          <p className="text-gray-500 mt-2">
            Check-D Health Monitoring
          </p>

        </div>

        {/* BP */}
        <Card
          icon={
            <Heart className="text-red-500" />
          }
          title="ความดันโลหิต"
        >

          <Grid2>

            <Input
              label="SYS"
              note="ปกติ < 120"

              value={
                bp.systolic
              }

              onChange={(
                v
              ) =>
                setBP({
                  ...bp,
                  systolic:
                    v,
                })
              }
            />

            <Input
              label="DIA"
              note="ปกติ < 80"

              value={
                bp.diastolic
              }

              onChange={(
                v
              ) =>
                setBP({
                  ...bp,
                  diastolic:
                    v,
                })
              }
            />

          </Grid2>

          <Input
            label="Pulse"
            note="60-100 bpm"

            value={bp.pulse}

            onChange={(
              v
            ) =>
              setBP({
                ...bp,
                pulse: v,
              })
            }
          />

        </Card>

        {/* SUGAR */}
        <Card
          icon={
            <Droplets className="text-blue-500" />
          }
          title="น้ำตาลในเลือด"
        >

          <Grid2>

            <Input
              label="FBS"

              note="70-99"

              value={
                sugar.fbs
              }

              onChange={(
                v
              ) =>
                setSugar({
                  ...sugar,
                  fbs: v,
                })
              }
            />

            <Input
              label="HbA1C"

              note="< 5.7"

              value={
                sugar.hba1c
              }

              onChange={(
                v
              ) =>
                setSugar({
                  ...sugar,
                  hba1c: v,
                })
              }
            />

          </Grid2>

        </Card>

        {/* CHOLESTEROL */}
        <Card
          icon={
            <Activity className="text-yellow-500" />
          }
          title="ไขมันในเลือด"
        >

          <Grid2>

            <Input
              label="Total"

              value={
                chol.total
              }

              onChange={(
                v
              ) =>
                setChol({
                  ...chol,
                  total: v,
                })
              }
            />

            <Input
              label="LDL"

              value={
                chol.ldl
              }

              onChange={(
                v
              ) =>
                setChol({
                  ...chol,
                  ldl: v,
                })
              }
            />

            <Input
              label="HDL"

              value={
                chol.hdl
              }

              onChange={(
                v
              ) =>
                setChol({
                  ...chol,
                  hdl: v,
                })
              }
            />

            <Input
              label="Triglyceride"

              value={
                chol.triglyceride
              }

              onChange={(
                v
              ) =>
                setChol({
                  ...chol,
                  triglyceride:
                    v,
                })
              }
            />

          </Grid2>

          <Grid2>

            <Input
              label="น้ำหนัก"

              value={weight}

              onChange={
                setWeight
              }
            />

            <Input
              label="ส่วนสูง"

              value={height}

              onChange={
                setHeight
              }
            />

          </Grid2>

        </Card>

        {/* SUBMIT */}
        <button
          onClick={
            handleSubmit
          }
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-4 rounded-2xl font-semibold transition-all"
        >
          {loading
            ? "กำลังประเมิน..."
            : "ประเมินสุขภาพ"}
        </button>

      </div>

    </div>
  );
}

// ===============================
// COMPONENTS
// ===============================
function Card({
  icon,
  title,
  children,
}) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm space-y-5">

      <div className="flex items-center gap-3">

        {icon}

        <h2 className="font-bold text-lg text-gray-800">
          {title}
        </h2>

      </div>

      {children}

    </div>
  );
}

function Input({
  label,
  note,
  value,
  onChange,
}) {
  return (
    <div className="space-y-2">

      <label className="text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        className="w-full rounded-2xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"

        value={value}

        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
      />

      {note && (
        <p className="text-xs text-blue-400">
          {note}
        </p>
      )}

    </div>
  );
}

function Grid2({
  children,
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {children}
    </div>
  );
}

function SummaryRow({
  icon,
  title,
  value,
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">

      <div className="flex items-center gap-3">

        {icon}

        <span className="font-medium text-gray-700">
          {title}
        </span>

      </div>

      <span className="font-bold text-gray-800">
        {value}
      </span>

    </div>
  );
}