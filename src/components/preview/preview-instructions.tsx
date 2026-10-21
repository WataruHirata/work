"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { confirmDemoInstruction, demoInstructions, demoStores, targetInstructions, type DemoInstruction } from "@/mocks/workspaces";

const storageKey = "minoriya-instruction-preview-v1";
const initial = JSON.stringify(demoInstructions);
let fallback = initial;
function subscribe(listener: () => void) { window.addEventListener("instruction-preview", listener); return () => window.removeEventListener("instruction-preview", listener); }
function snapshot() { try { return sessionStorage.getItem(storageKey) ?? fallback; } catch { return fallback; } }
function save(rows: DemoInstruction[]) { fallback = JSON.stringify(rows); try { sessionStorage.setItem(storageKey, fallback); } catch { /* In-memory preview still works without storage. */ } window.dispatchEvent(new Event("instruction-preview")); }
function parse(value: string): DemoInstruction[] { try { const data = JSON.parse(value); return Array.isArray(data) && data.every((r) => typeof r.id === "string" && typeof r.title === "string" && typeof r.price === "number" && Array.isArray(r.stores) && Array.isArray(r.confirmedStores)) ? data : demoInstructions; } catch { return demoInstructions; } }

export function PreviewInstructions({ headquarters }: { headquarters: boolean }) {
  const rows = parse(useSyncExternalStore(subscribe, snapshot, () => initial));
  const [store, setStore] = useState(demoStores[0]);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Omit<DemoInstruction, "id" | "confirmedStores"> | null>(null);
  const visible = headquarters ? rows : targetInstructions(rows, store);
  const unread = visible.filter((r) => !r.confirmedStores.includes(store)).length;
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const stores = data.getAll("stores").map(String).filter((s) => demoStores.includes(s));
    const price = Number(data.get("price"));
    if (!stores.length) { setMessage("通知先を1店舗以上選択してください。"); return; }
    if (!Number.isSafeInteger(price) || price < 0 || price > 2147483647) { setMessage("指示価格を確認してください。"); return; }
    setReview({ kind: String(data.get("kind")), title: String(data.get("title")).trim(), product: String(data.get("product")), price, effectiveAt: String(data.get("effectiveAt")), message: String(data.get("message")).trim(), stores });
    setMessage("");
  }
  return <div><div className="panel-head"><div><h2>{headquarters ? "本部の特売・価格変更指示" : "本部からの変更指示・お知らせ"}</h2><p className="muted">同じタブ内で本部の発行 → 指定店舗への通知 → 店舗確認を試せます。入力は架空の内容のみ使用してください。</p></div><span className="status">{visible.length}件{!headquarters && ` / 未確認 ${unread}件`}</span></div>
    {!headquarters && <label className="field">プレビュー対象店舗<select value={store} onChange={(e) => setStore(e.target.value)}>{demoStores.map((s) => <option key={s}>{s}</option>)}</select></label>}
    {headquarters && <details open><summary>変更指示を作成</summary><form onSubmit={prepare} className="instruction-form"><div className="workspace-fields">
      <label className="field">種類<select name="kind"><option>価格変更</option><option>特売作業</option></select></label>
      <label className="field">件名<input name="title" maxLength={200} required placeholder="例：週末特売の値札変更" /></label>
      <label className="field">商品<select name="product"><option>サンプルりんご</option><option>サンプル牛乳</option></select></label>
      <label className="field">指示価格（円）<input name="price" type="number" min="0" max="2147483647" step="1" required /></label>
      <label className="field">実施日時（日本時間）<input name="effectiveAt" type="datetime-local" required /></label>
    </div><label className="field">変更内容・作業指示<textarea name="message" maxLength={2000} required rows={3} /></label><fieldset className="instruction-targets"><legend>通知先店舗</legend>{demoStores.map((s) => <label key={s}><input name="stores" type="checkbox" value={s} />{s}</label>)}</fieldset><button className="primary-button">通知前の内容確認</button></form></details>}
    {headquarters && review && <section className="instruction-card" aria-labelledby="instruction-review"><h3 id="instruction-review">発行内容の確認</h3><p>{review.kind} · {review.title}</p><p>{review.product} / ¥{review.price.toLocaleString("ja-JP")} / {review.effectiveAt.replace("T", " ")}（日本時間）</p><p>{review.message}</p><p>通知先：{review.stores.join("、")}</p><div className="button-row"><button className="ghost-button" onClick={() => setReview(null)}>修正する</button><button className="primary-button" onClick={() => { save([{ ...review, id: `DEMO-${crypto.randomUUID()}`, confirmedStores: [] }, ...rows]); setReview(null); setMessage("指定店舗へ通知しました（デモ）。店舗のお知らせ画面で通知先を選んで受信を確認できます。"); }}>指定店舗へ通知する（デモ）</button></div></section>}
    {message && <p role="status">{message}</p>}
    {!visible.length && <p>この店舗への変更指示はありません。</p>}
    {visible.map((r) => <article className="instruction-card" key={r.id}><span className="status">{r.kind} · {headquarters ? `${r.confirmedStores.length}/${r.stores.length}店舗確認済み` : r.confirmedStores.includes(store) ? "確認済み" : "未確認"}</span><h3>{r.title}</h3><p>{r.product} · 指示価格 ¥{r.price.toLocaleString("ja-JP")} · {r.effectiveAt.replace("T", " ")}（日本時間）</p><p className="instruction-message">{r.message}</p><p className="muted">POS反映状況：未接続（表示例）</p>{headquarters ? <ul>{r.stores.map((s) => <li key={s}>{s}：{r.confirmedStores.includes(s) ? "確認済み" : "未確認"}</li>)}</ul> : <button className="ghost-button" disabled={r.confirmedStores.includes(store)} onClick={() => { save(confirmDemoInstruction(rows, r.id, store)); setMessage("指示内容の確認を記録しました（デモ）。POS反映・売場作業の完了を意味しません。"); }}>{r.confirmedStores.includes(store) ? "確認済み" : "指示内容を確認しました（デモ）"}</button>}</article>)}
    <button className="ghost-button" onClick={() => { save(demoInstructions); setReview(null); setMessage("このタブの指示プレビューを初期状態に戻しました。"); }}>指示プレビューを初期状態に戻す</button>
  </div>;
}
