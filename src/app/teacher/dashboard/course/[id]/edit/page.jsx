"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import "./edit.css";

const BLANK_TEMPLATE = { "02": "", "03": "", "04": "", "05": "", "06": "", "07": "", "08": "", "09": "", "10": "" };
const MONTH_LABELS = { "02": "February","03": "March","04": "April","05": "May","06": "June","07": "July","08": "August","09": "September","10": "October" };

export default function EditCoursePage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/courses?code=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("not found");
        const list = await res.json();
        if (!list.length) { alert("Course not found"); router.push("/teacher/dashboard/course"); return; }
        const data = list[0];
        data.monthlyTemplate = data.monthlyTemplate || BLANK_TEMPLATE;
        data.permonth = data.pricePerMonth ? String(data.pricePerMonth) : "";
        data.fee = data.fee || data.tuition || "";
        setCourse(data);
      } catch (err) {
        console.error("Error fetching course:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const handleUpdate = async () => {
    const missing = [];
    if (!course.name) missing.push("コース名");
    if (!course.fee && !course.tuition) missing.push("学費");
    if (!course.year) missing.push("学年");
    if (missing.length > 0) {
      alert(`以下の項目が入力されていません：\n・${missing.join("\n・")}`);
      return;
    }
    try {
      const permonthStr = String(course.permonth || "").trim();
      const pricePerMonth = permonthStr ? Number(permonthStr.replace(/[^0-9.-]+/g, "")) || null : null;
      const cleaned = {};
      for (const [m, v] of Object.entries(course.monthlyTemplate || {})) {
        cleaned[m] = Number(String(v || "").replace(/[^0-9.-]+/g, "")) || 0;
      }
      const res = await fetch("/api/admin/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: course.code || id,
          name: course.name,
          year: course.year,
          tuition: Number(String(course.fee || "0").replace(/[^0-9.-]+/g, "")) || 0,
          pricePerMonth,
          monthlyTemplate: cleaned,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("コース情報を更新しました！");
      router.push("/teacher/dashboard/course");
    } catch (err) {
      alert("更新に失敗しました: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("本当にこのコースを削除しますか？")) return;
    try {
      const res = await fetch("/api/admin/courses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: course.code || id }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("コースを削除しました。");
      router.push("/teacher/dashboard/course");
    } catch (err) {
      alert("削除に失敗しました: " + err.message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!course) return <p>Course not found</p>;

  return (
    <div className="edit-page-container">
      <div className="edit-card">
        <h2 className="edit-title">コース編集</h2>
        <div className="edit-field">
          <label>コース名</label>
          <input type="text" value={course.name || ""} onChange={(e) => setCourse({ ...course, name: e.target.value })} />
        </div>
        <div className="edit-field">
          <label>月額料金</label>
          <div className="permonth-row">
            <input type="text" value={course.permonth || ""} onChange={(e) => setCourse({ ...course, permonth: e.target.value })} />
            <button type="button" onClick={() => {
              const val = course.permonth || "";
              setCourse((prev) => ({ ...prev, monthlyTemplate: Object.fromEntries(Object.keys(prev.monthlyTemplate || {}).map((k) => [k, val])) }));
            }}>Apply to all months</button>
          </div>
        </div>
        <div className="edit-field monthly-templates">
          <div className="months-grid">
            {Object.keys(course.monthlyTemplate || {}).sort((a, b) => Number(a) - Number(b)).map((m) => (
              <div className="month-row" key={m}>
                <label>{MONTH_LABELS[m] || m}</label>
                <input type="text" value={course.monthlyTemplate[m] || ""} onChange={(e) => setCourse((prev) => ({ ...prev, monthlyTemplate: { ...prev.monthlyTemplate, [m]: e.target.value } }))} />
              </div>
            ))}
          </div>
        </div>
        <div className="edit-field">
          <label>学年</label>
          <select value={course.year || "1st Year"} onChange={(e) => setCourse({ ...course, year: e.target.value })}>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
          </select>
        </div>
        <div className="edit-field">
          <label>学費</label>
          <input type="text" value={course.fee || course.tuition || ""} onChange={(e) => setCourse({ ...course, fee: e.target.value })} />
        </div>
        <div className="edit-actions">
          <button className="save-btn" onClick={handleUpdate}>更新する</button>
          <button className="delete-btn" onClick={handleDelete}>削除する</button>
        </div>
      </div>
    </div>
  );
}
