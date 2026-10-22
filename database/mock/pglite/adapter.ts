import "server-only";
import { createHash, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import type { Transaction } from "@electric-sql/pglite";
import { cookies } from "next/headers";
import type {
  BusinessRepository,
  Command,
  DataPage,
  DataRecord,
  IdentityProvider,
  IntegrationJob,
  IntegrationJobStore,
  Json,
  QueryOptions,
  Resource,
  Session,
} from "@/domain/contracts";
import { withLocalDatabase } from "./database";

export const tableSpecs: Record<
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

const rpc: Record<Command, string> = {
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

async function authenticated<T>(
  userId: string,
  operation: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return withLocalDatabase((db) =>
    db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
      return operation(tx);
    }),
  );
}

async function currentUserId() {
  const token = (await cookies()).get("minoriya-local-session")?.value;
  if (!token) return null;
  const [userId, expiry, signature] = token.split(".");
  if (!userId || !expiry || !signature || Number(expiry) < Date.now()) return null;
  const expected = createHmac("sha256", "minoriya-local-mock-session-only")
    .update(`${userId}.${expiry}`)
    .digest("hex");
  const a = Buffer.from(signature),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export class LocalRepository implements BusinessRepository {
  async list(resource: Resource, options: QueryOptions = {}): Promise<DataPage> {
    const spec = tableSpecs[resource];
    const page = Math.max(1, Math.min(10000, Math.trunc(options.page || 1)));
    const pageSize = resource === "notifications" ? 100 : 50;
    const predicates: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      predicates.push(sql.replace("?", `$${params.length}`));
    };
    if (options.correctionId && resource === "corrections") add("id=?", options.correctionId);
    if (options.correctionId && resource === "approvals")
      add("correction_id=?", options.correctionId);
    if (options.storeId && spec.scoped) add("store_id=?", options.storeId);
    if (options.storeId && resource === "corrections") {
      params.push(options.storeId);
      predicates.push(
        `exists (select 1 from public.sales_days scoped_sales where scoped_sales.id=sales_corrections.sales_day_id and scoped_sales.store_id=$${params.length})`,
      );
    }
    if (options.storeId && resource === "orderLines") {
      params.push(options.storeId);
      predicates.push(
        `exists (select 1 from public.orders scoped_order where scoped_order.id=order_lines.order_id and scoped_order.store_id=$${params.length})`,
      );
    }
    if (options.from && spec.dated) add(`${spec.dated}>=?`, options.from);
    if (options.to && spec.dated) add(`${spec.dated}<=?`, options.to);
    if (options.search && spec.search)
      add(
        `lower(${spec.search}) like ?`,
        `%${options.search
          .toLowerCase()
          .replace(/[%_\\]/g, "")
          .slice(0, 100)}%`,
      );
    const where = predicates.length ? ` where ${predicates.join(" and ")}` : "";
    return authenticated(
      (await currentUserId()) ?? "00000000-0000-0000-0000-000000000000",
      async (tx) => {
        const count = await tx.query<{ total: number }>(
          `select count(*)::int total from public.${spec.table}${where}`,
          params,
        );
        const order = spec.order;
        const rows = await tx.query<DataRecord>(
          `select ${spec.fields} from public.${spec.table}${where} order by ${order} ${["code", "display_name"].includes(order) ? "asc" : "desc"} limit ${pageSize} offset ${(page - 1) * pageSize}`,
          params,
        );
        return {
          rows: rows.rows,
          total: count.rows[0]?.total ?? 0,
          page,
          pageSize,
        };
      },
    );
  }
  async save(
    resource: "products" | "stores" | "users" | "announcements",
    values: Record<string, Json>,
    id?: string,
    expectedVersion?: string,
  ) {
    await this.execute("editCampaign" as Command, {}); // replaced below by the shared save RPC
    void resource;
    void values;
    void id;
    void expectedVersion;
  }
  async execute(command: Command, input: Record<string, Json>): Promise<Json> {
    const userId = await currentUserId();
    if (!userId) throw new Error("ログインしてください。");
    const fn = rpc[command];
    const entries = Object.entries(input);
    const args = entries.map(([key], index) => `${key} => $${index + 1}`).join(",");
    const values = entries.map(([, value]) => value);
    return authenticated(userId, async (tx) => {
      const result = await tx.query<{ value: Json }>(
        `select public.${fn}(${args}) as value`,
        values,
      );
      return result.rows[0]?.value ?? null;
    });
  }
  async storeSnapshot(deviceToken: string): Promise<Record<string, Json>> {
    return withLocalDatabase(async (db) => {
      const result = await db.query<{ value: Record<string, Json> }>(
        "select public.store_device_snapshot($1) as value",
        [deviceToken],
      );
      return result.rows[0]?.value;
    });
  }
}

export class LocalIdentity implements IdentityProvider {
  async session(): Promise<Session | null> {
    const userId = await currentUserId();
    if (!userId) return null;
    return withLocalDatabase(async (db) => {
      const profile = await db.query<{
        display_name: string;
        active: boolean;
        must_change_password: boolean;
      }>("select display_name,active,must_change_password from public.app_users where id=$1", [
        userId,
      ]);
      if (!profile.rows[0]) return null;
      const assignments = await db.query<{
        role: string;
        store_id: string | null;
        area_id: string | null;
      }>("select role::text,store_id,area_id from public.user_role_assignments where user_id=$1", [
        userId,
      ]);
      return {
        userId,
        displayName: profile.rows[0].display_name,
        active: profile.rows[0].active,
        mustChangePassword: profile.rows[0].must_change_password,
        roles: assignments.rows.map((row) => row.role),
        storeIds: [
          ...new Set(assignments.rows.flatMap((row) => (row.store_id ? [row.store_id] : []))),
        ],
        areaIds: [
          ...new Set(assignments.rows.flatMap((row) => (row.area_id ? [row.area_id] : []))),
        ],
      };
    });
  }
  async signIn(email: string, password: string) {
    await withLocalDatabase(async (db) => {
      const result = await db.query<{ id: string; encrypted_password: string }>(
        "select id,encrypted_password from auth.users where lower(email)=lower($1) and email_confirmed_at is not null",
        [email],
      );
      const user = result.rows[0];
      const passwordHash = scryptSync(password, "minoriya-local-mock-auth", 64);
      const expectedHash = Buffer.from(user?.encrypted_password ?? "", "hex");
      if (
        !user ||
        expectedHash.length !== passwordHash.length ||
        !timingSafeEqual(passwordHash, expectedHash)
      )
        throw new Error("メールアドレスまたはパスワードを確認してください。");
      const profile = await db.query<{ active: boolean }>(
        "select active from public.app_users where id=$1",
        [user.id],
      );
      const roles = await db.query("select 1 from public.user_role_assignments where user_id=$1", [
        user.id,
      ]);
      if (!profile.rows[0]?.active || !roles.rows.length)
        throw new Error("このアカウントは利用できません。");
      const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
      const signature = createHmac("sha256", "minoriya-local-mock-session-only")
        .update(`${user.id}.${expiry}`)
        .digest("hex");
      (await cookies()).set("minoriya-local-session", `${user.id}.${expiry}.${signature}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 8 * 60 * 60,
      });
    });
  }
  async signOut() {
    (await cookies()).delete("minoriya-local-session");
  }
  async changePassword(password: string) {
    const userId = await currentUserId();
    if (!userId) throw new Error("ログインしてください。");
    await withLocalDatabase(async (db) => {
      await db.query("update auth.users set encrypted_password=$2,updated_at=now() where id=$1", [
        userId,
        scryptSync(password, "minoriya-local-mock-auth", 64).toString("hex"),
      ]);
    });
  }
  async resetPassword() {
    throw new Error(
      "ローカルモックではメール送信を行いません。管理者にパスワード変更を依頼してください。",
    );
  }
  async exchangeCode() {
    throw new Error("ローカルモックではメール認証リンクを使用しません。");
  }
  async provisionUser(email: string, password: string, employeeCode: string, displayName: string) {
    const session = await this.session();
    if (
      !session?.active ||
      session.mustChangePassword ||
      !session.roles.includes("information_systems")
    )
      throw new Error("情報システム権限が必要です。");
    const id = crypto.randomUUID();
    await withLocalDatabase(async (db) => {
      await db.query(
        "insert into auth.users(id,email,encrypted_password,email_confirmed_at) values($1,$2,$3,now())",
        [id, email, scryptSync(password, "minoriya-local-mock-auth", 64).toString("hex")],
      );
      await db.query(
        "insert into public.app_users(id,email,employee_code,display_name,active,must_change_password) values($1,$2,$3,$4,true,true)",
        [id, email, employeeCode, displayName],
      );
    });
  }
}

export class LocalIntegrationStore implements IntegrationJobStore {
  async claim(kinds: string[], limit: number): Promise<IntegrationJob[]> {
    return withLocalDatabase(async (db) => {
      const result = await db.query<{
        id: string;
        kind: string;
        idempotency_key: string;
        payload: Json;
        lease_id: string;
      }>("select * from public.claim_integration_jobs($1,$2)", [kinds, limit]);
      return result.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        idempotencyKey: row.idempotency_key,
        payload: row.payload,
        leaseId: row.lease_id,
      }));
    });
  }
  async finish(job: IntegrationJob, success: boolean, result: Json, error?: string) {
    await withLocalDatabase((db) =>
      db
        .query("select public.finish_integration_job($1,$2,$3,$4,$5)", [
          job.id,
          job.leaseId,
          success,
          result,
          error ?? null,
        ])
        .then(() => undefined),
    );
  }
  async restorePrice(productId: string, storeId: string) {
    return withLocalDatabase(
      async (db) =>
        (
          await db.query<{
            value: { priceYen: number; revision: string } | null;
          }>("select public.resolve_restore_price_quote($1,$2) as value", [productId, storeId])
        ).rows[0]?.value ?? null,
    );
  }
  async promotionEligible(productId: string) {
    return withLocalDatabase(async (db) =>
      Boolean(
        (
          await db.query(
            "select 1 from public.products where id=$1 and active and promotion_eligibility='eligible'",
            [productId],
          )
        ).rows.length,
      ),
    );
  }
  async ingest(eventId: string, kind: string, rows: Json[]) {
    return withLocalDatabase(
      async (db) =>
        (
          await db.query<{ value: Json }>(
            "select public.ingest_external_snapshot($1,$2,$3::jsonb) as value",
            [eventId, kind, JSON.stringify(rows)],
          )
        ).rows[0]?.value ?? null,
    );
  }
}

export const mockDeviceCode = "6ac6881e515326727cdeb8e78e544d2e575d1f5fb1988c6b604eb357fa6bad69";
export const mockIngestToken = createHash("sha256")
  .update("minoriya local mock ingest token only")
  .digest("hex");
export const mockCronSecret = createHash("sha256")
  .update("minoriya local mock cron token only")
  .digest("hex");
