import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getEntranceYearFromStudentId, getGradeInfo } from "@/lib/academicYear";

const COURSE_KEY_MAP = { w: "web", k: "kokusai", j: "japanese", i: "it", f: "global" };

export default async function AuthRedirectServer() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return redirect("/");
  }

  // Auto-create/update student record on login with course + grade derived from student ID
  try {
    const email = session.user?.email || "";
    const studentId = String(email).split("@")[0].toLowerCase();
    if (studentId && email) {
      const courseKey = COURSE_KEY_MAP[studentId.charAt(0)] || "";
      const entranceYear = getEntranceYearFromStudentId(studentId);
      const { gradeNum, gradeJP, gradeEN } = entranceYear
        ? getGradeInfo(entranceYear)
        : { gradeNum: null, gradeJP: "", gradeEN: "" };

      // Find matching course by courseKey + year (e.g. "web" + "3rd Year")
      let courseCode = courseKey;
      if (courseKey && gradeEN) {
        const course = await prisma.course.findFirst({
          where: { courseKey, year: gradeEN },
        });
        if (course) courseCode = course.code;
      }

      const courseData = {
        courseId: courseCode,
        courseKey,
        ...(entranceYear && { entranceYear }),
        ...(gradeNum && { grade: String(gradeNum), gradeJP, gradeEN }),
      };

      await prisma.student.upsert({
        where: { studentId },
        update: courseData,
        create: {
          studentId,
          email,
          name: session.user?.name || "",
          nameKana: "",
          startMonth: "",
          ...courseData,
        },
      });

      // Sync course student count with actual DB count
      if (courseCode && courseCode !== courseKey) {
        const count = await prisma.student.count({ where: { courseId: courseCode } });
        await prisma.course.update({
          where: { code: courseCode },
          data: { students: count },
        });
      }
    }
  } catch (e) {
    // Non-fatal: student may already exist or DB unavailable
    console.warn("auth/redirect: upsert failed:", e?.message);
  }

  const role = session?.user?.role;
  if (role === "teacher") return redirect("/teacher/dashboard");
  return redirect("/student/dashboard");
}
