"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import "./page.css";

const BLANK_COURSE = {
  name: "", nameJa: "", nameEn: "", fee: "", permonth: "",
  monthlyTemplate: { "01": "", "02": "", "03": "", "04": "", "05": "", "06": "", "07": "", "08": "", "09": "", "10": "", "11": "", "12": "" },
  year: "1st Year", paymentAcademicYear: new Date().getFullYear(),
};

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState(BLANK_COURSE);
  const [activeYear, setActiveYear] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) setCourses(await res.json());
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    fetchCourses();
    const interval = setInterval(fetchCourses, 10000);
    return () => clearInterval(interval);
  }, []);

  const determineCourseKey = (courseName = "") => {
    const name = courseName.toLowerCase().trim().replace(/\s+/g, "").replace("コース", "").replace("科", "");
    const nameMap = {
      japanese: ["日本語ビジネス", "日本語", "japanese"],
      kokusai: ["国際ビジネス", "国際", "kokusai"],
      it: ["it", "情報技術"],
      web: ["web", "ウェブ"],
      global: ["global", "グローバル"],
    };
    for (const [key, values] of Object.entries(nameMap)) {
      if (values.some((v) => name.includes(v))) return key;
    }
    return name.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  };

  const handleAddCourse = async () => {
    if (!newCourse.name || !newCourse.fee || !newCourse.year) return alert("Please fill all fields");
    const parsedPrice = Number(String(newCourse.permonth || newCourse.fee || "").replace(/[^0-9.-]+/g, "")) || 0;
    const courseKey = determineCourseKey(newCourse.name);

    const cleaned = {};
    for (const [m, v] of Object.entries(newCourse.monthlyTemplate || {})) {
      const parsed = Number(String(v || "").replace(/[^0-9.-]+/g, "")) || 0;
      if (parsed) cleaned[m] = parsed;
    }

    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCourse.name, nameJa: newCourse.nameJa || null, nameEn: newCourse.nameEn || null,
          tuition: Number(String(newCourse.fee || "0").replace(/[^0-9.-]+/g, "")) || 0,
          courseKey, year: newCourse.year, pricePerMonth: parsedPrice,
          monthlyTemplate: Object.keys(cleaned).length > 0 ? cleaned : null,
          paymentAcademicYear: Number(newCourse.paymentAcademicYear) || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewCourse(BLANK_COURSE);
      setIsModalOpen(false);
      fetchCourses();
    } catch (err) {
      alert("コースの保存に失敗しました: " + err.message);
    }
  };

  const handleDeleteCourse = async (code) => {
    if (!confirm("このコースを削除してもよろしいですか？")) return;
    try {
      const res = await fetch("/api/admin/courses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchCourses();
    } catch (err) {
      alert("削除に失敗しました: " + err.message);
    }
  };

  const filteredCourses = activeYear === "All" ? courses : courses.filter((c) => c.year === activeYear);
  const monthLabels = { "01": "January", "02": "February", "03": "March", "04": "April", "05": "May", "06": "June", "07": "July", "08": "August", "09": "September", "10": "October", "11": "November", "12": "December" };

  return (
    <div className="courses-page">
      <header className="courses-header">
        <h2>コース管理</h2>
        <div className="filter-tabs">
          {["All", "1st Year", "2nd Year", "3rd Year"].map((y) => (
            <button key={y} className={activeYear === y ? "active" : ""} onClick={() => setActiveYear(y)}>
              {y === "All" ? "全て" : y === "1st Year" ? "1年生" : y === "2nd Year" ? "2年生" : "3年生"}
            </button>
          ))}
        </div>
        <button className="add-btn" onClick={() => setIsModalOpen(true)}>+コース追加</button>
      </header>

      <div className="table-card">
        <table className="courses-table">
          <thead>
            <tr><th>No</th><th>コース名</th><th>学費</th><th>月額</th><th>学生数</th><th>学年</th><th>操作</th></tr>
          </thead>
          <tbody>
            {filteredCourses.map((c, index) => (
              <tr key={c.code || c.id}>
                <td>{index + 1}</td>
                <td className="course-name">
                  <Link href={`/teacher/dashboard/course/${c.code || c.id}`} className="course-link">
                    {c.nameJa && c.nameEn ? `${c.nameJa} / ${c.nameEn}` : c.name || c.nameJa || c.nameEn || c.courseKey || c.code}
                  </Link>
                </td>
                <td data-hide-mobile="true">{c.tuition ? `¥${Number(c.tuition).toLocaleString()}` : c.fee || "-"}</td>
                <td data-hide-mobile="true">{c.pricePerMonth ? `¥${Number(c.pricePerMonth).toLocaleString()}` : "-"}</td>
                <td>{c.students ?? 0}</td>
                <td className="course-year">{c.year}</td>
                <td>
                  <Link href={`/teacher/dashboard/course/${c.code || c.id}/edit`} className="view-btn">編集</Link>
                  <button className="delete-btn" onClick={() => handleDeleteCourse(c.code || c.id)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="add-modal">
          <div className="modal-content">
            <h3>新しいコースを追加</h3>
            <input type="text" placeholder="コース名" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} />
            <input type="text" placeholder="学費 (例: 900000)" value={newCourse.fee} onChange={(e) => setNewCourse({ ...newCourse, fee: e.target.value })} />
            <div className="permonth-row">
              <input type="text" placeholder="月額 (例: 80000)" value={newCourse.permonth} onChange={(e) => setNewCourse({ ...newCourse, permonth: e.target.value })} />
              <button type="button" className="apply-all-btn" onClick={() => {
                const val = newCourse.permonth || "";
                setNewCourse((prev) => ({ ...prev, monthlyTemplate: Object.fromEntries(Object.keys(prev.monthlyTemplate || {}).map((k) => [k, val])) }));
              }}>全ての月に適用</button>
            </div>
            <div className="monthly-templates">
              <div className="months-grid">
                {Object.keys(newCourse.monthlyTemplate || {}).sort((a, b) => Number(a) - Number(b)).map((m) => (
                  <div className="month-row" key={m}>
                    <label>{monthLabels[m] || m}</label>
                    <input type="text" value={newCourse.monthlyTemplate[m] || ""} onChange={(e) => setNewCourse((prev) => ({ ...prev, monthlyTemplate: { ...prev.monthlyTemplate, [m]: e.target.value } }))} />
                  </div>
                ))}
              </div>
            </div>
            <select value={newCourse.year} onChange={(e) => setNewCourse({ ...newCourse, year: e.target.value })}>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
            </select>
            <div className="payment-academic-year">
              <label>支払学年 (例: 2025)</label>
              <input type="number" placeholder="2025" value={newCourse.paymentAcademicYear} onChange={(e) => setNewCourse({ ...newCourse, paymentAcademicYear: Number(e.target.value) || null })} />
            </div>
            <div className="modal-actions">
              <button onClick={handleAddCourse} className="save-btn">Save</button>
              <button onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
