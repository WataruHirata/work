import "server-only";
import { createSupabaseServerClient } from "@/infrastructure/supabase/clients/server";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/clients/admin";
import type {
  BusinessRepository,
  Command,
  DataPage,
  DataRecord,
  IdentityProvider,
  Json,
  QueryOptions,
  Resource,
} from "@/domain/contracts";

const tables: Record<
  Resource,
  {
    table: string;
    fields: string;
    order: string;
    search?: string;
    dated?: string;
    scoped?: boolean;
  }
> = {
  instructions: {
    table: "store_instructions",
    fields: "id,kind,title,message,product_id,price_yen,effective_at,created_at",
    order: "created_at",
  },
  instructionTargets: {
    table: "store_instruction_targets",
    fields: "instruction_id,store_id,confirmed_at,confirmed_by",
    order: "store_id",
    scoped: true,
  },
  products: {
    table: "products",
    fields: "id,code,name,category_code,tax_rate,active,promotion_eligibility,updated_at",
    order: "code",
    search: "name",
  },
  stores: {
    table: "stores",
    fields:
      "id,code,name,area_id,opening_time,closing_time,business_day_starts_at,status,has_dine_in,opened_on,updated_at",
    order: "code",
    search: "name",
  },
  areas: { table: "areas", fields: "id,code,name", order: "code" },
  departments: {
    table: "store_departments",
    fields: "id,store_id,code,name,active",
    order: "code",
    scoped: true,
  },
  sales: {
    table: "sales_days",
    fields:
      "id,store_id,business_date,status,net_sales_yen,gross_sales_yen,customer_count,transaction_count,updated_at",
    order: "business_date",
    dated: "business_date",
    scoped: true,
  },
  corrections: {
    table: "sales_corrections",
    fields: "id,sales_day_id,reason,before_amount_yen,after_amount_yen,status,requested_at",
    order: "requested_at",
  },
  approvals: {
    table: "sales_approvals",
    fields: "id,correction_id,approval_stage,approved,comment,acted_at",
    order: "acted_at",
  },
  orders: {
    table: "orders",
    fields:
      "id,store_id,department_id,order_date,requested_delivery_date,order_total_yen,status,requested_by,updated_at",
    order: "created_at",
    scoped: true,
  },
  orderLines: {
    table: "order_lines",
    fields: "id,order_id,product_id,quantity,unit_price_yen,line_total_yen",
    order: "created_at",
  },
  inventory: {
    table: "inventory_snapshots",
    fields: "id,store_id,department_id,product_id,quantity,observed_at,source_reference",
    order: "observed_at",
    scoped: true,
  },
  notifications: {
    table: "notifications",
    fields: "id,title,message,notification_type,correction_id,read_at,created_at",
    order: "created_at",
  },
  announcements: {
    table: "store_announcements",
    fields: "id,store_id,title,message,updated_at",
    order: "created_at",
    scoped: true,
  },
  users: {
    table: "app_users",
    fields:
      "id,employee_code,display_name,email,affiliation,active,must_change_password,updated_at",
    order: "display_name",
    search: "display_name",
  },
  roles: {
    table: "user_role_assignments",
    fields: "id,user_id,role,area_id,store_id,department_id",
    order: "created_at",
  },
  audit: {
    table: "audit_logs",
    fields: "id,table_name,record_id,operation,actor_id,occurred_at,before_data,after_data",
    order: "occurred_at",
    dated: "occurred_at",
    search: "table_name",
  },
  imports: {
    table: "sales_imports",
    fields: "id,source_file_name,source_checksum,status,rows_received,error_summary,received_at",
    order: "received_at",
  },
  jobs: {
    table: "integration_jobs",
    fields: "id,kind,idempotency_key,status,attempts,last_error,available_at,created_at",
    order: "created_at",
  },
  devices: {
    table: "store_devices",
    fields: "id,store_id,name,active,created_at",
    order: "created_at",
  },
  prices: {
    table: "product_prices",
    fields: "id,product_id,store_id,price_yen,valid_from,valid_until",
    order: "valid_from",
  },
  campaigns: {
    table: "campaigns",
    fields: "id,name,starts_at,ends_at,status,published_at,created_at,updated_at",
    order: "starts_at",
  },
  campaignItems: {
    table: "campaign_items",
    fields: "id,campaign_id,product_id,price_yen,eligibility_status",
    order: "created_at",
  },
  campaignTargets: {
    table: "campaign_store_targets",
    fields: "campaign_id,store_id,store_confirmed_at",
    order: "updated_at",
    scoped: true,
  },
  campaignTasks: {
    table: "campaign_item_store_tasks",
    fields:
      "campaign_item_id,store_id,pos_promotion_status,pos_promotion_confirmed_at,price_label_changed_at,pop_changed_at,display_changed_at,pos_restore_status,pos_restored_at,price_label_restored_at,pop_restored_at,display_restored_at",
    order: "updated_at",
    scoped: true,
  },
};

const commands: Record<Command, string> = {
  sendInstruction: "send_store_instruction",
  confirmInstruction: "confirm_store_instruction",
  confirmSales: "confirm_sales_day",
  requestCorrection: "request_sales_correction",
  approveCorrection: "approve_sales_correction",
  finalizeMonth: "finalize_sales_month",
  createOrder: "submit_store_order",
  markRead: "mark_notification_read",
  assignRole: "assign_app_role",
  revokeRole: "revoke_app_role",
  retryJob: "retry_integration_job",
  registerDevice: "register_store_device",
  changeCampaignEligibility: "verify_campaign_product",
  disableDevice: "disable_store_device",
  createCampaign: "create_campaign_draft",
  publishCampaign: "publish_campaign_draft",
  confirmCampaign: "set_campaign_store_confirmation",
  updateCampaignTask: "set_campaign_item_store_task",
  importSales: "import_canonical_sales",
  importProfiles: "import_app_profiles",
  editCampaign: "edit_campaign_draft",
};
function databaseError(error: { code?: string } | null, fallback: string): never {
  if (error?.code === "23505") throw new Error("同じコードのデータが既に存在します。");
  if (error?.code === "42501") throw new Error("この操作を実行する権限がありません。");
  if (error?.code === "P0001")
    throw new Error(
      "状態・担当範囲・入力内容が業務条件に合いません。最新のデータを確認してください。",
    );
  throw new Error(fallback);
}

export class SupabaseRepository implements BusinessRepository {
  async list(resource: Resource, options: QueryOptions = {}): Promise<DataPage> {
    const client = await createSupabaseServerClient();
    const spec = tables[resource];
    const page = Math.max(1, Math.min(10000, Math.trunc(options.page || 1)));
    const pageSize = resource === "notifications" ? 100 : 50;
    let query = client.from(spec.table).select(spec.fields, { count: "exact" });
    if (options.correctionId && resource === "corrections")
      query = query.eq("id", options.correctionId);
    if (options.correctionId && resource === "approvals")
      query = query.eq("correction_id", options.correctionId);
    if (options.storeId && spec.scoped) query = query.eq("store_id", options.storeId);
    if (options.from && spec.dated) query = query.gte(spec.dated, options.from);
    if (options.to && spec.dated)
      query =
        spec.dated === "business_date"
          ? query.lte(spec.dated, options.to)
          : query.lt(
              spec.dated,
              new Date(Date.parse(`${options.to}T00:00:00+09:00`) + 86400000).toISOString(),
            );
    if (options.search && spec.search)
      query = query.ilike(spec.search, `%${options.search.replace(/[%_\\]/g, "").slice(0, 100)}%`);
    const { data, error, count } = await query
      .order(spec.order, {
        ascending: ["code", "display_name"].includes(spec.order),
      })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error)
      databaseError(
        error,
        "データを取得できませんでした。接続設定とマイグレーションの適用を確認してください。",
      );
    return {
      rows: (data ?? []) as unknown as DataRecord[],
      total: count ?? 0,
      page,
      pageSize,
    };
  }
  async save(
    resource: "products" | "stores" | "users" | "announcements",
    values: Record<string, Json>,
    id?: string,
    expectedVersion?: string,
  ) {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("save_business_master", {
      p_resource: resource,
      p_id: id ?? null,
      p_values: values,
      p_expected_version: expectedVersion ?? null,
    });
    if (error || !data)
      databaseError(
        error,
        "保存できませんでした。ほかの方の更新と競合している場合は画面を更新してください。",
      );
  }
  async execute(command: Command, input: Record<string, Json>): Promise<Json> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc(commands[command], input);
    if (error)
      databaseError(error, "処理を完了できませんでした。最新状態と権限を確認してください。");
    return data as Json;
  }
  async storeSnapshot(deviceToken: string): Promise<Record<string, Json>> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("store_device_snapshot", {
      p_token: deviceToken,
    });
    if (error)
      throw new Error("店舗端末を確認できません。管理者に端末の再登録を依頼してください。");
    return data as Record<string, Json>;
  }
}

export class SupabaseIdentity implements IdentityProvider {
  async session() {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (!user) {
      if (error && error.name !== "AuthSessionMissingError")
        throw new Error("認証サービスに接続できません。");
      return null;
    }
    const [profile, assignments] = await Promise.all([
      client
        .from("app_users")
        .select("display_name,active,must_change_password")
        .eq("id", user.id)
        .maybeSingle(),
      client.from("user_role_assignments").select("role,store_id,area_id").eq("user_id", user.id),
    ]);
    if (error || profile.error || assignments.error)
      throw new Error("利用者情報を確認できません。DBの接続と版を確認してください。");
    return {
      userId: user.id,
      displayName: profile.data?.display_name ?? "",
      active: Boolean(profile.data?.active),
      mustChangePassword: Boolean(profile.data?.must_change_password),
      roles: (assignments.data ?? []).map((row: { role: string }) => row.role),
      storeIds: [
        ...new Set(
          (assignments.data ?? []).flatMap((row: { store_id: string | null }) =>
            row.store_id ? [row.store_id] : [],
          ),
        ),
      ],
      areaIds: [
        ...new Set(
          (assignments.data ?? []).flatMap((row: { area_id: string | null }) =>
            row.area_id ? [row.area_id] : [],
          ),
        ),
      ],
    };
  }
  async signIn(email: string, password: string) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error("メールアドレスまたはパスワードを確認してください。");
    const session = await this.session();
    if (!session?.active || !session.roles.length) {
      await client.auth.signOut();
      throw new Error("このアカウントは利用できません。");
    }
  }
  async signOut() {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signOut();
    if (error) throw new Error("ログアウトできませんでした。");
  }
  async exchangeCode(code: string) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error("認証用リンクを確認できませんでした。");
  }
  async changePassword(password: string) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error("パスワードを更新できませんでした。");
    // auth.users trigger clears must_change_password only on a real password change.
  }
  async resetPassword(email: string, redirectTo: string) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw new Error("再設定を受け付けられませんでした。");
  }
  async provisionUser(email: string, password: string, employeeCode: string, displayName: string) {
    const session = await this.session();
    if (
      !session?.active ||
      session.mustChangePassword ||
      !session.roles.includes("information_systems")
    )
      throw new Error("情報システム権限が必要です。");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("利用者登録用のサーバー認証設定がありません。");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error("利用者を登録できませんでした。メールアドレスの重複を確認してください。");
    const client = await createSupabaseServerClient();
    const result = await client.rpc("create_app_profile", {
      p_user_id: data.user.id,
      p_employee_code: employeeCode,
      p_display_name: displayName,
    });
    if (result.error) {
      const cleanup = await admin.auth.admin.deleteUser(data.user.id);
      if (cleanup.error)
        throw new Error(
          "利用者プロフィールを作成できませんでした。認証サービスの未割当アカウントを管理者が確認してください。",
        );
      throw new Error("利用者登録を取り消しました。社員番号を確認してください。");
    }
  }
}
