import "server-only";
import { randomUUID } from "node:crypto";
import { canAccessStoreByAssignment, type StoreRoleAssignment } from "./store-access";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Json, Session } from "@/domain/contracts";
import { integer, text, uuid } from "@/server/validation";

type Row = RowDataPacket & Record<string, unknown>;
async function rows(db: PoolConnection, sql: string, params: unknown[] = []) {
  return (await db.execute<Row[]>(sql, params as never[]))[0];
}
async function audit(
  db: PoolConnection,
  user: string,
  table: string,
  id: string,
  before: unknown,
  after: unknown,
) {
  await db.execute(
    "INSERT INTO audit_logs(table_name,record_id,operation,actor_id,before_data,after_data) VALUES(?,?,?,?,?,?)",
    [
      table,
      id,
      before ? "UPDATE" : "INSERT",
      user,
      before ? JSON.stringify(before) : null,
      JSON.stringify(after),
    ],
  );
}

export async function executeMysqlInstruction(
  db: PoolConnection,
  session: Session,
  command: "sendInstruction" | "confirmInstruction",
  input: Record<string, Json>,
): Promise<Json> {
  // Serializing a user's instructions also makes retries of their request ID idempotent.
  const user = (
    await rows(db, "SELECT active,must_change_password FROM app_users WHERE id=? FOR UPDATE", [
      session.userId,
    ])
  )[0];
  if (!user?.active || user.must_change_password)
    throw new Error("有効な個人アカウントでログインしてください。");
  const assignments = await rows(
    db,
    "SELECT role,store_id,area_id FROM user_role_assignments WHERE user_id=? FOR SHARE",
    [session.userId],
  );
  if (command === "confirmInstruction") {
    const id = uuid(input.p_instruction_id),
      store = uuid(input.p_store_id);
    const storeArea = (
      await rows(db, "SELECT area_id FROM stores WHERE id=? FOR SHARE", [store])
    )[0]?.area_id;
    if (
      !canAccessStoreByAssignment(
        assignments as StoreRoleAssignment[],
        store,
        storeArea ? String(storeArea) : null,
      )
    )
      throw new Error("対象店舗へのアクセス範囲がありません。");
    const target = (
      await rows(
        db,
        "SELECT * FROM store_instruction_targets WHERE instruction_id=? AND store_id=? FOR UPDATE",
        [id, store],
      )
    )[0];
    if (!target) throw new Error("対象店舗の指示が見つかりません。");
    if (!target.confirmed_at) {
      await db.execute(
        "UPDATE store_instruction_targets SET confirmed_at=CURRENT_TIMESTAMP(3),confirmed_by=? WHERE instruction_id=? AND store_id=?",
        [session.userId, id, store],
      );
      await audit(db, session.userId, "store_instruction_targets", `${id}:${store}`, target, {
        ...target,
        confirmed_by: session.userId,
      });
    }
    return null;
  }
  if (!assignments.some((row) => row.role === "product_office"))
    throw new Error("商品本部権限が必要です。");
  const request = uuid(input.p_request_id),
    productId = uuid(input.p_product_id),
    kind = text(input.p_kind),
    title = text(input.p_title, 200),
    message = text(input.p_message, 2000),
    price = integer(input.p_price_yen, 0, 2147483647);
  if (!["promotion", "price_change"].includes(kind)) throw new Error("指示の種類が不正です。");
  if (
    typeof input.p_effective_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.p_effective_at) ||
    !Number.isFinite(Date.parse(input.p_effective_at))
  )
    throw new Error("実施日時が不正です。");
  const effective = new Date(input.p_effective_at);
  if (!Array.isArray(input.p_store_ids)) throw new Error("対象店舗を指定してください。");
  const stores = input.p_store_ids.map(uuid).sort();
  if (!stores.length || stores.length > 112 || new Set(stores).size !== stores.length)
    throw new Error("対象店舗が不正です。");
  const product = (
    await rows(
      db,
      "SELECT id,code,name,active,promotion_eligibility FROM products WHERE id=? FOR SHARE",
      [productId],
    )
  )[0];
  if (!product?.active) throw new Error("有効な商品を指定してください。");
  if (kind === "promotion" && product.promotion_eligibility !== "eligible")
    throw new Error("既存マスタで特売対象区分が確認された商品を指定してください。");
  for (const store of stores)
    if (
      !(await rows(db, "SELECT id FROM stores WHERE id=? AND status='active' FOR SHARE", [store]))
        .length
    )
      throw new Error("有効な対象店舗を指定してください。");
  const existing = (
    await rows(db, "SELECT * FROM store_instructions WHERE request_id=? FOR UPDATE", [request])
  )[0];
  if (existing) {
    const targets = await rows(
      db,
      "SELECT store_id FROM store_instruction_targets WHERE instruction_id=? ORDER BY store_id",
      [existing.id],
    );
    if (
      existing.created_by !== session.userId ||
      existing.kind !== kind ||
      existing.title !== title ||
      existing.message !== message ||
      existing.product_id !== productId ||
      Number(existing.price_yen) !== price ||
      new Date(existing.effective_at as string).getTime() !== effective.getTime() ||
      JSON.stringify(targets.map((row) => row.store_id)) !== JSON.stringify(stores)
    )
      throw new Error("同じリクエストIDの内容が異なります。画面を再読み込みしてください。");
    return String(existing.id);
  }
  const id = randomUUID();
  await db.execute(
    "INSERT INTO store_instructions(id,request_id,kind,title,message,product_id,price_yen,effective_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)",
    [id, request, kind, title, message, productId, price, effective, session.userId],
  );
  await audit(db, session.userId, "store_instructions", id, null, {
    request_id: request,
    kind,
    title,
    message,
    product_id: productId,
    price_yen: price,
    effective_at: effective,
  });
  const localTime = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(effective);
  const noticeMessage = `${message.slice(0, 1400)}\n商品: ${String(product.code)} / ${String(product.name).slice(0, 100)}\n指示価格: ${price}円 / 実施日時（日本時間）: ${localTime}\n特売・価格画面で指示の全文を確認してください。`;
  for (const store of stores) {
    await db.execute("INSERT INTO store_instruction_targets(instruction_id,store_id) VALUES(?,?)", [
      id,
      store,
    ]);
    await audit(db, session.userId, "store_instruction_targets", `${id}:${store}`, null, {
      instruction_id: id,
      store_id: store,
    });
    const notice = randomUUID();
    await db.execute(
      "INSERT INTO store_announcements(id,store_id,title,message,created_by) VALUES(?,?,?,?,?)",
      [notice, store, title, noticeMessage, session.userId],
    );
    await audit(db, session.userId, "store_announcements", notice, null, {
      store_id: store,
      title,
      message: noticeMessage,
    });
  }
  return id;
}
