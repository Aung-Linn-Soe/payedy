import { prisma } from "@/lib/prisma";
import { listUsers, updateUserRole, updateUser } from "@/data/users";

export async function GET() {
  // Merge in-memory seed users with DB students
  const dbStudents = await prisma.student.findMany({
    orderBy: { createdAt: "asc" },
  });
  const seedUsers = listUsers();
  const dbMap = new Map(dbStudents.map((s) => [s.studentId, s]));
  // Merge: DB takes precedence
  const merged = [
    ...seedUsers.filter((u) => !dbMap.has(u.studentId)),
    ...dbStudents.map((s) => ({
      id: String(s.id),
      studentId: s.studentId,
      name: s.name,
      email: s.email,
      courseId: s.courseId || "",
      courseKey: s.courseKey || "",
      grade: s.grade || "",
      gradeEN: s.gradeEN || "",
      role: s.role || "student",
    })),
  ];
  return new Response(JSON.stringify(merged), { status: 200 });
}

export async function POST(req) {
  const body = await req.json();
  const { studentId, role, courseId, course, name, email } = body;
  if (!studentId) return new Response("Missing studentId", { status: 400 });

  const updates = {};
  if (role) updates.role = role;
  if (courseId || course) updates.courseId = courseId ?? course;
  if (name) updates.name = name;
  if (email) updates.email = email;

  // Try to update in DB first
  let updated = null;
  try {
    updated = await prisma.student.update({
      where: { studentId: String(studentId) },
      data: updates,
    });
  } catch (e) {
    if (e?.code !== "P2025") throw e;
    // Not in DB — update in-memory seed users
    if (role) updateUserRole(studentId, role);
    if (courseId || course || name || email) {
      updateUser(studentId, { courseId: courseId ?? course, name, email });
    }
    updated = { studentId };
  }

  return new Response(JSON.stringify(updated), { status: 200 });
}
