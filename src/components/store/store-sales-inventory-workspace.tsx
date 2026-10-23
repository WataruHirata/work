import Link from "next/link";
import { redirect } from "next/navigation";
import { CollapsibleTable } from "@/components/ui/collapsible-table";
import { SalesDayRow } from "@/components/store/sales-day-details";
import { CorrectionRequestStatus } from "@/components/store/correction-request-status";
import { FeatureNotice } from "@/components/ui/feature-notice";
import { PageLayout } from "@/components/ui/page-layout";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { OperationForm } from "@/components/workspaces/workspace-forms";
import {
  filterInventoryRows,
  inventorySupplier,
  isInventoryAlert,
  resolveRegisteredStoreId,
} from "@/domain/store-sales-inventory";
import { CircleAlert } from "@/components/ui/icons";
import type { DataRecord, Json } from "@/domain/contracts";
import { backendConfigured, identity, repository } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
import { date } from "@/server/validation";
import { deviceSnapshot, deviceToken } from "@/server/auth/store-context";

type StoreWorkspaceSearch = {
  from?: string;
  to?: string;
  item?: string;
  category?: string;
  supplier?: string;
};

function text(record: DataRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function snapshotRows(value: Json | undefined): DataRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    return [{ ...row, id: typeof row.id === "string" ? row.id : `snapshot-${index}` }];
  });
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString("ja-JP");
}

async function workspaceContext() {
  const session = await identity().session();
  if (session?.active && session.mustChangePassword) redirect("/account/password");
  const token = await deviceToken();
  let snapshot: Record<string, Json> | null = null;
  try {
    snapshot = await deviceSnapshot();
  } catch {
    snapshot = null;
  }
  const snapshotStore = snapshot?.store;
  const deviceStoreId =
    snapshotStore && typeof snapshotStore === "object" && !Array.isArray(snapshotStore)
      ? typeof snapshotStore.id === "string"
        ? snapshotStore.id
        : undefined
      : undefined;
  const storeId = resolveRegisteredStoreId(session?.storeIds ?? [], deviceStoreId);
  return {
    session,
    snapshot,
    token,
    storeId,
    hasUserSession: Boolean(session?.active && storeId && session.storeIds?.includes(storeId)),
  };
}

function MissingStore({ page }: { page: "storeSales" | "storeInventory" }) {
  return (
    <PageLayout page={page}>
      <FeatureNotice title="登録店舗の情報を表示できません">
        店舗端末を登録するか、店舗が割り当てられた権限でログインしてください。
        <p>
          <Link className="primary-button" href="/station">
            店舗端末を登録
          </Link>
        </p>
      </FeatureNotice>
    </PageLayout>
  );
}

function SalesTable({ rows }: { rows: DataRecord[] }) {
  if (!rows.length) return <p className="empty-state">条件に合う売上データはありません。</p>;
  return (
    <CollapsibleTable
      caption="登録店舗の営業日別売上"
      head={
        <tr>
          <th scope="col">営業日</th>
          <th scope="col">売上</th>
          <th scope="col">客数</th>
          <th scope="col">状態</th>
        </tr>
      }
    >
      {rows.map((row) => (
        <SalesDayRow key={row.id} row={row} />
      ))}
    </CollapsibleTable>
  );
}

function InventoryTable({
  rows,
  products,
  departments,
}: {
  rows: DataRecord[];
  products: DataRecord[];
  departments: DataRecord[];
}) {
  if (!rows.length) return <p className="empty-state">条件に合う在庫データはありません。</p>;
  const productById = new Map(products.map((product) => [product.id, product]));
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const sortedRows = [...rows].sort(
    (left, right) => Number(isInventoryAlert(right)) - Number(isInventoryAlert(left)),
  );
  const alertCount = sortedRows.filter(isInventoryAlert).length;
  return (
    <>
      {alertCount > 0 && (
        <div className="inventory-alert-summary" role="status">
          <CircleAlert size={20} aria-hidden="true" />
          <strong>在庫アラート {alertCount}件</strong>
        </div>
      )}
      <CollapsibleTable
        caption="登録店舗の商品別在庫"
        head={
          <tr>
            <th scope="col">品目</th>
            <th scope="col">商品名</th>
            <th scope="col">種別</th>
            <th scope="col">業者</th>
            <th scope="col">数量</th>
            <th scope="col">状態</th>
            <th scope="col">在庫取得日時</th>
          </tr>
        }
      >
        {sortedRows.map((row) => {
          const product = productById.get(text(row, "product_id"));
          const department = departmentById.get(text(row, "department_id"));
          const item = text(row, "code") || text(product, "code") || text(department, "code");
          const name = text(row, "name") || text(product, "name") || text(department, "name");
          const category = text(row, "category_code") || text(product, "category_code");
          const alert = isInventoryAlert(row);
          return (
            <tr key={row.id} className={alert ? "inventory-alert-row" : undefined}>
              <th scope="row">{item || text(product, "category_code") || "—"}</th>
              <td>{name || "—"}</td>
              <td>{category || "未設定"}</td>
              <td>{inventorySupplier(row, product)}</td>
              <td className={alert ? "inventory-alert-quantity" : undefined}>
                {text(row, "quantity") || "—"}
              </td>
              <td>
                {alert ? (
                  <span className="inventory-alert-badge">
                    <CircleAlert size={16} aria-hidden="true" />
                    在庫アラート
                  </span>
                ) : (
                  <span className="inventory-normal-badge">在庫あり</span>
                )}
              </td>
              <td>{formatDateTime(text(row, "observed_at"))}</td>
            </tr>
          );
        })}
      </CollapsibleTable>
    </>
  );
}

export async function StoreSalesWorkspace({ search = {} }: { search?: StoreWorkspaceSearch }) {
  if (!backendConfigured()) return <PreviewWorkspace feature="storeSales" />;
  const context = await workspaceContext();
  if (!context.storeId) return <MissingStore page="storeSales" />;
  const loaded = await (async () => {
    const from = search.from ? date(search.from) : undefined;
    const to = search.to ? date(search.to) : undefined;
    if (from && to && from > to) throw new Error("開始日は終了日以前の日付を指定してください。");
    const salesRows = context.hasUserSession
      ? await allRecords("sales", { storeId: context.storeId, from, to })
      : snapshotRows(context.snapshot?.sales).filter((row) => {
          const businessDate = text(row, "business_date");
          return (!from || businessDate >= from) && (!to || businessDate <= to);
        });
    const salesDayIds = new Set(salesRows.map((row) => row.id));
    const corrections = context.hasUserSession
      ? (await allRecords("corrections"))
          .filter((row) => salesDayIds.has(String(row.sales_day_id)))
          .sort((left, right) =>
            String(right.requested_at).localeCompare(String(left.requested_at)),
          )
      : context.token
        ? await repository().storeDeviceCorrections(context.token)
        : [];
    return { from, to, salesRows, corrections };
  })().then(
    (data) => ({ ok: true as const, data }),
    (error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "接続設定を確認して再度お試しください。",
    }),
  );
  if (!loaded.ok) {
    return (
      <PageLayout page="storeSales">
        <FeatureNotice title="売上を取得できませんでした">{loaded.error}</FeatureNotice>
      </PageLayout>
    );
  }
  const { from, to, salesRows, corrections } = loaded.data;
  const canRequestCorrection =
    Boolean(context.token) || Boolean(context.session?.roles.includes("store_manager"));
  return (
    <PageLayout page="storeSales">
      <div className="page-grid double store-sales-inventory-grid">
        <section className="page-panel" aria-labelledby="store-sales-title">
          <h2 id="store-sales-title">営業日別売上</h2>
          <p className="muted">登録店舗の日別売上を営業日で絞り込みます。</p>
          <form method="get" className="workspace-fields">
            <label className="field">
              <span>開始日</span>
              <input name="from" type="date" defaultValue={from} />
            </label>
            <label className="field">
              <span>終了日</span>
              <input name="to" type="date" defaultValue={to} />
            </label>
            <button className="ghost-button" type="submit">
              売上を絞り込む
            </button>
          </form>
          <p className="muted">{salesRows.length}件</p>
          <SalesTable rows={salesRows} />
        </section>
        <div>
          {canRequestCorrection ? (
            <section className="page-panel" aria-labelledby="sales-correction-title">
              <h2 id="sales-correction-title">修正申請</h2>
              <OperationForm
                operation="requestCorrection"
                label="修正申請を送信"
                confirm="営業日・変更前後の金額・理由を確認しました"
                fields={[
                  { key: "salesDayId", label: "対象売上", lookup: "sales", required: true },
                  { key: "reason", label: "修正理由", required: true },
                  {
                    key: "amount",
                    label: "修正後売上（円）",
                    type: "number",
                    required: true,
                    min: 0,
                  },
                ]}
                lookups={{
                  sales: salesRows.map((row) => ({
                    ...row,
                    name: `${row.business_date} / ${row.net_sales_yen}円 / ${row.status}`,
                  })),
                }}
              />
            </section>
          ) : (
            <FeatureNotice title="店舗端末を登録してください">
              登録済みの店舗端末から、営業日を選んで売上修正を申請できます。
            </FeatureNotice>
          )}
          {(context.hasUserSession || context.token) && (
            <CorrectionRequestStatus corrections={corrections} salesDays={salesRows} />
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export async function StoreInventoryWorkspace({ search = {} }: { search?: StoreWorkspaceSearch }) {
  if (!backendConfigured()) return <PreviewWorkspace feature="storeInventory" />;
  const context = await workspaceContext();
  if (!context.storeId) return <MissingStore page="storeInventory" />;
  const loaded = await (async () => {
    const filters = {
      item: (search.item ?? "").trim().slice(0, 100),
      category: (search.category ?? "").trim().slice(0, 100),
      supplier: (search.supplier ?? "").trim().slice(0, 100),
    };
    let inventoryRows: DataRecord[];
    let products: DataRecord[];
    let departments: DataRecord[];
    if (context.hasUserSession) {
      [inventoryRows, products, departments] = await Promise.all([
        allRecords("inventory", { storeId: context.storeId }),
        allRecords("products"),
        allRecords("departments", { storeId: context.storeId }),
      ]);
    } else {
      inventoryRows = snapshotRows(context.snapshot?.inventory);
      products = inventoryRows;
      departments = [];
    }
    const productById = new Map(products.map((product) => [product.id, product]));
    const categories = [
      ...new Set(
        inventoryRows
          .map((row) => {
            const product = productById.get(text(row, "product_id"));
            return text(row, "category_code") || text(product, "category_code");
          })
          .filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right, "ja-JP"));
    const suppliers = [
      ...new Set(
        inventoryRows.map((row) =>
          inventorySupplier(row, productById.get(text(row, "product_id"))),
        ),
      ),
    ].sort((left, right) => left.localeCompare(right, "ja-JP"));
    return {
      filters,
      inventoryRows: filterInventoryRows(inventoryRows, products, departments, filters),
      products,
      departments,
      categories,
      suppliers,
    };
  })().then(
    (data) => ({ ok: true as const, data }),
    (error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "接続設定を確認して再度お試しください。",
    }),
  );
  if (!loaded.ok) {
    return (
      <PageLayout page="storeInventory">
        <FeatureNotice title="在庫を取得できませんでした">{loaded.error}</FeatureNotice>
      </PageLayout>
    );
  }
  const { filters, inventoryRows, products, departments, categories, suppliers } = loaded.data;
  return (
    <PageLayout page="storeInventory">
      <div className="page-grid double store-sales-inventory-grid">
        <section className="page-panel" aria-labelledby="inventory-filter-title">
          <h2 id="inventory-filter-title">在庫を絞り込む</h2>
          <form method="get" className="workspace-fields">
            <label className="field">
              <span>品目</span>
              <input
                name="item"
                type="search"
                defaultValue={filters.item}
                maxLength={100}
                placeholder="品目コード・商品名"
              />
            </label>
            <label className="field">
              <span>種別</span>
              <select name="category" defaultValue={filters.category}>
                <option value="">すべて</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>業者</span>
              <select name="supplier" defaultValue={filters.supplier}>
                <option value="">すべて</option>
                {suppliers.map((supplier) => (
                  <option key={supplier}>{supplier}</option>
                ))}
              </select>
            </label>
            <button className="ghost-button" type="submit">
              在庫を絞り込む
            </button>
          </form>
          <div className="button-row">
            <Link className="primary-button" href="/store/orders/new">
              発注画面へ
            </Link>
          </div>
        </section>
        <section className="page-panel" aria-labelledby="store-inventory-title">
          <div className="panel-head">
            <h2 id="store-inventory-title">在庫一覧</h2>
            <span className="muted">{inventoryRows.length}件</span>
          </div>
          <InventoryTable rows={inventoryRows} products={products} departments={departments} />
        </section>
      </div>
    </PageLayout>
  );
}
