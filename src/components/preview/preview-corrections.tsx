"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import {
  correctionLabels,
  decideCorrection,
  initialCorrections,
  type CorrectionPreview,
} from "@/mocks/corrections";
import { demoStores } from "@/mocks/workspaces";

const key = "minoriya-correction-preview-v1";
const initial = JSON.stringify(initialCorrections);
let fallback = initial;
const subscribe = (listener: () => void) => {
  window.addEventListener("correction-preview", listener);
  return () => window.removeEventListener("correction-preview", listener);
};
const snapshot = () => {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
function save(rows: CorrectionPreview[]) {
  fallback = JSON.stringify(rows);
  try {
    sessionStorage.setItem(key, fallback);
  } catch {
    /* Use memory if session storage is unavailable. */
  }
  window.dispatchEvent(new Event("correction-preview"));
}
function parse(value: string): CorrectionPreview[] {
  try {
    const rows = JSON.parse(value);
    return Array.isArray(rows) &&
      rows.every(
        (row) =>
          typeof row.id === "string" &&
          typeof row.before === "number" &&
          typeof row.after === "number" &&
          Object.hasOwn(correctionLabels, row.status),
      )
      ? rows
      : initialCorrections;
  } catch {
    return initialCorrections;
  }
}

export function PreviewCorrections({
  mode,
}: {
  mode: "store" | "headquarters" | "notices";
}) {
  const rows = parse(useSyncExternalStore(subscribe, snapshot, () => initial));
  const [store, setStore] = useState(demoStores[0]);
  const [stage, setStage] = useState<"area" | "operations">("operations");
  const [message, setMessage] = useState("");
  const visible =
    mode === "headquarters" ? rows : rows.filter((row) => row.store === store);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const after = Number(data.get("after"));
    const reason = String(data.get("reason")).trim();
    if (!Number.isSafeInteger(after) || after < 0 || !reason) return;
    save([
      {
        id: `DEMO-${crypto.randomUUID()}`,
        store,
        date: "2026-10-20",
        before: 900000,
        after,
        reason,
        status: "pending_area",
        comment: "",
      },
      ...rows,
    ]);
    setMessage(
      "修正依頼を送信し、エリアと本部の承認画面へ通知しました（デモ）。承認前の売上は変更していません。",
    );
    event.currentTarget.reset();
  }
  function decide(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      save(
        decideCorrection(
          rows,
          id,
          stage,
          data.get("decision") === "approve",
          String(data.get("comment")),
        ),
      );
      setMessage(
        "決定を記録し、次の承認担当または店舗へ通知しました（デモ）。",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "内容を確認してください。",
      );
    }
  }
  return (
    <section>
      <h2>
        {mode === "headquarters"
          ? "店舗からの売上修正依頼・通知"
          : "売上修正依頼と結果のお知らせ"}
      </h2>
      <p>
        店舗の申請 → エリア一次承認 → 本部最終承認 →
        店舗への結果通知を、同じタブで試せます。
      </p>
      {mode === "headquarters" ? (
        <label className="field">
          操作する承認段階（デモ）
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as "area" | "operations")}
          >
            <option value="operations">店舗運営本部・最終承認</option>
            <option value="area">エリア・一次承認</option>
          </select>
        </label>
      ) : (
        <label className="field">
          プレビュー対象店舗
          <select value={store} onChange={(e) => setStore(e.target.value)}>
            {demoStores.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      {mode === "store" && (
        <form className="instruction-form" onSubmit={submit}>
          <h3>後日の売上修正を申請</h3>
          <p>{store} · 営業日 2026/10/20 · 変更前 ¥900,000（サンプル）</p>
          <label className="field">
            修正後売上（円）
            <input
              name="after"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              required
            />
          </label>
          <label className="field">
            修正理由
            <textarea name="reason" required maxLength={500} />
          </label>
          <label className="instruction-confirm">
            <input type="checkbox" required />
            営業日・変更前後の金額・理由を確認しました（デモ）
          </label>
          <button className="primary-button">修正依頼を送信する（デモ）</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {!visible.length && <p>この店舗の修正依頼・結果通知はありません。</p>}
      {visible.map((row) => (
        <article className="instruction-card" key={row.id}>
          <span className="status">{correctionLabels[row.status]}</span>
          <h3>
            {row.store} · {row.date} の売上修正依頼
          </h3>
          <p>
            変更前 ¥{row.before.toLocaleString("ja-JP")} → 変更後 ¥
            {row.after.toLocaleString("ja-JP")} / 差額{" "}
            {row.after - row.before >= 0 ? "+" : ""}
            {(row.after - row.before).toLocaleString("ja-JP")}円
          </p>
          <p className="instruction-message">理由：{row.reason}</p>
          <p>
            {row.status === "approved"
              ? "本部が最終承認しました。店舗への承認通知と売上反映の表示例です。"
              : row.status === "rejected"
                ? `差戻し通知：${row.comment}`
                : "修正依頼を承認担当へ通知済み。最終承認までは元の売上を維持します。"}
          </p>
          {mode === "headquarters" &&
            ((stage === "area" && row.status === "pending_area") ||
              (stage === "operations" &&
                row.status === "pending_operations")) && (
              <form
                className="instruction-form"
                onSubmit={(e) => decide(e, row.id)}
              >
                <label className="field">
                  決定
                  <select name="decision">
                    <option value="approve">承認</option>
                    <option value="reject">差戻し</option>
                  </select>
                </label>
                <label className="field">
                  コメント（差戻し時は必須）
                  <input name="comment" maxLength={500} />
                </label>
                <label className="instruction-confirm">
                  <input type="checkbox" required />
                  変更前後と理由を確認しました（デモ）
                </label>
                <button className="primary-button">
                  決定して通知する（デモ）
                </button>
              </form>
            )}
        </article>
      ))}
      <div className="button-row">
        <Link
          className="ghost-button"
          href={mode === "headquarters" ? "/store/notices" : "/admin/approvals"}
        >
          {mode === "headquarters"
            ? "店舗の結果通知を確認"
            : "本部の承認プレビューへ"}
        </Link>
        <button
          className="ghost-button"
          onClick={() => {
            save(initialCorrections);
            setMessage("修正依頼のプレビューを初期化しました。");
          }}
        >
          修正依頼プレビューを初期化
        </button>
      </div>
    </section>
  );
}
