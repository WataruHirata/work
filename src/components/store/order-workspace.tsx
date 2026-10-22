"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { executeOperation } from "@/server/actions/workspace";
import { Feedback } from "@/components/workspaces/workspace-forms";

export type OrderCatalogItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  supplier: string;
  priceYen: number;
};

export type OrderHistoryItem = {
  id: string;
  orderDate: string;
  requestedBy: string;
  itemNames: string[];
  itemCount: number;
  totalYen: number;
};

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });

export function OrderHome({ history }: { history: OrderHistoryItem[] }) {
  return (
    <>
      <section className="page-panel">
        <div className="button-row">
          <Link className="primary-button" href="/store/orders/new">
            発注入力
          </Link>
          <Link className="ghost-button" href="/store/orders/history">
            発注履歴
          </Link>
        </div>
      </section>
      <section className="page-panel">
        <h2>直近の発注履歴</h2>
        {history.length ? (
          <div className="workspace-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">日付</th>
                  <th scope="col">担当者</th>
                  <th scope="col">品数</th>
                  <th scope="col">金額</th>
                </tr>
              </thead>
              <tbody>
                {history.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderDate}</td>
                    <td>{order.requestedBy}</td>
                    <td>{order.itemCount}品</td>
                    <td>{yen.format(order.totalYen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>発注履歴はまだありません。</p>
        )}
      </section>
    </>
  );
}

export function OrderHistory({ history }: { history: OrderHistoryItem[] }) {
  const [date, setDate] = useState("");
  const [person, setPerson] = useState("");
  const [item, setItem] = useState("");
  const filtered = useMemo(() => {
    const normalize = (value: string) => value.toLocaleLowerCase("ja-JP");
    return history.filter(
      (order) =>
        (!date || order.orderDate === date) &&
        (!person || normalize(order.requestedBy).includes(normalize(person))) &&
        (!item || order.itemNames.some((name) => normalize(name).includes(normalize(item)))),
    );
  }, [date, history, item, person]);
  return (
    <section className="page-panel">
      <div className="button-row">
        <Link className="ghost-button" href="/store/orders">
          発注入力・履歴へ戻る
        </Link>
      </div>
      <h2>発注履歴</h2>
      <div className="workspace-fields order-history-filters">
        <label className="field">
          <span>日付</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span>担当者</span>
          <input value={person} onChange={(event) => setPerson(event.target.value)} />
        </label>
        <label className="field">
          <span>品目</span>
          <input value={item} onChange={(event) => setItem(event.target.value)} />
        </label>
      </div>
      <p className="muted">{filtered.length}件</p>
      <div className="workspace-table">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">日付</th>
              <th scope="col">担当者</th>
              <th scope="col">品目</th>
              <th scope="col">品数</th>
              <th scope="col">金額</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>{order.orderDate}</td>
                <td>{order.requestedBy}</td>
                <td>{order.itemNames.join("、")}</td>
                <td>{order.itemCount}品</td>
                <td>{yen.format(order.totalYen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OrderEntry({
  catalog,
  storeId,
  departmentId,
  requestId,
}: {
  catalog: OrderCatalogItem[];
  storeId: string;
  departmentId: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(executeOperation.bind(null, "createOrder"), {});
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const suppliers = [...new Set(catalog.map((product) => product.supplier))];
  const categories = [...new Set(catalog.map((product) => product.category))];
  const products = catalog.filter((product) => {
    const needle = query.trim().toLocaleLowerCase("ja-JP");
    return (
      (!supplier || product.supplier === supplier) &&
      (!category || product.category === category) &&
      (!needle || `${product.code} ${product.name}`.toLocaleLowerCase("ja-JP").includes(needle))
    );
  });
  const items = Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity }));
  const cartRows = items.flatMap((item) => {
    const product = catalog.find((candidate) => candidate.id === item.productId);
    return product ? [{ ...product, quantity: item.quantity }] : [];
  });
  const total = cartRows.reduce((sum, item) => sum + item.priceYen * item.quantity, 0);
  const add = (productId: string) =>
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
  return (
    <section className="page-panel">
      <div className="button-row">
        <Link className="ghost-button" href="/store/orders">
          発注入力・履歴へ戻る
        </Link>
      </div>
      <h2>発注入力</h2>
      <p className="muted">
        登録した発注は下書きとして保存されます。卸売業者・基幹システムへの送信は行いません。
      </p>
      <div className="workspace-fields order-catalog-filters">
        <label className="field">
          <span>卸売業者</span>
          <select value={supplier} onChange={(event) => setSupplier(event.target.value)}>
            <option value="">すべて</option>
            {suppliers.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>商品種目</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">すべて</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>商品を検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="商品名またはコード"
          />
        </label>
      </div>
      <div className="order-entry-grid">
        <div className="workspace-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>卸売業者</th>
                <th>商品種目</th>
                <th>商品</th>
                <th>単価</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.supplier}</td>
                  <td>{product.category}</td>
                  <td>
                    {product.code} {product.name}
                  </td>
                  <td>{yen.format(product.priceYen)}</td>
                  <td>
                    <button type="button" className="ghost-button" onClick={() => add(product.id)}>
                      カートに追加
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={action} className="workspace-form order-cart">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="departmentId" value={departmentId} />
          <input type="hidden" name="items" value={JSON.stringify(items)} />
          <h3>カート</h3>
          {cartRows.length ? (
            <ul className="order-cart-list">
              {cartRows.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <label>
                    数量
                    <input
                      type="number"
                      min="1"
                      max="99999"
                      value={item.quantity}
                      onChange={(event) =>
                        setCart((current) => ({
                          ...current,
                          [item.id]: Math.max(1, Number(event.target.value) || 1),
                        }))
                      }
                    />
                  </label>
                  <strong>{yen.format(item.priceYen * item.quantity)}</strong>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setCart((current) => {
                        const next = { ...current };
                        delete next[item.id];
                        return next;
                      })
                    }
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>商品を追加してください。</p>
          )}
          <p className="order-cart-total">
            合計金額 <strong>{yen.format(total)}</strong>
          </p>
          <label className="field">
            <span>納品希望日</span>
            <input type="date" name="deliveryDate" required />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={pending || !cartRows.length || Boolean(state.success)}
          >
            {pending ? "保存中…" : "発注を登録"}
          </button>
          <Feedback state={state} />
        </form>
      </div>
    </section>
  );
}
