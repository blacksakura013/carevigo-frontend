import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProfile } from "../api/api";

export default function Dashboard() {
  const { citizenId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getProfile(citizenId);
        setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [citizenId]);

  if (loading) return <Center>กำลังโหลด...</Center>;
  if (!data) return <Center>ไม่พบข้อมูล</Center>;

  const { user, health } = data;

  const sort = (arr = []) =>
    [...arr].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

  const bp = sort(health.blood_pressure);
  const sugar = sort(health.sugar);
  const chol = sort(health.cholesterol);

  return (
    <div className="container-mobile space-y-4">

      {/* 👤 USER */}
      <Card>
        <h2 className="text-lg font-bold">
          {user.firstName} {user.lastName}
        </h2>
        <p className="text-gray-500 text-sm">{user.phone}</p>
      </Card>

      {/* ❤️ BLOOD PRESSURE */}
      <Section title="ความดันโลหิต">
        {bp.length ? (
          <>
            <Highlight
              color={getBPColor(bp[0].value.systolic)}
              value={`${bp[0].value.systolic}/${bp[0].value.diastolic}`}
              sub={`Pulse ${bp[0].value.pulse}`}
              time={bp[0].createdAt}
            />
            <MiniList
              list={bp}
              render={(x) =>
                `${x.value.systolic}/${x.value.diastolic}`
              }
            />
          </>
        ) : (
          <Empty />
        )}
      </Section>

      {/* 🍬 SUGAR */}
      <Section title="น้ำตาล">
        {sugar.length ? (
          <>
            <Highlight
              color={getSugarColor(sugar[0].value.hba1c)}
              value={`FBS ${sugar[0].value.fbs}`}
              sub={`HbA1C ${sugar[0].value.hba1c}`}
              time={sugar[0].createdAt}
            />
            <MiniList
              list={sugar}
              render={(x) =>
                `FBS ${x.value.fbs} | HbA1C ${x.value.hba1c}`
              }
            />
          </>
        ) : (
          <Empty />
        )}
      </Section>

      {/* 🧬 CHOLESTEROL */}
      <Section title="ไขมัน">
        {chol.length ? (
          <>
            <Highlight
              color="text-blue-600"
              value={`Total ${chol[0].value.total}`}
              sub={`LDL ${chol[0].value.ldl}`}
              time={chol[0].createdAt}
            />
            <MiniList
              list={chol}
              render={(x) =>
                `Total ${x.value.total} | LDL ${x.value.ldl}`
              }
            />
          </>
        ) : (
          <Empty />
        )}
      </Section>

      {/* 🔁 BUTTON */}
      <button
        onClick={() => navigate(`/health/${citizenId}`)}
        className="btn-primary w-full"
      >
        เพิ่มข้อมูลสุขภาพ
      </button>

    </div>
  );
}

//
// 🔹 COMPONENTS
//

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-md font-bold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      {children}
    </div>
  );
}

function Highlight({ value, sub, time, color }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-1">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500">{sub}</p>
      <Time time={time} />
    </div>
  );
}

function MiniList({ list = [], render }) {
  return (
    <div className="bg-white rounded-xl shadow p-3 space-y-1">
      {list.slice(0, 5).map((item) => (
        <div key={item._id} className="text-sm text-gray-600">
          {render(item)}
        </div>
      ))}
    </div>
  );
}

function Time({ time }) {
  return (
    <p className="text-xs text-gray-400">
      {new Date(time).toLocaleString("th-TH")}
    </p>
  );
}

function Empty() {
  return (
    <div className="text-center text-gray-400 py-2">
      ยังไม่มีข้อมูล
    </div>
  );
}

function Center({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}

//
// 🔥 RISK COLOR
//

function getBPColor(sys) {
  if (sys >= 140) return "text-red-500";
  if (sys >= 120) return "text-yellow-500";
  return "text-green-500";
}

function getSugarColor(hba1c) {
  if (hba1c >= 6.5) return "text-red-500";
  if (hba1c >= 5.7) return "text-yellow-500";
  return "text-green-500";
}