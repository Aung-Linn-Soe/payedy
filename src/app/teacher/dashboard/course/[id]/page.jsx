"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import "./detail.css";

function toSafeNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = Number(String(v).trim().replace(/[^0-9.-]+/g, ""));
  return isFinite(n) ? n : 0;
}

export default function CourseDetailPage() {
  const { id } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [allUsers, setAllUsers] = useState([]);
  const [paymentsMap, setPaymentsMap] = useState({});
  const [courseDocInfo, setCourseDocInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter students: match by courseId OR by courseKey+gradeEN (fallback for old/reset records)
  const students = useMemo(() => {
    return allUsers.filter((s) => {
      if (s.courseId === id) return true;
      if (
        courseDocInfo?.courseKey &&
        s.courseKey === courseDocInfo.courseKey &&
        s.gradeEN === courseDocInfo.year
      ) return true;
      return false;
    });
  }, [allUsers, id, courseDocInfo]);

  // Fetch course info
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/courses?code=${encodeURIComponent(id)}`);
        if (res.ok) {
          const list = await res.json();
          if (list.length) setCourseDocInfo(list[0]);
        }
      } catch (e) { /* ignore */ }
    })();
  }, [id]);

  // Fetch all users (filtering is handled by useMemo above)
  const fetchStudents = async () => {
    if (!id) return;
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const all = await res.json();
      setAllUsers(all);
    } catch (e) {
      console.error("fetchStudents error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    const interval = setInterval(fetchStudents, 10000);
    return () => clearInterval(interval);
  }, [id]);

  // Fetch verified payments for each student
  useEffect(() => {
    if (!students.length) return;
    (async () => {
      const pMap = {};
      await Promise.all(
        students.map(async (s) => {
          const sid = s.studentId || s.id;
          try {
            const pRes = await fetch(`/api/payments?studentId=${sid}&limit=200`);
            const payments = pRes.ok ? await pRes.json() : [];
            const verifiedPayments = payments.filter((p) => p.verified === true);
            const totalPaid = verifiedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            pMap[String(sid)] = { totalPaid, count: verifiedPayments.length };
          } catch (e) { /* ignore */ }
        })
      );
      setPaymentsMap(pMap);
    })();
  }, [students]);

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("この学生を削除しますか？")) return;
    try {
      await fetch(`/api/students/${studentId}`, { method: "DELETE" });
      fetchStudents();
    } catch (err) {
      alert("削除に失敗しました。");
    }
  };

  const rowsWithRates = students.map((s) => {
    const sid = s.studentId || s.id;
    const pm = paymentsMap[String(sid)] || { totalPaid: 0, count: 0 };
    const courseFee = toSafeNumber(courseDocInfo?.fee || courseDocInfo?.tuition || 0);
    const totalFeeVal = courseFee > 0 ? courseFee : toSafeNumber(Number(courseDocInfo?.pricePerMonth) * 9 || 0);
    // Use only verified payment totals (never stale student.paidAmount)
    const paidVal = toSafeNumber(pm.totalPaid);
    const discountVal = toSafeNumber(s.discount || 0);
    const discounted = Math.max(totalFeeVal - discountVal, 0);
    const divisor = discounted > 0 ? discounted : totalFeeVal;
    const paymentRate = divisor > 0 ? Math.min(100, Math.max(0, (paidVal / divisor) * 100)) : 0;
    return { s, pm, totalFeeVal, paidVal, paymentRate: Number(paymentRate.toFixed(1)) };
  });

  const displayedRows = rowsWithRates.filter((r) => {
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      const match = (r.s.email || "").toLowerCase().includes(q) || (r.s.studentId || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter === "paid") return r.paymentRate >= 100;
    if (statusFilter === "unpaid") return r.paymentRate < 100;
    return true;
  });

  const totalCount = rowsWithRates.length;
  const paidCount = rowsWithRates.filter((r) => r.paymentRate >= 100).length;
  const unpaidCount = rowsWithRates.filter((r) => r.paymentRate < 100).length;

  const btnStyle = (active, color) => ({
    padding: "6px 10px", borderRadius: 6,
    background: active ? color : "#f3f4f6",
    color: active ? "#fff" : "#111",
    border: "none", display: "flex", gap: 8, alignItems: "center", cursor: "pointer",
  });
  const badge = { background: "rgba(0,0,0,0.08)", padding: "2px 6px", borderRadius: 999 };

  return (
    <div className="course-detail-page">
      <header className="course-header">
        <h2>コース詳細 - {id}</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input type="text" className="search-input" placeholder="メールまたは学生番号で検索" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button onClick={() => setStatusFilter("all")} style={btnStyle(statusFilter === "all", "#3b82f6")}>
            <span>All</span><span style={badge}>{totalCount}</span>
          </button>
          <button onClick={() => setStatusFilter("paid")} style={btnStyle(statusFilter === "paid", "#10b981")}>
            <span>Paid</span><span style={badge}>{paidCount}</span>
          </button>
          <button onClick={() => setStatusFilter("unpaid")} style={btnStyle(statusFilter === "unpaid", "#ef4444")}>
            <span>Unpaid</span><span style={badge}>{unpaidCount}</span>
          </button>
        </div>
      </header>

      {loading && <div>読み込み中…</div>}

      <table className="students-table">
        <thead>
          <tr>
            <th>学生番号</th><th>名前</th><th>メール</th><th>開始月</th><th>状態</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {displayedRows.length === 0 ? (
            <tr><td colSpan="6" style={{ textAlign: "center" }}>学生データがありません。</td></tr>
          ) : (
            displayedRows.map((r) => {
              const s = r.s;
              const sid = s.studentId || s.id;
              const label = `${r.paymentRate.toFixed(1)}% 支払い済み`;
              const barColor = r.paymentRate >= 100 ? "#10b981" : r.paymentRate > 0 ? "#f59e0b" : "#ef4444";
              return (
                <tr key={sid}>
                  <td data-label="学生番号">
                    <Link href={`/student/dashboard/${sid}`} style={{ color: "#3b82f6" }}>{s.studentId || sid}</Link>
                  </td>
                  <td data-label="名前">{s.name || "-"}</td>
                  <td data-label="メール">{s.email || "-"}</td>
                  <td data-label="開始月">{s.startMonth || "-"}</td>
                  <td data-label="状態">
                    <div>{label}</div>
                    <div style={{ background: "#e5e7eb", borderRadius: 4, height: 6, marginTop: 4, width: 100 }}>
                      <div style={{ background: barColor, width: `${r.paymentRate}%`, height: "100%", borderRadius: 4 }} />
                    </div>
                  </td>
                  <td data-label="操作">
                    <Link href={`/student/dashboard/${sid}`} style={{ marginRight: 8, color: "#3b82f6" }}>詳細</Link>
                    <button onClick={() => handleDeleteStudent(sid)} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>削除</button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
