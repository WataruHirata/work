import "server-only";
import { campaignChangeRequest } from "@/domain/campaign-notice";
import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Json, Session } from "@/domain/contracts";
import { integer, text, uuid } from "@/server/validation";

export type CampaignCommand =
  | "createCampaign"
  | "editCampaign"
  | "publishCampaign"
  | "changeCampaignEligibility"
  | "confirmCampaign"
  | "updateCampaignTask"
  | "approveCampaignWork";
type Input = Record<string, Json>;
type Row = RowDataPacket & Record<string, unknown>;
async function rows(db: PoolConnection, sql: string, values: unknown[] = []): Promise<Row[]> {
  return (await db.execute<Row[]>(sql, values as never[]))[0];
}
async function audit(
  db: PoolConnection,
  userId: string,
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
      userId,
      before ? JSON.stringify(before) : null,
      JSON.stringify(after),
    ],
  );
}
function instant(value: Json | undefined): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("日時が不正です。");
  return new Date(value);
}
function draft(input: Input) {
  const name = text(input.p_name, 200),
    starts = instant(input.p_starts_at),
    ends = instant(input.p_ends_at);
  if (ends <= starts) throw new Error("終了日時は開始日時より後にしてください。");
  return { name, starts, ends };
}
function entries(value: Json | undefined, key: "product_id" | "id") {
  if (!Array.isArray(value) || !value.length) throw new Error("特売商品を指定してください。");
  const result = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("特売商品が不正です。");
    return { id: uuid(item[key]), price: integer(item.price_yen, 0, 2147483647) };
  });
  if (new Set(result.map((item) => item.id)).size !== result.length)
    throw new Error("同じ商品は重複指定できません。");
  return result;
}
async function lockedDraft(db: PoolConnection, id: string) {
  const campaign = (await rows(db, "SELECT * FROM campaigns WHERE id=? FOR UPDATE", [id]))[0];
  if (!campaign || campaign.status !== "draft" || campaign.published_at)
    throw new Error("編集可能な下書きがありません。画面を再読み込みしてください。");
  return campaign;
}

// The caller owns one transaction for data, notifications and audit records.
export async function executeMysqlCampaign(
  db: PoolConnection,
  session: Session,
  command: CampaignCommand,
  input: Input,
): Promise<Json> {
  const users = await rows(
    db,
    "SELECT active,must_change_password FROM app_users WHERE id=? FOR SHARE",
    [session.userId],
  );
  if (!users[0]?.active || users[0].must_change_password)
    throw new Error("有効な個人アカウントでログインしてください。");
  const assignments = await rows(
    db,
    "SELECT role,store_id FROM user_role_assignments WHERE user_id=? FOR SHARE",
    [session.userId],
  );
  const storeOperation = command === "confirmCampaign" || command === "updateCampaignTask";
  if (
    !storeOperation &&
    !assignments.some((row) => ["product_office", "information_systems"].includes(String(row.role)))
  )
    throw new Error("特売管理権限が必要です。");

  if (command === "createCampaign") {
    const { name, starts, ends } = draft(input),
      items = entries(input.p_items, "product_id");
    if (!Array.isArray(input.p_store_ids)) throw new Error("対象店舗を指定してください。");
    const stores = input.p_store_ids.map(uuid);
    if (!stores.length || stores.length > 112 || new Set(stores).size !== stores.length)
      throw new Error("対象店舗が不正です。");
    for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
      if (
        !(await rows(db, "SELECT id FROM products WHERE id=? AND active=1 FOR SHARE", [item.id]))
          .length
      )
        throw new Error("有効な商品を指定してください。");
    }
    for (const store of [...stores].sort()) {
      if (
        !(await rows(db, "SELECT id FROM stores WHERE id=? AND status='active' FOR SHARE", [store]))
          .length
      )
        throw new Error("有効な対象店舗を指定してください。");
    }
    const id = randomUUID();
    await db.execute(
      "INSERT INTO campaigns(id,name,product_id,price_yen,starts_at,ends_at,status,created_by) VALUES(?,?,?,?,?,?,'draft',?)",
      [id, name, items[0].id, items[0].price, starts, ends, session.userId],
    );
    for (const store of stores) {
      await db.execute("INSERT INTO campaign_store_targets(campaign_id,store_id) VALUES(?,?)", [
        id,
        store,
      ]);
      await audit(db, session.userId, "campaign_store_targets", `${id}:${store}`, null, {
        campaign_id: id,
        store_id: store,
      });
    }
    for (const item of items) {
      const itemId = randomUUID();
      await db.execute(
        "INSERT INTO campaign_items(id,campaign_id,product_id,price_yen) VALUES(?,?,?,?)",
        [itemId, id, item.id, item.price],
      );
      await audit(db, session.userId, "campaign_items", itemId, null, {
        campaign_id: id,
        product_id: item.id,
        price_yen: item.price,
      });
      for (const store of stores) {
        await db.execute(
          "INSERT INTO campaign_item_store_tasks(campaign_item_id,store_id) VALUES(?,?)",
          [itemId, store],
        );
        await audit(db, session.userId, "campaign_item_store_tasks", `${itemId}:${store}`, null, {
          campaign_item_id: itemId,
          store_id: store,
        });
      }
    }
    await audit(db, session.userId, "campaigns", id, null, {
      id,
      name,
      starts_at: starts,
      ends_at: ends,
      status: "draft",
    });
    return id;
  }

  if (command === "editCampaign") {
    const id = uuid(input.p_campaign_id),
      campaign = await lockedDraft(db, id);
    const expected = instant(input.p_expected_version);
    if (new Date(campaign.updated_at as string).getTime() !== expected.getTime())
      throw new Error("別の操作で更新されています。画面を再読み込みしてください。");
    const { name, starts, ends } = draft(input),
      prices = entries(input.p_prices, "id");
    const items = await rows(
      db,
      "SELECT * FROM campaign_items WHERE campaign_id=? ORDER BY id FOR UPDATE",
      [id],
    );
    if (
      items.length !== prices.length ||
      prices.some((price) => !items.some((item) => item.id === price.id))
    )
      throw new Error("すべての特売商品を一度ずつ指定してください。");
    for (const price of prices) {
      const before = items.find((item) => item.id === price.id)!;
      await db.execute("UPDATE campaign_items SET price_yen=? WHERE id=? AND campaign_id=?", [
        price.price,
        price.id,
        id,
      ]);
      await audit(db, session.userId, "campaign_items", price.id, before, {
        ...before,
        price_yen: price.price,
      });
    }
    const first = items.find((item) => item.product_id === campaign.product_id)!;
    await db.execute(
      "UPDATE campaigns SET name=?,starts_at=?,ends_at=?,price_yen=?,updated_at=GREATEST(CURRENT_TIMESTAMP(3),TIMESTAMPADD(MICROSECOND,1000,updated_at)) WHERE id=?",
      [name, starts, ends, prices.find((price) => price.id === first.id)!.price, id],
    );
    await audit(db, session.userId, "campaigns", id, campaign, {
      ...campaign,
      name,
      starts_at: starts,
      ends_at: ends,
    });
    return null;
  }

  if (command === "changeCampaignEligibility") {
    const itemId = uuid(input.p_campaign_item_id);
    const source = (
      await rows(db, "SELECT campaign_id FROM campaign_items WHERE id=?", [itemId])
    )[0];
    if (!source) throw new Error("特売商品が見つかりません。");
    const campaign = await lockedDraft(db, String(source.campaign_id));
    const item = (
      await rows(db, "SELECT * FROM campaign_items WHERE id=? FOR UPDATE", [itemId])
    )[0];
    const product = (
      await rows(db, "SELECT active,promotion_eligibility FROM products WHERE id=? FOR SHARE", [
        item.product_id,
      ])
    )[0];
    if (!product?.active) throw new Error("有効な商品が見つかりません。");
    await db.execute("UPDATE campaign_items SET eligibility_status=? WHERE id=?", [
      product.promotion_eligibility,
      itemId,
    ]);
    await db.execute(
      "UPDATE campaigns SET updated_at=GREATEST(CURRENT_TIMESTAMP(3),TIMESTAMPADD(MICROSECOND,1000,updated_at)) WHERE id=?",
      [campaign.id],
    );
    await audit(db, session.userId, "campaign_items", itemId, item, {
      ...item,
      eligibility_status: product.promotion_eligibility,
    });
    return null;
  }

  if (command === "publishCampaign") {
    const id = uuid(input.p_campaign_id),
      campaign = await lockedDraft(db, id);
    const items = await rows(
      db,
      "SELECT * FROM campaign_items WHERE campaign_id=? ORDER BY product_id FOR UPDATE",
      [id],
    );
    const targets = await rows(
      db,
      "SELECT * FROM campaign_store_targets WHERE campaign_id=? ORDER BY store_id FOR UPDATE",
      [id],
    );
    if (!items.length || !targets.length) throw new Error("商品と対象店舗が必要です。");
    // Product row locks serialize publications sharing products, including different campaigns.
    for (const item of items) {
      const product = (
        await rows(db, "SELECT active,promotion_eligibility FROM products WHERE id=? FOR UPDATE", [
          item.product_id,
        ])
      )[0];
      if (
        item.eligibility_status !== "eligible" ||
        !product?.active ||
        product.promotion_eligibility !== "eligible"
      )
        throw new Error(
          "既存マスタの特売対象区分を確認してください。EDLP等の対象外・未確認商品は公開できません。",
        );
    }
    for (const target of targets) {
      if (
        !(
          await rows(db, "SELECT id FROM stores WHERE id=? AND status='active' FOR SHARE", [
            target.store_id,
          ])
        ).length
      )
        throw new Error("有効でない対象店舗があります。");
    }
    const overlap = await rows(
      db,
      "SELECT other.id FROM campaigns other JOIN campaign_items oi ON oi.campaign_id=other.id JOIN campaign_items ci ON ci.product_id=oi.product_id AND ci.campaign_id=? JOIN campaign_store_targets ot ON ot.campaign_id=other.id JOIN campaign_store_targets ct ON ct.store_id=ot.store_id AND ct.campaign_id=? WHERE other.id<>? AND other.status IN ('scheduled','active') AND other.starts_at<? AND other.ends_at>? LIMIT 1",
      [id, id, id, campaign.ends_at, campaign.starts_at],
    );
    if (overlap.length) throw new Error("同じ商品・店舗・期間で公開済みの特売と重複しています。");
    await db.execute(
      "UPDATE campaigns SET status='scheduled',published_at=CURRENT_TIMESTAMP(3),updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
      [id],
    );
    for (const item of items) {
      const product = (
        await rows(db, "SELECT code,name FROM products WHERE id=?", [item.product_id])
      )[0];
      const notice = campaignChangeRequest({
        campaignName: String(campaign.name),
        productName: String(product.name),
        productCode: String(product.code),
        priceYen: Number(item.price_yen),
        startsAt: new Date(campaign.starts_at as string),
        endsAt: new Date(campaign.ends_at as string),
      });
      const instructionId = randomUUID();
      await db.execute(
        "INSERT INTO store_instructions(id,request_id,kind,title,message,product_id,price_yen,effective_at,created_by) VALUES(?,?,'promotion',?,?,?,?,?,?)",
        [
          instructionId,
          randomUUID(),
          notice.title,
          notice.message,
          item.product_id,
          item.price_yen,
          campaign.starts_at,
          session.userId,
        ],
      );
      await audit(db, session.userId, "store_instructions", instructionId, null, {
        campaign_id: id,
        product_id: item.product_id,
        price_yen: item.price_yen,
        title: notice.title,
        message: notice.message,
      });
      for (const target of targets) {
        await db.execute(
          "INSERT INTO store_instruction_targets(instruction_id,store_id) VALUES(?,?)",
          [instructionId, target.store_id],
        );
        await audit(
          db,
          session.userId,
          "store_instruction_targets",
          instructionId + ":" + String(target.store_id),
          null,
          { instruction_id: instructionId, store_id: target.store_id },
        );
        const noticeId = randomUUID();
        await db.execute(
          "INSERT INTO store_announcements(id,store_id,title,message,created_by) VALUES(?,?,?,?,?)",
          [noticeId, target.store_id, notice.title, notice.message, session.userId],
        );
        await audit(db, session.userId, "store_announcements", noticeId, null, {
          store_id: target.store_id,
          title: notice.title,
          message: notice.message,
        });
      }
    }
    await audit(db, session.userId, "campaigns", id, campaign, {
      ...campaign,
      status: "scheduled",
    });
    return null;
  }

  if (command === "approveCampaignWork") {
    const storeId = uuid(input.p_store_id),
      itemId = uuid(input.p_campaign_item_id);
    const before = (
      await rows(
        db,
        "SELECT task.* FROM campaign_item_store_tasks task JOIN campaign_items item ON item.id=task.campaign_item_id JOIN campaigns campaign ON campaign.id=item.campaign_id WHERE task.campaign_item_id=? AND task.store_id=? AND campaign.status IN ('scheduled','active') FOR UPDATE",
        [itemId, storeId],
      )
    )[0];
    if (!before) throw new Error("承認できる店舗作業が見つかりません。");
    if (before.work_approved_at) throw new Error("店舗作業は承認済みです。");
    if (
      !["applied", "manual_confirmed"].includes(String(before.pos_promotion_status)) ||
      !before.price_label_changed_at
    )
      throw new Error("POS価格と商品値札の完了後に承認してください。");
    await db.execute(
      "UPDATE campaign_item_store_tasks SET work_approved_at=CURRENT_TIMESTAMP(3),work_approved_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE campaign_item_id=? AND store_id=?",
      [session.userId, itemId, storeId],
    );
    await audit(db, session.userId, "campaign_item_store_tasks", `${itemId}:${storeId}`, before, {
      ...before,
      work_approved: true,
    });
    return null;
  }

  const storeId = uuid(input.p_store_id),
    itemId = uuid(input.p_campaign_item_id);
  if (
    !assignments.some(
      (row) =>
        row.store_id === storeId &&
        ["store_manager", "department_lead", "staff"].includes(String(row.role)),
    )
  )
    throw new Error("担当店舗の個人権限が必要です。");
  const item = (await rows(db, "SELECT campaign_id FROM campaign_items WHERE id=?", [itemId]))[0];
  if (!item) throw new Error("特売商品が見つかりません。");
  const campaign = (
    await rows(db, "SELECT * FROM campaigns WHERE id=? FOR UPDATE", [item.campaign_id])
  )[0];
  if (!campaign || !["scheduled", "active"].includes(String(campaign.status)))
    throw new Error("公開済みの特売を指定してください。");
  if (
    (
      await rows(
        db,
        "SELECT id FROM campaign_items WHERE campaign_id=? AND eligibility_status<>'eligible' LIMIT 1",
        [campaign.id],
      )
    ).length
  )
    throw new Error("特売対象区分が未確認です。");
  const target = (
    await rows(
      db,
      "SELECT * FROM campaign_store_targets WHERE campaign_id=? AND store_id=? FOR UPDATE",
      [campaign.id, storeId],
    )
  )[0];
  if (!target) throw new Error("対象店舗ではありません。");
  if (command === "confirmCampaign") {
    if (typeof input.p_confirmed !== "boolean") throw new Error("確認状態が不正です。");
    await db.execute(
      "UPDATE campaign_store_targets SET store_confirmed_at=IF(?,CURRENT_TIMESTAMP(3),NULL),store_confirmed_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE campaign_id=? AND store_id=?",
      [input.p_confirmed, input.p_confirmed ? session.userId : null, campaign.id, storeId],
    );
    await audit(db, session.userId, "campaign_store_targets", `${campaign.id}:${storeId}`, target, {
      ...target,
      confirmed: input.p_confirmed,
    });
    return null;
  }
  const task = String(input.p_task);
  if (
    ![
      "pos_changed",
      "price_label_changed",
      "pop_changed",
      "display_changed",
      "price_label_restored",
      "pop_restored",
      "display_restored",
    ].includes(task) ||
    typeof input.p_completed !== "boolean"
  )
    throw new Error("作業内容が不正です。");
  if (task.endsWith("restored") && new Date(campaign.ends_at as string).getTime() > Date.now())
    throw new Error("復帰作業は特売終了後に記録してください。");
  const before = (
    await rows(
      db,
      "SELECT * FROM campaign_item_store_tasks WHERE campaign_item_id=? AND store_id=? FOR UPDATE",
      [itemId, storeId],
    )
  )[0];
  if (!before) throw new Error("対象店舗の作業がありません。");
  if (task === "pos_changed") {
    await db.execute(
      "UPDATE campaign_item_store_tasks SET pos_promotion_status=IF(?,'manual_confirmed','not_configured'),pos_promotion_confirmed_at=IF(?,CURRENT_TIMESTAMP(3),NULL),pos_promotion_error=NULL,work_approved_at=NULL,work_approved_by=NULL,updated_at=CURRENT_TIMESTAMP(3) WHERE campaign_item_id=? AND store_id=?",
      [input.p_completed, input.p_completed, itemId, storeId],
    );
    await audit(db, session.userId, "campaign_item_store_tasks", `${itemId}:${storeId}`, before, {
      ...before,
      task,
      completed: input.p_completed,
    });
    return null;
  }
  // Column identifiers are selected only from the fixed allowlist above.
  const approvalReset =
    task === "price_label_changed" ? ",work_approved_at=NULL,work_approved_by=NULL" : "";
  await db.execute(
    `UPDATE campaign_item_store_tasks SET ${task}_at=IF(?,CURRENT_TIMESTAMP(3),NULL),${task}_by=?${approvalReset},updated_at=CURRENT_TIMESTAMP(3) WHERE campaign_item_id=? AND store_id=?`,
    [input.p_completed, input.p_completed ? session.userId : null, itemId, storeId],
  );
  await audit(db, session.userId, "campaign_item_store_tasks", `${itemId}:${storeId}`, before, {
    ...before,
    task,
    completed: input.p_completed,
  });
  return null;
}
