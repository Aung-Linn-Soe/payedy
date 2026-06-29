"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import ReceiptList from "./ReceiptList";
import styles from "./PaymentSchedule.module.css";
import { useSession } from "next-auth/react";

const schedulesCache = new Map();
const CACHE_TTL = 1000 * 60 * 5;

export default function PaymentSchedule({ student, courseInfo, payments = [] }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const currentRole = session?.user?.role;
  const canEditAmounts = currentRole === "teacher" || currentRole === "admin";
  const studentId = student?.studentId;

  const determineScheduleYear = () => {
    const val = courseInfo?.paymentAcademicYear ?? null;
    if (val != null) return Number(val);
    // Fallback: compute current academic year (April start)
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  };

  const fetchAndEnsureSchedules = useCallback(async (targetYear) => {
    if (!studentId) return [];
    const year = targetYear || determineScheduleYear();

    const cacheKey = year ? `${studentId}-${year}` : `${studentId}-noyear`;
    const cached = schedulesCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setSchedules(cached.data);
      return cached.data;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/students/${studentId}/schedules`);
      const existing = res.ok ? await res.json() : [];

      if (!year) {
        const sorted = existing.filter((d) => typeof d.month === "string").sort((a, b) => a.month.localeCompare(b.month));
        schedulesCache.set(cacheKey, { ts: Date.now(), data: sorted });
        setSchedules(sorted);
        return sorted;
      }

      // Ensure months Feb(2)–Oct(10) exist
      const existingMap = new Map(existing.map((d) => [d.month, d]));
      const teacherMonthly = courseInfo?.pricePerMonth != null ? Number(courseInfo.pricePerMonth) : null;
      const monthlyTemplate = courseInfo?.monthlyTemplate || {};
      const total = Number(courseInfo?.totalFee ?? courseInfo?.pricePerMonth) || student?.totalFees || 0;
      const base = Math.floor(total / 9);
      const remainder = total - base * 9;

      const toCreate = [];
      for (let m = 2; m <= 10; m++) {
        const id = `${year}-${String(m).padStart(2, "0")}`;
        if (existingMap.has(id)) continue;
        const mm = String(m).padStart(2, "0");
        let dueAmount = 0;
        if (monthlyTemplate[mm] != null) dueAmount = Number(monthlyTemplate[mm]) || 0;
        else if (teacherMonthly !== null) dueAmount = teacherMonthly;
        else { const extra = remainder > 0 && m - 2 < remainder ? 1 : 0; dueAmount = base + extra; }
        const dueDate = new Date(year, m, 0).toISOString().slice(0, 10);
        toCreate.push({ month: id, dueDate, dueAmount, paidAmount: 0, status: "未払い" });
      }

      if (toCreate.length > 0) {
        await fetch(`/api/students/${studentId}/schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toCreate),
        }).catch((e) => console.warn("schedule create failed:", e));
        toCreate.forEach((d) => existingMap.set(d.month, d));
      }

      const filtered = Array.from(existingMap.values())
        .filter((s) => typeof s.month === "string" && s.month.startsWith(`${year}-`))
        .filter((s) => { const mm = Number((s.month || "").slice(5, 7)); return mm >= 2 && mm <= 10; })
        .sort((a, b) => a.month.localeCompare(b.month));

      schedulesCache.set(cacheKey, { ts: Date.now(), data: filtered });
      setSchedules(filtered);
      return filtered;
    } catch (e) {
      console.warn("fetchAndEnsureSchedules failed:", e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [studentId, courseInfo, student?.totalFees]);

  useEffect(() => {
    if (!studentId) return;
    fetchAndEnsureSchedules();
  }, [studentId, courseInfo?.paymentAcademicYear]);

  // Allocate payments → schedules
  useEffect(() => {
    if (!studentId || !schedules.length) return;

    const paymentEntries = (payments || [])
      .map((p) => ({ ...p, remaining: Number(p.amount) || 0, createdAt: p.createdAt ? new Date(p.createdAt) : new Date() }))
      .sort((a, b) => a.createdAt - b.createdAt);

    const allocation = {};
    for (const s of schedules) {
      const due = Number(s.dueAmount) || 0;
      let allocated = 0;
      const related = [];
      while (due - allocated > 0 && paymentEntries.length > 0) {
        const head = paymentEntries[0];
        if (!head || head.remaining <= 0) { paymentEntries.shift(); continue; }
        const take = Math.min(due - allocated, head.remaining);
        allocated += take;
        head.remaining -= take;
        related.push({ ...head, _appliedAmount: take });
        if (head.remaining <= 0) paymentEntries.shift();
      }
      let status = "未払い";
      if (allocated > 0 && allocated >= due) status = "支払い済み";
      else if (allocated > 0) status = "一部支払い";
      allocation[s.month] = { paid: allocated, status, relatedPayments: related };
    }

    // Persist changed schedules
    const updates = schedules.filter((s) => {
      const mapped = allocation[s.month] || { paid: 0, status: "未払い" };
      return Number(s.paidAmount || 0) !== mapped.paid || s.status !== mapped.status;
    }).map((s) => {
      const mapped = allocation[s.month];
      return { month: s.month, dueDate: s.dueDate, dueAmount: s.dueAmount, paidAmount: mapped.paid, status: mapped.status };
    });

    if (updates.length > 0) {
      fetch(`/api/students/${studentId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch((e) => console.warn("schedule update failed:", e));
    }

    const newSchedules = schedules.map((s) => {
      const mapped = allocation[s.month] || { paid: 0, status: "未払い", relatedPayments: [] };
      return { ...s, paidAmount: mapped.paid, status: mapped.status, relatedPayments: mapped.relatedPayments };
    });

    if (JSON.stringify(schedules) !== JSON.stringify(newSchedules)) setSchedules(newSchedules);
  }, [payments, schedules]);

  const onDueChange = async (monthId, value) => {
    if (!canEditAmounts) return;
    const num = Math.max(0, Math.round(Number(value) || 0));
    try {
      const s = schedules.find((x) => x.month === monthId);
      if (!s) return;
      await fetch(`/api/students/${studentId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ month: monthId, dueDate: s.dueDate || "", dueAmount: num, paidAmount: s.paidAmount || 0, status: s.status || "未払い" }]),
      });
      setSchedules((prev) => prev.map((x) => (x.month === monthId ? { ...x, dueAmount: num } : x)));
      schedulesCache.delete(`${studentId}-${determineScheduleYear()}`);
    } catch (e) {
      console.warn("Failed to update dueAmount:", e);
    }
  };

  const toJaMonth = (monthStr) => {
    if (!monthStr) return monthStr;
    const [y, m] = monthStr.split("-");
    return `${y}年 ${Number(m)}月`;
  };

  const toJaDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString("ja-JP");
  };

  const getDisplayAmount = (s) => {
    const mm = String(s.month || "").slice(5, 7);
    const tmpl = courseInfo?.monthlyTemplate || {};
    return tmpl[mm] != null ? Number(tmpl[mm]) : Number(s.dueAmount) || 0;
  };

  const paidCount = schedules.filter((s) => s.status === "支払い済み").length;
  const totalCount = schedules.length;

  return (
    <section>
      {loading && <div className={styles.loading}>スケジュールを読み込んでいます…</div>}

      <div className={styles.scheduleHeader}>
        <div className={styles.yearLabel}>{determineScheduleYear() ?? "-"}年度 支払いスケジュール</div>
        <div className={styles.scheduleProgress}>{paidCount} / {totalCount} ヶ月完了</div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>支払い月</th>
              <th>期限</th>
              <th className={styles.thRight}>月額</th>
              <th className={styles.thCenter}>状態</th>
              <th>領収書</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.month} className={styles.rowBorder}>
                <td className={styles.td}>{toJaMonth(s.month)}</td>
                <td className={styles.td}>{toJaDate(s.dueDate)}</td>
                <td className={styles.tdRight}>
                  {canEditAmounts ? (
                    <input
                      type="number"
                      defaultValue={getDisplayAmount(s)}
                      onBlur={(e) => onDueChange(s.month, e.target.value)}
                      className={styles.inputAmount}
                    />
                  ) : (
                    <span className={styles.amountText}>¥{getDisplayAmount(s).toLocaleString()}</span>
                  )}
                </td>
                <td className={styles.tdCenter}>
                  <span className={`${styles.statusText} ${s.status === "支払い済み" ? styles.paid : s.status === "一部支払い" ? styles.partial : styles.unpaid}`}>
                    {s.status}
                  </span>
                </td>
                <td><ReceiptList payments={s.relatedPayments || []} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
