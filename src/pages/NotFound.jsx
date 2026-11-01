import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPinOff } from "lucide-react";
import { EmptyState, PublicLayout } from "../components/ui";
export default function NotFound() {
  useEffect(() => {
    document.title = "ไม่พบหน้า | Save Stroke";
  }, []);
  return (
    <PublicLayout active="help">
      <section className="panel">
        <EmptyState
          icon={MapPinOff}
          title="ไม่พบหน้าที่คุณต้องการ"
          description="ลิงก์นี้อาจไม่ถูกต้องหรือมีการเปลี่ยนแปลง คุณสามารถกลับไปเริ่มต้นได้ที่หน้าหลัก"
          action={
            <Link to="/" className="btn btn-primary">
              <ArrowLeft size={16} /> กลับหน้าหลัก
            </Link>
          }
        />
      </section>
    </PublicLayout>
  );
}
