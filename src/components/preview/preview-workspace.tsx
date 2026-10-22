"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageLayout } from "@/components/ui/page-layout";
import { PreviewInstructions } from "@/components/preview/preview-instructions";
import { PreviewCorrections } from "@/components/preview/preview-corrections";
import { filterPreviewRows, previewSpecs, type PreviewRow } from "@/mocks/workspaces";
import { uiConfig, type PageId } from "@/config/ui";
import { StateBadge } from "@/components/ui/state-badge";

export function PreviewWorkspace({ feature }: { feature: PageId }) {
  const spec = previewSpecs[feature];
  const [rows, setRows] = useState<PreviewRow[]>(spec?.rows ?? []);
  const [search, setSearch] = useState("");
  const [store, setStore] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const visible = filterPreviewRows(rows, search, store, status);
  function addRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    const value = Number(data.get("value"));
    if (!name || !Number.isSafeInteger(value) || value < 0) return;
    setRows((current) => [
      {
        id: `DEMO-${crypto.randomUUID().slice(0, 8)}`,
        name,
        value,
        store: "デモ中央店",
        date: "2026-10-21",
        status: "下書き（デモ）",
        detail: String(data.get("detail")),
      },
      ...current,
    ]);
    setMessage("プレビューに追加しました。実データへの登録・外部送信は行っていません。");
    event.currentTarget.reset();
  }
  return (
    <PageLayout page={feature}>
      <section className="page-panel">
        <div className="demo-banner">
          <span className="demo-badge">PREVIEW</span>
          <span>
            未接続機能の操作プレビューです。すべて架空データで、操作は実業務に反映されません。
          </span>
        </div>
        <p className="muted">データ連携後は、この一覧に担当範囲のデータ・処理結果を表示します。</p>
      </section>
      {feature === "storeOperations" || feature === "approvals" ? (
        <section className="page-panel">
          <PreviewCorrections mode={feature === "approvals" ? "headquarters" : "store"} />
        </section>
      ) : feature === "campaigns" || feature === "storeCampaigns" || feature === "storeNotices" ? (
        <section className="page-panel">
          <PreviewInstructions headquarters={feature === "campaigns"} feature={feature} />
        </section>
      ) : spec ? (
        <>
          <section className="page-panel">
            <form className="workspace-fields" onSubmit={(e) => e.preventDefault()}>
              <label className="field">
                名称・内容を検索
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="名称・コードを入力"
                />
              </label>
              <label className="field">
                店舗
                <select value={store} onChange={(e) => setStore(e.target.value)}>
                  <option value="">すべて</option>
                  {[...new Set(rows.map((r) => r.store))].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                状態
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">すべて</option>
                  {[...new Set(rows.map((r) => r.status))].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setSearch("");
                  setStore("");
                  setStatus("");
                }}
              >
                絞り込みを解除
              </button>
            </form>
          </section>
          <section className="page-panel">
            <div className="stat-row">
              <div>
                <span>表示件数</span>
                <strong>{visible.length}件</strong>
              </div>
              <div>
                <span>{spec.columns[1]}の合計（サンプル）</span>
                <strong>
                  {visible.reduce((sum, r) => sum + r.value, 0).toLocaleString("ja-JP")}
                  {spec.unit}
                </strong>
              </div>
            </div>
            <div className="workspace-table">
              <table className="data-table">
                <caption>{uiConfig.pages[feature].label}の表示例</caption>
                <thead>
                  <tr>
                    <th scope="col">{spec.columns[0]}</th>
                    <th scope="col">店舗</th>
                    <th scope="col">{spec.columns[1]}</th>
                    <th scope="col">状態</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{r.name}</th>
                      <td>{r.store}</td>
                      <td>
                        {r.value.toLocaleString("ja-JP")}
                        {spec.unit}
                      </td>
                      <td>
                        <StateBadge
                          state={r.status}
                          tone={r.status === spec.nextStatus ? "success" : "warning"}
                        />
                      </td>
                      <td>
                        <button
                          className="ghost-button"
                          type="button"
                          aria-expanded={selected === r.id}
                          onClick={() => setSelected(selected === r.id ? null : r.id)}
                        >
                          {selected === r.id ? "詳細を閉じる" : "詳細"}
                          <span className="sr-only">：{r.name}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <p role="status">条件に一致するデータはありません。絞り込みを変更してください。</p>
            )}
            {selected &&
              rows
                .filter((r) => r.id === selected)
                .map((r) => (
                  <div className="instruction-card" key={r.id}>
                    <h2>{r.name}</h2>
                    <p>
                      {r.id} · {r.date} · {r.store}
                    </p>
                    <p>{r.detail}</p>
                    {spec.action && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setRows((current) =>
                            current.map((item) =>
                              item.id === r.id
                                ? {
                                    ...item,
                                    status: spec.nextStatus ?? "確認済み（デモ）",
                                  }
                                : item,
                            ),
                          );
                          setMessage(
                            `${spec.action}の操作例を反映しました。実業務の状態は変更していません。`,
                          );
                        }}
                      >
                        <label className="instruction-confirm">
                          <input type="checkbox" required />
                          対象と内容を確認しました（デモ）
                        </label>
                        <button className="primary-button" disabled={r.status === spec.nextStatus}>
                          {spec.action}（デモ）
                        </button>
                      </form>
                    )}
                  </div>
                ))}
          </section>
          {spec.creatable && (
            <section className="page-panel">
              <details>
                <summary>入力・登録を試す（デモ）</summary>
                <form className="instruction-form" onSubmit={addRow}>
                  <label className="field">
                    {spec.columns[0]}
                    <input name="name" maxLength={200} required />
                  </label>
                  <label className="field">
                    {spec.columns[1]}（{spec.unit}）
                    <input name="value" type="number" min="0" max="2147483647" step="1" required />
                  </label>
                  <label className="field">
                    内容・理由
                    <textarea name="detail" maxLength={500} required />
                  </label>
                  <button className="primary-button">プレビューに追加</button>
                </form>
              </details>
            </section>
          )}
          {message && (
            <p className="page-panel" role="status">
              {message}
            </p>
          )}
        </>
      ) : (
        <section className="page-panel">
          <p>表示対象をサイドバーから選択してください。</p>
        </section>
      )}
      {feature === "storeSales" && (
        <section className="page-panel">
          <h2>在庫連携の表示例</h2>
          <p>サンプルりんご · デモ中央店 / 青果売場 · 在庫 120個</p>
          <p className="muted">
            取得日時: 2026/10/21 08:00（架空） · 基幹接続後に在庫と最終取得日時を表示します。
          </p>
        </section>
      )}
      {feature === "campaigns" && (
        <section className="page-panel">
          <Link className="ghost-button" href="/store/notices">
            店舗のお知らせで受信を確認
          </Link>
        </section>
      )}
      {feature === "storeNotices" && (
        <section className="page-panel">
          <PreviewCorrections mode="notices" />
        </section>
      )}
    </PageLayout>
  );
}
