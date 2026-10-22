import { createHash, scryptSync } from "node:crypto";
import mysql from "mysql2/promise";

if (process.env.DATABASE_PROVIDER !== "mysql") {
  throw new Error("DATABASE_PROVIDER=mysql を設定してください。");
}
for (const key of ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER"]) {
  if (!process.env[key]) throw new Error(`${key} が未設定です。`);
}
const port = Number(process.env.MYSQL_PORT || 3306);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("MYSQL_PORTには1から65535の整数を設定してください。");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("本番環境にはデモデータを登録できません。");
}

const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || "",
  charset: "utf8mb4",
  timezone: "+09:00",
});
const q = (sql, values) => db.execute(sql, values);

// 架空かつ固定のIDを使い、ローカル環境で何度実行しても同じレコードを更新する。
const prefixes = {
  area: "10000000",
  store: "20000000",
  department: "21000000",
  user: "30000000",
  role: "31000000",
  product: "40000000",
  price: "41000000",
  import: "50000000",
  storeImport: "51000000",
  salesDay: "60000000",
  salesLine: "61000000",
  inventory: "62000000",
  announcement: "63000000",
  correction: "64000000",
  approval: "65000000",
  notification: "66000000",
  batch: "67000000",
  device: "70000000",
  instruction: "71000000",
  request: "72000000",
  campaign: "80000000",
  campaignItem: "81000000",
  order: "90000000",
  orderLine: "91000000",
  job: "92000000",
};
const fid = (kind, index) => `${prefixes[kind]}-0000-4000-8000-${String(index).padStart(12, "0")}`;
const externalId = (prefix, index) => `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
// 大量データ時の一覧、グラフ、改行、ページ送り、発注検索を確認する。
// 売上系は直前fixtureの約3倍、商品は約10倍にする。
const scaleStoreCount = 180;
const scaleProductCount = 1200;
const scaleSalesDaysPerStore = 30;
const scaleStoreAreas = ["北", "東", "西", "南", "中央", "湾岸", "山間", "駅前"];
const scaleStoreFormats = ["食品館", "駅前店", "郊外大型店", "モール店", "24時間店", "小型店"];
const scaleProductNames = [
  "国産素材を使った週末限定の大容量ファミリー向け詰め合わせセット",
  "毎日の食卓に便利な小分けパック",
  "冷凍保存できる業務用サイズ",
  "季節限定・数量限定の特別仕様商品",
  "アレルゲン表示と原材料表示を確認するための商品名が長いサンプル（オンライン注文・店舗受取対応）",
  "朝食向け",
  "深夜便対応の店舗限定商品",
  "まとめ買い対象・ケース販売対応商品",
];
const departmentForStore = (storeNumber, variant = 0) => {
  if (storeNumber === 1) return fid("department", variant + 1);
  if (storeNumber === 2) return fid("department", 4);
  if (storeNumber === 3) return fid("department", 5);
  if (storeNumber === 4) return fid("department", 6 + variant);
  return fid("department", 100 + (storeNumber - 5) * 2 + variant);
};
const passwordHash = scryptSync(
  "Demo!4f415f02764eedff91f594ee05862d5e877ba9",
  "minoriya-local-mysql-auth",
  64,
).toString("hex");

const areas = [
  [fid("area", 1), "DEMO-A", "架空デモ東エリア"],
  [fid("area", 2), "DEMO-B", "架空デモ西エリア"],
];
const stores = [
  [fid("store", 1), fid("area", 1), "DEMO-001", "架空みのり中央店", "active", 1],
  [fid("store", 2), fid("area", 1), "DEMO-002", "架空みのり駅前店", "active", 0],
  [fid("store", 3), fid("area", 2), "DEMO-003", "架空みのり港店", "temporarily_closed", 1],
  [fid("store", 4), fid("area", 2), "DEMO-004", "架空みのり旧町店", "closed", 0],
];
const departments = [
  [fid("department", 1), fid("store", 1), "FIXTURE-DELI", "惣菜", 1],
  [fid("department", 2), fid("store", 1), "FIXTURE-GROCERY", "食品", 1],
  [fid("department", 3), fid("store", 1), "FIXTURE-OLD", "旧催事売場", 0],
  [fid("department", 4), fid("store", 2), "FIXTURE-DELI", "惣菜", 1],
  [fid("department", 5), fid("store", 3), "FIXTURE-GROCERY", "食品", 1],
];
const products = [
  [fid("product", 1), "FIXTURE-FOOD-001", "架空 国産こしひかりおにぎり", "DELI", 8, 1, "eligible"],
  [fid("product", 2), "FIXTURE-FOOD-002", "架空 彩り幕の内弁当", "DELI", 8, 1, "eligible"],
  [fid("product", 3), "FIXTURE-FOOD-003", "架空 特選だし巻き", "DELI", 8, 1, "not_configured"],
  [fid("product", 4), "FIXTURE-HOME-001", "架空 キッチンペーパー", "HOME", 10, 1, "excluded"],
  [fid("product", 5), "FIXTURE-DRINK-001", "架空 緑茶500ml", "DRINK", 8, 1, "eligible"],
  [fid("product", 6), "FIXTURE-OLD-001", "架空 取扱終了商品", "OLD", 10, 0, "excluded"],
];
const users = [
  [fid("user", 1), "information_systems", "デモ 情報システム", "情報システム部", 1, 0],
  [fid("user", 2), "area_manager", "デモ エリア責任者", "東エリア", 1, 0],
  [fid("user", 3), "store_manager", "デモ 店長", "架空みのり中央店", 1, 0],
  [fid("user", 4), "department_lead", "デモ 売場責任者", "惣菜", 1, 1],
  [fid("user", 5), "staff", "デモ 担当者", "惣菜", 1, 0],
  [fid("user", 6), "product_office", "デモ 商品部", "商品部", 1, 0],
  [fid("user", 7), "store_operations", "デモ 店舗運営部", "店舗運営部", 1, 0],
  [fid("user", 8), "accounting", "デモ 経理", "経理部", 1, 0],
  [fid("user", 9), "inactive_staff", "デモ 利用停止者", "旧所属", 0, 0],
];

try {
  await db.beginTransaction();

  for (const row of areas) {
    await q(
      "INSERT INTO areas(id,code,name) VALUES(?,?,?) ON DUPLICATE KEY UPDATE code=VALUES(code),name=VALUES(name)",
      row,
    );
  }
  for (const [id, areaId, code, name, status, dineIn] of stores) {
    await q(
      "INSERT INTO stores(id,area_id,code,name,timezone,opening_time,closing_time,business_day_starts_at,status,has_dine_in,opened_on) VALUES(?,?,?,?,?,'09:00','22:30','22:30',?,?,?) ON DUPLICATE KEY UPDATE area_id=VALUES(area_id),code=VALUES(code),name=VALUES(name),status=VALUES(status),has_dine_in=VALUES(has_dine_in),opened_on=VALUES(opened_on)",
      [id, areaId, code, name, "Asia/Tokyo", status, dineIn, "2024-04-01"],
    );
  }
  for (let storeNumber = 5; storeNumber <= scaleStoreCount; storeNumber += 1) {
    const areaNumber = storeNumber % 2 === 0 ? 1 : 2;
    const status =
      storeNumber % 13 === 0 ? "closed" : storeNumber % 7 === 0 ? "temporarily_closed" : "active";
    const openingTime = ["06:00", "08:00", "09:00", "10:00"][storeNumber % 4];
    const closingTime = ["21:00", "22:30", "23:00", "23:30"][storeNumber % 4];
    const businessDayStartsAt = ["21:30", "22:30", "00:00"][storeNumber % 3];
    await q(
      "INSERT INTO stores(id,area_id,code,name,timezone,opening_time,closing_time,business_day_starts_at,status,has_dine_in,opened_on) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE area_id=VALUES(area_id),name=VALUES(name),opening_time=VALUES(opening_time),closing_time=VALUES(closing_time),business_day_starts_at=VALUES(business_day_starts_at),status=VALUES(status),has_dine_in=VALUES(has_dine_in),opened_on=VALUES(opened_on)",
      [
        fid("store", storeNumber),
        fid("area", areaNumber),
        `DEMO-${String(storeNumber).padStart(3, "0")}`,
        `架空みのり${scaleStoreAreas[storeNumber % scaleStoreAreas.length]}${scaleStoreFormats[storeNumber % scaleStoreFormats.length]} ${String(storeNumber).padStart(3, "0")}`,
        "Asia/Tokyo",
        openingTime,
        closingTime,
        businessDayStartsAt,
        status,
        storeNumber % 3 === 0 ? 1 : 0,
        `202${storeNumber % 5}-04-01`,
      ],
    );
  }
  for (const row of departments) {
    await q(
      "INSERT INTO store_departments(id,store_id,code,name,active) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),code=VALUES(code),name=VALUES(name),active=VALUES(active)",
      row,
    );
  }
  for (let storeNumber = 4; storeNumber <= scaleStoreCount; storeNumber += 1) {
    const firstDepartment = storeNumber === 4 ? 6 : 100 + (storeNumber - 5) * 2;
    for (let variant = 0; variant < 2; variant += 1) {
      await q(
        "INSERT INTO store_departments(id,store_id,code,name,active) VALUES(?,?,?,?,1) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),code=VALUES(code),name=VALUES(name),active=VALUES(active)",
        [
          fid("department", firstDepartment + variant),
          fid("store", storeNumber),
          variant ? "FIXTURE-GROCERY" : "FIXTURE-DELI",
          variant ? "食品" : "惣菜",
        ],
      );
    }
  }
  for (const row of products) {
    await q(
      "INSERT INTO products(id,code,name,category_code,tax_rate,active,promotion_eligibility) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE code=VALUES(code),name=VALUES(name),category_code=VALUES(category_code),tax_rate=VALUES(tax_rate),active=VALUES(active),promotion_eligibility=VALUES(promotion_eligibility)",
      row,
    );
  }
  const scaleCategories = ["DELI", "GROCERY", "DRINK", "HOME", "FROZEN", "DAIRY"];
  const eligibilityStates = ["eligible", "excluded", "not_configured"];
  for (let productNumber = 7; productNumber <= scaleProductCount; productNumber += 1) {
    const category = scaleCategories[productNumber % scaleCategories.length];
    await q(
      "INSERT INTO products(id,code,name,category_code,tax_rate,active,promotion_eligibility) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE code=VALUES(code),name=VALUES(name),category_code=VALUES(category_code),tax_rate=VALUES(tax_rate),active=VALUES(active),promotion_eligibility=VALUES(promotion_eligibility)",
      [
        fid("product", productNumber),
        `FIXTURE-SCALE-${String(productNumber).padStart(3, "0")}`,
        `架空 ${scaleProductNames[productNumber % scaleProductNames.length]} ${String(productNumber).padStart(3, "0")}`,
        category,
        productNumber % 4 === 0 ? 10 : 8,
        productNumber % 11 === 0 ? 0 : 1,
        eligibilityStates[productNumber % eligibilityStates.length],
      ],
    );
  }
  for (const [id, employeeCode, name, affiliation, active, changePassword] of users) {
    await q(
      "INSERT INTO app_users(id,email,employee_code,display_name,affiliation,active,must_change_password,password_hash) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email),employee_code=VALUES(employee_code),display_name=VALUES(display_name),affiliation=VALUES(affiliation),active=VALUES(active),must_change_password=VALUES(must_change_password),password_hash=VALUES(password_hash)",
      [
        id,
        `minoriya-demo+${employeeCode}@example.invalid`,
        employeeCode,
        name,
        affiliation,
        active,
        changePassword,
        passwordHash,
      ],
    );
  }
  const roles = [
    [1, "information_systems", null, null, null],
    [2, "area_manager", fid("area", 1), null, null],
    [3, "store_manager", null, fid("store", 1), null],
    [4, "department_lead", null, fid("store", 1), fid("department", 1)],
    [5, "staff", null, fid("store", 1), fid("department", 1)],
    [6, "product_office", null, null, null],
    [7, "store_operations", null, null, null],
    [8, "accounting", null, null, null],
    [9, "staff", null, fid("store", 1), fid("department", 1)],
  ];
  for (let index = 0; index < roles.length; index += 1) {
    const [userNumber, role, areaId, storeId, departmentId] = roles[index];
    await q(
      "INSERT INTO user_role_assignments(id,user_id,role,area_id,store_id,department_id,assigned_by) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),role=VALUES(role),area_id=VALUES(area_id),store_id=VALUES(store_id),department_id=VALUES(department_id),assigned_by=VALUES(assigned_by)",
      [
        fid("role", index + 1),
        fid("user", userNumber),
        role,
        areaId,
        storeId,
        departmentId,
        fid("user", 1),
      ],
    );
  }

  for (let productNumber = 1; productNumber <= scaleProductCount; productNumber += 1) {
    const baseProduct = products[productNumber - 1];
    const active = baseProduct ? baseProduct[5] : productNumber % 11 === 0 ? 0 : 1;
    await q(
      "INSERT INTO store_products(store_id,product_id,shelf_location,active) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE shelf_location=VALUES(shelf_location),active=VALUES(active)",
      [
        fid("store", 1),
        fid("product", productNumber),
        `デモ棚 ${Math.ceil(productNumber / 20)}-${String.fromCharCode(65 + (productNumber % 20))}`,
        active,
      ],
    );
    await q(
      "INSERT INTO product_prices(id,product_id,store_id,price_yen,valid_from,valid_until,created_by) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE price_yen=VALUES(price_yen),valid_from=VALUES(valid_from),valid_until=VALUES(valid_until)",
      [
        fid("price", productNumber),
        fid("product", productNumber),
        productNumber % 2 ? null : fid("store", 1),
        98 + ((productNumber * 73) % 4900),
        "2026-10-01 00:00:00.000",
        productNumber === 6 ? "2026-10-15 23:59:59.000" : null,
        fid("user", 6),
      ],
    );
  }

  const imports = [
    ["received", null, 120, null],
    ["processing", null, 240, null],
    ["completed", "2026-10-22 06:10:00.000", 360, null],
    ["failed", "2026-10-22 06:15:00.000", 42, "架空データ: 形式不一致を検出"],
  ];
  for (let index = 0; index < imports.length; index += 1) {
    const [status, completedAt, rows, error] = imports[index];
    await q(
      "INSERT INTO sales_imports(id,source_file_name,source_checksum,status,received_at,completed_at,rows_received,error_summary,started_by) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),completed_at=VALUES(completed_at),rows_received=VALUES(rows_received),error_summary=VALUES(error_summary),started_by=VALUES(started_by)",
      [
        fid("import", index + 1),
        `fictional-sales-${index + 1}.csv`,
        `fictional-mysql-demo-v2-${index + 1}`,
        status,
        `2026-10-22 06:0${index}:00.000`,
        completedAt,
        rows,
        error,
        fid("user", 1),
      ],
    );
    await q(
      "INSERT INTO store_sales_imports(id,import_id,store_id,business_date,status,rows_received,completed_at,error_summary) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),rows_received=VALUES(rows_received),completed_at=VALUES(completed_at),error_summary=VALUES(error_summary)",
      [
        fid("storeImport", index + 1),
        fid("import", index + 1),
        fid("store", (index % 3) + 1),
        `2026-10-${18 + index}`,
        status,
        rows,
        completedAt,
        error,
      ],
    );
  }

  const salesDays = [
    [1, "2026-10-22", "imported", 128700, 119200, null, null],
    [1, "2026-10-21", "confirmed", 143400, 132780, "2026-10-22 08:00:00.000", null],
    [
      1,
      "2026-09-30",
      "monthly_finalized",
      105800,
      97960,
      "2026-10-01 08:00:00.000",
      "2026-10-05 10:00:00.000",
    ],
    [2, "2026-10-22", "imported", 167200, 154815, null, null],
    [2, "2026-10-21", "confirmed", 151000, 139815, "2026-10-22 08:20:00.000", null],
    [
      2,
      "2026-09-30",
      "monthly_finalized",
      132100,
      122315,
      "2026-10-01 08:15:00.000",
      "2026-10-05 10:05:00.000",
    ],
    [3, "2026-10-20", "imported", 88400, 81852, null, null],
    [3, "2026-10-19", "confirmed", 91300, 84537, "2026-10-20 08:10:00.000", null],
  ];
  const lineTypes = ["sale", "discount", "void", "return"];
  for (let index = 0; index < salesDays.length; index += 1) {
    const [storeNumber, date, status, gross, net, confirmedAt, finalizedAt] = salesDays[index];
    await q(
      "INSERT INTO sales_days(id,store_id,business_date,status,gross_sales_yen,net_sales_yen,transaction_count,customer_count,imported_at,confirmed_by,confirmed_at,monthly_finalized_by,monthly_finalized_at,import_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),business_date=VALUES(business_date),status=VALUES(status),gross_sales_yen=VALUES(gross_sales_yen),net_sales_yen=VALUES(net_sales_yen),transaction_count=VALUES(transaction_count),customer_count=VALUES(customer_count),confirmed_by=VALUES(confirmed_by),confirmed_at=VALUES(confirmed_at),monthly_finalized_by=VALUES(monthly_finalized_by),monthly_finalized_at=VALUES(monthly_finalized_at),import_id=VALUES(import_id)",
      [
        fid("salesDay", index + 1),
        fid("store", storeNumber),
        date,
        status,
        gross,
        net,
        80 + index * 7,
        70 + index * 6,
        `${date} 23:00:00.000`,
        confirmedAt ? fid("user", 3) : null,
        confirmedAt,
        finalizedAt ? fid("user", 8) : null,
        finalizedAt,
        fid("import", 3),
      ],
    );
    for (let line = 0; line < 2; line += 1) {
      const product = products[(index + line) % products.length];
      const lineType = lineTypes[(index + line) % lineTypes.length];
      const departmentNumber = storeNumber === 1 ? line + 1 : storeNumber === 2 ? 4 : 5;
      await q(
        "INSERT INTO sales_lines(id,sales_day_id,product_id,product_code_snapshot,product_name_snapshot,department_id,quantity,amount_yen,tax_rate,transaction_time,line_type,source_row_key,import_id,receipt_key,receipt_customer_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE sales_day_id=VALUES(sales_day_id),product_id=VALUES(product_id),department_id=VALUES(department_id),amount_yen=VALUES(amount_yen),line_type=VALUES(line_type)",
        [
          fid("salesLine", index * 2 + line + 1),
          fid("salesDay", index + 1),
          product[0],
          product[1],
          product[2],
          fid("department", departmentNumber),
          lineType === "return" ? -1 : 2,
          ["return", "void"].includes(lineType) ? -680 : Math.floor(net / 2),
          product[4],
          `${date} ${line ? "18:30" : "12:15"}:00.000`,
          lineType,
          `fictional-v2-${index + 1}-${line + 1}`,
          fid("import", 3),
          `DEMO-RECEIPT-${index + 1}`,
          line ? 0 : 1,
        ],
      );
    }
  }

  const scaleLineTypes = ["sale", "discount", "void", "return"];
  for (let storeNumber = 1; storeNumber <= scaleStoreCount; storeNumber += 1) {
    for (let dayNumber = 0; dayNumber < scaleSalesDaysPerStore; dayNumber += 1) {
      const date = new Date(Date.UTC(2026, 5, dayNumber + 1)).toISOString().slice(0, 10);
      const sequence = (storeNumber - 1) * scaleSalesDaysPerStore + dayNumber;
      const stateIndex = (storeNumber + dayNumber) % 10;
      const status =
        stateIndex < 3 ? "imported" : stateIndex < 8 ? "confirmed" : "monthly_finalized";
      const confirmedAt = status === "imported" ? null : `${date} 23:30:00.000`;
      const finalizedAt = status === "monthly_finalized" ? `${date} 23:50:00.000` : null;
      const gross =
        78000 + storeNumber * 9413 + dayNumber * 2371 + ((storeNumber * dayNumber * 37) % 19000);
      const net = Math.floor(gross * (0.84 + ((storeNumber + dayNumber) % 10) / 100));
      const dayId = 10000 + sequence;
      await q(
        "INSERT INTO sales_days(id,store_id,business_date,status,gross_sales_yen,net_sales_yen,transaction_count,customer_count,imported_at,confirmed_by,confirmed_at,monthly_finalized_by,monthly_finalized_at,import_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),business_date=VALUES(business_date),status=VALUES(status),gross_sales_yen=VALUES(gross_sales_yen),net_sales_yen=VALUES(net_sales_yen),transaction_count=VALUES(transaction_count),customer_count=VALUES(customer_count),imported_at=VALUES(imported_at),confirmed_by=VALUES(confirmed_by),confirmed_at=VALUES(confirmed_at),monthly_finalized_by=VALUES(monthly_finalized_by),monthly_finalized_at=VALUES(monthly_finalized_at),import_id=VALUES(import_id)",
        [
          fid("salesDay", dayId),
          fid("store", storeNumber),
          date,
          status,
          gross,
          net,
          90 + ((storeNumber * 19 + dayNumber * 13) % 520),
          65 + ((storeNumber * 11 + dayNumber * 7) % 430),
          `${date} 23:00:00.000`,
          confirmedAt ? fid("user", 3) : null,
          confirmedAt,
          finalizedAt ? fid("user", 8) : null,
          finalizedAt,
          fid("import", 3),
        ],
      );
      for (let lineNumber = 0; lineNumber < 6; lineNumber += 1) {
        const productNumber =
          ((storeNumber * 5 + dayNumber * 3 + lineNumber * 7) % scaleProductCount) + 1;
        const baseProduct = products[productNumber - 1];
        const category =
          baseProduct?.[3] ?? scaleCategories[productNumber % scaleCategories.length];
        const productCode =
          baseProduct?.[1] ?? `FIXTURE-SCALE-${String(productNumber).padStart(3, "0")}`;
        const productName =
          baseProduct?.[2] ??
          `架空 ${scaleProductNames[productNumber % scaleProductNames.length]} ${String(productNumber).padStart(3, "0")}`;
        const lineType =
          scaleLineTypes[(storeNumber + dayNumber + lineNumber) % scaleLineTypes.length];
        const quantity = 1 + ((storeNumber * 3 + dayNumber + lineNumber * 2) % 12);
        const amount = Math.floor((900 + productNumber * 137 + dayNumber * 19) * quantity);
        await q(
          "INSERT INTO sales_lines(id,sales_day_id,product_id,product_code_snapshot,product_name_snapshot,department_id,quantity,amount_yen,tax_rate,transaction_time,line_type,source_row_key,import_id,receipt_key,receipt_customer_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE sales_day_id=VALUES(sales_day_id),product_id=VALUES(product_id),department_id=VALUES(department_id),quantity=VALUES(quantity),amount_yen=VALUES(amount_yen),line_type=VALUES(line_type)",
          [
            fid("salesLine", 100000 + sequence * 6 + lineNumber),
            fid("salesDay", dayId),
            fid("product", productNumber),
            productCode,
            productName,
            departmentForStore(storeNumber, lineNumber % 2),
            lineType === "return" ? -quantity : quantity,
            lineType === "return" || lineType === "void" ? -amount : amount,
            category === "HOME" ? 10 : 8,
            `${date} ${String(8 + ((lineNumber * 2 + dayNumber) % 14)).padStart(2, "0")}:${String((lineNumber * 11 + dayNumber * 7) % 60).padStart(2, "0")}:00.000`,
            lineType,
            `scale-${storeNumber}-${dayNumber}-${lineNumber}`,
            fid("import", 3),
            `SCALE-${storeNumber}-${dayNumber}-${Math.floor(lineNumber / 2)}`,
            lineNumber % 2 ? 0 : 1,
          ],
        );
      }
    }
  }

  for (let index = 0; index < 8; index += 1) {
    const storeNumber = index < 4 ? 1 : index < 6 ? 2 : 3;
    const departmentNumber = storeNumber === 1 ? (index % 2) + 1 : storeNumber === 2 ? 4 : 5;
    await q(
      "INSERT INTO inventory_snapshots(id,store_id,department_id,product_id,quantity,observed_at,source_reference) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),observed_at=VALUES(observed_at),source_reference=VALUES(source_reference)",
      [
        fid("inventory", index + 1),
        fid("store", storeNumber),
        fid("department", departmentNumber),
        fid("product", (index % 6) + 1),
        [24, 0, 3.5, 120, 8, 42, 1, 75][index],
        "2026-10-22 07:30:00.000",
        "fictional-mysql-demo-v2",
      ],
    );
  }

  for (let storeNumber = 1; storeNumber <= scaleStoreCount; storeNumber += 1) {
    for (let productOffset = 0; productOffset < 8; productOffset += 1) {
      let productNumber = ((storeNumber * 3 + productOffset * 5) % scaleProductCount) + 1;
      if (storeNumber === 3 && productNumber <= 2) productNumber += 2;
      const inventoryIndex = (storeNumber - 1) * 8 + productOffset;
      await q(
        "INSERT INTO inventory_snapshots(id,store_id,department_id,product_id,quantity,observed_at,source_reference) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),department_id=VALUES(department_id),product_id=VALUES(product_id),quantity=VALUES(quantity),observed_at=VALUES(observed_at),source_reference=VALUES(source_reference)",
        [
          fid("inventory", 10000 + inventoryIndex),
          fid("store", storeNumber),
          departmentForStore(storeNumber, productOffset % 2),
          fid("product", productNumber),
          [0, 0.5, 2, 7, 15, 28, 64, 140][(storeNumber + productOffset) % 8],
          `2026-06-${String(20 + (storeNumber % 10)).padStart(2, "0")} 07:30:00.000`,
          `fictional-mysql-scale-${storeNumber}-${productOffset}`,
        ],
      );
    }
  }

  const corrections = [
    [1, "pending_area_approval", 119200, 120000, "釣銭差異の確認中"],
    [4, "pending_operations_approval", 154815, 156000, "返品伝票の計上日修正"],
    [2, "approved", 132780, 133000, "値引き伝票の再集計"],
    [7, "rejected", 81852, 90000, "根拠資料不足のため差戻し"],
  ];
  for (let index = 0; index < corrections.length; index += 1) {
    const [day, status, before, after, reason] = corrections[index];
    await q(
      "INSERT INTO sales_corrections(id,sales_day_id,reason,before_amount_yen,after_amount_yen,status,requested_by,requested_at) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE reason=VALUES(reason),before_amount_yen=VALUES(before_amount_yen),after_amount_yen=VALUES(after_amount_yen),status=VALUES(status),requested_by=VALUES(requested_by)",
      [
        fid("correction", index + 1),
        fid("salesDay", day),
        reason,
        before,
        after,
        status,
        fid("user", 3),
        `2026-10-${22 - index} 09:00:00.000`,
      ],
    );
  }
  const approvals = [
    [2, "area", 1, "一次承認済み", 2],
    [3, "area", 1, "差異を確認しました", 2],
    [3, "operations", 1, "最終承認済み", 7],
    [4, "area", 0, "証憑を添付してください", 2],
  ];
  for (let index = 0; index < approvals.length; index += 1) {
    const [correction, stage, approved, comment, actor] = approvals[index];
    await q(
      "INSERT INTO sales_approvals(id,correction_id,approval_stage,approved,comment,actor_id,acted_at) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE approved=VALUES(approved),comment=VALUES(comment),actor_id=VALUES(actor_id),acted_at=VALUES(acted_at)",
      [
        fid("approval", index + 1),
        fid("correction", correction),
        stage,
        approved,
        comment,
        fid("user", actor),
        `2026-10-${21 - index} 10:00:00.000`,
      ],
    );
  }
  const notifications = [
    ["correction_requested", "売上修正の承認待ち", "中央店から売上修正が申請されました。", null, 1],
    [
      "correction_escalated",
      "本部承認待ち",
      "駅前店の修正が本部承認待ちです。",
      "2026-10-22 10:00:00.000",
      2,
    ],
    [
      "integration_failed",
      "連携エラーを確認してください",
      "架空の発注連携でエラーが発生しました。",
      null,
      null,
    ],
    [
      "campaign_pending",
      "特売準備が未完了です",
      "値札・POP・陳列の未対応項目があります。",
      null,
      null,
    ],
    [
      "daily_sales_confirmed",
      "日次売上を確定しました",
      "2026年10月21日の売上が確定しました。",
      "2026-10-22 09:30:00.000",
      null,
    ],
  ];
  for (let index = 0; index < notifications.length; index += 1) {
    const [type, title, message, readAt, correction] = notifications[index];
    await q(
      "INSERT INTO notifications(id,user_id,notification_type,title,message,read_at,created_at,correction_id) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),message=VALUES(message),read_at=VALUES(read_at),correction_id=VALUES(correction_id)",
      [
        fid("notification", index + 1),
        fid("user", 1),
        type,
        title,
        message,
        readAt,
        `2026-10-22 ${8 + index}:00:00.000`,
        correction ? fid("correction", correction) : null,
      ],
    );
  }

  const batches = [
    ["daily_sales_import", "received", null, {}, null],
    ["monthly_close", "processing", null, { processedStores: 2 }, null],
    ["inventory_sync", "completed", "2026-10-22 07:15:00.000", { processedRows: 8 }, null],
    [
      "campaign_sync",
      "failed",
      "2026-10-22 07:20:00.000",
      { errors: 1 },
      "架空データ: 接続タイムアウト",
    ],
  ];
  for (let index = 0; index < batches.length; index += 1) {
    const [type, status, completedAt, result, error] = batches[index];
    await q(
      "INSERT INTO batch_runs(id,batch_type,status,started_at,completed_at,result_summary,error_summary,started_by) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),completed_at=VALUES(completed_at),result_summary=VALUES(result_summary),error_summary=VALUES(error_summary)",
      [
        fid("batch", index + 1),
        type,
        status,
        `2026-10-22 07:0${index}:00.000`,
        completedAt,
        JSON.stringify(result),
        error,
        fid("user", 1),
      ],
    );
  }

  const orderStates = ["draft", "submitted", "sent", "failed", "cancelled"];
  for (let index = 0; index < orderStates.length; index += 1) {
    const storeNumber = (index % 2) + 1;
    const departmentNumber = storeNumber === 1 ? (index % 2) + 1 : 4;
    const quantity = [12, 24, 6, 18, 3][index];
    const unitPriceYen = 118 + index * 80;
    const lineTotalYen = quantity * unitPriceYen;
    await q(
      "INSERT INTO orders(id,store_id,department_id,order_date,status,requested_by,requested_delivery_date,order_total_yen) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),department_id=VALUES(department_id),status=VALUES(status),requested_delivery_date=VALUES(requested_delivery_date),order_total_yen=VALUES(order_total_yen),updated_at=CURRENT_TIMESTAMP(3)",
      [
        fid("order", index + 1),
        fid("store", storeNumber),
        fid("department", departmentNumber),
        "2026-10-22",
        orderStates[index],
        fid("user", 5),
        `2026-10-${24 + index}`,
        lineTotalYen,
      ],
    );
    await q(
      "INSERT INTO order_lines(id,order_id,product_id,quantity,unit_price_yen,line_total_yen) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE product_id=VALUES(product_id),quantity=VALUES(quantity),unit_price_yen=VALUES(unit_price_yen),line_total_yen=VALUES(line_total_yen)",
      [
        fid("orderLine", index + 1),
        fid("order", index + 1),
        fid("product", index + 1),
        quantity,
        unitPriceYen,
        lineTotalYen,
      ],
    );
  }

  const campaigns = [
    ["秋の架空お買得フェア", "draft", "2026-10-25 09:00:00.000", "2026-10-31 22:00:00.000", null],
    [
      "週末デモ特売",
      "scheduled",
      "2026-10-23 09:00:00.000",
      "2026-10-25 22:00:00.000",
      "2026-10-20 12:00:00.000",
    ],
    [
      "実施中デモ特売",
      "active",
      "2026-10-20 09:00:00.000",
      "2026-10-24 22:00:00.000",
      "2026-10-18 12:00:00.000",
    ],
    [
      "完了済みデモ特売",
      "completed",
      "2026-10-01 09:00:00.000",
      "2026-10-05 22:00:00.000",
      "2026-09-28 12:00:00.000",
    ],
  ];
  for (let index = 0; index < campaigns.length; index += 1) {
    const [name, status, startsAt, endsAt, publishedAt] = campaigns[index];
    await q(
      "INSERT INTO campaigns(id,name,product_id,price_yen,starts_at,ends_at,status,created_by,published_at) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),product_id=VALUES(product_id),price_yen=VALUES(price_yen),starts_at=VALUES(starts_at),ends_at=VALUES(ends_at),status=VALUES(status),published_at=VALUES(published_at)",
      [
        fid("campaign", index + 1),
        name,
        fid("product", index + 1),
        98 + index * 50,
        startsAt,
        endsAt,
        status,
        fid("user", 6),
        publishedAt,
      ],
    );
  }
  const itemMatrix = [
    [1, 1, "not_configured"],
    [2, 1, "eligible"],
    [2, 3, "excluded"],
    [3, 2, "eligible"],
    [3, 5, "not_configured"],
    [4, 1, "eligible"],
  ];
  for (let index = 0; index < itemMatrix.length; index += 1) {
    const [campaign, product, status] = itemMatrix[index];
    await q(
      "INSERT INTO campaign_items(id,campaign_id,product_id,price_yen,eligibility_status) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE product_id=VALUES(product_id),price_yen=VALUES(price_yen),eligibility_status=VALUES(eligibility_status)",
      [
        fid("campaignItem", index + 1),
        fid("campaign", campaign),
        fid("product", product),
        88 + index * 30,
        status,
      ],
    );
  }
  for (let campaign = 1; campaign <= 4; campaign += 1) {
    for (let store = 1; store <= 2; store += 1) {
      const confirmed = campaign === 2 && store === 1;
      await q(
        "INSERT INTO campaign_store_targets(campaign_id,store_id,store_confirmed_at,store_confirmed_by,applied_at,restored_at,last_error) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE store_confirmed_at=VALUES(store_confirmed_at),store_confirmed_by=VALUES(store_confirmed_by),applied_at=VALUES(applied_at),restored_at=VALUES(restored_at),last_error=VALUES(last_error)",
        [
          fid("campaign", campaign),
          fid("store", store),
          confirmed ? "2026-10-21 15:00:00.000" : null,
          confirmed ? fid("user", 3) : null,
          campaign >= 3 ? "2026-10-20 09:00:00.000" : null,
          campaign === 4 ? "2026-10-05 22:05:00.000" : null,
          campaign === 3 && store === 2 ? "架空データ: POS応答待ち" : null,
        ],
      );
    }
  }
  const tasks = [
    ["not_configured", "not_configured", 0],
    ["pending", "pending", 0],
    ["applied", "pending", 1],
    ["failed", "failed", 0],
    ["manual_confirmed", "manual_confirmed", 1],
    ["applied", "restored", 1],
  ];
  for (let index = 0; index < tasks.length; index += 1) {
    const [promotion, restore, physicalDone] = tasks[index];
    const promotionDone = ["applied", "manual_confirmed"].includes(promotion);
    const restoreDone = ["restored", "manual_confirmed"].includes(restore);
    await q(
      "INSERT INTO campaign_item_store_tasks(campaign_item_id,store_id,pos_promotion_status,pos_promotion_confirmed_at,pos_promotion_error,price_label_changed_at,price_label_changed_by,pop_changed_at,pop_changed_by,display_changed_at,display_changed_by,pos_restore_status,pos_restored_at,pos_restore_error,price_label_restored_at,price_label_restored_by,pop_restored_at,pop_restored_by,display_restored_at,display_restored_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE pos_promotion_status=VALUES(pos_promotion_status),pos_promotion_confirmed_at=VALUES(pos_promotion_confirmed_at),pos_promotion_error=VALUES(pos_promotion_error),price_label_changed_at=VALUES(price_label_changed_at),pop_changed_at=VALUES(pop_changed_at),display_changed_at=VALUES(display_changed_at),pos_restore_status=VALUES(pos_restore_status),pos_restored_at=VALUES(pos_restored_at),pos_restore_error=VALUES(pos_restore_error),price_label_restored_at=VALUES(price_label_restored_at),pop_restored_at=VALUES(pop_restored_at),display_restored_at=VALUES(display_restored_at)",
      [
        fid("campaignItem", index + 1),
        fid("store", (index % 2) + 1),
        promotion,
        promotionDone ? "2026-10-22 09:00:00.000" : null,
        promotion === "failed" ? "架空データ: POS商品コード未登録" : null,
        physicalDone ? "2026-10-22 09:10:00.000" : null,
        physicalDone ? fid("user", 5) : null,
        physicalDone && index !== 2 ? "2026-10-22 09:15:00.000" : null,
        physicalDone && index !== 2 ? fid("user", 5) : null,
        physicalDone && index >= 4 ? "2026-10-22 09:20:00.000" : null,
        physicalDone && index >= 4 ? fid("user", 5) : null,
        restore,
        restoreDone ? "2026-10-22 22:10:00.000" : null,
        restore === "failed" ? "架空データ: POS通常価格復帰失敗" : null,
        restore === "restored" ? "2026-10-22 22:15:00.000" : null,
        restore === "restored" ? fid("user", 5) : null,
        restore === "restored" ? "2026-10-22 22:16:00.000" : null,
        restore === "restored" ? fid("user", 5) : null,
        restore === "restored" ? "2026-10-22 22:17:00.000" : null,
        restore === "restored" ? fid("user", 5) : null,
      ],
    );
  }

  const instructions = [
    ["promotion", "特売売場を準備してください", "値札・POP・陳列を確認してください。", 1, 98],
    [
      "price_change",
      "通常売価を変更してください",
      "翌朝の開店前までに値札を交換してください。",
      4,
      398,
    ],
    ["promotion", "特売終了後の復旧確認", "通常売価と通常陳列への復旧を確認してください。", 2, 248],
  ];
  for (let index = 0; index < instructions.length; index += 1) {
    const [kind, title, message, product, price] = instructions[index];
    await q(
      "INSERT INTO store_instructions(id,request_id,kind,title,message,product_id,price_yen,effective_at,created_by) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE kind=VALUES(kind),title=VALUES(title),message=VALUES(message),product_id=VALUES(product_id),price_yen=VALUES(price_yen),effective_at=VALUES(effective_at)",
      [
        fid("instruction", index + 1),
        fid("request", index + 1),
        kind,
        title,
        message,
        fid("product", product),
        price,
        `2026-10-${23 + index} 09:00:00.000`,
        fid("user", 6),
      ],
    );
    for (let store = 1; store <= 2; store += 1) {
      const confirmed = (index + store) % 2 === 0;
      await q(
        "INSERT INTO store_instruction_targets(instruction_id,store_id,confirmed_by,confirmed_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE confirmed_by=VALUES(confirmed_by),confirmed_at=VALUES(confirmed_at)",
        [
          fid("instruction", index + 1),
          fid("store", store),
          confirmed ? fid("user", 3) : null,
          confirmed ? "2026-10-22 11:00:00.000" : null,
        ],
      );
    }
  }

  const deviceCodes = [
    "6ac6881e515326727cdeb8e78e544d2e575d1f5fb1988c6b604eb357fa6bad69",
    "fictional-demo-device-002-connection-code",
    "fictional-demo-device-disabled-code",
  ];
  for (let index = 0; index < deviceCodes.length; index += 1) {
    await q(
      "INSERT INTO store_devices(id,store_id,name,token_hash,active,created_by) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),name=VALUES(name),active=VALUES(active),created_by=VALUES(created_by)",
      [
        fid("device", index + 1),
        fid("store", (index % 2) + 1),
        `架空デモ店舗端末 ${index + 1}`,
        createHash("sha256").update(deviceCodes[index]).digest(),
        index < 2 ? 1 : 0,
        fid("user", 1),
      ],
    );
  }
  for (let index = 0; index < 4; index += 1) {
    await q(
      "INSERT INTO store_announcements(id,store_id,title,message,created_by) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE store_id=VALUES(store_id),title=VALUES(title),message=VALUES(message),created_by=VALUES(created_by)",
      [
        fid("announcement", index + 1),
        fid("store", index + 1),
        ["本日の確認事項", "棚卸予定", "休業のお知らせ", "閉店済み店舗の履歴"][index],
        [
          "未対応の店舗指示を確認してください。",
          "月末棚卸は18時開始予定です。",
          "設備点検のため休業中です。",
          "これは履歴確認用の架空データです。",
        ][index],
        fid("user", 7),
      ],
    );
  }

  const jobs = [
    ["order", "pending", 0, null, null],
    ["campaign_price", "processing", 1, null, null],
    ["campaign_restore", "completed", 1, null, { restored: true }],
    ["sales_import", "failed", 3, "架空データ: 再試行上限に到達", null],
  ];
  for (let index = 0; index < jobs.length; index += 1) {
    const [kind, status, attempts, error, result] = jobs[index];
    await q(
      "INSERT INTO integration_jobs(id,kind,idempotency_key,payload,status,attempts,lease_id,locked_until,available_at,last_error,result) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),attempts=VALUES(attempts),lease_id=VALUES(lease_id),locked_until=VALUES(locked_until),available_at=VALUES(available_at),last_error=VALUES(last_error),result=VALUES(result)",
      [
        fid("job", index + 1),
        kind,
        `fictional-demo-v2-${kind}`,
        JSON.stringify({ fixture: true, kind }),
        status,
        attempts,
        status === "processing" ? externalId("93000000", 1) : null,
        status === "processing" ? "2026-10-22 12:30:00.000" : null,
        "2026-10-22 12:00:00.000",
        error,
        result ? JSON.stringify(result) : null,
      ],
    );
  }

  const auditRows = [
    [9000001, "products", fid("product", 1), "UPDATE", { price_yen: 138 }, { price_yen: 118 }],
    [
      9000002,
      "sales_corrections",
      fid("correction", 1),
      "INSERT",
      null,
      { status: "pending_area_approval" },
    ],
    [9000003, "orders", fid("order", 3), "UPDATE", { status: "submitted" }, { status: "sent" }],
    [
      9000004,
      "campaigns",
      fid("campaign", 2),
      "UPDATE",
      { status: "draft" },
      { status: "scheduled" },
    ],
  ];
  for (const [id, table, record, operation, before, after] of auditRows) {
    await q(
      "INSERT INTO audit_logs(id,table_name,record_id,operation,actor_id,occurred_at,before_data,after_data) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE table_name=VALUES(table_name),record_id=VALUES(record_id),operation=VALUES(operation),actor_id=VALUES(actor_id),before_data=VALUES(before_data),after_data=VALUES(after_data)",
      [
        id,
        table,
        record,
        operation,
        fid("user", 1),
        "2026-10-22 12:00:00.000",
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
      ],
    );
  }

  await db.commit();
  console.log(
    `MySQL rich demo fixtures ready: ${scaleStoreCount} stores, ${scaleProductCount} products, ${8 + scaleStoreCount * scaleSalesDaysPerStore} sales days, and ${16 + scaleStoreCount * scaleSalesDaysPerStore * 6} sales lines (fictional records).`,
  );
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
