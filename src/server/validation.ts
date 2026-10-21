import type { Json, Resource } from "@/domain/contracts";

export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("対象を選択してください。");
  return value;
}
export function text(value: unknown, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`必須項目を${max}文字以内で入力してください。`);
  return value.trim();
}
export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+$/.test(String(value))) throw new Error("整数を入力してください。");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${min}～${max}の整数を入力してください。`);
  return number;
}
export function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("正しい日付を入力してください。");
  return value;
}
function clock(value: unknown): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) throw new Error("正しい時刻を入力してください。");
  return value;
}
export function japanDateTime(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("日時を指定してください。");
  const instant = new Date(`${value}:00+09:00`);
  if (Number.isNaN(instant.getTime()) || new Date(instant.getTime() + 9 * 3600000).toISOString().slice(0, 16) !== value) throw new Error("日時が不正です。");
  return instant.toISOString();
}
export function parseMaster(resource: Resource, input: FormData): Record<string, Json> {
  if (resource === "products") {
    const tax = integer(input.get("tax_rate"), 8, 10);
    if (tax !== 8 && tax !== 10) throw new Error("税率は8%または10%です。");
    return { code: text(input.get("code"), 80), name: text(input.get("name"), 200), category_code: String(input.get("category_code") ?? "").trim() || null, tax_rate: tax, active: input.get("active") === "true" };
  }
  if (resource === "stores") {
    const status = text(input.get("status"));
    if (!["active", "temporarily_closed", "closed"].includes(status)) throw new Error("店舗状態を選択してください。");
    return { code: text(input.get("code"), 80), name: text(input.get("name"), 200), area_id: uuid(input.get("area_id")), timezone: "Asia/Tokyo", business_day_starts_at: clock(input.get("business_day_starts_at")), closing_time: clock(input.get("closing_time")), opening_time: clock(input.get("opening_time")), status, has_dine_in: input.get("has_dine_in") === "true", opened_on: input.get("opened_on") ? date(input.get("opened_on")) : null };
  }
  if (resource === "users") return { display_name: text(input.get("display_name"), 200), employee_code: text(input.get("employee_code"), 80), affiliation: String(input.get("affiliation") ?? "").trim() || null, active: input.get("active") === "true" };
  if (resource === "announcements") return { store_id: uuid(input.get("store_id")), title: text(input.get("title"), 200), message: text(input.get("message"), 2000) };
  throw new Error("このデータは直接編集できません。");
}
