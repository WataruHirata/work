import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const managerId = "30000000-0000-4000-8000-000000000001";
const staffId = "30000000-0000-4000-8000-000000000002";
const areaManagerId = "30000000-0000-4000-8000-000000000003";
const operationsId = "30000000-0000-4000-8000-000000000004";
const accountantId = "30000000-0000-4000-8000-000000000005";
const productOfficeId = "30000000-0000-4000-8000-000000000006";
const firstStoreId = "20000000-0000-4000-8000-000000000001";
const secondStoreId = "20000000-0000-4000-8000-000000000002";
const firstProductId = "40000000-0000-4000-8000-000000000001";
const secondProductId = "40000000-0000-4000-8000-000000000002";

let db: PGlite;
let correctionId: string;

async function selectAs(userId: string) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated`);
}

describe("initial database migration and row-level security", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create table auth.users (id uuid primary key);
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);

    const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
    const migrations = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const migration of migrations) {
      await db.exec(await readFile(resolve(migrationDirectory, migration), "utf8"));
    }
    await db.exec(await readFile(resolve(process.cwd(), "supabase/seed.sql"), "utf8"));
    await db.exec(`
      grant usage on schema public to authenticated;
      grant select, insert, update, delete on all tables in schema public to authenticated;
      grant usage, select on all sequences in schema public to authenticated;
      insert into auth.users (id)
      values
        ('${managerId}'), ('${staffId}'), ('${areaManagerId}'),
        ('${operationsId}'), ('${accountantId}'), ('${productOfficeId}');
      insert into public.app_users (id, display_name)
      values
        ('${managerId}', 'Demo manager'),
        ('${staffId}', 'Demo department staff'),
        ('${areaManagerId}', 'Demo area manager'),
        ('${operationsId}', 'Demo operations approver'),
        ('${accountantId}', 'Demo accountant'),
        ('${productOfficeId}', 'Demo product office');
      insert into public.user_role_assignments (user_id, role, store_id)
      values ('${managerId}', 'store_manager', '${firstStoreId}');
      insert into public.user_role_assignments (user_id, role, store_id, department_id)
      values (
        '${staffId}',
        'staff',
        '${firstStoreId}',
        (select id from public.store_departments where store_id = '${firstStoreId}' and code = 'DEMO-BAKERY')
      );
      insert into public.user_role_assignments (user_id, role, area_id)
      values ('${areaManagerId}', 'area_manager', '10000000-0000-4000-8000-000000000001');
      insert into public.user_role_assignments (user_id, role)
      values
        ('${operationsId}', 'store_operations'),
        ('${accountantId}', 'accounting'),
        ('${productOfficeId}', 'product_office');
      insert into public.products (id, code, name, tax_rate)
      values
        ('${firstProductId}', 'DEMO-CAMPAIGN-001', 'Fictional campaign item one', 8),
        ('${secondProductId}', 'DEMO-CAMPAIGN-002', 'Fictional campaign item two', 10);
      insert into public.sales_imports (source_file_name, source_checksum)
      values ('fictional-sales.csv', 'fictional-sales-checksum');
      insert into public.sales_days (
        store_id, business_date, status, gross_sales_yen, net_sales_yen,
        confirmed_by, confirmed_at, import_id
      )
      select '${firstStoreId}', '2020-01-01', 'confirmed', 1000, 1000,
        '${managerId}', now(), id from public.sales_imports;
      insert into public.sales_days (
        store_id, business_date, status, gross_sales_yen, net_sales_yen,
        confirmed_by, confirmed_at, import_id
      )
      select '${secondStoreId}', '2020-01-01', 'confirmed', 2000, 2000,
        '${managerId}', now(), id from public.sales_imports;
      insert into public.sales_days (
        store_id, business_date, status, gross_sales_yen, net_sales_yen,
        confirmed_by, confirmed_at, import_id
      )
      select '${firstStoreId}', '2020-01-02', 'confirmed', 500, 500,
        '${managerId}', now(), id from public.sales_imports;
      insert into public.sales_lines (
        sales_day_id, product_code_snapshot, product_name_snapshot, department_id,
        quantity, amount_yen, tax_rate, transaction_time, line_type, source_row_key, import_id
      )
      select day.id, 'DEMO-ITEM-1', 'Fictional bakery item', department.id,
        1, 1000, 8, now(), 'sale', 'fictional-row-1', imports.id
      from public.sales_days day
      join public.sales_imports imports on imports.id = day.import_id
      join public.store_departments department
        on department.store_id = day.store_id and department.code = 'DEMO-BAKERY'
      where day.store_id = '${firstStoreId}' and day.business_date = '2020-01-01';
      insert into public.sales_lines (
        sales_day_id, product_code_snapshot, product_name_snapshot, department_id,
        quantity, amount_yen, tax_rate, transaction_time, line_type, source_row_key, import_id
      )
      select day.id, 'DEMO-ITEM-2', 'Fictional deli item', department.id,
        1, 1000, 8, now(), 'sale', 'fictional-row-2', imports.id
      from public.sales_days day
      join public.sales_imports imports on imports.id = day.import_id
      join public.store_departments department
        on department.store_id = day.store_id and department.code = 'DEMO-DELI'
      where day.store_id = '${firstStoreId}' and day.business_date = '2020-01-01';
    `);
  }, 15_000);

  afterAll(async () => {
    await db.close();
  });

  it("applies migrations and seeds only fictional store records", async () => {
    const stores = await db.query<{ code: string }>(
      "select code from public.stores order by code",
    );
    expect(stores.rows.map(({ code }) => code)).toEqual(["DEMO-001", "DEMO-002", "DEMO-003"]);
  });

  it("assigns sales to store-specific business dates around local cutoff times", async () => {
    const standardBeforeCutoff = await db.query<{ business_date: string }>(
      `select to_char(public.store_business_date('${firstStoreId}', '2026-10-20T13:29:00Z'), 'YYYY-MM-DD') as business_date`,
    );
    const standardAtCutoff = await db.query<{ business_date: string }>(
      `select to_char(public.store_business_date('${firstStoreId}', '2026-10-20T13:30:00Z'), 'YYYY-MM-DD') as business_date`,
    );
    const overnightBeforeCutoff = await db.query<{ business_date: string }>(
      `select to_char(public.store_business_date('${secondStoreId}', '2026-10-20T20:59:00Z'), 'YYYY-MM-DD') as business_date`,
    );
    const overnightAtCutoff = await db.query<{ business_date: string }>(
      `select to_char(public.store_business_date('${secondStoreId}', '2026-10-20T21:00:00Z'), 'YYYY-MM-DD') as business_date`,
    );

    expect(standardBeforeCutoff.rows[0].business_date).toBe("2026-10-19");
    expect(standardAtCutoff.rows[0].business_date).toBe("2026-10-20");
    expect(overnightBeforeCutoff.rows[0].business_date).toBe("2026-10-20");
    expect(overnightAtCutoff.rows[0].business_date).toBe("2026-10-21");
  });

  it("limits a store manager to the assigned store's store-level sales", async () => {
    await selectAs(managerId);
    const stores = await db.query<{ id: string }>("select id from public.stores");
    const salesDays = await db.query<{ store_id: string }>("select store_id from public.sales_days");
    await db.exec("reset role");

    expect(stores.rows.map(({ id }) => id)).toEqual([firstStoreId]);
    expect(salesDays.rows.map(({ store_id }) => store_id)).toEqual([
      firstStoreId,
      firstStoreId,
    ]);
  });

  it("limits department staff to their store metadata and assigned department's sales lines", async () => {
    await selectAs(staffId);
    const stores = await db.query<{ id: string }>("select id from public.stores");
    const salesDays = await db.query<{ id: string }>("select id from public.sales_days");
    const salesLines = await db.query<{ product_code_snapshot: string }>(
      "select product_code_snapshot from public.sales_lines order by product_code_snapshot",
    );
    await db.exec("reset role");

    expect(stores.rows.map(({ id }) => id)).toEqual([firstStoreId]);
    expect(salesDays.rows).toEqual([]);
    expect(salesLines.rows.map(({ product_code_snapshot }) => product_code_snapshot)).toEqual([
      "DEMO-ITEM-1",
    ]);
  });

  it("requires area and operations approvals for prior-day sales corrections", async () => {
    await selectAs(managerId);
    const day = await db.query<{ id: string }>(
      `select id from public.sales_days where store_id = '${firstStoreId}' and business_date = '2020-01-01'`,
    );
    const request = await db.query<{ id: string }>(
      `select public.request_sales_correction('${day.rows[0].id}', 'Fictional correction', 1250) as id`,
    );
    correctionId = request.rows[0].id;
    await expect(
      db.query(`select public.approve_sales_correction('${correctionId}', true, null)`),
    ).rejects.toThrow("not allowed");
    await db.exec("reset role");

    await selectAs(areaManagerId);
    await db.query(`select public.approve_sales_correction('${correctionId}', true, null)`);
    await db.exec("reset role");
    const awaitingOperations = await db.query<{ status: string }>(
      `select status from public.sales_corrections where id = '${correctionId}'`,
    );
    expect(awaitingOperations.rows[0].status).toBe("pending_operations_approval");

    await selectAs(operationsId);
    await db.query(`select public.approve_sales_correction('${correctionId}', true, null)`);
    await db.exec("reset role");
    const correctedSales = await db.query<{ net_sales_yen: number; status: string }>(
      `select day.net_sales_yen, correction.status
       from public.sales_days day
       join public.sales_corrections correction on correction.sales_day_id = day.id
       where correction.id = '${correctionId}'`,
    );
    expect(correctedSales.rows[0]).toEqual({
      net_sales_yen: 1250,
      status: "approved",
    });
  });

  it("allows only accounting to finalize a month and then prevents corrections", async () => {
    await selectAs(accountantId);
    const finalized = await db.query<{ finalize_sales_month: number }>(
      `select public.finalize_sales_month('${firstStoreId}', '2020-01-01')`,
    );
    await db.exec("reset role");
    expect(finalized.rows[0].finalize_sales_month).toBe(2);

    const finalizedDays = await db.query<{ status: string }>(
      `select status from public.sales_days
       where store_id = '${firstStoreId}' and business_date between '2020-01-01' and '2020-01-31'
       order by business_date`,
    );
    expect(finalizedDays.rows.map(({ status }) => status)).toEqual([
      "monthly_finalized",
      "monthly_finalized",
    ]);

    await selectAs(managerId);
    await expect(
      db.query(
        `select public.request_sales_correction(
          (select id from public.sales_days where store_id = '${firstStoreId}' and business_date = '2020-01-01'),
          'Correction after monthly finalization',
          1300
        )`,
      ),
    ).rejects.toThrow("Monthly finalized sales cannot be changed");
    await db.exec("reset role");
  });

  it("creates product-office campaigns atomically and scopes store work to assigned users", async () => {
    await selectAs(managerId);
    await expect(
      db.query(
        `select public.create_campaign_draft(
          'Fictional campaign', now(), now() + interval '1 day',
          jsonb_build_array(jsonb_build_object('product_id', '${firstProductId}', 'price_yen', 120)),
          array['${firstStoreId}']::uuid[]
        )`,
      ),
    ).rejects.toThrow("Only product office users can create campaigns");
    await db.exec("reset role");

    await selectAs(productOfficeId);
    const created = await db.query<{ campaign_id: string }>(
      `select public.create_campaign_draft(
        'Fictional autumn campaign',
        '2026-11-01T00:00:00+09:00',
        '2026-11-03T00:00:00+09:00',
        jsonb_build_array(
          jsonb_build_object('product_id', '${firstProductId}', 'price_yen', 120),
          jsonb_build_object('product_id', '${secondProductId}', 'price_yen', 240)
        ),
        array['${firstStoreId}', '${secondStoreId}']::uuid[]
      ) as campaign_id`,
    );
    const campaignId = created.rows[0].campaign_id;
    const draftVisibility = await db.query<{ count: number }>(
      `select count(*)::int as count from public.campaigns where id = '${campaignId}'`,
    );
    expect(draftVisibility.rows[0].count).toBe(1);
    await db.exec("reset role");

    await selectAs(managerId);
    const hiddenDraft = await db.query<{ count: number }>(
      `select count(*)::int as count from public.campaigns where id = '${campaignId}'`,
    );
    expect(hiddenDraft.rows[0].count).toBe(0);
    const hiddenDraftItems = await db.query<{ count: number }>(
      `select count(*)::int as count
       from public.campaign_items where campaign_id = '${campaignId}'`,
    );
    expect(hiddenDraftItems.rows[0].count).toBe(0);
    await db.exec("reset role");

    await selectAs(productOfficeId);
    const campaignItems = await db.query<{ id: string; eligibility_status: string }>(
      `select id, eligibility_status from public.campaign_items where campaign_id = '${campaignId}' order by product_id`,
    );
    expect(campaignItems.rows).toHaveLength(2);
    expect(campaignItems.rows.every(({ eligibility_status }) => eligibility_status === "not_configured")).toBe(true);
    await expect(
      db.query(`select public.publish_campaign_draft('${campaignId}')`),
    ).rejects.toThrow("verified as non-EDLP");
    await db.exec("reset role");
    await db.exec(
      `update public.campaign_items set eligibility_status = 'eligible' where campaign_id = '${campaignId}'`,
    );

    await selectAs(productOfficeId);
    await db.query(`select public.publish_campaign_draft('${campaignId}')`);
    const directCampaignUpdate = await db.query<{ id: string }>(
      `update public.campaigns set status = 'failed' where id = '${campaignId}' returning id`,
    );
    expect(directCampaignUpdate.rows).toHaveLength(0);
    const initialTasks = await db.query<{ pos_promotion_status: string; pos_restore_status: string }>(
      `select task.pos_promotion_status, task.pos_restore_status
       from public.campaign_item_store_tasks task
       join public.campaign_items item on item.id = task.campaign_item_id
       where item.campaign_id = '${campaignId}'`,
    );
    expect(initialTasks.rows).toHaveLength(4);
    expect(initialTasks.rows.every((task) =>
      task.pos_promotion_status === "not_configured" && task.pos_restore_status === "not_configured",
    )).toBe(true);
    await db.exec("reset role");

    await selectAs(managerId);
    const visibleCampaign = await db.query<{ status: string }>(
      `select status from public.campaigns where id = '${campaignId}'`,
    );
    expect(visibleCampaign.rows[0].status).toBe("scheduled");
    const visibleTasks = await db.query<{ store_id: string }>(
      `select task.store_id
       from public.campaign_item_store_tasks task
       join public.campaign_items item on item.id = task.campaign_item_id
       where item.campaign_id = '${campaignId}'`,
    );
    expect(visibleTasks.rows).toHaveLength(2);
    expect(visibleTasks.rows.every(({ store_id }) => store_id === firstStoreId)).toBe(true);

    await db.query(
      `select public.set_campaign_store_confirmation('${campaignItems.rows[0].id}', '${firstStoreId}', true)`,
    );
    await db.query(
      `select public.set_campaign_item_store_task('${campaignItems.rows[0].id}', '${firstStoreId}', 'price_label_changed', true)`,
    );
    await expect(
      db.query(
        `select public.set_campaign_item_store_task('${campaignItems.rows[0].id}', '${secondStoreId}', 'price_label_changed', true)`,
      ),
    ).rejects.toThrow("Only an assigned store user");
    await expect(
      db.query(
        `select public.set_campaign_item_store_task('${campaignItems.rows[0].id}', '${firstStoreId}', 'price_label_restored', true)`,
      ),
    ).rejects.toThrow("not available");
    await db.exec("reset role");

    const storeConfirmation = await db.query<{ store_confirmed_by: string; store_confirmed_at: string | null }>(
      `select store_confirmed_by, store_confirmed_at
       from public.campaign_store_targets where campaign_id = '${campaignId}' and store_id = '${firstStoreId}'`,
    );
    expect(storeConfirmation.rows[0].store_confirmed_by).toBe(managerId);
    expect(storeConfirmation.rows[0].store_confirmed_at).not.toBeNull();
    const completedTask = await db.query<{ price_label_changed_by: string; price_label_changed_at: string | null }>(
      `select task.price_label_changed_by, task.price_label_changed_at
       from public.campaign_item_store_tasks task
       where task.campaign_item_id = '${campaignItems.rows[0].id}' and task.store_id = '${firstStoreId}'`,
    );
    expect(completedTask.rows[0].price_label_changed_by).toBe(managerId);
    expect(completedTask.rows[0].price_label_changed_at).not.toBeNull();
  });
});
