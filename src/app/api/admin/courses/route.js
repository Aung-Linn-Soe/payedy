import { prisma } from "@/lib/prisma";

function slugify(name) {
  const s = String(name || "").trim();
  const asciiMatch = s.match(/[A-Za-z0-9]+/g);
  if (asciiMatch && asciiMatch.length > 0) {
    return String(asciiMatch.join("-")).toLowerCase().slice(0, 40);
  }
  const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  return slug || `course-${Date.now().toString(36)}`.slice(0, 40);
}

export async function GET() {
  const courses = await prisma.course.findMany({ orderBy: { createdAt: "asc" } });
  return new Response(JSON.stringify(courses), { status: 200 });
}

export async function POST(req) {
  const body = await req.json();
  const { name, nameJa, nameEn, tuition, tuitionByYear, courseKey, year, pricePerMonth, fee, monthlyTemplate, paymentAcademicYear } = body;
  const displayName = name || nameJa || nameEn;
  if (!displayName) return new Response("Missing name", { status: 400 });

  // code includes year so each grade is a separate record (e.g. "web-3rd-year")
  const yearSlug = year ? `-${slugify(year)}` : "";
  const code = slugify(displayName) + yearSlug;
  const resolvedCourseKey = courseKey || slugify(displayName);

  const course = await prisma.course.upsert({
    where: { code },
    update: {
      name: displayName,
      nameJa: nameJa || null,
      nameEn: nameEn || null,
      tuition: Number(tuition) || 0,
      courseKey: resolvedCourseKey,
      year: year || "",
      pricePerMonth: pricePerMonth ? Number(pricePerMonth) : null,
      fee: fee ? Number(fee) : null,
      monthlyTemplate: monthlyTemplate || null,
      paymentAcademicYear: paymentAcademicYear ? Number(paymentAcademicYear) : null,
    },
    create: {
      code,
      name: displayName,
      nameJa: nameJa || null,
      nameEn: nameEn || null,
      tuition: Number(tuition) || 0,
      courseKey: resolvedCourseKey,
      year: year || "",
      pricePerMonth: pricePerMonth ? Number(pricePerMonth) : null,
      fee: fee ? Number(fee) : null,
      monthlyTemplate: monthlyTemplate || null,
      paymentAcademicYear: paymentAcademicYear ? Number(paymentAcademicYear) : null,
    },
  });
  return new Response(JSON.stringify(course), { status: 201 });
}

export async function DELETE(req) {
  try {
    const body = await req.json();
    const { code } = body;
    if (!code) return new Response("Missing code", { status: 400 });
    await prisma.course.delete({ where: { code: String(code) } });
    return new Response("Deleted", { status: 200 });
  } catch (e) {
    if (e?.code === "P2025") return new Response("Not found", { status: 404 });
    return new Response("Bad request", { status: 400 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { code, name, nameJa, nameEn, tuition, tuitionByYear, year, pricePerMonth, fee, monthlyTemplate, paymentAcademicYear } = body;
    if (!code) return new Response("Missing code", { status: 400 });

    const data = {};
    if (name) data.name = name;
    if (nameJa !== undefined) data.nameJa = nameJa;
    if (nameEn !== undefined) data.nameEn = nameEn;
    if (tuition !== undefined) data.tuition = Number(String(tuition).replace(/[^0-9]/g, "")) || 0;
    if (year !== undefined) data.year = year;
    if (pricePerMonth !== undefined) data.pricePerMonth = pricePerMonth ? Number(pricePerMonth) : null;
    if (fee !== undefined) data.fee = fee ? Number(fee) : null;
    if (monthlyTemplate !== undefined) data.monthlyTemplate = monthlyTemplate || null;
    if (paymentAcademicYear !== undefined) data.paymentAcademicYear = paymentAcademicYear ? Number(paymentAcademicYear) : null;

    const updated = await prisma.course.update({
      where: { code: String(code) },
      data,
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    if (e?.code === "P2025") return new Response("Not found", { status: 404 });
    return new Response("Bad request", { status: 400 });
  }
}
