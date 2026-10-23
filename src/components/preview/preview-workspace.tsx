"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageLayout } from "@/components/ui/page-layout";
import { PreviewInstructions } from "@/components/preview/preview-instructions";
import { PreviewCorrections } from "@/components/preview/preview-corrections";
import { filterPreviewRows, previewSpecs, type PreviewRow } from "@/mocks/workspaces";
import { uiConfig, type PageId } from "@/config/ui";
import { StateBadge } from "@/components/ui/state-badge";
import { CollapsibleTable } from "@/components/ui/collapsible-table";

export function PreviewWorkspace({ feature }: { feature: PageId }) {
  const spec = previewSpecs[feature];
  const [rows, setRows] = useState<PreviewRow[]>(spec?.rows ?? []);
  const [search, setSearch] = useState("");
  const [store, setStore] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const visible = filterPreviewRows(rows, search, store, status);
  const hasFilters = !["storeSales", "storeOrders"].includes(feature);
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
  if (feature === "storeSales") {
    return (
      <PageLayout page={feature}>
        <section className="page-panel">
          <div className="demo-banner">
            <span className="demo-badge">PREVIEW</span>
            <span>架空データの操作プレビューです。実業務には反映されません。</span>
          </div>
        </section>
        <div className="page-grid double store-sales-inventory-grid">
          <section className="page-panel">
            <h2>営業日別売上</h2>
            <CollapsibleTable
              caption="登録店舗の営業日別売上"
              head={
                <tr>
                  <th scope="col">営業日</th>
                  <th scope="col">売上</th>
                  <th scope="col">状態</th>
                </tr>
              }
            >
              {visible.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.name}</th>
                  <td>{row.value.toLocaleString("ja-JP")}円</td>
                  <td>{row.status === "締め前" ? "—" : row.status}</td>
                </tr>
              ))}
            </CollapsibleTable>
          </section>
          <section className="page-panel">
            <PreviewCorrections mode="store" />
          </section>
        </div>
      </PageLayout>
    );
  }
  if (feature === "storeInventory") {
    const inventory = [
      {
        code: "DEMO-001",
        name: "サンプルりんご",
        category: "青果",
        supplier: "あおば生鮮流通",
        quantity: 120,
      },
      {
        code: "DEMO-002",
        name: "サンプル牛乳",
        category: "日配",
        supplier: "ひかり食品卸",
        quantity: 48,
      },
      {
        code: "DEMO-003",
        name: "サンプル冷凍うどん",
        category: "冷凍食品",
        supplier: "北斗冷凍物流",
        quantity: 32,
      },
    ];
    const inventoryRows = inventory.filter(
      (row) =>
        `${row.code} ${row.name}`.includes(search.trim()) &&
        (!status || row.category === status) &&
        (!store || row.supplier === store),
    );
    return (
      <PageLayout page={feature}>
        <section className="page-panel">
          <div className="demo-banner">
            <span className="demo-badge">PREVIEW</span>
            <span>架空の在庫データです。実在する卸売業者への送信は行いません。</span>
          </div>
        </section>
        <div className="page-grid double store-sales-inventory-grid">
          <section className="page-panel">
            <h2>在庫を絞り込む</h2>
            <form className="workspace-fields" onSubmit={(event) => event.preventDefault()}>
              <label className="field">
                品目
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="品目コード・商品名"
                />
              </label>
              <label className="field">
                種別
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">すべて</option>
                  {[...new Set(inventory.map((row) => row.category))].map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                業者
                <select value={store} onChange={(event) => setStore(event.target.value)}>
                  <option value="">すべて</option>
                  {[...new Set(inventory.map((row) => row.supplier))].map((supplier) => (
                    <option key={supplier}>{supplier}</option>
                  ))}
                </select>
              </label>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setStore("");
                }}
              >
                絞り込みを解除
              </button>
            </form>
            <Link className="primary-button" href="/store/orders/new">
              発注画面へ
            </Link>
          </section>
          <section className="page-panel">
            <div className="panel-head">
              <h2>在庫一覧</h2>
              <span className="muted">{inventoryRows.length}件</span>
            </div>
            <CollapsibleTable
              caption="登録店舗の商品別在庫"
              head={
                <tr>
                  <th>品目</th>
                  <th>商品名</th>
                  <th>種別</th>
                  <th>業者</th>
                  <th>数量</th>
                </tr>
              }
            >
              {inventoryRows.map((row) => (
                <tr key={row.code}>
                  <th scope="row">{row.code}</th>
                  <td>{row.name}</td>
                  <td>{row.category}</td>
                  <td>{row.supplier}</td>
                  <td>{row.quantity}個</td>
                </tr>
              ))}
            </CollapsibleTable>
          </section>
        </div>
      </PageLayout>
    );
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
      </section>
      {feature === "approvals" ? (
        <section className="page-panel">
          <PreviewCorrections mode="headquarters" />
        </section>
      ) : feature === "campaigns" || feature === "storeCampaigns" || feature === "storeNotices" ? (
        <section className="page-panel">
          <PreviewInstructions headquarters={feature === "campaigns"} feature={feature} />
        </section>
      ) : spec ? (
        <>
          {hasFilters && (
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
          )}
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
            <CollapsibleTable
              caption={`${uiConfig.pages[feature].label}の表示例`}
              head={
                <tr>
                  <th scope="col">{spec.columns[0]}</th>
                  <th scope="col">店舗</th>
                  <th scope="col">{spec.columns[1]}</th>
                  <th scope="col">状態</th>
                  <th scope="col">操作</th>
                </tr>
              }
            >
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
            </CollapsibleTable>
            {!visible.length && (
              <p role="status">
                {hasFilters
                  ? "条件に一致するデータはありません。絞り込みを変更してください。"
                  : "表示できるデータはありません。"}
              </p>
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
