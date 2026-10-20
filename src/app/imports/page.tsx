"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadCsvImport } from "@/lib/supabase/actions";

const initialImports = [
  { store: "デモ店舗・標準", code: "DEMO-001", time: "06:14", state: "完了" },
  { store: "デモ店舗・24時間", code: "DEMO-002", time: "06:12", state: "完了" },
  { store: "デモ店舗・モール", code: "DEMO-003", time: "06:09", state: "要確認" },
  { store: "デモ店舗・駅前", code: "DEMO-004", time: "06:05", state: "途中" },
];

export default function ImportsPage() {
  const [tab, setTab] = useState<"all" | "pending" | "completed">("all");
  const [items, setItems] = useState(initialImports);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  const filteredItems = items.filter((item) => {
    if (tab === "pending") return item.state !== "完了";
    if (tab === "completed") return item.state === "完了";
    return true;
  });

  const retryImport = (code: string) => {
    setItems((current) =>
      current.map((item) =>
        item.code === code ? { ...item, state: "完了", time: "06:22" } : item,
      ),
    );
  };

  async function handleUpload() {
    if (!selectedFile) {
      setStatus("CSVファイルを選択してください");
      return;
    }

    const formData = new FormData();
    formData.append("csvFile", selectedFile);

    try {
      const result = await uploadCsvImport(formData);
      setStatus(`CSVを取り込みました。${result.rows}行を処理しました。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CSV取り込みに失敗しました");
    }
  }

  return (
    <main className="page-shell">
      <header className="page-topbar">
        <div>
          <p className="eyebrow">POS連携</p>
          <h1>受信状況と再取込</h1>
        </div>
        <Link href="/" className="ghost-button">ダッシュボードへ戻る</Link>
      </header>

      <section className="page-panel">
        <div className="panel-head">
          <div>
            <h2>連携ステータス</h2>
            <small>深夜ファイルの受信・再送・失敗状態を確認</small>
          </div>
          <div className="segmented-control">
            <button type="button" className={tab === "all" ? "selected" : ""} onClick={() => setTab("all")}>すべて</button>
            <button type="button" className={tab === "pending" ? "selected" : ""} onClick={() => setTab("pending")}>未完了</button>
            <button type="button" className={tab === "completed" ? "selected" : ""} onClick={() => setTab("completed")}>完了</button>
          </div>
        </div>

        <div className="page-grid double">
          <div className="field">
            <span>CSVファイル</span>
            <input type="file" accept=".csv" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            <button type="button" className="primary-button" onClick={handleUpload}>CSVを取り込む</button>
            {status && <small className="muted">{status}</small>}
          </div>
        </div>

        <div className="stack-list">
          {filteredItems.map((item) => (
            <div key={item.code} className="list-card">
              <div>
                <strong>{item.store}</strong>
                <small>{item.code}</small>
              </div>
              <div className="list-meta">
                <span>{item.time}</span>
                <span className={`badge ${item.state === "要確認" ? "warning" : item.state === "途中" ? "neutral" : "ok"}`}>{item.state}</span>
              </div>
              {item.state !== "完了" && (
                <button type="button" className="primary-button small" onClick={() => retryImport(item.code)}>再取込</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
