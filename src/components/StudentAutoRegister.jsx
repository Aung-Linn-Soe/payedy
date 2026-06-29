"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getAcademicYear, getGradeInfo } from "@/lib/academicYear";

export default function StudentAutoRegister() {
  const { data: session, status } = useSession();
  const lastRegisteredRef = useRef(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;

    const email = session.user.email;
    const studentId = String(email).split("@")[0];
    if (lastRegisteredRef.current === studentId) return;
    lastRegisteredRef.current = studentId;

    const determineCourseKey = (id) => {
      const first = String(id || "").toLowerCase().charAt(0);
      switch (first) {
        case "j": return "japanese";
        case "k": return "kokusai";
        case "i": return "it";
        case "w": return "web";
        case "f": return "global";
        case "h": return "hotel";
        default:  return "unknown";
      }
    };

    const register = async () => {
      try {
        const courseKey = determineCourseKey(studentId);
        const yearCode = parseInt(String(studentId).slice(1, 3), 10);
        const today = new Date();
        const academicYear = getAcademicYear(today);
        let entranceYear = 2000 + (Number.isFinite(yearCode) ? yearCode : 0);
        if (entranceYear > academicYear) entranceYear -= 100;
        const { gradeJP, gradeEN } = getGradeInfo(entranceYear, today);

        // Check if student exists; if yes, just update grade fields
        const checkRes = await fetch(`/api/students/${studentId}`);
        if (checkRes.ok) {
          const existing = await checkRes.json();
          if (existing) {
            const updates = {};
            const name = session.user?.name || "";
            if (name && name !== existing.name) updates.name = name;
            if (gradeEN && gradeEN !== existing.grade) updates.grade = gradeEN;
            if (gradeJP && gradeJP !== existing.gradeJP) updates.gradeJP = gradeJP;
            if (entranceYear && entranceYear !== existing.entranceYear) updates.entranceYear = entranceYear;
            if (Object.keys(updates).length > 0) {
              await fetch(`/api/students/${studentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
              }).catch(() => {});
            }
            return;
          }
        }

        // Create new student
        await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId, email,
            name: session.user?.name || "未設定",
            courseId: courseKey, courseKey,
            startMonth: today.toISOString().slice(0, 7),
            entranceYear, grade: gradeEN, gradeJP,
          }),
        }).catch(() => {});
      } catch (err) {
        console.error("[StudentAutoRegister] registration failed:", err);
      }
    };

    register();
  }, [status, session]);

  return null;
}
