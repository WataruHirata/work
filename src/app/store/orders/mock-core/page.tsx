import { redirect } from "next/navigation";
import { deviceSnapshot } from "@/server/auth/store-context";
import { listMockCoreOrders } from "../../../../../mock-core-system/order-store";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });

export default async function MockCoreOrdersPage() {
  const snapshot = await deviceSnapshot();
  if (!snapshot) redirect("/station");
  const store =
    snapshot.store && typeof snapshot.store === "object" && !Array.isArray(snapshot.store)
      ? snapshot.store
      : null;
  const storeCode = store && typeof store.code === "string" ? store.code : "";
  if (!storeCode) redirect("/station");
  const receipts = (await listMockCoreOrders())
    .filter((receipt) => receipt.order.storeCode === storeCode)
    .toReversed();
  return (
    <section className="page-panel">
      <h2>基幹システムの受信結果</h2>
      <p className="muted">
        開発用の模擬環境が受信した発注です。本物の卸売業者や基幹システムには送信されません。
      </p>
      {receipts.length ? (
        <div className="workspace-table">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">受付番号</th>
                <th scope="col">受信日時</th>
                <th scope="col">店舗</th>
                <th scope="col">部門</th>
                <th scope="col">納品希望日</th>
                <th scope="col">品目</th>
                <th scope="col">合計金額</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.idempotencyKey}>
                  <td>{receipt.reference}</td>
                  <td>{new Date(receipt.receivedAt).toLocaleString("ja-JP")}</td>
                  <td>{receipt.order.storeCode}</td>
                  <td>{receipt.order.departmentCode}</td>
                  <td>{receipt.order.deliveryDate}</td>
                  <td>
                    {receipt.order.items
                      .map((item) => `${item.productCode} × ${item.quantity}`)
                      .join("、")}
                  </td>
                  <td>{yen.format(receipt.order.totalYen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>受信した発注はまだありません。発注入力から商品を登録してください。</p>
      )}
    </section>
  );
}
