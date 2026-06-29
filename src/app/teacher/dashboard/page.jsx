"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import "./page.css";

import Link from "next/link";
import StatCard from "@/components/StatCard";
import RecentActivity from "@/components/RecentActivity";

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const user = session?.user;

  const [courseCount, setCourseCount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentLimit, setRecentLimit] = useState(3);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/courses");
        if (res.ok) {
          const courses = await res.json();
          setCourseCount(courses.length);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const paidStatuses = ["支払い済み", "paid", "completed"].map(encodeURIComponent).join(",");
        const res = await fetch(`/api/payments?limit=500`);
        if (res.ok) {
          const payments = await res.json();
          const paidSet = new Set(["支払い済み", "paid", "completed"]);
          const sum = payments.reduce((acc, p) => {
            if (!paidSet.has(p.status)) return acc;
            return acc + (Number(p.amount) || 0);
          }, 0);
          setTotalPaid(sum);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const fetchRecent = async () => {
    try {
      const res = await fetch(`/api/payments?limit=${recentLimit}&orderBy=createdAt`);
      if (res.ok) setRecentPayments(await res.json());
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 10000);
    return () => clearInterval(interval);
  }, [recentLimit]);

  const stats = [
    {
      title: "コース数",
      value: courseCount,
      color: "#4F9DDE",
      link: "/teacher/dashboard/course",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect width="20" height="14" x="2" y="5" rx="2" fill="#4F9DDE" />
          <path d="M6 9h12" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "支払金",
      value: `¥${totalPaid.toLocaleString()}`,
      color: "#57C785",
      link: "/teacher/dashboard/payment",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="2" y="6" width="20" height="12" rx="2" fill="#57C785" />
          <path d="M7 12h10" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8.5" cy="12" r="0.8" fill="#fff" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>学費管理システム・{user?.isAdmin ? "管理者用" : "教師用"}</h1>
          <div style={{ color: "#666", marginTop: 6 }}>ようこそ、{user?.name || "先生"} さん</div>
        </div>
      </header>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <Link key={index} href={stat.link} className="stat-card link-card">
            <StatCard title={stat.title} value={stat.value} color={stat.color} icon={stat.icon} />
          </Link>
        ))}
      </div>

      <aside>
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>クイックアクション</h3>
        </div>
        <div className="card">
          <RecentActivity
            items={recentPayments.map((p) => {
              const t = p.createdAt ? new Date(p.createdAt) : new Date();
              const time = t.toLocaleString("ja-JP");
              const title = (p.receiptBase64 || p.receiptUrl)
                ? `${p.studentId || "unknown"} がレシートをアップロードしました`
                : `${p.studentId || "unknown"} の支払いが登録されました`;
              const detail = `金額: ¥${Number(p.amount || 0).toLocaleString()}  コース: ${p.course || "-"}`;
              return { title, time, detail };
            })}
          />
          <div style={{ marginTop: 8, display: "flex", alignItems: "center" }}>
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() => setRecentLimit((prev) => (prev === 3 ? 20 : 3))}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}
              >
                {recentLimit === 3 ? "もっと見る" : "閉じる"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
