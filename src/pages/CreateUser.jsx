import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import { parse, format } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";

import { createUser, searchUser } from "../api/api";

export default function CreateUser() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    citizenId: "",
    firstName: "",
    lastName: "",
    gender: "male",
    birthDate: "",

    phone: "",
    email: "",
    lineId: "",

    emergencyContactName: "",
    emergencyContactPhone: "",

    province: "",
    district: "",
    subdistrict: "",
    address: "",

    weight: "",
    height: "",

    education: "Bachelor",
    maritalStatus: "single",
    occupation: "",
    economicStatus: "ปานกลาง",

    chronicDiseases: "",
  });

  const [isSearched, setIsSearched] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const parseDate = (d) =>
    d ? parse(d, "yyyyMMdd", new Date()) : null;

  const formatDate = (d) =>
    d ? format(d, "yyyyMMdd") : "";

  const handleSearch = async () => {
    if (form.citizenId.length !== 13)
      return alert("เลขบัตรไม่ถูกต้อง");

    setLoading(true);
    const res = await searchUser(form.citizenId);

    setIsSearched(true);

    if (res.data?.data) {
      const u = res.data.data;

      setForm({
        ...u,
        chronicDiseases: u.chronicDiseases?.join(",") || "",
      });

      setIsExisting(true);
    } else {
      setIsExisting(false);
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      weight: Number(form.weight),
      height: Number(form.height),
      chronicDiseases: form.chronicDiseases
        ? form.chronicDiseases.split(",").map((d) => d.trim())
        : [],
    };

    await createUser(payload);
  };

  const disabled = !isSearched || isExisting;

  return (
    <div className="container-mobile space-y-6">

      <h1 className="text-center text-green-600 text-xl font-bold">
        สมัครผู้ใช้
      </h1>

      {/* 🔍 SEARCH */}
      <Card title="ค้นหา">
        <div className="flex gap-2">
          <input
            className="input"
            name="citizenId"
            value={form.citizenId}
            onChange={handleChange}
          />
          <button onClick={handleSearch} className="btn bg-blue-500 text-white">
            {loading ? "..." : "ค้นหา"}
          </button>
        </div>
      </Card>

      {/* 👤 BASIC */}
      <Card title="ข้อมูลส่วนตัว">
        <div className="grid grid-cols-2 gap-2">
          <Input label="ชื่อ" name="firstName" form={form} onChange={handleChange} disabled={disabled}/>
          <Input label="นามสกุล" name="lastName" form={form} onChange={handleChange} disabled={disabled}/>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select label="เพศ" name="gender" form={form} onChange={handleChange} disabled={disabled}
            options={{ male: "ชาย", female: "หญิง" }}
          />

          <Field label="วันเกิด">
            <DatePicker
              selected={parseDate(form.birthDate)}
              onChange={(d) => setForm({ ...form, birthDate: formatDate(d) })}
              className="input"
              disabled={disabled}
            />
          </Field>
        </div>
      </Card>

      {/* 📞 CONTACT */}
      <Card title="ติดต่อ">
        <Input label="เบอร์" name="phone" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="Email" name="email" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="LINE" name="lineId" form={form} onChange={handleChange} disabled={disabled}/>
      </Card>

      {/* 🚨 EMERGENCY */}
      <Card title="ฉุกเฉิน">
        <Input label="ชื่อผู้ติดต่อ" name="emergencyContactName" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="เบอร์ฉุกเฉิน" name="emergencyContactPhone" form={form} onChange={handleChange} disabled={disabled}/>
      </Card>

      {/* 📍 ADDRESS */}
      <Card title="ที่อยู่">
        <Input label="จังหวัด" name="province" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="อำเภอ" name="district" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="ตำบล" name="subdistrict" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="ที่อยู่" name="address" form={form} onChange={handleChange} disabled={disabled}/>
      </Card>

      {/* ⚖️ HEALTH */}
      <Card title="สุขภาพ">
        <div className="grid grid-cols-2 gap-2">
          <Input label="น้ำหนัก" name="weight" form={form} onChange={handleChange} disabled={disabled}/>
          <Input label="ส่วนสูง" name="height" form={form} onChange={handleChange} disabled={disabled}/>
        </div>

        <Input label="โรคประจำตัว" name="chronicDiseases" form={form} onChange={handleChange} disabled={disabled}/>
      </Card>

      {/* 🎓 INFO */}
      <Card title="ข้อมูลเพิ่มเติม">
        <Select label="การศึกษา" name="education" form={form} onChange={handleChange} disabled={disabled}
          options={{ Bachelor: "Bachelor", Master: "Master" }}
        />

        <Select label="สถานภาพ" name="maritalStatus" form={form} onChange={handleChange} disabled={disabled}
          options={{ single: "โสด", married: "แต่งงาน" }}
        />

        <Input label="อาชีพ" name="occupation" form={form} onChange={handleChange} disabled={disabled}/>
      </Card>

      {/* 🔥 BUTTON */}
      <button
        className="btn-primary w-full"
        onClick={async () => {
          if (!isSearched) return alert("ค้นหาก่อน");

          if (!isExisting) await handleSubmit();

          navigate(`/health/${form.citizenId}`);
        }}
      >
        {isExisting ? "ต่อไป" : "สร้างผู้ใช้"}
      </button>

    </div>
  );
}

/* ---------- COMPONENT ---------- */

function Card({ title, children }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow space-y-3">
      <h2 className="font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Input({ label, name, form, onChange, disabled }) {
  return (
    <Field label={label}>
      <input
        className="input"
        name={name}
        value={form[name]}
        onChange={onChange}
        disabled={disabled}
      />
    </Field>
  );
}

function Select({ label, name, form, onChange, options, disabled }) {
  return (
    <Field label={label}>
      <select
        className="input"
        name={name}
        value={form[name]}
        onChange={onChange}
        disabled={disabled}
      >
        {Object.entries(options).map(([v, t]) => (
          <option key={v} value={v}>{t}</option>
        ))}
      </select>
    </Field>
  );
}