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

    education: "primary",
    maritalStatus: "single",
    occupation: "",
    economicStatus: "enough",

    chronicDiseases: [],
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

  // 🔍 SEARCH USER
  const handleSearch = async () => {
    if (form.citizenId.length !== 13) {
      alert("เลขบัตรไม่ถูกต้อง");
      return;
    }

    setLoading(true);

    try {
      const res = await searchUser(form.citizenId);
      setIsSearched(true);

      if (res.data?.data) {
        const u = res.data.data;

        setForm({
          ...form,
          ...u,
          chronicDiseases: u.chronicDiseases || [],
        });

        setIsExisting(true);
        alert("✅ พบข้อมูลแล้ว");
      } else {
        setIsExisting(false);
        alert("❗ ไม่พบข้อมูล คุณสามารถสร้างข้อมูลใหม่ได้");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการค้นหา");
    }

    setLoading(false);
  };

  // 📦 SUBMIT
  const handleSubmit = async () => {
    if (!form.firstName) return alert("กรุณากรอกชื่อ");
    if (!form.province) return alert("กรุณากรอกจังหวัด");

    const payload = {
      ...form,
      weight: Number(form.weight),
      height: Number(form.height),
      chronicDiseases: form.chronicDiseases,
    };

    await createUser(payload);
    alert("✅ สร้างผู้ใช้สำเร็จ");
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

      {/* STATUS */}
      {isSearched && !isExisting && (
        <div className="bg-yellow-100 text-yellow-800 p-2 rounded text-sm">
          ❗ ไม่พบข้อมูล คุณสามารถสร้างข้อมูลใหม่ได้
        </div>
      )}

      {isExisting && (
        <div className="bg-green-100 text-green-800 p-2 rounded text-sm">
          ✅ พบข้อมูลแล้ว สามารถไปขั้นตอนถัดไปได้
        </div>
      )}

      {/* 👤 BASIC */}
      <Card title="ข้อมูลส่วนตัว">
        <Input label="ชื่อ" name="firstName" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="นามสกุล" name="lastName" form={form} onChange={handleChange} disabled={disabled}/>

        <Select
          label="เพศ"
          name="gender"
          form={form}
          onChange={handleChange}
          disabled={disabled}
          options={{ male: "ชาย", female: "หญิง" }}
        />

        <Field label="วันเกิด">
          <DatePicker
            selected={parseDate(form.birthDate)}
            onChange={(d) =>
              setForm({ ...form, birthDate: formatDate(d) })
            }
            className="input"
            disabled={disabled}
          />
        </Field>
      </Card>

      {/* 📞 CONTACT */}
      <Card title="ติดต่อ">
        <Input label="เบอร์" name="phone" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="Email" name="email" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="LINE" name="lineId" form={form} onChange={handleChange} disabled={disabled}/>
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
        <Input label="น้ำหนัก" name="weight" form={form} onChange={handleChange} disabled={disabled}/>
        <Input label="ส่วนสูง" name="height" form={form} onChange={handleChange} disabled={disabled}/>

        <Field label="โรคประจำตัว">
          <div className="grid grid-cols-2 gap-2">
            {[
              "ไม่มีโรค",
              "NCDs",
              "โรคติดเชื้อ",
              "โรคความดัน",
              "เบาหวาน",
              "ไขมัน",
              "หัวใจ"
            ].map((d) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={form.chronicDiseases.includes(d)}
                  disabled={disabled}
                  onChange={(e) => {
                    const arr = form.chronicDiseases;
                    if (e.target.checked) {
                      setForm({ ...form, chronicDiseases: [...arr, d] });
                    } else {
                      setForm({
                        ...form,
                        chronicDiseases: arr.filter(x => x !== d),
                      });
                    }
                  }}
                />
                {d}
              </label>
            ))}
          </div>
        </Field>
      </Card>

      {/* 🎓 INFO */}
      <Card title="ข้อมูลเพิ่มเติม">
        <Select
          label="การศึกษา"
          name="education"
          form={form}
          onChange={handleChange}
          disabled={disabled}
          options={{
            none: "ไม่ได้เรียน",
            primary: "ประถมศึกษา",
            secondary: "มัธยมต้น",
            highschool: "มัธยมปลาย / ปวช.",
            diploma: "ปวส. / อนุปริญญา",
            bachelor: "ปริญญาตรีขึ้นไป"
          }}
        />

        <Select
          label="สถานภาพ"
          name="maritalStatus"
          form={form}
          onChange={handleChange}
          disabled={disabled}
          options={{
            single: "โสด",
            married: "สมรสอยู่ร่วมกัน",
            separated: "สมรสแยกกันอยู่",
            widowed: "หม้าย",
            divorced: "หย่าร้าง"
          }}
        />

        <Select
          label="เศรษฐกิจ"
          name="economicStatus"
          form={form}
          onChange={handleChange}
          disabled={disabled}
          options={{
            enough: "พอใช้",
            notEnough: "ไม่พอใช้"
          }}
        />

        <Input label="อาชีพ" name="occupation" form={form} onChange={handleChange} disabled={disabled}/>
      </Card>

      {/* 🔥 BUTTON */}
      <button
        className="btn-primary w-full"
        onClick={async () => {
          if (!isSearched) return alert("กรุณาค้นหาก่อน");

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