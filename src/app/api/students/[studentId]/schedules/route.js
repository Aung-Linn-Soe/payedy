import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/students/[studentId]/schedules
export async function GET(req, { params }) {
  const { studentId } = await params;
  const schedules = await prisma.paymentSchedule.findMany({
    where: { studentId },
    orderBy: { month: "asc" },
  });
  return NextResponse.json(schedules);
}

// POST /api/students/[studentId]/schedules — upsert one or many schedules
export async function POST(req, { params }) {
  const { studentId } = await params;
  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];

    const results = await Promise.all(
      items.map((item) =>
        prisma.paymentSchedule.upsert({
          where: { studentId_month: { studentId, month: item.month } },
          update: {
            dueDate: item.dueDate || "",
            dueAmount: Number(item.dueAmount) || 0,
            paidAmount: Number(item.paidAmount) || 0,
            status: item.status || "未払い",
          },
          create: {
            studentId,
            month: item.month,
            dueDate: item.dueDate || "",
            dueAmount: Number(item.dueAmount) || 0,
            paidAmount: Number(item.paidAmount) || 0,
            status: item.status || "未払い",
          },
        })
      )
    );
    return NextResponse.json(results);
  } catch (e) {
    console.error("POST schedules error:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
