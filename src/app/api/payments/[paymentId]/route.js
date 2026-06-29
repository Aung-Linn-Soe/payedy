import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/payments/[paymentId]
export async function PATCH(req, { params }) {
  const { paymentId } = await params;
  try {
    const body = await req.json();
    const allowed = ["status", "verified", "amount", "paymentMethod", "month", "receiptBase64"];
    const data = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const updated = await prisma.payment.update({
      where: { paymentId },
      data,
    });
    return NextResponse.json({ ...updated, createdAt: updated.createdAt?.toISOString() });
  } catch (e) {
    if (e?.code === "P2025") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// DELETE /api/payments/[paymentId]
export async function DELETE(req, { params }) {
  const { paymentId } = await params;
  try {
    await prisma.payment.delete({ where: { paymentId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e?.code === "P2025") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
