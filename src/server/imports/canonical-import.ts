import { date, integer, text } from "@/server/validation";

/** RFC4180-style CSV parser: quoted delimiters/newlines and escaped quotes are supported. */
export function parseCsv(source: string): Record<string, string>[] {
  const input = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error("CSVの引用符が不正です。");
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed) throw new Error("CSVの引用符後に余分な文字があります。");
      cell += char;
    }
  }
  if (quoted) throw new Error("CSVの引用符が閉じられていません。");
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  const headers = rows.shift()?.map((value) => value.trim());
  if (
    !headers?.length ||
    headers.some((header) => !header) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("CSVのヘッダーが不正です。");
  return rows.map((values) => {
    if (values.length !== headers.length) throw new Error("CSVの列数が一致しません。");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

export function canonicalSalesRows(source: string) {
  const rows = parseCsv(source);
  if (!rows.length || rows.length > 10000)
    throw new Error("売上CSVは1～10,000明細で指定してください。");
  return rows.map((row) => {
    const amount = Number(row.amount_yen);
    const quantity = Number(row.quantity);
    if (
      !/^-?\d+$/.test(row.amount_yen ?? "") ||
      !Number.isSafeInteger(amount) ||
      !/^-?\d+(?:\.\d{1,3})?$/.test(row.quantity ?? "") ||
      !Number.isFinite(quantity)
    )
      throw new Error("売上金額・数量の形式が不正です。");
    if (!["sale", "discount", "void", "return"].includes(row.line_type))
      throw new Error("明細種別が不正です。");
    if (
      (row.line_type === "sale" && (amount < 0 || quantity < 0)) ||
      (row.line_type !== "sale" && amount > 0)
    )
      throw new Error("明細種別と金額の符号が一致しません。");
    const tax = integer(row.tax_rate, 8, 10);
    if (![8, 10].includes(tax)) throw new Error("税率は8または10です。");
    if (
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
        row.transaction_time ?? "",
      ) ||
      Number.isNaN(Date.parse(row.transaction_time))
    )
      throw new Error("取引日時はタイムゾーン付きISO形式で指定してください。");
    return {
      store_code: text(row.store_code, 80),
      product_code: text(row.product_code, 80),
      department_code: text(row.department_code, 80),
      business_date: date(row.business_date),
      transaction_time: row.transaction_time,
      source_row_key: text(row.source_row_key, 200),
      receipt_key: text(row.receipt_key, 200),
      customer_count: integer(row.customer_count ?? "1", 0, 99999),
      quantity,
      amount_yen: amount,
      tax_rate: tax,
      line_type: row.line_type,
    };
  });
}
