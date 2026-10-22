import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

// This script deliberately never prints credentials, tokens, or password values.
const env = process.env;
if (env.ALLOW_DEMO_DATA_SETUP !== "true")
  throw new Error("モックDB用の環境で ALLOW_DEMO_DATA_SETUP=true を設定してください。");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Supabase URLとサーバー用キーが未設定です。");
if (env.VERCEL_ENV === "production")
  throw new Error("Production環境でモックデータを作成しません。");
const withUsers = env.DEMO_SEED_AUTH_USERS === "true";
if (withUsers && (!env.DEMO_INITIAL_PASSWORD || env.DEMO_INITIAL_PASSWORD.length < 12))
  throw new Error("認証アカウントも作る場合は、12文字以上の DEMO_INITIAL_PASSWORD が必要です。");
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const uid = (key) => {
  const h = createHash("sha256").update(`minoriya-fixture-v1:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
function checked(result, stage) {
  if (result.error)
    throw new Error(`${stage}に失敗しました。DB版・制約・接続権限を確認してください。`);
  return result.data;
}
async function insert(table, rows, onConflict = "id") {
  if (rows.length)
    checked(
      await client.from(table).upsert(rows, { onConflict, ignoreDuplicates: true }),
      `${table}のモック登録`,
    );
}
async function run() {
  for (const [table, columns] of [
    ["app_users", "id,email,must_change_password"],
    ["products", "id,promotion_eligibility"],
    ["integration_jobs", "id"],
    ["store_devices", "id"],
  ])
    checked(
      await client.from(table).select(columns).limit(0),
      `${table}のスキーマ確認（先にマイグレーションを適用）`,
    );
  await insert(
    "areas",
    [
      { id: uid("areaA"), code: "DEMO-A", name: "デモエリア A" },
      { id: uid("areaB"), code: "DEMO-B", name: "デモエリア B" },
    ],
    "code",
  );
  const areas = checked(
    await client.from("areas").select("id,code").in("code", ["DEMO-A", "DEMO-B"]),
    "デモエリア取得",
  );
  const areaId = (code) => areas.find((row) => row.code === code).id;
  const storeSeeds = [
    {
      code: "DEMO-001",
      name: "デモ店舗・標準",
      area_id: areaId("DEMO-A"),
      closing_time: "22:30",
      business_day_starts_at: "22:30",
      has_dine_in: false,
    },
    {
      code: "DEMO-002",
      name: "デモ店舗・24時間",
      area_id: areaId("DEMO-A"),
      closing_time: "06:00",
      business_day_starts_at: "06:00",
      has_dine_in: true,
    },
    {
      code: "DEMO-003",
      name: "デモ店舗・モール",
      area_id: areaId("DEMO-B"),
      closing_time: "21:00",
      business_day_starts_at: "21:00",
      has_dine_in: false,
    },
  ];
  await insert(
    "stores",
    storeSeeds.map((row) => ({
      id: uid(row.code),
      timezone: "Asia/Tokyo",
      opening_time: "09:00",
      status: "active",
      ...row,
    })),
    "code",
  );
  const stores = checked(
    await client
      .from("stores")
      .select("id,code,business_day_starts_at")
      .in(
        "code",
        storeSeeds.map((row) => row.code),
      )
      .order("code"),
    "デモ店舗取得",
  );
  await insert(
    "store_departments",
    stores.map((row) => ({
      id: uid(`department:${row.id}`),
      store_id: row.id,
      code: "FIXTURE-FOOD",
      name: "デモ売場・食品",
    })),
    "store_id,code",
  );
  const departments = checked(
    await client
      .from("store_departments")
      .select("id,store_id")
      .eq("code", "FIXTURE-FOOD")
      .in(
        "store_id",
        stores.map((row) => row.id),
      ),
    "デモ売場取得",
  );
  const departmentFor = (storeId) => departments.find((row) => row.store_id === storeId).id;
  const productSeeds = [
    {
      code: "FIXTURE-V1-FOOD",
      name: "架空商品・りんご",
      tax_rate: 8,
      category_code: "FOOD",
      promotion_eligibility: "eligible",
    },
    {
      code: "FIXTURE-V1-HOME",
      name: "架空商品・キッチン用品",
      tax_rate: 10,
      category_code: "HOME",
      promotion_eligibility: "eligible",
    },
    {
      code: "FIXTURE-V1-EDLP",
      name: "架空商品・EDLP対象",
      tax_rate: 8,
      category_code: "FOOD",
      promotion_eligibility: "excluded",
    },
  ];
  await insert(
    "products",
    productSeeds.map((row) => ({ id: uid(row.code), ...row })),
    "code",
  );
  const products = checked(
    await client
      .from("products")
      .select("id,code,tax_rate")
      .in(
        "code",
        productSeeds.map((row) => row.code),
      )
      .order("code"),
    "デモ商品取得",
  );
  await insert(
    "store_products",
    stores.flatMap((store) =>
      products.map((product) => ({
        store_id: store.id,
        product_id: product.id,
        active: true,
        shelf_location: "デモ棚 A-1",
      })),
    ),
    "store_id,product_id",
  );

  let authUsers = 0;
  const users = {};
  const roles = [
    "information_systems",
    "product_office",
    "store_operations",
    "area_manager",
    "store_manager",
    "department_lead",
    "staff",
    "accounting",
  ];
  if (withUsers)
    for (const role of roles) {
      const employeeCode = `FIXTURE-V1-${role}`;
      const email = `minoriya-demo+${role}@${env.DEMO_EMAIL_DOMAIN || "example.invalid"}`;
      const existing = checked(
        await client.from("app_users").select("id").eq("employee_code", employeeCode).maybeSingle(),
        "デモ利用者の重複確認",
      );
      let id = existing?.id;
      if (id) {
        const original = await client.auth.admin.getUserById(id);
        if (original.error || original.data.user.email !== email)
          throw new Error("デモ社員番号が別アカウントで使われています。上書きせず停止しました。");
      } else {
        const created = await client.auth.admin.createUser({
          email,
          password: env.DEMO_INITIAL_PASSWORD,
          email_confirm: true,
        });
        if (created.error || !created.data.user)
          throw new Error(
            "デモ認証アカウントを作成できません。既存の同名アカウントを確認してください。",
          );
        id = created.data.user.id;
        const profile = await client.from("app_users").insert({
          id,
          employee_code: employeeCode,
          display_name: `デモ担当・${role}`,
          email,
          active: true,
          must_change_password: false,
        });
        if (profile.error) {
          await client.auth.admin.deleteUser(id);
          throw new Error(
            "デモプロフィールを保存できず、今回作成した認証アカウントを取り消しました。",
          );
        }
      }
      // Demo credentials are intentionally reusable; do not force a password rotation on fixture accounts.
      checked(
        await client
          .from("app_users")
          .update({ must_change_password: false })
          .eq("id", id)
          .eq("employee_code", employeeCode),
        "デモ利用者のログイン設定",
      );
      users[role] = id;
      const store = stores.find((row) => row.code === "DEMO-001");
      const assignment = {
        user_id: id,
        role,
        area_id: role === "area_manager" ? areaId("DEMO-A") : null,
        store_id: ["store_manager", "department_lead", "staff"].includes(role) ? store.id : null,
        department_id: ["department_lead", "staff"].includes(role) ? departmentFor(store.id) : null,
      };
      await insert(
        "user_role_assignments",
        [assignment],
        "user_id,role,area_id,store_id,department_id",
      );
      await insert("notifications", [
        {
          id: uid(`welcome:${id}`),
          user_id: id,
          notification_type: "demo_welcome",
          title: "モックDBの通知",
          message: "この通知はDBから取得しています。個人ログイン後に業務操作を検証できます。",
        },
      ]);
      authUsers++;
    }

  const today = new Date().toISOString().slice(0, 10);
  const stock = stores.flatMap((store, index) =>
    products.map((product) => ({
      store_id: store.id,
      department_id: departmentFor(store.id),
      product_id: product.id,
      quantity: 30 + index * 10,
      observed_at: `${today}T00:00:00Z`,
      source_reference: "fictional-erp-v1",
    })),
  );
  checked(
    await client.rpc("ingest_external_snapshot", {
      p_event_id: `fixture-v1-inventory:${today}`,
      p_kind: "inventory",
      p_rows: stock,
    }),
    "モック在庫登録",
  );
  const prices = stores.flatMap((store) =>
    products.map((product) => ({
      product_id: product.id,
      store_id: store.id,
      price_yen: product.tax_rate === 10 ? 550 : 216,
      valid_from: "2020-01-01T00:00:00Z",
      valid_until: null,
      promotion_eligibility: product.code.endsWith("EDLP") ? "excluded" : "eligible",
    })),
  );
  checked(
    await client.rpc("ingest_external_snapshot", {
      p_event_id: "fixture-v1-prices",
      p_kind: "prices",
      p_rows: prices,
    }),
    "モック通常売価登録",
  );
  let salesInserted = 0;
  for (let offset = 8; offset >= 2; offset--) {
    const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    const rows = stores.flatMap((store, storeIndex) => {
      const [hour, minute] = store.business_day_starts_at.split(":").map(Number);
      const timestamp = new Date(
        Date.parse(`${date}T00:00:00+09:00`) + (hour * 60 + minute + 60) * 60000,
      ).toISOString();
      return Array.from({ length: 20 }, (_, receipt) =>
        products.slice(0, 2).map((product, index) => ({
          store_code: store.code,
          department_code: "FIXTURE-FOOD",
          product_code: product.code,
          business_date: date,
          transaction_time: timestamp,
          source_row_key: `fixture-v1:${date}:${store.code}:${receipt}:${product.code}`,
          receipt_key: `fixture-v1:${date}:${store.code}:${receipt}`,
          customer_count: 1,
          quantity: 1,
          amount_yen: 200 + 10 * storeIndex + 50 * index,
          tax_rate: product.tax_rate,
          line_type: "sale",
        })),
      ).flat();
    });
    const result = checked(
      await client.rpc("ingest_external_snapshot", {
        p_event_id: `fixture-v1-sales:${date}`,
        p_kind: "sales",
        p_rows: rows,
      }),
      "モック売上登録",
    );
    salesInserted += result.inserted || 0;
    // Initial fictional confirmed state is scoped to the demo manager's own store only.
    // Replays and existing imports are not changed.
    if (result.inserted && result.importId && users.store_manager)
      checked(
        await client
          .from("sales_days")
          .update({
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            confirmed_by: users.store_manager,
          })
          .eq("import_id", result.importId)
          .eq("store_id", stores.find((row) => row.code === "DEMO-001").id)
          .eq("status", "imported"),
        "デモ過去売上の初期状態",
      );
  }
  for (const store of stores) {
    const now = new Date();
    const local = new Date(now.getTime() + 9 * 3600000);
    const [hour, minute] = store.business_day_starts_at.split(":").map(Number);
    const date = new Date(
      local.getTime() -
        (local.getUTCHours() * 60 + local.getUTCMinutes() < hour * 60 + minute ? 86400000 : 0),
    )
      .toISOString()
      .slice(0, 10);
    const timestamp = new Date(
      Date.parse(`${date}T00:00:00+09:00`) + (hour * 60 + minute) * 60000,
    ).toISOString();
    const rows = Array.from({ length: 5 }, (_, receipt) =>
      products.slice(0, 2).map((product, index) => ({
        store_code: store.code,
        department_code: "FIXTURE-FOOD",
        product_code: product.code,
        business_date: date,
        transaction_time: timestamp,
        source_row_key: `fixture-current:${date}:${store.code}:${receipt}:${product.code}`,
        receipt_key: `fixture-current:${date}:${store.code}:${receipt}`,
        customer_count: 1,
        quantity: 1,
        amount_yen: 200 + 50 * index,
        tax_rate: product.tax_rate,
        line_type: "sale",
      })),
    ).flat();
    const result = checked(
      await client.rpc("ingest_external_snapshot", {
        p_event_id: `fixture-current:${date}:${store.code}`,
        p_kind: "sales",
        p_rows: rows,
      }),
      "デモ当日売上登録",
    );
    salesInserted += result.inserted || 0;
  }
  const campaignId = uid("campaign-draft");
  const promoProducts = products.filter((row) => !row.code.endsWith("EDLP"));
  await insert("campaigns", [
    {
      id: campaignId,
      name: "架空の週末特売",
      product_id: promoProducts[0].id,
      price_yen: 180,
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      ends_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      status: "draft",
      created_by: users.product_office ?? null,
    },
  ]);
  await insert(
    "campaign_items",
    promoProducts.map((product) => ({
      id: uid(`campaign-item:${product.id}`),
      campaign_id: campaignId,
      product_id: product.id,
      price_yen: 180,
      eligibility_status: "eligible",
    })),
    "campaign_id,product_id",
  );
  await insert(
    "campaign_store_targets",
    stores.map((store) => ({ campaign_id: campaignId, store_id: store.id })),
    "campaign_id,store_id",
  );
  const campaignItems = checked(
    await client.from("campaign_items").select("id").eq("campaign_id", campaignId),
    "モック特売取得",
  );
  await insert(
    "campaign_item_store_tasks",
    stores.flatMap((store) =>
      campaignItems.map((item) => ({
        campaign_item_id: item.id,
        store_id: store.id,
      })),
    ),
    "campaign_item_id,store_id",
  );
  await insert(
    "store_announcements",
    stores.map((store) => ({
      id: uid(`announcement:${store.id}`),
      store_id: store.id,
      title: "モック店舗のお知らせ",
      message: "店舗端末を接続すると、自店舗に宛てたお知らせだけを参照できます。",
    })),
  );
  console.log(
    JSON.stringify({
      ok: true,
      stores: stores.length,
      products: products.length,
      authUsers,
      salesInserted,
      note: "既存データ・既存パスワードは上書きしていません。",
    }),
  );
}
run().catch(() => {
  console.error(
    "モックのセットアップが完了しませんでした。スキーマ適用、接続設定、デモ社員番号・メールアドレスの重複を確認してください。途中まで作成済みの場合も再実行できます。",
  );
  process.exitCode = 1;
});
