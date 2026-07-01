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
          renderItems.map((it, i) => {
            const isApproved = it.verified === true;
            const isRejected = it.status === "却下";
            const isPending = !isApproved && !isRejected;
            const badge = isApproved
              ? { label: "支払い済み", bg: "#dcfce7", color: "#16a34a" }
              : isRejected
              ? { label: "却下", bg: "#fee2e2", color: "#dc2626" }
              : it.status
              ? { label: "確認中", bg: "#fef9c3", color: "#ca8a04" }
              : null;
            return (
              <div key={i} style={{ background: "#fff", padding: 10, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `3px solid ${isApproved ? "#16a34a" : isRejected ? "#dc2626" : isPending && it.status ? "#ca8a04" : "#e5e7eb"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 600 }}>{it.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {badge && (
                      <span style={{ background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>
                        {badge.label}
                      </span>
                    )}
                    <div style={{ color: "#6b7280", fontSize: 12 }}>{it.time}</div>
                  </div>
                </div>
                {it.detail && <div style={{ marginTop: 6, color: "#374151", fontSize: 13 }}>{it.detail}</div>}
                {isRejected && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 6, padding: "5px 10px" }}>
                    <span style={{ color: "#dc2626", fontSize: 14, fontWeight: 700 }}>⚠</span>
                    <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 600 }}>
                      却下理由: {it.rejectReason || "理由なし"}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
