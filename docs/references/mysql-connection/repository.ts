import "server-only";
import { randomUUID, scryptSync, timingSafeEqual, createHmac, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { BusinessRepository, Command, DataPage, DataRecord, IdentityProvider, Json, QueryOptions, Resource, Session } from "@/domain/contracts";
import { tableSpecs } from "@database/mock/pglite/adapter";
import { mysqlPool, mysqlTransaction } from "./pool";
import type { RowDataPacket } from "mysql2/promise";

function currentUserIdFromCookie(value?: string) {
  if (!value) return null;
  const [userId, expiry, signature] = value.split(".");
  if (!userId || !expiry || !signature || Number(expiry) < Date.now()) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRETには32文字以上を設定してください。");
  const expected = createHmac("sha256", secret).update(`${userId}.${expiry}`).digest("hex");
  const a = Buffer.from(signature), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

async function currentUserId() {
  return currentUserIdFromCookie((await cookies()).get("minoriya-local-session")?.value);
}

const sessionCookie = "minoriya-local-session";
const hashPassword = (password: string) => scryptSync(password, "minoriya-local-mysql-auth", 64).toString("hex");

export class MysqlIdentity implements IdentityProvider {
  async session(): Promise<Session | null> {
    const userId = await currentUserId();
    if (!userId) return null;
    const [users] = await mysqlPool().execute<(RowDataPacket & { display_name: string; active: number; must_change_password: number })[]>("SELECT display_name,active,must_change_password FROM app_users WHERE id=?", [userId]);
    if (!users[0]) return null;
    const [roles] = await mysqlPool().execute<(RowDataPacket & { role: string })[]>("SELECT role FROM user_role_assignments WHERE user_id=?", [userId]);
    return { userId, displayName: users[0].display_name, active: Boolean(users[0].active), mustChangePassword: Boolean(users[0].must_change_password), roles: roles.map(({ role }) => role) };
  }
  async signIn(email: string, password: string) {
    const [rows] = await mysqlPool().execute<(RowDataPacket & { id: string; active: number; password_hash: string })[]>("SELECT id,active,password_hash FROM app_users WHERE LOWER(email)=LOWER(?)", [email]);
    const user = rows[0];
    const actual = Buffer.from(hashPassword(password), "hex");
    const expected = Buffer.from(user?.password_hash ?? "", "hex");
    if (!user || !user.active || expected.length !== actual.length || !timingSafeEqual(actual, expected)) throw new Error("メールアドレスまたはパスワードを確認してください。");
    const [roles] = await mysqlPool().execute<(RowDataPacket & { role: string })[]>("SELECT role FROM user_role_assignments WHERE user_id=?", [user.id]);
    if (!roles.length) throw new Error("このアカウントは利用できません。");
    const expires = String(Date.now() + 8 * 60 * 60 * 1000);
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error("SESSION_SECRETには32文字以上を設定してください。");
    const signature = createHmac("sha256", secret).update(`${user.id}.${expires}`).digest("hex");
    (await cookies()).set(sessionCookie, `${user.id}.${expires}.${signature}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60 });
  }
  async signOut() { (await cookies()).delete(sessionCookie); }
  async changePassword(password: string) {
    const id = await currentUserId();
    if (!id) throw new Error("ログインしてください。");
    await mysqlPool().execute("UPDATE app_users SET password_hash=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?", [hashPassword(password), id]);
  }
  async resetPassword() { throw new Error("ローカル環境ではメールによる再設定を行えません。情報システム担当へ依頼してください。"); }
  async exchangeCode() { throw new Error("メール認証リンクはこの認証方式では使用できません。"); }
  async provisionUser(email: string, password: string, employeeCode: string, displayName: string) {
    const session = await this.session();
    if (!session?.active || session.mustChangePassword || !session.roles.includes("information_systems")) throw new Error("情報システム権限が必要です。");
    await mysqlPool().execute("INSERT INTO app_users(id,email,employee_code,display_name,active,must_change_password,password_hash) VALUES(?,?,?,?,1,1,?)", [randomUUID(), email, employeeCode, displayName, hashPassword(password)]);
  }
}

export class MysqlRepository implements BusinessRepository {
  async list(resource: Resource, options: QueryOptions = {}): Promise<DataPage> {
    const spec = tableSpecs[resource];
    const session = await new MysqlIdentity().session();
    if (!session?.active) throw new Error("ログインしてください。");
    const globalRoles = ["information_systems", "product_office", "store_operations", "accounting"];
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (options.correctionId && resource === "corrections") { clauses.push("id=?"); values.push(options.correctionId); }
    if (options.correctionId && resource === "approvals") { clauses.push("correction_id=?"); values.push(options.correctionId); }
    if (options.storeId && spec.scoped) { clauses.push("store_id=?"); values.push(options.storeId); }
    if (options.from && spec.dated) { clauses.push(`\`${spec.dated}\`>=?`); values.push(options.from); }
    if (options.to && spec.dated) { clauses.push(`\`${spec.dated}\`<?`); values.push(`${options.to} 23:59:59.999`); }
    if (options.search && spec.search) { clauses.push(`LOWER(\`${spec.search}\`) LIKE ?`); values.push(`%${options.search.replace(/[%_\\]/g, "").slice(0, 100).toLowerCase()}%`); }
    if (spec.scoped && !session.roles.some((role) => globalRoles.includes(role))) {
      clauses.push("EXISTS (SELECT 1 FROM user_role_assignments ura LEFT JOIN stores scoped_store ON scoped_store.id=?table?.store_id WHERE ura.user_id=? AND (ura.store_id=?table?.store_id OR (ura.area_id IS NOT NULL AND scoped_store.area_id=ura.area_id)))".replaceAll("?table?", `\`${spec.table}\``));
      values.push(session.userId);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const page = Math.max(1, Math.min(10000, Math.trunc(options.page || 1)));
    const pageSize = resource === "notifications" ? 100 : 50;
    const [countRows] = await mysqlPool().execute<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM \`${spec.table}\`${where}`, values as never[]);
    const order = ["code", "display_name"].includes(spec.order) ? "ASC" : "DESC";
    const [rows] = await mysqlPool().execute<(RowDataPacket & DataRecord)[]>(`SELECT ${spec.fields.split(",").map((field) => `\`${field.trim()}\``).join(",")} FROM \`${spec.table}\`${where} ORDER BY \`${spec.order}\` ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, values as never[]);
    return { rows: rows as DataRecord[], total: Number(countRows[0]?.total ?? 0), page, pageSize };
  }
  async save(resource: "products" | "stores" | "users" | "announcements", values: Record<string, Json>, id?: string, expectedVersion?: string) {
    const session = await new MysqlIdentity().session();
    if (!session?.active || !session.roles.some((role) => ["information_systems", "product_office", "store_operations"].includes(role))) throw new Error("この操作を行う権限がありません。");
    const tables = { products: "products", stores: "stores", users: "app_users", announcements: "store_announcements" } as const;
    const table = tables[resource];
    const columns = new Set((await mysqlPool().query<(RowDataPacket & { COLUMN_NAME: string })[]>(`SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?`, [table]))[0].map((column) => column.COLUMN_NAME));
    const input = Object.fromEntries(Object.entries(values).filter(([key, value]) => columns.has(key) && key !== "id" && value !== undefined));
    if (id) {
      if (!expectedVersion) throw new Error("更新版を確認できません。");
      const [result] = await mysqlPool().execute(`UPDATE \`${table}\` SET ${Object.keys(input).map((key) => `\`${key}\`=?`).join(",")},updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND updated_at=?`, [...Object.values(input), id, expectedVersion]);
      if (!(result as { affectedRows: number }).affectedRows) throw new Error("他の利用者が更新した可能性があります。画面を再読み込みしてください。");
      return;
    }
    await mysqlPool().execute(`INSERT INTO \`${table}\` (id,${Object.keys(input).map((key) => `\`${key}\``).join(",")}) VALUES (?,${Object.keys(input).map(() => "?").join(",")})`, [randomUUID(), ...Object.values(input)]);
  }
  async execute(command: Command, input: Record<string, Json>): Promise<Json> {
    const session = await new MysqlIdentity().session();
    if (!session?.active) throw new Error("ログインしてください。");
    switch (command) {
      case "markRead": {
        const [result] = await mysqlPool().execute("UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP(3)) WHERE id=? AND user_id=?", [input.p_notification_id, session.userId]);
        if (!(result as { affectedRows: number }).affectedRows) throw new Error("通知を更新できません。");
        return null;
      }
      case "assignRole": {
        if (!session.roles.includes("information_systems")) throw new Error("情報システム権限が必要です。");
        const role = String(input.p_role);
        const areaId = input.p_area_id ? String(input.p_area_id) : null;
        const storeId = input.p_store_id ? String(input.p_store_id) : null;
        const departmentId = input.p_department_id ? String(input.p_department_id) : null;
        const valid = role === "area_manager" ? Boolean(areaId && !storeId && !departmentId)
          : ["store_manager"].includes(role) ? Boolean(storeId && !areaId && !departmentId)
          : ["department_lead", "staff"].includes(role) ? Boolean(storeId && departmentId && !areaId)
          : ["product_office", "store_operations", "information_systems", "accounting"].includes(role) ? Boolean(!areaId && !storeId && !departmentId)
          : false;
        if (!valid) throw new Error("権限の適用範囲が不正です。");
        const id = randomUUID();
        await mysqlTransaction(async (db) => {
          const [users] = await db.execute<(RowDataPacket & { active: number })[]>("SELECT active FROM app_users WHERE id=? FOR UPDATE", [input.p_user_id]);
          if (!users[0]?.active) throw new Error("有効な利用者を指定してください。");
          if (storeId && departmentId) {
            const [departments] = await db.execute("SELECT 1 FROM store_departments WHERE id=? AND store_id=? AND active=1", [departmentId, storeId]);
            if (!departments) throw new Error("担当売場が店舗に属していません。");
          }
          await db.execute("INSERT INTO user_role_assignments(id,user_id,role,area_id,store_id,department_id,assigned_by) VALUES(?,?,?,?,?,?,?)", [id, input.p_user_id, role, areaId, storeId, departmentId, session.userId]);
        });
        return id;
      }
      case "revokeRole": {
        if (!session.roles.includes("information_systems")) throw new Error("情報システム権限が必要です。");
        await mysqlTransaction(async (db) => {
          const [rows] = await db.execute<(RowDataPacket & { user_id: string; role: string })[]>("SELECT user_id,role FROM user_role_assignments WHERE id=? FOR UPDATE", [input.p_assignment_id]);
          const assignment = rows[0];
          if (!assignment) throw new Error("権限割当が見つかりません。");
          if (assignment.user_id === session.userId) throw new Error("自分自身の権限は解除できません。");
          if (assignment.role === "information_systems") {
            const [count] = await db.execute<(RowDataPacket & { total: number })[]>("SELECT COUNT(*) total FROM user_role_assignments WHERE role='information_systems'");
            if (Number(count[0]?.total) <= 1) throw new Error("最後の情報システム管理者は解除できません。");
          }
          await db.execute("DELETE FROM user_role_assignments WHERE id=?", [input.p_assignment_id]);
        });
        return null;
      }
      case "registerDevice": {
        if (!session.roles.includes("information_systems")) throw new Error("情報システム権限が必要です。");
        const token = String(input.p_token ?? "");
        if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("端末コードの形式が不正です。");
        const id = randomUUID();
        await mysqlPool().execute("INSERT INTO store_devices(id,store_id,name,token_hash,active,created_by) VALUES(?,?,?,?,1,?)", [id, input.p_store_id, input.p_name, createHash("sha256").update(token).digest(), session.userId]);
        return id;
      }
      case "disableDevice": {
        if (!session.roles.includes("information_systems")) throw new Error("情報システム権限が必要です。");
        const [result] = await mysqlPool().execute("UPDATE store_devices SET active=0 WHERE id=? AND active=1", [input.p_device_id]);
        if (!(result as { affectedRows: number }).affectedRows) throw new Error("有効な端末が見つかりません。");
        return null;
      }
      case "changeCampaignEligibility": {
        if (!session.roles.includes("product_office")) throw new Error("商品部権限が必要です。");
        const [result] = await mysqlPool().execute("UPDATE campaign_items item JOIN campaigns campaign ON campaign.id=item.campaign_id JOIN products product ON product.id=item.product_id SET item.eligibility_status=product.promotion_eligibility WHERE item.id=? AND campaign.status='draft'", [input.p_campaign_item_id]);
        if (!(result as { affectedRows: number }).affectedRows) throw new Error("編集中の特売商品が見つかりません。");
        return null;
      }
      case "retryJob": {
        if (!session.roles.some((role) => ["information_systems", "product_office"].includes(role))) throw new Error("連携ジョブの再実行権限がありません。");
        const [result] = await mysqlPool().execute("UPDATE integration_jobs SET status='pending',available_at=CURRENT_TIMESTAMP(3),last_error=NULL,locked_until=NULL,lease_id=NULL,updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND status='failed'", [input.p_job_id]);
        if (!(result as { affectedRows: number }).affectedRows) throw new Error("再実行できる失敗ジョブが見つかりません。");
        return null;
      }
      default:
        throw new Error(`MySQL移植対象の業務トランザクションが未実装です: ${command}`);
    }
  }
  async storeDeviceSalesDayLines(): Promise<DataRecord[]> { throw new Error("登録端末の売上明細は未設定です。"); }
  async storeDeviceCorrections(): Promise<DataRecord[]> { throw new Error("登録端末の修正申請は未設定です。"); }
  async storeDeviceRequestCorrection(): Promise<string> { throw new Error("登録端末の修正申請は未設定です。"); }
  async storeDeviceOrderWorkspace(): Promise<Record<string, Json>> { throw new Error("登録端末の発注画面は未設定です。"); }
  async storeDeviceCreateOrder(): Promise<string> { throw new Error("登録端末の発注処理は未設定です。"); }
  async storeDeviceConfirmInstruction(): Promise<void> { throw new Error("登録端末の特売確認は未設定です。"); }
  async storeSnapshot(): Promise<Record<string, Json>> { throw new Error("店舗端末用MySQLスナップショット処理は未設定です。"); }
}
