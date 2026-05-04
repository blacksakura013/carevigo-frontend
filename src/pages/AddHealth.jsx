import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { addHealth } from "../api/api";

export default function AddHealth() {
    const { citizenId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "บันทึกสุขภาพ | Check-D";
    }, []);

    const [bp, setBP] = useState({ systolic: "", diastolic: "", pulse: "" });
    const [sugar, setSugar] = useState({ fbs: "", hba1c: "" });
    const [chol, setChol] = useState({
        total: "",
        ldl: "",
        hdl: "",
        triglyceride: "",
    });
    const [weight, setWeight] = useState("");
    const [height, setHeight] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const results = [];

            if (bp.systolic && bp.diastolic && bp.pulse) {
                const res = await addHealth({
                    citizenId,
                    type: "blood_pressure",
                    value: {
                        systolic: +bp.systolic,
                        diastolic: +bp.diastolic,
                        pulse: +bp.pulse,
                    },
                });
                results.push(res.data.data);
            }

            if (sugar.fbs || sugar.hba1c) {
                const res = await addHealth({
                    citizenId,
                    type: "sugar",
                    value: {
                        fbs: sugar.fbs ? +sugar.fbs : undefined,
                        hba1c: sugar.hba1c ? +sugar.hba1c : undefined,
                    },
                });
                results.push(res.data.data);
            }

            if (chol.total) {
                const res = await addHealth({
                    citizenId,
                    type: "cholesterol",
                    value: {
                        total: +chol.total,
                        ldl: +chol.ldl,
                        hdl: +chol.hdl,
                        triglyceride: +chol.triglyceride,
                    },
                    weight: weight ? +weight : undefined,
                    height: height ? +height : undefined,
                });
                results.push(res.data.data);
            }

            if (!results.length) {
                return alert("กรุณากรอกอย่างน้อย 1 ค่า");
            }

            setResult(results[results.length - 1]);

        } catch (err) {
            console.error(err);
            alert("บันทึกไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => navigate("/");

    // ================= RESULT =================
    if (result) {
        return (
            <div className="container-mobile text-center space-y-4">
                <h1 className="text-xl font-bold text-green-600">ผลการประเมิน</h1>

                {result.bmi && (
                    <div className="card">
                        <p className="text-gray-500">BMI (ดัชนีมวลกาย)</p>
                        <p className="text-3xl font-bold">{result.bmi}</p>
                        <p className="text-xs text-gray-400">
                            ใช้ประเมินว่าผอม/ปกติ/อ้วน
                        </p>
                    </div>
                )}

                {result.cvdRisk && (
                    <div className="card">
                        <p className="text-gray-500">ความเสี่ยงโรคหัวใจ</p>
                        <p className="text-xl font-bold">{result.cvdRisk.label}</p>
                    </div>
                )}

                <button onClick={resetForm} className="btn-primary">
                    ทำรายการใหม่
                </button>
            </div>
        );
    }

    // ================= FORM =================
    return (
        <div className="container-mobile space-y-4">

            <h1 className="text-xl font-bold text-green-600 text-center">
                บันทึกข้อมูลสุขภาพ
            </h1>

            {/* ❤️ BP */}
            <Card title="ความดันโลหิต (Blood Pressure)">
                <Grid2>
                    <Input
                        label="ความดันตัวบน (SYS)"
                        desc="แรงดันเลือดขณะหัวใจบีบตัว"
                        note="ปกติ < 120 mmHg"
                        value={bp.systolic}
                        onChange={(v) => setBP({ ...bp, systolic: v })}
                    />

                    <Input
                        label="ความดันตัวล่าง (DIA)"
                        desc="แรงดันเลือดขณะหัวใจคลายตัว"
                        note="ปกติ < 80 mmHg"
                        value={bp.diastolic}
                        onChange={(v) => setBP({ ...bp, diastolic: v })}
                    />
                </Grid2>
                <Input
                    label="ชีพจร (Pulse)"
                    desc="จำนวนการเต้นของหัวใจต่อนาที"
                    note="ปกติ 60-100 bpm"
                    value={bp.pulse}
                    onChange={(v) => setBP({ ...bp, pulse: v })}
                />

            </Card>

            {/* 🍬 Sugar */}
            <Card title="น้ำตาลในเลือด (Blood Sugar)">
                <Grid2>
                    <Input
                        label="FBS"
                        desc="น้ำตาลหลังอดอาหาร 8 ชั่วโมง"
                        note="ปกติ 70-99 mg/dL"
                        value={sugar.fbs}
                        onChange={(v) => setSugar({ ...sugar, fbs: v })}
                    />

                    <Input
                        label="HbA1C"
                        desc="ค่าเฉลี่ยน้ำตาลย้อนหลัง 2-3 เดือน"
                        note="ปกติ < 5.7%"
                        value={sugar.hba1c}
                        onChange={(v) => setSugar({ ...sugar, hba1c: v })}
                    />
                </Grid2>
            </Card>

            {/* 🧬 Chol */}
            <Card title="ไขมันในเลือด (Cholesterol)">
                <Grid2>
                    <Input
                        label="Total"
                        desc="ไขมันรวมทั้งหมดในเลือด"
                        note="ปกติ < 200"
                        value={chol.total}
                        onChange={(v) => setChol({ ...chol, total: v })}
                    />

                    <Input
                        label="LDL"
                        desc="ไขมันไม่ดี อาจอุดตันหลอดเลือด"
                        note="ควร < 100"
                        value={chol.ldl}
                        onChange={(v) => setChol({ ...chol, ldl: v })}
                    />

                    <Input
                        label="HDL"
                        desc="ไขมันดี ช่วยลดไขมันไม่ดี"
                        note="ควร > 40"
                        value={chol.hdl}
                        onChange={(v) => setChol({ ...chol, hdl: v })}
                    />

                    <Input
                        label="Triglyceride"
                        desc="ไขมันจากอาหาร/น้ำตาล"
                        note="ปกติ < 150"
                        value={chol.triglyceride}
                        onChange={(v) => setChol({ ...chol, triglyceride: v })}
                    />
                </Grid2>

                <Grid2>
                    <Input
                        label="น้ำหนัก (kg)"
                        desc="ใช้คำนวณ BMI"
                        value={weight}
                        onChange={setWeight}
                    />

                    <Input
                        label="ส่วนสูง (cm)"
                        desc="ใช้คำนวณ BMI"
                        value={height}
                        onChange={setHeight}
                    />
                </Grid2>
            </Card>

            <button onClick={handleSubmit} className="btn-primary">
                {loading ? "กำลังประเมิน..." : "ประเมินสุขภาพ"}
            </button>
        </div>
    );
}

// ================= COMPONENT =================

const Card = ({ title, children }) => (
    <div className="card">
        <h2 className="font-semibold text-gray-700">{title}</h2>
        {children}
    </div>
);

const Input = ({ label, desc, note, value, onChange }) => (
    <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
        <input
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
        {note && <p className="text-xs text-blue-400">{note}</p>}
    </div>
);

const Grid2 = ({ children }) => (
    <div className="grid grid-cols-2 gap-2">{children}</div>
);

const Grid3 = ({ children }) => (
    <div className="grid grid-cols-3 gap-2">{children}</div>
);