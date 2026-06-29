"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./review.css";

export default function ReviewPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch pending/needs_review + unverified
        const [res1, res2] = await Promise.all([
          fetch(`/api/payments?statusIn=${encodeURIComponent("審査中,要確認")}&limit=200`),
          fetch(`/api/payments?verified=false&limit=200`),
        ]);
        if (!mounted) return;

        const rows = res1.ok ? await res1.json() : [];
        const extras = res2.ok ? await res2.json() : [];
        const seen = new Set(rows.map((r) => r.paymentId || r.id));
        const all = [...rows, ...extras.filter((p) => !seen.has(p.paymentId || p.id))];
        setPayments(all);
      } catch (e) {
        console.error("Review load error", e);
        setError("読み込みに失敗しました");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return payments
      .filter((p) => {
        if (filter === "pending") return p.status === "審査中";
        if (filter === "needs_review") return p.status === "要確認";
        return true;
      })
      .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0));
  }, [payments, filter]);

  const decide = async (paymentId, decision) => {
    try {
      const res = await fetch("/api/teacher/payments/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, decision }),
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      setPayments((prev) =>
        prev.map((p) =>
          (p.paymentId || p.id) === paymentId
            ? { ...p, status: decision === "approve" ? "承認" : "却下", verified: decision === "approve" }
            : p
        )
      );
    } catch (e) {
      alert(`操作に失敗しました: ${e.message}`);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>支払審査</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {loading && <div>読み込み中…</div>}

      <div style={{ marginBottom: 12 }}>
        <label>フィルター: </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">全て</option>
          <option value="pending">審査中</option>
          <option value="needs_review">要確認</option>
        </select>
      </div>

      {filtered.length === 0 && !loading && <div>対象の支払いがありません。</div>}

      <div>
        {filtered.map((p) => (
          <div key={p.paymentId || p.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div><strong>学生ID:</strong> {p.studentId}</div>
            <div><strong>金額:</strong> ¥{Number(p.amount || 0).toLocaleString()}</div>
            <div><strong>ステータス:</strong> {p.status}</div>
            <div><strong>月:</strong> {p.month || "-"}</div>
            {p.receiptBase64 && (
              <div style={{ marginTop: 8 }}>
                <img src={p.receiptBase64} alt="receipt" style={{ maxWidth: 200, borderRadius: 4 }} />
              </div>
            )}
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={() => decide(p.paymentId || p.id, "approve")} style={{ background: "#57C785", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px" }}>承認</button>
              <button onClick={() => decide(p.paymentId || p.id, "reject")} style={{ background: "#E55", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px" }}>却下</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
