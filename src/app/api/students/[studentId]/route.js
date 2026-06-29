import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/students/[studentId]
export async function GET(req, { params }) {
  const { studentId } = await params;
  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(student);
}

// DELETE /api/students/[studentId]
export async function DELETE(req, { params }) {
  const { studentId } = await params;
  try {
    await prisma.paymentSchedule.deleteMany({ where: { studentId } });
    await prisma.discount.deleteMany({ where: { studentId } });
    await prisma.student.delete({ where: { studentId } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e?.code === "P2025") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// PATCH /api/students/[studentId]
export async function PATCH(req, { params }) {
  const { studentId } = await params;
  try {
    const body = await req.json();
    const allowed = ["name", "nameKana", "courseId", "courseKey", "courseDocId", "startMonth",
      "entranceYear", "grade", "gradeJP", "gradeEN", "totalFees", "paidAmount", "role"];
    const data = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const updated = await prisma.student.update({ where: { studentId }, data });
    return NextResponse.json(updated);
  } catch (e) {
    if (e?.code === "P2025") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
