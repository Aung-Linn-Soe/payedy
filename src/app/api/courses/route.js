import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/courses?courseKey=xxx&year=xxx
export async function GET(req) {
  const url = new URL(req.url);
  const courseKey = url.searchParams.get("courseKey");
  const year = url.searchParams.get("year");
  const code = url.searchParams.get("code");

  const where = {};
  if (code) where.code = code;
  if (courseKey) where.courseKey = courseKey;
  if (year) where.year = year;

  const courses = await prisma.course.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  // Count actual enrolled students per course from the Student table
  // Match by courseId (exact) OR by courseKey+gradeEN (fallback for old records)
  const countMap = {};
  await Promise.all(
    courses.map(async (c) => {
      const count = await prisma.student.count({
        where: {
          OR: [
            { courseId: c.code },
            ...(c.courseKey && c.year
              ? [{ courseKey: c.courseKey, gradeEN: c.year }]
              : []),
          ],
        },
      });
      countMap[c.code] = count;
    })
  );

  const serialized = courses.map((c) => ({
    ...c,
    students: countMap[c.code] ?? 0,
    id: c.code, // keep Firestore-style id for compatibility
    createdAt: c.createdAt?.toISOString(),
    updatedAt: c.updatedAt?.toISOString(),
  }));

  return NextResponse.json(serialized);
}
