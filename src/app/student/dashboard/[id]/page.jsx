"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import styles from "./page.module.css";
import receiptStyles from "@/components/ReceiptList.module.css";
import PaymentSchedule from "@/components/PaymentSchedule";
import { getAcademicYear, getGradeInfo } from "@/lib/academicYear";
import { useParams } from "next/navigation";

export default function StudentDashboardIdPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const routeId = params?.id;

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseInfo, setCourseInfo] = useState(null);
  const [computedTuition, setComputedTuition] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [amount, setAmount] = useState("");
  const [receiptMonth, setReceiptMonth] = useState("");
  const [payments, setPayments] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [prevYearRemaining, setPrevYearRemaining] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);

  const getStudentId = () =>
    routeId ||
    session?.user?.studentId ||
    String(session?.user?.email || "").split("@")[0];

  const fetchStudent = useCallback(async () => {
    const sid = getStudentId();
    if (!sid) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/students/${sid}`);
      if (res.ok) setStudent(await res.json());
      else setStudent(null);
    } catch (e) { setStudent(null); }
    finally { setLoading(false); }
  }, [routeId, session]);

  const fetchPayments = useCallback(async () => {
    const sid = getStudentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/payments?studentId=${sid}&orderBy=createdAt`);
      if (res.ok) setPayments(await res.json());
    } catch (e) { /* ignore */ }
  }, [routeId, session]);

  const fetchDiscounts = useCallback(async () => {
    const sid = getStudentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/students/${sid}/discounts`);
      if (res.ok) setDiscounts(await res.json());
    } catch (e) { /* ignore */ }
  }, [routeId, session]);

  useEffect(() => {
    if (status === "unauthenticated") { setLoading(false); return; }
    if (status !== "authenticated") return;
    setIsTeacher(session?.user?.role === "teacher" || session?.user?.isAdmin);
    fetchStudent();
    fetchPayments();
    fetchDiscounts();
    const interval = setInterval(() => { fetchStudent(); fetchPayments(); fetchDiscounts(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchStudent, fetchPayments, fetchDiscounts, status]);

  useEffect(() => {
    if (!student?.courseId) { setCourseInfo(null); setComputedTuition(null); return; }
    (async () => {
      try {
        const gradeEN = student.grade || student.gradeEN || null;
        const gradeJP = student.gradeJP || null;
        const queries = [
          gradeEN ? `/api/courses?courseKey=${encodeURIComponent(student.courseId)}&year=${encodeURIComponent(gradeEN)}` : null,
          gradeJP ? `/api/courses?courseKey=${encodeURIComponent(student.courseId)}&year=${encodeURIComponent(gradeJP)}` : null,
          `/api/courses?courseKey=${encodeURIComponent(student.courseId)}`,
        ].filter(Boolean);
        for (const url of queries) {
          const res = await fetch(url);
          if (res.ok) {
            const list = await res.json();
            if (list.length) {
              const c = list[0];
              setCourseInfo({ id: c.id || c.code, name: c.name || "未設定", pricePerMonth: Number(c.pricePerMonth) || null, totalFee: Number(c.fee) || Number(c.tuition) || null, year: c.year, monthlyTemplate: c.monthlyTemplate, paymentAcademicYear: c.paymentAcademicYear });
              setComputedTuition(Number(c.fee) || Number(c.tuition) || Number(c.pricePerMonth) || null);
              return;
            }
          }
        }
        setCourseInfo(null); setComputedTuition(null);
      } catch (e) { setCourseInfo(null); setComputedTuition(null); }
    })();
  }, [student?.courseId, student?.grade, student?.gradeJP]);

  useEffect(() => {
    if (!student?.studentId) return;
    let mounted = true;
    (async () => {
      try {
        const today = new Date();
        const academicYear = getAcademicYear(today);
        const code = parseInt(String(student.studentId).slice(1, 3), 10);
        let ey = 2000 + (Number.isFinite(code) ? code : 0);
        if (ey > academicYear) ey -= 100;
        const { gradeNum } = getGradeInfo(student.entranceYear || ey, today);
        if (gradeNum < 2) { if (mounted) setPrevYearRemaining(0); return; }
        const res = await fetch(`/api/students/${student.studentId}/schedules`);
        if (!res.ok || !mounted) return;
        const docs = await res.json();
        const prev = academicYear - 1;
        const prevDocs = docs.filter((d) => typeof d.month === "string" && d.month.startsWith(`${prev}-`));
        const due = prevDocs.reduce((s, d) => s + (Number(d.dueAmount) || 0), 0);
        const paid = prevDocs.reduce((s, d) => s + (Number(d.paidAmount) || 0), 0);
        if (mounted) setPrevYearRemaining(Math.max(due - paid, 0));
      } catch (e) { if (mounted) setPrevYearRemaining(null); }
    })();
    return () => { mounted = false; };
  }, [student?.studentId, student?.entranceYear]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleReceiptUpload = async (targetMonth) => {
    if (!file || !student) return alert("ファイルを選択してください。");
    const numericAmount = Number(String(amount).replace(/[^0-9.-]/g, ""));
    if (!numericAmount || numericAmount <= 0) return alert("有効な金額を入力してください");
    setUploading(true);
    try {
      const toBase64 = (f) => new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(f);
      });
      const base64Data = await toBase64(file);
      const res = await fetch("/api/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.studentId, course: student.courseId || "未設定", receiptBase64: base64Data, amount: numericAmount, paymentMethod: "銀行振込", status: "支払い済み", month: targetMonth || student.startMonth || new Date().toISOString().slice(0, 7) }),
      });
      if (!res.ok) throw new Error("upload failed");
      alert("支払い情報を保存しました！");
      setFile(null); setAmount("");
      fetchPayments();
    } catch (err) { alert("アップロードに失敗しました。"); }
    finally { setUploading(false); }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!paymentId || !confirm("この支払い履歴を削除してもよろしいですか？")) return;
    const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setPayments((prev) => prev.filter((p) => (p.paymentId || p.id) !== paymentId));
    else alert("削除に失敗しました。");
  };

  const handleAddDiscount = async () => {
    if (!student?.studentId) return alert("学生情報が見つかりません。");
    const reason = String(newReason || "").trim();
    const amountNum = Number(newAmount);
    if (!reason) return alert("割引理由を入力してください。");
    if (isNaN(amountNum) || amountNum < 0) return alert("割引額は正の数値で入力してください。");
    if (discounts.length >= 5) return alert("割引レコードは最大5件です。");
    try {
      const res = await fetch(`/api/students/${student.studentId}/discounts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, reason }),
      });
      if (!res.ok) throw new Error();
      setNewReason(""); setNewAmount("");
      fetchDiscounts();
    } catch (e) { alert("割引追加に失敗しました。"); }
  };

  const handleMigrateYear = async () => {
    if (!student?.studentId) return alert("学生情報が見つかりません。");
    if (!confirm("未払い残高を次年度に移行します。実行してよろしいですか？")) return;
    const defaultFrom = new Date().getFullYear() - 1;
    const raw = prompt(`移行元の年を入力してください（例: ${defaultFrom}）。`, String(defaultFrom));
    const fromYear = raw ? Number(raw) : defaultFrom;
    if (!fromYear || isNaN(fromYear)) return alert("有効な年を入力してください。");
    try {
      setMigrating(true);
      const res = await fetch("/api/admin/migrate-year", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.studentId, fromYear }),
      });
      const data = await res.json();
      if (data.migrated) alert(`移行完了: ${data.addedAmount} 円を移行しました。`);
      else alert(`移行なし: ${data.reason || "未払い残高なし"}`);
    } catch (e) { alert("移行に失敗しました。"); }
    finally { setMigrating(false); }
  };

  if (status === "unauthenticated") return <div className={styles.center}><h2>サインインしてください</h2><button onClick={() => signIn()}>サインイン</button></div>;

  const baseTotal = Number(courseInfo?.totalFee ?? courseInfo?.pricePerMonth ?? computedTuition ?? student?.totalFees ?? 0);
  const totalDiscount = discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const total = Math.max(baseTotal - totalDiscount, 0);
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) || Number(student?.paidAmount || 0);
  const remaining = Math.max(total - paid + (prevYearRemaining || 0), 0);
  const progress = total ? Math.min((paid / total) * 100, 100) : 0;

  return (
    <main className={styles.container}>
      <header className={styles.tabs}>
        {["overview","history","upload","profile"].map((tab) => (
          <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.active : ""}`} onClick={() => setActiveTab(tab)}>
            {tab === "overview" ? "概要" : tab === "history" ? "毎月の支払い" : tab === "upload" ? "レシートをアップロード" : "プロフィール"}
          </button>
        ))}
      </header>

      {activeTab === "overview" && (
        <section className={styles.card}>
          <h1 className={styles.title}>支払い状況 — {student?.studentId || routeId}</h1>
          <div className={styles.infoBox}><div>コース: {courseInfo?.name ?? student?.courseId ?? "未設定"}</div></div>
          <div className={styles["progress-row"]}><span className={styles.label}>支払い進捗</span><span className={styles.percent}>{progress.toFixed(1)}%</span></div>
          <div className={styles["progress-wrap"]}><div className={styles["progress-bar"]} style={{ width: `${progress}%` }} /></div>
          <div className={styles.stats}>
            <article className={styles.stat}><div className={styles["stat-label"]}>総学費</div><div className={styles["stat-value"]}>{total.toLocaleString()}円</div></article>
            <article className={styles.stat}><div className={styles["stat-label"]}>支払い済み</div><div className={`${styles["stat-value"]} ${styles.paid}`}>{paid.toLocaleString()}円</div></article>
            <article className={styles.stat}><div className={styles["stat-label"]}>残り</div><div className={`${styles["stat-value"]} ${styles.remain}`}>{remaining.toLocaleString()}円</div></article>
          </div>

          {isTeacher && (
            <div style={{ marginTop: 16, padding: 12, background: "#f9fafb", borderRadius: 8 }}>
              <h3>割引管理</h3>
              {discounts.map((d) => (
                <div key={d.id} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span>{d.reason}</span><span>¥{Number(d.amount).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="text" placeholder="理由" value={newReason} onChange={(e) => setNewReason(e.target.value)} style={{ flex: 1 }} />
                <input type="number" placeholder="金額" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={{ width: 100 }} />
                <button onClick={handleAddDiscount}>追加</button>
              </div>
              <button onClick={handleMigrateYear} disabled={migrating} style={{ marginTop: 8 }}>
                {migrating ? "移行中..." : "年度移行"}
              </button>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.paymentTable}>
              <tbody>
                {payments.map((p) => {
                  const date = p.createdAt ? new Date(p.createdAt) : new Date();
                  return (
                    <tr key={p.paymentId || p.id}>
                      <td>{date.toLocaleDateString("ja-JP")}</td>
                      <td>{date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>¥{p.amount?.toLocaleString()}</td>
                      <td>{p.paymentMethod || "-"}</td>
                      <td>
                        <div className={styles.paymentAction}>
                          {p.receiptBase64 ? <img src={p.receiptBase64} alt="receipt" className={receiptStyles.thumb} onClick={() => setLightboxSrc(p.receiptBase64)} /> : <div className={receiptStyles.placeholder}><span className={receiptStyles.placeholderText}>No image</span></div>}
                          {isTeacher && <button className={styles.secondaryBtn} onClick={() => handleDeletePayment(p.paymentId || p.id)}>削除</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lightboxSrc && <div className={receiptStyles.modal} onClick={() => setLightboxSrc(null)}><div className={receiptStyles.modalContent} onClick={(e) => e.stopPropagation()}><button className={receiptStyles.closeBtn} onClick={() => setLightboxSrc(null)}>×</button><img src={lightboxSrc} alt="receipt-large" className={receiptStyles.modalImage} /></div></div>}
        </section>
      )}

      {activeTab === "history" && <section className={styles.card}><PaymentSchedule student={student} courseInfo={courseInfo} payments={payments} /></section>}

      {activeTab === "upload" && (
        <section className={styles.card}>
          <h2>レシートをアップロード</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 12 }}>
            <label>金額:<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例: 86000" style={{ marginLeft: 8 }} /></label>
            <label>対象月:<input type="month" value={receiptMonth} onChange={(e) => setReceiptMonth(e.target.value)} style={{ marginLeft: 8 }} /></label>
            <label>ファイル:<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0])} style={{ marginLeft: 8 }} /></label>
            <button onClick={() => handleReceiptUpload(receiptMonth || undefined)} disabled={uploading}>{uploading ? "アップロード中..." : "OK"}</button>
          </div>
        </section>
      )}

      {activeTab === "profile" && (
        <section className={styles.card}>
          <h2 style={{ textAlign: "center" }}>プロフィール</h2>
          <div style={{ padding: 12, textAlign: "center" }}>
            <p>名前: {student?.name || session?.user?.name}</p>
            <p>メール: {student?.email || session?.user?.email}</p>
            <p>学籍番号: {student?.studentId || routeId || "未登録"}</p>
          </div>
        </section>
      )}
    </main>
  );
}
