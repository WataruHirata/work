import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("特売公開の店舗通知 FR-020/028/029 AT-07/10", () => {
  it("商品・価格・期間とPOS/値札の変更依頼を対象店だけへ保存し再更新で重複しない", async () => {
    const db = new PGlite();
    try {
      await db.exec(`create schema auth; create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql as $$ select '30000000-0000-4000-8000-000000000001'::uuid $$;
    create table public.products(id uuid primary key,code text,name text);
    create table public.campaigns(id uuid primary key,name text,starts_at timestamptz,ends_at timestamptz,published_at timestamptz);
    create table public.campaign_items(id uuid primary key,campaign_id uuid,product_id uuid,price_yen integer);
    create table public.campaign_store_targets(campaign_id uuid,store_id uuid);
    create table public.store_instructions(id uuid primary key default gen_random_uuid(),request_id uuid,kind text,title text,message text,product_id uuid,price_yen integer,effective_at timestamptz,created_by uuid);
    create table public.store_instruction_targets(instruction_id uuid,store_id uuid);
    create table public.store_announcements(store_id uuid,title text,message text,created_by uuid);`);
      await db.exec(
        readFileSync("supabase/migrations/202610220001_campaign_change_requests.sql", "utf8"),
      );
      await db.exec(
        "create trigger notify_campaign_publication after update on public.campaigns for each row execute function public.notify_campaign_publication()",
      );
      const campaign = randomUUID(),
        product = randomUUID(),
        secondProduct = randomUUID(),
        store = randomUUID();
      await db.query(
        "insert into products values($1,'DEMO-1','架空検証商品'),($2,'DEMO-2','架空検証商品2')",
        [product, secondProduct],
      );
      await db.query(
        "insert into campaigns values($1,'架空特売','2026-11-01T00:00:00Z','2026-11-02T13:00:00Z',null)",
        [campaign],
      );
      await db.query("insert into campaign_items values($1,$2,$3,123),($4,$2,$5,456)", [
        randomUUID(),
        campaign,
        product,
        randomUUID(),
        secondProduct,
      ]);
      await db.query("insert into campaign_store_targets values($1,$2)", [campaign, store]);
      await db.query("update campaigns set published_at=now() where id=$1", [campaign]);
      const notices = (
        await db.query<{ store_id: string; title: string; message: string }>(
          "select * from store_announcements order by message",
        )
      ).rows;
      expect(notices).toHaveLength(2);
      for (const notice of notices) {
        expect(notice.store_id).toBe(store);
        expect(notice.title).toContain("POS・値札変更依頼");
        expect(notice.message).toContain("2026/11/01 09:00");
        expect(notice.message).toContain("2026/11/02 22:00");
      }
      expect(notices.map((row) => row.message).join(" ")).toContain("123円");
      expect(notices.map((row) => row.message).join(" ")).toContain("456円");
      const instructions = (await db.query("select * from store_instructions")).rows;
      expect(instructions).toHaveLength(2);
      expect((await db.query("select * from store_instruction_targets")).rows).toHaveLength(2);
      await db.query("update campaigns set name='架空更新' where id=$1", [campaign]);
      expect((await db.query("select * from store_announcements")).rows).toHaveLength(2);
    } finally {
      await db.close();
    }
  }, 20000);
});
