import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const role = session?.user?.role;
    const isAdmin = session?.user?.isAdmin;
    if (!isAdmin && role !== "teacher") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, fromYear } = body || {};
    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    const y1 = fromYear ? Number(fromYear) : new Date().getFullYear() - 1;
    const y2 = y1 + 1;

    const allSchedules = await prisma.paymentSchedule.findMany({
      where: { studentId },
    });

    const year1Docs = allSchedules.filter(
      (d) => typeof d.month === "string" && d.month.startsWith(`${y1}-`)
    );
    const year2Docs = allSchedules.filter(
      (d) => typeof d.month === "string" && d.month.startsWith(`${y2}-`)
    );

    const totalDueYear1 = year1Docs.reduce((s, d) => s + (Number(d.dueAmount) || 0), 0);
    const totalPaidYear1 = year1Docs.reduce((s, d) => s + (Number(d.paidAmount) || 0), 0);
    const remainingYear1 = Math.max(totalDueYear1 - totalPaidYear1, 0);
    if (remainingYear1 <= 0) {
      return NextResponse.json({ migrated: false, reason: "no remaining balance for fromYear" });
    }

    const existingTotalYear2 = year2Docs.reduce((s, d) => s + (Number(d.dueAmount) || 0), 0);
    const newTotalYear2 = existingTotalYear2 + remainingYear1;

    // Fetch course template if available
    let monthlyTemplate = {};
    let pricePerMonth = null;
    try {
      const student = await prisma.student.findUnique({ where: { studentId } });
      if (student?.courseDocId) {
        const course = await prisma.course.findFirst({
          where: { code: student.courseDocId },
        });
        if (course) {
          monthlyTemplate = course.monthlyTemplate || {};
          pricePerMonth = course.pricePerMonth || null;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch course template:", e);
    }

    const months = [];
    for (let m = 1; m <= 12; m++) months.push(String(m).padStart(2, "0"));

    const templateVals = months.map((mm) => Number(monthlyTemplate[mm] || 0));
    const templateSum = templateVals.reduce((s, v) => s + v, 0);

    const desiredPerMonth = {};
    if (templateSum > 0) {
      let adjustment = newTotalYear2 - templateSum;
      const baseAdd = Math.floor(adjustment / months.length);
      let rem = adjustment - baseAdd * months.length;
      for (const mm of months) {
        const base = Number(monthlyTemplate[mm] || 0);
        let add = baseAdd;
        if (rem > 0) { add += 1; rem -= 1; }
        desiredPerMonth[mm] = Math.max(0, base + add);
      }
    } else if (pricePerMonth != null) {
      const base = Math.round(Number(pricePerMonth) || 0);
      const baseSum = base * months.length;
      let adjustment = newTotalYear2 - baseSum;
      const baseAdd = Math.floor(adjustment / months.length);
      let rem = adjustment - baseAdd * months.length;
      for (const mm of months) {
        let val = base + baseAdd;
        if (rem > 0) { val += 1; rem -= 1; }
        desiredPerMonth[mm] = Math.max(0, val);
      }
    } else {
      const base = Math.floor(newTotalYear2 / months.length);
      let rem = newTotalYear2 - base * months.length;
      for (const mm of months) {
        let val = base;
        if (rem > 0) { val += 1; rem -= 1; }
        desiredPerMonth[mm] = Math.max(0, val);
      }
    }

    // Batch upsert payment schedules
    await Promise.all(
      months.map(async (mm) => {
        const id = `${y2}-${mm}`;
        const due = desiredPerMonth[mm] || 0;
        const existing = year2Docs.find((d) => d.month === id);
        const paid = Number(existing?.paidAmount || 0);
        let status = "未払い";
        if (paid <= 0) status = "未払い";
        else if (paid >= due) status = "支払い済み";
        else status = "一部支払い";

        const dueDate = new Date(y2, Number(mm), 0).toISOString().slice(0, 10);

        await prisma.paymentSchedule.upsert({
          where: { studentId_month: { studentId, month: id } },
          update: { dueDate, dueAmount: due, paidAmount: paid, status },
          create: { studentId, month: id, dueDate, dueAmount: due, paidAmount: paid, status },
        });
      })
    );

    return NextResponse.json({ migrated: true, addedAmount: remainingYear1, newTotalYear2 });
  } catch (err) {
    console.error("/api/admin/migrate-year error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
