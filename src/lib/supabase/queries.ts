import { createSupabaseServerClient } from "@/lib/supabase/server";

const mockStores = [
  { id: "store-01", code: "TOK-001", name: "東京本店", status: "active", area_id: "area-tokyo", created_at: "2025-10-01T00:00:00.000Z" },
  { id: "store-02", code: "OSA-002", name: "大阪支店", status: "active", area_id: "area-osaka", created_at: "2025-10-01T00:00:00.000Z" },
  { id: "store-03", code: "FUK-003", name: "福岡店", status: "inactive", area_id: "area-fukuoka", created_at: "2025-10-01T00:00:00.000Z" },
];

const mockSalesDays = [
  { id: "sales-01", store_id: "store-01", business_date: "2025-10-20", status: "confirmed", gross_sales_yen: 1480000, net_sales_yen: 1360000, customer_count: 182, transaction_count: 154, confirmed_at: "2025-10-20T21:00:00.000Z" },
  { id: "sales-02", store_id: "store-02", business_date: "2025-10-20", status: "pending", gross_sales_yen: 1240000, net_sales_yen: 1188000, customer_count: 167, transaction_count: 142, confirmed_at: null },
  { id: "sales-03", store_id: "store-03", business_date: "2025-10-19", status: "confirmed", gross_sales_yen: 1065000, net_sales_yen: 989000, customer_count: 143, transaction_count: 129, confirmed_at: "2025-10-19T21:00:00.000Z" },
  { id: "sales-04", store_id: "store-01", business_date: "2025-10-19", status: "confirmed", gross_sales_yen: 1510000, net_sales_yen: 1394000, customer_count: 192, transaction_count: 158, confirmed_at: "2025-10-19T21:15:00.000Z" },
];

const mockSalesCorrections = [
  { id: "correction-01", sales_day_id: "sales-02", reason: "伝票欠落の修正", before_amount_yen: 1188000, after_amount_yen: 1215000, status: "pending_area_approval", requested_by: "staff-01", requested_at: "2025-10-20T18:00:00.000Z" },
  { id: "correction-02", sales_day_id: "sales-03", reason: "返金反映の再集計", before_amount_yen: 989000, after_amount_yen: 942500, status: "pending_final_approval", requested_by: "staff-02", requested_at: "2025-10-19T15:00:00.000Z" },
];

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getStoresForList() {
  if (!hasSupabaseConfig()) {
    return mockStores;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("stores")
      .select("id, code, name, status, area_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? mockStores;
  } catch {
    return mockStores;
  }
}

export async function getSalesDaysForList() {
  if (!hasSupabaseConfig()) {
    return mockSalesDays;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sales_days")
      .select("id, store_id, business_date, status, gross_sales_yen, net_sales_yen, customer_count, transaction_count, confirmed_at")
      .order("business_date", { ascending: false })
      .limit(30);

    if (error) {
      throw error;
    }

    return data ?? mockSalesDays;
  } catch {
    return mockSalesDays;
  }
}

export async function getSalesCorrectionsForList() {
  if (!hasSupabaseConfig()) {
    return mockSalesCorrections;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sales_corrections")
      .select("id, sales_day_id, reason, before_amount_yen, after_amount_yen, status, requested_by, requested_at")
      .order("requested_at", { ascending: false })
      .limit(30);

    if (error) {
      throw error;
    }

    return data ?? mockSalesCorrections;
  } catch {
    return mockSalesCorrections;
  }
}
