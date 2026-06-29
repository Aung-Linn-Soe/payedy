import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const role = session?.user?.role;
    const isAdmin = session?.user?.isAdmin;
    if (!isAdmin && role !== "teacher") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { paymentId, decision, reason } = body || {};
    if (!paymentId || !decision) {
      return NextResponse.json({ error: "paymentId and decision required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { paymentId: String(paymentId) },
    });
    if (!payment) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const by = {
      uid: session.user.id || null,
      name: session.user.name || session.user.email || "teacher",
    };
    const now = new Date();

    if (decision === "approve") {
      await prisma.payment.update({
        where: { paymentId: String(paymentId) },
        data: { verified: true, status: "承認", approvedBy: by, approvedAt: now },
      });
    } else if (decision === "reject") {
      await prisma.payment.update({
        where: { paymentId: String(paymentId) },
        data: {
          verified: false,
          status: "却下",
          rejectReason: reason || null,
          rejectedBy: by,
          rejectedAt: now,
        },
      });
    } else {
      return NextResponse.json({ error: "invalid decision" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("teacher/payments/decision error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
