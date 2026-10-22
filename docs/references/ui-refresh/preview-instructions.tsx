"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import type { PageId } from "@/config/ui";
import {
  confirmDemoInstruction,
  demoInstructions,
  demoStores,
  targetInstructions,
  type DemoInstruction,
} from "@/mocks/workspaces";
import styles from "./preview-instructions.module.css";

const storageKey = "minoriya-instruction-preview-v1";
const initial = JSON.stringify(demoInstructions);
const store = demoStores[0];
let fallback = initial;

function subscribe(listener: () => void) {
  window.addEventListener("instruction-preview", listener);
  return () => window.removeEventListener("instruction-preview", listener);
}

function snapshot() {
  try {
    return sessionStorage.getItem(storageKey) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(rows: DemoInstruction[]) {
  fallback = JSON.stringify(rows);
  try {
    sessionStorage.setItem(storageKey, fallback);
  } catch {
    // Storageが使用できない場合も画面内では操作を続ける。
  }
  window.dispatchEvent(new Event("instruction-preview"));
}

function parse(value: string): DemoInstruction[] {
  try {
    const data = JSON.parse(value);
    return Array.isArray(data) &&
      data.every(
        (row) =>
          typeof row.id === "string" &&
          typeof row.title === "string" &&
          typeof row.price === "number" &&
          Array.isArray(row.stores) &&
          Array.isArray(row.confirmedStores),
      )
      ? data
      : demoInstructions;
  } catch {
    return demoInstructions;
  }
}

function taskLabel(row: DemoInstruction) {
  return row.kind.includes("終了") ? "値札を通常価格へ戻した" : "値札を特売価格へ変更した";
}

export function PreviewInstructions({
  headquarters,
  feature,
}: {
  headquarters: boolean;
  feature?: PageId;
}) {
  const rows = parse(useSyncExternalStore(subscribe, snapshot, () => initial));
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [review, setReview] = useState<Omit<DemoInstruction, "id" | "confirmedStores"> | null>(
    null,
  );

  const visible = headquarters ? rows : targetInstructions(rows, store);
  const pending = visible.filter((row) => !row.confirmedStores.includes(store)).length;
  const noticesMode = feature === "storeNotices";
  const storeTaskMode = feature === "storeCampaigns";

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const stores = data
      .getAll("stores")
      .map(String)
      .filter((name) => demoStores.includes(name));
    const price = Number(data.get("price"));

    if (!stores.length) {
      setMessage("通知先を1店舗以上選択してください。");
      return;
    }
    if (!Number.isSafeInteger(price) || price < 0 || price > 2147483647) {
      setMessage("指示価格を確認してください。");
      return;
    }

    setReview({
      kind: String(data.get("kind")),
      title: String(data.get("title")).trim(),
      product: String(data.get("product")),
      price,
      effectiveAt: String(data.get("effectiveAt")),
      message: String(data.get("message")).trim(),
      stores,
    });
    setMessage("");
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.heading}>
        <div>
          <h2>
            {headquarters
              ? "本部の特売・価格変更指示"
              : noticesMode
                ? "お知らせ"
                : "特売・価格変更"}
          </h2>
          <p>
            {headquarters
              ? "店舗へ特売・価格変更の指示を発行します。"
              : noticesMode
                ? "対応が必要なお知らせを確認できます。"
                : "値札の変更状況を登録してください。"}
          </p>
        </div>
        {!headquarters && (
          <div className={styles.summary}>
            <strong>{pending}</strong>
            <span>未対応</span>
          </div>
        )}
      </header>

      {headquarters && (
        <details className={styles.createPanel}>
          <summary>変更指示を作成</summary>
          <form onSubmit={prepare} className="instruction-form">
            <div className="workspace-fields">
              <label className="field">
                種類
                <select name="kind">
                  <option>価格変更</option>
                  <option>特売開始</option>
                  <option>特売終了</option>
                </select>
              </label>
              <label className="field">
                件名
                <input name="title" maxLength={200} required />
              </label>
              <label className="field">
                商品
                <select name="product">
                  <option>サンプルりんご</option>
                  <option>サンプル牛乳</option>
                </select>
              </label>
              <label className="field">
                指示価格（円）
                <input name="price" type="number" min="0" max="2147483647" step="1" required />
              </label>
              <label className="field">
                実施日時
                <input name="effectiveAt" type="datetime-local" required />
              </label>
            </div>
            <label className="field">
              変更内容・作業指示
              <textarea name="message" maxLength={2000} required rows={3} />
            </label>
            <fieldset className="instruction-targets">
              <legend>通知先店舗</legend>
              {demoStores.map((name) => (
                <label key={name}>
                  <input name="stores" type="checkbox" value={name} />
                  {name}
                </label>
              ))}
            </fieldset>
            <button className="primary-button">通知前の内容確認</button>
          </form>
        </details>
      )}

      {headquarters && review && (
        <section className={styles.detail} aria-labelledby="instruction-review">
          <h3 id="instruction-review">発行内容の確認</h3>
          <p>
            {review.kind}・{review.title}
          </p>
          <p>
            {review.product}・¥{review.price.toLocaleString("ja-JP")}・
            {review.effectiveAt.replace("T", " ")}
          </p>
          <p>{review.message}</p>
          <p>通知先：{review.stores.join("、")}</p>
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={() => setReview(null)}>
              修正する
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                save([
                  { ...review, id: `DEMO-${crypto.randomUUID()}`, confirmedStores: [] },
                  ...rows,
                ]);
                setReview(null);
                setMessage("指定店舗へ通知しました。");
              }}
            >
              指定店舗へ通知する
            </button>
          </div>
        </section>
      )}

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}
      {!visible.length && <p className={styles.empty}>お知らせはありません。</p>}

      {noticesMode && (
        <div className={styles.list}>
          {visible.map((row) => {
            const completed = row.confirmedStores.includes(store);
            const opened = selected === row.id;
            return (
              <article className={styles.notice} key={row.id}>
                <div className={styles.noticeMain}>
                  <div className={styles.badges}>
                    <span className={styles.kind}>{row.kind}</span>
                    <span className={completed ? styles.done : styles.pending}>
                      {completed ? "対応済み" : "未対応"}
                    </span>
                  </div>
                  <h3>{row.title}</h3>
                  <p className={styles.meta}>
                    {row.product}・{row.effectiveAt.replace("T", " ")}
                  </p>
                </div>
                <button
                  className={styles.detailButton}
                  type="button"
                  aria-expanded={opened}
                  onClick={() => setSelected(opened ? null : row.id)}
                >
                  {opened ? "閉じる" : "詳細を見る"}
                </button>
                {opened && (
                  <div className={styles.expanded}>
                    <p>{row.message}</p>
                    <p className={styles.price}>指示価格　¥{row.price.toLocaleString("ja-JP")}</p>
                    <Link
                      className={styles.primaryLink}
                      href={`/store/campaigns?instruction=${encodeURIComponent(row.id)}`}
                    >
                      特売・価格の詳細へ
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {storeTaskMode && (
        <div className={styles.list}>
          {visible.map((row) => {
            const completed = row.confirmedStores.includes(store);
            return (
              <article className={styles.task} key={row.id}>
                <div className={styles.badges}>
                  <span className={styles.kind}>{row.kind}</span>
                  <span className={completed ? styles.done : styles.pending}>
                    {completed ? "対応済み" : "未対応"}
                  </span>
                </div>
                <h3>{row.title}</h3>
                <p className={styles.meta}>
                  {row.product}・¥{row.price.toLocaleString("ja-JP")}・
                  {row.effectiveAt.replace("T", " ")}
                </p>
                <p className={styles.instruction}>{row.message}</p>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={completed || Boolean(checked[row.id])}
                    disabled={completed}
                    onChange={(event) =>
                      setChecked((current) => ({ ...current, [row.id]: event.target.checked }))
                    }
                  />
                  <span>{taskLabel(row)}</span>
                </label>
                <button
                  className={styles.completeButton}
                  type="button"
                  disabled={completed || !checked[row.id]}
                  onClick={() => {
                    save(confirmDemoInstruction(rows, row.id, store));
                    setMessage("値札作業を対応済みにしました。");
                  }}
                >
                  {completed ? "対応済み" : "対応済みにする"}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {headquarters && (
        <div className={styles.list}>
          {visible.map((row) => (
            <article className={styles.task} key={row.id}>
              <div className={styles.badges}>
                <span className={styles.kind}>{row.kind}</span>
                <span className={styles.done}>
                  {row.confirmedStores.length}/{row.stores.length}店舗対応済み
                </span>
              </div>
              <h3>{row.title}</h3>
              <p className={styles.meta}>
                {row.product}・¥{row.price.toLocaleString("ja-JP")}・
                {row.effectiveAt.replace("T", " ")}
              </p>
              <p className={styles.instruction}>{row.message}</p>
              <ul>
                {row.stores.map((name) => (
                  <li key={name}>
                    {name}：{row.confirmedStores.includes(name) ? "対応済み" : "未対応"}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
