"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { getAcademicYear, getGradeInfo } from "@/lib/academicYear";
import styles from "./page.module.css";
import receiptStyles from "@/components/ReceiptList.module.css";
import PaymentSchedule from "@/components/PaymentSchedule";

export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
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
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [prevYearRemaining, setPrevYearRemaining] = useState(null);

  const getStudentId = () =>
    session?.user?.studentId ||
    String(session?.user?.email || "").split("@")[0];

  // --- Fetch student record ---
  const fetchStudent = useCallback(async () => {
    if (status !== "authenticated") { setLoading(false); return; }
    const studentId = getStudentId();
    if (!studentId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/students/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setStudent(data ? { ...data, studentId } : null);
      } else {
        setStudent(null);
      }
    } catch (e) {
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }, [status, session]);

  // --- Fetch payments ---
  const fetchPayments = useCallback(async () => {
    if (!session?.user) return;
    const studentId = getStudentId();
    if (!studentId) return;
    try {
      const res = await fetch(`/api/payments?studentId=${studentId}&orderBy=createdAt`);
      if (res.ok) setPayments(await res.json());
    } catch (e) { /* ignore */ }
  }, [session]);

  // --- Fetch discounts ---
  const fetchDiscounts = useCallback(async () => {
    if (!session?.user) return;
    const studentId = getStudentId();
    if (!studentId) return;
    try {
      const res = await fetch(`/api/students/${studentId}/discounts`);
      if (res.ok) setDiscounts(await res.json());
    } catch (e) { /* ignore */ }
  }, [session]);

  // Initial load and polling
  useEffect(() => {
    fetchStudent();
    fetchPayments();
    fetchDiscounts();
    const interval = setInterval(() => {
      fetchStudent();
      fetchPayments();
      fetchDiscounts();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchStudent, fetchPayments, fetchDiscounts]);

  // --- Auto-register student (first Google login) ---
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    const email = session.user.email;
    const studentId = email.split("@")[0];

    const determineCourseKey = (id) => {
      const first = String(id || "").toLowerCase().charAt(0);
      switch (first) {
        case "j": return "japanese";
        case "k": return "kokusai";
        case "i": return "it";
        case "w": return "web";
        case "f": return "global";
        default:  return "unknown";
      }
    };

    const register = async () => {
      const courseKey = determineCourseKey(studentId);
      const yearCode = parseInt(String(studentId).slice(1, 3), 10);
      const today = new Date();
      const academicYear = getAcademicYear(today);
      let entranceYear = 2000 + (Number.isFinite(yearCode) ? yearCode : 0);
      if (entranceYear > academicYear) entranceYear -= 100;
      const { gradeJP, gradeEN } = getGradeInfo(entranceYear, today);

      const payload = {
        studentId,
        email,
        name: session.user?.name || "",
        courseId: courseKey,
        courseKey,
        startMonth: today.toISOString().slice(0, 7),
        entranceYear,
        grade: gradeEN,
        gradeJP,
      };

      // Try PATCH first (update existing), then POST (create new)
      const patchRes = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (!patchRes || !patchRes.ok) {
        await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }

      // Immediately refresh student state so courseId is available for course lookup
      const refreshRes = await fetch(`/api/students/${studentId}`).catch(() => null);
      if (refreshRes?.ok) {
        const updated = await refreshRes.json().catch(() => null);
        if (updated) setStudent({ ...updated, studentId });
      }
    };

    register();
  }, [status, session]);

  // --- Fetch course info ---
  useEffect(() => {
    if (!student?.courseId) { setCourseInfo(null); setComputedTuition(null); return; }

    const fetchCourse = async () => {
      try {
        // Compute student's year labels
        let gradeEN = student.grade || student.gradeEN || null;
        let gradeJP = student.gradeJP || null;
        if (!gradeEN && student.studentId) {
          const code = parseInt(String(student.studentId).slice(1, 3), 10);
          const today = new Date();
          const academicYear = getAcademicYear(today);
          let ey = 2000 + (Number.isFinite(code) ? code : 0);
          if (ey > academicYear) ey -= 100;
          const info = getGradeInfo(ey, today);
          gradeEN = info.gradeEN;
          gradeJP = info.gradeJP;
        }

        // Try courseKey + year (EN then JP then fallback)
        const queries = [
          gradeEN ? `/api/courses?courseKey=${encodeURIComponent(student.courseId)}&year=${encodeURIComponent(gradeEN)}` : null,
          gradeJP ? `/api/courses?courseKey=${encodeURIComponent(student.courseId)}&year=${encodeURIComponent(gradeJP)}` : null,
          `/api/courses?courseKey=${encodeURIComponent(student.courseId)}`,
        ].filter(Boolean);

        let course = null;
        for (const url of queries) {
          const res = await fetch(url);
          if (res.ok) {
            const list = await res.json();
            if (list.length > 0) { course = list[0]; break; }
          }
        }

        if (course) {
          const monthly = Number(course.pricePerMonth) || null;
          const totalFee = Number(course.fee) || Number(course.tuition) || null;
          setCourseInfo({
            id: course.id || course.code,
            name: course.name || "未設定",
            pricePerMonth: monthly,
            totalFee,
            year: course.year,
            paymentAcademicYear: course.paymentAcademicYear || null,
            monthlyTemplate: course.monthlyTemplate || null,
          });
          setComputedTuition(totalFee ?? monthly ?? 0);
        } else {
          setCourseInfo(null);
          setComputedTuition(Number(student?.totalFees) || null);
        }
      } catch (e) {
        setCourseInfo(null);
        setComputedTuition(null);
      }
    };

    fetchCourse();
  }, [student?.courseId, student?.studentId, student?.grade, student?.gradeJP, student?.totalFees]);

  // --- Previous year remaining ---
  useEffect(() => {
    if (!student?.studentId) return;
    let mounted = true;

    (async () => {
      try {
        const today = new Date();
        const academicYear = getAcademicYear(today);
        const parsedCode = parseInt(String(student.studentId || "").slice(1, 3), 10);
        let parsedEY = 2000 + (Number.isFinite(parsedCode) ? parsedCode : 0);
        if (parsedEY > academicYear) parsedEY -= 100;
        const entranceYear = student.entranceYear || parsedEY;
        const { gradeNum } = getGradeInfo(entranceYear, today);
        if (gradeNum < 2) { if (mounted) setPrevYearRemaining(0); return; }

        const prevAcademicYear = academicYear - 1;
        const res = await fetch(`/api/students/${student.studentId}/schedules`);
        if (!res.ok || !mounted) return;
        const docs = await res.json();
        const prevDocs = docs.filter((d) => typeof d.month === "string" && d.month.startsWith(`${prevAcademicYear}-`));
        const totalDue = prevDocs.reduce((s, d) => s + (Number(d.dueAmount) || 0), 0);
        const totalPaid = prevDocs.reduce((s, d) => s + (Number(d.paidAmount) || 0), 0);
        if (mounted) setPrevYearRemaining(Math.max(totalDue - totalPaid, 0));
      } catch (e) {
        if (mounted) setPrevYearRemaining(null);
      }
    })();

    return () => { mounted = false; };
  }, [student?.studentId, student?.entranceYear]);

  // Lightbox keyboard close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Receipt upload ---
  const handleReceiptUpload = async (targetMonth) => {
    if (!file || !student) return alert("ファイルを選択してください。");
    const numericAmount = Number(String(amount).replace(/[^0-9.-]/g, ""));
    if (!numericAmount || numericAmount <= 0) return alert("有効な金額を入力してください（例: 80000）");
    setUploading(true);

    try {
      const compressImage = async (inputFile, maxWidth = 1200, quality = 0.8) => {
        try {
          const bitmap = await createImageBitmap(inputFile);
          const scale = Math.min(1, maxWidth / bitmap.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        } catch (e) { return inputFile; }
      };

      let uploadFile = file;
      try {
        const compressed = await compressImage(file, 1200, 0.8);
        if (compressed?.size < file.size) {
          uploadFile = new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), { type: compressed.type });
        }
      } catch (e) { uploadFile = file; }

      const toBase64 = (f) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

      const base64Data = await toBase64(uploadFile);
      const monthValue = targetMonth || student.startMonth || new Date().toISOString().slice(0, 7);

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.studentId,
          course: student.courseId || "未設定",
          receiptBase64: base64Data,
          amount: numericAmount,
          paymentMethod: "銀行振込",
          status: "支払い済み",
          month: monthValue,
        }),
      });

      if (!res.ok) throw new Error("upload failed");
      alert("支払い情報を保存しました！");
      setFile(null);
      setAmount("");
      await fetchPayments();
    } catch (err) {
      console.error("アップロードエラー:", err);
      alert("アップロードに失敗しました。");
    } finally {
      setUploading(false);
    }
  };

  // --- Delete payment ---
  const handleDeletePayment = async (paymentId) => {
    if (!paymentId) return;
    if (!confirm("この支払い履歴を削除してもよろしいですか？")) return;
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setPayments((prev) => prev.filter((p) => p.paymentId !== paymentId && p.id !== paymentId));
    } catch (err) {
      alert("削除に失敗しました。");
    }
  };

  const computeMissingMonths = () => {
    if (!student) return [];
    const startMonth = student.startMonth || new Date().toISOString().slice(0, 7);
    const [sy, sm] = startMonth.split("-").map(Number);
    let cur = new Date(sy, (sm || 1) - 1, 1);
    const now = new Date();
    const months = [];
    while (cur <= now && months.length < 24) {
      months.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
    const paidMonths = new Set(payments.map((p) => p.month));
    return months.filter((m) => !paidMonths.has(m)).slice(-3);
  };
  const reminders = computeMissingMonths();

  const sendReminderEmail = async () => {
    if (!student) return alert("学生情報が見つかりません。");
    if (!reminders?.length) return alert("送るべき未払いの月がありません。");
    try {
      const res = await fetch("/api/student/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.studentId,
          email: session?.user?.email || student.email,
          name: student.name || session?.user?.name,
          reminders,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("リマインダーメールを送信しました。");
    } catch (err) {
      alert("リマインダーメールの送信に失敗しました。");
    }
  };

  if (status === "unauthenticated") {
    return (
      <div className={styles.center}>
        <h2>サインインしてください</h2>
        <button className={styles.primaryBtn} onClick={() => signIn()}>サインイン</button>
      </div>
    );
  }

  // Payment calculations
  const baseTotal = Number(courseInfo?.totalFee ?? courseInfo?.pricePerMonth ?? computedTuition ?? student?.totalFees ?? 0);
  const totalDiscount = discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const total = Math.max(baseTotal - totalDiscount, 0);
  const paidFromPayments = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paid = paidFromPayments || Number(student?.paidAmount || 0);
  const remainingBase = Math.max(total - paid, 0);
  const remaining = Math.max(remainingBase + (prevYearRemaining || 0), 0);
  const progress = total ? Math.min((paid / total) * 100, 100) : 0;

  // Display name
  const makeOrdinal = (n) => {
    if (!Number.isFinite(n)) return `${n}`;
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    switch (n % 10) { case 1: return `${n}st`; case 2: return `${n}nd`; case 3: return `${n}rd`; default: return `${n}th`; }
  };
  let displayStudentYear = null;
  if (student?.studentId) {
    const code = parseInt(String(student.studentId).slice(1, 3), 10);
    if (!isNaN(code)) {
      const today = new Date();
      displayStudentYear = getAcademicYear(today) - (2000 + code) + 1;
      if (displayStudentYear < 1) displayStudentYear = 1;
    }
  }
  const studentYearJP = student?.year || student?.gradeJP || (displayStudentYear ? `${displayStudentYear}年生` : null);
  const studentYearEN = student?.grade || (displayStudentYear ? `${makeOrdinal(displayStudentYear)} Year` : null);
  const rawCourseName = courseInfo?.name || student?.courseId || session?.user?.courseName || "未設定";
  const hasJapanese = /[぀-ヿ一-龯]/.test(String(rawCourseName));
  let courseDisplayName = rawCourseName;
  if (courseInfo?.year) courseDisplayName = `${rawCourseName} ${courseInfo.year}`.trim();
  else if (hasJapanese && studentYearJP) courseDisplayName = `${rawCourseName} ${studentYearJP}`.trim();
  else if (!hasJapanese && studentYearEN) courseDisplayName = `${rawCourseName} ${studentYearEN}`.trim();

  return (
    <main className={styles.container}>
      <header className={styles.tabs}>
        {["overview", "history", "upload", "profile"].map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.active : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "overview" ? "概要" : tab === "history" ? "毎月の支払い" : tab === "upload" ? "レシートをアップロード" : "プロフィール"}
          </button>
        ))}
      </header>

      {activeTab === "overview" && (
        <section className={styles.card}>
          <h1 className={styles.title}>支払い状況</h1>
          <div className={styles.infoBox}><div>コース: {courseDisplayName}</div></div>
          <div className={styles["progress-row"]}>
            <span className={styles.label}>支払い進捗</span>
            <span className={styles.percent}>{progress.toFixed(1)}%</span>
          </div>
          <div className={styles["progress-wrap"]}>
            <div className={styles["progress-bar"]} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.stats}>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>総学費</div>
              <div className={styles["stat-value"]}>{total.toLocaleString()}円</div>
            </article>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>支払い済み</div>
              <div className={`${styles["stat-value"]} ${styles.paid}`}>{paid.toLocaleString()}円</div>
            </article>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>残り</div>
              <div className={`${styles["stat-value"]} ${styles.remain}`}>{remaining.toLocaleString()}円</div>
            </article>
            {typeof prevYearRemaining === "number" && prevYearRemaining > 0 && (
              <article className={styles.stat}>
                <div className={styles["stat-label"]}>
                  前年度（{(new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1) - 1}年度）の残り
                </div>
                <div className={styles["stat-value"]}>{prevYearRemaining.toLocaleString()}円</div>
              </article>
            )}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.paymentTable}>
              <tbody>
                {payments.map((p) => {
                  const date = p.createdAt ? new Date(p.createdAt) : new Date();
                  return (
                    <tr key={p.paymentId || p.id}>
                      <td data-label="日付">{date.toLocaleDateString("ja-JP")}</td>
                      <td data-label="時間">{date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td data-label="金額">¥{p.amount?.toLocaleString()}</td>
                      <td data-label="支払方法">{p.paymentMethod || "-"}</td>
                      <td data-label="レシート">
                        <div className={styles.paymentAction}>
                          {p.receiptBase64 ? (
                            <img src={p.receiptBase64} alt={`receipt-${p.paymentId}`} className={receiptStyles.thumb} onClick={() => setLightboxSrc(p.receiptBase64)} />
                          ) : (
                            <div className={receiptStyles.placeholder}><span className={receiptStyles.placeholderText}>No image</span></div>
                          )}
                          <button className={styles.secondaryBtn} onClick={() => handleDeletePayment(p.paymentId || p.id)}>削除</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lightboxSrc && (
            <div className={receiptStyles.modal} onClick={() => setLightboxSrc(null)} role="dialog" aria-modal="true">
              <div className={receiptStyles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button className={receiptStyles.closeBtn} onClick={() => setLightboxSrc(null)} aria-label="閉じる">×</button>
                <img src={lightboxSrc} alt="receipt-large" className={receiptStyles.modalImage} />
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section className={styles.card}>
          <PaymentSchedule student={student} courseInfo={courseInfo} payments={payments} />
        </section>
      )}

      {activeTab === "upload" && (
        <section className={styles.card}>
          <h2>レシートをアップロード</h2>
          <div style={{ marginTop: 4, padding: 12, border: "1px solid #eee", borderRadius: 8, background: "#fff" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label>金額:<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例: 86000" style={{ marginLeft: 8 }} /></label>
              <label>対象月:<input type="month" value={receiptMonth} onChange={(e) => setReceiptMonth(e.target.value)} style={{ marginLeft: 8 }} /></label>
              <label>ファイル:<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0])} style={{ marginLeft: 8 }} /></label>
              <button onClick={() => handleReceiptUpload(receiptMonth || undefined)} disabled={uploading}>
                {uploading ? "アップロード中..." : "OK"}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === "profile" && (
        <section className={styles.card}>
          <h2 style={{ textAlign: "center" }}>プロフィール</h2>
          <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <p style={{ margin: "6px 0" }}>名前: {student?.name || session?.user?.name}</p>
            <p style={{ margin: "6px 0" }}>メール: {session?.user?.email}</p>
            <p style={{ margin: "6px 0" }}>学籍番号: {student?.studentId || "未登録"}</p>
          </div>
        </section>
      )}
    </main>
  );
}
