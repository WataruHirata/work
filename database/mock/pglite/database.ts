import "server-only";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { scryptSync } from "node:crypto";

type LocalDatabase = PGlite;
const globalDatabase = globalThis as typeof globalThis & {
  __minoriyaPglite?: Promise<LocalDatabase>;
  __minoriyaPgliteQueue?: Promise<void>;
};

async function initialize() {
  const databasePath = resolve(process.cwd(), ".local/mock-db");
  await mkdir(resolve(process.cwd(), ".local"), { recursive: true });
  const db = new PGlite(databasePath);
  await db.waitReady;
  await db.exec(`
    create schema if not exists auth;
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create table if not exists auth.users (
      id uuid primary key,
      email text unique,
      encrypted_password text not null default '',
      email_confirmed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create table if not exists public.local_migration_history (
      version text primary key, applied_at timestamptz not null default now()
    );
  `);
  await db.exec("revoke all on public.local_migration_history from anon, authenticated;");
  const migrationDir = resolve(process.cwd(), "supabase/migrations");
  const files = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const applied = await db.query(
      "select 1 from public.local_migration_history where version=$1",
      [file],
    );
    if (applied.rows.length) continue;
    await db.exec(await readFile(resolve(migrationDir, file), "utf8"));
    await db.query("insert into public.local_migration_history(version) values($1)", [file]);
  }
  await db.exec(await readFile(resolve(process.cwd(), "supabase/seed.sql"), "utf8"));
  await db.exec(`
    grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    grant select on all tables in schema public to anon;
  `);
  await seedMockRecords(db);
  return db;
}

async function seedMockRecords(database: LocalDatabase) {
  await database.transaction(async (db) => {
    const initialized = await db.query<{ name: string | null }>(
      "select to_regclass('public.local_fixture_state') as name",
    );
    if (initialized.rows[0]?.name) return;
    const demoPassword = scryptSync(
      "Demo!4f415f02764eedff91f594ee05862d5e877ba9",
      "minoriya-local-mock-auth",
      64,
    ).toString("hex");
    const users = [
      [
        "30000000-0000-4000-8000-000000000001",
        "information_systems",
        "Demo information systems",
        "minoriya-demo+information_systems@example.invalid",
        "information_systems",
      ],
      [
        "30000000-0000-4000-8000-000000000002",
        "product_office",
        "Demo product office",
        "minoriya-demo+product_office@example.invalid",
        "product_office",
      ],
      [
        "30000000-0000-4000-8000-000000000003",
        "store_operations",
        "Demo store operations",
        "minoriya-demo+store_operations@example.invalid",
        "store_operations",
      ],
      [
        "30000000-0000-4000-8000-000000000004",
        "area_manager",
        "Demo area manager",
        "minoriya-demo+area_manager@example.invalid",
        "area_manager",
      ],
      [
        "30000000-0000-4000-8000-000000000005",
        "store_manager",
        "Demo store manager",
        "minoriya-demo+store_manager@example.invalid",
        "store_manager",
      ],
      [
        "30000000-0000-4000-8000-000000000006",
        "department_lead",
        "Demo department lead",
        "minoriya-demo+department_lead@example.invalid",
        "department_lead",
      ],
      [
        "30000000-0000-4000-8000-000000000007",
        "staff",
        "Demo staff",
        "minoriya-demo+staff@example.invalid",
        "staff",
      ],
      [
        "30000000-0000-4000-8000-000000000008",
        "accounting",
        "Demo accounting",
        "minoriya-demo+accounting@example.invalid",
        "accounting",
      ],
    ] as const;
    await db.query(
      `create table public.local_fixture_state (id boolean primary key default true check(id))`,
    );
    await db.query("insert into public.local_fixture_state default values");
    for (const [id, code, displayName, email, role] of users) {
      await db.query(
        "insert into auth.users(id,email,encrypted_password,email_confirmed_at) values($1,$2,$3,now()) on conflict(id) do nothing",
        [id, email, demoPassword],
      );
      await db.query(
        "insert into public.app_users(id,employee_code,display_name,email,active,must_change_password) values($1,$2,$3,$4,true,false) on conflict(id) do nothing",
        [id, code, displayName, email],
      );
      const department =
        role === "department_lead" || role === "staff"
          ? ((
              await db.query<{ id: string }>(
                "select id from public.store_departments where store_id=$1 and code='DEMO-BAKERY'",
                ["20000000-0000-4000-8000-000000000001"],
              )
            ).rows[0]?.id ?? null)
          : null;
      await db.query(
        "insert into public.user_role_assignments(user_id,role,area_id,store_id,department_id) values($1,$2::public.app_role,$3,$4,$5)",
        [
          id,
          role,
          role === "area_manager" ? "10000000-0000-4000-8000-000000000001" : null,
          role === "store_manager" || role === "department_lead" || role === "staff"
            ? "20000000-0000-4000-8000-000000000001"
            : null,
          department,
        ],
      );
    }
    // Functional sample records follow the same constraints and policies as the Supabase migrations.
    await db.exec(`
    insert into public.products(id,code,name,category_code,tax_rate,active,promotion_eligibility) values
      ('40000000-0000-4000-8000-000000000001','DEMO-FOOD-001','Mock bread','BAKERY',8,true,'eligible'),
      ('40000000-0000-4000-8000-000000000002','DEMO-FOOD-002','Mock prepared meal','DELI',8,true,'eligible'),
      ('40000000-0000-4000-8000-000000000003','DEMO-FOOD-003','Mock household goods','GOODS',10,true,'eligible');
    insert into public.product_prices(product_id,store_id,price_yen,valid_from)
      select product.id,store.id,case product.code when 'DEMO-FOOD-001' then 198 when 'DEMO-FOOD-002' then 498 else 328 end,now()-interval '30 days'
      from public.products product cross join public.stores store where product.code like 'DEMO-FOOD-%';
    insert into public.store_products(store_id,product_id,active)
      select store.id,product.id,true from public.stores store cross join public.products product where product.code like 'DEMO-FOOD-%';
    insert into public.sales_imports(source_file_name,source_checksum,status,rows_received)
      values('mock-sales.csv','fictional-local-sales-v1','completed',6);
    insert into public.sales_days(store_id,business_date,status,gross_sales_yen,net_sales_yen,transaction_count,customer_count,import_id)
      select store.id,current_date-1,'imported',128700,116400,96,81,source.id from public.stores store cross join public.sales_imports source where source.source_checksum='fictional-local-sales-v1';
    insert into public.sales_lines(sales_day_id,product_id,product_code_snapshot,product_name_snapshot,department_id,quantity,amount_yen,tax_rate,transaction_time,line_type,source_row_key,import_id)
      select day.id,product.id,product.code,product.name,department.id,1,case product.code when 'DEMO-FOOD-001' then 198 when 'DEMO-FOOD-002' then 498 else 328 end,product.tax_rate,now()-interval '1 day','sale',product.code||'-'||store.code,day.import_id
      from public.sales_days day join public.stores store on store.id=day.store_id join public.products product on product.code like 'DEMO-FOOD-%'
      join public.store_departments department on department.store_id=store.id and department.code=case product.code when 'DEMO-FOOD-001' then 'DEMO-BAKERY' when 'DEMO-FOOD-002' then 'DEMO-DELI' else 'DEMO-GROCERY' end;
    insert into public.inventory_snapshots(store_id,department_id,product_id,quantity,observed_at,source_reference)
      select store.id,department.id,product.id,24,now()-interval '1 hour','fictional-local-snapshot'
      from public.stores store join public.store_departments department on department.store_id=store.id
      join public.products product on product.code like 'DEMO-FOOD-%' and department.code=case product.code when 'DEMO-FOOD-001' then 'DEMO-BAKERY' when 'DEMO-FOOD-002' then 'DEMO-DELI' else 'DEMO-GROCERY' end;
    insert into public.store_announcements(store_id,title,message,created_by)
      select id,'Local mock announcement','This record is fictional sample data stored in the repository database.', '30000000-0000-4000-8000-000000000001' from public.stores;
    insert into public.campaigns(name,product_id,price_yen,starts_at,ends_at,status,created_by)
      values('Mock seasonal campaign','40000000-0000-4000-8000-000000000001',178,now()+interval '1 day',now()+interval '8 days','draft','30000000-0000-4000-8000-000000000002');
    insert into public.campaign_items(campaign_id,product_id,price_yen,eligibility_status)
      select id,product_id,price_yen,'eligible' from public.campaigns where name='Mock seasonal campaign';
    insert into public.campaign_store_targets(campaign_id,store_id)
      select campaign.id,store.id from public.campaigns campaign cross join public.stores store where campaign.name='Mock seasonal campaign';
    insert into public.notifications(user_id,notification_type,title,message)
      select id,'system','Local mock database','Use fictional data to explore the application.' from auth.users;
  `);
    await db.query(
      "insert into public.store_devices(store_id,name,token_hash,created_by) values($1,'DEMO-001 mock station',sha256(convert_to($2,'UTF8')),$3)",
      [
        "20000000-0000-4000-8000-000000000001",
        "6ac6881e515326727cdeb8e78e544d2e575d1f5fb1988c6b604eb357fa6bad69",
        users[0][0],
      ],
    );
    await db.exec("revoke all on public.local_fixture_state from anon, authenticated;");
  });
}

export async function localDatabase(): Promise<LocalDatabase> {
  return (globalDatabase.__minoriyaPglite ??= initialize());
}

/** PGlite is a single local PostgreSQL session; serialize requests and always reset request claims. */
export async function withLocalDatabase<T>(
  operation: (db: LocalDatabase) => Promise<T>,
): Promise<T> {
  const previous = globalDatabase.__minoriyaPgliteQueue ?? Promise.resolve();
  let release!: () => void;
  globalDatabase.__minoriyaPgliteQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation(await localDatabase());
  } finally {
    release();
  }
}
