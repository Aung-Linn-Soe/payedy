/**
 * Client-side helper that calls the server API to migrate unpaid remainder
 * from one academic year to the next for a student's payment schedules.
 *
 * The actual migration logic runs in POST /api/admin/migrate-year (Prisma-backed).
 */
export async function migrateRemainingToNextYear({
  studentId,
  fromYear,
  toYear,
  courseTemplate = null,
  coursePricePerMonth = null,
} = {}) {
  if (!studentId) throw new Error("studentId required");
  const y1 = Number(fromYear);
  const y2 = typeof toYear !== "undefined" ? Number(toYear) : y1 + 1;

  const res = await fetch("/api/admin/migrate-year", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, fromYear: y1, toYear: y2, courseTemplate, coursePricePerMonth }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "unknown error");
    throw new Error(`migrate-year failed: ${msg}`);
  }

  return res.json();
}

export default migrateRemainingToNextYear;
