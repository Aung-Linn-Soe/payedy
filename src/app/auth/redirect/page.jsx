import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export default async function AuthRedirectServer() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return redirect("/");
  }

  // Auto-create student record on first login
  try {
    const email = session.user?.email || "";
    const studentId = String(email).split("@")[0].toLowerCase();
    if (studentId && email) {
      // Derive courseKey from first letter of studentId (w→web, k→kokusai, j→japanese, i→it)
      const firstChar = studentId.charAt(0);
      const courseKeyMap = { w: "web", k: "kokusai", j: "japanese", i: "it", f: "global" };
      const courseKey = courseKeyMap[firstChar] || "";

      await prisma.student.upsert({
        where: { studentId },
        update: {},
        create: {
          studentId,
          email,
          name: session.user?.name || "",
          nameKana: "",
          courseId: courseKey,
          courseKey,
          startMonth: "",
        },
      });
    }
  } catch (e) {
    // Non-fatal: student may already exist or DB unavailable
    console.warn("auth/redirect: upsert failed:", e?.message);
  }

  const role = session?.user?.role;
  if (role === "teacher") return redirect("/teacher/dashboard");
  return redirect("/student/dashboard");
}
