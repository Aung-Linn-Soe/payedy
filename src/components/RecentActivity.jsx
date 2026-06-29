"use client";
import React, { useEffect, useState } from "react";

export default function RecentActivity({ items = [] }) {
  const [liveItems, setLiveItems] = useState([]);

  useEffect(() => {
    if (items && items.length > 0) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/payments?limit=6&orderBy=createdAt");
        if (!res.ok || !mounted) return;
        const payments = await res.json();
        const mapped = payments.map((p) => {
          const t = p.createdAt ? new Date(p.createdAt) : new Date();
          const time = t.toLocaleString("ja-JP");
          const title = (p.receiptBase64 || p.receiptUrl)
            ? `${p.studentId || "unknown"} がレシートをアップロードしました`
            : `${p.studentId || "unknown"} の支払いが登録されました`;
          const detail = `金額: ¥${Number(p.amount || 0).toLocaleString()}  コース: ${p.course || "-"}`;
          return { title, time, detail };
        });
        setLiveItems(mapped);
      } catch (err) {
        console.error("RecentActivity fetch error:", err);
      }
    })();
    return () => { mounted = false; };
  }, [items]);

  const renderItems = items?.length > 0 ? items : liveItems;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>最近のアクティビティ</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {renderItems.length === 0 ? (
          <div style={{ color: "#6b7280" }}>アクティビティはありません。</div>
        ) : (
          renderItems.map((it, i) => (
            <div key={i} style={{ background: "#fff", padding: 10, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{it.title}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>{it.time}</div>
              </div>
              {it.detail && <div style={{ marginTop: 6, color: "#374151", fontSize: 13 }}>{it.detail}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
