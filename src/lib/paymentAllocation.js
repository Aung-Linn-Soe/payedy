/**
 * Shared payment allocation logic (used by both client and server).
 *
 * Rules:
 *  1. Each payment fills its target month (payment.month) first.
 *  2. Any overflow starts from the month AFTER the payment's approvedAt month
 *     and fills forward through the schedule, wrapping around if needed.
 *  3. Works with any schedule month range (not hardcoded).
 */

/**
 * Returns sorted schedule month IDs (e.g. ["2026-01", ..., "2026-12"])
 * based on courseInfo.monthlyTemplate keys, falling back to Jan-Dec.
 */
export function getScheduleMonths(courseInfo, year) {
  const tmpl = courseInfo?.monthlyTemplate || {};
  const keys = Object.keys(tmpl).filter((k) => /^\d{2}$/.test(k));
  const monthNums =
    keys.length > 0
      ? keys.map(Number).filter((n) => n >= 1 && n <= 12).sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return monthNums.map((m) => `${year}-${String(m).padStart(2, "0")}`);
}

/**
 * Returns the monthly due amount for a given monthId (e.g. "2026-06").
 */
export function getMonthlyDue(monthId, courseInfo) {
  const mm = String(monthId || "").slice(5, 7);
  const tmpl = courseInfo?.monthlyTemplate || {};
  if (tmpl[mm] != null) return Number(tmpl[mm]);
  if (courseInfo?.pricePerMonth) return Number(courseInfo.pricePerMonth);
  const total = Number(courseInfo?.totalFee) || 0;
  return total > 0 ? Math.floor(total / 12) : 0;
}

/**
 * Allocates verified payments to schedule months.
 *
 * @param {Array}    verifiedPayments  - payments with verified=true
 * @param {string[]} scheduleMonths    - sorted month IDs for this academic year
 * @param {Function} monthlyDueFn      - (monthId) => dueAmount
 * @returns {Object} allocated         - { [monthId]: { paid, payments[] } }
 */
export function allocatePayments(verifiedPayments, scheduleMonths, monthlyDueFn) {
  const allocated = {};
  for (const m of scheduleMonths) {
    allocated[m] = { paid: 0, payments: [] };
  }

  // Process payments oldest-first
  const sorted = [...verifiedPayments].sort((a, b) => {
    const da = new Date(a.approvedAt || a.createdAt || 0);
    const db = new Date(b.approvedAt || b.createdAt || 0);
    return da - db;
  });

  for (const pmt of sorted) {
    let remaining = Number(pmt.amount) || 0;
    if (remaining <= 0) continue;

    // ── Step 1: fill target month ──────────────────────────────────────────
    const targetMonth = pmt.month || null;
    if (targetMonth && allocated[targetMonth] !== undefined) {
      const due = monthlyDueFn(targetMonth);
      const canPay = Math.max(due - allocated[targetMonth].paid, 0);
      const take = Math.min(canPay, remaining);
      if (take > 0) {
        allocated[targetMonth].paid += take;
        allocated[targetMonth].payments.push({ ...pmt, _appliedAmount: take });
        remaining -= take;
      }
    }

    // ── Step 2: overflow → forward from (approvedAt month + 1) ────────────
    if (remaining > 0) {
      const baseDate = pmt.approvedAt || pmt.createdAt;
      const baseMonth = baseDate
        ? new Date(baseDate).toISOString().slice(0, 7)
        : scheduleMonths[0] || "";

      // First schedule month strictly after baseMonth
      let startIdx = scheduleMonths.findIndex((m) => m > baseMonth);
      if (startIdx === -1) startIdx = 0; // wrap: all months are ≤ baseMonth

      const n = scheduleMonths.length;
      for (let i = 0; i < n && remaining > 0; i++) {
        const m = scheduleMonths[(startIdx + i) % n];
        if (m === targetMonth) continue; // already handled
        const due = monthlyDueFn(m);
        const canPay = Math.max(due - allocated[m].paid, 0);
        const take = Math.min(canPay, remaining);
        if (take > 0) {
          allocated[m].paid += take;
          allocated[m].payments.push({ ...pmt, _appliedAmount: take });
          remaining -= take;
        }
      }
    }
  }

  return allocated;
}

/**
 * Returns "支払い済み" | "一部支払い" | "未払い"
 */
export function getMonthStatus(paid, due) {
  if (due <= 0) return "未払い";
  if (paid >= due) return "支払い済み";
  if (paid > 0) return "一部支払い";
  return "未払い";
}
