import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/payments/[paymentId]
// body: { action: "approve" | "reject", approvedBy?, rejectReason? }
export async function PATCH(req, { params }) {
  const { paymentId } = await params;
  try {
    const body = await req.json();
    const data = {};

    if (body.action === "approve") {
      data.verified = true;
      data.status = "支払い済み";
      data.approvedAt = new Date();
      data.approvedBy = body.approvedBy || null;
      data.rejectReason = null;
      data.rejectedAt = null;
      data.rejectedBy = null;
    } else if (body.action === "reject") {
      data.verified = false;
      data.status = "却下";
      data.rejectReason = body.rejectReason || "";
      data.rejectedAt = new Date();
      data.rejectedBy = body.rejectedBy || null;
      data.approvedAt = null;
      data.approvedBy = null;
    } else if (body.action === "revert") {
      data.verified = false;
      data.status = "確認中";
      data.approvedAt = null;
      data.approvedBy = null;
      data.rejectReason = null;
      data.rejectedAt = null;
      data.rejectedBy = null;
    } else {
      const allowed = ["status", "verified", "amount", "paymentMethod", "month", "receiptBase64"];
      for (const key of allowed) {
        if (body[key] !== undefined) data[key] = body[key];
      }
    }

    const updated = await prisma.payment.update({ where: { paymentId }, data });
    return NextResponse.json({ ...updated, createdAt: updated.createdAt?.toISOString(), approvedAt: updated.approvedAt?.toISOString() || null, rejectedAt: updated.rejectedAt?.toISOString() || null });
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
