import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/payments?studentId=xxx&status=xxx&limit=N&orderBy=createdAt
export async function GET(req) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  const status = url.searchParams.get("status");
  const statusIn = url.searchParams.get("statusIn"); // comma-separated
  const verified = url.searchParams.get("verified");
  const limitN = parseInt(url.searchParams.get("limit") || "200");
  const orderBy = url.searchParams.get("orderBy") || "createdAt";

  const where = {};
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  if (statusIn) where.status = { in: statusIn.split(",") };
  if (verified !== null && verified !== undefined && verified !== "") {
    where.verified = verified === "true";
  }

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { [orderBy]: "desc" },
    take: limitN,
  });

  // Serialize dates as ISO strings for client compatibility
  const serialized = payments.map((p) => ({
    ...p,
    createdAt: p.createdAt?.toISOString(),
    updatedAt: p.updatedAt?.toISOString(),
    uploadedAt: p.uploadedAt?.toISOString(),
    approvedAt: p.approvedAt?.toISOString() || null,
    rejectedAt: p.rejectedAt?.toISOString() || null,
  }));

  return NextResponse.json(serialized);
}

// POST /api/payments — create a new payment record
export async function POST(req) {
  try {
    const body = await req.json();
    const { studentId, course, receiptBase64, amount, paymentMethod, month } = body;
    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    const payment = await prisma.payment.create({
      data: {
        studentId,
        course: course || "",
        receiptBase64: receiptBase64 || null,
        amount: Number(amount) || 0,
        paymentMethod: paymentMethod || "銀行振込",
        status: "確認中",
        month: month || "",
        verified: false,
      },
    });

    const serialized = {
      ...payment,
      createdAt: payment.createdAt?.toISOString(),
      updatedAt: payment.updatedAt?.toISOString(),
      uploadedAt: payment.uploadedAt?.toISOString(),
    };

    return NextResponse.json(serialized, { status: 201 });
  } catch (e) {
    console.error("POST /api/payments error:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
