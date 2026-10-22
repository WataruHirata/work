import "server-only";
import { randomUUID, scryptSync, timingSafeEqual, createHmac, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type {
  BusinessRepository,
  Command,
  DataPage,
  DataRecord,
  IdentityProvider,
  Json,
  QueryOptions,
  Resource,
  Session,
} from "@/domain/contracts";
import { tableSpecs } from "@database/mock/pglite/adapter";
import { mysqlPool, mysqlTransaction } from "./pool";
import type { RowDataPacket } from "mysql2/promise";

function currentUserIdFromCookie(value?: string) {
  if (!value) return null;
  const [userId, expiry, signature] = value.split(".");
  if (!userId || !expiry || !signature || Number(expiry) < Date.now()) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRETには32文字以上を設定してください。");
  const expected = createHmac("sha256", secret).update(`${userId}.${expiry}`).digest("hex");
  const a = Buffer.from(signature),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

async function currentUserId() {
  return currentUserIdFromCookie((await cookies()).get("minoriya-local-session")?.value);
}

const sessionCookie = "minoriya-local-session";
const hashPassword = (password: string) =>
  scryptSync(password, "minoriya-local-mysql-auth", 64).toString("hex");

export class MysqlIdentity implements IdentityProvider {
  async session(): Promise<Session | null> {
    const userId = await currentUserId();
    if (!userId) return null;
    const [users] = await mysqlPool().execute<
      (RowDataPacket & {
        display_name: string;
        active: number;
        must_change_password: number;
      })[]
    >("SELECT display_name,active,must_change_password FROM app_users WHERE id=?", [userId]);
    if (!users[0]) return null;
    const [roles] = await mysqlPool().execute<
      (RowDataPacket & { role: string; store_id: string | null; area_id: string | null })[]
    >("SELECT role,store_id,area_id FROM user_role_assignments WHERE user_id=?", [userId]);
    return {
      userId,
      displayName: users[0].display_name,
      active: Boolean(users[0].active),
      mustChangePassword: Boolean(users[0].must_change_password),
      roles: roles.map(({ role }) => role),
      storeIds: [...new Set(roles.flatMap(({ store_id }) => (store_id ? [store_id] : [])))],
      areaIds: [...new Set(roles.flatMap(({ area_id }) => (area_id ? [area_id] : [])))],
    };
  }
  async signIn(email: string, password: string) {
    const [rows] = await mysqlPool().execute<
      (RowDataPacket & { id: string; active: number; password_hash: string })[]
    >("SELECT id,active,password_hash FROM app_users WHERE LOWER(email)=LOWER(?)", [email]);
    const user = rows[0];
    const actual = Buffer.from(hashPassword(password), "hex");
    const expected = Buffer.from(user?.password_hash ?? "", "hex");
    if (
      !user ||
      !user.active ||
      expected.length !== actual.length ||
      !timingSafeEqual(actual, expected)
    )
      throw new Error("メールアドレスまたはパスワードを確認してください。");
    const [roles] = await mysqlPool().execute<(RowDataPacket & { role: string })[]>(
      "SELECT role FROM user_role_assignments WHERE user_id=?",
      [user.id],
    );
    if (!roles.length) throw new Error("このアカウントは利用できません。");
    const expires = String(Date.now() + 8 * 60 * 60 * 1000);
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32)
      throw new Error("SESSION_SECRETには32文字以上を設定してください。");
    const signature = createHmac("sha256", secret).update(`${user.id}.${expires}`).digest("hex");
    (await cookies()).set(sessionCookie, `${user.id}.${expires}.${signature}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
  }
  async signOut() {
    (await cookies()).delete(sessionCookie);
  }
  async changePassword(password: string) {
    const id = await currentUserId();
    if (!id) throw new Error("ログインしてください。");
    await mysqlPool().execute(
      "UPDATE app_users SET password_hash=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
      [hashPassword(password), id],
    );
  }
  async resetPassword() {
    throw new Error(
      "ローカル環境ではメールによる再設定を行えません。情報システム担当へ依頼してください。",
    );
  }
  async exchangeCode() {
    throw new Error("メール認証リンクはこの認証方式では使用できません。");
  }
  async provisionUser(email: string, password: string, employeeCode: string, displayName: string) {
    const session = await this.session();
    if (
      !session?.active ||
      session.mustChangePassword ||
      !session.roles.includes("information_systems")
    )
      throw new Error("情報システム権限が必要です。");
    await mysqlPool().execute(
      "INSERT INTO app_users(id,email,employee_code,display_name,active,must_change_password,password_hash) VALUES(?,?,?,?,1,1,?)",
      [randomUUID(), email, employeeCode, displayName, hashPassword(password)],
    );
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
    if (options.correctionId && resource === "corrections") {
      clauses.push("id=?");
      values.push(options.correctionId);
    }
    if (options.correctionId && resource === "approvals") {
      clauses.push("correction_id=?");
      values.push(options.correctionId);
    }
    if (options.storeId && spec.scoped) {
      clauses.push("store_id=?");
      values.push(options.storeId);
    }
    if (options.storeId && resource === "corrections") {
      clauses.push(
        "EXISTS (SELECT 1 FROM sales_days scoped_sales WHERE scoped_sales.id=sales_corrections.sales_day_id AND scoped_sales.store_id=?)",
      );
      values.push(options.storeId);
    }
    if (options.storeId && resource === "orderLines") {
      clauses.push(
        "EXISTS (SELECT 1 FROM orders scoped_order WHERE scoped_order.id=order_lines.order_id AND scoped_order.store_id=?)",
      );
      values.push(options.storeId);
    }
    if (options.from && spec.dated) {
      clauses.push(`\`${spec.dated}\`>=?`);
      values.push(options.from);
    }
    if (options.to && spec.dated) {
      clauses.push(`\`${spec.dated}\`<?`);
      values.push(`${options.to} 23:59:59.999`);
    }
    if (options.search && spec.search) {
      clauses.push(`LOWER(\`${spec.search}\`) LIKE ?`);
      values.push(
        `%${options.search
          .replace(/[%_\\]/g, "")
          .slice(0, 100)
          .toLowerCase()}%`,
      );
    }
    if (spec.scoped && !session.roles.some((role) => globalRoles.includes(role))) {
      clauses.push(
        "EXISTS (SELECT 1 FROM user_role_assignments ura LEFT JOIN stores scoped_store ON scoped_store.id=?table?.store_id WHERE ura.user_id=? AND (ura.store_id=?table?.store_id OR (ura.area_id IS NOT NULL AND scoped_store.area_id=ura.area_id)))".replaceAll(
          "?table?",
          `\`${spec.table}\``,
        ),
      );
      values.push(session.userId);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const page = Math.max(1, Math.min(10000, Math.trunc(options.page || 1)));
    const pageSize = resource === "notifications" ? 100 : 50;
    const [countRows] = await mysqlPool().execute<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM \`${spec.table}\`${where}`,
      values as never[],
    );
    const order = ["code", "display_name"].includes(spec.order) ? "ASC" : "DESC";
    const [rows] = await mysqlPool().execute<(RowDataPacket & DataRecord)[]>(
      `SELECT ${spec.fields
        .split(",")
        .map((field) => `\`${field.trim()}\``)
        .join(
          ",",
        )} FROM \`${spec.table}\`${where} ORDER BY \`${spec.order}\` ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      values as never[],
    );
    return {
      rows: rows as DataRecord[],
      total: Number(countRows[0]?.total ?? 0),
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
    const session = await new MysqlIdentity().session();
    if (
      !session?.active ||
      !session.roles.some((role) =>
        ["information_systems", "product_office", "store_operations"].includes(role),
      )
    )
      throw new Error("この操作を行う権限がありません。");
    const tables = {
      products: "products",
      stores: "stores",
      users: "app_users",
      announcements: "store_announcements",
    } as const;
    const table = tables[resource];
    const columns = new Set(
      (
        await mysqlPool().query<(RowDataPacket & { COLUMN_NAME: string })[]>(
          `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?`,
          [table],
        )
      )[0].map((column) => column.COLUMN_NAME),
    );
    const input = Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) => columns.has(key) && key !== "id" && value !== undefined,
      ),
    );
    if (id) {
      if (!expectedVersion) throw new Error("更新版を確認できません。");
      const [result] = await mysqlPool().execute(
        `UPDATE \`${table}\` SET ${Object.keys(input)
          .map((key) => `\`${key}\`=?`)
          .join(",")},updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND updated_at=?`,
        [...Object.values(input), id, expectedVersion],
      );
      if (!(result as { affectedRows: number }).affectedRows)
        throw new Error("他の利用者が更新した可能性があります。画面を再読み込みしてください。");
      return;
    }
    await mysqlPool().execute(
      `INSERT INTO \`${table}\` (id,${Object.keys(input)
        .map((key) => `\`${key}\``)
        .join(",")}) VALUES (?,${Object.keys(input)
        .map(() => "?")
        .join(",")})`,
      [randomUUID(), ...Object.values(input)],
    );
  }
  async execute(command: Command, input: Record<string, Json>): Promise<Json> {
    const session = await new MysqlIdentity().session();
    if (!session?.active) throw new Error("ログインしてください。");
    switch (command) {
      case "markRead": {
        const [result] = await mysqlPool().execute(
          "UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP(3)) WHERE id=? AND user_id=?",
          [input.p_notification_id, session.userId],
        );
        if (!(result as { affectedRows: number }).affectedRows)
          throw new Error("通知を更新できません。");
        return null;
      }
      case "assignRole": {
        if (!session.roles.includes("information_systems"))
          throw new Error("情報システム権限が必要です。");
        const role = String(input.p_role);
        const areaId = input.p_area_id ? String(input.p_area_id) : null;
        const storeId = input.p_store_id ? String(input.p_store_id) : null;
        const departmentId = input.p_department_id ? String(input.p_department_id) : null;
        const valid =
          role === "area_manager"
            ? Boolean(areaId && !storeId && !departmentId)
            : ["store_manager"].includes(role)
              ? Boolean(storeId && !areaId && !departmentId)
              : ["department_lead", "staff"].includes(role)
                ? Boolean(storeId && departmentId && !areaId)
                : [
                      "product_office",
                      "store_operations",
                      "information_systems",
                      "accounting",
                    ].includes(role)
                  ? Boolean(!areaId && !storeId && !departmentId)
                  : false;
        if (!valid) throw new Error("権限の適用範囲が不正です。");
        const id = randomUUID();
        await mysqlTransaction(async (db) => {
          const [users] = await db.execute<(RowDataPacket & { active: number })[]>(
            "SELECT active FROM app_users WHERE id=? FOR UPDATE",
            [input.p_user_id],
          );
          if (!users[0]?.active) throw new Error("有効な利用者を指定してください。");
          if (storeId && departmentId) {
            const [departments] = await db.execute<RowDataPacket[]>(
              "SELECT 1 FROM store_departments WHERE id=? AND store_id=? AND active=1",
              [departmentId, storeId],
            );
            if (!departments.length) throw new Error("担当売場が店舗に属していません。");
          }
          await db.execute(
            "INSERT INTO user_role_assignments(id,user_id,role,area_id,store_id,department_id,assigned_by) VALUES(?,?,?,?,?,?,?)",
            [id, input.p_user_id, role, areaId, storeId, departmentId, session.userId],
          );
        });
        return id;
      }
      case "revokeRole": {
        if (!session.roles.includes("information_systems"))
          throw new Error("情報システム権限が必要です。");
        await mysqlTransaction(async (db) => {
          const [rows] = await db.execute<(RowDataPacket & { user_id: string; role: string })[]>(
            "SELECT user_id,role FROM user_role_assignments WHERE id=? FOR UPDATE",
            [input.p_assignment_id],
          );
          const assignment = rows[0];
          if (!assignment) throw new Error("権限割当が見つかりません。");
          if (assignment.user_id === session.userId)
            throw new Error("自分自身の権限は解除できません。");
          if (assignment.role === "information_systems") {
            const [count] = await db.execute<(RowDataPacket & { total: number })[]>(
              "SELECT COUNT(*) total FROM user_role_assignments WHERE role='information_systems'",
            );
            if (Number(count[0]?.total) <= 1)
              throw new Error("最後の情報システム管理者は解除できません。");
          }
          await db.execute("DELETE FROM user_role_assignments WHERE id=?", [input.p_assignment_id]);
        });
        return null;
      }
      case "registerDevice": {
        if (!session.roles.includes("information_systems"))
          throw new Error("情報システム権限が必要です。");
        const token = String(input.p_token ?? "");
        if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("端末コードの形式が不正です。");
        const id = randomUUID();
        await mysqlPool().execute(
          "INSERT INTO store_devices(id,store_id,name,token_hash,active,created_by) VALUES(?,?,?,?,1,?)",
          [
            id,
            input.p_store_id,
            input.p_name,
            createHash("sha256").update(token).digest(),
            session.userId,
          ],
        );
        return id;
      }
      case "disableDevice": {
        if (!session.roles.includes("information_systems"))
          throw new Error("情報システム権限が必要です。");
        const [result] = await mysqlPool().execute(
          "UPDATE store_devices SET active=0 WHERE id=? AND active=1",
          [input.p_device_id],
        );
        if (!(result as { affectedRows: number }).affectedRows)
          throw new Error("有効な端末が見つかりません。");
        return null;
      }
      case "changeCampaignEligibility": {
        if (!session.roles.includes("product_office")) throw new Error("商品部権限が必要です。");
        const [result] = await mysqlPool().execute(
          "UPDATE campaign_items item JOIN campaigns campaign ON campaign.id=item.campaign_id JOIN products product ON product.id=item.product_id SET item.eligibility_status=product.promotion_eligibility WHERE item.id=? AND campaign.status='draft'",
          [input.p_campaign_item_id],
        );
        if (!(result as { affectedRows: number }).affectedRows)
          throw new Error("編集中の特売商品が見つかりません。");
        return null;
      }
      case "retryJob": {
        if (!session.roles.some((role) => ["information_systems", "product_office"].includes(role)))
          throw new Error("連携ジョブの再実行権限がありません。");
        const [result] = await mysqlPool().execute(
          "UPDATE integration_jobs SET status='pending',available_at=CURRENT_TIMESTAMP(3),last_error=NULL,locked_until=NULL,lease_id=NULL,updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND status='failed'",
          [input.p_job_id],
        );
        if (!(result as { affectedRows: number }).affectedRows)
          throw new Error("再実行できる失敗ジョブが見つかりません。");
        return null;
      }
      case "createOrder": {
        const storeId = String(input.p_store_id ?? "");
        const departmentId = String(input.p_department_id ?? "");
        const deliveryDate = String(input.p_delivery_date ?? "");
        const requestId = String(input.p_request_id ?? "");
        const rawItems = input.p_items;
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
          !/^[0-9a-f-]{36}$/i.test(requestId) ||
          !Array.isArray(rawItems)
        )
          throw new Error("発注内容が不正です。");
        const items = rawItems.map((line) => {
          if (!line || typeof line !== "object" || Array.isArray(line))
            throw new Error("発注明細が不正です。");
          const productId = String(line.product_id ?? "");
          const quantity = Number(line.quantity);
          if (
            !/^[0-9a-f-]{36}$/i.test(productId) ||
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > 99999
          )
            throw new Error("発注明細が不正です。");
          return { productId, quantity };
        });
        if (
          !items.length ||
          items.length > 500 ||
          new Set(items.map((item) => item.productId)).size !== items.length
        )
          throw new Error("発注明細が不正です。");
        return mysqlTransaction(async (db) => {
          const idempotencyKey = `order:${requestId}`;
          const [existingJobs] = await db.execute<
            (RowDataPacket & { order_id: string | null; requested_by: string | null })[]
          >(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.orderId')) AS order_id,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.requestedBy')) AS requested_by FROM integration_jobs WHERE idempotency_key=? FOR UPDATE",
            [idempotencyKey],
          );
          if (existingJobs[0]) {
            if (existingJobs[0].requested_by !== session.userId || !existingJobs[0].order_id)
              throw new Error("同じ発注要求に異なる内容が指定されました。");
            return existingJobs[0].order_id;
          }
          const [departments] = await db.execute<(RowDataPacket & { code: string })[]>(
            "SELECT code FROM store_departments WHERE id=? AND store_id=? AND active=1",
            [departmentId, storeId],
          );
          if (!departments.length) throw new Error("指定部門が見つかりません。");
          const [stores] = await db.execute<(RowDataPacket & { code: string })[]>(
            "SELECT code FROM stores WHERE id=? AND status='active'",
            [storeId],
          );
          if (!stores.length) throw new Error("指定店舗が見つかりません。");
          const pricedItems: {
            productId: string;
            productCode: string;
            quantity: number;
            unitPriceYen: number;
            lineTotalYen: number;
          }[] = [];
          for (const item of items) {
            const [products] = await db.execute<
              (RowDataPacket & { code: string; price_yen: number | null })[]
            >(
              "SELECT product.code,price.price_yen FROM products product JOIN store_products stock ON stock.product_id=product.id AND stock.store_id=? AND stock.active=1 LEFT JOIN product_prices price ON price.id=(SELECT candidate.id FROM product_prices candidate WHERE candidate.product_id=product.id AND (candidate.store_id=? OR candidate.store_id IS NULL) AND candidate.valid_from<=CURRENT_TIMESTAMP(3) AND (candidate.valid_until IS NULL OR candidate.valid_until>CURRENT_TIMESTAMP(3)) ORDER BY (candidate.store_id IS NOT NULL) DESC,candidate.valid_from DESC LIMIT 1) WHERE product.id=? AND product.active=1",
              [storeId, storeId, item.productId],
            );
            const unitPriceYen = Number(products[0]?.price_yen);
            if (!Number.isSafeInteger(unitPriceYen) || unitPriceYen < 0)
              throw new Error("発注可能な価格がない商品が含まれています。");
            pricedItems.push({
              ...item,
              productCode: products[0].code,
              unitPriceYen,
              lineTotalYen: unitPriceYen * item.quantity,
            });
          }
          const orderId = randomUUID();
          const total = pricedItems.reduce((sum, item) => sum + item.lineTotalYen, 0);
          await db.execute(
            "INSERT INTO orders(id,store_id,department_id,order_date,requested_delivery_date,order_total_yen,status,requested_by) VALUES(?,?,?,CURRENT_DATE,?,?,'submitted',?)",
            [orderId, storeId, departmentId, deliveryDate, total, session.userId],
          );
          for (const item of pricedItems)
            await db.execute(
              "INSERT INTO order_lines(id,order_id,product_id,quantity,unit_price_yen,line_total_yen) VALUES(?,?,?,?,?,?)",
              [
                randomUUID(),
                orderId,
                item.productId,
                item.quantity,
                item.unitPriceYen,
                item.lineTotalYen,
              ],
            );
          await db.execute(
            "INSERT INTO integration_jobs(id,kind,idempotency_key,payload,status) VALUES(?,'order',?,?,'pending')",
            [
              randomUUID(),
              idempotencyKey,
              JSON.stringify({
                version: 1,
                orderId,
                storeId,
                storeCode: stores[0].code,
                departmentId,
                departmentCode: departments[0].code,
                deliveryDate,
                totalYen: total,
                requestedBy: session.userId,
                items: pricedItems.map((item) => ({
                  productId: item.productId,
                  productCode: item.productCode,
                  quantity: item.quantity,
                  unitPriceYen: item.unitPriceYen,
                  lineTotalYen: item.lineTotalYen,
                })),
              }),
            ],
          );
          return orderId;
        });
      }
      default:
        throw new Error(`MySQL移植対象の業務トランザクションが未実装です: ${command}`);
    }
  }
  async storeSnapshot(deviceToken: string): Promise<Record<string, Json>> {
    if (!/^[a-f0-9]{64}$/.test(deviceToken)) throw new Error("店舗端末コードが正しくありません。");
    const tokenHash = createHash("sha256").update(deviceToken, "utf8").digest();
    const [devices] = await mysqlPool().execute<(RowDataPacket & { store_id: string })[]>(
      "SELECT store_id FROM store_devices WHERE token_hash=? AND active=1 LIMIT 1",
      [tokenHash],
    );
    const storeId = devices[0]?.store_id;
    if (!storeId) throw new Error("有効な店舗端末が見つかりません。");

    const [stores] = await mysqlPool().execute<
      (RowDataPacket & { id: string; code: string; name: string })[]
    >("SELECT id,code,name FROM stores WHERE id=? AND status='active' LIMIT 1", [storeId]);
    const store = stores[0];
    if (!store) throw new Error("接続先の店舗が有効ではありません。");

    const [sales] = await mysqlPool().execute<RowDataPacket[]>(
      "SELECT id,DATE_FORMAT(business_date,'%Y-%m-%d') AS business_date,status,net_sales_yen,customer_count FROM sales_days WHERE store_id=? ORDER BY business_date DESC LIMIT 31",
      [storeId],
    );
    const [inventory] = await mysqlPool().execute<RowDataPacket[]>(
      "SELECT p.code,p.name,i.quantity,i.observed_at FROM inventory_snapshots i JOIN products p ON p.id=i.product_id WHERE i.store_id=? ORDER BY p.code LIMIT 500",
      [storeId],
    );
    const [campaigns] = await mysqlPool().execute<RowDataPacket[]>(
      "SELECT c.id,c.name,c.starts_at,c.ends_at,c.status FROM campaigns c JOIN campaign_store_targets t ON t.campaign_id=c.id WHERE t.store_id=? AND c.status<>'draft' AND NOT EXISTS (SELECT 1 FROM campaign_items i WHERE i.campaign_id=c.id AND i.eligibility_status<>'eligible') ORDER BY c.starts_at DESC LIMIT 50",
      [storeId],
    );
    const [notices] = await mysqlPool().execute<RowDataPacket[]>(
      "SELECT id,title,message,created_at FROM store_announcements WHERE store_id=? ORDER BY created_at DESC LIMIT 100",
      [storeId],
    );
    const [orders] = await mysqlPool().execute<RowDataPacket[]>(
      "SELECT id,order_date,requested_delivery_date,status FROM orders WHERE store_id=? ORDER BY created_at DESC LIMIT 50",
      [storeId],
    );
    const [departments] = await mysqlPool().execute<RowDataPacket[]>(
      "SELECT department.name,SUM(line.amount_yen) AS sales FROM sales_lines line JOIN sales_days day ON day.id=line.sales_day_id JOIN store_departments department ON department.id=line.department_id WHERE day.store_id=? AND day.business_date=(SELECT MAX(business_date) FROM sales_days WHERE store_id=?) GROUP BY department.id,department.name",
      [storeId, storeId],
    );
    const [metricRows] = await mysqlPool().execute<RowDataPacket[]>(
      "SELECT (SELECT COUNT(*) FROM inventory_snapshots WHERE store_id=? AND quantity<=0) AS inventory_alert_count, (SELECT COUNT(*) FROM store_announcements WHERE store_id=?) AS notice_count, (SELECT COUNT(DISTINCT campaign.id) FROM campaigns campaign JOIN campaign_store_targets target ON target.campaign_id=campaign.id JOIN campaign_items item ON item.campaign_id=campaign.id AND item.eligibility_status='eligible' LEFT JOIN campaign_item_store_tasks task ON task.campaign_item_id=item.id AND task.store_id=target.store_id WHERE target.store_id=? AND campaign.status<>'draft' AND ((campaign.status='completed' AND (COALESCE(task.pos_restore_status,'not_configured') NOT IN ('restored','manual_confirmed') OR task.price_label_restored_at IS NULL OR task.pop_restored_at IS NULL OR task.display_restored_at IS NULL)) OR (campaign.status<>'completed' AND (COALESCE(task.pos_promotion_status,'not_configured') NOT IN ('applied','manual_confirmed') OR task.price_label_changed_at IS NULL OR task.pop_changed_at IS NULL OR task.display_changed_at IS NULL)))) AS campaign_pending_count",
      [storeId, storeId, storeId],
    );
    const jsonRows = (rows: RowDataPacket[]) =>
      rows.map(
        (row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              value instanceof Date
                ? value.toISOString()
                : typeof value === "bigint"
                  ? Number(value)
                  : value,
            ]),
          ) as { [key: string]: Json },
      );
    return {
      store: { id: store.id, code: store.code, name: store.name },
      sales: jsonRows(sales),
      inventory: jsonRows(inventory),
      campaigns: jsonRows(campaigns),
      notices: jsonRows(notices),
      orders: jsonRows(orders),
      departments: jsonRows(departments),
      metrics: jsonRows(metricRows)[0] ?? {
        inventory_alert_count: 0,
        notice_count: 0,
        campaign_pending_count: 0,
      },
    };
  }
}
