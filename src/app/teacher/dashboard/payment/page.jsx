"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./page.css";

export default function TeacherPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseTotals, setCourseTotals] = useState({});
  const [monthlyTotals, setMonthlyTotals] = useState(new Array(12).fill(0));
  const [studentMap, setStudentMap] = useState({});
  const [selectedCourse, setSelectedCourse] = useState("all");

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

  // Aggregate course totals
  useEffect(() => {
    const totals = {};
    for (const p of payments) {
      const sid = String(p.studentId || "");
      const courseKey = p.course || (studentMap[sid]?.courseId) || "unknown";
      const amt = Number(p.amount) || 0;
      totals[courseKey] = (totals[courseKey] || 0) + amt;
    }
    setCourseTotals(totals);
  }, [payments, studentMap]);

  // Compute monthly totals
  useEffect(() => {
    try {
      const months = new Array(12).fill(0);
      for (const p of payments) {
        const date = p.createdAt ? new Date(p.createdAt) : new Date();
        const m = date.getMonth();
        const amt = Number(p.amount) || 0;
        const sid = String(p.studentId || "");
        const courseKey = p.course || (studentMap[sid]?.courseId) || "unknown";
        if (selectedCourse === "all" || selectedCourse === courseKey) {
          months[m] = (months[m] || 0) + amt;
        }
      }
      setMonthlyTotals(months);
    } catch (err) {
      console.error("Failed to compute monthly totals:", err);
    }
  }, [payments, selectedCourse, studentMap]);

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
  const monthMax = Math.max(...monthlyTotals) || 1;

  return (
    <main className="paymentPage">
      <h1 className="pageTitle">支払金 - 全ての支払い</h1>
      {loading && <div className="loading">読み込み中…</div>}

      <div className="statsRow">
        {Object.keys(courseTotals).length === 0 ? (
          <div className="muted">集計中...</div>
        ) : (
          Object.entries(courseTotals).map(([courseKey, amt]) => (
            <div key={courseKey} className="statCard">
              <div className="statLabel">{courseKey} 合計支払額</div>
              <div className="statValue">¥{Number(amt || 0).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>

      <section className="chartSection">
        <h2 className="sectionTitle">月別支払い合計</h2>
        <div className="filterRow">
          <label htmlFor="courseSelect">コース:</label>
          <select id="courseSelect" className="courseSelect" value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
            <option value="all">全てのコース</option>
            {Object.keys(courseTotals).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="chartScroll">
          <div className="bars">
            {monthlyTotals.map((amt, i) => {
              const h = Math.round((amt / monthMax) * 140);
              return (
                <div key={i} className="barCol">
                  <div title={`¥${Number(amt || 0).toLocaleString()}`} className={`bar ${amt === monthMax && monthMax > 0 ? "barMax" : ""}`} style={{ height: Math.max(6, h) }} />
                  <div className="barMonth">{monthLabels[i]}</div>
                  <div className="barAmt">¥{Number(amt || 0).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
