"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getScheduleMonths, getMonthlyDue, allocatePayments } from "@/lib/paymentAllocation";
import "./page.css";

const YEAR_LABELS = { "1st Year": "1年", "2nd Year": "2年", "3rd Year": "3年", "4th Year": "4年" };

export default function TeacherPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthlyTotals, setMonthlyTotals] = useState(new Array(12).fill(0));
  const [studentMap, setStudentMap] = useState({});
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [courses, setCourses] = useState([]);
  const [courseYearRows, setCourseYearRows] = useState([]);
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/payments?limit=500&orderBy=createdAt");
        if (!mounted) return;
        if (res.ok) setPayments(await res.json());
      } catch (err) {
        console.error("Payments fetch error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load students for course fallback mapping
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const users = await res.json();
          const map = {};
          users.forEach((u) => { map[String(u.studentId)] = u; });
          setStudentMap(map);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // Load courses for per-course/year fee lookup
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/courses");
        if (res.ok) setCourses(await res.json());
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // One row per course+year (so a newly-created course shows up immediately,
  // even before any student is enrolled in it), with expected total (fee ×
  // students) vs. verified paid total for whichever students are enrolled.
  useEffect(() => {
    if (!courses.length) return;

    const studentIdsByGroup = {};
    for (const u of Object.values(studentMap)) {
      if (!u.courseKey) continue;
      const key = `${u.courseKey}::${u.gradeEN || ""}`;
      (studentIdsByGroup[key] ||= []).push(String(u.studentId));
    }

    const paidByStudent = {};
    for (const p of payments) {
      if (!p.verified) continue;
      const sid = String(p.studentId || "");
      paidByStudent[sid] = (paidByStudent[sid] || 0) + (Number(p.amount) || 0);
    }

    const rows = courses.map((course) => {
      const key = `${course.courseKey}::${course.year}`;
      const studentIds = studentIdsByGroup[key] || [];
      const feePerStudent = Number(course.tuition) || Number(course.fee) || 0;
      const studentCount = studentIds.length;
      const expectedTotal = feePerStudent * studentCount;
      const paidTotal = studentIds.reduce((s, sid) => s + (paidByStudent[sid] || 0), 0);
      return {
        key,
        courseName: course.name,
        yearLabel: YEAR_LABELS[course.year] || course.year || "-",
        studentCount,
        expectedTotal,
        paidTotal,
        remaining: Math.max(expectedTotal - paidTotal, 0),
      };
    }).sort((a, b) => a.courseName.localeCompare(b.courseName, "ja") || a.yearLabel.localeCompare(b.yearLabel, "ja"));

    setCourseYearRows(rows);
  }, [studentMap, courses, payments]);

  // Compute monthly totals using the same allocation engine as the admin
  // stats page: a payment fills its target month first, and any amount
  // beyond that month's due spills forward onto later schedule months —
  // instead of piling a whole lump-sum payment onto a single bar.
  useEffect(() => {
    try {
      const months = new Array(12).fill(0);
      if (!courses.length) { setMonthlyTotals(months); return; }

      const paymentsByStudent = {};
      for (const p of payments) {
        if (!p.verified) continue;
        const sid = String(p.studentId || "");
        (paymentsByStudent[sid] ||= []).push(p);
      }

      for (const u of Object.values(studentMap)) {
        if (!u.courseKey) continue;
        const key = `${u.courseKey}::${u.gradeEN || ""}`;
        if (selectedCourse !== "all" && selectedCourse !== key) continue;

        const course = courses.find((c) => c.courseKey === u.courseKey && c.year === u.gradeEN);
        if (!course) continue;

        const year = course.paymentAcademicYear || new Date().getFullYear();
        const courseInfo = {
          pricePerMonth: course.pricePerMonth ? Number(course.pricePerMonth) : null,
          totalFee: Number(course.fee) || Number(course.tuition) || null,
          monthlyTemplate: course.monthlyTemplate || {},
        };
        const scheduleMonths = getScheduleMonths(courseInfo, year);
        const monthlyDueFn = (monthId) => getMonthlyDue(monthId, courseInfo);
        const studentPayments = paymentsByStudent[String(u.studentId)] || [];
        const allocated = allocatePayments(studentPayments, scheduleMonths, monthlyDueFn);

        for (const m of scheduleMonths) {
          const mm = Number(m.slice(5, 7));
          if (mm >= 1 && mm <= 12) months[mm - 1] += allocated[m]?.paid || 0;
        }
      }

      setMonthlyTotals(months);
    } catch (err) {
      console.error("Failed to compute monthly totals:", err);
    }
  }, [payments, selectedCourse, studentMap, courses]);

  const handleDeletePayment = async (paymentId) => {
    if (!paymentId || !confirm("この支払い履歴を削除してもよろしいですか？")) return;
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setPayments((prev) => prev.filter((p) => (p.paymentId || p.id) !== paymentId));
    } catch (err) {
      alert("削除に失敗しました。");
    }
  };

  const monthLabels = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const rawMax = Math.max(...monthlyTotals);
  const monthMax = rawMax || 1;
  const maxIdx = rawMax > 0 ? monthlyTotals.indexOf(rawMax) : -1;

  return (
    <main className="paymentPage">
      <h1 className="pageTitle">支払金 - 全ての支払い</h1>
      {loading && <div className="loading">読み込み中…</div>}

      <section className="chartSection">
        <h2 className="sectionTitle">コース別・学年別 支払い状況</h2>
        {courseYearRows.length === 0 ? (
          <div className="muted">集計中...</div>
        ) : (
          <div className="courseYearTableWrap">
            <table className="courseYearTable">
              <thead>
                <tr>
                  <th>コース</th>
                  <th>学年</th>
                  <th>人数</th>
                  <th>予定金額</th>
                  <th>入金済み</th>
                  <th>残額</th>
                </tr>
              </thead>
              <tbody>
                {courseYearRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.courseName}</td>
                    <td>{r.yearLabel}</td>
                    <td>{r.studentCount}</td>
                    <td>¥{r.expectedTotal.toLocaleString()}</td>
                    <td>¥{r.paidTotal.toLocaleString()}</td>
                    <td className={r.remaining > 0 ? "remainingUnpaid" : ""}>¥{r.remaining.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="chartSection">
        <h2 className="sectionTitle">月別支払い合計</h2>
        <div className="filterRow">
          <label htmlFor="courseSelect">コース:</label>
          <select id="courseSelect" className="courseSelect" value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
            <option value="all">全てのコース</option>
            {courseYearRows.map((r) => (
              <option key={r.key} value={r.key}>{r.courseName} {r.yearLabel}</option>
            ))}
          </select>
        </div>

        <div className="chartScroll">
          <div className="bars">
            {monthlyTotals.map((amt, i) => {
              const h = Math.round((amt / monthMax) * 140);
              const isMax = i === maxIdx;
              const isHover = hoverIdx === i;
              return (
                <div
                  key={i}
                  className="barCol"
                  tabIndex={0}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  onFocus={() => setHoverIdx(i)}
                  onBlur={() => setHoverIdx(null)}
                >
                  <div className="barStack">
                    {isMax && amt > 0 && <div className="barCapValue">¥{Number(amt).toLocaleString()}</div>}
                    <div className={`bar ${isMax ? "barMax" : ""} ${isHover ? "barHover" : ""}`} style={{ height: Math.max(4, h) }}>
                      {isHover && !isMax && (
                        <div className="barTooltip" role="tooltip">¥{Number(amt || 0).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  <div className="barMonth">{monthLabels[i]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
