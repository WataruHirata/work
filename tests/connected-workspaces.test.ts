import { readdir, readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ids = {
  info: "31000000-0000-4000-8000-000000000001",
  product: "31000000-0000-4000-8000-000000000002",
  manager: "31000000-0000-4000-8000-000000000003",
  staff: "31000000-0000-4000-8000-000000000004",
  area: "31000000-0000-4000-8000-000000000005",
  operations: "31000000-0000-4000-8000-000000000006",
  accounting: "31000000-0000-4000-8000-000000000007",
  initial: "31000000-0000-4000-8000-000000000008",
};
const store = "20000000-0000-4000-8000-000000000001",
  otherStore = "20000000-0000-4000-8000-000000000002";
const product = "51000000-0000-4000-8000-000000000001";
let db: PGlite, department: string;
async function root() {
  await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
}
async function asUser(id: string) {
  await root();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function scalar<T>(sql: string, params: unknown[] = []) {
  return (await db.query<{ value: T }>(sql, params)).rows[0].value;
}

describe("接続業務DB / AT-01/04/05/07/09/10", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key,encrypted_password text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    for (const file of (await readdir(resolve("supabase/migrations")))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(resolve("supabase/migrations", file), "utf8"));
    await db.exec(await readFile(resolve("supabase/seed.sql"), "utf8"));
    await db.exec(
      "grant select,insert,update,delete on all tables in schema public to authenticated; grant usage,select on all sequences in schema public to authenticated; revoke select on public.store_devices from authenticated; grant select(id,store_id,name,active,created_at) on public.store_devices to authenticated;",
    );
    for (const [name, id] of Object.entries(ids)) {
      await db.query("insert into auth.users values($1,'synthetic-unusable-hash')", [id]);
      await db.query(
        "insert into public.app_users(id,display_name,employee_code) values($1,$2,$2)",
        [id, `Fictional ${name}`],
      );
    }
    department = await scalar<string>(
      "select id as value from public.store_departments where store_id=$1 and code='DEMO-BAKERY'",
      [store],
    );
    await db.query(
      `insert into public.user_role_assignments(user_id,role,area_id,store_id,department_id) values
      ($1,'information_systems',null,null,null),($2,'product_office',null,null,null),($3,'store_manager',null,$9,null),
      ($4,'staff',null,$9,$10),($5,'area_manager','10000000-0000-4000-8000-000000000001',null,null),
      ($6,'store_operations',null,null,null),($7,'accounting',null,null,null),($8,'product_office',null,null,null)`,
      [...Object.values(ids), store, department],
    );
    await db.query(
      "insert into public.products(id,code,name,tax_rate,promotion_eligibility) values($1,'MOCK-FOOD','Fictional food',8,'eligible')",
      [product],
    );
    await db.query("insert into public.store_products(store_id,product_id) values($1,$3),($2,$3)", [
      store,
      otherStore,
      product,
    ]);
  }, 30000);
  beforeEach(root);
  afterAll(async () => {
    await db?.close();
  });

  it("マスタ保存はロールを検証し、競合更新を拒否して変更前後を監査する", async () => {
    const version = await scalar<string>(
      "select updated_at::text as value from public.products where id=$1",
      [product],
    );
    const values = {
      code: "MOCK-FOOD",
      name: "Fictional revised food",
      tax_rate: 8,
      active: true,
    };
    await asUser(ids.product);
    await scalar(
      "select public.save_business_master('products',$1,$2::jsonb,$3::timestamptz) as value",
      [product, JSON.stringify(values), version],
    );
    await expect(
      db.query("select public.save_business_master('products',$1,$2::jsonb,$3::timestamptz)", [
        product,
        JSON.stringify(values),
        version,
      ]),
    ).rejects.toThrow("Concurrent");
    await asUser(ids.staff);
    await expect(
      db.query("select public.save_business_master('products',null,$1::jsonb,null)", [
        JSON.stringify(values),
      ]),
    ).rejects.toThrow();
    await root();
    expect(
      await scalar<number>(
        "select count(*)::int as value from public.audit_logs where table_name='products' and operation='UPDATE' and actor_id=$1 and before_data->>'name'='Fictional food'",
        [ids.product],
      ),
    ).toBe(1);
  });

  it("発注は担当売場を検証し、ヘッダ・明細・連携待ちを原子的に保存し同一要求を一度だけ処理する", async () => {
    const request = randomUUID(),
      items = [{ product_id: product, quantity: 2 }];
    await asUser(ids.staff);
    const args = [store, department, JSON.stringify(items), request];
    const sql =
      "select public.submit_store_order($1,$2,(now() at time zone 'Asia/Tokyo')::date+3,$3::jsonb,$4) as value";
    const first = await scalar<string>(sql, args);
    expect(await scalar<string>(sql, args)).toBe(first);
    await expect(
      db.query(sql, [
        store,
        department,
        JSON.stringify([{ product_id: product, quantity: 3 }]),
        request,
      ]),
    ).rejects.toThrow("Conflicting order replay");
    await expect(
      db.query(sql, [otherStore, department, JSON.stringify(items), randomUUID()]),
    ).rejects.toThrow();
    await expect(
      db.query(sql, [
        store,
        department,
        JSON.stringify([{ product_id: product, quantity: 0 }]),
        randomUUID(),
      ]),
    ).rejects.toThrow();
    await root();
    expect(
      await scalar<number>(
        "select count(*)::int as value from public.order_lines where order_id=$1",
        [first],
      ),
    ).toBe(1);
    expect(
      await scalar<number>(
        "select count(*)::int as value from public.integration_jobs where payload->>'orderId'=$1",
        [first],
      ),
    ).toBe(1);
  });

  it("匿名端末は登録店舗の閲覧専用情報に限定され、失効後は拒否される", async () => {
    const token = randomBytes(32).toString("hex");
    await asUser(ids.info);
    const device = await scalar<string>(
      "select public.register_store_device($1,'Fictional station',$2) as value",
      [store, token],
    );
    await expect(db.query("select token_hash from public.store_devices")).rejects.toThrow(
      "permission denied",
    );
    await root();
    await db.exec("set role anon");
    const snapshot = await scalar<{ store: { id: string }; sales: unknown[] }>(
      "select public.store_device_snapshot($1) as value",
      [token],
    );
    expect(snapshot.store.id).toBe(store);
    expect(snapshot.sales).toEqual([]);
    await expect(
      db.query("select public.store_device_snapshot($1)", [randomBytes(32).toString("hex")]),
    ).rejects.toThrow();
    await expect(
      db.query("select public.register_store_device($1,'Fictional station',$2)", [store, token]),
    ).rejects.toThrow("permission denied");
    await asUser(ids.info);
    await db.query("select public.disable_store_device($1)", [device]);
    await root();
    await db.exec("set role anon");
    await expect(db.query("select public.store_device_snapshot($1)", [token])).rejects.toThrow();
  });

  it("初回変更待ちと無効利用者は業務データを取得できず、実パスワード変更時だけ解除される", async () => {
    await db.query("update public.app_users set must_change_password=true where id=$1", [
      ids.initial,
    ]);
    await asUser(ids.initial);
    expect(
      await scalar<boolean>(
        "select public.has_role(array['product_office']::public.app_role[]) as value",
      ),
    ).toBe(false);
    expect((await db.query("select * from public.products")).rows).toEqual([]);
    await root();
    await db.query(
      "update auth.users set encrypted_password='another-synthetic-unusable-hash' where id=$1",
      [ids.initial],
    );
    await asUser(ids.initial);
    expect(
      await scalar<boolean>(
        "select public.has_role(array['product_office']::public.app_role[]) as value",
      ),
    ).toBe(true);
    await root();
    await db.query("update public.app_users set active=false where id=$1", [ids.initial]);
    await asUser(ids.initial);
    expect((await db.query("select * from public.products")).rows).toEqual([]);
  });

  it("CSVは返品・値引の順序に依存せず集計し、再送を二重計上せず、矛盾・不正明細は全件ロールバックする", async () => {
    const base = {
      store_code: "DEMO-001",
      product_code: "MOCK-FOOD",
      department_code: "DEMO-BAKERY",
      business_date: "2020-01-03",
      transaction_time: "2020-01-03T23:00:00+09:00",
      receipt_key: "fictional-receipt",
      customer_count: 2,
      tax_rate: 8,
    };
    const rows = [
      {
        ...base,
        source_row_key: "a-discount",
        quantity: 0,
        amount_yen: -200,
        line_type: "discount",
      },
      {
        ...base,
        source_row_key: "z-sale",
        quantity: 1,
        amount_yen: 1000,
        line_type: "sale",
      },
    ];
    await asUser(ids.info);
    const sql = "select public.import_canonical_sales('fictional.csv',$1,$2::jsonb) as value";
    const first = await scalar<{ inserted: number }>(sql, ["a".repeat(64), JSON.stringify(rows)]);
    expect(first.inserted).toBe(2);
    expect(
      (await scalar<{ inserted: number }>(sql, ["b".repeat(64), JSON.stringify(rows)])).inserted,
    ).toBe(0);
    await expect(
      db.query(sql, ["c".repeat(64), JSON.stringify([{ ...rows[0], amount_yen: -201 }])]),
    ).rejects.toThrow("Conflicting replay");
    await expect(
      db.query(sql, [
        "d".repeat(64),
        JSON.stringify([
          { ...rows[1], source_row_key: "new-valid" },
          { ...rows[1], product_code: "MISSING", source_row_key: "invalid" },
        ]),
      ]),
    ).rejects.toThrow();
    await root();
    const day = (
      await db.query<{
        net_sales_yen: number;
        customer_count: number;
        transaction_count: number;
      }>(
        "select net_sales_yen::int,customer_count,transaction_count from public.sales_days where store_id=$1 and business_date='2020-01-03'",
        [store],
      )
    ).rows[0];
    expect(day).toEqual({
      net_sales_yen: 800,
      customer_count: 2,
      transaction_count: 1,
    });
    expect(
      await scalar<number>(
        "select count(*)::int as value from public.sales_imports where source_checksum in ($1,$2)",
        ["c".repeat(64), "d".repeat(64)],
      ),
    ).toBe(0);
    await db.query(
      "update public.sales_days set status='confirmed',confirmed_at=now(),confirmed_by=$2 where store_id=$1 and business_date='2020-01-03'",
      [store, ids.manager],
    );
    await asUser(ids.info);
    await expect(
      db.query(sql, [
        "e".repeat(64),
        JSON.stringify([{ ...rows[1], source_row_key: "after-confirmation" }]),
      ]),
    ).rejects.toThrow("Confirmed");
  });

  it("月次確定は未承認の修正が残る場合に拒否し、二段階承認後にだけ確定する", async () => {
    const day = await scalar<string>(
      "insert into public.sales_days(store_id,business_date,status,net_sales_yen,confirmed_by,confirmed_at) values($1,'2020-02-01','confirmed',1000,$2,now()) returning id as value",
      [store, ids.manager],
    );
    await asUser(ids.manager);
    const correction = await scalar<string>(
      "select public.request_sales_correction($1,'Fictional missing receipt',1100) as value",
      [day],
    );
    await asUser(ids.accounting);
    await expect(
      db.query("select public.finalize_sales_month($1,'2020-02-01')", [store]),
    ).rejects.toThrow("Pending corrections");
    await asUser(ids.area);
    await db.query("select public.approve_sales_correction($1,true,'Fictional first review')", [
      correction,
    ]);
    await asUser(ids.operations);
    await db.query("select public.approve_sales_correction($1,true,'Fictional final review')", [
      correction,
    ]);
    await asUser(ids.accounting);
    expect(
      await scalar<number>("select public.finalize_sales_month($1,'2020-02-01') as value", [store]),
    ).toBe(1);
    await asUser(ids.manager);
    await expect(
      db.query("select public.request_sales_correction($1,'Fictional change',1200)", [day]),
    ).rejects.toThrow("Monthly finalized");
  });

  it("外部イベントの同一IDは一度だけ適用し、古い在庫や矛盾する再送を反映しない", async () => {
    const rows = [
      {
        store_id: store,
        department_id: department,
        product_id: product,
        quantity: 8,
        observed_at: "2020-01-01T00:00:00Z",
        source_reference: "fictional-erp",
      },
    ];
    await db.exec("set role service_role");
    const sql = "select public.ingest_external_snapshot($1,'inventory',$2::jsonb) as value";
    expect(
      (await scalar<{ duplicate: boolean }>(sql, ["fictional-stock-1", JSON.stringify(rows)]))
        .duplicate,
    ).toBe(false);
    expect(
      (await scalar<{ duplicate: boolean }>(sql, ["fictional-stock-1", JSON.stringify(rows)]))
        .duplicate,
    ).toBe(true);
    await expect(
      db.query(sql, ["fictional-stock-1", JSON.stringify([{ ...rows[0], quantity: 99 }])]),
    ).rejects.toThrow("Conflicting event");
    await scalar(sql, [
      "fictional-stock-old",
      JSON.stringify([{ ...rows[0], quantity: 1, observed_at: "2019-01-01T00:00:00Z" }]),
    ]);
    await root();
    expect(
      await scalar<number>(
        "select quantity::int as value from public.inventory_snapshots where store_id=$1",
        [store],
      ),
    ).toBe(8);
    await asUser(ids.staff);
    await expect(
      db.query("select public.ingest_external_snapshot('not-allowed','inventory',$1::jsonb)", [
        JSON.stringify(rows),
      ]),
    ).rejects.toThrow("permission denied");
  });

  it("連携結果は有効なリースだけが確定でき、失敗は本部と店舗へ通知する", async () => {
    const jobId = await scalar<string>(
      "insert into public.integration_jobs(kind,idempotency_key,payload) values('campaign_restore','fictional-lease-test',$1::jsonb) returning id as value",
      [
        JSON.stringify({
          campaignId: randomUUID(),
          itemId: randomUUID(),
          storeId: store,
        }),
      ],
    );
    await db.exec("set role service_role");
    const jobs = (
      await db.query<{ id: string; lease_id: string }>(
        "select * from public.claim_integration_jobs(array['campaign_restore'],10)",
      )
    ).rows;
    const job = jobs.find((row) => row.id === jobId)!;
    expect(job).toBeDefined();
    await expect(
      db.query("select public.finish_integration_job($1,$2,true,null,null)", [jobId, randomUUID()]),
    ).rejects.toThrow("Stale");
    await db.query(
      "select public.finish_integration_job($1,$2,false,null,'Fictional external failure')",
      [jobId, job.lease_id],
    );
    await root();
    expect(
      await scalar<string>("select status as value from public.integration_jobs where id=$1", [
        jobId,
      ]),
    ).toBe("failed");
    expect(
      await scalar<number>(
        "select count(*)::int as value from public.notifications where user_id=$1 and notification_type='integration_failed'",
        [ids.manager],
      ),
    ).toBeGreaterThan(0);
    expect(
      await scalar<number>(
        "select count(*)::int as value from public.store_announcements where store_id=$1",
        [store],
      ),
    ).toBeGreaterThan(0);
  });

  it("通常売価の参照は最新値を使用し、店舗と全店の価格が食い違えば推測しない", async () => {
    await db.query(
      "insert into public.product_prices(product_id,price_yen,valid_from) values($1,100,now()-interval '2 days'),($1,120,now()-interval '1 day')",
      [product],
    );
    expect(
      await scalar<number>("select public.resolve_restore_price($1,$2) as value", [product, store]),
    ).toBe(120);
    await db.query(
      "insert into public.product_prices(product_id,store_id,price_yen,valid_from) values($1,$2,90,now()-interval '1 hour')",
      [product, store],
    );
    expect(
      await scalar<number | null>("select public.resolve_restore_price($1,$2) as value", [
        product,
        store,
      ]),
    ).toBeNull();
  });

  it("利用者CSVは未登録の認証IDを含めると全件を取り消す", async () => {
    await asUser(ids.info);
    const rows = [
      {
        id: ids.staff,
        employee_code: "would-change",
        display_name: "Fictional rename",
        active: true,
      },
      {
        id: randomUUID(),
        employee_code: "missing-auth",
        display_name: "Fictional missing",
        active: true,
      },
    ];
    await expect(
      db.query("select public.import_app_profiles($1::jsonb)", [JSON.stringify(rows)]),
    ).rejects.toThrow("identity missing");
    await root();
    expect(
      await scalar<string>("select employee_code as value from public.app_users where id=$1", [
        ids.staff,
      ]),
    ).toBe("Fictional staff");
  });

  it("下書きは版を照合して編集でき、公開時は期間重複と最新EDLP対象外を拒否する", async () => {
    await asUser(ids.product);
    const create =
      "select public.create_campaign_draft('Fictional draft',now()+interval '1 hour',now()+interval '1 day',$1::jsonb,array[$2::uuid]) as value";
    const items = JSON.stringify([{ product_id: product, price_yen: 80 }]);
    const campaign = await scalar<string>(create, [items, store]);
    const row = (
      await db.query<{ id: string; version: string }>(
        "select i.id,c.updated_at::text version from public.campaigns c join public.campaign_items i on i.campaign_id=c.id where c.id=$1",
        [campaign],
      )
    ).rows[0];
    await db.query("select public.verify_campaign_product($1)", [row.id]);
    const edit =
      "select public.edit_campaign_draft($1,$2,'Fictional edited',now()+interval '1 hour',now()+interval '1 day',$3::jsonb)";
    await db.query(edit, [campaign, row.version, JSON.stringify([{ id: row.id, price_yen: 90 }])]);
    await expect(
      db.query(edit, [campaign, row.version, JSON.stringify([{ id: row.id, price_yen: 91 }])]),
    ).rejects.toThrow("version");
    await db.query("select public.publish_campaign_draft($1)", [campaign]);
    const second = await scalar<string>(create, [items, store]);
    const secondItem = await scalar<string>(
      "select id as value from public.campaign_items where campaign_id=$1",
      [second],
    );
    await db.query("select public.verify_campaign_product($1)", [secondItem]);
    await expect(db.query("select public.publish_campaign_draft($1)", [second])).rejects.toThrow(
      "Overlapping",
    );
    await root();
    await db.query("update public.products set promotion_eligibility='excluded' where id=$1", [
      product,
    ]);
    await asUser(ids.product);
    await expect(db.query("select public.publish_campaign_draft($1)", [second])).rejects.toThrow(
      "current source master",
    );
    await root();
    expect(
      await scalar<number>(
        "select count(*)::int as value from public.audit_logs where table_name='store_devices' and (coalesce(before_data,'{}'::jsonb)?'token_hash' or coalesce(after_data,'{}'::jsonb)?'token_hash')",
      ),
    ).toBe(0);
  });
});
