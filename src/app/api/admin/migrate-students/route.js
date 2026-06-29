import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEntranceYearFromStudentId, getGradeInfo } from "@/lib/academicYear";

const COURSE_KEY_MAP = { w: "web", k: "kokusai", j: "japanese", i: "it", f: "global" };

// POST /api/admin/migrate-students
// One-time migration: update all Student records to set courseId, grade, gradeJP, gradeEN
// from their studentId, then sync Course.students counts.
export async function POST() {
  const students = await prisma.student.findMany();
  const courses = await prisma.course.findMany();

  // Build lookup: "web|3rd Year" -> course.code
  const courseIndex = new Map(
    courses.map((c) => [`${c.courseKey}|${c.year}`, c.code])
  );

  let updated = 0;
  const errors = [];

  for (const student of students) {
    try {
      const sid = student.studentId;
      const courseKey = COURSE_KEY_MAP[sid.charAt(0)] || student.courseKey || "";
      const entranceYear = getEntranceYearFromStudentId(sid);
      const { gradeNum, gradeJP, gradeEN } = entranceYear
        ? getGradeInfo(entranceYear)
        : { gradeNum: null, gradeJP: "", gradeEN: "" };

      const courseCode = courseIndex.get(`${courseKey}|${gradeEN}`) || courseKey;

      await prisma.student.update({
        where: { id: student.id },
        data: {
          courseId: courseCode,
          courseKey,
          ...(entranceYear && { entranceYear }),
          ...(gradeNum && { grade: String(gradeNum), gradeJP, gradeEN }),
        },
      });
      updated++;
    } catch (e) {
      errors.push({ studentId: student.studentId, error: e?.message });
    }
  }

  // Sync Course.students counts
  const codes = courses.map((c) => c.code);
  const counts = await prisma.student.groupBy({
    by: ["courseId"],
    where: { courseId: { in: codes } },
    _count: { courseId: true },
  });
  const countMap = Object.fromEntries(
    counts.map((e) => [e.courseId, e._count.courseId])
  );

  for (const course of courses) {
    await prisma.course.update({
      where: { code: course.code },
      data: { students: countMap[course.code] ?? 0 },
    });
  }

  return NextResponse.json({
    message: `${updated} 件の学生データを更新しました`,
    updated,
    errors,
  });
}
