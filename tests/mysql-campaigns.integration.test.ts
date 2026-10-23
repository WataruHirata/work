import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mysqlPool } from "../database/mysql/pool";
import { executeMysqlInstruction } from "../database/mysql/instructions";
import { executeMysqlCampaign } from "../database/mysql/campaigns";
import type { Json, Session } from "@/domain/contracts";

// Explicit opt-in: all fixtures and operations stay in a rolled-back transaction.
describe.skipIf(process.env.MINORIYA_MYSQL_TEST !== "1")(
  "MySQL特売実DB FR-020/028/029 AT-07/10",
  () => {
    let db: PoolConnection;
    let user: string, product: string, store: string, otherStore: string, area: string;
    let session: Session;
    async function rows(sql: string, params: unknown[] = []) {
      return (await db.execute<RowDataPacket[]>(sql, params as never[]))[0];
    }
    const run = (
      command: Parameters<typeof executeMysqlCampaign>[2],
      input: Record<string, Json>,
    ) => executeMysqlCampaign(db, session, command, input);
    const draft = () => ({
      p_name: "架空テスト特売",
      p_starts_at: "2026-11-01T00:00:00Z",
      p_ends_at: "2026-11-03T00:00:00Z",
      p_items: [{ product_id: product, price_yen: 123 }],
      p_store_ids: [store],
    });
    async function create() {
      return String(await run("createCampaign", draft()));
    }
    async function eligible(id: string) {
      await db.execute("UPDATE products SET promotion_eligibility='eligible' WHERE id=?", [
        product,
      ]);
      for (const item of await rows("SELECT id FROM campaign_items WHERE campaign_id=?", [id]))
        await run("changeCampaignEligibility", { p_campaign_item_id: item.id });
    }
    beforeEach(async () => {
      db = await mysqlPool().getConnection();
      await db.beginTransaction();
      user = randomUUID();
      product = randomUUID();
      store = randomUUID();
      otherStore = randomUUID();
      area = randomUUID();
      session = {
        userId: user,
        displayName: "架空検証担当",
        active: true,
        mustChangePassword: false,
        roles: ["product_office"],
      };
      await db.execute("INSERT INTO app_users(id,display_name) VALUES(?,?)", [
        user,
        "架空検証担当",
      ]);
      await db.execute(
        "INSERT INTO user_role_assignments(id,user_id,role) VALUES(?,?,'product_office')",
        [randomUUID(), user],
      );
      await db.execute("INSERT INTO areas(id,code,name) VALUES(?,?,?)", [
        area,
        area,
        "架空検証エリア",
      ]);
      for (const id of [store, otherStore])
        await db.execute("INSERT INTO stores(id,area_id,code,name) VALUES(?,?,?,?)", [
          id,
          area,
          id,
          "架空検証店",
        ]);
      await db.execute("INSERT INTO products(id,code,name,tax_rate) VALUES(?,?,?,8)", [
        product,
        product,
        "架空検証商品",
      ]);
    });
    afterEach(async () => {
      if (db) {
        await db.rollback();
        db.release();
      }
    });
    afterAll(async () => {
      await mysqlPool().end();
    });
    it("下書きと明細・対象店舗・作業・監査を一括作成する", async () => {
      const id = await create();
      expect((await rows("SELECT status FROM campaigns WHERE id=?", [id]))[0].status).toBe("draft");
      expect(await rows("SELECT * FROM campaign_items WHERE campaign_id=?", [id])).toHaveLength(1);
      expect(
        await rows("SELECT * FROM campaign_store_targets WHERE campaign_id=?", [id]),
      ).toHaveLength(1);
      expect(
        await rows(
          "SELECT task.* FROM campaign_item_store_tasks task JOIN campaign_items item ON item.id=task.campaign_item_id WHERE item.campaign_id=?",
          [id],
        ),
      ).toHaveLength(1);
      expect((await rows("SELECT * FROM audit_logs WHERE actor_id=?", [user])).length).toBe(4);
    });
    it("重複商品・不正金額・休業店舗・権限不足・無効アカウントを拒否する", async () => {
      await expect(
        run("createCampaign", {
          ...draft(),
          p_items: [
            { product_id: product, price_yen: 1 },
            { product_id: product, price_yen: 2 },
          ],
        }),
      ).rejects.toThrow("重複");
      await expect(
        run("createCampaign", { ...draft(), p_items: [{ product_id: product, price_yen: -1 }] }),
      ).rejects.toThrow();
      await db.execute("UPDATE stores SET status='temporarily_closed' WHERE id=?", [store]);
      await expect(create()).rejects.toThrow("有効な対象店舗");
      await db.execute("DELETE FROM user_role_assignments WHERE user_id=?", [user]);
      await expect(create()).rejects.toThrow("商品本部権限");
      await db.execute("UPDATE app_users SET active=0 WHERE id=?", [user]);
      await expect(create()).rejects.toThrow("個人アカウント");
      expect(await rows("SELECT id FROM campaigns WHERE created_by=?", [user])).toHaveLength(0);
    });
    it("下書きの価格と期間を更新し、古い版・欠落明細を拒否する", async () => {
      const id = await create(),
        campaign = (await rows("SELECT updated_at FROM campaigns WHERE id=?", [id]))[0];
      const item = (await rows("SELECT id FROM campaign_items WHERE campaign_id=?", [id]))[0];
      const input = {
        p_campaign_id: id,
        p_expected_version: campaign.updated_at.toISOString(),
        p_name: "架空編集済み",
        p_starts_at: "2026-11-01T00:00:00Z",
        p_ends_at: "2026-11-04T00:00:00Z",
        p_prices: [{ id: item.id, price_yen: 456 }],
      };
      await expect(run("editCampaign", { ...input, p_prices: [] })).rejects.toThrow();
      await run("editCampaign", input);
      expect(
        (await rows("SELECT name,price_yen FROM campaigns WHERE id=?", [id]))[0],
      ).toMatchObject({ name: "架空編集済み", price_yen: 456 });
      await expect(run("editCampaign", input)).rejects.toThrow("更新されています");
    });
    it("未確認/対象外商品は公開せず、確認後に対象店舗だけへ通知する", async () => {
      const id = await create();
      await expect(run("publishCampaign", { p_campaign_id: id })).rejects.toThrow("対象区分");
      await eligible(id);
      await db.execute("UPDATE products SET promotion_eligibility='excluded' WHERE id=?", [
        product,
      ]);
      await expect(run("publishCampaign", { p_campaign_id: id })).rejects.toThrow("対象区分");
      await db.execute("UPDATE products SET promotion_eligibility='eligible' WHERE id=?", [
        product,
      ]);
      await run("publishCampaign", { p_campaign_id: id });
      expect((await rows("SELECT status FROM campaigns WHERE id=?", [id]))[0].status).toBe(
        "scheduled",
      );
      expect(
        (await rows("SELECT store_id FROM store_announcements WHERE created_by=?", [user])).map(
          (row) => row.store_id,
        ),
      ).toEqual([store]);
      const requests = await rows(
        "SELECT title,message FROM store_announcements WHERE created_by=?",
        [user],
      );
      expect(requests[0].title).toContain("POS・値札変更依頼");
      expect(requests[0].message).toContain("123円");
      expect(requests[0].message).toContain("2026/11/01 09:00");
      expect(requests[0].message).toContain("2026/11/03 09:00");
      expect(
        await rows("SELECT id FROM store_instructions WHERE created_by=?", [user]),
      ).toHaveLength(1);
      await expect(run("publishCampaign", { p_campaign_id: id })).rejects.toThrow("下書き");
    });
    it("同一商品・店舗の期間重複を拒否し、隣接期間は許可する", async () => {
      const first = await create();
      await eligible(first);
      await run("publishCampaign", { p_campaign_id: first });
      const second = await create();
      await eligible(second);
      await expect(run("publishCampaign", { p_campaign_id: second })).rejects.toThrow("重複");
      await db.execute(
        "UPDATE campaigns SET starts_at='2026-11-03 09:00:00',ends_at='2026-11-04 09:00:00' WHERE id=?",
        [second],
      );
      await run("publishCampaign", { p_campaign_id: second });
    });
    it("店舗作業は本人の担当店舗だけを更新し終了前の復帰を拒否する", async () => {
      const id = await create();
      await eligible(id);
      await run("publishCampaign", { p_campaign_id: id });
      const item = (await rows("SELECT id FROM campaign_items WHERE campaign_id=?", [id]))[0];
      const input = {
        p_campaign_item_id: item.id,
        p_store_id: store,
        p_task: "price_label_changed",
        p_completed: true,
      };
      await db.execute("DELETE FROM user_role_assignments WHERE user_id=?", [user]);
      await db.execute(
        "INSERT INTO user_role_assignments(id,user_id,role,area_id) VALUES(?,?,'area_manager',?)",
        [randomUUID(), user, area],
      );
      session.roles = ["area_manager"];
      await run("updateCampaignTask", input);
      await run("updateCampaignTask", { ...input, p_task: "pos_changed" });
      await run("confirmCampaign", {
        p_campaign_item_id: item.id,
        p_store_id: store,
        p_confirmed: true,
      });
      expect(
        (
          await rows(
            "SELECT price_label_changed_at,pos_promotion_status,pos_promotion_confirmed_at FROM campaign_item_store_tasks WHERE campaign_item_id=? AND store_id=?",
            [item.id, store],
          )
        )[0].price_label_changed_at,
      ).not.toBeNull();
      const completed = (
        await rows(
          "SELECT pos_promotion_status,pos_promotion_confirmed_at FROM campaign_item_store_tasks WHERE campaign_item_id=? AND store_id=?",
          [item.id, store],
        )
      )[0];
      expect(completed.pos_promotion_status).toBe("manual_confirmed");
      expect(completed.pos_promotion_confirmed_at).not.toBeNull();
      await expect(run("updateCampaignTask", { ...input, p_store_id: otherStore })).rejects.toThrow(
        "対象店舗",
      );
      await expect(
        run("updateCampaignTask", { ...input, p_task: "price_label_restored" }),
      ).rejects.toThrow("終了後");
    });

    it("指示発行は通知と監査を保存し、同じ依頼の再送で重複を作らず担当店舗だけが確認できる", async () => {
      const input = {
        p_request_id: randomUUID(),
        p_kind: "price_change",
        p_title: "架空価格変更",
        p_message: "架空の値札を交換してください。",
        p_product_id: product,
        p_price_yen: 123,
        p_effective_at: "2026-11-01T00:00:00Z",
        p_store_ids: [store],
      };
      const runInstruction = (
        command: "sendInstruction" | "confirmInstruction",
        values: Record<string, Json>,
      ) => executeMysqlInstruction(db, session, command, values);
      const id = String(await runInstruction("sendInstruction", input));
      expect(await runInstruction("sendInstruction", input)).toBe(id);
      expect(
        await rows("SELECT id FROM store_announcements WHERE created_by=?", [user]),
      ).toHaveLength(1);
      await expect(
        runInstruction("sendInstruction", { ...input, p_title: "架空別の指示" }),
      ).rejects.toThrow("リクエストID");
      await expect(
        runInstruction("sendInstruction", {
          ...input,
          p_request_id: randomUUID(),
          p_kind: "promotion",
        }),
      ).rejects.toThrow("対象区分");
      await db.execute("DELETE FROM user_role_assignments WHERE user_id=?", [user]);
      await db.execute(
        "INSERT INTO user_role_assignments(id,user_id,role,area_id) VALUES(?,?,'area_manager',?)",
        [randomUUID(), user, area],
      );
      session.roles = ["area_manager"];
      await runInstruction("confirmInstruction", { p_instruction_id: id, p_store_id: store });
      const confirmed = (
        await rows("SELECT confirmed_at FROM store_instruction_targets WHERE instruction_id=?", [
          id,
        ])
      )[0].confirmed_at;
      expect(confirmed).not.toBeNull();
      await runInstruction("confirmInstruction", { p_instruction_id: id, p_store_id: store });
      expect(
        (
          await rows("SELECT confirmed_at FROM store_instruction_targets WHERE instruction_id=?", [
            id,
          ])
        )[0].confirmed_at,
      ).toEqual(confirmed);
      await expect(
        runInstruction("confirmInstruction", { p_instruction_id: id, p_store_id: otherStore }),
      ).rejects.toThrow("対象店舗の指示が見つかりません");
    });
  },
);
