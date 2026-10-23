"use client";

import { useState, useTransition } from "react";
import { loadSalesDayLines } from "@/server/actions/store-sales";
import type { DataRecord } from "@/domain/contracts";
import { StateBadge } from "@/components/ui/state-badge";

function value(row: DataRecord, key: string) {
  const item = row[key];
  return typeof item === "string" || typeof item === "number" ? String(item) : "—";
}

function yen(amount: string) {
  return /^-?\d+$/.test(amount) ? `¥${BigInt(amount).toLocaleString("ja-JP")}` : amount;
}

export function SalesDayRow({ row }: { row: DataRecord }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DataRecord[] | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleDetails() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || lines || pending) return;

    setError("");
    startTransition(async () => {
      try {
        setLines(await loadSalesDayLines(row.id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "売上明細を取得できませんでした。");
      }
    });
  }

  return (
    <>
      <tr>
        <th scope="row">
          <span>{value(row, "business_date")}</span>
          <button
            className="sales-day-toggle"
            type="button"
            aria-expanded={open}
            aria-controls={`sales-lines-${row.id}`}
            onClick={toggleDetails}
          >
            {open ? "明細を閉じる" : "明細を見る"}
          </button>
        </th>
        <td>{yen(value(row, "net_sales_yen"))}</td>
        <td>{value(row, "customer_count")}</td>
        <td>{value(row, "status") !== "—" ? <StateBadge state={value(row, "status")} /> : "—"}</td>
      </tr>
      {open && (
        <tr className="sales-lines-row">
          <td colSpan={4}>
            <section
              id={`sales-lines-${row.id}`}
              className="sales-lines-panel"
              aria-label="売上明細"
            >
              <h3>売上明細</h3>
              {pending && (
                <p className="muted" role="status">
                  明細を読み込み中…
                </p>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              {lines &&
                (lines.length ? (
                  <div className="table-scroll sales-lines-table">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">品目コード</th>
                          <th scope="col">商品名</th>
                          <th scope="col">数量</th>
                          <th scope="col">金額</th>
                          <th scope="col">取引時刻</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id}>
                            <td>{value(line, "product_code_snapshot")}</td>
                            <th scope="row">{value(line, "product_name_snapshot")}</th>
                            <td>{value(line, "quantity")}</td>
                            <td>{yen(value(line, "amount_yen"))}</td>
                            <td>{value(line, "transaction_time")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-state">この日の明細はありません。</p>
                ))}
            </section>
          </td>
        </tr>
      )}
    </>
  );
}
