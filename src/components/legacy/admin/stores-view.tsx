"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { useState } from "react";

const initialStores = [
  { code: "DEMO-001", name: "デモ店舗・標準", area: "東京エリア", status: "稼働中" },
  { code: "DEMO-002", name: "デモ店舗・24時間", area: "関西エリア", status: "稼働中" },
  { code: "DEMO-003", name: "デモ店舗・モール", area: "福岡エリア", status: "要確認" },
];

export default function StoresPage() {
  const [stores, setStores] = useState(initialStores);
  const [name, setName] = useState("");

  const toggleStatus = (code: string) => {
    setStores((current) =>
      current.map((store) =>
        store.code === code
          ? { ...store, status: store.status === "稼働中" ? "要確認" : "稼働中" }
          : store,
      ),
    );
  };

  const addStore = () => {
    if (!name.trim()) return;
    const code = `DEMO-${String(stores.length + 1).padStart(3, "0")}`;
    setStores((current) => [...current, { code, name: name.trim(), area: "新規エリア", status: "稼働中" }]);
    setName("");
  };

  return (
    <PageLayout page="stores">

      <section className="page-grid double">
        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>店舗一覧</h2>
              <small>営業状況と担当エリアを確認</small>
            </div>
          </div>

          <div className="stack-list">
            {stores.map((store) => (
              <div key={store.code} className="list-card">
                <div>
                  <strong>{store.name}</strong>
                  <small>{store.code}</small>
                </div>
                <div className="list-meta">
                  <span>{store.area}</span>
                  <span className={`badge ${store.status === "要確認" ? "warning" : "ok"}`}>{store.status}</span>
                </div>
                <button type="button" className="primary-button small" onClick={() => toggleStatus(store.code)}>
                  {store.status === "稼働中" ? "要確認へ" : "稼働中へ"}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>店舗追加</h2>
              <small>新店舗の登録とアカウント更新</small>
            </div>
          </div>

          <label className="field">
            <span>店舗名</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: デモ店舗・新宿" />
          </label>

          <button type="button" className="primary-button" onClick={addStore}>店舗を登録</button>
        </article>
      </section>
    </PageLayout>
  );
}
