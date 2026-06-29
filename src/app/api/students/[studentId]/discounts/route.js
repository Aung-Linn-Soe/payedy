import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/students/[studentId]/discounts
export async function GET(req, { params }) {
  const { studentId } = await params;
  const discounts = await prisma.discount.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(discounts);
}

// POST /api/students/[studentId]/discounts
export async function POST(req, { params }) {
  const { studentId } = await params;
  try {
    const body = await req.json();
    const discount = await prisma.discount.create({
      data: {
        studentId,
        amount: Number(body.amount) || 0,
        reason: body.reason || "",
      },
    });
    return NextResponse.json(discount, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
