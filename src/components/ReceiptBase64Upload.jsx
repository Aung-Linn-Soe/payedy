"use client";

import React, { useState, useEffect, useCallback } from "react";
import Img from "next/image";

export default function ReceiptBase64Upload({ studentId, initialMonth }) {
  const [file, setFile] = useState(null);
  const [base64, setBase64] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(initialMonth || "");
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");

  const fetchPayments = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/payments?studentId=${studentId}&orderBy=createdAt&limit=50`);
      if (res.ok) setPayments(await res.json());
    } catch (e) { /* ignore */ }
  }, [studentId]);

  useEffect(() => {
    fetchPayments();
    const interval = setInterval(fetchPayments, 10000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  const toBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(f);
  });

  const handleFileChange = async (e) => {
    setError("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("画像ファイルを選択してください"); return; }
    setFile(f);
    try { setBase64(await toBase64(f)); } catch { setError("画像の読み込みに失敗しました"); }
  };

  const handleSave = async () => {
    if (!studentId) { setError("studentId が必要です"); return; }
    const numAmount = Number(amount || 0);
    if (!numAmount || numAmount <= 0) { setError("有効な金額を入力してください"); return; }
    if (!base64) { setError("画像を選択してください"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, amount: numAmount, month: month || new Date().toISOString().slice(0, 7), status: "未払い", receiptBase64: base64 }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      const saved = await res.json();
      setFile(null); setBase64(""); setAmount(""); setMonth(initialMonth || "");
      setPayments((prev) => [saved, ...prev]);
    } catch (err) { setError(err.message || "保存に失敗しました"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ border: "1px dashed #ddd", padding: 12, borderRadius: 6, maxWidth: 720 }}>
      <h4>レシート（Base64）アップロード</h4>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label>金額:<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ marginLeft: 6 }} /></label>
        <label>支払い月:<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ marginLeft: 6 }} /></label>
        <label>画像:<input type="file" accept="image/*" onChange={handleFileChange} style={{ marginLeft: 6 }} /></label>
        <button onClick={handleSave} disabled={saving} style={{ marginLeft: 6 }}>{saving ? "保存中..." : "保存（Base64で保存）"}</button>
      </div>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 12 }}>
        <strong>プレビュー</strong>
        <div style={{ marginTop: 8 }}>
          {base64 ? <Img src={base64} alt="preview" width={400} height={300} style={{ maxWidth: "100%", height: "auto" }} unoptimized /> : <div style={{ color: "#666" }}>画像を選択するとここにプレビューされます</div>}
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <strong>保存済みレシート（この学生）</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 12, marginTop: 10 }}>
          {payments.length === 0 && <div style={{ color: "#666" }}>まだレシートがありません</div>}
          {payments.map((p) => (
            <div key={p.paymentId || p.id} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#333" }}>金額: ¥{Number(p.amount).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: "#666" }}>月: {p.month}</div>
              <div style={{ marginTop: 8 }}>
                {p.receiptBase64 ? <Img src={p.receiptBase64} alt={`receipt`} width={200} height={150} style={{ width: "100%", height: "auto" }} unoptimized /> : <div style={{ color: "#999" }}>画像なし</div>}
              </div>
              <div style={{ marginTop: 6, fontSize: 12 }}>状態: {p.status || "-"} {p.verified ? "(承認済み)" : ""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
