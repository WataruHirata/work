import Link from "next/link";
import { redirect } from "next/navigation";
import { CollapsibleTable } from "@/components/ui/collapsible-table";
import { SalesDayRow } from "@/components/store/sales-day-details";
import { FeatureNotice } from "@/components/ui/feature-notice";
import { PageLayout } from "@/components/ui/page-layout";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { filterInventoryRows, resolveRegisteredStoreId } from "@/domain/store-sales-inventory";
import type { DataRecord, Json } from "@/domain/contracts";
import { backendConfigured, identity } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
import { date } from "@/server/validation";
import { deviceSnapshot } from "@/server/auth/store-context";

type StoreSalesInventorySearch = {
  from?: string;
  to?: string;
  search?: string;
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

async function loadStoreSalesInventoryData(
  storeId: string,
  hasUserSession: boolean,
  snapshot: Record<string, Json> | null,
  search: StoreSalesInventorySearch,
) {
  const from = search.from ? date(search.from) : undefined;
  const to = search.to ? date(search.to) : undefined;
  if (from && to && from > to) throw new Error("開始日は終了日以前の日付を指定してください。");
  const term = (search.search ?? "").trim().slice(0, 100);

  let salesRows: DataRecord[];
  let inventoryRows: DataRecord[];
  let productRows: DataRecord[];
  let departmentRows: DataRecord[];
  if (hasUserSession) {
    const [sales, inventory, products, departments] = await Promise.all([
      allRecords("sales", { storeId, from, to }),
      allRecords("inventory", { storeId }),
      allRecords("products"),
      allRecords("departments", { storeId }),
    ]);
    salesRows = sales;
    inventoryRows = inventory;
    productRows = products;
    departmentRows = departments;
  } else {
    salesRows = snapshotRows(snapshot?.sales).filter((row) => {
      const day = text(row, "business_date");
      return (!from || day >= from) && (!to || day <= to);
    });
    inventoryRows = snapshotRows(snapshot?.inventory);
    productRows = inventoryRows;
    departmentRows = [];
  }

  return {
    from,
    to,
    term,
    salesRows,
    inventoryRows: filterInventoryRows(inventoryRows, productRows, departmentRows, term),
    productRows,
    departmentRows,
  };
}

function FilterField({
  label,
  name,
  type,
  defaultValue,
}: {
  label: string;
  name: string;
  type: "date" | "search";
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} maxLength={100} />
    </label>
  );
}

function SalesTable({ rows }: { rows: DataRecord[] }) {
  if (!rows.length) return <p className="empty-state">条件に合う売上データはありません。</p>;
  return (
    <CollapsibleTable
      caption="登録店舗の日別売上"
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
  return (
    <CollapsibleTable
      caption="登録店舗の商品別在庫"
      head={
        <tr>
          <th scope="col">品目</th>
          <th scope="col">商品名</th>
          <th scope="col">数量</th>
          <th scope="col">在庫取得日時</th>
        </tr>
      }
    >
      {rows.map((row) => {
        const product = productById.get(text(row, "product_id"));
        const department = departmentById.get(text(row, "department_id"));
        const item = text(row, "code") || text(product, "code") || text(department, "name");
        const name = text(row, "name") || text(product, "name") || text(department, "name");
        return (
          <tr key={row.id}>
            <th scope="row">{item || text(product, "category_code") || "—"}</th>
            <td>{name || "—"}</td>
            <td>{text(row, "quantity") || "—"}</td>
            <td>{formatDateTime(text(row, "observed_at"))}</td>
          </tr>
        );
      })}
    </CollapsibleTable>
  );
}

export async function StoreSalesInventoryWorkspace({
  search = {},
}: {
  search?: StoreSalesInventorySearch;
}) {
  if (!backendConfigured()) return <PreviewWorkspace feature="storeSales" />;

  const session = await identity().session();
  if (session?.active && session.mustChangePassword) redirect("/account/password");

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

  if (!storeId) {
    return (
      <PageLayout page="storeSales">
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

  const loaded = await loadStoreSalesInventoryData(
    storeId,
    Boolean(session?.active && session.storeIds?.includes(storeId)),
    snapshot,
    search,
  ).then(
    (data) => ({ ok: true as const, data }),
    (error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "接続設定を確認して再度お試しください。",
    }),
  );
  if (!loaded.ok) {
    return (
      <PageLayout page="storeSales">
        <FeatureNotice title="売上・在庫を取得できませんでした">{loaded.error}</FeatureNotice>
      </PageLayout>
    );
  }
  const { from, to, term, salesRows, inventoryRows, productRows, departmentRows } = loaded.data;
  return (
    <PageLayout page="storeSales">
      <div className="page-grid double store-sales-inventory-grid">
        <section className="page-panel" aria-labelledby="store-sales-title">
          <h2 id="store-sales-title">売上</h2>
          <p className="muted">登録店舗の日別売上を営業日で絞り込みます。</p>
          <form method="get" className="workspace-fields">
            <FilterField label="開始日" name="from" type="date" defaultValue={from} />
            <FilterField label="終了日" name="to" type="date" defaultValue={to} />
            {term && <input type="hidden" name="search" value={term} />}
            <button className="ghost-button" type="submit">
              売上を絞り込む
            </button>
          </form>
          <p className="muted">{salesRows.length}件</p>
          <SalesTable rows={salesRows} />
        </section>
        <section className="page-panel" aria-labelledby="store-inventory-title">
          <h2 id="store-inventory-title">在庫</h2>
          <p className="muted">品目コード、品目名、分類または商品名で検索します。</p>
          <form method="get" className="workspace-fields">
            <FilterField label="品目・商品名" name="search" type="search" defaultValue={term} />
            {from && <input type="hidden" name="from" value={from} />}
            {to && <input type="hidden" name="to" value={to} />}
            <button className="ghost-button" type="submit">
              在庫を検索
            </button>
          </form>
          <p className="muted">{inventoryRows.length}件</p>
          <InventoryTable
            rows={inventoryRows}
            products={productRows}
            departments={departmentRows}
          />
        </section>
      </div>
    </PageLayout>
  );
}
