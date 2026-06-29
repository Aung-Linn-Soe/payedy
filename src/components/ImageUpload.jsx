"use client";
import React, { useState } from "react";
import Image from "next/image";

export default function ImageUpload({ studentId, month, onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [amount, setAmount] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");

  function handleFileChange(e) {
    setError(""); setUrl(""); setPreview("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("画像ファイルを選択してください"); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  }

  async function upload() {
    if (!file || !studentId) return;
    setProgress(10); setError("");
    const reader = new FileReader();
    reader.onerror = () => { setError("画像の読み込みに失敗しました"); setProgress(0); };
    reader.onload = async () => {
      const base64Data = reader.result;
      setProgress(50);
      try {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, receiptBase64: base64Data, amount: Number(amount) || 0, month: month || new Date().toISOString().slice(0, 7), status: "支払い済み" }),
        });
        if (!res.ok) throw new Error("upload failed");
        const data = await res.json();
        setProgress(100); setUrl("saved");
        if (onUploaded) onUploaded(data);
      } catch (err) { setError(err.message || "アップロードに失敗しました"); setProgress(0); }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <label style={{ display: "block", marginBottom: 8 }}>画像を選択してアップロード</label>
      <input type="number" placeholder="金額" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ marginBottom: 8 }} />
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <div style={{ marginTop: 12 }}><button onClick={upload} disabled={!file || !amount}>Upload</button></div>
      {progress > 0 && progress < 100 && <div style={{ marginTop: 8 }}>Progress: {progress}%</div>}
      {error && <div style={{ color: "red", marginTop: 8 }}>Error: {error}</div>}
      {url === "saved" && <div style={{ color: "green", marginTop: 8 }}>保存しました！</div>}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <Image src={preview} alt="preview" width={600} height={400} style={{ maxWidth: "100%", height: "auto" }} sizes="(max-width: 640px) 100vw, 600px" unoptimized />
        </div>
      )}
    </div>
  );
}
