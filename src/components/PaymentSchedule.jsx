"use client";

import React, { useMemo } from "react";
import ReceiptList from "./ReceiptList";
import styles from "./PaymentSchedule.module.css";
import {
  getScheduleMonths,
  getMonthlyDue,
  allocatePayments,
  getMonthStatus,
} from "@/lib/paymentAllocation";

export default function PaymentSchedule({ student, courseInfo, payments = [] }) {
  const determineScheduleYear = () => {
    const val = courseInfo?.paymentAcademicYear ?? null;
    if (val != null) return Number(val);
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  };

  const year = determineScheduleYear();
  const scheduleMonths = getScheduleMonths(courseInfo, year);
  const monthlyDueFn = (monthId) => getMonthlyDue(monthId, courseInfo);

  const monthData = useMemo(() => {
    const verifiedPayments = (payments || []).filter((p) => p.verified === true);
    const allocated = allocatePayments(verifiedPayments, scheduleMonths, monthlyDueFn);

    return scheduleMonths.map((monthId) => {
      const due = monthlyDueFn(monthId);
      const alloc = allocated[monthId] || { paid: 0, payments: [] };
      const status = getMonthStatus(alloc.paid, due);
      const [y, m] = monthId.split("-");
      const dueDate = new Date(Number(y), Number(m), 0).toLocaleDateString("ja-JP");
      return { month: monthId, due, paid: alloc.paid, status, payments: alloc.payments, dueDate };
    });
  }, [payments, scheduleMonths.join(","), courseInfo?.pricePerMonth, courseInfo?.totalFee, JSON.stringify(courseInfo?.monthlyTemplate)]);

  const paidCount = monthData.filter((m) => m.status === "支払い済み").length;

  const toJaMonth = (monthStr) => {
    const [y, m] = monthStr.split("-");
    return `${y}年 ${Number(m)}月`;
  };

  return (
    <section>
      <div className={styles.scheduleHeader}>
        <div className={styles.yearLabel}>{year ?? "-"}年度 支払いスケジュール</div>
        <div className={styles.scheduleProgress}>
          {paidCount} / {monthData.length} ヶ月完了
        </div>
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
            {monthData.map((s) => (
              <tr key={s.month} className={styles.rowBorder}>
                <td className={styles.td}>{toJaMonth(s.month)}</td>
                <td className={styles.td}>{s.dueDate}</td>
                <td className={styles.tdRight}>
                  <span className={styles.amountText}>¥{s.due.toLocaleString()}</span>
                </td>
                <td className={styles.tdCenter}>
                  <span
                    className={`${styles.statusText} ${
                      s.status === "支払い済み"
                        ? styles.paid
                        : s.status === "一部支払い"
                        ? styles.partial
                        : styles.unpaid
                    }`}
                  >
                    {s.status}
                  </span>
                  {s.status === "一部支払い" && s.paid > 0 && (
                    <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
                      ¥{s.paid.toLocaleString()} 済み
                    </div>
                  )}
                </td>
                <td>
                  <ReceiptList payments={s.payments} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
