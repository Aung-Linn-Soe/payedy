import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getScheduleMonths,
  getMonthlyDue,
  allocatePayments,
} from "@/lib/paymentAllocation";

// GET /api/admin/stats?month=2026-06
// Returns students who haven't fully paid for the selected month.
// Uses the overflow rule: excess fills months after approvedAt month, wrapping if needed.
export async function GET(req) {
  const url = new URL(req.url);
  const selectedMonth = url.searchParams.get("month");

  if (!selectedMonth) {
    return NextResponse.json({ students: [], selectedMonth: null });
  }

  const [year, monthStr] = selectedMonth.split("-");
  const monthNum = Number(monthStr);

  if (monthNum < 2 || monthNum > 10) {
    return NextResponse.json({ students: [], selectedMonth });
  }

  const [students, courses, verifiedPayments] = await Promise.all([
    prisma.student.findMany(),
    prisma.course.findMany(),
    prisma.payment.findMany({
      where: { verified: true },
      select: { studentId: true, amount: true, month: true, approvedAt: true, createdAt: true },
    }),
  ]);

  const courseMap = new Map(courses.map((c) => [c.code, c]));

  // Group payments by student
  const paymentsByStudent = {};
  for (const p of verifiedPayments) {
    if (!paymentsByStudent[p.studentId]) paymentsByStudent[p.studentId] = [];
    paymentsByStudent[p.studentId].push(p);
  }

  const result = [];

  for (const student of students) {
    const course =
      courseMap.get(student.courseId) ||
      courses.find((c) => c.courseKey === student.courseKey && c.year === student.gradeEN) ||
      null;

    // Only include students whose course is active for the selected year
    if (!course || Number(course.paymentAcademicYear) !== Number(year)) continue;

    const courseInfo = {
      pricePerMonth: course.pricePerMonth ? Number(course.pricePerMonth) : null,
      totalFee: Number(course.fee) || Number(course.tuition) || null,
      monthlyTemplate: course.monthlyTemplate || {},
    };

    const scheduleMonths = getScheduleMonths(courseInfo, year);
    if (!scheduleMonths.includes(selectedMonth)) continue;

    const monthlyDueFn = (monthId) => getMonthlyDue(monthId, courseInfo);
    const monthlyDue = monthlyDueFn(selectedMonth);
    if (monthlyDue <= 0) continue;

    const studentPayments = paymentsByStudent[student.studentId] || [];
    const allocated = allocatePayments(studentPayments, scheduleMonths, monthlyDueFn);

    const paidForSelected = (allocated[selectedMonth] || { paid: 0 }).paid;
    if (paidForSelected >= monthlyDue) continue; // fully paid — skip

    // Collect unpaid months from Feb up to selectedMonth
    const unpaidMonths = [];
    for (const m of scheduleMonths) {
      if (m > selectedMonth) break;
      const due = monthlyDueFn(m);
      if (due <= 0) continue;
      const paid = (allocated[m] || { paid: 0 }).paid;
      if (paid < due) unpaidMonths.push(`${Number(m.slice(5, 7))}月`);
    }

    const totalFee = Number(course.fee) || Number(course.tuition) || 0;
    const totalPaid = studentPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalRemaining = Math.max(totalFee - totalPaid, 0);

    result.push({
      studentId: student.studentId,
      name: student.name || "",
      courseName: course.name || student.courseId || "",
      grade: student.gradeJP || student.grade || "",
      unpaidMonths,
      totalFee,
      totalPaid,
      totalRemaining,
    });
  }

  return NextResponse.json({ students: result, selectedMonth });
}
