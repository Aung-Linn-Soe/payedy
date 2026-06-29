import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAcademicYear, getGradeInfo } from "@/lib/academicYear";

// POST /api/students — create or return existing student + increment course
export async function POST(req) {
  try {
    const body = await req.json();
    const { studentId, email, name, nameKana, courseId, courseKey, startMonth, entranceYear, grade, gradeJP } = body;
    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    const existing = await prisma.student.findUnique({ where: { studentId } });
    if (existing) return NextResponse.json(existing, { status: 200 });

    // Derive grade if not provided
    let resolvedGrade = grade || "";
    let resolvedGradeJP = gradeJP || "";
    let resolvedEntranceYear = entranceYear || null;
    if (!resolvedGrade && studentId) {
      try {
        const yearCode = parseInt(String(studentId).slice(1, 3), 10);
        const today = new Date();
        const academicYear = getAcademicYear(today);
        let ey = 2000 + (Number.isFinite(yearCode) ? yearCode : 0);
        if (ey > academicYear) ey -= 100;
        const { gradeEN, gradeJP: gJP } = getGradeInfo(ey, today);
        resolvedGrade = gradeEN;
        resolvedGradeJP = gJP;
        resolvedEntranceYear = ey;
      } catch (e) {
        // ignore
      }
    }

    const student = await prisma.student.create({
      data: {
        studentId,
        email: email || `${studentId}@unknown`,
        name: name || "",
        nameKana: nameKana || "",
        courseId: courseId || "",
        courseKey: courseKey || courseId || "",
        startMonth: startMonth || new Date().toISOString().slice(0, 7),
        entranceYear: resolvedEntranceYear,
        grade: resolvedGrade,
        gradeEN: resolvedGrade,
        gradeJP: resolvedGradeJP,
      },
    });

    // Increment matching course student count
    if ((courseKey || courseId) && resolvedGrade) {
      await prisma.course.updateMany({
        where: { courseKey: courseKey || courseId, year: resolvedGrade },
        data: { students: { increment: 1 } },
      }).catch(() => {});
    }

    return NextResponse.json(student, { status: 201 });
  } catch (e) {
    console.error("POST /api/students error:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
