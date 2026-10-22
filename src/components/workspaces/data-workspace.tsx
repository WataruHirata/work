import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { FeatureNotice } from "@/components/ui/feature-notice";
import {
  Fields,
  MasterForm,
  OperationForm,
  OrderForm,
  UserImportForm,
  type Lookups,
} from "@/components/workspaces/workspace-forms";
import {
  columnLabels,
  masterFields,
  resourceLabels,
  roleOptions,
  stateLabels,
  uiConfig,
  type PageId,
  type WorkspaceField,
} from "@/config/ui";
import { backendConfigured, identity, repository } from "@/server/container";
import { allRecords, featureResources } from "@/server/queries/workspaces";
import { date, uuid } from "@/server/validation";
import type { DataPage, DataRecord, Json, QueryOptions, Resource } from "@/domain/contracts";
import { SalesImportForm } from "@/components/workspaces/sales-import-form";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { InstructionWorkspace } from "@/components/campaigns/instruction-workspace";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { StateBadge } from "@/components/ui/state-badge";
import { CorrectionRequestStatus } from "@/components/store/correction-request-status";
import { CollapsibleTable } from "@/components/ui/collapsible-table";
import { hasAdminAccess, resolveStorePageStoreId } from "@/domain/access-policy";
import { getAdminSession } from "@/server/auth/admin-access";

export type WorkspaceSearch = {
  page?: string;
  store?: string;
  from?: string;
  to?: string;
  search?: string;
  correction?: string;
};
const field = (key: string, label: string, lookup?: Resource, required = true): WorkspaceField => ({
  key,
  label,
  lookup,
  required,
});

function display(key: string, value: Json, lookups: Lookups): React.ReactNode {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "object")
    return (
      <details>
        <summary>詳細</summary>
        <pre className="audit-json">{JSON.stringify(value, null, 2)}</pre>
      </details>
    );
  const lookup: Record<string, Resource> = {
    store_id: "stores",
    area_id: "areas",
    product_id: "products",
    department_id: "departments",
    user_id: "users",
    requested_by: "users",
    actor_id: "users",
  };
  const related = lookup[key] && lookups[lookup[key]]?.find((row) => row.id === value);
  if (related) return String(related.name ?? related.display_name ?? related.code);
  if (key.endsWith("yen") && /^-?\d+$/.test(String(value)))
    return new Intl.NumberFormat("ja-JP").format(BigInt(String(value)));
  if (key === "role")
    return roleOptions.find((option) => option.value === value)?.label ?? String(value);
  const text = stateLabels[String(value)] ?? String(value);
  return key === "status" || key.endsWith("_status") || key === "promotion_eligibility" ? (
    <StateBadge state={String(value)} label={text} />
  ) : (
    text
  );
}
function ResourceTable({
  resource,
  data,
  lookups,
  roles,
}: {
  resource: Resource;
  data: DataPage;
  lookups: Lookups;
  roles: string[];
}) {
  if (resource === "notifications") return <NotificationInbox data={data} roles={roles} />;
  const canEdit =
    Boolean(masterFields[resource]) &&
    (resource === "products"
      ? roles.includes("product_office")
      : roles.includes("information_systems"));
  const columns = data.rows[0]
    ? Object.keys(data.rows[0]).filter((key) => key !== "updated_at")
    : [];
  return (
    <section className="page-panel">
      <h2>{resourceLabels[resource]}</h2>
      <p className="muted">
        {data.total}件・{data.page}ページ目
      </p>
      {data.rows.length ? (
        <CollapsibleTable
          head={
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {columnLabels[column] ?? column}
                </th>
              ))}
              <th scope="col">操作</th>
            </tr>
          }
        >
          {data.rows.map((row) => (
            <tr key={`${row.id}:${row.updated_at ?? ""}`}>
              {columns.map((column) => (
                <td key={column}>{display(column, row[column], lookups)}</td>
              ))}
              <td>
                {canEdit && (
                  <details>
                    <summary>編集</summary>
                    <MasterForm resource={resource} row={row} lookups={lookups} />
                  </details>
                )}
                {resource === "sales" &&
                  row.status === "imported" &&
                  roles.includes("store_manager") && (
                    <OperationForm
                      operation="confirmSales"
                      label="日次確定"
                      confirm="対象営業日の売上を確認しました"
                    >
                      <input type="hidden" name="salesDayId" value={row.id} />
                    </OperationForm>
                  )}
                {resource === "corrections" &&
                  ((row.status === "pending_area_approval" && roles.includes("area_manager")) ||
                    (row.status === "pending_operations_approval" &&
                      roles.includes("store_operations"))) && (
                    <details>
                      <summary>承認・差戻し</summary>
                      <OperationForm
                        operation="approveCorrection"
                        label="決定を保存"
                        fields={[
                          {
                            key: "approved",
                            label: "決定",
                            required: true,
                            options: [
                              { value: "true", label: "承認" },
                              { value: "false", label: "差戻し" },
                            ],
                          },
                          {
                            key: "comment",
                            label: "コメント（差戻し時必須）",
                          },
                        ]}
                      >
                        <input type="hidden" name="correctionId" value={row.id} />
                      </OperationForm>
                    </details>
                  )}
                {resource === "roles" && roles.includes("information_systems") && (
                  <OperationForm
                    operation="revokeRole"
                    label="割当を解除"
                    confirm="この権限割当を解除します"
                  >
                    <input type="hidden" name="assignmentId" value={row.id} />
                  </OperationForm>
                )}
                {resource === "devices" && row.active && roles.includes("information_systems") && (
                  <OperationForm
                    operation="disableDevice"
                    label="端末を無効化"
                    confirm="この端末からの参照を停止します"
                  >
                    <input type="hidden" name="deviceId" value={row.id} />
                  </OperationForm>
                )}
                {resource === "jobs" &&
                  row.status === "failed" &&
                  roles.some((role) =>
                    ["information_systems", "product_office"].includes(role),
                  ) && (
                    <OperationForm operation="retryJob" label="再処理を予約">
                      <input type="hidden" name="jobId" value={row.id} />
                    </OperationForm>
                  )}
              </td>
            </tr>
          ))}
        </CollapsibleTable>
      ) : (
        <p>対象データはありません。</p>
      )}
      {canEdit && resource !== "users" && (
        <details className="workspace-new">
          <summary>{resourceLabels[resource]}を新規登録</summary>
          <MasterForm resource={resource} lookups={lookups} />
        </details>
      )}
    </section>
  );
}

export async function DataWorkspace({
  feature,
  search = {},
}: {
  feature: PageId;
  search?: WorkspaceSearch;
}) {
  if (!backendConfigured()) return <PreviewWorkspace feature={feature} />;
  const session = await identity().session();
  if (!session?.active) redirect(`/login?next=${encodeURIComponent(uiConfig.pages[feature].href)}`);
  if (session.mustChangePassword) redirect("/account/password");
  const isAdminPage = uiConfig.pages[feature].href.startsWith("/admin/");
  const adminSession = isAdminPage ? await getAdminSession() : null;
  const roles = adminSession?.status === "authorized" ? adminSession.roles : session.roles;
  const hideStoreFilters = ["storeSales", "storeOperations", "storeOrders"].includes(feature);
  const isStorePage = feature.startsWith("store");
  const restrictToAssignedStores = isStorePage && !hasAdminAccess(roles);
  const resources = [
    ...(featureResources[feature] ?? []),
    ...(feature === "approvals" ? ["notifications" as const] : []),
  ];
  let lookups: Lookups, pages: { resource: Resource; data: DataPage }[];
  let noticeStoreId: string | undefined;
  let noticeSalesDays: DataRecord[] = [];
  let noticeCorrections: DataRecord[] = [];
  try {
    const options: QueryOptions = {
      page: Math.max(1, Number(search.page) || 1),
      search: search.search,
    };
    if (search.correction) options.correctionId = uuid(search.correction);
    if (search.store) options.storeId = uuid(search.store);
    if (restrictToAssignedStores) {
      const assignedStoreIds = session.storeIds ?? [];
      options.storeId = resolveStorePageStoreId(roles, assignedStoreIds, options.storeId);
      if (!options.storeId) {
        throw new Error("この利用者に表示できる店舗が登録されていません。");
      }
    }
    if (search.from) options.from = date(search.from);
    if (search.to) options.to = date(search.to);
    const lookupResources: Resource[] = ["stores", "areas", "departments", "products"];
    if (roles.includes("information_systems")) lookupResources.push("users");
    const lookupRows = await Promise.all(
      lookupResources.map(async (resource) => [resource, await allRecords(resource)] as const),
    );
    lookups = Object.fromEntries(lookupRows);
    if (restrictToAssignedStores) {
      const assignedStoreIds = new Set(session.storeIds ?? []);
      lookups.stores = (lookups.stores ?? []).filter((store) => assignedStoreIds.has(store.id));
      lookups.departments = (lookups.departments ?? []).filter((department) =>
        assignedStoreIds.has(String(department.store_id)),
      );
    }
    if (feature === "storeNotices") {
      const requestedStore = options.storeId
        ? lookups.stores?.find((store) => store.id === options.storeId && store.status === "active")
        : undefined;
      const registeredStore =
        requestedStore ?? lookups.stores?.find((store) => store.status === "active");
      noticeStoreId = registeredStore?.id;
      if (noticeStoreId) {
        options.storeId = noticeStoreId;
        noticeSalesDays = await allRecords("sales", { storeId: noticeStoreId });
        const salesDayIds = new Set(noticeSalesDays.map((row) => row.id));
        noticeCorrections = (await allRecords("corrections"))
          .filter((row) => salesDayIds.has(String(row.sales_day_id)))
          .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));
      }
    }
    pages = await Promise.all(
      resources.map(async (resource) => ({
        resource,
        data: await repository().list(resource, options),
      })),
    );
    if (feature === "storeNotices") {
      pages = pages.map((page) => {
        if (page.resource !== "notifications") return page;
        const rows = page.data.rows.filter((row) => !row.correction_id);
        return { ...page, data: { ...page.data, rows, total: rows.length } };
      });
    }
  } catch (error) {
    return (
      <PageLayout page={feature}>
        <FeatureNotice title="データを取得できませんでした">
          {error instanceof Error ? error.message : "接続設定を確認して再度お試しください。"}
          <p>
            <Link className="ghost-button" href={uiConfig.pages[feature].href}>
              再読み込み
            </Link>
          </p>
        </FeatureNotice>
      </PageLayout>
    );
  }
  return (
    <PageLayout page={feature}>
      {feature === "storeNotices" && (
        <section className="page-panel">
          {noticeStoreId ? (
            <InstructionWorkspace storeId={noticeStoreId} />
          ) : (
            <p className="empty-state">表示できる登録店舗がありません。</p>
          )}
        </section>
      )}
      {feature !== "storeNotices" && !hideStoreFilters && (
        <section className="page-panel">
          <p>操作者：{session.displayName} · DB接続中</p>
          <form method="get" className="workspace-fields">
            <Fields
              fields={[
                field("store", "店舗", "stores", false),
                { key: "from", label: "開始日", type: "date" },
                { key: "to", label: "終了日", type: "date" },
                { key: "search", label: "名称・対象検索" },
              ]}
              values={search}
              lookups={lookups}
            />
            <button className="ghost-button" type="submit">
              絞り込み
            </button>
          </form>
        </section>
      )}
      {feature === "storeNotices" && noticeStoreId && (
        <CorrectionRequestStatus corrections={noticeCorrections} salesDays={noticeSalesDays} />
      )}
      {feature === "approvals" && (
        <section className="page-panel">
          <h2>売上修正依頼と通知</h2>
        </section>
      )}
      {feature === "products" && <section className="page-panel"></section>}
      {feature === "storeOperations" && roles.includes("store_manager") && (
        <section className="page-panel">
          <h2>売上修正の申請</h2>
          <OperationForm
            operation="requestCorrection"
            label="理由と修正金額を保存"
            confirm="変更前後を確認しました"
            fields={[
              field("salesDayId", "対象売上", "sales"),
              field("reason", "修正理由"),
              {
                key: "amount",
                label: "修正後売上（円）",
                type: "number",
                required: true,
                min: 0,
              },
            ]}
            lookups={{
              ...lookups,
              sales: pages
                .find((page) => page.resource === "sales")
                ?.data.rows.map((row) => ({
                  ...row,
                  name: `${row.business_date} / ${row.net_sales_yen}円 / ${row.status}`,
                })),
            }}
          />
        </section>
      )}
      {feature === "storeOrders" &&
        roles.some((role) => ["staff", "department_lead", "store_manager"].includes(role)) && (
          <section className="page-panel">
            <h2>発注入力</h2>
            <OrderForm lookups={lookups} requestId={randomUUID()} />
          </section>
        )}
      {feature === "monthly" && roles.includes("accounting") && (
        <section className="page-panel">
          <h2>月次確定</h2>
          <OperationForm
            operation="finalizeMonth"
            label="月次確定を実行"
            confirm="未処理を確認しました。確定後は本システムで修正できません"
            fields={[field("storeId", "対象店舗", "stores"), field("month", "対象年月（YYYY-MM）")]}
            lookups={lookups}
          />
        </section>
      )}
      {feature === "stores" && roles.includes("information_systems") && (
        <section className="page-panel">
          <h2>店舗端末を登録</h2>
          <OperationForm
            operation="registerDevice"
            label="接続コードを発行"
            fields={[field("storeId", "対象店舗", "stores"), field("name", "端末名")]}
            lookups={lookups}
          />
        </section>
      )}
      {feature === "users" && roles.includes("information_systems") && (
        <section className="page-panel">
          <h2>利用者登録</h2>
          <OperationForm
            operation="createUser"
            label="認証アカウントと利用者を登録"
            fields={[
              {
                key: "email",
                label: "メールアドレス",
                type: "email",
                required: true,
              },
              {
                key: "password",
                label: "初回パスワード（12文字以上）",
                type: "password",
                required: true,
              },
              field("employeeCode", "社員番号"),
              field("displayName", "氏名"),
            ]}
          />
          <h2>権限と担当範囲の割当</h2>
          <p className="muted">
            本部ロールは担当範囲なし。エリア担当はエリアのみ、店長は店舗のみ、主任・社員は店舗と売場を指定します。
          </p>
          <OperationForm
            operation="assignRole"
            label="割当を保存"
            fields={[
              field("userId", "利用者", "users"),
              {
                key: "role",
                label: "ロール",
                required: true,
                options: roleOptions,
              },
              field("areaId", "担当エリア", "areas", false),
              field("storeId", "担当店舗", "stores", false),
              field("departmentId", "担当売場", "departments", false),
            ]}
            lookups={lookups}
          />
          <h2>利用者CSV</h2>
          <UserImportForm />
        </section>
      )}
      {feature === "imports" && roles.includes("information_systems") && (
        <section className="page-panel">
          <h2>売上CSV取込</h2>
          <SalesImportForm />
        </section>
      )}
      {pages.map(({ resource, data }) => (
        <ResourceTable
          key={resource}
          resource={resource}
          data={data}
          lookups={lookups}
          roles={roles}
        />
      ))}
      {(Number(search.page || 1) > 1 ||
        (feature !== "storeSales" &&
          pages.some(({ data }) => data.page * data.pageSize < data.total))) && (
        <nav className="page-panel button-row" aria-label="ページ切替">
          {Number(search.page || 1) > 1 && (
            <Link
              className="ghost-button"
              href={`${uiConfig.pages[feature].href}?${new URLSearchParams({ ...search, page: String(Number(search.page) - 1) } as Record<string, string>)}`}
            >
              前へ
            </Link>
          )}
          {feature !== "storeSales" &&
            pages.some(({ data }) => data.page * data.pageSize < data.total) && (
              <Link
                className="ghost-button"
                href={`${uiConfig.pages[feature].href}?${new URLSearchParams({ ...search, page: String(Number(search.page || 1) + 1) } as Record<string, string>)}`}
              >
                次へ
              </Link>
            )}
        </nav>
      )}
    </PageLayout>
  );
}
