import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import DatePicker from "react-datepicker";

import Swal from "sweetalert2";

import "react-datepicker/dist/react-datepicker.css";

import {
  createUser,
  searchUser,
} from "../api/api";

import th from "date-fns/locale/th";

export default function CreateUser() {

  const navigate =
    useNavigate();

  // ===============================
  // STATE
  // ===============================
  const [form, setForm] =
    useState({
      citizenId: "",

      firstName: "",
      lastName: "",

      gender: "male",

      birthDate: "",

      phone: "",
      email: "",
      lineId: "",

      emergencyContactName:
        "",

      emergencyContactPhone:
        "",

      province: "",
      district: "",
      subdistrict: "",
      address: "",

      weight: "",
      height: "",

      education:
        "primary",

      maritalStatus:
        "single",

      occupation: "",

      economicStatus:
        "enough",

      chronicDiseases: [],
    });

  const [
    isSearched,
    setIsSearched,
  ] = useState(false);

  const [
    isExisting,
    setIsExisting,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  // ===============================
  // INPUT CHANGE
  // ===============================
  const handleChange = (
    e
  ) =>
    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });

  // ===============================
  // DATE HELPERS
  // ===============================
  const parseDate = (
    value
  ) => {

    if (!value)
      return null;

    const year = Number(
      value.substring(0, 4)
    );

    const month =
      Number(
        value.substring(4, 6)
      ) - 1;

    const day = Number(
      value.substring(6, 8)
    );

    return new Date(
      year,
      month,
      day
    );
  };

  const formatDateToServer =
    (date) => {

      if (!date)
        return "";

      const christianYear =
        date.getFullYear();

      const month = String(
        date.getMonth() + 1
      ).padStart(2, "0");

      const day = String(
        date.getDate()
      ).padStart(2, "0");

      return `${christianYear}${month}${day}`;
    };

  // ===============================
  // SEARCH USER
  // ===============================
  const handleSearch =
    async () => {

      if (
        form.citizenId
          .length !== 13
      ) {

        Swal.fire({
          icon: "warning",
          title:
            "เลขบัตรประชาชนไม่ถูกต้อง",
        });

        return;
      }

      setLoading(true);

      try {

        const res =
          await searchUser(
            form.citizenId
          );

        setIsSearched(true);

        if (
          res.data?.data
        ) {

          const user =
            res.data.data;

          setForm({
            ...form,
            ...user,

            chronicDiseases:
              user.chronicDiseases ||
              [],
          });

          setIsExisting(
            true
          );

          Swal.fire({
            icon: "success",
            title:
              "พบข้อมูลแล้ว",
            text:
              "สามารถไปขั้นตอนถัดไปได้",
          });

        } else {

          setIsExisting(
            false
          );

          Swal.fire({
            icon: "info",
            title:
              "ไม่พบข้อมูล",
            text:
              "สามารถสร้างผู้ใช้ใหม่ได้",
          });
        }

      } catch (err) {

        Swal.fire({
          icon: "error",
          title:
            "ค้นหาไม่สำเร็จ",
          text:
            "เกิดข้อผิดพลาด",
        });
      }

      setLoading(false);
    };

  // ===============================
  // SUBMIT
  // ===============================
  const handleSubmit =
    async () => {

      if (
        !form.firstName
      ) {

        Swal.fire({
          icon: "warning",
          title:
            "กรุณากรอกชื่อ",
        });

        return;
      }

      if (
        !form.province
      ) {

        Swal.fire({
          icon: "warning",
          title:
            "กรุณากรอกจังหวัด",
        });

        return;
      }

      try {

        Swal.fire({
          title:
            "กำลังบันทึกข้อมูล",
          allowOutsideClick:
            false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const payload = {
          ...form,

          weight: Number(
            form.weight
          ),

          height: Number(
            form.height
          ),

          chronicDiseases:
            form.chronicDiseases,
        };

        await createUser(
          payload
        );

        Swal.fire({
          icon: "success",
          title:
            "สร้างผู้ใช้สำเร็จ",
        });

      } catch (err) {

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
      }
    };

  const disabled =
    !isSearched ||
    isExisting;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">

      <div className="max-w-3xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="text-center">

          <h1 className="text-3xl font-bold text-green-600">
            สมัครผู้ใช้
          </h1>

          <p className="text-gray-500 mt-2">
            Save Stroke
          </p>

        </div>

        {/* SEARCH */}
        <Card title="ค้นหาผู้ใช้">

          <div className="flex gap-2">

            <input
              className="input"
              name="citizenId"
              placeholder="เลขบัตรประชาชน"

              value={
                form.citizenId
              }

              onChange={
                handleChange
              }
            />

            <button
              onClick={
                handleSearch
              }
              className="bg-blue-500 hover:bg-blue-600 text-white px-5 rounded-2xl"
            >

              {loading
                ? "..."
                : "ค้นหา"}

            </button>

          </div>

        </Card>

        {/* BASIC */}
        <Card title="ข้อมูลส่วนตัว">

          <Input
            label="ชื่อ"
            name="firstName"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Input
            label="นามสกุล"
            name="lastName"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Select
            label="เพศ"
            name="gender"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
            options={{
              male: "ชาย",
              female: "หญิง",
            }}
          />

          {/* DATE */}
          <Field label="วันเกิด">

            <DatePicker
              selected={parseDate(
                form.birthDate
              )}

              onChange={(
                date
              ) =>
                setForm({
                  ...form,

                  birthDate:
                    formatDateToServer(
                      date
                    ),
                })
              }

              locale={th}

              dateFormat="dd/MM/yyyy"

              showMonthDropdown
              showYearDropdown

              dropdownMode="select"

              yearDropdownItemNumber={
                100
              }

              scrollableYearDropdown

              maxDate={
                new Date()
              }

              placeholderText="เลือกวันเกิด"

              disabled={
                disabled
              }

              className="
                w-full
                rounded-2xl
                border
                border-gray-200
                px-4
                py-3
                focus:outline-none
                focus:ring-2
                focus:ring-green-500
              "

              renderCustomHeader={({
                date,
                changeYear,
                changeMonth,
                decreaseMonth,
                increaseMonth,
              }) => {

                const years =
                  [];

                const currentYear =
                  new Date().getFullYear();

                for (
                  let y =
                    currentYear;
                  y >= 1900;
                  y--
                ) {
                  years.push(
                    y
                  );
                }

                const months =
                  [
                    "มกราคม",
                    "กุมภาพันธ์",
                    "มีนาคม",
                    "เมษายน",
                    "พฤษภาคม",
                    "มิถุนายน",
                    "กรกฎาคม",
                    "สิงหาคม",
                    "กันยายน",
                    "ตุลาคม",
                    "พฤศจิกายน",
                    "ธันวาคม",
                  ];

                return (
                  <div className="flex items-center justify-between px-2 py-2 gap-2">

                    <button
                      onClick={
                        decreaseMonth
                      }
                      type="button"
                      className="px-3 py-1 rounded-lg bg-gray-100"
                    >
                      {"<"}
                    </button>

                    <div className="flex gap-2">

                      {/* MONTH */}
                      <select
                        value={date.getMonth()}
                        onChange={(
                          e
                        ) =>
                          changeMonth(
                            Number(
                              e.target.value
                            )
                          )
                        }
                        className="border rounded-lg px-2 py-1"
                      >

                        {months.map(
                          (
                            month,
                            index
                          ) => (
                            <option
                              key={
                                month
                              }
                              value={
                                index
                              }
                            >
                              {
                                month
                              }
                            </option>
                          )
                        )}

                      </select>

                      {/* YEAR */}
                      <select
                        value={date.getFullYear()}
                        onChange={(
                          e
                        ) =>
                          changeYear(
                            Number(
                              e.target.value
                            )
                          )
                        }
                        className="border rounded-lg px-2 py-1"
                      >

                        {years.map(
                          (
                            year
                          ) => (
                            <option
                              key={
                                year
                              }
                              value={
                                year
                              }
                            >
                              {year +
                                543}
                            </option>
                          )
                        )}

                      </select>

                    </div>

                    <button
                      onClick={
                        increaseMonth
                      }
                      type="button"
                      className="px-3 py-1 rounded-lg bg-gray-100"
                    >
                      {">"}
                    </button>

                  </div>
                );
              }}
            />

            {/* SHOW DATE */}
            {form.birthDate && (
              <div className="text-sm text-gray-500 mt-2">

                วันเกิด:
                {" "}

                {(() => {

                  const date =
                    parseDate(
                      form.birthDate
                    );

                  return `${date.getDate()}/${
                    date.getMonth() +
                    1
                  }/${
                    date.getFullYear() +
                    543
                  }`;

                })()}

              </div>
            )}

          </Field>

        </Card>

        {/* CONTACT */}
        <Card title="ข้อมูลติดต่อ">

          <Input
            label="เบอร์โทร"
            name="phone"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Input
            label="Email"
            name="email"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Input
            label="LINE ID"
            name="lineId"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

        </Card>

        {/* ADDRESS */}
        <Card title="ที่อยู่">

          <Input
            label="จังหวัด"
            name="province"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Input
            label="อำเภอ"
            name="district"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Input
            label="ตำบล"
            name="subdistrict"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Input
            label="ที่อยู่"
            name="address"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

        </Card>

        {/* HEALTH */}
        <Card title="สุขภาพ">

          <Input
            label="น้ำหนัก"
            name="weight"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

          <Input
            label="ส่วนสูง"
            name="height"
            form={form}
            onChange={
              handleChange
            }
            disabled={
              disabled
            }
          />

        </Card>

        {/* BUTTON */}
        <button
          className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-semibold transition-all"
          onClick={async () => {

            if (
              !isSearched
            ) {

              Swal.fire({
                icon:
                  "warning",
                title:
                  "กรุณาค้นหาก่อน",
              });

              return;
            }

            if (
              !isExisting
            ) {
              await handleSubmit();
            }

            navigate(
              `/health/${form.citizenId}`
            );
          }}
        >
          {isExisting
            ? "ต่อไป"
            : "สร้างผู้ใช้"}
        </button>

      </div>

    </div>
  );
}

/* ===============================
   COMPONENTS
=============================== */

function Card({
  title,
  children,
}) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">

      <h2 className="font-semibold text-lg text-gray-700">
        {title}
      </h2>

      {children}

    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div className="space-y-2">

      <label className="text-sm text-gray-500">
        {label}
      </label>

      {children}

    </div>
  );
}

function Input({
  label,
  name,
  form,
  onChange,
  disabled,
}) {
  return (
    <Field label={label}>

      <input
        className="
          w-full
          rounded-2xl
          border
          border-gray-200
          px-4
          py-3
          focus:outline-none
          focus:ring-2
          focus:ring-green-500
        "

        name={name}

        value={form[name]}

        onChange={
          onChange
        }

        disabled={
          disabled
        }
      />

    </Field>
  );
}

function Select({
  label,
  name,
  form,
  onChange,
  options,
  disabled,
}) {
  return (
    <Field label={label}>

      <select
        className="
          w-full
          rounded-2xl
          border
          border-gray-200
          px-4
          py-3
          focus:outline-none
          focus:ring-2
          focus:ring-green-500
        "

        name={name}

        value={form[name]}

        onChange={
          onChange
        }

        disabled={
          disabled
        }
      >

        {Object.entries(
          options
        ).map(
          ([v, t]) => (
            <option
              key={v}
              value={v}
            >
              {t}
            </option>
          )
        )}

      </select>

    </Field>
  );
}