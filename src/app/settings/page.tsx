"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { useState } from "react";

const toggleItems = [
  { key: "audit", label: "監査ログ記録", value: true },
  { key: "approval", label: "承認フロー有効化", value: true },
  { key: "notifications", label: "通知送信", value: true },
  { key: "autoSync", label: "自動同期", value: false },
] as const;

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    audit: true,
    approval: true,
    notifications: true,
    autoSync: false,
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <PageLayout page="settings">
      <section className="page-grid double">
        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>業務設定</h2>
              <small>モック環境での運用を管理</small>
            </div>
          </div>

          <div className="toggle-list">
            {toggleItems.map(({ key, label }) => (
              <button
                type="button"
                key={key}
                className="toggle-row"
                onClick={() => toggle(key as keyof typeof settings)}
              >
                <span>{label}</span>
                <span className={`switch ${settings[key as keyof typeof settings] ? "on" : ""}`}>
                  <i />
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>運用メモ</h2>
              <small>本番前に確認するポイント</small>
            </div>
          </div>

          <div className="note-box">
            <p>Supabase 接続済みのため、認証・ロール・売上データの同期状態を確認できます。</p>
            <p>本番環境に移行する前に、権限、監査、請求・税処理とSLAを確認してください。</p>
          </div>

          <button type="button" className="primary-button" onClick={() => setSaved(true)}>
            {saved ? "保存済み" : "設定を保存"}
          </button>
        </article>
      </section>
    </PageLayout>
  );
}
